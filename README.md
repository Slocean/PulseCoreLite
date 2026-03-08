# PulseCoreLite

> Professional bilingual engineering documentation for PulseCoreLite (Windows desktop performance overlay and toolkit).
>
> PulseCoreLite 的专业双语工程文档（Windows 桌面性能悬浮层与工具套件）。

## 1. Project Positioning | 项目定位

**EN**  
PulseCoreLite is a high-performance desktop observability and operations client built with a modern Web + Native hybrid stack. It provides real-time telemetry visualization, taskbar monitoring, shutdown automation, reminder workflows, profile capture, and system-level window/control capabilities.

**ZH**  
PulseCoreLite 是一个面向桌面端可观测性与运维场景的高性能客户端，采用现代 Web + Native 混合架构，提供实时遥测可视化、任务栏监控、关机计划、任务提醒、性能采样以及系统级窗口控制能力。

## 2. Technical Stack | 技术栈

### Frontend | 前端
![Vue](https://img.shields.io/badge/Vue-3.5-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![Pinia](https://img.shields.io/badge/Pinia-2.3-f7c63d?logo=pinia&logoColor=black)
![Vue I18n](https://img.shields.io/badge/vue--i18n-9.14-4fc08d)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?logo=vite&logoColor=white)
![CSS Tokens](https://img.shields.io/badge/CSS-Tokenized%20Design-264de4?logo=css3&logoColor=white)

### Desktop Native Runtime | 原生桌面运行时
![Tauri](https://img.shields.io/badge/Tauri-2.5-24c8db?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white)
![WebView](https://img.shields.io/badge/WebView-Desktop%20Runtime-0f172a)
![Plugin Dialog](https://img.shields.io/badge/Tauri%20Plugin-dialog-2563eb)
![Plugin Process](https://img.shields.io/badge/Tauri%20Plugin-process-2563eb)
![Plugin Updater](https://img.shields.io/badge/Tauri%20Plugin-updater-2563eb)
![Windows API](https://img.shields.io/badge/Windows%20API-windows--sys%20%2B%20windows-0078d4?logo=windows&logoColor=white)

### Backend (Rust) | 原生后端（Rust）
![Tokio](https://img.shields.io/badge/tokio-1.43-000000?logo=tokio&logoColor=white)
![Sysinfo](https://img.shields.io/badge/sysinfo-0.33-334155)
![Tracing](https://img.shields.io/badge/tracing-0.1-475569)
![Tracing Subscriber](https://img.shields.io/badge/tracing--subscriber-0.3-475569)
![Lettre](https://img.shields.io/badge/lettre-0.11-0ea5e9)
![JSON Persistence](https://img.shields.io/badge/Persistence-JSON%20State-16a34a)

### Engineering Toolchain | 工程工具链
![ESLint](https://img.shields.io/badge/ESLint-8.57-4b32c3?logo=eslint&logoColor=white)
![vue-tsc](https://img.shields.io/badge/vue--tsc-2.2-3178c6)
![Vitest](https://img.shields.io/badge/Vitest-4.0-6e9f18?logo=vitest&logoColor=white)
![Tauri Build](https://img.shields.io/badge/Build-tauri%20build-24c8db?logo=tauri&logoColor=white)
![PowerShell](https://img.shields.io/badge/Release-PowerShell-5391fe?logo=powershell&logoColor=white)

## 3. Core Features | 核心功能

| Domain | Capabilities |
|---|---|
| Real-time Overlay | CPU/GPU/RAM/Disk/Network telemetry display, warning policy, topmost control, auto-hide on fullscreen |
| Taskbar Monitor | Native taskbar aligned monitoring window and sync state linkage |
| Toolkit | Hardware panel, reminder panel, scheduled shutdown, cleanup/feedback modules |
| Reminder System | Daily/weekly/monthly rules, fullscreen reminder screen, email channel, SMTP config |
| Power Operations | Countdown/once/repeat shutdown plans (Windows `shutdown` + `schtasks`) |
| Profile Capture | Timed telemetry sampling, profile file output, folder quick-open |
| Deployment | Portable/installed mode detection, updater integration, uninstall flow |
| UX Infrastructure | Multi-window controller, sync bus, persistent settings + themes, bilingual localization |

## 4. Runtime Architecture | 运行时架构

```mermaid
flowchart LR
  subgraph UI[Vue Multi-Window UI]
    A["Overlay main\nindex.html"]
    B["Taskbar\ntaskbar.html"]
    C["Toolkit\ntoolkit.html"]
  end

  subgraph FE[TypeScript Services/Stores]
    D[tauriApi Facade]
    E[Pinia Domain Stores]
    F[Composables / Scheduler / Theme Manager]
  end

  subgraph IPC[Tauri IPC Layer]
    G[invoke commands]
    H[event emit/listen]
  end

  subgraph RS[Rust Core]
    I[AppState + loops]
    J[Telemetry collector]
    K[Reminder + Email + Shutdown]
    L[Window/Taskbar/Registry integration]
  end

  subgraph OS[Windows APIs / OS Services]
    M[Registry]
    N[schtasks + shutdown]
    O[Window manager]
  end

  A --> D
  B --> D
  C --> D
  D --> G
  F --> H
  G --> I
  I --> J
  I --> K
  I --> L
  L --> M
  K --> N
  L --> O
  E --> A
  E --> B
  E --> C
```

## 5. Codebase Topology | 代码分层

```text
src/
  entries/           # app bootstrap + window entries
  pages/             # page-level compositions
  components/        # overlay/taskbar/toolkit/ui components
  composables/       # business hooks (metrics, reminders, updater, themes, windows)
  services/          # tauri api adapters, sync bus, storage repository, window manager
  stores/            # pinia domain stores
  i18n/              # en-US / zh-CN locale packs
  styles/            # tokenized CSS + domain styles

src-tauri/
  src/ipc/commands.rs # tauri command surface
  src/app.rs          # invoke registration + background loops
  src/core/           # collectors + device info
  src/native_taskbar.rs
  src/state.rs
```

## 6. Product Pictures | 产品图

Design assets are maintained in `design/product_picture/new`.

### Gallery

| Preview A | Preview B | Preview C |
|---|---|---|
| ![Product 1](design/product_picture/new/1.png) | ![Product 2](design/product_picture/new/2.png) | ![Product 3](design/product_picture/new/3.png) |
| ![Product 4](design/product_picture/new/4.png) | ![Product 5](design/product_picture/new/5.png) | ![Product 6](design/product_picture/new/6.png) |
| ![Product 7](design/product_picture/new/7.png) | ![Product 8](design/product_picture/new/8.png) | ![Product 9](design/product_picture/new/9.png) |
| ![Product 10](design/product_picture/new/10.png) | ![Product 11](design/product_picture/new/11.png) |  |

## 7. Build, QA, and Release | 构建、质量与发布

### Development
```bash
npm install
npm run tauri:dev
```

### Quality Gates
```bash
npm run lint
npm run typecheck
npm run test
npm run check
```

### Production Build
```bash
npm run build
npm run tauri:build
```

### Release Packaging
```bash
npm run pack:release
npm run release
```

## 8. Engineering Characteristics | 工程特性

- Clear separation between UI domain logic and native host commands.
- Multi-window architecture with synchronized state/event propagation.
- Persistent configuration domain with schema-versioned storage keys.
- System-level Windows integration (autostart, topmost z-order, taskbar geometry, uninstall flow).
- Operational feature set oriented to real user workflows (shutdown scheduling, reminders, profile capture).

## 9. Platform Notes | 平台说明

- Primary target: **Windows desktop**.
- Some commands are conditionally available only on Windows (autostart, schtasks/shutdown, registry/uninstall, certain system dialogs).
- Update endpoint is configured to GitHub Releases metadata (`latest.json`).

## 10. Versioning | 版本一致性

- Current frontend package version: `1.8.10` (`package.json`)
- Tauri app version sync is enforced by `npm run sync:tauri-version`.

## 11. IPC Command Surface (Tauri) | IPC 命令面（Tauri）

### System / Window
- `get_initial_state`
- `toggle_overlay`
- `set_window_system_topmost`
- `is_fullscreen_window_active`
- `get_taskbar_info`
- `configure_native_taskbar_monitor`
- `exit_app`

### Performance / Telemetry
- `get_hardware_info`
- `set_refresh_rate`
- `set_memory_trim_enabled`
- `set_memory_trim_system_enabled`
- `set_memory_trim_interval`
- `start_profile_capture`
- `stop_profile_capture`
- `get_profile_status`
- `get_profile_output_dir`
- `open_profile_output_path`

### Reminder / Mail
- `get_task_reminder_store`
- `save_task_reminder_store`
- `trigger_task_reminder_now`
- `force_close_reminder_screens`
- `send_reminder_email`

### Operations / Lifecycle
- `get_auto_start_enabled`
- `set_auto_start_enabled`
- `get_installation_mode`
- `uninstall_app`
- `get_shutdown_plan`
- `schedule_shutdown`
- `cancel_shutdown_schedule`
- `save_export_config`
- `confirm_factory_reset`

### Diagnostics
- `debug_log`

## 12. Background Runtime Loops | 后台循环机制

- Telemetry loop: continuously refreshes snapshots for UI consumers.
- Memory trim loop: periodically executes app/system memory trimming strategy.
- Task reminder loop: evaluates schedule rules and triggers fullscreen/email channels.

---

## License | 许可

No explicit open-source license file is currently present in repository root. Add a `LICENSE` file if external distribution is required.
