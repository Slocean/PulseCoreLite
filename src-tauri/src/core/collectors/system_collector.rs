use std::{
    process::Command,
    time::{Duration, Instant},
};

use chrono::Utc;
use sysinfo::{Components, Disks, Networks, System};

use crate::types::{
    CpuMetrics, DiskMetrics, GpuMetrics, MemoryMetrics, NetworkMetrics, TelemetrySnapshot,
};

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
}

impl SystemCollector {
    pub fn new() -> Self {
        let mut system = System::new_all();
        system.refresh_all();

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
            last_gpu_poll: Instant::now() - Duration::from_secs(10),
        }
    }

    pub fn collect(&mut self) -> TelemetrySnapshot {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.networks.refresh(true);
        self.disks.refresh(true);
        self.components.refresh(true);

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

$engine = Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue
if ($engine) {
  $samples = $engine.CounterSamples |
    Where-Object { $_.Path -like '*engtype_3D*' -or $_.Path -like '*engtype_Compute*' } |
    ForEach-Object { [double]$_.CookedValue }
  if ($samples.Count -eq 0) {
    $samples = $engine.CounterSamples | ForEach-Object { [double]$_.CookedValue }
  }
  if ($samples.Count -gt 0) {
    $usage = ($samples | Measure-Object -Sum).Sum
  }
}

$freqCounter = Get-Counter '\GPU Engine(*)\Frequency' -ErrorAction SilentlyContinue
if ($freqCounter) {
  $freqSamples = $freqCounter.CounterSamples | ForEach-Object { [double]$_.CookedValue }
  if ($freqSamples.Count -gt 0) {
    $freqMhz = ($freqSamples | Measure-Object -Average).Average
  }
}

$adapterMemory = Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue
if ($adapterMemory) {
  $totalBytes = ($adapterMemory.CounterSamples | ForEach-Object { [double]$_.CookedValue } | Measure-Object -Sum).Sum
  if ($totalBytes -gt 0) {
    $memUsedMb = $totalBytes / 1MB
  }
}

$adapterMemoryLimit = Get-Counter '\GPU Adapter Memory(*)\Dedicated Limit' -ErrorAction SilentlyContinue
if ($adapterMemoryLimit) {
  $limitBytes = ($adapterMemoryLimit.CounterSamples | ForEach-Object { [double]$_.CookedValue } | Measure-Object -Sum).Sum
  if ($limitBytes -gt 0) {
    $memTotalMb = $limitBytes / 1MB
  }
}

if ($memTotalMb -eq $null) {
  $videoController = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.AdapterRAM -gt 0 }
  if ($videoController) {
    $adapterRam = ($videoController | Measure-Object -Property AdapterRAM -Sum).Sum
    if ($adapterRam -gt 0) {
      $memTotalMb = $adapterRam / 1MB
    }
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
    let memory_used_mb = payload.get("memUsedMb").and_then(|v| v.as_f64());
    let memory_total_mb = payload.get("memTotalMb").and_then(|v| v.as_f64());
    let frequency_mhz = payload.get("freqMhz").and_then(|v| v.as_f64());

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
