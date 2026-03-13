import { describe, expect, it, vi } from 'vitest';

const deleteImageRefMock = vi.fn();

vi.mock('../../utils/imageStore', () => ({
  deleteImageRef: deleteImageRefMock,
  isImageRef: (value: string | null | undefined) => typeof value === 'string' && value.startsWith('pcimg:')
}));

describe('cleanupOldBackgroundImage', () => {
  it('does not delete system theme image refs when switching back to default theme', async () => {
    const { cleanupOldBackgroundImage } = await import('./imageLifecycle');

    await cleanupOldBackgroundImage(
      'pcimg:system-theme',
      null,
      [],
      null,
      [
        {
          id: 'system-yinmu',
          name: 'Yinmu',
          image: 'pcimg:system-theme',
          blurPx: 5,
          effect: 'liquidGlass',
          glassStrength: 55,
          textBrightnessBoost: 0
        }
      ]
    );

    expect(deleteImageRefMock).not.toHaveBeenCalled();
  });
});

describe('cleanupRemovedThemeImages', () => {
  it('deletes removed custom theme image refs when they are no longer used', async () => {
    deleteImageRefMock.mockClear();
    const { cleanupRemovedThemeImages } = await import('./imageLifecycle');

    await cleanupRemovedThemeImages(
      [
        {
          id: 'custom-1',
          name: 'C1',
          image: 'pcimg:custom-theme',
          blurPx: 5,
          effect: 'gaussian',
          glassStrength: 55,
          textBrightnessBoost: 0
        }
      ],
      [],
      null,
      []
    );

    expect(deleteImageRefMock).toHaveBeenCalledWith('pcimg:custom-theme');
  });

  it('does not delete refs still used by system themes', async () => {
    deleteImageRefMock.mockClear();
    const { cleanupRemovedThemeImages } = await import('./imageLifecycle');

    await cleanupRemovedThemeImages(
      [
        {
          id: 'custom-1',
          name: 'C1',
          image: 'pcimg:shared-theme',
          blurPx: 5,
          effect: 'gaussian',
          glassStrength: 55,
          textBrightnessBoost: 0
        }
      ],
      [],
      null,
      [
        {
          id: 'system-1',
          name: 'S1',
          image: 'pcimg:shared-theme',
          blurPx: 5,
          effect: 'gaussian',
          glassStrength: 55,
          textBrightnessBoost: 0
        }
      ]
    );

    expect(deleteImageRefMock).not.toHaveBeenCalled();
  });
});
