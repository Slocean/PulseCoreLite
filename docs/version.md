## v1.7.7

- 任务栏新增主题定制能力：支持透明、深色、浅色三种主题并补齐中英文文案
- 新增并接入 NavTabs 组件：支持受控模式与可访问性增强，统一任务栏页签交互
- 任务栏视觉样式优化：调整发光配色并更新容器样式，提升不同主题下的可读性
- 悬浮窗指标面板布局优化：由 grid 调整为 flex，改善内容对齐与显示稳定性
- 构建兼容性增强：引入 autoprefixer 并补充 browserslist 配置

- Add taskbar theme customization with transparent, dark, and light themes plus CN/EN copy updates
- Introduce and integrate NavTabs with controlled mode and accessibility improvements for unified tab interactions
- Refine taskbar visuals with updated glow colors and container styles for better readability across themes
- Optimize overlay metrics layout by switching from grid to flex for more stable alignment
- Improve build compatibility by adding autoprefixer and browserslist configuration

## v1.7.6

- 优化全屏提醒窗口创建逻辑：优先当前显示器并延迟关闭旧窗口，避免闪烁与重复关闭
- 全屏提醒窗口展示升级：改为不透明+全屏模式，背景统一深色并修复“屏幕站不满”问题
- 提醒屏消息存储与关闭信号完善：新增 reminder-screen/reminder-close 存储键并在关闭时清理
- 提醒定位调试增强：记录显示器与窗口位置到本地日志便于排查多屏问题
- 时间选择器体验改进：新增“现在”快捷按钮并优化浮层高度，完善中英文文案
- 发布流程修复：release workflow 获取 version.md 路径修正，版本升级至 1.7.6
- Improve fullscreen reminder window creation: prioritize current monitor and delay closing existing windows to reduce flicker
- Fullscreen reminder display upgrades: switch to opaque fullscreen windows, unify dark background, and fix screen coverage issues
- Reminder payload storage & close signaling: add reminder-screen/reminder-close keys and clean up on close
- Add reminder positioning debug logs to local storage for multi-monitor diagnostics
- Time input UX: add a "Now" shortcut, adjust panel height, and update CN/EN copy
- Release pipeline fix: correct the version.md path in workflow and bump to 1.7.6

## v1.7.5

- 前端架构重构：抽离窗口管理、存储仓储与页面职责，提升可维护性与模块边界清晰度
- 悬浮窗配置重构：新增系统/主题对话框组件，统一对话流程并增强类型约束
- 工具箱能力增强：新增任务提醒与提醒全屏页，周提醒支持多选日期，时间/日期输入体验升级
- UI 组件体系升级：统一按钮/选择器/时间输入/Toast/Dialog 等基础组件，提升一致性与复用性
- 本地化与展示优化：补齐任务栏指标文案、优化雷达图与面板样式，改进中英文更新文本过滤策略
- 质量保障完善：引入 ESLint、Vitest、组件契约检查与前端质量工作流，补充关键 composable/store 单测
- 版本与发布同步：版本升级至 1.7.5，并保持发布说明路径与打包流程一致
- Frontend architecture refactor: extract window manager, storage repository, and page responsibilities for clearer boundaries
- Overlay config refactor: introduce system/theme dialog components and strengthen type constraints in dialog flows
- Toolkit enhancements: add task reminders and fullscreen reminder screen, support multi-day weekly reminders, and improve date/time input UX
- UI foundation upgrade: unify button/select/time-input/toast/dialog components for stronger consistency and reuse
- Localization and presentation polish: add taskbar metric i18n labels, refine radar/panel styles, and improve CN/EN notes filtering
- Quality pipeline improvements: add ESLint, Vitest, component contract checks, frontend quality workflow, and key composable/store tests
- Version and release alignment: bump to 1.7.5 and keep release-note paths and packaging flow consistent

## v1.6.5

- 更新检查新增清单回退机制，网络异常时可给出手动下载地址
- 修复更新说明乱码问题，并在弹窗中按当前语言过滤中/英文发布日志
- 更新弹窗支持滚动阅读与“完整公告”链接，安装流程增强响应式对象兼容性
- Add manifest-based fallback for update checks and provide manual download URL on network failures
- Fix mojibake in release notes and filter notes by current UI language in the update dialog
- Improve update dialog readability with scrollable notes/full release link and harden install flow for raw updater objects

## v1.6.4

- 新增系统级内存整理能力，支持定时清理并可配置间隔
- 工具箱新增性能采集功能，支持设置路径/间隔/时长并启动/停止
- 工具箱清理页新增内存整理目标选择与布局优化
- 硬件分析页支持雷达视图与折叠分区，新增专用标签页结构
- UI 组件体系完善（按钮/开关/对话框/进度条等），提升一致性与可维护性
- 支持性能采集路径解析到应用数据目录
- 提取工具箱中的tabs组件，修复已知问题
- Add system-wide memory trimming with configurable interval
- Add performance capture in Toolkit Cleanup with path/interval/duration and start/stop
- Add memory-trim target selection dialog and cleanup layout improvements
- Enhance hardware analysis UI with radar view, collapsible sections, and dedicated tabs
- Expand UI component system (buttons, switches, dialogs, progress bar) for consistency
- Resolve performance capture paths against the app data directory
- Extract tabs components from the toolbox and fix known issues

## v1.6.3

- 新增手动触发版本更新
- 新增任务栏窗口位置锁定
- 修复若干已知缺陷
- Added manual version update trigger
- Added taskbar window position locking
- Fixed several known issues

## v1.6.2

- 新增热更新（Hot Update）功能
- 建立 CI/CD 自动化构建与发布流程
- 修复若干已知缺陷
- Implement hot update functionality
- Establish automated CI/CD build and release workflow
- Resolve several known issues

## v1.6.1

- 修复全屏隐藏时任务栏仍置顶问题并缩短检测间隔至 250ms
- 实现任务栏在全屏应用激活时自动隐藏与恢复置顶功能
- 统一 settings 同步逻辑，移除冗余 ensureTaskbarMonitor 调用

- Fix taskbar remaining on top during fullscreen hide and reduce detection interval to 250ms
- Add auto-hide taskbar when fullscreen app is active with topmost restoration
- Unify settings sync logic and remove redundant ensureTaskbarMonitor calls

## v1.6.0

- 拆分为独立 taskbar / toolkit 入口，实现三窗口独立打包并懒加载主窗口以降低内存占用
- 移除多窗口角色分支，统一使用 CompactOverlayPage，简化启动流程并清理未使用字体引用
- 主题图片处理升级：统一数据 URL 解析与预览，保存时规范化并清理无用引用
- 任务栏右键菜单增强：支持显示/隐藏主窗口，并新增“隐藏主窗口”项
- 托盘管理优化：移除“关闭时最小化到托盘”，新增托盘接力与跨窗口保证逻辑
- 新增“全屏自动隐藏任务栏”功能，支持配置持久化与 800ms 轮询检测
- 升级版本号至 1.6.0 并同步前端与 Tauri 配置

- Split taskbar/toolkit into dedicated entry points for three-window packaging and lazy-load the main window to reduce memory
- Standardize on CompactOverlayPage and remove multi-window role branches and unused font imports
- Improve theme image handling with unified data-URL resolution, preview support, normalization, and cleanup of unused references
- Enhance taskbar context menu to show/hide the main window, including a dedicated "Hide Main Window" action
- Optimize tray management by removing close-to-tray option and adding cross-window tray handoff/ensure logic
- Add auto-hide taskbar on fullscreen with persisted setting and 800 ms polling
- Bump and sync version to 1.6.0 (frontend + Tauri)

## v1.5.7

- 修复多窗口同步与资源使用率计算问题
- 优化工具箱窗口初始化与关闭逻辑，关闭悬浮窗时同步关闭工具箱
- 跨窗口同步前校验目标窗口是否存在，避免无效事件
- 遥测采集与发送优化：仅向可见窗口推送，无可见窗口时降低轮询频率
- 应用 CPU/内存统计升级：采集应用及其子进程并按逻辑核心归一化
- 优化 GPU 查询超时处理，避免 PowerShell 阻塞
- 升级版本号至 1.5.7 并补充必要的 Windows API 特性

- Fix multi-window sync and resource usage computation
- Harden toolkit window init/close behavior and close it with the overlay
- Validate target window existence before cross-window sync
- Telemetry optimizations: push only to visible windows and throttle when none visible
- App CPU/memory stats now aggregate process tree and normalize by logical cores
- Improve GPU query timeout handling to avoid PowerShell blocking
- Bump version to 1.5.7 and add required Windows API features

## v1.5.5

- 升级版本至 1.5.5 并同步 Tauri 配置
- 新增工具箱窗口状态管理与拖拽能力
- 数字输入支持鼠标滚轮，优化透明窗口与日期选择器交互
- 新增系统工具、恢复出厂设置与配置导入导出
- 新增定时关机工具
- 修复 toolkit 权限导致的窗口创建错误与 WebKit 数字输入显示问题
- 调整工具包尺寸与字体，提升紧凑布局适配
- 开发体验改进：自动检测/切换开发端口，默认改为 9000

- Bump version to 1.5.5 and sync Tauri config
- Add toolkit window state management and drag support
- Enable mouse wheel for number inputs; improve transparent window and date picker UX
- Add system tools, factory reset, and config import/export
- Add scheduled shutdown tool
- Fix toolkit window creation permission error and WebKit number input rendering
- Adjust toolkit size and typography for compact layout
- Dev experience: auto-detect/switch dev port; default to 9000

## v1.4.4

- 更新应用版本号至 1.4.4 并改进发布打包脚本
- 为版本生成步骤添加编号并更新同步说明

- Bump app version to 1.4.4 and improve release packaging script
- Add numbering and sync notes for version generation steps

## v1.4.3

- 更新版本更新说明文档格式与内容
- 引入 WebView2 离线包并重构打包脚本（新增 build-assets/webview2、统一打包流程、便携包内嵌安装器与检测脚本）
- 更新应用版本号至 1.4.3
- 新增主窗口总是置顶开关并默认启用（新增 overlayAlwaysOnTop、配置面板开关、实时切换、持久化、导入导出）
- 调整 Windows 安装包配置并启用离线静默安装（perMachine、offlineInstaller）
- 新增使用说明文档

- Update release notes format and content
- Add WebView2 offline bundle and refactor packaging script (new build-assets/webview2, unified packaging flow, portable bundle includes installer and detection script)
- Bump app version to 1.4.3
- Add always-on-top toggle for the main window and enable it by default (new overlayAlwaysOnTop, settings toggle, runtime switching, persistence, import/export)
- Adjust Windows installer config and enable offline silent install (perMachine, offlineInstaller)
- Add usage documentation
