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

    expect(setJsonMock).toHaveBeenCalled();
    expect(setJsonMock).toHaveBeenLastCalledWith(
      'pulsecorelite.overlay_prefs',
      expect.objectContaining({ showMemory: false })
    );
  });
});
