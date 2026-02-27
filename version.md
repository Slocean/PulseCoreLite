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
