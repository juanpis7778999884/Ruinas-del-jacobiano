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
let questText: HTMLElement;
let bossBox: HTMLElement;
let bossFill: HTMLElement;
let bossName: HTMLElement;
let prompt: HTMLElement;
let toast: HTMLElement;
let minimap: HTMLCanvasElement;
let toastTimer = 0;
let minimapZone = '';

export function mountHud() {
  const existing = document.getElementById('game-hud');
  if (existing) {
    existing.style.display = '';
    return;
  }
  root = document.createElement('div');
  root.id = 'game-hud';
  root.innerHTML = `
    <div class="hud-left">
      <div class="hud-bar hp"><div class="hud-fill"></div><span></span></div>
      <div class="hud-bar st"><div class="hud-fill"></div></div>
      <div class="hud-runes"></div>
    </div>
    <div class="hud-center">
      <div class="hud-zone"></div>
      <div class="hud-boss" hidden><span></span><div class="hud-boss-track"><div class="hud-boss-fill"></div></div></div>
    </div>
    <div class="hud-right"><canvas id="hud-minimap" width="160" height="100"></canvas></div>
    <div class="hud-quest"></div>
    <div class="hud-prompt" hidden></div>
    <div class="hud-toast" hidden></div>`;
  document.body.appendChild(root);
  hpFill = root.querySelector('.hud-bar.hp .hud-fill')!;
  hpText = root.querySelector('.hud-bar.hp span')!;
  staminaFill = root.querySelector('.hud-bar.st .hud-fill')!;
  zoneText = root.querySelector('.hud-zone')!;
  runeText = root.querySelector('.hud-runes')!;
  questText = root.querySelector('.hud-quest')!;
  bossBox = root.querySelector('.hud-boss')!;
  bossFill = root.querySelector('.hud-boss-fill')!;
  bossName = root.querySelector('.hud-boss span')!;
  prompt = root.querySelector('.hud-prompt')!;
  toast = root.querySelector('.hud-toast')!;
  minimap = root.querySelector('#hud-minimap') as HTMLCanvasElement;
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
  hpText.textContent = `${hp} / ${s.maxHp}`;
  staminaFill.style.width = `${Math.max(0, Math.min(100, s.stamina))}%`;
  const zone = ZONES[s.zone];
  zoneText.textContent = `${zone.shortName} · ${zone.subtitle}`;
  runeText.textContent = s.runesTotal ? `◇ Runas ${s.runesSolved}/${s.runesTotal}` : '◇ Cartesia libre';
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

function drawMinimap(zoneId: ZoneId, player: { x: number; y: number }) {
  if (minimapZone !== zoneId) minimapZone = zoneId;
  const zone = ZONES[zoneId];
  const ctx = minimap.getContext('2d');
  if (!ctx) return;
  const tw = minimap.width / zone.map[0].length;
  const th = minimap.height / zone.map.length;
  ctx.clearRect(0, 0, minimap.width, minimap.height);
  for (let y = 0; y < zone.map.length; y++) {
    for (let x = 0; x < zone.map[y].length; x++) {
      const ch = charAt(zone, x, y);
      const c = ch === '#' || ch === 'c' ? '#5b5770'
        : ch === 'T' ? '#2f7a3c'
        : ch === '~' ? '#2f6ba8'
        : ch === '=' ? '#8a7048'
        : ch === ',' ? '#38644a'
        : '#252741';
      ctx.fillStyle = c;
      ctx.fillRect(x * tw, y * th, Math.ceil(tw), Math.ceil(th));
    }
  }
  for (const r of zone.runes) {
    ctx.fillStyle = Save.data.solvedRunes[r.id] ? '#80ed99' : '#8dffd8';
    ctx.fillRect(r.x * tw, r.y * th, Math.max(2, tw), Math.max(2, th));
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(player.x * tw - 1, player.y * th - 1, Math.max(3, tw + 2), Math.max(3, th + 2));
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
