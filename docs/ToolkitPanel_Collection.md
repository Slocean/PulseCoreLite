# Toolkit 面板收集与封装映射

## 封装组件
- 组件路径：`src/components/ui/ToolkitPanel`
- 目标：统一 `toolkit-card` 面板结构，支持折叠与非折叠、标准头部与带操作区头部。

## 组件属性与插槽
- `title: string`：面板标题。
- `modelValue?: boolean`：折叠状态（`v-model` 双向绑定）。
- `collapsible?: boolean`：是否可折叠，默认 `true`。
- `headerMode?: 'single' | 'split'`：头部布局。
  - `single`：整行折叠按钮（标题 + 箭头）。
  - `split`：标题按钮 + 中间操作区 + 箭头按钮。
- `toggleAriaLabel?: string`：右侧折叠按钮无障碍文案。
- `titleAriaLabel?: string`：标题无障碍文案（备用）。
- `contentClass?: string`：内容区 class。
- `cardClass?: string`：卡片附加 class。
- `#header-actions`：`split` 模式中部操作区插槽。
- 默认插槽：面板内容区。

## 当前已接入面板清单
### Reminder Tab (`src/components/toolkit/ToolkitReminderTab.vue`)
- `reminderTitle`：提醒汇总；折叠；展示总数/启用数。
- `reminderCreate/reminderEdit`：创建/编辑提醒；折叠；`split` 头部；中部操作为 `SMTP 配置` 按钮；内容包含标题、提醒方式、邮箱（条件显示）、启用开关。
- `reminderSchedule`：调度规则；折叠；包含每日/每周/每月时间槽增删。
- `reminderContent`：内容配置；折叠；内容类型切换 + 保存/重置动作。
- `reminderList`：提醒列表；折叠；空态和列表态，含启用切换、编辑、立即触发、删除。

### Hardware Tab (`src/components/toolkit/ToolkitHardwareTab.vue`)
- `hardwareScoreTitle`：总分面板；折叠；附加 `cardClass='toolkit-card--score'`。
- `dimensionTitle`：维度分析；折叠；`split` 头部；中部操作为“雷达/条形视图切换”。
- `hardwareSummaryTitle`：硬件摘要；折叠；键值展示。
- `hardwareAdviceTitle`：优化建议；折叠；建议列表。

### Cleanup Tab (`src/components/toolkit/ToolkitCleanupTab.vue`)
- `cleanupTitle`：清理配置；非折叠；开关、间隔、目标选择。
- `profileTitle`：性能采样；非折叠；路径设置、采样参数、开始/停止与状态。

### Shutdown Tab (`src/components/toolkit/ToolkitShutdownTab.vue`)
- `countdownTitle`：倒计时关机；非折叠；时分秒输入 + 提交。
- `datetimeTitle`：按日期时间关机；非折叠；日期/时间/重复模式配置 + 提交。
- `currentPlan`：当前计划；非折叠；计划展示 + 取消计划。
