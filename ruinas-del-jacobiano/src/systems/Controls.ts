/**
 * Controles unificados: teclado + joystick y botones táctiles.
 * Las escenas nunca leen teclas de Phaser directamente.
 */
export type Action =
  | 'interact' | 'attack' | 'heavy' | 'dodge' | 'guard'
  | 'journal' | 'lens' | 'inventory' | 'map' | 'quests' | 'heal' | 'menu';

const KEYMAP: Record<string, Action> = {
  KeyE: 'interact',
  Enter: 'interact',
  Space: 'attack',
  KeyK: 'attack',
  KeyH: 'heavy',
  ShiftLeft: 'dodge',
  ShiftRight: 'dodge',
  KeyG: 'guard',
  KeyJ: 'journal',
  KeyQ: 'lens',
  KeyI: 'inventory',
  Tab: 'inventory',
  KeyM: 'map',
  KeyL: 'quests',
  KeyR: 'heal',
  Escape: 'menu',
};

class ControlsImpl {
  enabled = true;
  touchDir = { x: 0, y: 0 };
  private held = new Set<string>();
  private queue = new Set<Action>();

  constructor() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.touchDir = { x: 0, y: 0 };
    });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!this.enabled) {
      if (!down) this.held.delete(e.code);
      return;
    }
    if (down) {
      this.held.add(e.code);
      const a = KEYMAP[e.code];
      if (a && !e.repeat) this.queue.add(a);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    } else {
      this.held.delete(e.code);
    }
  }

  press(a: Action) {
    if (this.enabled) this.queue.add(a);
  }

  consume(a: Action): boolean {
    return this.queue.delete(a);
  }

  clear() {
    this.queue.clear();
  }

  isDown(code: string): boolean {
    return this.enabled && this.held.has(code);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.queue.clear();
      this.held.clear();
      this.touchDir = { x: 0, y: 0 };
    }
  }

  get dir(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    const k = (c: string) => (this.held.has(c) ? 1 : 0);
    let x = k('ArrowRight') + k('KeyD') - k('ArrowLeft') - k('KeyA') + this.touchDir.x;
    let y = k('ArrowDown') + k('KeyS') - k('ArrowUp') - k('KeyW') + this.touchDir.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}

export const Controls = new ControlsImpl();

/** Botones táctiles y HUD de acceso rápido. */
export function mountTouchUI() {
  const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (coarse) document.body.classList.add('touch');

  const bar = document.createElement('div');
  bar.id = 'hud-buttons';
  bar.innerHTML = `
    <button data-act="inventory" aria-label="Inventario">🎒</button>
    <button data-act="map" aria-label="Mapa">🗺</button>
    <button data-act="quests" aria-label="Misiones">📜</button>
    <button data-act="journal" aria-label="Fórmulas">∫</button>
    <button data-act="lens" aria-label="Lente">◈</button>
    <button data-act="heal" aria-label="Beber elixir">✚</button>
    <button data-act="menu" aria-label="Pausa">☰</button>`;
  document.body.appendChild(bar);
  bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Controls.press(b.dataset.act as Action);
    });
  });

  const joy = document.createElement('div');
  joy.id = 'joystick';
  joy.innerHTML = '<div class="knob"></div>';
  document.body.appendChild(joy);
  const knob = joy.querySelector<HTMLDivElement>('.knob')!;
  let active = false;

  const move = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    Controls.touchDir = len < 0.2 ? { x: 0, y: 0 } : { x: dx, y: dy };
  };
  const end = () => {
    active = false;
    Controls.touchDir = { x: 0, y: 0 };
    knob.style.transform = 'translate(0,0)';
  };
  joy.addEventListener('pointerdown', (e) => {
    active = true;
    joy.setPointerCapture(e.pointerId);
    move(e);
  });
  joy.addEventListener('pointermove', (e) => { if (active) move(e); });
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  const pad = document.createElement('div');
  pad.id = 'actionpad';
  pad.innerHTML = `
    <button data-act="dodge" class="d">↷</button>
    <button data-act="guard" class="g">◇</button>
    <button data-act="heavy" class="c">C</button>
    <button data-act="attack" class="b">B</button>
    <button data-act="interact" class="a">A</button>`;
  document.body.appendChild(pad);
  pad.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Controls.press(b.dataset.act as Action);
    });
  });
}
