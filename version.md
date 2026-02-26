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
