export function resolveCollapsiblePanelOpenState(collapsible: boolean, modelValue: boolean): boolean {
  return collapsible ? modelValue : true;
}

export function resolveCollapsiblePanelToggleLabel(
  toggleAriaLabel: string,
  titleAriaLabel: string,
  title: string
): string {
  return toggleAriaLabel || titleAriaLabel || title;
}

export function getNextCollapsiblePanelValue(current: boolean): boolean {
  return !current;
}
