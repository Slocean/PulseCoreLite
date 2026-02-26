use std::{
    collections::{HashMap, HashSet},
    process::Command,
    time::{Duration, Instant},
};

use chrono::Utc;
use sysinfo::{Components, Disks, Networks, Pid, ProcessesToUpdate, System};

use crate::types::{
    CpuMetrics, DiskMetrics, GpuMetrics, MemoryMetrics, NetworkMetrics, TelemetrySnapshot,
};

#[cfg(target_os = "windows")]
struct WindowsCpuFrequencyQuery {
    query: windows::Win32::System::Performance::PDH_HQUERY,
    counter: windows::Win32::System::Performance::PDH_HCOUNTER,
}

#[cfg(target_os = "windows")]
unsafe impl Send for WindowsCpuFrequencyQuery {}

#[cfg(target_os = "windows")]
struct WindowsCpuUsageQuery {
    query: windows::Win32::System::Performance::PDH_HQUERY,
    utility_counter: Option<windows::Win32::System::Performance::PDH_HCOUNTER>,
    time_counter: Option<windows::Win32::System::Performance::PDH_HCOUNTER>,
}

#[cfg(target_os = "windows")]
unsafe impl Send for WindowsCpuUsageQuery {}

#[cfg(target_os = "windows")]
impl WindowsCpuUsageQuery {
    fn new() -> Option<Self> {
        use windows::core::{s, PCSTR};
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Performance::{
            PdhAddEnglishCounterA, PdhCloseQuery, PdhCollectQueryData, PdhOpenQueryA,
        };

        unsafe {
            let mut query = windows::Win32::System::Performance::PDH_HQUERY::default();
            if PdhOpenQueryA(PCSTR::null(), 0, &mut query) != ERROR_SUCCESS.0 {
                return None;
            }

            // Keep both counters: Processor Time is used as primary to avoid overly
            // aggressive boosting, Utility remains as fallback on unsupported systems.
            let mut utility_counter = windows::Win32::System::Performance::PDH_HCOUNTER::default();
            let utility_status = PdhAddEnglishCounterA(
                query,
                s!("\\Processor Information(_Total)\\% Processor Utility"),
                0,
                &mut utility_counter,
            );

            let mut time_counter = windows::Win32::System::Performance::PDH_HCOUNTER::default();
            let time_status = PdhAddEnglishCounterA(
                query,
                s!("\\Processor(_Total)\\% Processor Time"),
                0,
                &mut time_counter,
            );

            let utility_counter = (utility_status == ERROR_SUCCESS.0).then_some(utility_counter);
            let time_counter = (time_status == ERROR_SUCCESS.0).then_some(time_counter);

            if utility_counter.is_none() && time_counter.is_none() {
                let _ = PdhCloseQuery(query);
                return None;
            }

            let _ = PdhCollectQueryData(query);
            Some(Self {
                query,
                utility_counter,
                time_counter,
            })
        }
    }

    fn sample_pct(&mut self) -> Option<f64> {
        use std::mem::MaybeUninit;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Performance::{
            PdhCollectQueryData, PdhGetFormattedCounterValue, PDH_FMT_COUNTERVALUE, PDH_FMT_DOUBLE,
        };

        unsafe {
            if PdhCollectQueryData(self.query) != ERROR_SUCCESS.0 {
                return None;
            }

            let mut read_counter = |counter: windows::Win32::System::Performance::PDH_HCOUNTER| {
                let mut display_value = MaybeUninit::<PDH_FMT_COUNTERVALUE>::uninit();
                if PdhGetFormattedCounterValue(
                    counter,
                    PDH_FMT_DOUBLE,
                    None,
                    display_value.as_mut_ptr(),
                ) != ERROR_SUCCESS.0
                {
                    return None;
                }

                let value = display_value.assume_init().Anonymous.doubleValue;
                if value.is_finite() && value >= 0.0 {
                    Some(value.clamp(0.0, 100.0))
                } else {
                    None
                }
            };

            let utility = self.utility_counter.and_then(&mut read_counter);
            let time = self.time_counter.and_then(&mut read_counter);

            time.or(utility)
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsCpuUsageQuery {
    fn drop(&mut self) {
        use windows::Win32::System::Performance::{PdhCloseQuery, PdhRemoveCounter};

        unsafe {
            if let Some(counter) = self.utility_counter {
                let _ = PdhRemoveCounter(counter);
            }
            if let Some(counter) = self.time_counter {
                let _ = PdhRemoveCounter(counter);
            }
            let _ = PdhCloseQuery(self.query);
        }
    }
}

#[cfg(target_os = "windows")]
impl WindowsCpuFrequencyQuery {
    fn new() -> Option<Self> {
        use windows::core::{s, PCSTR};
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Performance::{
            PdhAddEnglishCounterA, PdhCloseQuery, PdhCollectQueryData, PdhOpenQueryA,
        };

        unsafe {
            let mut query = windows::Win32::System::Performance::PDH_HQUERY::default();
            if PdhOpenQueryA(PCSTR::null(), 0, &mut query) != ERROR_SUCCESS.0 {
                return None;
            }

            let mut counter = windows::Win32::System::Performance::PDH_HCOUNTER::default();
            if PdhAddEnglishCounterA(
                query,
                s!("\\Processor Information(_Total)\\Processor Frequency"),
                0,
                &mut counter,
            ) != ERROR_SUCCESS.0
            {
                let _ = PdhCloseQuery(query);
                return None;
            }

            // Prime the query so the first read is more likely to return valid data.
            let _ = PdhCollectQueryData(query);

            Some(Self { query, counter })
        }
    }

    fn sample_mhz(&mut self) -> Option<u64> {
        use std::mem::MaybeUninit;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Performance::{
            PdhCollectQueryData, PdhGetFormattedCounterValue, PDH_FMT_COUNTERVALUE, PDH_FMT_DOUBLE,
        };

        unsafe {
            if PdhCollectQueryData(self.query) != ERROR_SUCCESS.0 {
                return None;
            }

            let mut display_value = MaybeUninit::<PDH_FMT_COUNTERVALUE>::uninit();
            if PdhGetFormattedCounterValue(
                self.counter,
                PDH_FMT_DOUBLE,
                None,
                display_value.as_mut_ptr(),
            ) != ERROR_SUCCESS.0
            {
                return None;
            }

            let display_value = display_value.assume_init();
            let mhz = display_value.Anonymous.doubleValue;
            if mhz.is_finite() && mhz > 0.0 {
                Some(mhz.round() as u64)
            } else {
                None
            }
        }
    }
}

#[cfg(target_os = "windows")]
impl Drop for WindowsCpuFrequencyQuery {
    fn drop(&mut self) {
        use windows::Win32::System::Performance::{PdhCloseQuery, PdhRemoveCounter};

        unsafe {
            let _ = PdhRemoveCounter(self.counter);
            let _ = PdhCloseQuery(self.query);
        }
    }
}

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
    #[cfg(not(target_os = "windows"))]
    app_usage_system: System,
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
    app_usage_cache: (Option<f64>, Option<f64>),
    last_app_usage_poll: Instant,
    app_usage_started_at: Instant,
    #[cfg(target_os = "windows")]
    app_process_cpu_prev_by_pid: HashMap<u32, u64>,
    #[cfg(target_os = "windows")]
    app_process_cpu_last_sample: Option<Instant>,
    #[cfg(target_os = "windows")]
    app_process_cpu_cache: Option<f64>,
    #[cfg(target_os = "windows")]
    app_process_cpu_ema: Option<f64>,
    cpu_usage_ema: Option<f64>,
    disk_cache: Vec<DiskMetrics>,
    last_disk_poll: Instant,
    cpu_temp_cache: Option<f64>,
    last_cpu_temp_poll: Instant,
    #[cfg(target_os = "windows")]
    cpu_usage_query: Option<WindowsCpuUsageQuery>,
    #[cfg(target_os = "windows")]
    cpu_frequency_query: Option<WindowsCpuFrequencyQuery>,
}

impl SystemCollector {
    pub fn new() -> Self {
        let system = System::new_all();
        #[cfg(not(target_os = "windows"))]
        let app_usage_system = System::new();
        let current_pid = Pid::from_u32(std::process::id());

        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(true);

        let disks = Disks::new_with_refreshed_list();
        let components = Components::new_with_refreshed_list();
        let (prev_rx, prev_tx) = Self::network_totals(&networks);

        Self {
            system,
            #[cfg(not(target_os = "windows"))]
            app_usage_system,
            networks,
            disks,
            components,
            prev_rx,
            prev_tx,
            prev_tick: Instant::now(),
            gpu_cache: GpuMetrics {
                usage_pct: Some(0.0),
                temperature_c: None,
                memory_used_mb: None,
                memory_total_mb: None,
                frequency_mhz: None,
            },
            last_gpu_poll: Instant::now(),
            warmup_done: false,
            current_pid,
            app_usage_cache: (None, None),
            last_app_usage_poll: Instant::now(),
            app_usage_started_at: Instant::now(),
            #[cfg(target_os = "windows")]
            app_process_cpu_prev_by_pid: HashMap::new(),
            #[cfg(target_os = "windows")]
            app_process_cpu_last_sample: None,
            #[cfg(target_os = "windows")]
            app_process_cpu_cache: None,
            #[cfg(target_os = "windows")]
            app_process_cpu_ema: None,
            cpu_usage_ema: None,
            disk_cache: Vec::new(),
            last_disk_poll: Instant::now() - Duration::from_secs(1),
            cpu_temp_cache: None,
            last_cpu_temp_poll: Instant::now() - Duration::from_secs(1),
            #[cfg(target_os = "windows")]
            cpu_usage_query: WindowsCpuUsageQuery::new(),
            #[cfg(target_os = "windows")]
            cpu_frequency_query: WindowsCpuFrequencyQuery::new(),
        }
    }

    pub fn collect(&mut self, refresh_rate_ms: u64) -> TelemetrySnapshot {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.system
            .refresh_processes(ProcessesToUpdate::Some(&[self.current_pid]), true);
        self.networks.refresh(true);

        let raw_cpu_usage = {
            #[cfg(target_os = "windows")]
            let from_pdh = self
                .cpu_usage_query
                .as_mut()
                .and_then(|query| query.sample_pct());
            #[cfg(not(target_os = "windows"))]
            let from_pdh: Option<f64> = None;

            from_pdh.unwrap_or_else(|| self.system.global_cpu_usage() as f64)
        };
        let cpu_usage = if let Some(prev) = self.cpu_usage_ema {
            let next = prev * 0.7 + raw_cpu_usage * 0.3;
            self.cpu_usage_ema = Some(next);
            next
        } else {
            self.cpu_usage_ema = Some(raw_cpu_usage);
            raw_cpu_usage
        };
        let frequency = {
            #[cfg(target_os = "windows")]
            let from_pdh = self
                .cpu_frequency_query
                .as_mut()
                .and_then(|query| query.sample_mhz());
            #[cfg(not(target_os = "windows"))]
            let from_pdh: Option<u64> = None;

            from_pdh.or_else(|| {
                if self.system.cpus().is_empty() {
                    None
                } else {
                    let total: u64 = self.system.cpus().iter().map(|cpu| cpu.frequency()).sum();
                    Some(total / self.system.cpus().len() as u64)
                }
            })
        };

        let cpu_temp = self.refresh_cpu_temperature();

        let memory_total_mb = self.system.total_memory() as f64 / (1024.0 * 1024.0);
        let memory_used_mb = self.system.used_memory() as f64 / (1024.0 * 1024.0);
        let memory_usage_pct = if memory_total_mb > 0.0 {
            memory_used_mb / memory_total_mb * 100.0
        } else {
            0.0
        };

        let disks_vec = self.refresh_disk_metrics();

        let (rx_total, tx_total) = Self::network_totals(&self.networks);
        let elapsed = self.prev_tick.elapsed().as_secs_f64().max(0.001);
        let rx_rate = rx_total.saturating_sub(self.prev_rx) as f64 / elapsed;
        let tx_rate = tx_total.saturating_sub(self.prev_tx) as f64 / elapsed;

        self.prev_rx = rx_total;
        self.prev_tx = tx_total;
        self.prev_tick = Instant::now();

        let base_interval_ms = refresh_rate_ms.max(10);
        // GPU/per-process counters are expensive and naturally low-frequency; decouple
        // from UI push interval to avoid 10ms settings causing counter thrashing.
        let gpu_sample_interval = Duration::from_millis(base_interval_ms.max(400));
        let app_usage_sample_interval = Duration::from_millis(base_interval_ms.max(300));
        let gpu_metrics = self.refresh_gpu_metrics(gpu_sample_interval);
        let (app_cpu_usage_pct, app_memory_mb) =
            self.sample_app_usage_metrics(app_usage_sample_interval);

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

    fn refresh_cpu_temperature(&mut self) -> Option<f64> {
        let temp_interval = Duration::from_millis(1000);
        if self.last_cpu_temp_poll.elapsed() < temp_interval && self.warmup_done {
            return self.cpu_temp_cache;
        }

        if self.warmup_done {
            self.components.refresh(true);
        } else {
            self.warmup_done = true;
        }
        self.last_cpu_temp_poll = Instant::now();

        let mut cpu_temp: Option<f64> = None;
        for component in &self.components {
            let label = component.label().to_lowercase();
            if label.contains("cpu") || label.contains("core") || label.contains("package") {
                if let Some(temp) = component.temperature() {
                    let temp = temp as f64;
                    if temp.is_finite() {
                        cpu_temp = Some(cpu_temp.map_or(temp, |current| current.max(temp)));
                    }
                }
            }
        }

        self.cpu_temp_cache = cpu_temp;
        self.cpu_temp_cache
    }

    fn refresh_disk_metrics(&mut self) -> Vec<DiskMetrics> {
        let disk_interval = Duration::from_millis(500);
        if self.last_disk_poll.elapsed() < disk_interval && !self.disk_cache.is_empty() {
            return self.disk_cache.clone();
        }

        self.disks.refresh(true);
        self.last_disk_poll = Instant::now();

        let mut disks_vec: Vec<DiskMetrics> = Vec::new();
        for disk in self.disks.list() {
            let total = disk.total_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let avail = disk.available_space() as f64 / (1024.0 * 1024.0 * 1024.0);
            let used = (total - avail).max(0.0);
            let usage_pct = if total > 0.0 {
                used / total * 100.0
            } else {
                0.0
            };

            let usage = disk.usage();
            disks_vec.push(DiskMetrics {
                name: disk.mount_point().to_string_lossy().to_string(),
                label: disk.name().to_string_lossy().to_string(),
                used_gb: used,
                total_gb: total,
                usage_pct,
                read_bytes_per_sec: Some(usage.read_bytes as f64),
                write_bytes_per_sec: Some(usage.written_bytes as f64),
            });
        }

        self.disk_cache = disks_vec;
        self.disk_cache.clone()
    }

    fn sample_app_usage_metrics(
        &mut self,
        refresh_interval: Duration,
    ) -> (Option<f64>, Option<f64>) {
        if self.app_usage_cache.0.is_none()
            || self.app_usage_cache.1.is_none()
            || self.last_app_usage_poll.elapsed() >= refresh_interval
        {
            self.app_usage_cache = self.collect_app_usage_metrics();
            self.last_app_usage_poll = Instant::now();
        }

        self.app_usage_cache
    }

    fn collect_app_usage_metrics(&mut self) -> (Option<f64>, Option<f64>) {
        let process_tree = self.collect_process_tree_pids();
        if process_tree.is_empty() {
            return (None, None);
        }

        #[cfg(target_os = "windows")]
        {
            return self.collect_app_usage_metrics_windows(&process_tree);
        }

        #[cfg(not(target_os = "windows"))]
        {
        self.app_usage_system
            .refresh_processes(ProcessesToUpdate::Some(&process_tree), true);

        let logical_cpu_count = self.system.cpus().len().max(1) as f64;
        let mut cpu_usage_sum = 0.0_f64;
        let mut memory_bytes_sum = 0_u64;

        for pid in process_tree {
            if let Some(process) = self.app_usage_system.process(pid) {
                cpu_usage_sum += process.cpu_usage() as f64;
                memory_bytes_sum = memory_bytes_sum.saturating_add(process.memory());
            }
        }

        // sysinfo process CPU can reach core_count * 100; normalize to Task Manager's 0..100%.
        let cpu_usage_pct = (cpu_usage_sum / logical_cpu_count).clamp(0.0, 100.0);
        let memory_mb = memory_bytes_sum as f64 / (1024.0 * 1024.0);

        (Some(cpu_usage_pct), Some(memory_mb))
        }
    }

    #[cfg(target_os = "windows")]
    fn collect_process_tree_pids(&self) -> Vec<Pid> {
        collect_process_tree_pids_windows(self.current_pid.as_u32())
    }

    #[cfg(not(target_os = "windows"))]
    fn collect_process_tree_pids(&self) -> Vec<Pid> {
        vec![self.current_pid]
    }

    #[cfg(target_os = "windows")]
    fn collect_app_usage_metrics_windows(&mut self, process_tree: &[Pid]) -> (Option<f64>, Option<f64>) {
        const STARTUP_GRACE_SECONDS: f64 = 2.0;
        const MIN_CPU_WINDOW_SECONDS: f64 = 0.8;
        const CPU_EMA_ALPHA: f64 = 0.25;

        let now = Instant::now();
        let logical_cpu_count = self.system.cpus().len().max(1) as f64;
        let mut memory_bytes_sum = 0_u64;
        let mut current_cpu_times: HashMap<u32, u64> = HashMap::with_capacity(process_tree.len());

        for pid in process_tree {
            let pid_u32 = pid.as_u32();
            if let Some((cpu_time_100ns, memory_bytes)) =
                query_process_cpu_and_memory_windows(pid_u32)
            {
                current_cpu_times.insert(pid_u32, cpu_time_100ns);
                memory_bytes_sum = memory_bytes_sum.saturating_add(memory_bytes);
            }
        }

        let cpu_usage_pct = if let Some(last_sample) = self.app_process_cpu_last_sample {
            let elapsed_seconds = now.duration_since(last_sample).as_secs_f64();
            if elapsed_seconds >= MIN_CPU_WINDOW_SECONDS {
                let mut delta_cpu_100ns_sum = 0_u64;
                for (pid, cpu_time_now) in &current_cpu_times {
                    if let Some(cpu_time_prev) = self.app_process_cpu_prev_by_pid.get(pid) {
                        delta_cpu_100ns_sum =
                            delta_cpu_100ns_sum.saturating_add(cpu_time_now.saturating_sub(*cpu_time_prev));
                    }
                }

                let cpu_seconds = delta_cpu_100ns_sum as f64 / 10_000_000.0;
                let usage_raw = (cpu_seconds / (elapsed_seconds * logical_cpu_count) * 100.0)
                    .clamp(0.0, 100.0);

                let usage_smoothed = if let Some(prev) = self.app_process_cpu_ema {
                    prev * (1.0 - CPU_EMA_ALPHA) + usage_raw * CPU_EMA_ALPHA
                } else {
                    usage_raw
                };

                self.app_process_cpu_ema = Some(usage_smoothed);
                self.app_process_cpu_cache = Some(usage_smoothed);
                if now.duration_since(self.app_usage_started_at).as_secs_f64()
                    < STARTUP_GRACE_SECONDS
                {
                    Some(0.0)
                } else {
                    Some(usage_smoothed)
                }
            } else {
                if now.duration_since(self.app_usage_started_at).as_secs_f64()
                    < STARTUP_GRACE_SECONDS
                {
                    Some(0.0)
                } else {
                    self.app_process_cpu_cache
                }
            }
        } else {
            Some(0.0)
        };

        self.app_process_cpu_prev_by_pid = current_cpu_times;
        self.app_process_cpu_last_sample = Some(now);

        let memory_mb = memory_bytes_sum as f64 / (1024.0 * 1024.0);
        (cpu_usage_pct, Some(memory_mb))
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

    fn refresh_gpu_metrics(&mut self, refresh_interval: Duration) -> GpuMetrics {
        if self.last_gpu_poll.elapsed() < refresh_interval {
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
fn collect_process_tree_pids_windows(root_pid: u32) -> Vec<Pid> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return vec![Pid::from_u32(root_pid)];
    }

    let mut children_by_parent: HashMap<u32, Vec<u32>> = HashMap::new();
    unsafe {
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                children_by_parent
                    .entry(entry.th32ParentProcessID)
                    .or_default()
                    .push(entry.th32ProcessID);

                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        let _ = CloseHandle(snapshot);
    }

    let mut process_stack = vec![root_pid];
    let mut visited = HashSet::new();
    let mut process_tree = Vec::new();

    while let Some(pid) = process_stack.pop() {
        if !visited.insert(pid) {
            continue;
        }

        process_tree.push(Pid::from_u32(pid));
        if let Some(children) = children_by_parent.get(&pid) {
            process_stack.extend(children.iter().copied());
        }
    }

    process_tree
}

#[cfg(target_os = "windows")]
fn query_process_cpu_and_memory_windows(pid: u32) -> Option<(u64, u64)> {
    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME};
    use windows_sys::Win32::System::ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS_EX};
    use windows_sys::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_VM_READ,
    };

    fn filetime_to_u64(ft: FILETIME) -> u64 {
        ((ft.dwHighDateTime as u64) << 32) | ft.dwLowDateTime as u64
    }

    unsafe {
        let handle = OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ,
            0,
            pid,
        );
        if handle.is_null() {
            return None;
        }

        let mut creation = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut exit = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut kernel = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut user = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };

        let mut pmc = PROCESS_MEMORY_COUNTERS_EX {
            cb: std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32,
            PageFaultCount: 0,
            PeakWorkingSetSize: 0,
            WorkingSetSize: 0,
            QuotaPeakPagedPoolUsage: 0,
            QuotaPagedPoolUsage: 0,
            QuotaPeakNonPagedPoolUsage: 0,
            QuotaNonPagedPoolUsage: 0,
            PagefileUsage: 0,
            PeakPagefileUsage: 0,
            PrivateUsage: 0,
        };

        let got_times = GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) != 0;
        let got_memory = K32GetProcessMemoryInfo(
            handle,
            &mut pmc as *mut PROCESS_MEMORY_COUNTERS_EX as *mut _,
            std::mem::size_of::<PROCESS_MEMORY_COUNTERS_EX>() as u32,
        ) != 0;

        let _ = CloseHandle(handle);
        if !got_times || !got_memory {
            return None;
        }

        let cpu_time_100ns = filetime_to_u64(kernel).saturating_add(filetime_to_u64(user));
        // Task Manager "Memory" is closest to working set for process-level display.
        let memory_bytes = pmc.WorkingSetSize as u64;
        Some((cpu_time_100ns, memory_bytes))
    }
}

#[cfg(target_os = "windows")]
fn query_gpu_metrics_windows() -> Option<GpuMetrics> {
    use std::os::windows::process::CommandExt;

    // Prevent PowerShell from popping a console window in packaged builds.
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let script = r#"
$usage = $null
$memUsedMb = $null
$memTotalMb = $null
$freqMhz = $null

$usedBy = @{}
$limitBy = @{}
$usageByLuid = @{}
$sumUsageByLuid = @{}
$allEngineUsage = @()
$bestInst = $null
$bestLimit = -1
$bestLuid = $null

function Get-LuidText([string]$text) {
  if ($text -and $text -match '(luid_0x[0-9a-fA-F]+)') {
    return $Matches[1].ToLowerInvariant()
  }
  return $null
}

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

$engine = Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue
if ($engine) {
  foreach ($s in $engine.CounterSamples) {
    $value = [double]$s.CookedValue
    if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) {
      continue
    }
    $value = [Math]::Min([Math]::Max($value, 0), 100)
    $allEngineUsage += $value

    $luid = Get-LuidText $s.Path
    if ($luid) {
      if (-not $usageByLuid.ContainsKey($luid) -or $usageByLuid[$luid] -lt $value) {
        $usageByLuid[$luid] = $value
      }
      if ($sumUsageByLuid.ContainsKey($luid)) {
        $sumUsageByLuid[$luid] = [double]$sumUsageByLuid[$luid] + $value
      } else {
        $sumUsageByLuid[$luid] = $value
      }
    }
  }
}

if ($sumUsageByLuid.Count -gt 0) {
  $scores = @{}
  foreach ($k in $sumUsageByLuid.Keys) {
    $sumValue = [Math]::Min([Math]::Max([double]$sumUsageByLuid[$k], 0), 100)
    $maxValue = if ($usageByLuid.ContainsKey($k)) { [double]$usageByLuid[$k] } else { 0 }
    # Bias toward higher total utilization while keeping compatibility with busiest-engine behavior.
    $scores[$k] = [Math]::Max($sumValue, $maxValue)
  }
  $bestLuid = ($scores.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
  $usage = $scores[$bestLuid]
} elseif ($usageByLuid.Count -gt 0) {
  $bestLuid = ($usageByLuid.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
  $usage = $usageByLuid[$bestLuid]
} elseif ($allEngineUsage.Count -gt 0) {
  $usage = ($allEngineUsage | Measure-Object -Maximum).Maximum
}

# Prefer memory counters that belong to the adapter currently carrying the highest utilization.
if ($bestLuid) {
  $candidateInstances = @($instances | Where-Object { (Get-LuidText $_) -eq $bestLuid })
  if ($candidateInstances.Count -gt 0) {
    foreach ($inst in $candidateInstances) {
      $limit = 0
      if ($limitBy.ContainsKey($inst)) { $limit = $limitBy[$inst] }
      if ($limit -gt $bestLimit) { $bestLimit = $limit; $bestInst = $inst }
    }
    if (-not $bestInst) {
      $bestInst = $candidateInstances |
        Sort-Object { if ($usedBy.ContainsKey($_)) { [double]$usedBy[$_] } else { 0 } } -Descending |
        Select-Object -First 1
    }
  }
}

# Fallback: use the adapter with the largest dedicated memory budget.
foreach ($inst in $instances) {
  if ($bestInst) { break }
  $limit = 0
  if ($limitBy.ContainsKey($inst)) { $limit = $limitBy[$inst] }
  if ($limit -gt $bestLimit) { $bestLimit = $limit; $bestInst = $inst }
}

if (-not $bestInst -and $instances.Count -gt 0) { $bestInst = $instances[0] }

if ($bestLimit -le 0 -and $usedBy.Count -gt 0) {
  $bestInst = ($usedBy.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Key
}

if (-not $bestLuid) {
  $bestLuid = Get-LuidText $bestInst
}

if ($bestInst) {
  if ($usedBy.ContainsKey($bestInst)) {
    $memUsedMb = $usedBy[$bestInst] / 1MB
  }
  if ($limitBy.ContainsKey($bestInst) -and $limitBy[$bestInst] -gt 0) {
    $memTotalMb = $limitBy[$bestInst] / 1MB
  }
}

$freqCounter = Get-Counter '\GPU Engine(*)\Frequency' -ErrorAction SilentlyContinue
if ($freqCounter) {
  $freqSamples = $freqCounter.CounterSamples
  if ($bestLuid) {
    $freqSamples = $freqSamples | Where-Object { $_.Path -like "*$bestLuid*" }
  }
  $values = $freqSamples | ForEach-Object { [double]$_.CookedValue } | Where-Object { $_ -gt 0 }
  if ($values.Count -gt 0) {
    $freqMhz = ($values | Measure-Object -Maximum).Maximum
  }
}

if ($memTotalMb -eq $null) {
  $videoController = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Sort-Object -Property AdapterRAM -Descending | Select-Object -First 1
  if ($videoController -and $videoController.AdapterRAM -gt 0) {
    $memTotalMb = $videoController.AdapterRAM / 1MB
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
        .creation_flags(CREATE_NO_WINDOW)
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
    let usage_pct = Some(payload.get("usage").and_then(|v| v.as_f64()).unwrap_or(0.0));
    let mut memory_used_mb = payload.get("memUsedMb").and_then(|v| v.as_f64());
    let mut memory_total_mb = payload.get("memTotalMb").and_then(|v| v.as_f64());
    let frequency_mhz = payload.get("freqMhz").and_then(|v| v.as_f64());

    if let Some((dxgi_used_mb, dxgi_total_mb)) = query_gpu_memory_dxgi_windows() {
        // Use DXGI for total VRAM because WMI/PerfCounter sources are often truncated (~4095MB).
        memory_total_mb = Some(dxgi_total_mb);

        // Keep PerfCounter "Dedicated Usage" for current usage when available, as it's often
        // closer to what users expect in the UI. Fall back to DXGI usage if PerfCounter is missing.
        if memory_used_mb.is_none() {
            memory_used_mb = Some(dxgi_used_mb);
        }
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
