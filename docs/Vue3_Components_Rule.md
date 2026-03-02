Vue3 UI 组件封装规范
技术栈：Vue3 + TypeScript + 纯自定义样式 · 个人项目版

一、目录结构
src/components/ui/
├── Button/
│ ├── index.vue # 组件实现
│ └── types.ts # Props/Emits 类型
├── Input/
│ ├── index.vue
│ └── types.ts
└── index.ts # 统一导出
规则很简单：一个组件一个文件夹，复杂组件才拆子文件，小组件不过度设计。

二、文件模板（标准结构）
每个 index.vue 统一按以下顺序组织，保持一致的阅读习惯：
vue<script setup lang="ts">
// 1. 外部依赖 import
// 2. 内部组件 import  
// 3. Props / Emits / Slots 定义
// 4. 响应式状态
// 5. 计算属性
// 6. 方法
// 7. 生命周期
// 8. defineExpose（如有）
</script>

<template>
  <!-- 根元素唯一，语义化标签优先 -->
</template>

<style scoped lang="css">
/* BEM 命名，CSS 变量驱动主题 */
</style>

三、TypeScript 类型规范
类型统一写在 types.ts，组件内直接 import 使用。
typescript// types.ts

// ✅ Props 用 interface，方便扩展
export interface ButtonProps {
type?: 'primary' | 'default' | 'danger' | 'ghost'
size?: 'sm' | 'md' | 'lg'
disabled?: boolean
loading?: boolean
}

// ✅ 复杂数据结构单独定义，不要内联写在 Props 里
export interface SelectOption {
label: string
value: string | number
disabled?: boolean
}

// ✅ 使用字面量联合类型代替枚举（运行时更轻量）
export type ButtonType = ButtonProps['type']
export type ButtonSize = ButtonProps['size']
vue<script setup lang="ts">
import { withDefaults, defineProps } from 'vue'
import type { ButtonProps } from './types'

// ✅ 泛型语法声明 Props，withDefaults 补全默认值
const props = withDefaults(defineProps<ButtonProps>(), {
type: 'default',
size: 'md',
disabled: false,
loading: false,
})
</script>
核心规则：

禁止使用 any，实在不确定用 unknown 再收窄
Props 字段能精确到字面量联合类型的，不用 string 兜底
从 Vue 导入的工具类型（Ref、ComputedRef 等）必须用 import type

四、Props 规范
vue<script setup lang="ts">
// ✅ v-model 统一用 modelValue，多个 v-model 用具体名称
const props = withDefaults(defineProps<{
modelValue: string // v-model
visible: boolean // v-model:visible  
 placeholder?: string
maxLength?: number
}>(), {
placeholder: '请输入',
maxLength: 200,
})

// ✅ 需要修改 props 时，用本地 ref 中转，绝不直接修改
const localValue = ref(props.modelValue)

// ✅ 保持与外部同步
watch(() => props.modelValue, (val) => {
localValue.value = val
})
</script>

五、Emits 规范
vue<script setup lang="ts">
// ✅ 泛型语法显式声明，每个事件的参数类型都要写清楚
const emit = defineEmits<{
'update:modelValue': [value: string] // v-model
'update:visible': [value: boolean] // v-model:visible
'change': [value: string] // 值变化（用户操作触发）
'blur': [event: FocusEvent] // 透传原生事件
'clear': [] // 无参数事件
}>()

// ✅ 事件命名语义：
// - 状态同步用 update:xxx
// - 用户行为用动词：change / select / close / confirm / cancel
// - 透传原生事件保持原名：click / blur / focus
</script>

六、插槽规范
vue<script setup lang="ts">
// ✅ Vue 3.3+ 声明插槽类型
defineSlots<{
default?: () => any // 主内容
prefix?: () => any // 前置区域
suffix?: () => any // 后置区域  
 empty?: () => any // 空状态
item?: (props: { row: ListItem, index: number }) => any // 作用域插槽
}>()
</script>

<template>
  <div class="ui-select">
    <!-- ✅ 提供有意义的 fallback，不要空插槽裸奔 -->
    <slot name="prefix" />

    <slot />

    <!-- ✅ 作用域插槽：把数据向上暴露，让父组件决定渲染 -->
    <ul>
      <li v-for="(item, index) in list" :key="item.id">
        <slot name="item" :row="item" :index="index">
          <!-- fallback：默认渲染方式 -->
          <span>{{ item.label }}</span>
        </slot>
      </li>
    </ul>

    <!-- ✅ 空状态插槽，给使用者自定义空态的机会 -->
    <slot v-if="!list.length" name="empty">
      <span class="ui-select__empty">暂无数据</span>
    </slot>

  </div>
</template>
插槽设计原则：

凡是「内容」区域都给插槽，凡是「结构」区域才写死 DOM
列表类组件必须提供 item 作用域插槽 + empty 空态插槽
插槽要有 fallback，不让使用者必须填内容才能正常显示

七、组合式 API 规范
vue<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// ✅ 响应式数据：明确类型，不靠推断处理复杂结构
const count = ref<number>(0)
const list = ref<ListItem[]>([])
const userInfo = ref<UserInfo | null>(null)

// ✅ 计算属性：只做派生，不做副作用
const isEmpty = computed(() => list.value.length === 0)
const displayText = computed(() =>
props.modelValue?.trim() || props.placeholder
)

// ✅ watch：精确监听，避免监听整个对象
watch(() => props.modelValue, (newVal, oldVal) => {
// 做同步或副作用
}, { immediate: true })

// ✅ 逻辑超过 50 行考虑抽成 composable
// 放到 src/composables/useXxx.ts
function useDropdown() {
const visible = ref(false)
const open = () => { visible.value = true }
const close = () => { visible.value = false }
return { visible, open, close }
}

const { visible, open, close } = useDropdown()

// ✅ defineExpose：只暴露必要方法，不暴露内部状态
defineExpose({ focus, clear, validate })
</script>

八、样式规范
css/_ ✅ 统一用 scoped，根类名用 ui- 前缀区分 _/
/_ ✅ BEM：block\_\_element--modifier _/
/_ ✅ CSS 变量驱动，方便主题切换 _/

.ui-button {
/_ 组件级变量：外部可通过 CSS 变量覆盖 _/
--btn-height: 36px;
--btn-padding: 0 16px;
--btn-radius: 6px;
--btn-bg: #4f6ef7;
--btn-color: #fff;
--btn-font-size: 14px;

display: inline-flex;
align-items: center;
justify-content: center;
height: var(--btn-height);
padding: var(--btn-padding);
border-radius: var(--btn-radius);
background: var(--btn-bg);
color: var(--btn-color);
font-size: var(--btn-font-size);
cursor: pointer;
border: none;
transition: opacity 0.2s, transform 0.1s;

/_ BEM Modifier _/
&--danger { --btn-bg: #ef4444; }
&--ghost { --btn-bg: transparent; --btn-color: #4f6ef7; }
&--sm { --btn-height: 28px; --btn-padding: 0 10px; }
&--lg { --btn-height: 44px; --btn-padding: 0 24px; }

/_ BEM Element _/
&**icon { margin-right: 6px; }
&**spinner { animation: spin 0.8s linear infinite; }

/_ 状态 _/
&:hover:not(:disabled) { opacity: 0.85; }
&:active:not(:disabled) { transform: scale(0.97); }
&:disabled { opacity: 0.4; cursor: not-allowed; }
}

@keyframes spin {
to { transform: rotate(360deg); }
}

九、透传属性规范
vue<script setup lang="ts">
// ✅ 包装型组件（根元素不是核心交互元素时）关闭自动继承
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="ui-input-wrapper">
    <!--
      ✅ 手动将 $attrs 绑到核心元素
      这样外部的 class / style / 原生事件 会落在 input 上，而不是 wrapper
    -->
    <input
      v-bind="$attrs"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
```

---

### 十、何时该抽组件

个人项目不必过度抽象，按这个标准判断：

```
重复出现 2 次以上          → 抽
逻辑超过 150 行            → 抽
可以用一个名词描述它       → 抽
只用一次且不会复用         → 不抽
为了"整洁"强行拆分        → 不抽

十一、统一导出
typescript// src/components/ui/index.ts

// 组件
export { default as UiButton }   from './Button'
export { default as UiInput }    from './Input'
export { default as UiSelect }   from './Select'
export { default as UiModal }    from './Modal'

// 类型（用 export type 避免打包到运行时）
export type { ButtonProps, ButtonType } from './Button/types'
export type { InputProps }             from './Input/types'
typescript// main.ts —— 个人项目直接全局注册省事
import * as UiComponents from '@/components/ui'

const app = createApp(App)
Object.entries(UiComponents).forEach(([name, comp]) => {
  if (typeof comp === 'function' || typeof comp === 'object') {
    app.component(name, comp as Component)
  }
})
```
