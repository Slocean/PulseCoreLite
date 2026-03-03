import type { ButtonPreset } from '@/components/ui/Button/types';

export type CollapsiblePanelHeaderMode = 'single' | 'split';

export interface CollapsiblePanelSlots {
  /**
   * Main content area, rendered only when panel is open.
   */
  default?: () => unknown;
  /**
   * Only rendered when headerMode is split.
   * Insert lightweight action controls between title and toggle.
   */
  'header-actions'?: () => unknown;
}

export interface CollapsiblePanelProps {
  title: string;
  framed?: boolean;
  modelValue?: boolean;
  collapsible?: boolean;
  headerMode?: CollapsiblePanelHeaderMode;
  titleAriaLabel?: string;
  toggleAriaLabel?: string;
  contentClass?: string;
  headerClass?: string;
  titleClass?: string;
  indicatorClass?: string;
  singleHeaderPreset?: ButtonPreset;
  splitTitlePreset?: ButtonPreset;
  splitTogglePreset?: ButtonPreset;
  toggleIcon?: string;
}

export interface CollapsiblePanelDefaultProps {
  framed: boolean;
  modelValue: boolean;
  collapsible: boolean;
  headerMode: CollapsiblePanelHeaderMode;
  titleAriaLabel: string;
  toggleAriaLabel: string;
  contentClass: string;
  headerClass: string;
  titleClass: string;
  indicatorClass: string;
  singleHeaderPreset: ButtonPreset;
  splitTitlePreset: ButtonPreset;
  splitTogglePreset: ButtonPreset;
  toggleIcon: string;
}

export const COLLAPSIBLE_PANEL_DEFAULTS: CollapsiblePanelDefaultProps = {
  framed: false,
  modelValue: true,
  collapsible: true,
  headerMode: 'single',
  titleAriaLabel: '',
  toggleAriaLabel: '',
  contentClass: '',
  headerClass: '',
  titleClass: '',
  indicatorClass: '',
  singleHeaderPreset: 'default',
  splitTitlePreset: 'default',
  splitTogglePreset: 'default',
  toggleIcon: 'expand_more'
};
