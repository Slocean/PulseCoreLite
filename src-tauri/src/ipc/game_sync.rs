use chrono::Utc;
use crc32fast::Hasher;
use image::{ImageBuffer, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

use crate::types::{
    EpicInstalledGame, EpicSteamGameSyncStatus, EpicSteamScanResult, SteamShortcutAccount,
    SyncEpicGamesRequest, SyncEpicGamesResult,
};

type CmdResult<T> = Result<T, String>;

const MANAGED_STORE_FILE: &str = "epic-steam-sync.json";
const MANAGED_ROOT_DIR: &str = "epic-steam-sync";
const SHORTCUT_TAG_PULSE: &str = "PulseCoreLite";
const SHORTCUT_TAG_EPIC: &str = "Epic Games";

#[derive(Debug, Clone, Deserialize)]
struct EpicItemManifest {
    #[serde(rename = "DisplayName")]
    display_name: Option<String>,
    #[serde(rename = "InstallLocation")]
    install_location: Option<String>,
    #[serde(rename = "LaunchExecutable")]
    launch_executable: Option<String>,
    #[serde(rename = "LaunchCommand")]
    launch_command: Option<String>,
    #[serde(rename = "AppName")]
    app_name: Option<String>,
    #[serde(rename = "MainGameAppName")]
    main_game_app_name: Option<String>,
    #[serde(rename = "CatalogItemId")]
    catalog_item_id: Option<String>,
}

#[derive(Debug, Clone)]
struct SteamPaths {
    root: PathBuf,
    users_root: PathBuf,
}

#[derive(Debug, Clone)]
struct SteamAccountContext {
    shortcuts_path: PathBuf,
    grid_dir: PathBuf,
}

#[derive(Debug, Clone, Default)]
struct ShortcutEntry {
    app_name: String,
    exe: String,
    start_dir: String,
    icon: String,
    shortcut_path: String,
    launch_options: String,
    is_hidden: u32,
    allow_desktop_config: u32,
    allow_overlay: u32,
    open_vr: u32,
    devkit: u32,
    devkit_game_id: String,
    devkit_override_app_id: u32,
    last_play_time: u32,
    flatpak_app_id: String,
    app_id: u32,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ManagedSyncStore {
    #[serde(default)]
    users: Vec<ManagedSyncUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ManagedSyncUser {
    steam_user_id: String,
    #[serde(default)]
    entries: Vec<ManagedSyncEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ManagedSyncEntry {
    game_id: String,
    title: String,
    launcher_path: String,
    app_id: u32,
    steam_grid_id: String,
    updated_at: String,
}

#[derive(Debug, Clone)]
struct ManagedPaths {
    launcher_dir: PathBuf,
}

#[derive(Debug, Clone)]
struct ShortcutIdentity {
    launcher_path: PathBuf,
    exe_value: String,
    shortcut_path: String,
    app_id: u32,
    steam_grid_id: String,
}

#[tauri::command]
pub async fn scan_epic_games_for_sync(
    app: AppHandle,
    steam_user_id: Option<String>,
) -> CmdResult<EpicSteamScanResult> {
    #[cfg(windows)]
    {
        return scan_epic_games_for_sync_windows(&app, steam_user_id);
    }

    #[cfg(not(windows))]
    {
        let _ = (app, steam_user_id);
        Err("Epic to Steam sync is only supported on Windows.".to_string())
    }
}

#[tauri::command]
pub async fn sync_epic_games_to_steam(
    app: AppHandle,
    request: SyncEpicGamesRequest,
) -> CmdResult<SyncEpicGamesResult> {
    #[cfg(windows)]
    {
        return sync_epic_games_to_steam_windows(&app, request);
    }

    #[cfg(not(windows))]
    {
        let _ = (app, request);
        Err("Epic to Steam sync is only supported on Windows.".to_string())
    }
}

#[cfg(windows)]
fn scan_epic_games_for_sync_windows(
    app: &AppHandle,
    steam_user_id: Option<String>,
) -> CmdResult<EpicSteamScanResult> {
    let steam_running = is_process_running("steam.exe");
    let mut warnings = Vec::new();

    let steam_paths = find_steam_paths();
    let steam_path_text = steam_paths
        .as_ref()
        .map(|paths| paths.root.to_string_lossy().to_string());

    let accounts = if let Some(paths) = steam_paths.as_ref() {
        list_steam_accounts(paths, steam_user_id.as_deref())?
    } else {
        warnings.push("未检测到 Steam 安装目录。".to_string());
        Vec::new()
    };

    let selected_account = accounts.iter().find(|account| account.selected).cloned();
    let selected_context = selected_account
        .as_ref()
        .map(resolve_account_context)
        .transpose()?;
    let managed_store = read_managed_store(app)?;
    let managed_user = selected_account
        .as_ref()
        .and_then(|account| find_managed_user(&managed_store, &account.id));
    let managed_paths = selected_account
        .as_ref()
        .map(|account| resolve_managed_paths(app, &account.id))
        .transpose()?;
    let existing_shortcuts = if let Some(context) = selected_context.as_ref() {
        read_shortcuts_file(&context.shortcuts_path)?
    } else {
        Vec::new()
    };

    let mut epic_games = load_epic_games_from_manifests()?;
    if epic_games.is_empty() {
        warnings.push("未检测到 Epic 已安装游戏。".to_string());
    }

    if let (Some(managed_user), Some(managed_paths)) = (managed_user, managed_paths.as_ref()) {
        for game in &mut epic_games {
            game.sync_status =
                build_sync_status(game, managed_user, managed_paths, &existing_shortcuts)?;
        }
    }

    Ok(EpicSteamScanResult {
        steam_path: steam_path_text,
        steam_running,
        selected_steam_user_id: selected_account.map(|account| account.id),
        accounts,
        epic_games,
        warnings,
    })
}

#[cfg(windows)]
fn sync_epic_games_to_steam_windows(
    app: &AppHandle,
    request: SyncEpicGamesRequest,
) -> CmdResult<SyncEpicGamesResult> {
    if is_process_running("steam.exe") {
        return Err("同步前请先完全退出 Steam，避免客户端覆盖 shortcuts.vdf。".to_string());
    }

    let steam_paths = find_steam_paths().ok_or_else(|| "未检测到 Steam 安装目录。".to_string())?;
    let accounts = list_steam_accounts(&steam_paths, Some(request.steam_user_id.as_str()))?;
    let selected_account = accounts
        .into_iter()
        .find(|account| account.id == request.steam_user_id)
        .ok_or_else(|| "未找到目标 Steam 用户目录。".to_string())?;
    let account_context = resolve_account_context(&selected_account)?;
    let managed_paths = resolve_managed_paths(app, &selected_account.id)?;
    let all_games = load_epic_games_from_manifests()?;
    let game_map: HashMap<String, EpicInstalledGame> = all_games
        .into_iter()
        .map(|game| (game.id.clone(), game))
        .collect();

    let mut warnings = Vec::new();
    let mut selected_games = Vec::new();
    let mut seen_ids = HashSet::new();
    for game_id in &request.game_ids {
        if !seen_ids.insert(game_id.clone()) {
            continue;
        }
        if let Some(game) = game_map.get(game_id) {
            selected_games.push(game.clone());
        } else {
            warnings.push(format!("未找到 Epic 游戏：{game_id}"));
        }
    }

    fs::create_dir_all(&managed_paths.launcher_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&account_context.grid_dir).map_err(|e| e.to_string())?;

    let mut shortcuts = read_shortcuts_file(&account_context.shortcuts_path)?;
    let store = read_managed_store(app)?;
    let existing_user = find_managed_user(&store, &selected_account.id)
        .cloned()
        .unwrap_or_default();

    let stale_paths: HashSet<String> = if request.remove_missing_managed {
        existing_user
            .entries
            .iter()
            .filter(|entry| !seen_ids.contains(&entry.game_id))
            .map(|entry| normalize_path_text(&entry.launcher_path))
            .collect()
    } else {
        HashSet::new()
    };

    let removed_count = if request.remove_missing_managed {
        let before = shortcuts.len();
        shortcuts.retain(|entry| {
            let shortcut_path = normalize_path_text(&entry.shortcut_path);
            let exe_path = normalize_path_text(trim_wrapped_quotes(&entry.exe));
            !stale_paths.contains(&shortcut_path) && !stale_paths.contains(&exe_path)
        });
        before.saturating_sub(shortcuts.len())
    } else {
        0
    };

    let existing_managed_paths: HashSet<String> = existing_user
        .entries
        .iter()
        .map(|entry| normalize_path_text(&entry.launcher_path))
        .collect();

    let mut created_count = 0usize;
    let mut updated_count = 0usize;
    let mut synced_entries = Vec::new();

    for game in selected_games {
        let identity = build_shortcut_identity(&managed_paths.launcher_dir, &game)?;
        write_launcher_script(&identity.launcher_path, &game)?;
        write_artwork_bundle(
            &account_context.grid_dir,
            &identity.steam_grid_id,
            identity.app_id,
            &game.title,
        )?;

        let next_shortcut = ShortcutEntry {
            app_name: game.title.clone(),
            exe: identity.exe_value.clone(),
            start_dir: wrap_path_for_shortcut(
                identity
                    .launcher_path
                    .parent()
                    .unwrap_or(&managed_paths.launcher_dir),
            ),
            icon: game.icon_path.clone().unwrap_or_default(),
            shortcut_path: identity.shortcut_path.clone(),
            launch_options: String::new(),
            is_hidden: 0,
            allow_desktop_config: 1,
            allow_overlay: 1,
            open_vr: 0,
            devkit: 0,
            devkit_game_id: String::new(),
            devkit_override_app_id: 0,
            last_play_time: 0,
            flatpak_app_id: String::new(),
            app_id: identity.app_id,
            tags: vec![
                SHORTCUT_TAG_PULSE.to_string(),
                SHORTCUT_TAG_EPIC.to_string(),
            ],
        };

        if let Some(index) = find_existing_shortcut_index(
            &shortcuts,
            &identity,
            &game.title,
            &existing_managed_paths,
        ) {
            shortcuts[index] = next_shortcut;
            updated_count += 1;
        } else {
            shortcuts.push(next_shortcut);
            created_count += 1;
        }

        synced_entries.push(ManagedSyncEntry {
            game_id: game.id.clone(),
            title: game.title.clone(),
            launcher_path: identity.launcher_path.to_string_lossy().to_string(),
            app_id: identity.app_id,
            steam_grid_id: identity.steam_grid_id,
            updated_at: Utc::now().to_rfc3339(),
        });
    }

    let backup_path = backup_shortcuts_file(&account_context.shortcuts_path)?;
    write_shortcuts_file(&account_context.shortcuts_path, &shortcuts)?;
    write_managed_store(
        app,
        &selected_account.id,
        ManagedSyncUser {
            steam_user_id: selected_account.id.clone(),
            entries: synced_entries.clone(),
        },
    )?;

    Ok(SyncEpicGamesResult {
        shortcuts_path: account_context.shortcuts_path.to_string_lossy().to_string(),
        grid_dir: account_context.grid_dir.to_string_lossy().to_string(),
        launcher_dir: managed_paths.launcher_dir.to_string_lossy().to_string(),
        backup_path: backup_path.map(|path| path.to_string_lossy().to_string()),
        created_count,
        updated_count,
        removed_count,
        synced_game_ids: synced_entries
            .into_iter()
            .map(|entry| entry.game_id)
            .collect(),
        warnings,
    })
}

#[cfg(windows)]
fn load_epic_games_from_manifests() -> CmdResult<Vec<EpicInstalledGame>> {
    let Some(manifests_dir) = find_epic_manifests_dir() else {
        return Ok(Vec::new());
    };

    let mut games = BTreeMap::new();
    for entry in fs::read_dir(manifests_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("item") {
            continue;
        }
        let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let manifest: EpicItemManifest = match serde_json::from_str(&text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let title = manifest
            .display_name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("Epic Game")
            .to_string();
        let install_dir = manifest
            .install_location
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_default()
            .to_string();
        if install_dir.is_empty() {
            continue;
        }

        let game_id = manifest
            .catalog_item_id
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| manifest.main_game_app_name.clone())
            .or_else(|| manifest.app_name.clone())
            .unwrap_or_else(|| format!("path-{:08x}", crc32fast::hash(install_dir.as_bytes())));
        let epic_app_name = manifest
            .main_game_app_name
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                manifest
                    .app_name
                    .clone()
                    .filter(|value| !value.trim().is_empty())
            });
        let launch_executable = manifest
            .launch_executable
            .as_deref()
            .and_then(|value| resolve_epic_path(&install_dir, value));
        let icon_path = launch_executable
            .clone()
            .filter(|value| Path::new(value).exists());

        games.insert(
            game_id.clone(),
            EpicInstalledGame {
                id: game_id,
                title,
                install_dir,
                launch_executable,
                launch_command: manifest.launch_command.clone(),
                epic_app_name,
                icon_path,
                sync_status: EpicSteamGameSyncStatus {
                    present_in_steam: false,
                    managed_by_pulse: false,
                    app_id: None,
                    source: "new".to_string(),
                },
            },
        );
    }

    Ok(games.into_values().collect())
}

#[cfg(windows)]
fn build_sync_status(
    game: &EpicInstalledGame,
    managed_user: &ManagedSyncUser,
    managed_paths: &ManagedPaths,
    shortcuts: &[ShortcutEntry],
) -> CmdResult<EpicSteamGameSyncStatus> {
    let identity = build_shortcut_identity(&managed_paths.launcher_dir, game)?;
    let managed_entry = managed_user
        .entries
        .iter()
        .find(|entry| entry.game_id == game.id);
    let managed_paths_set: HashSet<String> = managed_user
        .entries
        .iter()
        .map(|entry| normalize_path_text(&entry.launcher_path))
        .collect();

    let existing = shortcuts.iter().find(|entry| {
        let shortcut_path = normalize_path_text(&entry.shortcut_path);
        let exe_path = normalize_path_text(trim_wrapped_quotes(&entry.exe));
        shortcut_path == normalize_path_text(&identity.shortcut_path)
            || exe_path == normalize_path_text(&identity.launcher_path.to_string_lossy())
            || entry.app_id == identity.app_id
            || (entry.app_name.eq_ignore_ascii_case(&game.title)
                && (managed_paths_set.contains(&shortcut_path)
                    || managed_paths_set.contains(&exe_path)
                    || entry.tags.iter().any(|tag| tag == SHORTCUT_TAG_PULSE)))
    });

    let managed_by_pulse = existing
        .map(|entry| is_managed_shortcut(entry, managed_paths, &managed_paths_set))
        .unwrap_or(false)
        || managed_entry.is_some();
    let present_in_steam = existing.is_some();

    Ok(EpicSteamGameSyncStatus {
        present_in_steam,
        managed_by_pulse,
        app_id: existing
            .map(|entry| entry.app_id)
            .or_else(|| managed_entry.map(|entry| entry.app_id)),
        source: if managed_by_pulse {
            "managed".to_string()
        } else if present_in_steam {
            "existing".to_string()
        } else {
            "new".to_string()
        },
    })
}

#[cfg(windows)]
fn is_managed_shortcut(
    entry: &ShortcutEntry,
    managed_paths: &ManagedPaths,
    managed_paths_set: &HashSet<String>,
) -> bool {
    let launcher_dir = normalize_path_text(&managed_paths.launcher_dir.to_string_lossy());
    let shortcut_path = normalize_path_text(&entry.shortcut_path);
    let exe_path = normalize_path_text(trim_wrapped_quotes(&entry.exe));
    entry.tags.iter().any(|tag| tag == SHORTCUT_TAG_PULSE)
        || managed_paths_set.contains(&shortcut_path)
        || managed_paths_set.contains(&exe_path)
        || shortcut_path.starts_with(&launcher_dir)
        || exe_path.starts_with(&launcher_dir)
}

#[cfg(windows)]
fn find_existing_shortcut_index(
    shortcuts: &[ShortcutEntry],
    identity: &ShortcutIdentity,
    title: &str,
    managed_paths_set: &HashSet<String>,
) -> Option<usize> {
    let shortcut_path = normalize_path_text(&identity.shortcut_path);
    let launcher_path = normalize_path_text(&identity.launcher_path.to_string_lossy());
    shortcuts.iter().position(|entry| {
        let entry_shortcut_path = normalize_path_text(&entry.shortcut_path);
        let entry_exe_path = normalize_path_text(trim_wrapped_quotes(&entry.exe));
        entry_shortcut_path == shortcut_path
            || entry_exe_path == launcher_path
            || entry.app_id == identity.app_id
            || (entry.app_name.eq_ignore_ascii_case(title)
                && (managed_paths_set.contains(&entry_shortcut_path)
                    || managed_paths_set.contains(&entry_exe_path)
                    || entry.tags.iter().any(|tag| tag == SHORTCUT_TAG_PULSE)))
    })
}

#[cfg(windows)]
fn build_shortcut_identity(
    launcher_dir: &Path,
    game: &EpicInstalledGame,
) -> CmdResult<ShortcutIdentity> {
    let launcher_path = launcher_dir.join(format!("{}.cmd", sanitize_filename(&game.id)));
    let exe_value = wrap_path_for_shortcut(&launcher_path);
    let app_id = compute_shortcut_app_id(&exe_value, &game.title);
    Ok(ShortcutIdentity {
        launcher_path: launcher_path.clone(),
        exe_value,
        shortcut_path: launcher_path.to_string_lossy().to_string(),
        app_id,
        steam_grid_id: compute_shortcut_steam_grid_id(app_id),
    })
}

#[cfg(windows)]
fn write_launcher_script(path: &Path, game: &EpicInstalledGame) -> CmdResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| "launcher path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let content = if let Some(app_name) = game.epic_app_name.as_deref() {
        format!(
            "@echo off\r\nsetlocal\r\nstart \"\" \"com.epicgames.launcher://apps/{}?action=launch&silent=true\"\r\n",
            app_name
        )
    } else if let Some(executable) = game.launch_executable.as_deref() {
        let work_dir = Path::new(executable)
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from(&game.install_dir));
        let command = game
            .launch_command
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("");
        format!(
            "@echo off\r\nsetlocal\r\ncd /d \"{}\"\r\nstart \"\" \"{}\" {}\r\n",
            work_dir.to_string_lossy(),
            executable,
            command
        )
    } else {
        return Err(format!("游戏 {} 缺少可用的启动信息。", game.title));
    };

    fs::write(path, content).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn write_artwork_bundle(
    grid_dir: &Path,
    steam_grid_id: &str,
    app_id: u32,
    title: &str,
) -> CmdResult<()> {
    fs::create_dir_all(grid_dir).map_err(|e| e.to_string())?;
    let short_id = app_id.to_string();
    let targets = [
        (format!("{steam_grid_id}p.png"), 600u32, 900u32),
        (format!("{short_id}p.png"), 600u32, 900u32),
        (format!("{steam_grid_id}.png"), 920u32, 430u32),
        (format!("{short_id}.png"), 920u32, 430u32),
        (format!("{steam_grid_id}_hero.png"), 1920u32, 620u32),
        (format!("{short_id}_hero.png"), 1920u32, 620u32),
    ];

    for (filename, width, height) in targets {
        let image = generate_cover_image(width, height, title);
        image
            .save(grid_dir.join(filename))
            .map_err(|e| format!("failed to write artwork: {e}"))?;
    }

    Ok(())
}

#[cfg(windows)]
fn generate_cover_image(width: u32, height: u32, title: &str) -> RgbaImage {
    let mut image: RgbaImage = ImageBuffer::new(width, height);
    let seed = crc32fast::hash(title.as_bytes());
    let primary = color_from_seed(seed ^ 0x0f31_2a11);
    let secondary = color_from_seed(seed.rotate_left(13) ^ 0x19af_01c7);
    let accent = color_from_seed(seed.rotate_right(7) ^ 0x02f1_9a0d);

    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let fx = x as f32 / width.max(1) as f32;
        let fy = y as f32 / height.max(1) as f32;
        let mix = (fx * 0.64 + fy * 0.36).clamp(0.0, 1.0);
        let stripe = (((x as i32 - y as i32) + (seed as i32 & 127)) & 63) < 10;
        let vignette = ((fx - 0.5).powi(2) + (fy - 0.5).powi(2))
            .sqrt()
            .clamp(0.0, 0.78);

        let mut color = blend_color(primary, secondary, mix);
        if stripe {
            color = blend_color(color, accent, 0.28);
        }
        color = darken_color(color, vignette * 0.58);
        *pixel = Rgba([color[0], color[1], color[2], 255]);
    }

    let glow_y = height.saturating_mul(3) / 5;
    let glow_radius = height.max(width) / 3;
    let glow_x = width / 2;
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let dx = glow_x as i64 - x as i64;
        let dy = glow_y as i64 - y as i64;
        let distance = ((dx * dx + dy * dy) as f64).sqrt() as f32 / glow_radius.max(1) as f32;
        if distance <= 1.0 {
            let lift = (1.0 - distance) * 0.16;
            pixel.0[0] = ((pixel.0[0] as f32) * (1.0 - lift) + accent[0] as f32 * lift) as u8;
            pixel.0[1] = ((pixel.0[1] as f32) * (1.0 - lift) + accent[1] as f32 * lift) as u8;
            pixel.0[2] = ((pixel.0[2] as f32) * (1.0 - lift) + accent[2] as f32 * lift) as u8;
        }
    }

    image
}

#[cfg(windows)]
fn color_from_seed(seed: u32) -> [u8; 3] {
    [
        52 + ((seed >> 16) & 0x6f) as u8,
        58 + ((seed >> 8) & 0x67) as u8,
        76 + (seed & 0x5f) as u8,
    ]
}

#[cfg(windows)]
fn blend_color(a: [u8; 3], b: [u8; 3], t: f32) -> [u8; 3] {
    [
        ((a[0] as f32) * (1.0 - t) + (b[0] as f32) * t) as u8,
        ((a[1] as f32) * (1.0 - t) + (b[1] as f32) * t) as u8,
        ((a[2] as f32) * (1.0 - t) + (b[2] as f32) * t) as u8,
    ]
}

#[cfg(windows)]
fn darken_color(color: [u8; 3], factor: f32) -> [u8; 3] {
    let scale = (1.0 - factor).clamp(0.0, 1.0);
    [
        (color[0] as f32 * scale) as u8,
        (color[1] as f32 * scale) as u8,
        (color[2] as f32 * scale) as u8,
    ]
}

#[cfg(windows)]
fn find_epic_manifests_dir() -> Option<PathBuf> {
    let program_data = std::env::var_os("ProgramData")?;
    let dir = PathBuf::from(program_data)
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");
    if dir.exists() {
        Some(dir)
    } else {
        None
    }
}

#[cfg(windows)]
fn resolve_epic_path(install_dir: &str, candidate: &str) -> Option<String> {
    let trimmed = candidate.trim();
    if trimmed.is_empty() {
        return None;
    }
    let path = PathBuf::from(trimmed);
    if path.is_absolute() {
        return Some(path.to_string_lossy().to_string());
    }
    Some(
        PathBuf::from(install_dir)
            .join(trimmed)
            .to_string_lossy()
            .to_string(),
    )
}

#[cfg(windows)]
fn find_steam_paths() -> Option<SteamPaths> {
    let candidates = [
        read_registry_steam_path("Software\\Valve\\Steam", "SteamPath"),
        read_registry_steam_path("Software\\Valve\\Steam", "InstallPath"),
        std::env::var_os("ProgramFiles(x86)")
            .map(PathBuf::from)
            .map(|dir| dir.join("Steam")),
        std::env::var_os("ProgramFiles")
            .map(PathBuf::from)
            .map(|dir| dir.join("Steam")),
    ];

    for candidate in candidates.into_iter().flatten() {
        let users_root = candidate.join("userdata");
        if candidate.exists() && users_root.exists() {
            return Some(SteamPaths {
                root: candidate,
                users_root,
            });
        }
    }
    None
}

#[cfg(windows)]
fn list_steam_accounts(
    paths: &SteamPaths,
    preferred_user_id: Option<&str>,
) -> CmdResult<Vec<SteamShortcutAccount>> {
    let mut rows = Vec::new();
    for entry in fs::read_dir(&paths.users_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let user_id = entry.file_name().to_string_lossy().to_string();
        if !user_id.chars().all(|ch| ch.is_ascii_digit()) {
            continue;
        }
        let config_dir = entry.path().join("config");
        let shortcuts_path = config_dir.join("shortcuts.vdf");
        let grid_dir = config_dir.join("grid");
        let modified = fs::metadata(&shortcuts_path)
            .and_then(|meta| meta.modified())
            .ok();
        rows.push((
            user_id.clone(),
            modified,
            SteamShortcutAccount {
                id: user_id.clone(),
                label: user_id,
                shortcuts_path: shortcuts_path.to_string_lossy().to_string(),
                grid_dir: grid_dir.to_string_lossy().to_string(),
                selected: false,
            },
        ));
    }

    rows.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    let selected_id = preferred_user_id
        .map(str::to_string)
        .or_else(|| rows.first().map(|item| item.0.clone()));

    Ok(rows
        .into_iter()
        .map(|(id, _, mut account)| {
            account.selected = selected_id.as_deref() == Some(id.as_str());
            account
        })
        .collect())
}

#[cfg(windows)]
fn resolve_account_context(account: &SteamShortcutAccount) -> CmdResult<SteamAccountContext> {
    Ok(SteamAccountContext {
        shortcuts_path: PathBuf::from(&account.shortcuts_path),
        grid_dir: PathBuf::from(&account.grid_dir),
    })
}

#[cfg(windows)]
fn resolve_managed_paths(app: &AppHandle, steam_user_id: &str) -> CmdResult<ManagedPaths> {
    let mut root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    root.push(MANAGED_ROOT_DIR);
    Ok(ManagedPaths {
        launcher_dir: root.join("launchers").join(steam_user_id),
    })
}

#[cfg(windows)]
fn read_managed_store(app: &AppHandle) -> CmdResult<ManagedSyncStore> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push(MANAGED_STORE_FILE);
    if !path.exists() {
        return Ok(ManagedSyncStore::default());
    }
    let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn write_managed_store(
    app: &AppHandle,
    steam_user_id: &str,
    next_user: ManagedSyncUser,
) -> CmdResult<()> {
    let mut store = read_managed_store(app)?;
    if let Some(existing) = store
        .users
        .iter_mut()
        .find(|user| user.steam_user_id == steam_user_id)
    {
        *existing = next_user;
    } else {
        store.users.push(next_user);
    }

    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push(MANAGED_STORE_FILE);
    let content = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn find_managed_user<'a>(
    store: &'a ManagedSyncStore,
    steam_user_id: &str,
) -> Option<&'a ManagedSyncUser> {
    store
        .users
        .iter()
        .find(|user| user.steam_user_id == steam_user_id)
}

#[cfg(windows)]
fn backup_shortcuts_file(path: &Path) -> CmdResult<Option<PathBuf>> {
    if !path.exists() {
        return Ok(None);
    }
    let backup = path.with_file_name(format!(
        "shortcuts-{}.bak.vdf",
        Utc::now().format("%Y%m%d%H%M%S")
    ));
    fs::copy(path, &backup).map_err(|e| e.to_string())?;
    Ok(Some(backup))
}

#[cfg(windows)]
fn read_shortcuts_file(path: &Path) -> CmdResult<Vec<ShortcutEntry>> {
    if !path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Ok(Vec::new());
    }
    ShortcutBinaryParser::new(&bytes).parse_file()
}

#[cfg(windows)]
fn write_shortcuts_file(path: &Path, shortcuts: &[ShortcutEntry]) -> CmdResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| "shortcuts path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    fs::write(path, encode_shortcuts(shortcuts)).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn encode_shortcuts(shortcuts: &[ShortcutEntry]) -> Vec<u8> {
    let mut bytes = Vec::new();
    write_object_start(&mut bytes, "shortcuts");
    for (index, shortcut) in shortcuts.iter().enumerate() {
        write_object_start(&mut bytes, &index.to_string());
        write_string_field(&mut bytes, "appname", &shortcut.app_name);
        write_string_field(&mut bytes, "exe", &shortcut.exe);
        write_string_field(&mut bytes, "StartDir", &shortcut.start_dir);
        write_string_field(&mut bytes, "icon", &shortcut.icon);
        write_string_field(&mut bytes, "ShortcutPath", &shortcut.shortcut_path);
        write_string_field(&mut bytes, "LaunchOptions", &shortcut.launch_options);
        write_u32_field(&mut bytes, "IsHidden", shortcut.is_hidden);
        write_u32_field(
            &mut bytes,
            "AllowDesktopConfig",
            shortcut.allow_desktop_config,
        );
        write_u32_field(&mut bytes, "AllowOverlay", shortcut.allow_overlay);
        write_u32_field(&mut bytes, "OpenVR", shortcut.open_vr);
        write_u32_field(&mut bytes, "Devkit", shortcut.devkit);
        write_string_field(&mut bytes, "DevkitGameID", &shortcut.devkit_game_id);
        write_u32_field(
            &mut bytes,
            "DevkitOverrideAppID",
            shortcut.devkit_override_app_id,
        );
        write_u32_field(&mut bytes, "LastPlayTime", shortcut.last_play_time);
        write_string_field(&mut bytes, "FlatpakAppID", &shortcut.flatpak_app_id);
        write_u32_field(&mut bytes, "appid", shortcut.app_id);
        write_object_start(&mut bytes, "tags");
        for (tag_index, tag) in shortcut.tags.iter().enumerate() {
            write_string_field(&mut bytes, &tag_index.to_string(), tag);
        }
        bytes.push(0x08);
        bytes.push(0x08);
    }
    bytes.push(0x08);
    bytes.push(0x08);
    bytes
}

#[cfg(windows)]
fn write_object_start(out: &mut Vec<u8>, name: &str) {
    out.push(0x00);
    out.extend_from_slice(name.as_bytes());
    out.push(0x00);
}

#[cfg(windows)]
fn write_string_field(out: &mut Vec<u8>, key: &str, value: &str) {
    out.push(0x01);
    out.extend_from_slice(key.as_bytes());
    out.push(0x00);
    out.extend_from_slice(value.as_bytes());
    out.push(0x00);
}

#[cfg(windows)]
fn write_u32_field(out: &mut Vec<u8>, key: &str, value: u32) {
    out.push(0x02);
    out.extend_from_slice(key.as_bytes());
    out.push(0x00);
    out.extend_from_slice(&(value as i32).to_le_bytes());
}

#[cfg(windows)]
struct ShortcutBinaryParser<'a> {
    data: &'a [u8],
    position: usize,
}

#[cfg(windows)]
impl<'a> ShortcutBinaryParser<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, position: 0 }
    }

    fn parse_file(mut self) -> CmdResult<Vec<ShortcutEntry>> {
        let root_type = self.read_byte()?;
        if root_type != 0x00 {
            return Err("shortcuts.vdf root marker is invalid".to_string());
        }
        let root_name = self.read_c_string()?;
        if root_name != "shortcuts" {
            return Err("shortcuts.vdf root key is invalid".to_string());
        }

        let mut entries = Vec::new();
        loop {
            let field_type = self.read_byte()?;
            if field_type == 0x08 {
                break;
            }
            if field_type != 0x00 {
                return Err(format!(
                    "unsupported shortcuts.vdf field type: {field_type}"
                ));
            }
            let _index = self.read_c_string()?;
            entries.push(self.parse_shortcut_entry()?);
        }
        Ok(entries)
    }

    fn parse_shortcut_entry(&mut self) -> CmdResult<ShortcutEntry> {
        let mut entry = ShortcutEntry::default();
        loop {
            let field_type = self.read_byte()?;
            match field_type {
                0x08 => break,
                0x00 => {
                    let object_name = self.read_c_string()?;
                    if object_name == "tags" {
                        entry.tags = self.parse_tags()?;
                    } else {
                        self.skip_object()?;
                    }
                }
                0x01 => {
                    let key = self.read_c_string()?;
                    let value = self.read_c_string()?;
                    match key.as_str() {
                        "appname" => entry.app_name = value,
                        "exe" => entry.exe = value,
                        "StartDir" => entry.start_dir = value,
                        "icon" => entry.icon = value,
                        "ShortcutPath" => entry.shortcut_path = value,
                        "LaunchOptions" => entry.launch_options = value,
                        "DevkitGameID" => entry.devkit_game_id = value,
                        "FlatpakAppID" => entry.flatpak_app_id = value,
                        _ => {}
                    }
                }
                0x02 => {
                    let key = self.read_c_string()?;
                    let value = self.read_i32()? as u32;
                    match key.as_str() {
                        "IsHidden" => entry.is_hidden = value,
                        "AllowDesktopConfig" => entry.allow_desktop_config = value,
                        "AllowOverlay" => entry.allow_overlay = value,
                        "OpenVR" => entry.open_vr = value,
                        "Devkit" => entry.devkit = value,
                        "DevkitOverrideAppID" => entry.devkit_override_app_id = value,
                        "LastPlayTime" => entry.last_play_time = value,
                        "appid" => entry.app_id = value,
                        _ => {}
                    }
                }
                other => return Err(format!("unsupported shortcut field type: {other}")),
            }
        }
        Ok(entry)
    }

    fn parse_tags(&mut self) -> CmdResult<Vec<String>> {
        let mut tags = BTreeMap::new();
        loop {
            let field_type = self.read_byte()?;
            match field_type {
                0x08 => break,
                0x01 => {
                    let index = self.read_c_string()?;
                    let value = self.read_c_string()?;
                    tags.insert(index, value);
                }
                0x00 => {
                    let _name = self.read_c_string()?;
                    self.skip_object()?;
                }
                other => return Err(format!("unsupported tag field type: {other}")),
            }
        }
        Ok(tags.into_values().collect())
    }

    fn skip_object(&mut self) -> CmdResult<()> {
        loop {
            let field_type = self.read_byte()?;
            match field_type {
                0x08 => break,
                0x00 => {
                    let _name = self.read_c_string()?;
                    self.skip_object()?;
                }
                0x01 => {
                    let _key = self.read_c_string()?;
                    let _value = self.read_c_string()?;
                }
                0x02 => {
                    let _key = self.read_c_string()?;
                    let _value = self.read_i32()?;
                }
                other => return Err(format!("unsupported binary VDF field type: {other}")),
            }
        }
        Ok(())
    }

    fn read_byte(&mut self) -> CmdResult<u8> {
        let byte = self
            .data
            .get(self.position)
            .copied()
            .ok_or_else(|| "unexpected end of shortcuts.vdf".to_string())?;
        self.position += 1;
        Ok(byte)
    }

    fn read_c_string(&mut self) -> CmdResult<String> {
        let start = self.position;
        while let Some(byte) = self.data.get(self.position) {
            if *byte == 0 {
                let value = String::from_utf8_lossy(&self.data[start..self.position]).to_string();
                self.position += 1;
                return Ok(value);
            }
            self.position += 1;
        }
        Err("unterminated shortcuts.vdf string".to_string())
    }

    fn read_i32(&mut self) -> CmdResult<i32> {
        let end = self.position + 4;
        let bytes = self
            .data
            .get(self.position..end)
            .ok_or_else(|| "unexpected end of shortcuts.vdf int32".to_string())?;
        self.position = end;
        Ok(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }
}

#[cfg(windows)]
fn compute_shortcut_app_id(exe: &str, app_name: &str) -> u32 {
    let mut hasher = Hasher::new();
    hasher.update(exe.as_bytes());
    hasher.update(app_name.as_bytes());
    hasher.finalize() | 0x8000_0000
}

#[cfg(windows)]
fn compute_shortcut_steam_grid_id(app_id: u32) -> String {
    (((app_id as u64) << 32) | 0x0200_0000u64).to_string()
}

#[cfg(windows)]
fn wrap_path_for_shortcut(path: &Path) -> String {
    format!("\"{}\"", path.to_string_lossy())
}

#[cfg(windows)]
fn trim_wrapped_quotes(value: &str) -> &str {
    value.trim().trim_matches('"')
}

#[cfg(windows)]
fn sanitize_filename(value: &str) -> String {
    let mut text = String::with_capacity(value.len());
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            text.push(ch);
        } else {
            text.push('_');
        }
    }
    let compact = text.trim_matches('_');
    if compact.is_empty() {
        format!("game-{:08x}", crc32fast::hash(value.as_bytes()))
    } else {
        compact.to_string()
    }
}

#[cfg(windows)]
fn normalize_path_text(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_ascii_lowercase()
}

#[cfg(windows)]
fn read_registry_steam_path(key_path: &str, value_name: &str) -> Option<PathBuf> {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY_CURRENT_USER, KEY_QUERY_VALUE, REG_SZ,
    };

    unsafe {
        let mut key = std::ptr::null_mut();
        let key_path_w = to_wide(key_path);
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            key_path_w.as_ptr(),
            0,
            KEY_QUERY_VALUE,
            &mut key,
        ) != ERROR_SUCCESS
        {
            return None;
        }

        let value_name_w = to_wide(value_name);
        let mut value_type = 0u32;
        let mut data_len = 0u32;
        if RegQueryValueExW(
            key,
            value_name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            std::ptr::null_mut(),
            &mut data_len,
        ) != ERROR_SUCCESS
            || value_type != REG_SZ
            || data_len < 2
        {
            RegCloseKey(key);
            return None;
        }

        let mut buffer = vec![0u16; (data_len as usize / 2).max(1)];
        let status = RegQueryValueExW(
            key,
            value_name_w.as_ptr(),
            std::ptr::null_mut(),
            &mut value_type,
            buffer.as_mut_ptr() as *mut u8,
            &mut data_len,
        );
        RegCloseKey(key);
        if status != ERROR_SUCCESS {
            return None;
        }

        let nul = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        let text = String::from_utf16_lossy(&buffer[..nul]);
        if text.trim().is_empty() {
            None
        } else {
            Some(PathBuf::from(text))
        }
    }
}

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn is_process_running(process_name: &str) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let target = process_name.to_ascii_lowercase();
        let mut found = false;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let nul = entry
                    .szExeFile
                    .iter()
                    .position(|value| *value == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..nul]).to_ascii_lowercase();
                if name == target {
                    found = true;
                    break;
                }
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);
        found
    }
}
