import type { TaskbarPrefs } from '@/composables/useTaskbarPrefs';

export type TaskbarMenuItemDescriptor =
  | {
      kind: 'separator';
      id: string;
    }
  | {
      kind: 'action';
      id: string;
      text: string;
      onTrigger: () => void | Promise<void>;
    }
  | {
      kind: 'check';
      id: string;
      text: string;
      checked: boolean;
      onTrigger: () => void | Promise<void>;
    };

type BuildTaskbarMenuItemsInput = {
  mainVisible: boolean;
  alwaysOnTop: boolean;
  autoHideOnFullscreen: boolean;
  rememberPosition: boolean;
  positionLocked: boolean;
  prefs: TaskbarPrefs;
  labels: {
    openMainWindow: string;
    hideMainWindow: string;
    alwaysOnTop: string;
    taskbarFullscreenAutoHide: string;
    rememberPosition: string;
    lockTaskbarPosition: string;
    unlockTaskbarPosition: string;
    taskbarTwoLine: string;
    taskbarThemeTransparent: string;
    taskbarThemeDark: string;
    taskbarThemeLight: string;
    cpu: string;
    gpu: string;
    memory: string;
    app: string;
    down: string;
    up: string;
    closeTaskbarMonitor: string;
  };
  actions: {
    toggleMainWindow: (isMainVisible: boolean) => void | Promise<void>;
    toggleAlwaysOnTop: (next: boolean) => void | Promise<void>;
    toggleAutoHideOnFullscreen: (next: boolean) => void | Promise<void>;
    toggleRememberPosition: (next: boolean) => void | Promise<void>;
    togglePositionLocked: (next: boolean) => void | Promise<void>;
    toggleTwoLineMode: (next: boolean) => void | Promise<void>;
    setTheme: (next: 'transparent' | 'dark' | 'light') => void | Promise<void>;
    toggleShowCpu: (next: boolean) => void | Promise<void>;
    toggleShowGpu: (next: boolean) => void | Promise<void>;
    toggleShowMemory: (next: boolean) => void | Promise<void>;
    toggleShowApp: (next: boolean) => void | Promise<void>;
    toggleShowDown: (next: boolean) => void | Promise<void>;
    toggleShowUp: (next: boolean) => void | Promise<void>;
    closeTaskbarMonitor: () => void | Promise<void>;
  };
};

export function buildTaskbarMenuItems(input: BuildTaskbarMenuItemsInput): TaskbarMenuItemDescriptor[] {
  const { labels, actions, prefs } = input;
  const nextAlwaysOnTop = !input.alwaysOnTop;
  const nextAutoHideOnFullscreen = !input.autoHideOnFullscreen;
  const nextRememberPosition = !input.rememberPosition;
  const nextPositionLocked = !input.positionLocked;

  return [
    {
      kind: 'action',
      id: 'toggle-main-window',
      text: input.mainVisible ? labels.hideMainWindow : labels.openMainWindow,
      onTrigger: () => actions.toggleMainWindow(input.mainVisible)
    },
    { kind: 'separator', id: 'sep-window' },
    {
      kind: 'check',
      id: 'always-on-top',
      text: labels.alwaysOnTop,
      checked: input.alwaysOnTop,
      onTrigger: () => actions.toggleAlwaysOnTop(nextAlwaysOnTop)
    },
    {
      kind: 'check',
      id: 'auto-hide-fullscreen',
      text: labels.taskbarFullscreenAutoHide,
      checked: input.autoHideOnFullscreen,
      onTrigger: () => actions.toggleAutoHideOnFullscreen(nextAutoHideOnFullscreen)
    },
    {
      kind: 'check',
      id: 'remember-position',
      text: labels.rememberPosition,
      checked: input.rememberPosition,
      onTrigger: () => actions.toggleRememberPosition(nextRememberPosition)
    },
    {
      kind: 'action',
      id: 'position-lock',
      text: input.positionLocked ? labels.unlockTaskbarPosition : labels.lockTaskbarPosition,
      onTrigger: () => actions.togglePositionLocked(nextPositionLocked)
    },
    { kind: 'separator', id: 'sep-layout' },
    {
      kind: 'check',
      id: 'two-line',
      text: labels.taskbarTwoLine,
      checked: prefs.twoLineMode,
      onTrigger: () => actions.toggleTwoLineMode(!prefs.twoLineMode)
    },
    { kind: 'separator', id: 'sep-theme' },
    {
      kind: 'check',
      id: 'theme-transparent',
      text: labels.taskbarThemeTransparent,
      checked: prefs.backgroundMode === 'transparent',
      onTrigger: () => actions.setTheme('transparent')
    },
    {
      kind: 'check',
      id: 'theme-dark',
      text: labels.taskbarThemeDark,
      checked: prefs.backgroundMode === 'dark',
      onTrigger: () => actions.setTheme('dark')
    },
    {
      kind: 'check',
      id: 'theme-light',
      text: labels.taskbarThemeLight,
      checked: prefs.backgroundMode === 'light',
      onTrigger: () => actions.setTheme('light')
    },
    { kind: 'separator', id: 'sep-metrics-a' },
    {
      kind: 'check',
      id: 'show-cpu',
      text: labels.cpu,
      checked: prefs.showCpu,
      onTrigger: () => actions.toggleShowCpu(!prefs.showCpu)
    },
    { kind: 'separator', id: 'sep-metrics-b' },
    {
      kind: 'check',
      id: 'show-gpu',
      text: labels.gpu,
      checked: prefs.showGpu,
      onTrigger: () => actions.toggleShowGpu(!prefs.showGpu)
    },
    {
      kind: 'check',
      id: 'show-memory',
      text: labels.memory,
      checked: prefs.showMemory,
      onTrigger: () => actions.toggleShowMemory(!prefs.showMemory)
    },
    {
      kind: 'check',
      id: 'show-app',
      text: labels.app,
      checked: prefs.showApp,
      onTrigger: () => actions.toggleShowApp(!prefs.showApp)
    },
    { kind: 'separator', id: 'sep-network' },
    {
      kind: 'check',
      id: 'show-down',
      text: labels.down,
      checked: prefs.showDown,
      onTrigger: () => actions.toggleShowDown(!prefs.showDown)
    },
    {
      kind: 'check',
      id: 'show-up',
      text: labels.up,
      checked: prefs.showUp,
      onTrigger: () => actions.toggleShowUp(!prefs.showUp)
    },
    { kind: 'separator', id: 'sep-close' },
    {
      kind: 'action',
      id: 'close-taskbar',
      text: labels.closeTaskbarMonitor,
      onTrigger: () => actions.closeTaskbarMonitor()
    }
  ];
}
