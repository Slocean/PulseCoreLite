import { describe, expect, it } from 'vitest';

import {
  getNextCollapsiblePanelValue,
  resolveCollapsiblePanelOpenState,
  resolveCollapsiblePanelToggleLabel
} from './logic';
import { COLLAPSIBLE_PANEL_DEFAULTS } from './types';

describe('ui/CollapsiblePanel logic', () => {
  it('exposes stable defaults', () => {
    expect(COLLAPSIBLE_PANEL_DEFAULTS.headerMode).toBe('single');
    expect(COLLAPSIBLE_PANEL_DEFAULTS.collapsible).toBe(true);
    expect(COLLAPSIBLE_PANEL_DEFAULTS.modelValue).toBe(true);
  });

  it('keeps non-collapsible panels always open', () => {
    expect(resolveCollapsiblePanelOpenState(false, false)).toBe(true);
    expect(resolveCollapsiblePanelOpenState(false, true)).toBe(true);
  });

  it('reflects modelValue when collapsible', () => {
    expect(resolveCollapsiblePanelOpenState(true, false)).toBe(false);
    expect(resolveCollapsiblePanelOpenState(true, true)).toBe(true);
  });

  it('resolves toggle label by priority', () => {
    expect(resolveCollapsiblePanelToggleLabel('Toggle', 'Title Label', 'Title')).toBe('Toggle');
    expect(resolveCollapsiblePanelToggleLabel('', 'Title Label', 'Title')).toBe('Title Label');
    expect(resolveCollapsiblePanelToggleLabel('', '', 'Title')).toBe('Title');
  });

  it('toggles open state', () => {
    expect(getNextCollapsiblePanelValue(true)).toBe(false);
    expect(getNextCollapsiblePanelValue(false)).toBe(true);
  });
});
