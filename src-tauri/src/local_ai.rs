use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::Duration,
};

use reqwest::Client;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};
use tokio::time::sleep;

use crate::{
    state::SharedState,
    types::{
        LocalAiAttachment, LocalAiChatRequest, LocalAiChatResponse, LocalAiStatus,
        LocalAiStreamEvent, LocalAiTokenUsage,
    },
};

const LOCAL_AI_HOST: &str = "127.0.0.1";
const LOCAL_AI_PORT: u16 = 39391;
const LOCAL_AI_STARTUP_RETRIES: usize = 80;
const LOCAL_AI_STARTUP_DELAY_MS: u64 = 500;
const LOCAL_AI_CHAT_TIMEOUT_SECS: u64 = 180;
const LOCAL_AI_MAX_TOKENS_STANDARD: u64 = 1024;
const LOCAL_AI_MAX_TOKENS_RETRY: u64 = 1536;
const LOCAL_AI_STREAM_EVENT: &str = "local-ai://stream";

pub struct LocalAiRuntime {
    child: Option<Child>,
    server_url: String,
    model_name: String,
    launch_mode: String,
    selected_model_dir: Option<PathBuf>,
    selected_launcher_dir: Option<PathBuf>,
    model_path: Option<PathBuf>,
    mmproj_path: Option<PathBuf>,
    server_path: Option<PathBuf>,
    launcher_needs_selection: bool,
    last_error: Option<String>,
}

impl Default for LocalAiRuntime {
    fn default() -> Self {
        Self {
            child: None,
            server_url: local_ai_server_url(),
            model_name: String::new(),
            launch_mode: "unknown".to_string(),
            selected_model_dir: None,
            selected_launcher_dir: None,
            model_path: None,
            mmproj_path: None,
            server_path: None,
            launcher_needs_selection: false,
            last_error: None,
        }
    }
}

struct LocalAiLauncherAssets {
    server_dir: PathBuf,
    server_exe: PathBuf,
    launch_mode: String,
    selected_launcher_dir: Option<PathBuf>,
    launcher_needs_selection: bool,
}

struct LocalAiAssets {
    server_dir: PathBuf,
    server_exe: PathBuf,
    launch_mode: String,
    selected_launcher_dir: Option<PathBuf>,
    launcher_needs_selection: bool,
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
    launcher_dir: Option<String>,
) -> Result<LocalAiStatus, String> {
    start_local_ai_runtime_internal(&app, state.inner(), model_dir, launcher_dir).await
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
    window: WebviewWindow,
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
    let request_id = request
        .request_id
        .clone()
        .unwrap_or_else(|| "local-ai-stream".to_string());
    let enable_thinking = request.enable_thinking.unwrap_or(false);
    let first_attempt = send_local_ai_request_stream(
        &client,
        &window,
        &endpoint,
        &request,
        &request_id,
        !enable_thinking,
        if enable_thinking {
            LOCAL_AI_MAX_TOKENS_RETRY
        } else {
            LOCAL_AI_MAX_TOKENS_STANDARD
        },
    )
    .await?;
    let final_attempt = if should_retry_without_thinking(enable_thinking, &first_attempt) {
        let retry_attempt = send_local_ai_request_stream(
            &client,
            &window,
            &endpoint,
            &request,
            &request_id,
            true,
            LOCAL_AI_MAX_TOKENS_STANDARD,
        )
        .await?;
        LocalAiParsedResponse {
            reply: retry_attempt.reply,
            reasoning: retry_attempt.reasoning.or(first_attempt.reasoning),
            finish_reason: retry_attempt.finish_reason,
            model: retry_attempt.model.or(first_attempt.model),
            usage: retry_attempt.usage.or(first_attempt.usage),
            body: retry_attempt.body,
        }
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
        reasoning: final_attempt.reasoning,
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
    let (configured_model_dir, configured_launcher_dir) = {
        let runtime = state.local_ai_runtime.lock().await;
        (
            runtime.selected_model_dir.clone(),
            runtime.selected_launcher_dir.clone(),
        )
    };

    let launcher_assets = resolve_local_ai_launcher(app, configured_launcher_dir.clone());
    let assets = configured_model_dir
        .clone()
        .and_then(|path| resolve_local_ai_assets(app, Some(path), configured_launcher_dir).ok());
    let mut runtime = state.local_ai_runtime.lock().await;

    if let Some(assets) = assets {
        apply_runtime_assets(&mut runtime, &assets);
    } else if configured_model_dir.is_some() {
        runtime.model_name.clear();
        runtime.model_path = None;
        runtime.mmproj_path = None;
    }
    apply_runtime_launcher_state(&mut runtime, launcher_assets);
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
    launcher_dir: Option<String>,
) -> Result<LocalAiStatus, String> {
    let use_default_launcher = launcher_dir
        .as_deref()
        .map(str::trim)
        .is_some_and(str::is_empty);
    let requested_launcher_dir = launcher_dir.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    });
    let (existing_model_dir, existing_launcher_dir) = {
        let runtime = state.local_ai_runtime.lock().await;
        (
            runtime.selected_model_dir.clone(),
            runtime.selected_launcher_dir.clone(),
        )
    };
    let chosen_dir = model_dir
        .map(PathBuf::from)
        .or(existing_model_dir)
        .ok_or_else(|| {
            "No model directory is configured. Please choose a folder first.".to_string()
        })?;
    let chosen_launcher_dir = if use_default_launcher {
        None
    } else if requested_launcher_dir.is_some() {
        requested_launcher_dir
    } else {
        existing_launcher_dir
    };
    let assets = resolve_local_ai_assets(app, Some(chosen_dir), chosen_launcher_dir)?;
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

fn should_retry_without_thinking(enable_thinking: bool, response: &LocalAiParsedResponse) -> bool {
    enable_thinking
        && response.reply.is_none()
        && response.reasoning.is_some()
        && matches!(response.finish_reason.as_deref(), Some("length"))
}

async fn send_local_ai_request_stream(
    client: &Client,
    window: &WebviewWindow,
    endpoint: &str,
    request: &LocalAiChatRequest,
    request_id: &str,
    disable_thinking: bool,
    max_tokens: u64,
) -> Result<LocalAiParsedResponse, String> {
    let payload = build_chat_payload(request, disable_thinking, max_tokens);

    let mut response = client
        .post(endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("failed to call local AI server: {err}"))?;

    let status_code = response.status();
    if !status_code.is_success() {
        let body = response
            .text()
            .await
            .map_err(|err| format!("failed to read local AI response: {err}"))?;
        return Err(format!(
            "local AI server returned HTTP {}: {}",
            status_code.as_u16(),
            truncate_text(&body, 400)
        ));
    }

    let mut body = String::new();
    let mut stream_buffer = Vec::new();
    let mut reply = String::new();
    let mut reasoning = String::new();
    let mut finish_reason = None;
    let mut model = None;
    let mut usage = None;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|err| format!("failed to read local AI stream: {err}"))?
    {
        body.push_str(&String::from_utf8_lossy(&chunk));
        stream_buffer.extend_from_slice(&chunk);

        while let Some((separator_index, separator_len)) = find_sse_event_separator(&stream_buffer)
        {
            let event_bytes = stream_buffer[..separator_index].to_vec();
            stream_buffer.drain(..separator_index + separator_len);
            process_stream_event(
                window,
                request_id,
                &event_bytes,
                &mut reply,
                &mut reasoning,
                &mut finish_reason,
                &mut model,
                &mut usage,
            )?;
        }
    }

    if !stream_buffer.is_empty() {
        process_stream_event(
            window,
            request_id,
            &stream_buffer,
            &mut reply,
            &mut reasoning,
            &mut finish_reason,
            &mut model,
            &mut usage,
        )?;
    }

    Ok(LocalAiParsedResponse {
        reply: normalize_text(&reply),
        reasoning: normalize_text(&reasoning),
        finish_reason,
        model,
        usage,
        body,
    })
}

fn process_stream_event(
    window: &WebviewWindow,
    request_id: &str,
    event_bytes: &[u8],
    reply: &mut String,
    reasoning: &mut String,
    finish_reason: &mut Option<String>,
    model: &mut Option<String>,
    usage: &mut Option<LocalAiTokenUsage>,
) -> Result<(), String> {
    let Some(payload) = extract_sse_payload(event_bytes) else {
        return Ok(());
    };
    if payload == "[DONE]" {
        return Ok(());
    }

    let value: Value = serde_json::from_str(&payload)
        .map_err(|err| format!("failed to parse local AI stream JSON: {err}"))?;

    if model.is_none() {
        *model = value
            .get("model")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
    }

    if let Some(next_usage) = extract_usage(&value) {
        *usage = Some(next_usage);
    }

    if let Some(next_finish_reason) = value
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("finish_reason"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
    {
        *finish_reason = Some(next_finish_reason);
    }

    if let Some(reasoning_delta) = extract_reasoning_delta(&value) {
        reasoning.push_str(&reasoning_delta);
        emit_local_ai_stream_event(window, request_id, "reasoning", &reasoning_delta);
    }

    if let Some(reply_delta) = extract_reply_delta(&value) {
        reply.push_str(&reply_delta);
        emit_local_ai_stream_event(window, request_id, "reply", &reply_delta);
    }

    Ok(())
}

fn find_sse_event_separator(buffer: &[u8]) -> Option<(usize, usize)> {
    let lf = buffer.windows(2).position(|window| window == b"\n\n");
    let crlf = buffer.windows(4).position(|window| window == b"\r\n\r\n");
    let cr = buffer.windows(2).position(|window| window == b"\r\r");

    [
        lf.map(|index| (index, 2)),
        crlf.map(|index| (index, 4)),
        cr.map(|index| (index, 2)),
    ]
    .into_iter()
    .flatten()
    .min_by_key(|(index, _)| *index)
}

fn extract_sse_payload(event_bytes: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(event_bytes);
    let payload = text
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            trimmed
                .strip_prefix("data:")
                .map(|value| value.trim_start().to_string())
        })
        .collect::<Vec<_>>()
        .join("\n");

    normalize_text(&payload)
}

fn emit_local_ai_stream_event(
    window: &WebviewWindow,
    request_id: &str,
    channel: &str,
    delta: &str,
) {
    if delta.is_empty() {
        return;
    }

    if let Err(error) = window.emit(
        LOCAL_AI_STREAM_EVENT,
        LocalAiStreamEvent {
            request_id: request_id.to_string(),
            channel: channel.to_string(),
            delta: delta.to_string(),
        },
    ) {
        tracing::warn!("failed to emit local AI stream event: {error}");
    }
}

fn extract_reasoning_delta(value: &Value) -> Option<String> {
    let choice = value.get("choices")?.get(0)?;

    for scope in [choice.get("delta"), choice.get("message"), Some(choice)] {
        let Some(scope) = scope else {
            continue;
        };
        for field in ["reasoning_content", "reasoning"] {
            if let Some(text) = extract_stream_text_field(scope.get(field)) {
                return Some(text);
            }
        }
    }

    None
}

fn extract_reply_delta(value: &Value) -> Option<String> {
    let choice = value.get("choices")?.get(0)?;

    for scope in [choice.get("delta"), choice.get("message"), Some(choice)] {
        let Some(scope) = scope else {
            continue;
        };
        for field in ["content", "output_text", "text", "refusal"] {
            if let Some(text) = extract_stream_text_field(scope.get(field)) {
                return Some(text);
            }
        }
    }

    None
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

    let user_prompt = build_user_prompt_text(request.prompt.trim(), &request.attachments);
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
        "stream": true,
        "temperature": 0.5,
        "top_p": 0.9,
        "max_tokens": max_tokens
    })
}

fn build_user_prompt_text(prompt: &str, attachments: &[LocalAiAttachment]) -> String {
    let mut sections = Vec::new();
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

fn extract_stream_text_field(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::Null => None,
        Value::String(text) => normalize_stream_text(text),
        Value::Number(number) => normalize_stream_text(&number.to_string()),
        Value::Bool(boolean) => normalize_stream_text(if *boolean { "true" } else { "false" }),
        Value::Array(items) => {
            let mut segments = Vec::new();
            for item in items {
                if let Some(text) = extract_stream_text_field(Some(item)) {
                    segments.push(text);
                    continue;
                }

                if let Some(text) = item
                    .get("text")
                    .and_then(Value::as_str)
                    .and_then(normalize_stream_text)
                {
                    segments.push(text);
                    continue;
                }

                if let Some(text) = item
                    .get("content")
                    .and_then(Value::as_str)
                    .and_then(normalize_stream_text)
                {
                    segments.push(text);
                }
            }

            if segments.is_empty() {
                None
            } else {
                Some(segments.join(""))
            }
        }
        Value::Object(map) => {
            for key in ["text", "content", "output_text"] {
                if let Some(text) = extract_stream_text_field(map.get(key)) {
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

fn normalize_stream_text(text: &str) -> Option<String> {
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
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
    launcher_dir_override: Option<PathBuf>,
) -> Result<LocalAiAssets, String> {
    let launcher = resolve_local_ai_launcher(app, launcher_dir_override)?;
    let llm_dir = model_dir_override.ok_or_else(|| {
        "No model directory is configured. Please choose a folder that contains .gguf files."
            .to_string()
    })?;

    let model_path = select_main_model(&llm_dir)?;
    let mmproj_path = select_mmproj_model(&llm_dir);
    let model_name = model_path
        .file_stem()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "bundled-local-model".to_string());

    Ok(LocalAiAssets {
        server_dir: launcher.server_dir,
        server_exe: launcher.server_exe,
        launch_mode: launcher.launch_mode,
        selected_launcher_dir: launcher.selected_launcher_dir,
        launcher_needs_selection: launcher.launcher_needs_selection,
        model_dir: llm_dir,
        model_path,
        mmproj_path,
        model_name,
    })
}

fn resolve_local_ai_launcher(
    app: &AppHandle,
    launcher_dir_override: Option<PathBuf>,
) -> Result<LocalAiLauncherAssets, String> {
    if let Some(launcher_dir) = launcher_dir_override {
        let server_exe = launcher_dir.join("llama-server.exe");
        if server_exe.is_file() {
            return Ok(LocalAiLauncherAssets {
                server_dir: launcher_dir.clone(),
                server_exe,
                launch_mode: detect_launch_mode(&launcher_dir),
                selected_launcher_dir: Some(launcher_dir),
                launcher_needs_selection: true,
            });
        }
        return Err(format!(
            "Failed to find llama-server.exe in the selected launcher directory: {}",
            launcher_dir.display()
        ));
    }

    let roots = local_ai_search_roots(app);

    for root in &roots {
        for candidate in bundled_launcher_candidates(root) {
            let server_exe = candidate.join("llama-server.exe");
            if server_exe.is_file() {
                return Ok(LocalAiLauncherAssets {
                    launch_mode: detect_launch_mode(&candidate),
                    server_dir: candidate,
                    server_exe,
                    selected_launcher_dir: None,
                    launcher_needs_selection: false,
                });
            }
        }
    }

    for root in &roots {
        if let Some(candidate) = find_nested_launcher_dir(root, 6) {
            let server_exe = candidate.join("llama-server.exe");
            let launch_mode = detect_launch_mode(&candidate);
            return Ok(LocalAiLauncherAssets {
                server_dir: candidate,
                server_exe,
                launch_mode,
                selected_launcher_dir: None,
                launcher_needs_selection: false,
            });
        }
    }

    Err(format!(
        "Failed to find bundled llama-server.exe. Searched in: {}",
        display_search_roots(&roots)
    ))
}

pub(crate) fn has_bundled_local_ai_launcher(app: &AppHandle) -> bool {
    let roots = local_ai_search_roots(app);
    roots.iter().any(|root| {
        bundled_launcher_candidates(root)
            .into_iter()
            .any(|candidate| candidate.join("llama-server.exe").is_file())
    })
}

fn bundled_launcher_candidates(root: &Path) -> Vec<PathBuf> {
    [
        "llama_CPU_X64",
        "llama_GPU_CUDA12",
        "llama_GPU_CUDA13",
        "llama_GPU_CUDA13_1",
    ]
    .into_iter()
    .flat_map(|dir_name| {
        [
            root.join(dir_name),
            root.join("build-assets").join(dir_name),
        ]
    })
    .collect()
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

fn detect_launch_mode(path: &Path) -> String {
    let normalized = path.to_string_lossy().to_ascii_lowercase();
    if normalized.contains("cuda") || normalized.contains("gpu") {
        "gpu".to_string()
    } else if normalized.contains("cpu") {
        "cpu".to_string()
    } else {
        "unknown".to_string()
    }
}

fn find_nested_launcher_dir(root: &Path, max_depth: usize) -> Option<PathBuf> {
    if !root.is_dir() {
        return None;
    }

    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if dir.join("llama-server.exe").is_file()
            && dir
                .file_name()
                .and_then(|value| value.to_str())
                .map(|name| name.to_ascii_lowercase().contains("llama"))
                .unwrap_or(false)
        {
            return Some(dir);
        }

        if depth >= max_depth {
            continue;
        }

        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.is_dir() {
                stack.push((path, depth + 1));
            }
        }
    }

    None
}

fn local_ai_search_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let mut seen = BTreeSet::new();
    let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));

    for candidate in [
        exe_dir.clone(),
        exe_dir.map(|path| path.join("build-assets")),
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
    let gpu_layers = if assets.launch_mode == "gpu" {
        "999"
    } else {
        "0"
    };
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
        .arg("--threads")
        .arg(recommended_thread_count().to_string())
        .arg("--n-gpu-layers")
        .arg(gpu_layers)
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
    runtime.launch_mode = assets.launch_mode.clone();
    runtime.selected_model_dir = Some(assets.model_dir.clone());
    runtime.selected_launcher_dir = assets.selected_launcher_dir.clone();
    runtime.model_path = Some(assets.model_path.clone());
    runtime.mmproj_path = assets.mmproj_path.clone();
    runtime.server_path = Some(assets.server_exe.clone());
    runtime.launcher_needs_selection = assets.launcher_needs_selection;
}

fn apply_runtime_launcher_state(
    runtime: &mut LocalAiRuntime,
    launcher_assets: Result<LocalAiLauncherAssets, String>,
) {
    match launcher_assets {
        Ok(launcher) => {
            runtime.launch_mode = launcher.launch_mode;
            runtime.selected_launcher_dir = launcher.selected_launcher_dir;
            runtime.server_path = Some(launcher.server_exe);
            runtime.launcher_needs_selection = launcher.launcher_needs_selection;
        }
        Err(_) => {
            runtime.launch_mode = "unknown".to_string();
            runtime.server_path = None;
            runtime.launcher_needs_selection = true;
        }
    }
}

fn build_status(runtime: &LocalAiRuntime, ready: bool, message: String) -> LocalAiStatus {
    LocalAiStatus {
        ready,
        running: ready || runtime.child.is_some(),
        model_name: runtime.model_name.clone(),
        launch_mode: runtime.launch_mode.clone(),
        selected_model_dir: runtime
            .selected_model_dir
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        selected_launcher_dir: runtime
            .selected_launcher_dir
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
        launcher_needs_selection: runtime.launcher_needs_selection,
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
