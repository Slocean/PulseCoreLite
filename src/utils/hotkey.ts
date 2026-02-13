export type Hotkey = {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
};

const MODIFIERS = new Set(['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'command']);

function normalizeKeyPart(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function normalizeKeyFromEvent(event: KeyboardEvent): string | null {
  const key = event.key;
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    return null;
  }

  // Prefer `code` for letters/digits and numpad keys (layout independent).
  const code = event.code;
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3);
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    return code;
  }

  return normalizeKeyPart(key);
}

export function hotkeyFromEvent(event: KeyboardEvent): Hotkey | null {
  const keyPart = normalizeKeyFromEvent(event);
  if (!keyPart) return null;
  return {
    ctrl: event.getModifierState('Control'),
    alt: event.getModifierState('Alt'),
    shift: event.getModifierState('Shift'),
    meta: event.getModifierState('Meta'),
    key: keyPart
  };
}

export function hotkeyToString(hotkey: Hotkey): string {
  const parts: string[] = [];
  if (hotkey.ctrl) parts.push('Ctrl');
  if (hotkey.alt) parts.push('Alt');
  if (hotkey.shift) parts.push('Shift');
  if (hotkey.meta) parts.push('Meta');
  parts.push(normalizeKeyPart(hotkey.key));
  return parts.join('+');
}

export function parseHotkeyString(value: string): Hotkey | null {
  const rawParts = value
    .split('+')
    .map(part => part.trim())
    .filter(Boolean);
  if (rawParts.length === 0) return null;

  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  const keyParts: string[] = [];

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (!MODIFIERS.has(lower)) {
      keyParts.push(part);
      continue;
    }
    if (lower === 'ctrl' || lower === 'control') ctrl = true;
    if (lower === 'alt') alt = true;
    if (lower === 'shift') shift = true;
    if (lower === 'meta' || lower === 'cmd' || lower === 'command') meta = true;
  }

  if (keyParts.length !== 1) {
    return null;
  }

  return {
    ctrl,
    alt,
    shift,
    meta,
    key: normalizeKeyPart(keyParts[0])
  };
}

export function matchesHotkeyEvent(event: KeyboardEvent, hotkeyString: string): boolean {
  const expected = parseHotkeyString(hotkeyString);
  if (!expected) return false;

  const actual = hotkeyFromEvent(event);
  if (!actual) return false;

  return (
    actual.ctrl === expected.ctrl &&
    actual.alt === expected.alt &&
    actual.shift === expected.shift &&
    actual.meta === expected.meta &&
    normalizeKeyPart(actual.key) === normalizeKeyPart(expected.key)
  );
}

