import { describe, expect, it } from 'vitest';

import { resolveToastRenderState } from './logic';

describe('ui/Toast logic', () => {
  it('uses service state when channel mode is enabled', () => {
    const state = resolveToastRenderState(
      { channel: 'overlay', open: false, message: '' },
      { open: true, message: 'Updated' }
    );
    expect(state).toEqual({ open: true, message: 'Updated' });
  });

  it('hides service-mode toast when service message is empty', () => {
    const state = resolveToastRenderState(
      { channel: 'overlay', open: true, message: 'Legacy' },
      { open: true, message: '' }
    );
    expect(state).toEqual({ open: false, message: '' });
  });

  it('uses legacy props mode when no channel is provided', () => {
    const shown = resolveToastRenderState(
      { open: true, message: 'Done' },
      { open: false, message: '' }
    );
    expect(shown).toEqual({ open: true, message: 'Done' });

    const hidden = resolveToastRenderState(
      { open: true, message: '' },
      { open: true, message: 'From service' }
    );
    expect(hidden).toEqual({ open: false, message: '' });
  });
});
