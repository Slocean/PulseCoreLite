# UIButton Style Rules

## 1. 目标

将页面分散定义的按钮样式统一收敛到 `UIButton` 组件，通过配置项控制外观，避免页面重复写样式。

## 2. 统一规则

1. 页面/业务组件中，`UiButton` 不再通过自定义 `class` 承担“外观样式”职责。
2. 按钮外观统一使用 `preset` 配置。
3. 按钮激活态统一使用 `:active="boolean"`，不再使用 `--active` class。
4. `type/size/variant` 仍保留为基础能力；`preset` 用于业务场景风格。
5. 页面样式文件只保留布局容器类，不保留按钮外观类。

## 3. API 约定

`src/components/ui/Button/types.ts`:

- `ButtonPreset` 新增并作为 `ButtonProps.preset`。
- 默认值：`preset: 'default'`。

`src/components/ui/Button/index.vue`:

- 根节点 class 新增：`ui-button--preset-${props.preset}`。
- 通过 CSS 变量驱动预设，不在页面写重复按钮样式。

## 4. 预设清单

当前可用 `preset`：

- `default`
- `overlay-chip`
- `overlay-chip-soft`
- `overlay-chip-tab`
- `overlay-chip-action`
- `overlay-primary`
- `overlay-danger`
- `overlay-action-info`
- `overlay-action-primary`
- `overlay-action-danger`
- `overlay-version`
- `overlay-dialog-close`
- `overlay-corner-danger`
- `overlay-corner-primary`
- `toolkit-tab`
- `toolkit-collapse`
- `toolkit-collapse-title`
- `toolkit-collapse-icon`
- `toolkit-view-toggle`
- `toolkit-link`
- `ui-dialog-close`
- `ui-dialog-cancel`
- `ui-dialog-confirm`

## 5. 使用示例

```vue
<UiButton preset="overlay-primary" @click="onSubmit">提交</UiButton>

<UiButton preset="overlay-chip" :active="lang === 'zh-CN'" @click="lang = 'zh-CN'">
  中文
</UiButton>

<UiButton preset="toolkit-tab" :active="tab === 'hardware'" @click="tab = 'hardware'">
  Hardware
</UiButton>
```

## 6. 旧样式到新配置映射

- `overlay-lang-button` -> `preset="overlay-chip"`
- `overlay-lang-button`（效果切换场景）-> `preset="overlay-chip-soft"`
- `overlay-lang-button`（主题 tab 场景）-> `preset="overlay-chip-tab"`
- `overlay-lang-button`（action 区域）-> `preset="overlay-chip-action"`
- `overlay-lang-button--active` -> `:active="..."`
- `overlay-config-primary` -> `preset="overlay-primary"`
- `overlay-config-danger` -> `preset="overlay-danger"`
- `overlay-action overlay-action--info` -> `preset="overlay-action-info"`
- `overlay-action overlay-action--primary` -> `preset="overlay-action-primary"`
- `overlay-action overlay-action--danger` -> `preset="overlay-action-danger"`
- `version + version--update` -> `preset="overlay-version" + :active="updateAvailable"`
- `overlay-dialog-close` -> `preset="overlay-dialog-close"`
- `overlay-corner-delete` -> `preset="overlay-corner-danger"`
- `overlay-corner-edit` -> `preset="overlay-corner-primary"`
- `toolkit-tab + toolkit-tab--active` -> `preset="toolkit-tab" + :active="..."`
- `toolkit-collapse-toggle` -> `preset="toolkit-collapse"`
- `toolkit-collapse-toggle--title` -> `preset="toolkit-collapse-title"`
- `toolkit-collapse-toggle--icon` -> `preset="toolkit-collapse-icon"`
- `toolkit-view-toggle` -> `preset="toolkit-view-toggle"`
- `toolkit-link-label` -> `preset="toolkit-link"`
- `ui-dialog-close` -> `preset="ui-dialog-close"`
- `ui-dialog-btn--cancel` -> `preset="ui-dialog-cancel"`
- `ui-dialog-btn--confirm` -> `preset="ui-dialog-confirm"`

## 7. 禁止事项

1. 禁止在页面新增 `overlay-xxx-button`、`toolkit-xxx-button` 之类按钮外观 class。
2. 禁止通过页面 CSS 覆盖 `UiButton` 外观（除布局定位等必要场景）。
3. 禁止为激活态新增 class，统一使用 `active`。

## 8. 新增按钮样式流程

1. 先判断是否已有 `preset` 可复用。
2. 若无可复用，在 `ButtonPreset` 增加新枚举。
3. 在 `UIButton` 内新增对应 `ui-button--preset-*` 规则。
4. 页面使用新 `preset`，不要新增页面级按钮外观样式。
5. 若替换旧样式，删除旧 class 与旧 CSS 规则。

## 9. 受影响文件（本次改造）

- `src/components/ui/Button/types.ts`
- `src/components/ui/Button/index.vue`
- `src/components/OverlayConfigPanel.vue`
- `src/pages/index.vue`
- `src/components/OverlayHeader.vue`
- `src/components/OverlayDialog.vue`
- `src/components/OverlayCornerDelete.vue`
- `src/components/toolkit/ToolkitTabs.vue`
- `src/components/toolkit/ToolkitHardwareTab.vue`
- `src/components/toolkit/ToolkitShutdownTab.vue`
- `src/components/toolkit/ToolkitCleanupTab.vue`
- `src/pages/toolkit.vue`
- `src/components/ui/Dialog/index.vue`
- `src/styles/overlay-config.css`
- `src/styles/overlay.css`
- `src/styles/overlay-dialog.css`
- `src/styles/toolkit.css`

