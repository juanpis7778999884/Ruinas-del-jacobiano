export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'interact' | 'attack' | 'heavy' | 'dodge' | 'guard'
  | 'journal' | 'lens' | 'inventory' | 'map' | 'quests' | 'heal' | 'menu';

export type KeyBindings = Record<Action, string[]>;

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Mover arriba',
  down: 'Mover abajo',
  left: 'Mover izquierda',
  right: 'Mover derecha',
  interact: 'Interactuar',
  attack: 'Atacar',
  heavy: 'Golpe fuerte',
  dodge: 'Esquivar',
  guard: 'Defender',
  journal: 'Diario de fórmulas',
  lens: 'Lente del Jacobiano',
  inventory: 'Inventario',
  map: 'Mapa',
  quests: 'Misiones',
  heal: 'Beber elixir',
  menu: 'Pausa',
};

export const DEFAULT_KEYMAP: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  interact: ['KeyE', 'Enter'],
  attack: ['Space', 'KeyK'],
  heavy: ['KeyH'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  guard: ['KeyG'],
  journal: ['KeyJ'],
  lens: ['KeyQ'],
  inventory: ['KeyI', 'Tab'],
  map: ['KeyM'],
  quests: ['KeyL'],
  heal: ['KeyR'],
  menu: ['Escape'],
};

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    Space: 'Espacio', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
    AltLeft: 'Alt', AltRight: 'Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  return names[code] ?? code;
}

export function getKeyBindings(custom?: Partial<KeyBindings>): KeyBindings {
  const result = {} as KeyBindings;
  (Object.keys(DEFAULT_KEYMAP) as Action[]).forEach((a) => {
    const supplied = custom?.[a];
    result[a] = supplied?.length ? [...supplied] : [...DEFAULT_KEYMAP[a]];
  });
  return result;
}
