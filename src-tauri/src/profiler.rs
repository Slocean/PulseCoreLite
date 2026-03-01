use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::{AppHandle, Manager};
use tokio::{
    fs::OpenOptions,
    io::{AsyncWriteExt, BufWriter},
    sync::watch,
};
use tauri::async_runtime::JoinHandle;

use crate::state::SharedState;

#[derive(Debug, Serialize, Clone)]
pub struct ProfileStatus {
    pub active: bool,
    pub path: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<DateTime<Utc>>,
    pub samples: u64,
}

#[derive(Debug, Serialize)]
struct ProcessSample {
    pid: u32,
    name: String,
    #[serde(rename = "parentPid")]
    parent_pid: Option<u32>,
    #[serde(rename = "memoryMb")]
    memory_mb: f64,
    #[serde(rename = "cpuPct")]
    cpu_pct: f64,
    kind: String,
}

#[derive(Debug, Serialize)]
struct WindowSample {
    label: String,
    visible: bool,
}

#[derive(Debug, Serialize)]
struct ProfileSample {
    timestamp: DateTime<Utc>,
    #[serde(rename = "appPid")]
    app_pid: u32,
    #[serde(rename = "refreshRateMs")]
    refresh_rate_ms: u64,
    snapshot: crate::types::TelemetrySnapshot,
    processes: Vec<ProcessSample>,
    windows: Vec<WindowSample>,
}

pub struct ProfilerHandle {
    stop: watch::Sender<bool>,
    started_at: DateTime<Utc>,
    path: PathBuf,
    samples: Arc<AtomicU64>,
    task: JoinHandle<()>,
}

impl ProfilerHandle {
    pub fn status(&self) -> ProfileStatus {
        ProfileStatus {
            active: true,
            path: Some(self.path.to_string_lossy().to_string()),
            started_at: Some(self.started_at),
            samples: self.samples.load(Ordering::Relaxed),
        }
    }

    pub async fn stop(self) {
        let _ = self.stop.send(true);
        let _ = self.task.await;
    }
}

pub fn resolve_profile_path(base_dir: &PathBuf, path: &str) -> PathBuf {
    let candidate = PathBuf::from(path);
    let resolved = if candidate.is_absolute() {
        candidate
    } else {
        base_dir.join(candidate)
    };

    if resolved.extension().is_some() {
        return resolved;
    }

    let filename = format!("profile-{}.jsonl", Utc::now().format("%Y%m%d-%H%M%S"));
    resolved.join(filename)
}

pub async fn start_profile_capture(
    app: AppHandle,
    state: SharedState,
    path: PathBuf,
    interval_ms: u64,
    duration_ms: Option<u64>,
) -> Result<ProfilerHandle, String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .await
        .map_err(|e| e.to_string())?;

    let (stop_tx, stop_rx) = watch::channel(false);
    let samples = Arc::new(AtomicU64::new(0));
    let samples_task = Arc::clone(&samples);
    let started_at = Utc::now();
    let interval_ms = interval_ms.clamp(200, 10_000);
    let duration = duration_ms.map(|value| Duration::from_millis(value.max(200)));
    let path_clone = path.clone();

    let task = tauri::async_runtime::spawn(async move {
        let mut writer = BufWriter::new(file);
        let mut system = System::new_all();
        let app_pid = Pid::from_u32(std::process::id());
        let mut ticker = tokio::time::interval(Duration::from_millis(interval_ms));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let start = Instant::now();

        loop {
            ticker.tick().await;
            if *stop_rx.borrow() {
                break;
            }
            if let Some(max_duration) = duration {
                if start.elapsed() >= max_duration {
                    break;
                }
            }

            system.refresh_processes(ProcessesToUpdate::All, true);
            let processes = collect_process_samples(&system, app_pid);
            let snapshot = state.latest_snapshot.read().await.clone();
            let refresh_rate_ms = state
                .refresh_rate_ms
                .load(std::sync::atomic::Ordering::Relaxed)
                .max(10);

            let windows = collect_window_samples(&app);
            let sample = ProfileSample {
                timestamp: Utc::now(),
                app_pid: app_pid.as_u32(),
                refresh_rate_ms,
                snapshot,
                processes,
                windows,
            };

            match serde_json::to_string(&sample) {
                Ok(line) => {
                    if writer.write_all(line.as_bytes()).await.is_ok() {
                        let _ = writer.write_all(b"\n").await;
                        let _ = writer.flush().await;
                        samples_task.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(err) => {
                    tracing::warn!("profile capture serialize failed: {err}");
                }
            }
        }

        let _ = writer.flush().await;
        tracing::info!(
            "profile capture stopped: {} samples -> {}",
            samples_task.load(Ordering::Relaxed),
            path_clone.to_string_lossy()
        );
    });

    Ok(ProfilerHandle {
        stop: stop_tx,
        started_at,
        path,
        samples,
        task,
    })
}

fn collect_window_samples(app: &AppHandle) -> Vec<WindowSample> {
    let mut samples = Vec::with_capacity(3);
    for label in ["main", "taskbar", "toolkit"] {
        if let Some(win) = app.get_webview_window(label) {
            let visible = win.is_visible().unwrap_or(false);
            samples.push(WindowSample {
                label: label.to_string(),
                visible,
            });
        }
    }
    samples
}

fn collect_process_samples(system: &System, root_pid: Pid) -> Vec<ProcessSample> {
    let mut children_map: HashMap<Pid, Vec<Pid>> = HashMap::new();
    let mut parent_map: HashMap<Pid, Pid> = HashMap::new();
    for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
            children_map.entry(parent).or_default().push(*pid);
            parent_map.insert(*pid, parent);
        }
    }

    let mut queue = VecDeque::new();
    let mut seen = HashMap::new();
    queue.push_back(root_pid);
    while let Some(pid) = queue.pop_front() {
        if seen.insert(pid, ()).is_some() {
            continue;
        }
        if let Some(children) = children_map.get(&pid) {
            for child in children {
                queue.push_back(*child);
            }
        }
    }

    let mut samples = Vec::new();
    for pid in seen.keys() {
        if let Some(process) = system.process(*pid) {
            let name = process.name().to_string_lossy().to_string();
            // sysinfo on Windows reports process memory in bytes; normalize to MB.
            let memory_mb = process.memory() as f64 / 1024.0 / 1024.0;
            let cpu_pct = process.cpu_usage() as f64;
            let parent_pid = parent_map.get(pid).map(|p| p.as_u32());
            samples.push(ProcessSample {
                pid: pid.as_u32(),
                name: name.clone(),
                parent_pid,
                memory_mb,
                cpu_pct,
                kind: classify_process(&name),
            });
        }
    }
    samples.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
    samples
}

fn classify_process(name: &str) -> String {
    let lower = name.to_lowercase();
    if lower.contains("msedgewebview2") {
        "webview".to_string()
    } else if lower.contains("pulsecore") {
        "app".to_string()
    } else {
        "child".to_string()
    }
}

pub fn ensure_profile_path(app: &AppHandle, path: &str) -> PathBuf {
    // Resolve relative paths into app data to avoid dev hot-reload watching project folders.
    let base_dir = app
        .path()
        .app_data_dir()
        .or_else(|_| std::env::current_dir())
        .unwrap_or_else(|_| PathBuf::from("."));

    if path.trim().is_empty() {
        return resolve_profile_path(&base_dir, "profile-data");
    }

    resolve_profile_path(&base_dir, path)
}
