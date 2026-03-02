<template>
  <Transition name="toast">
    <div v-if="props.open && props.message" class="ui-toast-layer" :aria-live="props.ariaLive">
      <div class="ui-toast">
        {{ props.message }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { ToastProps } from "./types";

const props = withDefaults(defineProps<ToastProps>(), {
  ariaLive: "polite"
});
</script>

<style scoped>
.ui-toast-layer {
  position: fixed;
  top: 8px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: 9999;
  pointer-events: none;
}

.ui-toast {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
</style>
