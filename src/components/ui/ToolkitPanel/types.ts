export type ToolkitPanelHeaderMode = 'single' | 'split';

export interface ToolkitPanelProps {
  title: string;
  modelValue?: boolean;
  collapsible?: boolean;
  headerMode?: ToolkitPanelHeaderMode;
  titleAriaLabel?: string;
  toggleAriaLabel?: string;
  contentClass?: string;
  cardClass?: string;
}
