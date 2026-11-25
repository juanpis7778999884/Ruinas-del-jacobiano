import { ACTION_LABELS, getKeyBindings } from './actions';
import type { Action } from './actions';
import { Save } from './SaveSystem';

class ControlsImpl {
  enabled = true;
  touchDir = { x: 0, y: 0 };
  private held = new Set<string>();
  private queue = new Set<Action>();
  private bindings = getKeyBindings();
  private quickBar: HTMLElement | null = null;
  private resetJoystick: (() => void) | null = null;

  constructor() {
    this.refreshBindings();
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.resetInput());
  }

  refreshBindings() {
    this.bindings = getKeyBindings(Save.data.settings.keymap);
  }

  rebind(action: Action, code: string) {
    const next: Partial<Record<Action, string[]>> = {};
    (Object.keys(this.bindings) as Action[]).forEach((a) => {
      next[a] = a === action ? [code] : this.bindings[a].filter((c) => c !== code);
    });
    Save.data.settings.keymap = next;
    Save.save();
    this.refreshBindings();
  }

  resetBindings() {
    Save.data.settings.keymap = {};
    Save.save();
    this.refreshBindings();
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!this.enabled) {
      if (!down) this.held.delete(e.code);
      return;
    }
    if (down) {
      this.held.add(e.code);
      const a = (Object.keys(this.bindings) as Action[]).find((key) => this.bindings[key].includes(e.code));
      if (a && !e.repeat) this.queue.add(a);
      if (a || ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
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
      this.resetInput();
      this.setQuickOpen(false);
    }
  }

  private resetInput() {
    this.queue.clear();
    this.held.clear();
    this.touchDir = { x: 0, y: 0 };
    this.resetJoystick?.();
  }

  registerQuickBar(bar: HTMLElement | null) {
    this.quickBar = bar;
  }

  registerJoystickReset(reset: (() => void) | null) {
    this.resetJoystick = reset;
  }

  setQuickOpen(open: boolean) {
    if (!this.quickBar) return;
    this.quickBar.classList.toggle('open', open);
    const toggle = this.quickBar.querySelector<HTMLButtonElement>('#quick-toggle');
    toggle?.setAttribute('aria-expanded', String(open));
  }

  get dir(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    const k = (a: Action) => (this.bindings[a].some((c) => this.held.has(c)) ? 1 : 0);
    let x = k('right') - k('left') + this.touchDir.x;
    let y = k('down') - k('up') + this.touchDir.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}

export const Controls = new ControlsImpl();

function bindTap(button: HTMLButtonElement, onActivate: () => void) {
  let activePointer: number | null = null;
  let lastPointerAt = 0;
  button.addEventListener('pointerdown', (e) => {
    if (activePointer !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    lastPointerAt = performance.now();
    button.setPointerCapture(e.pointerId);
    button.classList.add('pressed');
    onActivate();
  });
  const release = (e: PointerEvent) => {
    if (activePointer !== e.pointerId) return;
    if (button.hasPointerCapture(e.pointerId)) button.releasePointerCapture(e.pointerId);
    activePointer = null;
    button.classList.remove('pressed');
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    if (performance.now() - lastPointerAt < 450) return;
    onActivate();
  });
}

export function mountTouchUI() {
  const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (coarse) document.body.classList.add('touch');
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') document.body.classList.add('touch');
  }, { passive: true });

  const bar = document.createElement('div');
  bar.id = 'hud-buttons';
  bar.className = 'quick-controls';
  bar.innerHTML = `
    <button id="quick-toggle" type="button" aria-label="Accesos rápidos" aria-expanded="false">☰</button>
    <div id="quick-menu" class="quick-menu" role="menu" aria-label="Accesos rápidos">
      <button type="button" data-act="inventory" aria-label="${ACTION_LABELS.inventory}">🎒</button>
      <button type="button" data-act="map" aria-label="${ACTION_LABELS.map}">🗺</button>
      <button type="button" data-act="quests" aria-label="${ACTION_LABELS.quests}">📜</button>
      <button type="button" data-act="journal" aria-label="${ACTION_LABELS.journal}">∫</button>
      <button type="button" data-act="lens" aria-label="${ACTION_LABELS.lens}">◈</button>
      <button type="button" data-act="heal" aria-label="${ACTION_LABELS.heal}">✚</button>
      <button type="button" data-act="menu" aria-label="${ACTION_LABELS.menu}">⏸</button>
    </div>`;
  document.body.appendChild(bar);
  Controls.registerQuickBar(bar);

  const toggle = bar.querySelector<HTMLButtonElement>('#quick-toggle')!;
  bindTap(toggle, () => Controls.setQuickOpen(!bar.classList.contains('open')));
  bar.querySelectorAll<HTMLButtonElement>('#quick-menu button').forEach((b) => {
    bindTap(b, () => {
      Controls.press(b.dataset.act as Action);
      Controls.setQuickOpen(false);
    });
  });
  document.addEventListener('pointerdown', (e) => {
    if (!bar.contains(e.target as Node)) Controls.setQuickOpen(false);
  }, true);

  const joy = document.createElement('div');
  joy.id = 'joystick';
  joy.innerHTML = '<div class="knob"></div>';
  document.body.appendChild(joy);
  const knob = joy.querySelector<HTMLDivElement>('.knob')!;
  let activePointer: number | null = null;
  let radius = 44;

  const reset = () => {
    activePointer = null;
    Controls.touchDir = { x: 0, y: 0 };
    knob.style.transform = 'translate(0,0)';
    joy.classList.remove('active');
  };
  Controls.registerJoystickReset(reset);

  const move = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / radius;
    let dy = (e.clientY - cy) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const magnitude = Math.max(0, Math.min(1, (Math.min(len, 1) - 0.12) / 0.88));
    knob.style.transform = `translate(${dx * radius * 0.72}px, ${dy * radius * 0.72}px)`;
    Controls.touchDir = { x: dx * magnitude, y: dy * magnitude };
  };

  joy.addEventListener('pointerdown', (e) => {
    if (activePointer !== null) return;
    e.preventDefault();
    activePointer = e.pointerId;
    radius = Math.max(28, joy.getBoundingClientRect().width * 0.34);
    joy.setPointerCapture(e.pointerId);
    joy.classList.add('active');
    move(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === activePointer) move(e);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== activePointer) return;
    if (joy.hasPointerCapture(e.pointerId)) joy.releasePointerCapture(e.pointerId);
    reset();
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);
  joy.addEventListener('lostpointercapture', end);

  const pad = document.createElement('div');
  pad.id = 'actionpad';
  pad.innerHTML = `
    <button type="button" data-act="dodge" class="secondary dodge" aria-label="Esquivar">↷</button>
    <button type="button" data-act="guard" class="secondary guard" aria-label="Defender">◇</button>
    <button type="button" data-act="heavy" class="secondary heavy" aria-label="Golpe fuerte">✦</button>
    <button type="button" data-act="attack" class="primary attack" aria-label="Atacar">⚔</button>
    <button type="button" data-act="interact" class="primary interact" aria-label="Interactuar">A</button>`;
  document.body.appendChild(pad);
  pad.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    bindTap(b, () => Controls.press(b.dataset.act as Action));
  });
}
