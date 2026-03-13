import { beforeEach, describe, expect, it, vi } from 'vitest';

const getJsonSyncMock = vi.fn();
const getJsonMock = vi.fn();
const setJsonMock = vi.fn();
const normalizeImageRefMock = vi.fn(async (value: string | null | undefined) => value ?? null);

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: (hook: () => unknown) => {
      void hook();
    },
    onUnmounted: () => undefined
  };
});

vi.mock('../services/storageRepository', () => ({
  storageKeys: {
    overlayPrefs: 'pulsecorelite.overlay_prefs'
  },
  storageRepository: {
    getJsonSync: getJsonSyncMock,
    getJson: getJsonMock,
    setJson: setJsonMock
  }
}));

vi.mock('../services/tauri', () => ({
  inTauri: () => false,
  listenEvent: vi.fn(async () => () => undefined)
}));

vi.mock('../utils/imageStore', () => ({
  normalizeImageRef: normalizeImageRefMock
}));

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useOverlayPrefs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    getJsonSyncMock.mockReset();
    getJsonMock.mockReset();
    setJsonMock.mockReset();
    normalizeImageRefMock.mockClear();
  });

  it('sanitizes persisted prefs values', async () => {
    getJsonSyncMock.mockReturnValue({
      showCpu: false,
      backgroundBlurPx: 99,
      backgroundEffect: 'invalid',
      backgroundGlassStrength: -11
    });
    getJsonMock.mockResolvedValue(undefined);

    const { useOverlayPrefs } = await import('./useOverlayPrefs');
    const { prefs } = useOverlayPrefs();
    await flushPromises();

    expect(prefs.showCpu).toBe(false);
    expect(prefs.backgroundBlurPx).toBe(40);
    expect(prefs.backgroundEffect).toBe('gaussian');
    expect(prefs.backgroundGlassStrength).toBe(0);
  });

  it('persists updated prefs after initialization', async () => {
    getJsonSyncMock.mockReturnValue(undefined);
    getJsonMock.mockResolvedValue(undefined);

    const { useOverlayPrefs } = await import('./useOverlayPrefs');
    const { prefs } = useOverlayPrefs();
    await flushPromises();

    setJsonMock.mockClear();
    prefs.showMemory = false;
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);

    expect(setJsonMock).toHaveBeenCalled();
    expect(setJsonMock).toHaveBeenLastCalledWith(
      'pulsecorelite.overlay_prefs',
      expect.objectContaining({ showMemory: false })
    );
  });

  it('keeps user theme changes made before async hydration finishes', async () => {
    getJsonSyncMock.mockReturnValue({
      backgroundThemeId: 'system-yinmu',
      backgroundImage: 'old-image',
      backgroundBlurPx: 5
    });

    let resolveStoredPrefs: (value: unknown) => void = () => undefined;
    getJsonMock.mockReturnValue(
      new Promise(resolve => {
        resolveStoredPrefs = resolve;
      })
    );

    const { useOverlayPrefs } = await import('./useOverlayPrefs');
    const { prefs } = useOverlayPrefs();

    prefs.backgroundThemeId = 'system-ziyun';
    prefs.backgroundImage = 'new-image';
    prefs.backgroundBlurPx = 9;

    resolveStoredPrefs({
      backgroundThemeId: 'system-yinmu',
      backgroundImage: 'old-image',
      backgroundBlurPx: 5
    });
    await flushPromises();

    expect(prefs.backgroundThemeId).toBe('system-ziyun');
    expect(prefs.backgroundImage).toBe('new-image');
    expect(prefs.backgroundBlurPx).toBe(9);
    expect(setJsonMock).toHaveBeenCalledWith(
      'pulsecorelite.overlay_prefs',
      expect.objectContaining({
        backgroundThemeId: 'system-ziyun',
        backgroundImage: 'new-image',
        backgroundBlurPx: 9
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
