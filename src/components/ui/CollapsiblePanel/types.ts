import type { ButtonPreset } from '@/components/ui/Button/types';

export type CollapsiblePanelHeaderMode = 'single' | 'split';

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
