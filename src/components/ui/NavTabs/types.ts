export interface NavTabItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
}

export interface NavTabsProps {
  items: NavTabItem[];
  ariaLabel?: string;
}
