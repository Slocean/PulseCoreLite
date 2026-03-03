# PulseCoreLite 前端架构全量优化方案（仅前端）

- 文档日期：2026-03-02
- 当前版本：v1.6.5
- 评估范围：`index.html`、`taskbar.html`、`toolkit.html`、`vite.config.ts`、`tsconfig.json`、`package.json`、`src/` 全量前端文件
- 目标：给出“可执行、可分期、可逐文件落地”的前端优化方案

## 1. 当前前端架构基线

### 1.1 结构基线
- 多入口多窗口：`main`（悬浮窗）+ `taskbar`（任务栏条）+ `toolkit`（工具箱/提醒屏）
- 技术栈：Vue 3 + Pinia + Vue I18n + Vite + Tauri 2
- 代码体量：
  - `.vue`：35 文件，8421 行
  - `.ts`：47 文件，4836 行
  - `.css`：10 文件，1574 行
  - `.json`：2 文件，678 行

### 1.2 核心瓶颈
- 超大文件耦合：
  - `src/stores/app.ts`（1135 行）
  - `src/composables/useThemeManager.ts`（890 行）
  - `src/pages/index.vue`（772 行）
  - `src/components/toolkit/ToolkitHardwareTab.vue`（712 行）
  - `src/components/toolkit/ToolkitReminderTab.vue`（516 行）
  - `src/components/ui/DateInput/index.vue`（573 行）
  - `src/components/ui/Button/index.vue`（485 行）
- 状态、窗口控制、持久化分散在 Store/Page/Composable 多处，跨窗同步路径多且重复。
- UI 基础组件存在重复能力（`OverlayDialog` 与 `ui/Dialog` 并存），交互定位/弹层逻辑分散。
- 样式层“全局类 + 业务类 + 组件 scoped”混合，缺少统一 design token 分层。
- 存在遗留备份文件在 `src`（`.bak.vue`），增加理解与维护噪音。
- 部分文案未完全 i18n 化（硬编码中英文字符串）。

## 2. 优化目标（前端）

1. 架构目标：形成稳定分层 `Entry -> Page -> Domain Composable -> Store -> Service -> UI`。
2. 维护目标：核心单文件控制在 400 行以内（极限 500 行）；每个文件职责单一。
3. 性能目标：减少多窗口重复逻辑与高频轮询抖动；降低无效渲染和不必要样式加载。
4. 一致性目标：统一持久化访问层、窗口管理层、弹层层、设计令牌层。
5. 可扩展目标：新增一个监控项/工具模块只改一处 domain，不改主页面骨架。
6. 质量目标：补齐前端静态检查与基础测试门禁（至少关键 composable + store）。

## 3. 最终效果（交付后状态）

- 架构层面：
  - 新增 `windowManager`（窗口创建/显示/销毁/置顶/全屏隐藏）统一入口。
  - `app store` 拆分为 `settingsStore`、`telemetryStore`、`windowStore`、`systemStore`。
  - `storageRepository` 统一 localStorage/IndexedDB 访问和迁移。
- 代码层面：
  - `index.vue` 仅负责页面编排，不再承载主题、导入导出、更新、提醒、窗口细节。
  - `useThemeManager`、`ToolkitHardwareTab`、`ToolkitReminderTab` 按子域拆分。
  - `OverlayDialog` 与 `ui/Dialog` 合并为单一实现。
- 体验层面：
  - 设置同步更稳定，多窗口行为一致，异常提示统一。
  - 任务栏与悬浮窗的置顶/全屏隐藏策略可预测，状态无“回跳”。
- 工程层面：
  - 删除/迁移 `src` 下 `.bak.vue`，目录语义清晰。
  - 增加 lint/typecheck/test 基线，避免回归。

## 4. 原因与可行性

### 4.1 为什么必须优化
- 当前主要风险不是“功能缺失”，而是“复杂度失控”。
- 单文件过大导致改一个点容易连锁影响多个功能域。
- 多窗口 + Tauri 场景天然复杂，若无统一窗口与存储抽象，后续迭代成本会快速上升。

### 4.2 可行性评估
- 技术可行：现有代码已经有 composable 与组件化基础，适合渐进式拆分。
- 风险可控：以“保持外部行为不变”的重构方式推进，先抽象再迁移调用。
- 成本可控：按 4 阶段执行，优先做高收益低风险项（结构拆分、重复收敛、遗留清理）。

## 5. 整体架构执行方案（分阶段）

## 阶段 P0（1 周，基础收敛）
- 建立 `frontend-architecture.md` 与目录约束（domain 分层规则）。
- 删除 `src` 中 `.bak.vue`（迁移到 `docs/archive/`）。
- 抽取统一 `storageRepository`（保持原 key，不改行为）。
- 新建 `windowManager`，先承接共性 API，不一次性替换全部调用。
- 交付标准：行为不变，编译通过，主路径 smoke 测试通过。

## 阶段 P1（1~2 周，核心解耦）
- 拆分 `app.ts`：设置、窗口、系统、遥测四个 store。
- `pages/index.vue` 下沉业务逻辑到 domain composable。
- 合并 `OverlayDialog` 与 `ui/Dialog`。
- 抽取 `overlay/taskbar/toolkit` 共同初始化逻辑到 entry helper。
- 交付标准：核心文件显著瘦身，窗口与设置链路稳定。

## 阶段 P2（1~2 周，组件与样式标准化）
- 拆 `ToolkitHardwareTab` 与 `ToolkitReminderTab` 为多个子组件 + 计算模块。
- `ui/DateInput`、`ui/TimeInput`、`ui/Select` 抽统一弹层定位与交互内核。
- `Button` 预设拆分为 token + preset map，降低样式复杂度。
- 样式按 `tokens.css -> primitives.css -> feature.css` 重组。
- 交付标准：组件复用增强，样式冲突与重复下降。

## 阶段 P3（0.5~1 周，质量门禁）
- 加入 `eslint + vue-tsc + vitest` 基线。
- 为 `useTaskReminders`、`useOverlayPrefs`、`settingsStore` 增加关键单测。
- 增加体积对比与性能回归检查（基础脚本）。
- 交付标准：CI 可跑通，核心流程有可重复回归能力。

## 6. 全量逐文件优化清单（每个文件）

说明：每条均包含“问题/动作/执行阶段”，覆盖本次评估范围内全部前端文件。

## 6.1 工程与入口文件
- `package.json`：缺少前端质量门禁脚本；新增 `lint`、`test`、`typecheck`、`check` 聚合脚本；阶段 P3。
- `vite.config.ts`：多入口已具备，但缺少 chunk 策略与性能分析入口；增加 `manualChunks` 与构建分析开关；阶段 P2。
- `tsconfig.json`：目前严格模式可用；补充更明确的路径约束与测试类型声明；阶段 P3。
- `index.html`：入口最小化已合理；补充语义化 title/meta 与窗口标识注释；阶段 P1。
- `taskbar.html`：同上；统一 head 模板策略；阶段 P1。
- `toolkit.html`：同上；统一 head 模板策略；阶段 P1。
- `src/main.ts`：与 `taskbar.ts`/`toolkit.ts` 重复初始化；抽 `createPulseApp` 工厂；阶段 P1。
- `src/taskbar.ts`：重复 app 初始化；迁移到统一 entry 工厂；阶段 P1。
- `src/toolkit.ts`：重复 app 初始化；迁移到统一 entry 工厂；阶段 P1。
- `src/main.css`：导入链偏重，建议仅导入 main 需要样式；按 feature 拆分引入；阶段 P2。
- `src/taskbar.css`：当前引用了 `overlay.css` 造成潜在冗余；精简到 taskbar 必需样式；阶段 P2。
- `src/toolkit.css`：与 `main.css` 重复导入 overlay/config/dialog；按页面专属拆分；阶段 P2。
- `src/App.vue`：主入口生命周期逻辑可抽到 shared bootstraper；保留纯容器职责；阶段 P1。
- `src/entries/TaskbarApp.vue`：与其他入口重复语言同步逻辑；抽共享 `useEntryBootstrap`；阶段 P1。
- `src/entries/ToolkitApp.vue`：提醒屏分支逻辑和普通工具窗混合；拆 `ToolkitEntry` 与 `ReminderScreenEntry`；阶段 P1。

## 6.2 Store / Service / 类型 / i18n / 工具
- `src/stores/app.ts`：职责过载（设置/窗口/托盘/系统/任务栏/同步）；拆分 4 store + facade；阶段 P1。
- `src/services/tauri.ts`：API 平铺过大且缺命令域分组；按 `window/system/reminder/profile` 模块化导出；阶段 P1。
- `src/types/index.ts`：业务类型集中度高但仍单文件；按 domain 拆 `telemetry.ts/settings.ts/reminder.ts`；阶段 P1。
- `src/i18n/index.ts`：可用；增加 `lazy locale` 与缺失 key 报警机制；阶段 P2。
- `src/i18n/locales/en-US.json`：与 zh 键一致；把新增硬编码文案补入字典；阶段 P1。
- `src/i18n/locales/zh-CN.json`：同上；阶段 P1。
- `src/utils/kv.ts`：存储能力良好；补充 key namespace 与迁移版本控制；阶段 P0。
- `src/utils/hotkey.ts`：解析逻辑可用；增强平台差异处理（Mac cmd 显示策略）；阶段 P2。
- `src/utils/imageStore.ts`：引用计数机制可用；补充容量上限和回收策略；阶段 P2。

## 6.3 页面文件
- `src/pages/index.vue`：页面过重、弹窗与业务逻辑过多；拆分为 `useOverlayPageController + 子对话框组件`；阶段 P1。
- `src/pages/taskbar.vue`：置顶守护与全屏监控逻辑复杂；抽 `useTopmostGuard`/`useFullscreenAutoHide`；阶段 P1。
- `src/pages/toolkit.vue`：窗口自适应和背景逻辑耦合；分离窗口控制与视觉层 composable；阶段 P1。
- `src/pages/ReminderScreenPage.vue`：内容渲染与关闭控制耦合，需增强 URL/iframe 安全边界；拆 `content renderer` 并增加白名单；阶段 P2。
- `src/pages/index.bak.vue`：遗留备份文件在源码目录；迁移到 `docs/archive` 或删除；阶段 P0。
- `src/pages/CompactOverlayPage.bak.vue`：遗留备份文件；迁移或删除；阶段 P0。

## 6.4 Composables
- `src/composables/useConfigTransfer.ts`：导入流程步骤多、事务性不足；改为“预校验->构造 nextState->一次提交”；阶段 P1。
- `src/composables/useFactoryReset.ts`：逻辑可用；与全局 dialog service 对接，去除重复确认控制；阶段 P2。
- `src/composables/useOverlayMetrics.ts`：指标格式化与 UI 状态耦合；拆为 pure formatter + view mapper；阶段 P2。
- `src/composables/useOverlayPrefs.ts`：跨窗同步 + 持久化混合；对接 `storageRepository` 并统一 sync bus；阶段 P0/P1。
- `src/composables/useOverlayRefreshRate.ts`：仅 localStorage 存储；迁移至统一设置仓储；阶段 P0。
- `src/composables/useOverlayUptime.ts`：可用；改为 `useInterval` 公共工具以减少重复定时器；阶段 P2。
- `src/composables/useOverlayWindow.ts`：窗口尺寸/位置/拖拽逻辑完整但较重；并入 `windowManager` 子模块；阶段 P1。
- `src/composables/useTaskbarPrefs.ts`：仍直接用 localStorage；迁移至统一仓储并支持跨窗同步；阶段 P0/P1。
- `src/composables/useTaskbarWindow.ts`：与 `useOverlayWindow` 存在大量重复；抽共享 `useWindowPositioningCore`；阶段 P1。
- `src/composables/useTaskReminders.ts`：数据模型、触发逻辑、窗口创建耦合；拆 `repository/scheduler/windowPresenter`；阶段 P2。
- `src/composables/useThemeManager.ts`：890 行超大；拆为 `themeStore/cropper/imageLifecycle` 三模块；阶段 P1。
- `src/composables/useToolkitLauncher.ts`：创建逻辑应并入统一 `windowManager`；阶段 P1。
- `src/composables/useUpdater.ts`：更新检查与文案归一可继续优化；抽错误码映射与消息生成器；阶段 P2。

## 6.5 业务组件
- `src/components/OverlayConfigPanel.vue`：配置项过密、状态与行为耦合；拆为分区子组件（显示/系统/主题/工具）；阶段 P2。
- `src/components/OverlayCornerDelete.vue`：可复用度低；升级为通用 `CornerAction`；阶段 P2。
- `src/components/OverlayDialog.vue`：与 `ui/Dialog` 重复；合并为一个实现并保留主题 preset；阶段 P1。
- `src/components/OverlayHeader.vue`：可用；抽版本/更新按钮为独立组件，减少 header 事件耦合；阶段 P2。
- `src/components/OverlayMetricsPanel.vue`：UI 渲染层有重复段落；用 `MetricCard` 子组件迭代渲染；阶段 P2。
- `src/components/OverlayNetworkFooter.vue`：可用；抽与 taskbar 共用的网络值格式化器；阶段 P2。
- `src/components/OverlayStatusBar.vue`：含硬编码英文文案；改为 i18n；阶段 P1。
- `src/components/TaskbarContextMenu.vue`：构建菜单逻辑较长；抽 `buildTaskbarMenuItems` 纯函数；阶段 P2。
- `src/components/toolkit/ToolkitTabs.vue`：可用；补键盘导航与 roving tabindex；阶段 P2。
- `src/components/toolkit/ToolkitShutdownTab.vue`：表单逻辑可下沉到 composable；阶段 P2。
- `src/components/toolkit/ToolkitCleanupTab.vue`：硬编码“停止”未 i18n；统一到语言包并拆 profile 状态逻辑；阶段 P1/P2。
- `src/components/toolkit/ToolkitHardwareTab.vue`：评分算法与视图耦合严重；拆 `hardwareScoring.ts` + 子展示组件；阶段 P1。
- `src/components/toolkit/ToolkitReminderTab.vue`：表单、列表、SMTP 全部在单文件；拆 `ReminderForm/ReminderList/SmtpDialog`；阶段 P1。

## 6.6 UI 组件（逐文件）

### Button
- `src/components/ui/Button/index.vue`：样式 preset 过大（485 行）；拆 `button.tokens.css + presets.ts`；阶段 P2。
- `src/components/ui/Button/types.ts`：类型较完整；补充更严格 preset 联合类型；阶段 P2。
- `src/components/ui/Button/index.ts`：保持 barrel；确保仅导出公共 API；阶段 P2。
- `src/components/ui/Button/index.bak.vue`：遗留备份文件；迁移或删除；阶段 P0。

### Checkbox
- `src/components/ui/Checkbox/index.vue`：可用；补 ARIA 描述与键盘细节测试；阶段 P2。
- `src/components/ui/Checkbox/types.ts`：补充泛型注释与可选值约束；阶段 P2。
- `src/components/ui/Checkbox/index.ts`：保持 barrel；阶段 P2。

### CollapsiblePanel
- `src/components/ui/CollapsiblePanel/index.vue`：header 模式较复杂；补单元测试与 slots 合约说明；阶段 P2。
- `src/components/ui/CollapsiblePanel/types.ts`：补字段文档和默认值映射类型；阶段 P2。
- `src/components/ui/CollapsiblePanel/index.ts`：保持 barrel；阶段 P2。

### DateInput
- `src/components/ui/DateInput/index.vue`：体量过大且含定位/键盘逻辑；抽 `useFloatingPanel` 和 `useDateGrid`；阶段 P1/P2。
- `src/components/ui/DateInput/types.ts`：补 min/max 约束说明类型；阶段 P2。
- `src/components/ui/DateInput/index.ts`：保持 barrel；阶段 P2。

### Dialog
- `src/components/ui/Dialog/index.vue`：将作为唯一 dialog 实现，吸收 OverlayDialog 能力；阶段 P1。
- `src/components/ui/Dialog/types.ts`：补充 action slot 行为约束；阶段 P1。
- `src/components/ui/Dialog/index.ts`：统一对外出口；阶段 P1。

### ProgressBar
- `src/components/ui/ProgressBar/index.vue`：可用；与 overlay 进度样式统一到 token；阶段 P2。
- `src/components/ui/ProgressBar/types.ts`：补颜色枚举来源说明；阶段 P2。
- `src/components/ui/ProgressBar/index.ts`：保持 barrel；阶段 P2。

### Range
- `src/components/ui/Range/index.vue`：与业务 CSS 重复；统一用组件本身替代页面自写 `input[type=range]`；阶段 P2。
- `src/components/ui/Range/types.ts`：补类型注释；阶段 P2。
- `src/components/ui/Range/index.ts`：保持 barrel；阶段 P2。

### Select
- `src/components/ui/Select/index.vue`：与 Date/Time 共用弹层逻辑可抽象；阶段 P1/P2。
- `src/components/ui/Select/types.ts`：增强 `SelectValue` 联合类型约束；阶段 P2。
- `src/components/ui/Select/index.ts`：保持 barrel；阶段 P2。

### Switch
- `src/components/ui/Switch/index.vue`：可用；统一焦点态视觉 token；阶段 P2。
- `src/components/ui/Switch/types.ts`：补可访问性 props；阶段 P2。
- `src/components/ui/Switch/index.ts`：保持 barrel；阶段 P2。

### TimeInput
- `src/components/ui/TimeInput/index.vue`：与 Select/DateInput 弹层定位重复；抽共享 floating core；阶段 P1/P2。
- `src/components/ui/TimeInput/types.ts`：补时间格式约束说明；阶段 P2。
- `src/components/ui/TimeInput/index.ts`：保持 barrel；阶段 P2。

### Toast
- `src/components/ui/Toast/index.vue`：可用；接入全局 toast service，减少页面局部定时器；阶段 P2。
- `src/components/ui/Toast/types.ts`：补超时和级别字段；阶段 P2。
- `src/components/ui/Toast/index.ts`：保持 barrel；阶段 P2。

### UsageValue
- `src/components/ui/UsageValue/index.vue`：与 `useOverlayMetrics`/`ProgressBar` 警戒阈值重复；抽统一阈值策略；阶段 P2。
- `src/components/ui/UsageValue/types.ts`：补阈值配置类型；阶段 P2。
- `src/components/ui/UsageValue/index.ts`：保持 barrel；阶段 P2。

## 6.7 样式文件
- `src/styles/base.css`：作为 token 根层；拆分颜色/排版/层级 token 到独立文件；阶段 P2。
- `src/styles/overlay.css`：承载过多业务样式；拆 `overlay-layout.css`、`overlay-metrics.css`；阶段 P2。
- `src/styles/overlay-config.css`：配置面板样式集中但包含注释遗留；清理无效片段并组件化；阶段 P2。
- `src/styles/overlay-dialog.css`：将并入统一 dialog 主题样式；阶段 P1/P2。
- `src/styles/taskbar.css`：保留任务栏专属样式，移除对 overlay 的隐式依赖；阶段 P2。
- `src/styles/toolkit.css`：体量大，需按 tab 维度拆分；阶段 P2。
- `src/styles/transitions.css`：可用；统一动效时间 token；阶段 P2。

## 6.8 静态资源
- `src/static/img/logo.png`：检查分辨率与体积，生成 webp 版本；阶段 P3。
- `src/static/img/image.png`：同上；阶段 P3。
- `src/static/img/ice_logo.png`：同上；阶段 P3。
- `src/static/img/ice.png`：同上；阶段 P3。

## 7. 关键验收指标（前端）

1. 文件体量：
   - `src/stores/app.ts` 拆分后每个 store <= 400 行
   - `src/pages/index.vue` <= 400 行
   - `src/composables/useThemeManager.ts` <= 350 行
2. 一致性：
   - 全部设置项通过统一 `storageRepository` 读写
   - 统一窗口能力全部走 `windowManager`
3. 质量：
   - `npm run typecheck`、`npm run lint`、`npm run test` 可持续通过
4. 行为稳定：
   - 多窗口设置同步、任务栏置顶/全屏隐藏、主题导入导出回归通过
5. 清理完成：
   - `src` 下无 `.bak.vue` 遗留文件
   - 硬编码非 i18n 文案全部收敛到 locale

## 8. 执行顺序建议（最小风险）

1. 先做 P0：清理备份文件、统一存储入口、建立窗口管理抽象。
2. 再做 P1：拆 store 与页面主流程，统一 Dialog。
3. 再做 P2：组件/样式深度重构与复用抽象。
4. 最后做 P3：测试、CI、资源体积优化与回归脚本。

该顺序可保证“每一步都可单独回滚”，并且不阻断现有功能迭代。
