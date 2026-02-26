import { computed, nextTick, reactive, ref, watch, type Ref } from 'vue';

import { kvGet, kvSet } from '../utils/kv';
import {
  DEFAULT_BACKGROUND_EFFECT,
  DEFAULT_BACKGROUND_GLASS_STRENGTH,
  type OverlayBackgroundEffect,
  type OverlayPrefs
} from './useOverlayPrefs';

export type OverlayTheme = {
  id: string;
  name: string;
  image: string;
  blurPx: number;
  effect: OverlayBackgroundEffect;
  glassStrength: number;
};

const THEME_STORAGE_KEY = 'pulsecorelite.overlay_themes';

export function clampBlurPx(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(40, Math.round(value))) : 0;
}

export function clampGlassStrength(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : DEFAULT_BACKGROUND_GLASS_STRENGTH;
}

export function normalizeBackgroundEffect(value: unknown): OverlayBackgroundEffect {
  return value === 'liquidGlass' ? 'liquidGlass' : DEFAULT_BACKGROUND_EFFECT;
}

function getBackgroundFilter(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  const safeBlur = clampBlurPx(blurPx);
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    const minBlur = Math.max(2, safeBlur);
    const saturation = (1.25 + safeStrength / 140).toFixed(2);
    const contrast = (1.05 + safeStrength / 420).toFixed(2);
    const brightness = (1.01 + safeStrength / 900).toFixed(2);
    return `blur(${minBlur}px) saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`;
  }
  return safeBlur > 0 ? `blur(${safeBlur}px)` : 'none';
}

function getBackgroundScale(effect: OverlayBackgroundEffect, blurPx: number, glassStrength: number) {
  if (effect === 'liquidGlass') {
    const safeStrength = clampGlassStrength(glassStrength);
    return (1.06 + safeStrength / 1000).toFixed(3);
  }
  return (clampBlurPx(blurPx) > 0 ? 1.05 : 1).toString();
}

export function sanitizeThemes(input: unknown): OverlayTheme[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String((item as any).id),
      name: String((item as any).name),
      image: String((item as any).image),
      blurPx: clampBlurPx((item as any).blurPx),
      effect: normalizeBackgroundEffect((item as any).effect),
      glassStrength: clampGlassStrength((item as any).glassStrength)
    }))
    .filter(item => item.id && item.name && item.image);
}

function loadThemesFromLocalStorage(): OverlayTheme[] {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return sanitizeThemes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function useThemeManager(options: { prefs: OverlayPrefs; overlayRef: Ref<HTMLElement | null> }) {
  const { prefs, overlayRef } = options;

  const backgroundDialogOpen = ref(false);
  const backgroundImageSource = ref<string | null>(null);
  const backgroundFileName = ref('');
  const backgroundFileInput = ref<HTMLInputElement | null>(null);
  const cropCanvas = ref<HTMLCanvasElement | null>(null);
  const isDragging = ref(false);
  const backgroundImage = ref<HTMLImageElement | null>(null);
  const cropAspect = ref(1.6);
  const cropRect = reactive({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  const dragState = reactive({
    active: false,
    mode: 'move' as 'move' | 'resize',
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    originW: 0,
    originH: 0
  });
  const imageFit = reactive({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    drawWidth: 0,
    drawHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0
  });

  const themes = ref<OverlayTheme[]>([]);
  const themeNameDialogOpen = ref(false);
  const themeNameInput = ref('');
  const pendingThemeImage = ref<string | null>(null);
  const pendingThemeBlurPx = ref(0);
  const pendingThemeEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
  const pendingThemeGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);
  const themeDeleteDialogOpen = ref(false);
  const themeToDelete = ref<OverlayTheme | null>(null);
  const backgroundBlurPx = ref(0);
  const backgroundEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
  const backgroundGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);

  const themeEditDialogOpen = ref(false);
  const themeToEdit = ref<OverlayTheme | null>(null);
  const themeEditNameInput = ref('');
  const themeEditBlurPx = ref(0);
  const themeEditEffect = ref<OverlayBackgroundEffect>(DEFAULT_BACKGROUND_EFFECT);
  const themeEditGlassStrength = ref(DEFAULT_BACKGROUND_GLASS_STRENGTH);

  let currentObjectUrl: string | null = null;

  if (typeof window !== 'undefined') {
    themes.value = loadThemesFromLocalStorage();
    void hydrateThemes();
  }

  const applyBackgroundOpacity = (value: number) => {
    if (typeof document === 'undefined') {
      return;
    }
    const safeValue = Math.min(100, Math.max(0, value));
    document.documentElement.style.setProperty('--overlay-bg-opacity', String(safeValue / 100));
  };

  watch(
    () => prefs.backgroundOpacity,
    value => {
      applyBackgroundOpacity(value);
    },
    { immediate: true }
  );

  const overlayBackgroundStyle = computed(() => {
    if (!prefs.backgroundImage) {
      return {};
    }
    const effect = normalizeBackgroundEffect(prefs.backgroundEffect);
    const blurPx = clampBlurPx(prefs.backgroundBlurPx);
    const glassStrength = clampGlassStrength(prefs.backgroundGlassStrength);
    return {
      backgroundImage: `url(${prefs.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      filter: getBackgroundFilter(effect, blurPx, glassStrength),
      transform: `scale(${getBackgroundScale(effect, blurPx, glassStrength)})`
    };
  });

  const showLiquidGlassHighlight = computed(() => {
    return Boolean(prefs.backgroundImage && normalizeBackgroundEffect(prefs.backgroundEffect) === 'liquidGlass');
  });

  const overlayLiquidGlassHighlightStyle = computed(() => {
    const safeStrength = clampGlassStrength(prefs.backgroundGlassStrength);
    const opacity = (0.08 + safeStrength / 600).toFixed(3);
    return {
      opacity,
      background:
        'radial-gradient(circle at 20% -10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%), linear-gradient(165deg, rgba(255,255,255,0.2), rgba(120,180,255,0.08) 38%, rgba(0,0,0,0) 75%)'
    };
  });

  const canApplyBackground = computed(() => {
    return Boolean(backgroundImage.value && cropRect.width > 0 && cropRect.height > 0);
  });
  const canSaveTheme = computed(() => themes.value.length < 3);
  const canConfirmThemeName = computed(() => {
    const value = themeNameInput.value.trim();
    return Boolean(value && value.length <= 3 && pendingThemeImage.value);
  });

  function openBackgroundDialog() {
    backgroundDialogOpen.value = true;
    resetBackgroundDialogState();
    nextTick(() => refreshCropAspect());
  }

  function closeBackgroundDialog() {
    backgroundDialogOpen.value = false;
    isDragging.value = false;
    handleCropMouseUp();
    resetBackgroundDialogState();
  }

  function resetBackgroundDialogState() {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    backgroundFileName.value = '';
    backgroundImageSource.value = null;
    backgroundImage.value = null;
    if (cropCanvas.value) {
      cropCanvas.value.width = 0;
      cropCanvas.value.height = 0;
    }
    backgroundEffect.value = prefs.backgroundImage
      ? normalizeBackgroundEffect(prefs.backgroundEffect)
      : DEFAULT_BACKGROUND_EFFECT;
    backgroundGlassStrength.value = prefs.backgroundImage
      ? clampGlassStrength(prefs.backgroundGlassStrength)
      : DEFAULT_BACKGROUND_GLASS_STRENGTH;
    backgroundBlurPx.value = prefs.backgroundImage ? clampBlurPx(prefs.backgroundBlurPx) : 5;
    cropRect.x = 0;
    cropRect.y = 0;
    cropRect.width = 0;
    cropRect.height = 0;
  }

  function setBackgroundEffect(effect: OverlayBackgroundEffect) {
    backgroundEffect.value = effect;
    if (effect === 'liquidGlass' && backgroundBlurPx.value < 2) {
      backgroundBlurPx.value = 2;
    }
    drawCropCanvas();
  }

  function refreshCropAspect() {
    const rect = overlayRef.value?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      cropAspect.value = rect.width / rect.height;
      return;
    }
    cropAspect.value = 1.6;
  }

  function triggerFileInput() {
    backgroundFileInput.value?.click();
  }

  function handleDragOver() {
    isDragging.value = true;
  }

  function handleDragLeave() {
    isDragging.value = false;
  }

  function handleDrop(event: DragEvent) {
    isDragging.value = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    handleFile(file);
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    handleFile(file);
    if (input) {
      input.value = '';
    }
  }

  function persistThemes(next: OverlayTheme[]) {
    if (typeof window === 'undefined') {
      return;
    }
    void kvSet(THEME_STORAGE_KEY, next);
  }

  function updateThemes(next: OverlayTheme[]) {
    themes.value = next;
    persistThemes(next);
  }

  async function hydrateThemes() {
    const fromKv = await kvGet<unknown>(THEME_STORAGE_KEY);
    const parsed = sanitizeThemes(fromKv);
    if (parsed.length) {
      themes.value = parsed;
    } else if (themes.value.length) {
      await kvSet(THEME_STORAGE_KEY, themes.value);
    }

    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
  }

  function requestDeleteTheme(id: string) {
    const target = themes.value.find(theme => theme.id === id) ?? null;
    if (!target) {
      return;
    }
    themeToDelete.value = target;
    themeDeleteDialogOpen.value = true;
  }

  function closeDeleteThemeDialog() {
    themeDeleteDialogOpen.value = false;
    themeToDelete.value = null;
  }

  function isThemeApplied(theme: OverlayTheme) {
    return (
      prefs.backgroundImage === theme.image &&
      clampBlurPx(prefs.backgroundBlurPx) === clampBlurPx(theme.blurPx) &&
      normalizeBackgroundEffect(prefs.backgroundEffect) === normalizeBackgroundEffect(theme.effect) &&
      clampGlassStrength(prefs.backgroundGlassStrength) === clampGlassStrength(theme.glassStrength)
    );
  }

  function confirmDeleteTheme() {
    const target = themeToDelete.value;
    if (!target) {
      closeDeleteThemeDialog();
      return;
    }
    const wasApplied = isThemeApplied(target);
    const nextThemes = themes.value.filter(theme => theme.id !== target.id);
    updateThemes(nextThemes);
    if (wasApplied) {
      prefs.backgroundImage = null;
      prefs.backgroundBlurPx = 0;
      prefs.backgroundEffect = DEFAULT_BACKGROUND_EFFECT;
      prefs.backgroundGlassStrength = DEFAULT_BACKGROUND_GLASS_STRENGTH;
    }
    closeDeleteThemeDialog();
  }

  const canConfirmThemeEdit = computed(() => {
    const target = themeToEdit.value;
    if (!target) return false;
    const name = themeEditNameInput.value.trim();
    if (!name || name.length > 3) return false;
    if (!Number.isFinite(themeEditBlurPx.value) || themeEditBlurPx.value < 0 || themeEditBlurPx.value > 24) {
      return false;
    }
    return (
      Number.isFinite(themeEditGlassStrength.value) &&
      themeEditGlassStrength.value >= 0 &&
      themeEditGlassStrength.value <= 100
    );
  });

  function requestEditTheme(id: string) {
    const target = themes.value.find(theme => theme.id === id) ?? null;
    if (!target) return;
    themeToEdit.value = target;
    themeEditNameInput.value = target.name;
    themeEditBlurPx.value = Math.max(0, Math.min(24, Math.round(target.blurPx ?? 0)));
    themeEditEffect.value = normalizeBackgroundEffect(target.effect);
    themeEditGlassStrength.value = clampGlassStrength(target.glassStrength);
    themeEditDialogOpen.value = true;
  }

  function closeEditThemeDialog() {
    themeEditDialogOpen.value = false;
    themeToEdit.value = null;
    themeEditNameInput.value = '';
    themeEditBlurPx.value = 0;
    themeEditEffect.value = DEFAULT_BACKGROUND_EFFECT;
    themeEditGlassStrength.value = DEFAULT_BACKGROUND_GLASS_STRENGTH;
  }

  function confirmEditTheme() {
    const target = themeToEdit.value;
    if (!target || !canConfirmThemeEdit.value) {
      closeEditThemeDialog();
      return;
    }
    const wasApplied = isThemeApplied(target);
    const nextName = themeEditNameInput.value.trim().slice(0, 3);
    const nextBlur = Math.max(0, Math.min(24, Math.round(themeEditBlurPx.value)));
    const nextEffect = normalizeBackgroundEffect(themeEditEffect.value);
    const nextGlassStrength = clampGlassStrength(themeEditGlassStrength.value);
    const nextThemes = themes.value.map(theme =>
      theme.id === target.id
        ? { ...theme, name: nextName, blurPx: nextBlur, effect: nextEffect, glassStrength: nextGlassStrength }
        : theme
    );
    updateThemes(nextThemes);

    if (wasApplied) {
      prefs.backgroundBlurPx = nextBlur;
      prefs.backgroundEffect = nextEffect;
      prefs.backgroundGlassStrength = nextGlassStrength;
    }

    closeEditThemeDialog();
  }

  function openThemeNameDialog(image: string) {
    pendingThemeImage.value = image;
    pendingThemeBlurPx.value = backgroundBlurPx.value;
    pendingThemeEffect.value = backgroundEffect.value;
    pendingThemeGlassStrength.value = backgroundGlassStrength.value;
    themeNameInput.value = '';
    themeNameDialogOpen.value = true;
  }

  function closeThemeNameDialog() {
    themeNameDialogOpen.value = false;
    pendingThemeImage.value = null;
    pendingThemeBlurPx.value = 0;
    pendingThemeEffect.value = DEFAULT_BACKGROUND_EFFECT;
    pendingThemeGlassStrength.value = DEFAULT_BACKGROUND_GLASS_STRENGTH;
  }

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      return;
    }
    backgroundFileName.value = file.name;
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    const objectUrl = URL.createObjectURL(file);
    currentObjectUrl = objectUrl;
    backgroundImageSource.value = objectUrl;
    void loadBackgroundImage(objectUrl);
  }

  async function loadBackgroundImage(src: string) {
    const img = new Image();
    img.onload = async () => {
      backgroundImage.value = img;
      if (currentObjectUrl === src) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      await nextTick();
      updateCanvasFromImage();
    };
    img.src = src;
  }

  function updateCanvasFromImage() {
    const canvas = cropCanvas.value;
    const img = backgroundImage.value;
    if (!canvas || !img) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    imageFit.canvasWidth = canvas.width;
    imageFit.canvasHeight = canvas.height;
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    imageFit.scale = scale;
    imageFit.drawWidth = img.width * scale;
    imageFit.drawHeight = img.height * scale;
    imageFit.offsetX = (canvas.width - imageFit.drawWidth) / 2;
    imageFit.offsetY = (canvas.height - imageFit.drawHeight) / 2;
    resetCropRect();
    drawCropCanvas();
  }

  function resetCropRect() {
    if (!backgroundImage.value) {
      return;
    }
    const maxWidth = imageFit.drawWidth * 0.8;
    let width = maxWidth;
    let height = width / cropAspect.value;
    if (height > imageFit.drawHeight * 0.8) {
      height = imageFit.drawHeight * 0.8;
      width = height * cropAspect.value;
    }
    width = Math.max(40, width);
    height = Math.max(40, height);
    cropRect.width = width;
    cropRect.height = height;
    cropRect.x = imageFit.offsetX + (imageFit.drawWidth - width) / 2;
    cropRect.y = imageFit.offsetY + (imageFit.drawHeight - height) / 2;
  }

  function drawCropCanvas() {
    const canvas = cropCanvas.value;
    const img = backgroundImage.value;
    if (!canvas || !img) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const effect = normalizeBackgroundEffect(backgroundEffect.value);
    const blurPx = Math.max(0, Math.min(24, Math.round(backgroundBlurPx.value)));
    const glassStrength = clampGlassStrength(backgroundGlassStrength.value);
    ctx.filter = getBackgroundFilter(effect, blurPx, glassStrength);
    ctx.drawImage(img, imageFit.offsetX, imageFit.offsetY, imageFit.drawWidth, imageFit.drawHeight);
    ctx.filter = 'none';
    if (effect === 'liquidGlass') {
      const gloss = 0.08 + glassStrength / 650;
      const gradient = ctx.createLinearGradient(
        imageFit.offsetX,
        imageFit.offsetY,
        imageFit.offsetX,
        imageFit.offsetY + imageFit.drawHeight
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.22, gloss + 0.05).toFixed(3)})`);
      gradient.addColorStop(0.5, 'rgba(200, 230, 255, 0.06)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(imageFit.offsetX, imageFit.offsetY, imageFit.drawWidth, imageFit.drawHeight);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.9)';
    ctx.lineWidth = Math.max(1, Math.round(window.devicePixelRatio || 1));
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  }

  function getCanvasPoint(event: MouseEvent) {
    const canvas = cropCanvas.value;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function handleCropMouseDown(event: MouseEvent) {
    if (!backgroundImage.value) {
      return;
    }
    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    const inX = point.x >= cropRect.x && point.x <= cropRect.x + cropRect.width;
    const inY = point.y >= cropRect.y && point.y <= cropRect.y + cropRect.height;
    dragState.active = true;
    dragState.startX = point.x;
    dragState.startY = point.y;
    dragState.originX = cropRect.x;
    dragState.originY = cropRect.y;
    dragState.originW = cropRect.width;
    dragState.originH = cropRect.height;
    dragState.mode = inX && inY ? 'move' : 'resize';
    window.addEventListener('mousemove', handleCropMouseMove, true);
    window.addEventListener('mouseup', handleCropMouseUp, true);
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function handleCropMouseMove(event: MouseEvent) {
    if (!dragState.active) {
      return;
    }
    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }
    if (dragState.mode === 'move') {
      const nextX = dragState.originX + (point.x - dragState.startX);
      const nextY = dragState.originY + (point.y - dragState.startY);
      const minX = imageFit.offsetX;
      const minY = imageFit.offsetY;
      const maxX = imageFit.offsetX + imageFit.drawWidth - cropRect.width;
      const maxY = imageFit.offsetY + imageFit.drawHeight - cropRect.height;
      cropRect.x = clamp(nextX, minX, maxX);
      cropRect.y = clamp(nextY, minY, maxY);
    } else {
      const dx = point.x - dragState.startX;
      const dy = point.y - dragState.startY;
      let width = Math.abs(dx);
      let height = width / cropAspect.value;
      if (width < 40) {
        width = 40;
        height = width / cropAspect.value;
      }
      let nextX = dx >= 0 ? dragState.startX : dragState.startX - width;
      let nextY = dy >= 0 ? dragState.startY : dragState.startY - height;
      if (nextX < imageFit.offsetX) {
        nextX = imageFit.offsetX;
      }
      if (nextY < imageFit.offsetY) {
        nextY = imageFit.offsetY;
      }
      if (nextX + width > imageFit.offsetX + imageFit.drawWidth) {
        nextX = imageFit.offsetX + imageFit.drawWidth - width;
      }
      if (nextY + height > imageFit.offsetY + imageFit.drawHeight) {
        nextY = imageFit.offsetY + imageFit.drawHeight - height;
      }
      cropRect.x = nextX;
      cropRect.y = nextY;
      cropRect.width = width;
      cropRect.height = height;
    }
    drawCropCanvas();
  }

  function handleCropMouseUp() {
    if (!dragState.active) {
      return;
    }
    dragState.active = false;
    window.removeEventListener('mousemove', handleCropMouseMove, true);
    window.removeEventListener('mouseup', handleCropMouseUp, true);
  }

  function getCroppedBackground() {
    const img = backgroundImage.value;
    if (!img) {
      return null;
    }
    const cropX = clamp((cropRect.x - imageFit.offsetX) / imageFit.scale, 0, img.width - 1);
    const cropY = clamp((cropRect.y - imageFit.offsetY) / imageFit.scale, 0, img.height - 1);
    const cropWidth = clamp(cropRect.width / imageFit.scale, 1, img.width - cropX);
    const cropHeight = clamp(cropRect.height / imageFit.scale, 1, img.height - cropY);
    const output = document.createElement('canvas');
    output.width = Math.round(cropWidth);
    output.height = Math.round(cropHeight);
    const ctx = output.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, output.width, output.height);

    const MAX_W = 1400;
    const MAX_H = 900;
    const scale = Math.min(1, MAX_W / output.width, MAX_H / output.height);

    let finalCanvas = output;
    if (scale < 1) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(1, Math.round(output.width * scale));
      scaled.height = Math.max(1, Math.round(output.height * scale));
      const sctx = scaled.getContext('2d');
      if (sctx) {
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(output, 0, 0, scaled.width, scaled.height);
        finalCanvas = scaled;
      }
    }

    return finalCanvas.toDataURL('image/jpeg', 0.85);
  }

  function applyBackgroundCrop() {
    const dataUrl = getCroppedBackground();
    if (!dataUrl) {
      return;
    }
    prefs.backgroundImage = dataUrl;
    prefs.backgroundBlurPx = clampBlurPx(backgroundBlurPx.value);
    prefs.backgroundEffect = normalizeBackgroundEffect(backgroundEffect.value);
    prefs.backgroundGlassStrength = clampGlassStrength(backgroundGlassStrength.value);
    closeBackgroundDialog();
  }

  function applyBackgroundAndSave() {
    if (!canSaveTheme.value) {
      return;
    }
    const dataUrl = getCroppedBackground();
    if (!dataUrl) {
      return;
    }
    prefs.backgroundImage = dataUrl;
    prefs.backgroundBlurPx = clampBlurPx(backgroundBlurPx.value);
    prefs.backgroundEffect = normalizeBackgroundEffect(backgroundEffect.value);
    prefs.backgroundGlassStrength = clampGlassStrength(backgroundGlassStrength.value);
    closeBackgroundDialog();
    const name = `主题${themes.value.length + 1}`;
    saveThemeWithName(name, dataUrl, backgroundBlurPx.value, backgroundEffect.value, backgroundGlassStrength.value);
  }

  function saveThemeWithName(
    name: string,
    image: string,
    blurPx: number,
    effect: OverlayBackgroundEffect,
    glassStrength: number
  ) {
    if (!canSaveTheme.value) {
      return;
    }
    const theme: OverlayTheme = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      image,
      blurPx: clampBlurPx(blurPx),
      effect: normalizeBackgroundEffect(effect),
      glassStrength: clampGlassStrength(glassStrength)
    };
    updateThemes([...themes.value, theme].slice(0, 3));
  }

  function confirmSaveTheme() {
    if (!pendingThemeImage.value) {
      return;
    }
    const name = themeNameInput.value.trim().slice(0, 3);
    if (!name) {
      return;
    }
    saveThemeWithName(
      name,
      pendingThemeImage.value,
      pendingThemeBlurPx.value,
      pendingThemeEffect.value,
      pendingThemeGlassStrength.value
    );
    closeThemeNameDialog();
  }

  return {
    themes,
    updateThemes,
    overlayBackgroundStyle,
    showLiquidGlassHighlight,
    overlayLiquidGlassHighlightStyle,
    backgroundDialogOpen,
    backgroundImageSource,
    backgroundFileName,
    backgroundFileInput,
    cropCanvas,
    isDragging,
    backgroundEffect,
    backgroundBlurPx,
    backgroundGlassStrength,
    canApplyBackground,
    canSaveTheme,
    themeNameDialogOpen,
    themeNameInput,
    canConfirmThemeName,
    themeDeleteDialogOpen,
    themeEditDialogOpen,
    themeEditNameInput,
    themeEditEffect,
    themeEditBlurPx,
    themeEditGlassStrength,
    canConfirmThemeEdit,
    openBackgroundDialog,
    closeBackgroundDialog,
    setBackgroundEffect,
    triggerFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    handleCropMouseDown,
    drawCropCanvas,
    applyBackgroundCrop,
    applyBackgroundAndSave,
    requestDeleteTheme,
    confirmDeleteTheme,
    closeDeleteThemeDialog,
    requestEditTheme,
    confirmEditTheme,
    closeEditThemeDialog,
    confirmSaveTheme,
    closeThemeNameDialog
  };
}
