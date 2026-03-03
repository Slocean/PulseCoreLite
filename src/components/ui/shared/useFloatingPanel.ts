import { nextTick, onBeforeUnmount, onMounted, type Ref, watch } from 'vue';

type FloatingWidthMode = 'min' | 'match';

interface UseFloatingPanelOptions {
  rootRef: Ref<HTMLElement | null>;
  triggerRef: Ref<HTMLElement | null>;
  panelRef: Ref<HTMLElement | null>;
  isOpen: Ref<boolean>;
  panelStyle: Ref<Record<string, string>>;
  estimatedHeight?: number;
  minWidth?: number;
  offset?: number;
  viewportPadding?: number;
  widthMode?: FloatingWidthMode;
  onAfterOpen?: () => void;
}

const DEFAULT_ESTIMATED_HEIGHT = 220;
const DEFAULT_OFFSET = 4;
const DEFAULT_VIEWPORT_PADDING = 8;

export function useFloatingPanel(options: UseFloatingPanelOptions) {
  const estimatedHeight = options.estimatedHeight ?? DEFAULT_ESTIMATED_HEIGHT;
  const minWidth = options.minWidth ?? 0;
  const offset = options.offset ?? DEFAULT_OFFSET;
  const viewportPadding = options.viewportPadding ?? DEFAULT_VIEWPORT_PADDING;
  const widthMode = options.widthMode ?? 'min';

  function updatePanelPosition() {
    if (!options.isOpen.value) return;
    const trigger = options.triggerRef.value;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const triggerWidth = Math.round(rect.width);
    const preferredWidth = Math.max(minWidth, triggerWidth);
    const renderedWidth = options.panelRef.value?.offsetWidth ?? preferredWidth;
    const panelWidth = widthMode === 'match' ? preferredWidth : renderedWidth;
    const panelHeight = options.panelRef.value?.offsetHeight ?? estimatedHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = Math.round(rect.left);
    let top = Math.round(rect.bottom + offset);

    if (left + panelWidth > viewportWidth - viewportPadding) {
      left = Math.max(viewportPadding, viewportWidth - panelWidth - viewportPadding);
    }
    if (top + panelHeight > viewportHeight - viewportPadding) {
      top = Math.max(viewportPadding, Math.round(rect.top - panelHeight - offset));
    }

    const style: Record<string, string> = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`
    };

    if (widthMode === 'match') {
      style.width = `${preferredWidth}px`;
    } else {
      style.minWidth = `${preferredWidth}px`;
    }

    options.panelStyle.value = style;
  }

  function setOpen(nextOpen: boolean) {
    options.isOpen.value = nextOpen;
  }

  function toggleOpen() {
    setOpen(!options.isOpen.value);
  }

  function closePanel() {
    setOpen(false);
  }

  function onDocumentPointerDown(event: PointerEvent) {
    if (!options.isOpen.value) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (options.rootRef.value?.contains(target)) return;
    if (options.panelRef.value?.contains(target)) return;
    closePanel();
  }

  function onDocumentKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !options.isOpen.value) return;
    closePanel();
  }

  watch(
    options.isOpen,
    open => {
      if (!open) return;
      void nextTick(() => {
        updatePanelPosition();
        options.onAfterOpen?.();
      });
    },
    { immediate: false }
  );

  onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    document.removeEventListener('keydown', onDocumentKeyDown);
    window.removeEventListener('resize', updatePanelPosition);
    window.removeEventListener('scroll', updatePanelPosition, true);
  });

  return {
    closePanel,
    setOpen,
    toggleOpen,
    updatePanelPosition
  };
}
