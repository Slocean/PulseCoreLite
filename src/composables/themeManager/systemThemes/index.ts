import type { OverlayTheme } from '../themeStore';
import { systemTheme as xueyueTheme } from './xueyue';
import { systemTheme as yinmuTheme } from './yinmu';
import { systemTheme as zishanTheme } from './zishan';

export const SYSTEM_DEFAULT_THEME_ID = 'system-default';

export const systemThemes: OverlayTheme[] = [xueyueTheme, yinmuTheme, zishanTheme];
