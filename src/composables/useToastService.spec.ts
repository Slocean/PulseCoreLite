import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetToastServiceStateForTests, useToastService } from './useToastService';

describe('useToastService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastServiceStateForTests();
  });

  afterEach(() => {
    resetToastServiceStateForTests();
    vi.useRealTimers();
  });

  it('shows toast for current channel and auto-hides after duration', () => {
    const { toastState, showToast } = useToastService('overlay');

    showToast('Up to date', { durationMs: 500 });
    expect(toastState.value.open).toBe(true);
    expect(toastState.value.message).toBe('Up to date');

    vi.advanceTimersByTime(500);
    expect(toastState.value.open).toBe(false);
    expect(toastState.value.message).toBe('Up to date');
  });

  it('supports overriding target channel from one service instance', () => {
    const overlay = useToastService('overlay');
    const toolkit = useToastService('toolkit');

    overlay.showToast('Copied', { channel: 'toolkit', durationMs: 1000 });
    expect(overlay.toastState.value.open).toBe(false);
    expect(toolkit.toastState.value.open).toBe(true);
    expect(toolkit.toastState.value.message).toBe('Copied');
  });

  it('can hide toast immediately and cancel timer', () => {
    const { toastState, showToast, hideToast } = useToastService('overlay');

    showToast('Checking', { durationMs: 1000 });
    expect(toastState.value.open).toBe(true);

    hideToast();
    expect(toastState.value.open).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(toastState.value.open).toBe(false);
  });
});
