import { GAME_H } from '../config';
import { QUESTS } from '../data/story';
import { ITEMS, ZONES, ZONE_ORDER, charAt } from '../data/zones';
import { ItemId, QuestId, RelicId, ZoneId } from '../data/types';
import { ACTION_LABELS, getKeyBindings, keyLabel } from '../systems/actions';
import type { Action } from '../systems/actions';
import { Audio } from '../systems/Audio';
import { Controls } from '../systems/Controls';
import { Save } from '../systems/SaveSystem';

export type PanelKind = 'inventory' | 'map' | 'quests' | 'pause' | 'death' | 'credits' | 'controls';

interface PanelContext {
  zone: ZoneId;
  player: { x: number; y: number };
  onRespawn?: () => void;
  fromMenu?: boolean;
}

let current: { kind: PanelKind; el: HTMLElement } | null = null;
let waitingRebind: Action | null = null;
let rebindListener: ((e: KeyboardEvent) => void) | null = null;
let escListener: ((e: KeyboardEvent) => void) | null = null;

export function isOverlayOpen(): boolean {
  return current !== null;
}

export function closePanel() {
  if (rebindListener) {
    window.removeEventListener('keydown', rebindListener, true);
    rebindListener = null;
  }
  if (escListener) {
    window.removeEventListener('keydown', escListener, true);
    escListener = null;
  }
  waitingRebind = null;
  if (!current) return;
  const kind = current.kind;
  current.el.remove();
  current = null;
  Controls.setEnabled(true);
  window.dispatchEvent(new CustomEvent('panel-closed', { detail: kind }));
}

const itemName = (id: ItemId) => ITEMS[id]?.name ?? id;
const itemIcon = (id: ItemId) => ITEMS[id]?.icon ?? '◆';

const TILE_COLORS: Record<string, string> = {
  '.': '#3c3a4f', ',': '#38644a', '=': '#8a7048', '*': '#c78bb5',
  '#': '#77728f', c: '#9b95ac', o: '#55556b', T: '#2f7a3c',
  '~': '#2f6ba8', B: '#ffb703', R: '#8dffd8', P: '#b38bff',
  C: '#ffd166', L: '#8ecae6', S: '#8dffd8', X: '#8dffd8',
  D: '#d95f5f', g: '#d95f5f', '^': '#c9c2ae', v: '#c9c2ae',
};

function mapCanvas(zoneId: ZoneId, player: { x: number; y: number }): string {
  const zone = ZONES[zoneId];
  const w = 640;
  const h = 400;
  const tw = w / zone.map[0].length;
  const th = h / zone.map.length;
  return `<canvas id="world-map-canvas" width="${w}" height="${h}" style="width:100%;height:auto;border-radius:8px;background:#14162d"></canvas>
    <script type="application/json" id="world-map-data">${JSON.stringify({ zoneId, player, tw, th }).replace(/</g, '\\u003c')}</script>`;
}

function paintMap(zoneId: ZoneId, player: { x: number; y: number }) {
  const canvas = document.getElementById('world-map-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const zone = ZONES[zoneId];
  const tw = canvas.width / zone.map[0].length;
  const th = canvas.height / zone.map.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < zone.map.length; y++) {
    for (let x = 0; x < zone.map[y].length; x++) {
      const ch = charAt(zone, x, y);
      ctx.fillStyle = TILE_COLORS[ch] ?? '#3c3a4f';
      ctx.fillRect(x * tw, y * th, Math.ceil(tw), Math.ceil(th));
    }
  }
  for (const r of zone.runes) {
    ctx.fillStyle = Save.data.solvedRunes[r.id] ? '#80ed99' : '#8dffd8';
    ctx.beginPath(); ctx.arc((r.x + 0.5) * tw, (r.y + 0.5) * th, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of zone.chests) {
    if (!Save.data.openedChests[c.id]) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(c.x * tw + 2, c.y * th + 2, Math.max(4, tw - 4), Math.max(4, th - 4));
    }
  }
  const ex = zone.exits.find((e) => e.to === zoneId);
  void ex;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc((player.x + 0.5) * tw, (player.y + 0.5) * th, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1f3b';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function inventoryHtml(): string {
  const d = Save.data;
  const entries = (Object.keys(ITEMS) as ItemId[]).filter((id) => (d.items[id] ?? 0) > 0);
  const relics: RelicId[] = [];
  if (d.flags['corazon_roto']) relics.push('corazon_roto');
  if (d.flags['brujula_giros']) relics.push('brujula_giros');
  if (d.flags['ojo_cartografo']) relics.push('ojo_cartografo');
  return `
    <h2>Inventario</h2>
    <div class="inv-grid">
      ${entries.length ? entries.map((id) => `
        <button class="inv-item" data-item="${id}">
          <span class="inv-icon">${itemIcon(id)}</span>
          <span><b>${itemName(id)}</b><small>${ITEMS[id].desc}</small></span>
          <em>×${d.items[id]}</em>
        </button>`).join('') : '<p class="muted">Todavía no llevas nada. Explora los cofres del reino.</p>'}
    </div>
    <h3>Equipamiento</h3>
    <div class="equip-row">
      <button data-equip="hoja_oxidada" class="${d.equipped.weapon === 'hoja_oxidada' ? 'active' : ''}">Hoja oxidada</button>
      <button data-equip="fubini" class="${d.equipped.weapon === 'fubini' ? 'active' : ''}" ${(d.items.fubini ?? 0) ? '' : 'disabled'}>Cuchilla de Fubini</button>
    </div>
    <p class="muted">Reliquias: ${relics.length ? relics.map((r) => RELIC_NAMES[r]).join(' · ') : 'ninguna'}</p>
    <p class="muted">Oro: ${d.stats.gold} · Runas: ${Object.keys(d.solvedRunes).length} · Enemigos vencidos: ${d.stats.kills}</p>`;
}

const RELIC_NAMES: Record<RelicId, string> = {
  corazon_roto: 'Corazón roto (+1 vida, menos daño)',
  brujula_giros: 'Brújula de giros (esquiva mejor)',
  ojo_cartografo: 'Ojo del cartógrafo',
};

function questsHtml(): string {
  const d = Save.data;
  return `<h2>Misiones</h2>${QUESTS.map((q) => {
    const st = d.quests[q.id];
    return `<section class="quest">
      <h3>${q.name} <small>${st.done ? '✓ completada' : st.progress ? `${st.progress}/${q.steps.length}` : 'sin iniciar'}</small></h3>
      <p>${q.hook}</p>
      ${st.progress ? `<ol>${q.steps.map((s, i) => `<li class="${i < st.progress ? 'done' : ''}">${s}</li>`).join('')}</ol>` : ''}
      <p class="muted">Recompensa: ${q.reward}</p>
    </section>`;
  }).join('')}`;
}

function mapHtml(ctx: PanelContext): string {
  const d = Save.data;
  return `<h2>Mapa de ${ZONES[ctx.zone].shortName}</h2>
    ${mapCanvas(ctx.zone, ctx.player)}
    <p class="muted">Blanco: tú · verde: runas · oro: cofres sin abrir. Los portales se usan (no se teletransporta desde el mapa).</p>
    <div class="zone-list">${ZONE_ORDER.map((z) => `<span class="${d.discovered[z] ? '' : 'locked'}">${d.discovered[z] ? ZONES[z].shortName : '???'}</span>`).join('')}</div>`;
}

function pauseHtml(): string {
  const s = Save.data.settings;
  return `<h2>Pausa</h2>
    <p class="muted">Progreso guardado automáticamente. Puedes cerrar la pestaña sin perderlo.</p>
    <div class="settings">
      <label>Música <input type="range" id="set-music" min="0" max="1" step="0.05" value="${s.music}"></label>
      <label>Efectos <input type="range" id="set-sfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
      <label><input type="checkbox" id="set-type" ${s.typewriter ? 'checked' : ''}> Texto progresivo</label>
      <label><input type="checkbox" id="set-shake" ${s.shake ? 'checked' : ''}> Sacudida de cámara</label>
    </div>
    <div class="panel-actions">
      <button data-panel="controls">Controles y ayuda</button>
      <button data-panel="credits">Créditos</button>
      <button data-action="menu">Guardar y volver al menú</button>
    </div>`;
}

function controlsHtml(ctx: PanelContext): string {
  const bindings = getKeyBindings(Save.data.settings.keymap);
  const rows = (Object.keys(ACTION_LABELS) as Action[]).map((a) => `
    <div class="keymap-row">
      <span>${ACTION_LABELS[a]}</span>
      <button type="button" data-rebind="${a}" aria-label="Reasignar ${ACTION_LABELS[a]}">${bindings[a].map(keyLabel).join(' / ')}</button>
    </div>`).join('');
  return `<h2>Controles y ayuda</h2>
    <p class="muted">Pulsa una tecla junto al botón de una acción para reasignarla. Esc cancela. Los controles táctiles no se modifican.</p>
    <div class="keymap-grid">${rows}</div>
    <div class="panel-actions">
      <button data-action="reset-keys">Restablecer teclas</button>
      <button data-panel="credits">Créditos</button>
      <button data-action="${ctx.fromMenu ? 'close' : 'pauseBack'}">${ctx.fromMenu ? 'Cerrar' : 'Volver'}</button>
    </div>
    <h3>Guía rápida</h3>
    <div class="help-grid">
      <div><b>Movimiento</b><span>WASD / flechas · joystick analógico</span></div>
      <div><b>Combate</b><span>Ataque, golpe fuerte, esquiva y defensa son independientes en el panel derecho</span></div>
      <div><b>Accesos</b><span>☰ despliega inventario, mapa, misiones, fórmulas, lente, curación y pausa</span></div>
      <div><b>Multitouch</b><span>Puedes moverte y atacar a la vez; cada dedo controla un botón distinto</span></div>
    </div>`;
}

function deathHtml(): string {
  return `<h2>Tus fuerzas se agotan</h2>
    <p>El espacio se pliega alrededor de tu cuerpo. Pero una runa antigua aún guarda tu último paso.</p>
    <div class="panel-actions">
      <button class="primary" data-action="respawn">Volver al santuario</button>
      <button data-action="menu">Volver al menú</button>
    </div>`;
}

function creditsHtml(fromMenu = false): string {
  return `<h2>Créditos</h2>
    <p><b>Ruinas del Jacobiano</b> — aventura 2.5D de exploración, acción y cálculo.</p>
    <p>Arte, mapas, personajes, música y efectos: generados por código dentro del proyecto. Sin recursos de franquicias externas.</p>
    <p>Motor: Phaser 3 · Tipografía: KaTeX para las fórmulas · Guardado local en tu dispositivo.</p>
    <p class="muted">Las preguntas se generan y verifican matemáticamente con integración numérica. Gracias por explorar con nosotros.</p>
    <div class="panel-actions"><button data-action="${fromMenu ? 'close' : 'pauseBack'}">Volver</button></div>`;
}

export function openPanel(kind: PanelKind, ctx: PanelContext) {
  closePanel();
  Controls.setEnabled(false);
  Audio.play('ui');
  const root = document.getElementById('modal-root');
  if (!root) { Controls.setEnabled(true); return; }
  const overlay = document.createElement('div');
  overlay.className = `panel-overlay panel-${kind}`;
  const body = kind === 'inventory' ? inventoryHtml()
    : kind === 'map' ? mapHtml(ctx)
    : kind === 'quests' ? questsHtml()
    : kind === 'pause' ? pauseHtml()
    : kind === 'death' ? deathHtml()
    : kind === 'controls' ? controlsHtml(ctx)
    : creditsHtml(!!ctx.fromMenu);
  const tabs = kind === 'inventory' || kind === 'map' || kind === 'quests'
    ? `<nav class="panel-tabs">
        <button data-panel="inventory" class="${kind === 'inventory' ? 'active' : ''}">🎒 Inventario</button>
        <button data-panel="map" class="${kind === 'map' ? 'active' : ''}">🗺 Mapa</button>
        <button data-panel="quests" class="${kind === 'quests' ? 'active' : ''}">📜 Misiones</button>
        <button data-action="close">✕</button>
      </nav>` : '';
  overlay.innerHTML = `<div class="panel-card" role="dialog" aria-modal="true">${tabs}<div class="panel-body">${body}</div></div>`;
  root.appendChild(overlay);
  current = { kind, el: overlay };

  if (kind === 'map') paintMap(ctx.zone, ctx.player);

  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const panelBtn = target.closest<HTMLButtonElement>('[data-panel]');
    if (panelBtn) {
      const next = panelBtn.dataset.panel as PanelKind;
      openPanel(next, ctx);
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-action]');
    if (action) {
      const a = action.dataset.action;
      if (a === 'close') closePanel();
      else if (a === 'pauseBack') openPanel('pause', ctx);
      else if (a === 'respawn') { closePanel(); ctx.onRespawn?.(); }
      else if (a === 'menu') {
        closePanel();
        window.dispatchEvent(new CustomEvent('game-quit-menu'));
      } else if (a === 'reset-keys') {
        Controls.resetBindings();
        Audio.play('ui');
        openPanel('controls', ctx);
      }
      return;
    }
    const rebindBtn = target.closest<HTMLButtonElement>('[data-rebind]');
    if (rebindBtn) {
      waitingRebind = rebindBtn.dataset.rebind as Action;
      rebindBtn.textContent = 'Pulsa una tecla…';
      rebindBtn.classList.add('listening');
      return;
    }
    const item = target.closest<HTMLButtonElement>('[data-item]');
    if (item) {
      const id = item.dataset.item as ItemId;
      if (id === 'pocion') {
        if (Save.data.hearts >= Save.data.maxHearts) return;
        if (Save.consume('pocion')) {
          Audio.play('heal');
          Save.heal(3);
          openPanel('inventory', ctx);
        }
      } else if (id === 'lente') {
        window.dispatchEvent(new CustomEvent('game-lens'));
        closePanel();
      }
      return;
    }
    const equip = target.closest<HTMLButtonElement>('[data-equip]');
    if (equip && !equip.disabled) {
      Save.data.equipped.weapon = equip.dataset.equip as 'hoja_oxidada' | ItemId;
      Save.save();
      Audio.play('ui');
      openPanel('inventory', ctx);
    }
  });

  overlay.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === 'set-music') { Save.data.settings.music = Number(el.value); Audio.refreshVolumes(); Save.save(); }
    if (el.id === 'set-sfx') { Save.data.settings.sfx = Number(el.value); Audio.refreshVolumes(); Save.save(); }
    if (el.id === 'set-type') { Save.data.settings.typewriter = el.checked; Save.save(); }
    if (el.id === 'set-shake') { Save.data.settings.shake = el.checked; Save.save(); }
  });

  overlay.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.panel-card') === null && kind !== 'death') closePanel();
  });

  rebindListener = (e: KeyboardEvent) => {
    if (!waitingRebind) return;
    e.preventDefault();
    e.stopPropagation();
    const action = waitingRebind;
    waitingRebind = null;
    if (e.code !== 'Escape') Controls.rebind(action, e.code);
    Audio.play('ui');
    openPanel('controls', ctx);
  };
  window.addEventListener('keydown', rebindListener, true);

  escListener = (e: KeyboardEvent) => {
    if (waitingRebind) return;
    if (e.code === 'Escape' || (kind === 'pause' && e.code === 'Enter')) {
      e.preventDefault();
      if (kind === 'pause' || kind === 'inventory' || kind === 'map' || kind === 'quests' || kind === 'credits' || kind === 'controls') closePanel();
    }
  };
  window.addEventListener('keydown', escListener, true);
  setTimeout(() => overlay.querySelector<HTMLButtonElement>('button')?.focus(), 30);
}

export function pauseFromPanel(ctx: PanelContext) {
  openPanel('pause', ctx);
}

export const GAME_VIEW_H = GAME_H;
