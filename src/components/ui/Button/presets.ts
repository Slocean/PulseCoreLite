export const buttonPresetClassMap = {
  default: 'ui-button--preset-default',
  'overlay-chip': 'ui-button--preset-overlay-chip',
  'overlay-chip-soft': 'ui-button--preset-overlay-chip-soft',
  'overlay-chip-tab': 'ui-button--preset-overlay-chip-tab',
  'overlay-chip-action': 'ui-button--preset-overlay-chip-action',
  'overlay-primary': 'ui-button--preset-overlay-primary',
  'overlay-danger': 'ui-button--preset-overlay-danger',
  'overlay-action-info': 'ui-button--preset-overlay-action-info',
  'overlay-action-primary': 'ui-button--preset-overlay-action-primary',
  'overlay-action-danger': 'ui-button--preset-overlay-action-danger',
  'overlay-version': 'ui-button--preset-overlay-version',
  'overlay-dialog-close': 'ui-button--preset-overlay-dialog-close',
  'overlay-corner-danger': 'ui-button--preset-overlay-corner-danger',
  'overlay-corner-primary': 'ui-button--preset-overlay-corner-primary',
  'toolkit-tab': 'ui-button--preset-toolkit-tab',
  'toolkit-collapse': 'ui-button--preset-toolkit-collapse',
  'toolkit-collapse-title': 'ui-button--preset-toolkit-collapse-title',
  'toolkit-collapse-icon': 'ui-button--preset-toolkit-collapse-icon',
  'toolkit-view-toggle': 'ui-button--preset-toolkit-view-toggle',
  'toolkit-link': 'ui-button--preset-toolkit-link',
  'ui-dialog-close': 'ui-button--preset-ui-dialog-close',
  'ui-dialog-cancel': 'ui-button--preset-ui-dialog-cancel',
  'ui-dialog-confirm': 'ui-button--preset-ui-dialog-confirm'
} as const;

export type ButtonPresetName = keyof typeof buttonPresetClassMap;

export function resolveButtonPresetClass(preset: ButtonPresetName): string {
  return buttonPresetClassMap[preset];
}
