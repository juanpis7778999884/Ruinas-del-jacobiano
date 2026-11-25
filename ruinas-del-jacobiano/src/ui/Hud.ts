import { ZONES, charAt } from '../data/zones';
import { ZoneId } from '../data/types';
import { questStatus } from '../data/story';
import { QuestId } from '../data/types';
import { Save } from '../systems/SaveSystem';

let root: HTMLElement;
let hpFill: HTMLElement;
let hpText: HTMLElement;
let staminaFill: HTMLElement;
let zoneText: HTMLElement;
let runeText: HTMLElement;
let runePips: HTMLElement;
let runePipEls: HTMLElement[] = [];
let runePipCount = -1;
let questText: HTMLElement;
let bossBox: HTMLElement;
let bossFill: HTMLElement;
let bossName: HTMLElement;
let prompt: HTMLElement;
let toast: HTMLElement;
let minimap: HTMLCanvasElement;
let minimapBase: HTMLCanvasElement | null = null;
let minimapZone = '';
let toastTimer = 0;

function cacheRefs() {
  hpFill = root.querySelector('.hud-bar.hp .hud-fill')!;
  hpText = root.querySelector('.hud-bar.hp span')!;
  staminaFill = root.querySelector('.hud-bar.st .hud-fill')!;
  zoneText = root.querySelector('.hud-zone')!;
  runeText = root.querySelector('.rune-label')!;
  runePips = root.querySelector('.rune-pips')!;
  questText = root.querySelector('.hud-quest')!;
  bossBox = root.querySelector('.hud-boss')!;
  bossFill = root.querySelector('.hud-boss-fill')!;
  bossName = root.querySelector('.hud-boss span')!;
  prompt = root.querySelector('.hud-prompt')!;
  toast = root.querySelector('.hud-toast')!;
  minimap = root.querySelector('#hud-minimap') as HTMLCanvasElement;
  runePipEls = [];
  runePipCount = -1;
  minimapBase = null;
  minimapZone = '';
}

export function mountHud() {
  const existing = document.getElementById('game-hud');
  if (existing) {
    root = existing;
    root.style.display = '';
    cacheRefs();
    return;
  }
  root = document.createElement('div');
  root.id = 'game-hud';
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-vitals">
        <span class="hud-caption">Vitalidad</span>
        <div class="hud-bar hp"><div class="hud-fill"></div><span></span></div>
        <div class="hud-bar st"><div class="hud-fill"></div></div>
      </div>
      <div class="hud-runes"><span class="rune-label"></span><span class="rune-pips"></span></div>
    </div>
    <div class="hud-center">
      <div class="hud-zone"></div>
      <div class="hud-boss" hidden><i>✦</i><span></span><div class="hud-boss-track"><div class="hud-boss-fill"></div></div></div>
    </div>
    <div class="hud-right">
      <div class="minimap-frame"><span class="minimap-compass">N</span><canvas id="hud-minimap" width="160" height="100"></canvas></div>
    </div>
    <div class="hud-quest"></div>
    <div class="hud-prompt" hidden></div>
    <div class="hud-toast" hidden></div>`;
  document.body.appendChild(root);
  cacheRefs();
}

export interface HudState {
  zone: ZoneId;
  hp: number;
  maxHp: number;
  stamina: number;
  player: { x: number; y: number };
  runesSolved: number;
  runesTotal: number;
  mainQuest: QuestId;
  boss?: { name: string; hp: number; maxHp: number; phase: number; phases: number } | null;
}

export function updateHud(s: HudState) {
  if (!root) return;
  const hp = Math.max(0, Math.min(s.hp, s.maxHp));
  hpFill.style.width = `${(hp / s.maxHp) * 100}%`;
  hpFill.classList.toggle('low', hp / s.maxHp <= 0.3);
  hpText.textContent = `${hp} / ${s.maxHp}`;
  staminaFill.style.width = `${Math.max(0, Math.min(100, s.stamina))}%`;
  const zone = ZONES[s.zone];
  zoneText.textContent = `${zone.shortName} · ${zone.subtitle}`;
  updateRunes(s.runesSolved, s.runesTotal);
  questText.textContent = questStatus(Save.data, s.mainQuest);
  if (s.boss) {
    bossBox.hidden = false;
    bossName.textContent = `${s.boss.name} · fase ${s.boss.phase}/${s.boss.phases}`;
    bossFill.style.width = `${Math.max(0, (s.boss.hp / s.boss.maxHp) * 100)}%`;
  } else {
    bossBox.hidden = true;
  }
  drawMinimap(s.zone, s.player);
}

function updateRunes(solved: number, total: number) {
  if (!total) {
    runeText.textContent = '◇ Cartesia libre';
    if (runePipCount !== 0) {
      runePips.textContent = '';
      runePipEls = [];
      runePipCount = 0;
    }
    return;
  }
  runeText.textContent = `◇ Runas ${solved}/${total}`;
  if (runePipCount !== total) {
    runePips.textContent = '';
    runePipEls = Array.from({ length: total }, () => {
      const pip = document.createElement('i');
      runePips.appendChild(pip);
      return pip;
    });
    runePipCount = total;
  }
  for (let i = 0; i < runePipEls.length; i++) runePipEls[i].classList.toggle('on', i < solved);
}

function ensureMinimapBase(zoneId: ZoneId) {
  if (minimapBase && minimapZone === zoneId) return;
  minimapZone = zoneId;
  const zone = ZONES[zoneId];
  minimapBase = document.createElement('canvas');
  minimapBase.width = minimap.width;
  minimapBase.height = minimap.height;
  const ctx = minimapBase.getContext('2d');
  if (!ctx) return;
  const tw = minimap.width / zone.map[0].length;
  const th = minimap.height / zone.map.length;
  for (let y = 0; y < zone.map.length; y++) {
    for (let x = 0; x < zone.map[y].length; x++) {
      const ch = charAt(zone, x, y);
      const c = ch === 'D' || ch === 'g' ? '#a24d47'
        : ch === '#' || ch === 'c' ? '#7c766f'
        : ch === 'T' ? '#4d7a4a'
        : ch === '~' ? '#4a7089'
        : ch === '=' ? '#9a7d4e'
        : ch === ',' ? '#4e6b4d'
        : ch === '*' ? '#78975a'
        : '#2b2d33';
      ctx.fillStyle = c;
      ctx.fillRect(x * tw, y * th, Math.ceil(tw), Math.ceil(th));
    }
  }
}

function drawMinimap(zoneId: ZoneId, player: { x: number; y: number }) {
  const ctx = minimap.getContext('2d');
  if (!ctx) return;
  ensureMinimapBase(zoneId);
  const zone = ZONES[zoneId];
  const tw = minimap.width / zone.map[0].length;
  const th = minimap.height / zone.map.length;
  ctx.clearRect(0, 0, minimap.width, minimap.height);
  if (minimapBase) ctx.drawImage(minimapBase, 0, 0);
  for (const r of zone.runes) {
    ctx.fillStyle = Save.data.solvedRunes[r.id] ? '#b7ead9' : '#8fd7c2';
    ctx.fillRect(r.x * tw, r.y * th, Math.max(2, tw), Math.max(2, th));
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x * tw - 1, player.y * th - 1, Math.max(3, tw + 2), Math.max(3, th + 2));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(player.x * tw - 2, player.y * th - 2, Math.max(4, tw + 4), Math.max(4, th + 4));
}

export function setPrompt(text: string) {
  if (!root) return;
  if (!text) { prompt.hidden = true; return; }
  prompt.hidden = false;
  prompt.textContent = text;
}

export function showToast(text: string, ms = 2400) {
  if (!root) return;
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, ms);
}

export function hideHud() {
  if (root) root.style.display = 'none';
}

export function showHud() {
  if (root) root.style.display = '';
}
