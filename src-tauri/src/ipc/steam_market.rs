use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, CONTENT_TYPE, REFERER, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

use crate::types::{
    SteamMarketInventoryGroup, SteamMarketInventoryScanResult, SteamMarketItem,
    SteamMarketListingItem, SteamMarketListingsResult, SteamMarketPriceQuote,
    SteamMarketSellBatchRequest, SteamMarketSellBatchResult, SteamMarketSellItemRequest,
    SteamMarketSellItemResult,
    SteamMarketSellPlanItem, SteamMarketSellPlanResult, SteamMarketSellStrategy,
    SteamMarketSessionInput, SteamMarketSessionStatus,
};

type CmdResult<T> = Result<T, String>;

const SESSION_FILE: &str = "steam-market-session.json";
const LOGIN_WINDOW_LABEL: &str = "steam-login";
const STEAM_COMMUNITY: &str = "https://steamcommunity.com";
const USER_AGENT_VALUE: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const KNOWN_INVENTORY_CONTEXTS: &[(u32, &str, &str)] = &[
    (753, "6", "Steam 社区物品"),
    (730, "2", "Counter-Strike 2"),
    (570, "2", "Dota 2"),
    (440, "2", "Team Fortress 2"),
    (252490, "2", "Rust"),
    (578080, "2", "PUBG"),
    (271590, "2", "Grand Theft Auto V"),
    (1174180, "2", "Red Dead Redemption 2"),
    (1245620, "2", "Elden Ring"),
    (1091500, "2", "Cyberpunk 2077"),
    (359550, "2", "Rainbow Six Siege"),
    (236390, "2", "Warframe"),
    (218620, "2", "PAYDAY 2"),
    (304930, "2", "Unturned"),
    (381210, "2", "Dead by Daylight"),
    (105600, "2", "Terraria"),
    (346110, "2", "ARK: Survival Evolved"),
    (4000, "2", "Garry's Mod"),
    (8930, "2", "Sid Meier's Civilization V"),
    (431960, "2", "Wallpaper Engine"),
];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SteamMarketSessionStore {
    session_id: String,
    steam_login_secure: String,
    #[serde(default)]
    steam_country: Option<String>,
    #[serde(default)]
    steam_id: Option<String>,
    #[serde(default)]
    persona_name: Option<String>,
    saved_at: String,
}

#[derive(Debug, Clone)]
struct SteamMarketRuntime {
    session_id: String,
    steam_login_secure: String,
    steam_country: String,
    steam_id: String,
    persona_name: Option<String>,
    currency: u32,
    currency_label: String,
    country_code: String,
    client: reqwest::Client,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct InventoryContextKey {
    app_id: u32,
    context_id: String,
    app_label: String,
}

struct PriceCacheEntry {
    quote: SteamMarketPriceQuote,
    fetched_at: Instant,
}

static PRICE_CACHE: std::sync::OnceLock<std::sync::Mutex<HashMap<String, PriceCacheEntry>>> =
    std::sync::OnceLock::new();

fn price_cache() -> &'static std::sync::Mutex<HashMap<String, PriceCacheEntry>> {
    PRICE_CACHE.get_or_init(|| std::sync::Mutex::new(HashMap::new()))
}

#[tauri::command]
pub async fn start_steam_market_login(app: AppHandle) -> CmdResult<()> {
    if app.get_webview_window(LOGIN_WINDOW_LABEL).is_some() {
        if let Some(win) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
            let _ = win.set_focus();
        }
        return Ok(());
    }

    let login_url: Url = format!("{STEAM_COMMUNITY}/login/home/?goto=market")
        .parse::<Url>()
        .map_err(|err: url::ParseError| err.to_string())?;

    WebviewWindowBuilder::new(&app, LOGIN_WINDOW_LABEL, WebviewUrl::External(login_url))
        .title("Steam Login")
        .inner_size(920.0, 720.0)
        .resizable(true)
        .build()
        .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_steam_market_login(app: AppHandle) -> CmdResult<()> {
    if let Some(win) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        win.close().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn capture_steam_market_login(app: AppHandle) -> CmdResult<SteamMarketSessionStatus> {
    let win = app
        .get_webview_window(LOGIN_WINDOW_LABEL)
        .ok_or_else(|| "Steam 登录窗口未打开。".to_string())?;

    let cookies = tokio::task::spawn_blocking(move || {
        let target = Url::parse(STEAM_COMMUNITY).map_err(|err| err.to_string())?;
        win.cookies_for_url(target).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())??;

    let mut session_id = None;
    let mut steam_login_secure = None;
    let mut steam_country = None;

    for cookie in cookies {
        match cookie.name() {
            "sessionid" => session_id = Some(cookie.value().to_string()),
            "steamLoginSecure" => steam_login_secure = Some(cookie.value().to_string()),
            "steamCountry" => steam_country = Some(cookie.value().to_string()),
            _ => {}
        }
    }

    let session_id = session_id.ok_or_else(|| "未读取到 sessionid，请确认已在窗口内完成 Steam 登录。".to_string())?;
    let steam_login_secure = steam_login_secure
        .ok_or_else(|| "未读取到 steamLoginSecure，请确认已在窗口内完成 Steam 登录。".to_string())?;

    let status = save_session_internal(
        &app,
        SteamMarketSessionInput {
            session_id,
            steam_login_secure,
            steam_country,
        },
    )
    .await?;

    if let Some(win) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        let _ = win.close();
    }

    let _ = app.emit("steam-market-login-success", &status);
    Ok(status)
}

#[tauri::command]
pub async fn save_steam_market_session(
    app: AppHandle,
    session: SteamMarketSessionInput,
) -> CmdResult<SteamMarketSessionStatus> {
    save_session_internal(&app, session).await
}

#[tauri::command]
pub async fn get_steam_market_session_status(app: AppHandle) -> CmdResult<SteamMarketSessionStatus> {
    let login_window_open = app.get_webview_window(LOGIN_WINDOW_LABEL).is_some();
    let store = load_session_store(&app)?;
    let Some(store) = store else {
        return Ok(SteamMarketSessionStatus {
            logged_in: false,
            steam_id: None,
            persona_name: None,
            currency_label: None,
            saved_at: None,
            login_window_open,
            message: Some("尚未登录 Steam。".to_string()),
        });
    };

    match build_runtime(&app, &store).await {
        Ok(runtime) => Ok(SteamMarketSessionStatus {
            logged_in: true,
            steam_id: Some(runtime.steam_id),
            persona_name: runtime.persona_name,
            currency_label: Some(runtime.currency_label),
            saved_at: Some(store.saved_at),
            login_window_open,
            message: None,
        }),
        Err(message) => Ok(SteamMarketSessionStatus {
            logged_in: false,
            steam_id: store.steam_id,
            persona_name: store.persona_name,
            currency_label: currency_label_from_country(store.steam_country.as_deref()),
            saved_at: Some(store.saved_at),
            login_window_open,
            message: Some(message),
        }),
    }
}

#[tauri::command]
pub async fn clear_steam_market_session(app: AppHandle) -> CmdResult<()> {
    if let Some(path) = session_store_path(&app) {
        if path.exists() {
            fs::remove_file(path).map_err(|err| err.to_string())?;
        }
    }
    if let Ok(mut cache) = price_cache().lock() {
        cache.clear();
    }
    Ok(())
}

#[tauri::command]
pub async fn scan_steam_marketable_inventory(
    app: AppHandle,
) -> CmdResult<SteamMarketInventoryScanResult> {
    let runtime = load_runtime(&app).await?;
    let (resolved_steam_id, discovered_contexts, page_warning) =
        resolve_inventory_contexts(&runtime).await?;
    let runtime = if resolved_steam_id == runtime.steam_id {
        runtime
    } else {
        SteamMarketRuntime {
            steam_id: resolved_steam_id.clone(),
            ..runtime
        }
    };

    let contexts = merge_inventory_contexts(discovered_contexts);
    let mut groups: Vec<SteamMarketInventoryGroup> = Vec::new();
    let mut warnings = Vec::new();
    if let Some(message) = page_warning {
        warnings.push(message);
    }
    let mut total_marketable = 0usize;
    let mut scanned_contexts = 0usize;

    for context in contexts {
        scanned_contexts += 1;
        match fetch_inventory_group(&runtime, context.app_id, &context.context_id, &context.app_label).await {
            Ok(Some(group)) => {
                total_marketable += group.items.len();
                groups.push(group);
            }
            Ok(None) => {}
            Err(err) => warnings.push(format!(
                "{} ({}): {}",
                context.app_label, context.app_id, err
            )),
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    if total_marketable == 0 {
        warnings.push(format!(
            "已扫描 {scanned_contexts} 个库存分区，未发现可上架物品。请确认 Steam 库存未设为私密，且物品本身支持在市场上架。"
        ));
    }

    groups.sort_by_key(|group| group.app_id);
    Ok(SteamMarketInventoryScanResult {
        steam_id: runtime.steam_id.clone(),
        groups,
        total_marketable,
        warnings,
    })
}

#[tauri::command]
pub async fn refresh_steam_market_prices(
    app: AppHandle,
    item_ids: Vec<String>,
) -> CmdResult<Vec<SteamMarketPriceQuote>> {
    let runtime = load_runtime(&app).await?;
    let scan = scan_steam_marketable_inventory(app.clone()).await?;
    let items = flatten_items(&scan.groups);
    let selected: Vec<SteamMarketItem> = items
        .into_iter()
        .filter(|item| item_ids.contains(&item.id))
        .collect();

    let mut quotes = Vec::new();
    for item in selected {
        let quote = fetch_price_quote(&runtime, &item, false).await?;
        quotes.push(quote);
        tokio::time::sleep(Duration::from_millis(450)).await;
    }
    Ok(quotes)
}

#[tauri::command]
pub async fn preview_steam_market_sell_plan(
    app: AppHandle,
    item_ids: Vec<String>,
    strategy: SteamMarketSellStrategy,
) -> CmdResult<SteamMarketSellPlanResult> {
    let runtime = load_runtime(&app).await?;
    let scan = scan_steam_marketable_inventory(app).await?;
    let items = flatten_items(&scan.groups);
    let selected: Vec<SteamMarketItem> = items
        .into_iter()
        .filter(|item| item_ids.contains(&item.id))
        .collect();

    let mut plan_items = Vec::new();
    let mut warnings = Vec::new();
    let mut total_seller_receives_cents = 0u64;

    for item in selected {
        let quote = fetch_price_quote(&runtime, &item, true).await?;
        let plan = build_plan_item(&item, &quote, &strategy);
        if plan.skipped {
            if let Some(reason) = plan.skip_reason.clone() {
                warnings.push(format!("{}: {reason}", item.name));
            }
        } else {
            total_seller_receives_cents += plan.seller_receives_cents;
        }
        plan_items.push(plan);
        tokio::time::sleep(Duration::from_millis(350)).await;
    }

    Ok(SteamMarketSellPlanResult {
        items: plan_items,
        total_seller_receives_cents,
        warnings,
    })
}

#[tauri::command]
pub async fn sell_steam_market_items(
    app: AppHandle,
    request: SteamMarketSellBatchRequest,
) -> CmdResult<SteamMarketSellBatchResult> {
    let runtime = load_runtime(&app).await?;
    if request.items.len() > 20 {
        return Err("单次最多上架 20 件物品。".to_string());
    }

    let mut results = Vec::new();
    let mut success_count = 0usize;
    let mut failure_count = 0usize;
    let mut confirmation_count = 0usize;

    for item in request.items {
        let result = sell_single_item(&runtime, &item).await?;
        if result.success {
            success_count += 1;
        } else {
            failure_count += 1;
        }
        if result.requires_confirmation {
            confirmation_count += 1;
        }
        results.push(result);
        tokio::time::sleep(Duration::from_millis(900)).await;
    }

    Ok(SteamMarketSellBatchResult {
        results,
        success_count,
        failure_count,
        confirmation_count,
    })
}

#[tauri::command]
pub async fn get_steam_market_listings(app: AppHandle) -> CmdResult<SteamMarketListingsResult> {
    let runtime = load_runtime(&app).await?;
    let url = format!(
        "{STEAM_COMMUNITY}/market/mylistings/render/?query=&start=0&count=100"
    );
    let value: Value = runtime
        .client
        .get(&url)
        .headers(default_headers(&runtime))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;

    if value.get("success").and_then(Value::as_bool) != Some(true) {
        return Err("读取 Steam 出售列表失败。".to_string());
    }

    let mut items = Vec::new();
    if let Some(listings) = value
        .pointer("/assets")
        .and_then(Value::as_object)
    {
        for (listing_id, listing) in listings {
            let name = listing
                .pointer("/market_hash_name")
                .or_else(|| listing.pointer("/name"))
                .and_then(Value::as_str)
                .unwrap_or("Unknown")
                .to_string();
            let price_cents = listing
                .pointer("/price")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            items.push(SteamMarketListingItem {
                listing_id: listing_id.clone(),
                name,
                price_cents,
                status: "active".to_string(),
            });
        }
    }

    let total = value
        .get("total_count")
        .and_then(Value::as_u64)
        .unwrap_or(items.len() as u64) as usize;

    Ok(SteamMarketListingsResult { items, total })
}

async fn save_session_internal(
    app: &AppHandle,
    session: SteamMarketSessionInput,
) -> CmdResult<SteamMarketSessionStatus> {
    if session.session_id.trim().is_empty() || session.steam_login_secure.trim().is_empty() {
        return Err("sessionid 与 steamLoginSecure 不能为空。".to_string());
    }

    let steam_id = parse_steam_id_from_login_secure(&session.steam_login_secure);
    let store = SteamMarketSessionStore {
        session_id: session.session_id.trim().to_string(),
        steam_login_secure: session.steam_login_secure.trim().to_string(),
        steam_country: session.steam_country.map(|value| value.trim().to_string()),
        steam_id: steam_id.clone(),
        persona_name: None,
        saved_at: Utc::now().to_rfc3339(),
    };
    save_session_store(app, &store)?;

    match build_runtime(app, &store).await {
        Ok(runtime) => {
            let mut persisted = store;
            persisted.persona_name = runtime.persona_name.clone();
            persisted.steam_id = Some(runtime.steam_id.clone());
            save_session_store(app, &persisted)?;
            Ok(SteamMarketSessionStatus {
                logged_in: true,
                steam_id: Some(runtime.steam_id),
                persona_name: runtime.persona_name,
                currency_label: Some(runtime.currency_label),
                saved_at: Some(persisted.saved_at),
                login_window_open: app.get_webview_window(LOGIN_WINDOW_LABEL).is_some(),
                message: None,
            })
        }
        Err(message) => Err(message),
    }
}

async fn load_runtime(app: &AppHandle) -> CmdResult<SteamMarketRuntime> {
    let store = load_session_store(app)?.ok_or_else(|| "请先登录 Steam。".to_string())?;
    build_runtime(app, &store).await
}

async fn build_runtime(_app: &AppHandle, store: &SteamMarketSessionStore) -> CmdResult<SteamMarketRuntime> {
    let steam_country = store.steam_country.clone().unwrap_or_else(|| "CN|".to_string());
    let (country_code, currency) = parse_steam_country(&steam_country);
    let currency_label = currency_label_from_code(currency).to_string();

    let client = build_http_client(
        &store.session_id,
        &store.steam_login_secure,
        &steam_country,
    )?;

    let mut steam_id = store
        .steam_id
        .clone()
        .filter(|value| is_valid_steam_id64(value))
        .or_else(|| parse_steam_id_from_login_secure(&store.steam_login_secure));

    let profile_url = if let Some(id) = steam_id.as_ref() {
        format!("{STEAM_COMMUNITY}/profiles/{id}/?xml=1")
    } else {
        format!("{STEAM_COMMUNITY}/my/?xml=1")
    };

    let profile_text = client
        .get(&profile_url)
        .headers(authenticated_headers(
            &store.session_id,
            &store.steam_login_secure,
            &steam_country,
            &format!(
                "{}/profiles/{}/",
                STEAM_COMMUNITY,
                steam_id.as_deref().unwrap_or("me")
            ),
        ))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .text()
        .await
        .map_err(|err| err.to_string())?;

    if profile_text.contains("Access Denied") || profile_text.to_lowercase().contains("login") {
        return Err("Steam 登录态已失效，请重新登录。".to_string());
    }

    if let Some(id) = extract_xml_tag(&profile_text, "steamID64") {
        if is_valid_steam_id64(&id) {
            steam_id = Some(id);
        }
    }

    let inventory_html = fetch_inventory_page_html(
        &client,
        &store.session_id,
        &store.steam_login_secure,
        &steam_country,
    )
    .await?;
    if let Some(id) = parse_steam_id_from_html(&inventory_html) {
        steam_id = Some(id);
    }

    let steam_id = steam_id.ok_or_else(|| "无法解析 SteamID，请重新登录 Steam。".to_string())?;
    let persona_name = extract_xml_tag(&profile_text, "steamID")
        .or_else(|| parse_persona_name_from_html(&inventory_html));

    Ok(SteamMarketRuntime {
        session_id: store.session_id.clone(),
        steam_login_secure: store.steam_login_secure.clone(),
        steam_country,
        steam_id,
        persona_name,
        currency,
        currency_label,
        country_code,
        client,
    })
}

fn build_http_client(
    session_id: &str,
    steam_login_secure: &str,
    steam_country: &str,
) -> CmdResult<reqwest::Client> {
    reqwest::Client::builder()
        .default_headers(authenticated_headers(
            session_id,
            steam_login_secure,
            steam_country,
            &format!("{STEAM_COMMUNITY}/market/"),
        ))
        .build()
        .map_err(|err: reqwest::Error| err.to_string())
}

fn cookie_header_value(session_id: &str, steam_login_secure: &str, steam_country: &str) -> CmdResult<String> {
    Ok(format!(
        "sessionid={session_id}; steamLoginSecure={steam_login_secure}; steamCountry={steam_country}"
    ))
}

fn authenticated_headers(
    session_id: &str,
    steam_login_secure: &str,
    steam_country: &str,
    referer: &str,
) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    headers.insert(ACCEPT, HeaderValue::from_static("*/*"));
    if let Ok(cookie) = cookie_header_value(session_id, steam_login_secure, steam_country) {
        if let Ok(value) = HeaderValue::from_str(&cookie) {
            headers.insert(reqwest::header::COOKIE, value);
        }
    }
    if let Ok(value) = HeaderValue::from_str(referer) {
        headers.insert(REFERER, value);
    }
    headers
}

fn runtime_headers(runtime: &SteamMarketRuntime, referer: &str) -> HeaderMap {
    authenticated_headers(
        &runtime.session_id,
        &runtime.steam_login_secure,
        &runtime.steam_country,
        referer,
    )
}

async fn fetch_inventory_page_html(
    client: &reqwest::Client,
    session_id: &str,
    steam_login_secure: &str,
    steam_country: &str,
) -> CmdResult<String> {
    client
        .get(format!("{STEAM_COMMUNITY}/my/inventory/"))
        .headers(authenticated_headers(
            session_id,
            steam_login_secure,
            steam_country,
            &format!("{STEAM_COMMUNITY}/my/inventory/"),
        ))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .text()
        .await
        .map_err(|err| err.to_string())
}

async fn resolve_inventory_contexts(
    runtime: &SteamMarketRuntime,
) -> CmdResult<(String, Vec<InventoryContextKey>, Option<String>)> {
    let html = fetch_inventory_page_html(
        &runtime.client,
        &runtime.session_id,
        &runtime.steam_login_secure,
        &runtime.steam_country,
    )
    .await?;

    let steam_id = parse_steam_id_from_html(&html)
        .filter(|value| is_valid_steam_id64(value))
        .unwrap_or_else(|| runtime.steam_id.clone());

    let contexts = parse_app_context_data(&html);
    let page_warning = if contexts.is_empty() {
        Some("未能从 Steam 库存页解析游戏分区，将改用内置常见游戏列表扫描。".to_string())
    } else {
        None
    };

    Ok((steam_id, contexts, page_warning))
}

fn merge_inventory_contexts(discovered: Vec<InventoryContextKey>) -> Vec<InventoryContextKey> {
    let mut merged: HashMap<(u32, String), InventoryContextKey> = HashMap::new();
    for context in discovered {
        merged.insert((context.app_id, context.context_id.clone()), context);
    }
    for (app_id, context_id, app_label) in KNOWN_INVENTORY_CONTEXTS {
        merged.entry((*app_id, context_id.to_string())).or_insert_with(|| InventoryContextKey {
            app_id: *app_id,
            context_id: context_id.to_string(),
            app_label: app_label.to_string(),
        });
    }
    let mut contexts: Vec<InventoryContextKey> = merged.into_values().collect();
    contexts.sort_by_key(|context| context.app_id);
    contexts
}

fn default_headers(runtime: &SteamMarketRuntime) -> HeaderMap {
    runtime_headers(
        runtime,
        &format!("{STEAM_COMMUNITY}/profiles/{}/inventory/", runtime.steam_id),
    )
}

async fn fetch_inventory_group(
    runtime: &SteamMarketRuntime,
    app_id: u32,
    context_id: &str,
    app_label: &str,
) -> CmdResult<Option<SteamMarketInventoryGroup>> {
    let mut start_assetid: Option<String> = None;
    let mut all_items: Vec<SteamMarketItem> = Vec::new();

    loop {
        let mut url = format!(
            "{STEAM_COMMUNITY}/inventory/{}/{}/{}?l=schinese&count=5000",
            runtime.steam_id, app_id, context_id
        );
        if let Some(last) = start_assetid.as_ref() {
            url.push_str(&format!("&start_assetid={last}"));
        }

        let response = runtime
            .client
            .get(&url)
            .headers(default_headers(runtime))
            .send()
            .await
            .map_err(|err| err.to_string())?;

        if response.status().as_u16() == 403 || response.status().as_u16() == 401 {
            return Err("Steam 登录态已失效。".to_string());
        }
        if response.status().as_u16() == 404 || response.status().as_u16() == 400 {
            return Ok(None);
        }

        let payload: Value = response.json().await.map_err(|err| err.to_string())?;
        if payload.get("success").and_then(Value::as_i64) != Some(1) {
            let error = payload
                .get("Error")
                .or_else(|| payload.get("error"))
                .and_then(Value::as_str)
                .unwrap_or("Steam 返回失败");
            return Err(format!("{app_label}: {error}"));
        }

        let descriptions = build_description_map(&payload);
        if let Some(assets) = payload.get("assets").and_then(Value::as_array) {
            for asset in assets {
                let Some(item) = map_inventory_item(asset, &descriptions, app_id, context_id) else {
                    continue;
                };
                if item.marketable {
                    all_items.push(item);
                }
            }
        }

        let more_items = payload.get("more_items").and_then(Value::as_i64).unwrap_or(0) == 1;
        start_assetid = payload
            .get("last_assetid")
            .and_then(Value::as_str)
            .map(str::to_string);
        if !more_items {
            break;
        }
        if start_assetid.is_none() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }

    if all_items.is_empty() {
        return Ok(None);
    }

    Ok(Some(SteamMarketInventoryGroup {
        app_id,
        context_id: context_id.to_string(),
        app_label: app_label.to_string(),
        items: all_items,
    }))
}

fn build_description_map(payload: &Value) -> HashMap<String, Value> {
    let mut map = HashMap::new();
    if let Some(descriptions) = payload.get("descriptions").and_then(Value::as_array) {
        for description in descriptions {
            let classid = description.get("classid").and_then(Value::as_str).unwrap_or("");
            let instanceid = description
                .get("instanceid")
                .and_then(Value::as_str)
                .unwrap_or("0");
            map.insert(format!("{classid}_{instanceid}"), description.clone());
        }
    }
    map
}

fn map_inventory_item(
    asset: &Value,
    descriptions: &HashMap<String, Value>,
    app_id: u32,
    context_id: &str,
) -> Option<SteamMarketItem> {
    let class_id = asset.get("classid").and_then(Value::as_str)?.to_string();
    let instance_id = asset
        .get("instanceid")
        .and_then(Value::as_str)
        .unwrap_or("0")
        .to_string();
    let asset_id = asset.get("assetid").and_then(Value::as_str)?.to_string();
    let amount = asset.get("amount").and_then(Value::as_str).and_then(|v| v.parse().ok()).unwrap_or(1);
    let description = descriptions
        .get(&format!("{class_id}_{instance_id}"))
        .cloned()
        .unwrap_or_else(|| asset.clone());

    let marketable = is_marketable_value(asset.get("marketable"))
        || is_marketable_value(description.get("marketable"));
    let tradable = is_marketable_value(asset.get("tradable"))
        || is_marketable_value(description.get("tradable"));
    let name = description
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Unknown")
        .to_string();
    let market_hash_name = description
        .get("market_hash_name")
        .and_then(Value::as_str)
        .unwrap_or(&name)
        .to_string();
    let icon_url = description
        .get("icon_url")
        .and_then(Value::as_str)
        .map(|icon| format!("https://community.cloudflare.steamstatic.com/economy/image/{icon}"));

    Some(SteamMarketItem {
        id: format!("{app_id}:{context_id}:{asset_id}"),
        asset_id,
        class_id,
        instance_id,
        app_id,
        context_id: context_id.to_string(),
        name,
        market_hash_name,
        icon_url,
        amount,
        marketable,
        tradable,
    })
}

async fn fetch_price_quote(
    runtime: &SteamMarketRuntime,
    item: &SteamMarketItem,
    allow_cache: bool,
) -> CmdResult<SteamMarketPriceQuote> {
    if allow_cache {
        if let Ok(cache) = price_cache().lock() {
            if let Some(entry) = cache.get(&item.id) {
                if entry.fetched_at.elapsed() < Duration::from_secs(120) {
                    return Ok(entry.quote.clone());
                }
            }
        }
    }

    let encoded_name = urlencoding::encode(&item.market_hash_name);
    let overview_url = format!(
        "{STEAM_COMMUNITY}/market/priceoverview/?country={}&currency={}&appid={}&market_hash_name={encoded_name}",
        runtime.country_code, runtime.currency, item.app_id
    );

    let overview: Value = runtime
        .client
        .get(&overview_url)
        .headers(default_headers(runtime))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;

    if overview.get("success").and_then(Value::as_bool) != Some(true) {
        return Ok(SteamMarketPriceQuote {
            item_id: item.id.clone(),
            market_hash_name: item.market_hash_name.clone(),
            lowest_sell_cents: None,
            highest_buy_cents: None,
            median_sell_cents: None,
            currency_label: runtime.currency_label.clone(),
            volume: None,
            stale: false,
            error: Some("无法获取市场价格。".to_string()),
        });
    }

    let lowest_sell_cents = overview
        .get("lowest_price")
        .and_then(Value::as_str)
        .and_then(parse_money_to_cents);
    let median_sell_cents = overview
        .get("median_price")
        .and_then(Value::as_str)
        .and_then(parse_money_to_cents);
    let volume = overview
        .get("volume")
        .and_then(Value::as_str)
        .and_then(|value| value.replace(',', "").parse().ok());

    let highest_buy_cents = fetch_highest_buy_order(runtime, item).await.ok().flatten();

    let quote = SteamMarketPriceQuote {
        item_id: item.id.clone(),
        market_hash_name: item.market_hash_name.clone(),
        lowest_sell_cents,
        highest_buy_cents,
        median_sell_cents,
        currency_label: runtime.currency_label.clone(),
        volume,
        stale: false,
        error: None,
    };

    if let Ok(mut cache) = price_cache().lock() {
        cache.insert(
            item.id.clone(),
            PriceCacheEntry {
                quote: quote.clone(),
                fetched_at: Instant::now(),
            },
        );
    }

    Ok(quote)
}

async fn fetch_highest_buy_order(
    runtime: &SteamMarketRuntime,
    item: &SteamMarketItem,
) -> CmdResult<Option<u64>> {
    let listing_url = format!(
        "{STEAM_COMMUNITY}/market/listings/{}/{}",
        item.app_id,
        urlencoding::encode(&item.market_hash_name)
    );
    let html = runtime
        .client
        .get(&listing_url)
        .headers(default_headers(runtime))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .text()
        .await
        .map_err(|err| err.to_string())?;

    let item_name_id = parse_item_name_id(&html).ok_or_else(|| "无法解析 item_nameid。".to_string())?;
    let histogram_url = format!(
        "{STEAM_COMMUNITY}/market/itemordershistogram?country={}&language=schinese&currency={}&item_nameid={item_name_id}&two_factor=0",
        runtime.country_code, runtime.currency
    );
    let histogram: Value = runtime
        .client
        .get(&histogram_url)
        .headers(default_headers(runtime))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .json()
        .await
        .map_err(|err| err.to_string())?;

    if histogram.get("success").and_then(Value::as_i64) != Some(1) {
        return Ok(None);
    }

    Ok(histogram
        .get("highest_buy_order")
        .and_then(Value::as_str)
        .and_then(|value| value.parse().ok()))
}

fn build_plan_item(
    item: &SteamMarketItem,
    quote: &SteamMarketPriceQuote,
    strategy: &SteamMarketSellStrategy,
) -> SteamMarketSellPlanItem {
    let reference_mode = strategy.mode.clone();
    let reference_cents = match strategy.mode.as_str() {
        "highestBuy" => quote.highest_buy_cents,
        "manual" => strategy.discount_cents,
        _ => quote.lowest_sell_cents.or(quote.median_sell_cents),
    };

    let mut seller_receives_cents = match strategy.mode.as_str() {
        "highestBuy" => quote.highest_buy_cents,
        "fixedDiscount" => reference_cents.map(|value| value.saturating_sub(strategy.discount_cents.unwrap_or(0))),
        "percentDiscount" => {
            let percent = strategy.discount_percent.unwrap_or(0.0).clamp(0.0, 95.0);
            reference_cents.map(|value| {
                let discounted = (value as f64) * (1.0 - percent / 100.0);
                discounted.round().max(1.0) as u64
            })
        }
        "manual" => strategy.discount_cents,
        _ => quote.lowest_sell_cents.or(quote.median_sell_cents),
    }
    .unwrap_or(0);

    if seller_receives_cents == 0 {
        return SteamMarketSellPlanItem {
            item: item.clone(),
            reference_mode,
            reference_cents,
            seller_receives_cents: 0,
            buyer_pays_cents: None,
            skipped: true,
            skip_reason: quote
                .error
                .clone()
                .or_else(|| Some("缺少可用参考价格。".to_string())),
        };
    }

    seller_receives_cents = seller_receives_cents.max(1);
    let buyer_pays_cents = Some(estimate_buyer_pays(seller_receives_cents));

    SteamMarketSellPlanItem {
        item: item.clone(),
        reference_mode,
        reference_cents,
        seller_receives_cents,
        buyer_pays_cents,
        skipped: false,
        skip_reason: None,
    }
}

async fn sell_single_item(
    runtime: &SteamMarketRuntime,
    item: &SteamMarketSellItemRequest,
) -> CmdResult<SteamMarketSellItemResult> {
    let referer = format!(
        "{STEAM_COMMUNITY}/profiles/{}/inventory/",
        runtime.steam_id
    );
    let form = [
        ("sessionid", runtime.session_id.as_str()),
        ("appid", &item.app_id.to_string()),
        ("contextid", item.context_id.as_str()),
        ("assetid", item.asset_id.as_str()),
        ("amount", &item.amount.to_string()),
        ("price", &item.seller_receives_cents.to_string()),
    ];

    let mut headers = runtime_headers(
        runtime,
        &format!("{STEAM_COMMUNITY}/profiles/{}/inventory/", runtime.steam_id),
    );
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/x-www-form-urlencoded"),
    );
    headers.insert(
        REFERER,
        HeaderValue::from_str(&referer).map_err(|err| err.to_string())?,
    );

    let response = runtime
        .client
        .post(format!("{STEAM_COMMUNITY}/market/sellitem/"))
        .headers(headers)
        .form(&form)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    let payload: Value = response.json().await.map_err(|err| err.to_string())?;
    let success = payload.get("success").and_then(Value::as_bool).unwrap_or(false);
    let message = payload
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or(if success { "上架成功" } else { "上架失败" })
        .to_string();
    let requires_confirmation = payload
        .get("requires_confirmation")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || message.to_lowercase().contains("confirmation");
    let listing_id = payload
        .get("listingid")
        .and_then(Value::as_str)
        .map(str::to_string);

    Ok(SteamMarketSellItemResult {
        asset_id: item.asset_id.clone(),
        success,
        message,
        requires_confirmation,
        listing_id,
    })
}

fn flatten_items(groups: &[SteamMarketInventoryGroup]) -> Vec<SteamMarketItem> {
    groups
        .iter()
        .flat_map(|group| group.items.iter().cloned())
        .collect()
}

fn parse_steam_id_from_login_secure(value: &str) -> Option<String> {
    let decoded = urlencoding::decode(value).ok()?.into_owned();
    if let Some((steam_id, _)) = decoded.split_once("||") {
        let steam_id = steam_id.trim();
        if is_valid_steam_id64(steam_id) {
            return Some(steam_id.to_string());
        }
    }
    None
}

fn is_valid_steam_id64(value: &str) -> bool {
    value.len() >= 17
        && value.starts_with("7656119")
        && value.chars().all(|ch| ch.is_ascii_digit())
}

fn parse_steam_id_from_html(html: &str) -> Option<String> {
    for marker in ["g_steamID", "g_AccountID"] {
        if let Some(id) = parse_js_string_assignment(html, marker) {
            if marker == "g_AccountID" {
                continue;
            }
            if is_valid_steam_id64(&id) {
                return Some(id);
            }
        }
    }

    for pattern in ["data-steamid=\"", "data-userid=\"", "\"steamid\":\""] {
        if let Some(start) = html.find(pattern) {
            let rest = &html[start + pattern.len()..];
            let id: String = rest.chars().take_while(|ch| ch.is_ascii_digit()).collect();
            if is_valid_steam_id64(&id) {
                return Some(id);
            }
        }
    }

    None
}

fn parse_persona_name_from_html(html: &str) -> Option<String> {
    parse_js_string_assignment(html, "g_strPersonaName")
}

fn parse_js_string_assignment(html: &str, key: &str) -> Option<String> {
    let marker = format!("{key} = \"");
    let start = html.find(&marker)? + marker.len();
    let rest = &html[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn parse_app_context_data(html: &str) -> Vec<InventoryContextKey> {
    let Some(raw_json) = extract_js_object_assignment(html, "g_rgAppContextData") else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw_json) else {
        return Vec::new();
    };
    let Some(root) = value.as_object() else {
        return Vec::new();
    };

    let mut contexts = Vec::new();
    for (app_id_text, context_map) in root {
        let Ok(app_id) = app_id_text.parse::<u32>() else {
            continue;
        };
        let Some(contexts_obj) = context_map.as_object() else {
            continue;
        };
        for (context_id, meta) in contexts_obj {
            let app_label = meta
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Steam Inventory")
                .to_string();
            contexts.push(InventoryContextKey {
                app_id,
                context_id: context_id.clone(),
                app_label,
            });
        }
    }
    contexts
}

fn extract_js_object_assignment(html: &str, key: &str) -> Option<String> {
    let marker = format!("{key} = ");
    let start = html.find(&marker)? + marker.len();
    let slice = html[start..].trim_start();
    if !slice.starts_with('{') {
        return None;
    }
    let mut depth = 0usize;
    for (index, ch) in slice.char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(slice[..=index].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

fn is_marketable_value(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Number(number)) => number.as_i64().unwrap_or(0) == 1,
        Some(Value::String(text)) => text == "1",
        Some(Value::Bool(flag)) => *flag,
        _ => false,
    }
}

fn parse_steam_country(value: &str) -> (String, u32) {
    let country = value.split('|').next().unwrap_or("CN").to_string();
    let currency = match country.as_str() {
        "US" => 1,
        "GB" => 2,
        "EU" | "DE" | "FR" => 3,
        "RU" => 5,
        "BR" => 7,
        "JP" => 8,
        "CN" => 23,
        "HK" => 29,
        "TW" => 30,
        _ => 1,
    };
    (country, currency)
}

fn currency_label_from_country(value: Option<&str>) -> Option<String> {
    value.map(|raw| {
        let (country, currency) = parse_steam_country(raw);
        let _ = country;
        currency_label_from_code(currency).to_string()
    })
}

fn currency_label_from_code(currency: u32) -> &'static str {
    match currency {
        23 => "CNY",
        1 => "USD",
        3 => "EUR",
        29 => "HKD",
        30 => "TWD",
        _ => "USD",
    }
}

fn parse_money_to_cents(raw: &str) -> Option<u64> {
    let cleaned: String = raw
        .chars()
        .filter(|ch| ch.is_ascii_digit() || *ch == '.' || *ch == ',')
        .collect();
    let normalized = if cleaned.contains('.') {
        cleaned.replace(',', "")
    } else if cleaned.matches(',').count() == 1 {
        cleaned.replace(',', ".")
    } else {
        cleaned.replace(',', "")
    };
    let value: f64 = normalized.parse().ok()?;
    Some((value * 100.0).round() as u64)
}

fn estimate_buyer_pays(seller_receives_cents: u64) -> u64 {
    ((seller_receives_cents as f64) / 0.85).ceil() as u64
}

fn parse_item_name_id(html: &str) -> Option<u64> {
    let marker = "Market_LoadOrderSpread( ";
    let start = html.find(marker)? + marker.len();
    html[start..]
        .split(',')
        .next()?
        .trim()
        .parse()
        .ok()
}

fn extract_xml_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}><![CDATA[");
    let close = "]]></";
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(close)? + start;
    Some(xml[start..end].to_string())
}

fn session_store_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(SESSION_FILE))
}

fn load_session_store(app: &AppHandle) -> CmdResult<Option<SteamMarketSessionStore>> {
    let Some(path) = session_store_path(app) else {
        return Ok(None);
    };
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string()).map(Some)
}

fn save_session_store(app: &AppHandle, store: &SteamMarketSessionStore) -> CmdResult<()> {
    let Some(path) = session_store_path(app) else {
        return Err("无法定位应用数据目录。".to_string());
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(store).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_steam_id_from_cookie() {
        let value = "76561198123456789%7C%7Ctoken";
        assert_eq!(
            parse_steam_id_from_login_secure(value),
            Some("76561198123456789".to_string())
        );
    }

    #[test]
    fn rejects_jwt_only_cookie_as_steam_id() {
        let value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature";
        assert_eq!(parse_steam_id_from_login_secure(value), None);
    }

    #[test]
    fn parses_inventory_context_data() {
        let html = r#"var g_rgAppContextData = {"753":{"6":{"name":"Steam Community"}},"730":{"2":{"name":"Counter-Strike 2"}}};"#;
        let contexts = parse_app_context_data(html);
        assert_eq!(contexts.len(), 2);
        assert!(contexts.iter().any(|context| context.app_id == 753 && context.context_id == "6"));
        assert!(contexts.iter().any(|context| context.app_id == 730 && context.context_id == "2"));
    }

    #[test]
    fn parses_steam_id_from_inventory_html() {
        let html = r#"var g_steamID = "76561198123456789";"#;
        assert_eq!(
            parse_steam_id_from_html(html),
            Some("76561198123456789".to_string())
        );
    }

    #[test]
    fn parses_cny_price() {
        assert_eq!(parse_money_to_cents("¥ 1.23"), Some(123));
    }

    #[test]
    fn builds_fixed_discount_plan() {
        let item = SteamMarketItem {
            id: "1".to_string(),
            asset_id: "1".to_string(),
            class_id: "1".to_string(),
            instance_id: "0".to_string(),
            app_id: 753,
            context_id: "6".to_string(),
            name: "Card".to_string(),
            market_hash_name: "Card".to_string(),
            icon_url: None,
            amount: 1,
            marketable: true,
            tradable: true,
        };
        let quote = SteamMarketPriceQuote {
            item_id: "1".to_string(),
            market_hash_name: "Card".to_string(),
            lowest_sell_cents: Some(100),
            highest_buy_cents: Some(80),
            median_sell_cents: Some(95),
            currency_label: "CNY".to_string(),
            volume: None,
            stale: false,
            error: None,
        };
        let plan = build_plan_item(
            &item,
            &quote,
            &SteamMarketSellStrategy {
                mode: "fixedDiscount".to_string(),
                discount_cents: Some(10),
                discount_percent: None,
            },
        );
        assert_eq!(plan.seller_receives_cents, 90);
    }
}
