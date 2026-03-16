use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::Duration,
};

use reqwest::Client;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, State};
use tokio::time::sleep;

use crate::{
    state::SharedState,
    types::{
        LocalAiAttachment, LocalAiChatRequest, LocalAiChatResponse, LocalAiStatus,
        LocalAiTokenUsage,
    },
};

const LOCAL_AI_HOST: &str = "127.0.0.1";
const LOCAL_AI_PORT: u16 = 39391;
const LOCAL_AI_STARTUP_RETRIES: usize = 80;
const LOCAL_AI_STARTUP_DELAY_MS: u64 = 500;
const LOCAL_AI_CHAT_TIMEOUT_SECS: u64 = 180;
const LOCAL_AI_MAX_TOKENS_DEFAULT: u64 = 1024;
const LOCAL_AI_MAX_TOKENS_RETRY: u64 = 1536;

pub struct LocalAiRuntime {
    child: Option<Child>,
    server_url: String,
    model_name: String,
    selected_model_dir: Option<PathBuf>,
    model_path: Option<PathBuf>,
    mmproj_path: Option<PathBuf>,
    server_path: Option<PathBuf>,
    last_error: Option<String>,
}

impl Default for LocalAiRuntime {
    fn default() -> Self {
        Self {
            child: None,
            server_url: local_ai_server_url(),
            model_name: String::new(),
            selected_model_dir: None,
            model_path: None,
            mmproj_path: None,
            server_path: None,
            last_error: None,
        }
    }
}

struct LocalAiAssets {
    server_dir: PathBuf,
    server_exe: PathBuf,
    model_dir: PathBuf,
    model_path: PathBuf,
    mmproj_path: Option<PathBuf>,
    model_name: String,
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn get_local_ai_status(
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<LocalAiStatus, String> {
    get_local_ai_status_internal(&app, state.inner()).await
}

#[tauri::command]
pub async fn start_local_ai_runtime(
    app: AppHandle,
    state: State<'_, SharedState>,
    model_dir: Option<String>,
) -> Result<LocalAiStatus, String> {
    start_local_ai_runtime_internal(&app, state.inner(), model_dir).await
}

#[tauri::command]
pub async fn stop_local_ai_runtime(
    _app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<LocalAiStatus, String> {
    let mut runtime = state.local_ai_runtime.lock().await;
    stop_local_ai_process(&mut runtime);
    runtime.last_error = None;
    Ok(build_status(
        &runtime,
        false,
        "Local AI server is stopped.".to_string(),
    ))
}

#[tauri::command]
pub async fn send_local_ai_message(
    app: AppHandle,
    state: State<'_, SharedState>,
    request: LocalAiChatRequest,
) -> Result<LocalAiChatResponse, String> {
    let status = ensure_local_ai_available_internal(&app, state.inner()).await?;

    let has_image_attachment = request
        .attachments
        .iter()
        .any(|attachment| attachment.media_type.starts_with("image/"));
    if has_image_attachment && !status.vision_enabled {
        return Err("The bundled model is missing the multimodal projector (mmproj).".to_string());
    }

    let client = build_http_client(LOCAL_AI_CHAT_TIMEOUT_SECS)?;
    let endpoint = format!("{}/v1/chat/completions", status.server_url);
    let first_attempt = send_local_ai_request(
        &client,
        &endpoint,
        &request,
        true,
        LOCAL_AI_MAX_TOKENS_DEFAULT,
    )
    .await?;

    let final_attempt = if first_attempt.reply.is_some() {
        first_attempt
    } else if first_attempt.reasoning.is_some()
        || first_attempt.finish_reason.as_deref() == Some("length")
    {
        send_local_ai_request(
            &client,
            &endpoint,
            &request,
            true,
            LOCAL_AI_MAX_TOKENS_RETRY,
        )
        .await?
    } else {
        first_attempt
    };

    let reply = final_attempt.reply.ok_or_else(|| {
        let reasoning_hint = if final_attempt.reasoning.is_some() {
            " The model returned reasoning content, but no final answer content."
        } else {
            ""
        };
        let finish_reason_hint = final_attempt
            .finish_reason
            .as_deref()
            .map(|value| format!(" finish_reason={value}."))
            .unwrap_or_default();
        format!(
            "local AI server returned an empty final reply.{reasoning_hint}{finish_reason_hint} Raw response: {}",
            truncate_text(&final_attempt.body, 800)
        )
    })?;
    let model = final_attempt
        .model
        .filter(|item| !item.trim().is_empty())
        .unwrap_or_else(|| status.model_name.clone());
    let usage = final_attempt.usage;

    Ok(LocalAiChatResponse {
        reply,
        model,
        status,
        usage,
    })
}

pub async fn shutdown_local_ai_runtime(state: SharedState) {
    let mut runtime = state.local_ai_runtime.lock().await;
    stop_local_ai_process(&mut runtime);
}

async fn get_local_ai_status_internal(
    app: &AppHandle,
    state: &SharedState,
) -> Result<LocalAiStatus, String> {
    let configured_dir = {
        let runtime = state.local_ai_runtime.lock().await;
        runtime.selected_model_dir.clone()
    };

    let assets = configured_dir
        .clone()
        .and_then(|path| resolve_local_ai_assets(app, Some(path)).ok());
    let mut runtime = state.local_ai_runtime.lock().await;

    if let Some(assets) = assets {
        apply_runtime_assets(&mut runtime, &assets);
    } else if configured_dir.is_some() {
        runtime.model_name.clear();
        runtime.model_path = None;
        runtime.mmproj_path = None;
    }
    runtime.server_url = local_ai_server_url();
    clear_dead_child(&mut runtime);

    if probe_local_ai_server(&runtime.server_url).await {
        runtime.last_error = None;
        return Ok(build_status(
            &runtime,
            true,
            "Local AI server is ready.".to_string(),
        ));
    }

    let message = runtime
        .last_error
        .clone()
        .unwrap_or_else(|| "Local AI server is not running.".to_string());
    Ok(build_status(&runtime, false, message))
}

async fn start_local_ai_runtime_internal(
    app: &AppHandle,
    state: &SharedState,
    model_dir: Option<String>,
) -> Result<LocalAiStatus, String> {
    let existing_dir = {
        let runtime = state.local_ai_runtime.lock().await;
        runtime.selected_model_dir.clone()
    };
    let chosen_dir = model_dir
        .map(PathBuf::from)
        .or(existing_dir)
        .ok_or_else(|| "No model directory is configured. Please choose a folder first.".to_string())?;
    let assets = resolve_local_ai_assets(app, Some(chosen_dir))?;
    let mut runtime = state.local_ai_runtime.lock().await;

    if runtime.child.is_some() {
        stop_local_ai_process(&mut runtime);
    }

    apply_runtime_assets(&mut runtime, &assets);
    runtime.server_url = local_ai_server_url();
    runtime.child = Some(spawn_local_ai_process(&assets)?);
    runtime.last_error = None;

    wait_for_local_ai_ready(&mut runtime).await
}

async fn ensure_local_ai_available_internal(
    app: &AppHandle,
    state: &SharedState,
) -> Result<LocalAiStatus, String> {
    let status = get_local_ai_status_internal(app, state).await?;
    if status.ready {
        return Ok(status);
    }

    Err(if status.running {
        "Local AI server is still starting. Please wait a moment.".to_string()
    } else {
        "Local AI server is not running. Select a model folder and start it manually first."
            .to_string()
    })
}

async fn wait_for_local_ai_ready(runtime: &mut LocalAiRuntime) -> Result<LocalAiStatus, String> {
    for _ in 0..LOCAL_AI_STARTUP_RETRIES {
        clear_dead_child(runtime);
        if probe_local_ai_server(&runtime.server_url).await {
            runtime.last_error = None;
            return Ok(build_status(
                runtime,
                true,
                "Local AI server is ready.".to_string(),
            ));
        }
        if runtime.child.is_none() {
            let message = runtime
                .last_error
                .clone()
                .unwrap_or_else(|| "Local AI server exited before it became ready.".to_string());
            return Err(message);
        }
        sleep(Duration::from_millis(LOCAL_AI_STARTUP_DELAY_MS)).await;
    }

    let message = "Timed out while starting the local AI server.".to_string();
    runtime.last_error = Some(message.clone());
    Err(message)
}

struct LocalAiParsedResponse {
    reply: Option<String>,
    reasoning: Option<String>,
    finish_reason: Option<String>,
    model: Option<String>,
    usage: Option<LocalAiTokenUsage>,
    body: String,
}

async fn send_local_ai_request(
    client: &Client,
    endpoint: &str,
    request: &LocalAiChatRequest,
    disable_thinking: bool,
    max_tokens: u64,
) -> Result<LocalAiParsedResponse, String> {
    let payload = build_chat_payload(request, disable_thinking, max_tokens);

    let response = client
        .post(endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("failed to call local AI server: {err}"))?;

    let status_code = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("failed to read local AI response: {err}"))?;

    if !status_code.is_success() {
        return Err(format!(
            "local AI server returned HTTP {}: {}",
            status_code.as_u16(),
            truncate_text(&body, 400)
        ));
    }

    let value: Value = serde_json::from_str(&body)
        .map_err(|err| format!("failed to parse local AI response JSON: {err}"))?;

    Ok(LocalAiParsedResponse {
        reply: extract_reply_text(&value),
        reasoning: extract_reasoning_text(&value),
        finish_reason: value
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("finish_reason"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        model: value
            .get("model")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        usage: extract_usage(&value),
        body,
    })
}

fn build_chat_payload(
    request: &LocalAiChatRequest,
    disable_thinking: bool,
    max_tokens: u64,
) -> Value {
    let mut messages = Vec::new();
    messages.push(json!({
        "role": "system",
        "content": "You are PulseCoreLite's local offline assistant. Prefer concise, practical answers. If the user attached text snippets, treat them as source material. If the user attached images, describe them directly."
    }));

    for history in request
        .history
        .iter()
        .rev()
        .take(10)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
    {
        let role = history.role.trim().to_lowercase();
        if !matches!(role.as_str(), "user" | "assistant" | "system") {
            continue;
        }
        let content = history.content.trim();
        if content.is_empty() {
            continue;
        }
        messages.push(json!({
            "role": role,
            "content": content
        }));
    }

    let user_prompt = build_user_prompt_text(
        request.prompt.trim(),
        &request.attachments,
        disable_thinking,
    );
    let image_items = request
        .attachments
        .iter()
        .filter(|attachment| attachment.media_type.starts_with("image/"))
        .filter_map(|attachment| attachment.data_url.as_ref())
        .map(|data_url| {
            json!({
                "type": "image_url",
                "image_url": {
                    "url": data_url
                }
            })
        })
        .collect::<Vec<_>>();

    if image_items.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": user_prompt
        }));
    } else {
        let mut content = vec![json!({
            "type": "text",
            "text": user_prompt
        })];
        content.extend(image_items);
        messages.push(json!({
            "role": "user",
            "content": content
        }));
    }

    json!({
        "model": "local-bundled-model",
        "messages": messages,
        "chat_template_kwargs": {
            "enable_thinking": !disable_thinking
        },
        "stream": false,
        "temperature": 0.5,
        "top_p": 0.9,
        "max_tokens": max_tokens
    })
}

fn build_user_prompt_text(
    prompt: &str,
    attachments: &[LocalAiAttachment],
    disable_thinking: bool,
) -> String {
    let mut sections = Vec::new();
    let _ = disable_thinking;
    if !prompt.is_empty() {
        sections.push(prompt.to_string());
    }

    let mut text_blocks = Vec::new();
    for attachment in attachments {
        if let Some(text_content) = attachment.text_content.as_deref() {
            let normalized = text_content.trim();
            if !normalized.is_empty() {
                text_blocks.push(format!(
                    "File: {}\nType: {}\nContent:\n{}",
                    attachment.name,
                    attachment.media_type,
                    truncate_text(normalized, 12_000)
                ));
                continue;
            }
        }

        if !attachment.media_type.starts_with("image/") {
            text_blocks.push(format!(
                "File: {} (type: {}, size: {} bytes). This file was uploaded, but only its metadata is available in the current offline flow.",
                attachment.name, attachment.media_type, attachment.size
            ));
        }
    }

    if !text_blocks.is_empty() {
        sections.push(format!(
            "The user also uploaded the following file material:\n\n{}",
            text_blocks.join("\n\n---\n\n")
        ));
    }

    if attachments
        .iter()
        .any(|attachment| attachment.media_type.starts_with("image/"))
    {
        sections.push("The user also uploaded one or more images. Please inspect them together with the text.".to_string());
    }

    if sections.is_empty() {
        "Please inspect the uploaded material and respond in Chinese with a practical summary."
            .to_string()
    } else {
        sections.join("\n\n")
    }
}

fn extract_reply_text(value: &Value) -> Option<String> {
    let choice = value.get("choices")?.get(0)?;

    if let Some(message) = choice.get("message") {
        for field in ["content", "output_text", "text", "refusal"] {
            if let Some(text) = extract_text_field(message.get(field)) {
                return Some(text);
            }
        }
    }

    for field in ["text", "output_text", "content"] {
        if let Some(text) = extract_text_field(choice.get(field)) {
            return Some(text);
        }
    }

    None
}

fn extract_reasoning_text(value: &Value) -> Option<String> {
    let choice = value.get("choices")?.get(0)?;
    let message = choice.get("message")?;

    for field in ["reasoning_content", "reasoning"] {
        if let Some(text) = extract_text_field(message.get(field)) {
            return Some(text);
        }
    }

    None
}

fn extract_text_field(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::Null => None,
        Value::String(text) => normalize_text(text),
        Value::Number(number) => normalize_text(&number.to_string()),
        Value::Bool(boolean) => normalize_text(if *boolean { "true" } else { "false" }),
        Value::Array(items) => {
            let mut segments = Vec::new();
            for item in items {
                if let Some(text) = extract_text_field(Some(item)) {
                    segments.push(text);
                    continue;
                }

                if let Some(text) = item
                    .get("text")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    segments.push(text);
                    continue;
                }

                if let Some(text) = item
                    .get("content")
                    .and_then(Value::as_str)
                    .and_then(normalize_text)
                {
                    segments.push(text);
                }
            }

            let merged = segments.join("\n");
            normalize_text(&merged)
        }
        Value::Object(map) => {
            for key in ["text", "content", "output_text"] {
                if let Some(text) = extract_text_field(map.get(key)) {
                    return Some(text);
                }
            }
            None
        }
    }
}

fn normalize_text(text: &str) -> Option<String> {
    let normalized = text.trim();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized.to_string())
    }
}

fn extract_usage(value: &Value) -> Option<LocalAiTokenUsage> {
    let usage = value.get("usage")?;
    Some(LocalAiTokenUsage {
        prompt_tokens: usage.get("prompt_tokens").and_then(Value::as_u64),
        completion_tokens: usage.get("completion_tokens").and_then(Value::as_u64),
        total_tokens: usage.get("total_tokens").and_then(Value::as_u64),
    })
}

fn resolve_local_ai_assets(
    app: &AppHandle,
    model_dir_override: Option<PathBuf>,
) -> Result<LocalAiAssets, String> {
    let roots = local_ai_search_roots(app);
    let mut server_dir = None;

    for root in &roots {
        if server_dir.is_none() {
            for candidate in [
                root.join("llama_CPU_X64"),
                root.join("build-assets").join("llama_CPU_X64"),
            ] {
                if candidate.join("llama-server.exe").is_file() {
                    server_dir = Some(candidate);
                    break;
                }
            }
        }
    }

    let server_dir = server_dir.ok_or_else(|| {
        format!(
            "Failed to find bundled llama-server.exe. Searched in: {}",
            display_search_roots(&roots)
        )
    })?;
    let llm_dir = model_dir_override
        .ok_or_else(|| "No model directory is configured. Please choose a folder that contains .gguf files.".to_string())?;

    let server_exe = server_dir.join("llama-server.exe");
    if !server_exe.is_file() {
        return Err(format!(
            "Bundled llama-server.exe is missing: {}",
            server_exe.display()
        ));
    }

    let model_path = select_main_model(&llm_dir)?;
    let mmproj_path = select_mmproj_model(&llm_dir);
    let model_name = model_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "bundled-local-model".to_string());

    Ok(LocalAiAssets {
        server_dir,
        server_exe,
        model_dir: llm_dir,
        model_path,
        mmproj_path,
        model_name,
    })
}

fn select_main_model(llm_dir: &Path) -> Result<PathBuf, String> {
    let mut candidates = fs::read_dir(llm_dir)
        .map_err(|err| {
            format!(
                "failed to read model directory {}: {err}",
                llm_dir.display()
            )
        })?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("gguf"))
                .unwrap_or(false)
        })
        .filter(|path| {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase())
                .unwrap_or_default();
            !name.contains("mmproj")
        })
        .collect::<Vec<_>>();

    candidates.sort_by_key(|path| {
        fs::metadata(path)
            .map(|meta| std::cmp::Reverse(meta.len()))
            .unwrap_or(std::cmp::Reverse(0))
    });

    candidates
        .into_iter()
        .next()
        .ok_or_else(|| format!("No usable .gguf model found in {}", llm_dir.display()))
}

fn select_mmproj_model(llm_dir: &Path) -> Option<PathBuf> {
    fs::read_dir(llm_dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            if !path.is_file() {
                return false;
            }
            let ext_ok = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("gguf"))
                .unwrap_or(false);
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase())
                .unwrap_or_default();
            ext_ok && name.contains("mmproj")
        })
}

fn local_ai_search_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let mut seen = BTreeSet::new();
    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));

    for candidate in [
        app.path().resource_dir().ok(),
        app.path()
            .resource_dir()
            .ok()
            .map(|path| path.join("build-assets")),
        Some(workspace_root.join("build-assets")),
        Some(workspace_root),
    ]
    .into_iter()
    .flatten()
    {
        let key = candidate.to_string_lossy().to_string();
        if seen.insert(key) {
            roots.push(candidate);
        }
    }

    roots
}

fn display_search_roots(roots: &[PathBuf]) -> String {
    roots
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

fn spawn_local_ai_process(assets: &LocalAiAssets) -> Result<Child, String> {
    let mut command = Command::new(&assets.server_exe);
    command
        .current_dir(&assets.server_dir)
        .arg("-m")
        .arg(&assets.model_path)
        .arg("--host")
        .arg(LOCAL_AI_HOST)
        .arg("--port")
        .arg(LOCAL_AI_PORT.to_string())
        .arg("--ctx-size")
        .arg("4096")
        .arg("--jinja")
        .arg("--reasoning-format")
        .arg("deepseek")
        .arg("--reasoning")
        .arg("off")
        .arg("--reasoning-budget")
        .arg("0")
        .arg("--threads")
        .arg(recommended_thread_count().to_string())
        .arg("--n-gpu-layers")
        .arg("0")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    if let Some(mmproj_path) = &assets.mmproj_path {
        command.arg("--mmproj").arg(mmproj_path);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
        .spawn()
        .map_err(|err| format!("failed to start bundled llama-server.exe: {err}"))
}

fn recommended_thread_count() -> usize {
    std::thread::available_parallelism()
        .map(usize::from)
        .map(|count| count.clamp(2, 12))
        .unwrap_or(4)
}

fn clear_dead_child(runtime: &mut LocalAiRuntime) {
    let Some(child) = runtime.child.as_mut() else {
        return;
    };

    match child.try_wait() {
        Ok(Some(status)) => {
            runtime.child = None;
            runtime.last_error = Some(format!(
                "Bundled local AI server exited early with status: {status}"
            ));
        }
        Ok(None) => {}
        Err(err) => {
            runtime.child = None;
            runtime.last_error = Some(format!("failed to query local AI server process: {err}"));
        }
    }
}

fn stop_local_ai_process(runtime: &mut LocalAiRuntime) {
    if let Some(child) = runtime.child.as_mut() {
        let _ = child.kill();
        let _ = child.wait();
    }
    runtime.child = None;
}

fn apply_runtime_assets(runtime: &mut LocalAiRuntime, assets: &LocalAiAssets) {
    runtime.model_name = assets.model_name.clone();
    runtime.selected_model_dir = Some(assets.model_dir.clone());
    runtime.model_path = Some(assets.model_path.clone());
    runtime.mmproj_path = assets.mmproj_path.clone();
    runtime.server_path = Some(assets.server_exe.clone());
}

fn build_status(runtime: &LocalAiRuntime, ready: bool, message: String) -> LocalAiStatus {
    LocalAiStatus {
        ready,
        running: ready || runtime.child.is_some(),
        model_name: runtime.model_name.clone(),
        selected_model_dir: runtime
            .selected_model_dir
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        model_path: runtime
            .model_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        server_path: runtime
            .server_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        server_url: runtime.server_url.clone(),
        vision_enabled: runtime.mmproj_path.is_some(),
        message,
    }
}

fn local_ai_server_url() -> String {
    format!("http://{LOCAL_AI_HOST}:{LOCAL_AI_PORT}")
}

fn build_http_client(timeout_secs: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))
}

async fn probe_local_ai_server(server_url: &str) -> bool {
    let Ok(client) = build_http_client(3) else {
        return false;
    };

    for endpoint in ["/health", "/v1/models"] {
        let url = format!("{server_url}{endpoint}");
        if let Ok(response) = client.get(url).send().await {
            if response.status().is_success() {
                return true;
            }
        }
    }

    false
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let mut out = String::new();
    let mut count = 0usize;
    for ch in value.chars() {
        if count >= max_chars {
            out.push_str("...");
            break;
        }
        out.push(ch);
        count += 1;
    }
    out
}
