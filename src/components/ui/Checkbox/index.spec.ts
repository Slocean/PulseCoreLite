import { describe, expect, it } from 'vitest';

import {
  createNextCheckboxModelValue,
  isCheckboxChecked,
  shouldToggleCheckboxOnKeydown
} from './logic';

describe('ui/Checkbox logic', () => {
  it('checks membership in array mode', () => {
    expect(isCheckboxChecked(['cpu', 'gpu'], 'cpu')).toBe(true);
    expect(isCheckboxChecked(['cpu', 'gpu'], 'memory')).toBe(false);
  });

  it('returns boolean in switch mode', () => {
    expect(isCheckboxChecked(true)).toBe(true);
    expect(isCheckboxChecked(false)).toBe(false);
  });

  it('adds and removes selected values without duplicates', () => {
    expect(createNextCheckboxModelValue(['cpu'], 'gpu', true)).toEqual(['cpu', 'gpu']);
    expect(createNextCheckboxModelValue(['cpu', 'gpu'], 'gpu', true)).toEqual(['cpu', 'gpu']);
    expect(createNextCheckboxModelValue(['cpu', 'gpu'], 'gpu', false)).toEqual(['cpu']);
  });

  it('updates boolean mode', () => {
    expect(createNextCheckboxModelValue(false, undefined, true)).toBe(true);
    expect(createNextCheckboxModelValue(true, undefined, false)).toBe(false);
  });

  it('handles keyboard toggle key filtering', () => {
    expect(shouldToggleCheckboxOnKeydown('Enter')).toBe(true);
    expect(shouldToggleCheckboxOnKeydown(' ')).toBe(false);
    expect(shouldToggleCheckboxOnKeydown('Space')).toBe(false);
  });
});
