import { describe, expect, it } from 'vitest';

import { resolveToastRenderState } from './logic';

describe('ui/Toast logic', () => {
  it('uses service state when channel mode is enabled', () => {
    const state = resolveToastRenderState(
      { channel: 'overlay', open: false, message: '', variant: 'info', closable: true, pinnable: true },
      { open: true, message: 'Updated', variant: 'success', closable: false, pinnable: true, durationMs: 2600, pinned: true }
    );
    expect(state).toEqual({
      open: true,
      message: 'Updated',
      variant: 'success',
      closable: false,
      pinnable: true,
      durationMs: 2600,
      pinned: true
    });
  });

  it('hides service-mode toast when service message is empty', () => {
    const state = resolveToastRenderState(
      { channel: 'overlay', open: true, message: 'Legacy', variant: 'warning', closable: true, pinnable: true },
      { open: true, message: '', variant: 'error', closable: true, pinnable: true, durationMs: 6000, pinned: false }
    );
    expect(state).toEqual({ open: false, message: '', variant: 'error', closable: true, pinnable: true, durationMs: 6000, pinned: false });
  });

  it('uses legacy props mode when no channel is provided', () => {
    const shown = resolveToastRenderState(
      { open: true, message: 'Done', variant: 'primary', closable: false, durationMs: 3200, pinnable: false },
      { open: false, message: '', variant: 'info', closable: true, pinnable: true, durationMs: 0, pinned: false }
    );
    expect(shown).toEqual({
      open: true,
      message: 'Done',
      variant: 'primary',
      closable: false,
      pinnable: false,
      durationMs: 3200,
      pinned: false
    });
  });
});
