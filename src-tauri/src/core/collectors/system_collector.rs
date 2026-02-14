use std::{
    process::Command,
    time::{Duration, Instant},
};

use chrono::Utc;
use sysinfo::{Components, Disks, Networks, Pid, ProcessesToUpdate, System};

use crate::types::{
    CpuMetrics, DiskMetrics, GpuMetrics, MemoryMetrics, NetworkMetrics, TelemetrySnapshot,
};

#[cfg(target_os = "windows")]
fn query_gpu_memory_dxgi_windows() -> Option<(f64, f64)> {
    // Perf counters/WMI can be missing or report 4GB-ish truncated values (common for >4GB VRAM).
    // DXGI exposes dedicated video memory as a 64-bit value and works across vendors.
    use windows::core::Interface;
    use windows::Win32::Foundation::{RPC_E_CHANGED_MODE, S_FALSE, S_OK};
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIAdapter1, IDXGIAdapter3, IDXGIFactory1, DXGI_ADAPTER_DESC1,
        DXGI_ADAPTER_FLAG_SOFTWARE, DXGI_ERROR_NOT_FOUND, DXGI_MEMORY_SEGMENT_GROUP_LOCAL,
        DXGI_QUERY_VIDEO_MEMORY_INFO,
    };
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};

    unsafe {
        let mut should_uninit = false;
        let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
        if hr == S_OK || hr == S_FALSE {
            should_uninit = true;
        } else if hr != RPC_E_CHANGED_MODE {
            // If COM is already initialized with a different threading model,
            // we can still use DXGI on the current thread (RPC_E_CHANGED_MODE).
            return None;
        }

        let result = (|| -> Option<(f64, f64)> {
            let factory: IDXGIFactory1 = CreateDXGIFactory1().ok()?;

            let mut best_adapter: Option<(IDXGIAdapter1, DXGI_ADAPTER_DESC1)> = None;
            let mut idx: u32 = 0;
            loop {
                match factory.EnumAdapters1(idx) {
                    Ok(adapter) => {
                        idx += 1;
                        let desc = adapter.GetDesc1().ok()?;
                        // Skip software adapters.
                        if (desc.Flags & (DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32)) != 0 {
                            continue;
                        }

                        let dedicated = desc.DedicatedVideoMemory as u64;
                        if dedicated == 0 {
                            continue;
                        }

                        match &best_adapter {
                            Some((_a, best_desc)) => {
                                if (best_desc.DedicatedVideoMemory as u64) < dedicated {
                                    best_adapter = Some((adapter, desc));
                                }
                            }
                            None => best_adapter = Some((adapter, desc)),
                        }
                    }
                    Err(e) if e.code() == DXGI_ERROR_NOT_FOUND => break,
                    Err(_) => break,
                }
            }

            let (adapter, desc) = best_adapter?;
            let total_mb = (desc.DedicatedVideoMemory as f64) / (1024.0 * 1024.0);

            // Query current local (dedicated) memory usage.
            let adapter3: IDXGIAdapter3 = adapter.cast().ok()?;
            let mut info = DXGI_QUERY_VIDEO_MEMORY_INFO::default();
            adapter3
                .QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut info)
                .ok()?;
            let used_mb = (info.CurrentUsage as f64) / (1024.0 * 1024.0);

            if total_mb.is_finite() && total_mb > 0.0 && used_mb.is_finite() && used_mb >= 0.0 {
                Some((used_mb.min(total_mb), total_mb))
            } else {
                None
            }
        })();

        // Only uninitialize if we successfully initialized COM on this thread.
        if should_uninit {
            CoUninitialize();
        }

        result
    }
}

pub struct SystemCollector {
    system: System,
    networks: Networks,
    disks: Disks,
    components: Components,
    prev_rx: u64,
    prev_tx: u64,
    prev_tick: Instant,
    gpu_cache: GpuMetrics,
    last_gpu_poll: Instant,
    warmup_done: bool,
    current_pid: Pid,
}

impl SystemCollector {
    pub fn new() -> Self {
        let system = System::new_all();
        let current_pid = Pid::from_u32(std::process::id());

        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);

        let disks = Disks::new_with_refreshed_list();
        let components = Components::new_with_refreshed_list();
        let (prev_rx, prev_tx) = Self::network_totals(&networks);

        Self {
            system,
            networks,
            disks,
            components,
            prev_rx,
            prev_tx,
            prev_tick: Instant::now(),
            gpu_cache: GpuMetrics {
                usage_pct: None,
                temperature_c: None,
                memory_used_mb: None,
                memory_total_mb: None,
                frequency_mhz: None,
            },
            last_gpu_poll: Instant::now(),
            warmup_done: false,
            current_pid,
        }
    }

    pub fn collect(&mut self) -> TelemetrySnapshot {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.system
            .refresh_processes(ProcessesToUpdate::Some(&[self.current_pid]), true);
        self.networks.refresh(true);
        self.disks.refresh(true);
        if self.warmup_done {
            self.components.refresh(true);
        } else {
            self.warmup_done = true;
        }

        let cpu_usage = self.system.global_cpu_usage() as f64;
        let frequency = if self.system.cpus().is_empty() {
            None
        } else {
            let total: u64 = self.system.cpus().iter().map(|cpu| cpu.frequency()).sum();
            Some(total / self.system.cpus().len() as u64)
        };

        // Attempt to find CPU temperature
        let mut cpu_temp: Option<f64> = None;
        for component in &self.components {
            let label = component.label().to_lowercase();
            if label.contains("cpu") || label.contains("core") || label.contains("package") {
                if let Some(temp) = component.temperature() {
                    match cpu_temp {
                        Some(current) => {
                            if (temp as f64) > current {
                                cpu_temp = Some(temp as f64);
                            }
                        }
                        None => {
                            cpu_temp = Some(temp as f64);
                        }
                    }
                }
            }
        }

        let memory_total_mb = self.system.total_memory() as f64 / (1024.0 * 1024.0);
        let memory_used_mb = self.system.used_memory() as f64 / (1024.0 * 1024.0);
        let memory_usage_pct = if memory_total_mb > 0.0 {
            memory_used_mb / memory_total_mb * 100.0
        } else {
            0.0
        };

        let mut disks_vec: Vec<DiskMetrics> = Vec::new();
        for disk in self.disks.list() {
            let total = disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let avail = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let used = (total - avail).max(0.0);
            let usage_pct = if total > 0.0 { used / total * 100.0 } else { 0.0 };

            // usage() returns DiskUsage which contains deltas since last refresh
            let usage = disk.usage();
            let read_bytes = usage.read_bytes;
            let written_bytes = usage.written_bytes;

            disks_vec.push(DiskMetrics {
                name: disk.mount_point().to_string_lossy().to_string(),
                label: disk.name().to_string_lossy().to_string(),
                used_gb: used,
                total_gb: total,
                usage_pct,
                read_bytes_per_sec: Some(read_bytes as f64),
                write_bytes_per_sec: Some(written_bytes as f64),
            });
        }

        let (rx_total, tx_total) = Self::network_totals(&self.networks);
        let elapsed = self.prev_tick.elapsed().as_secs_f64().max(0.001);
        let rx_rate = rx_total.saturating_sub(self.prev_rx) as f64 / elapsed;
        let tx_rate = tx_total.saturating_sub(self.prev_tx) as f64 / elapsed;

        self.prev_rx = rx_total;
        self.prev_tx = tx_total;
        self.prev_tick = Instant::now();

        let gpu_metrics = self.refresh_gpu_metrics();
        let process = self.system.process(self.current_pid);
        let app_cpu_usage_pct = process.map(|p| p.cpu_usage() as f64);
        let app_memory_mb = process.map(|p| p.memory() as f64 / (1024.0 * 1024.0));

        TelemetrySnapshot {
            timestamp: Utc::now(),
            cpu: CpuMetrics {
                usage_pct: cpu_usage,
                frequency_mhz: frequency,
                temperature_c: cpu_temp,
            },
            gpu: gpu_metrics,
            memory: MemoryMetrics {
                used_mb: memory_used_mb,
                total_mb: memory_total_mb,
                usage_pct: memory_usage_pct,
            },
            disks: disks_vec,
            network: NetworkMetrics {
                download_bytes_per_sec: rx_rate,
                upload_bytes_per_sec: tx_rate,
                latency_ms: None,
            },
            app_cpu_usage_pct,
            app_memory_mb,
            power_watts: None,
        }
    }

    fn network_totals(networks: &Networks) -> (u64, u64) {
        let mut rx = 0_u64;
        let mut tx = 0_u64;
        for (_name, data) in networks {
            rx = rx.saturating_add(data.total_received());
            tx = tx.saturating_add(data.total_transmitted());
        }
        (rx, tx)
    }

    fn refresh_gpu_metrics(&mut self) -> GpuMetrics {
        if self.last_gpu_poll.elapsed() < Duration::from_secs(2) {
            return self.gpu_cache.clone();
        }

        self.last_gpu_poll = Instant::now();
        if let Some(metrics) = query_gpu_metrics_windows() {
            self.gpu_cache = metrics;
        }

        self.gpu_cache.clone()
    }
}

#[cfg(target_os = "windows")]
fn query_gpu_metrics_windows() -> Option<GpuMetrics> {
    let script = r#"
$usage = $null
$memUsedMb = $null
$memTotalMb = $null
$freqMhz = $null

$usedBy = @{}
$limitBy = @{}
$bestInst = $null
$bestLimit = -1

$adapterUsage = Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue
if ($adapterUsage) {
  foreach ($s in $adapterUsage.CounterSamples) {
    $usedBy[$s.InstanceName] = [double]$s.CookedValue
  }
}

$adapterLimit = Get-Counter '\GPU Adapter Memory(*)\Dedicated Limit' -ErrorAction SilentlyContinue
if ($adapterLimit) {
  foreach ($s in $adapterLimit.CounterSamples) {
    $limitBy[$s.InstanceName] = [double]$s.CookedValue
  }
}

$instances = @()
$instances += $usedBy.Keys
$instances += $limitBy.Keys
$instances = $instances | Sort-Object -Unique

foreach ($inst in $instances) {
  $limit = 0
  if ($limitBy.ContainsKey($inst)) { $limit = $limitBy[$inst] }
  if ($limit -gt $bestLimit) { $bestLimit = $limit; $bestInst = $inst }
}

if (-not $bestInst -and $instances.Count -gt 0) { $bestInst = $instances[0] }

$luid = $null
if ($bestInst -and $bestInst -match '(luid_0x[0-9a-fA-F]+)') { $luid = $Matches[1] }

if ($bestInst) {
  if ($usedBy.ContainsKey($bestInst)) {
    $memUsedMb = $usedBy[$bestInst] / 1MB
  }
  if ($limitBy.ContainsKey($bestInst) -and $limitBy[$bestInst] -gt 0) {
    $memTotalMb = $limitBy[$bestInst] / 1MB
  }
}

if ($memTotalMb -eq $null) {
  $videoController = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Sort-Object -Property AdapterRAM -Descending | Select-Object -First 1
  if ($videoController -and $videoController.AdapterRAM -gt 0) {
    $memTotalMb = $videoController.AdapterRAM / 1MB
  }
}

$engine = Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue
if ($engine) {
  $engineSamples = $engine.CounterSamples
  if ($luid) {
    $engineSamples = $engineSamples | Where-Object { $_.Path -like "*$luid*" }
  }
  $samples = $engineSamples |
    Where-Object { $_.Path -like '*engtype_3D*' -or $_.Path -like '*engtype_Compute*' } |
    ForEach-Object { [double]$_.CookedValue }
  if ($samples.Count -eq 0) {
    $samples = $engineSamples | ForEach-Object { [double]$_.CookedValue }
  }
  if ($samples.Count -gt 0) {
    $usage = ($samples | Measure-Object -Maximum).Maximum
  }
}

$freqCounter = Get-Counter '\GPU Engine(*)\Frequency' -ErrorAction SilentlyContinue
if ($freqCounter) {
  $freqSamples = $freqCounter.CounterSamples
  if ($luid) {
    $freqSamples = $freqSamples | Where-Object { $_.Path -like "*$luid*" }
  }
  $values = $freqSamples | ForEach-Object { [double]$_.CookedValue } | Where-Object { $_ -gt 0 }
  if ($values.Count -gt 0) {
    $freqMhz = ($values | Measure-Object -Maximum).Maximum
  }
}

if ($usage -ne $null) {
  $usage = [Math]::Min([Math]::Max([double]$usage, 0), 100)
}

[PSCustomObject]@{
  usage = $usage
  memUsedMb = $memUsedMb
  memTotalMb = $memTotalMb
  freqMhz = $freqMhz
} | ConvertTo-Json -Compress
"#;

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return None;
    }

    let payload: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let usage_pct = payload.get("usage").and_then(|v| v.as_f64());
    let mut memory_used_mb = payload.get("memUsedMb").and_then(|v| v.as_f64());
    let mut memory_total_mb = payload.get("memTotalMb").and_then(|v| v.as_f64());
    let frequency_mhz = payload.get("freqMhz").and_then(|v| v.as_f64());

    if let Some((used_mb, total_mb)) = query_gpu_memory_dxgi_windows() {
        memory_used_mb = Some(used_mb);
        memory_total_mb = Some(total_mb);
    }

    // Avoid nonsensical UI (e.g. summing multiple adapters or driver quirks).
    if let (Some(used), Some(total)) = (memory_used_mb, memory_total_mb) {
        if total > 0.0 && used > total {
            memory_used_mb = Some(total);
        }
    }

    Some(GpuMetrics {
        usage_pct,
        temperature_c: None,
        memory_used_mb,
        memory_total_mb,
        frequency_mhz,
    })
}

#[cfg(not(target_os = "windows"))]
fn query_gpu_metrics_windows() -> Option<GpuMetrics> {
    None
}
