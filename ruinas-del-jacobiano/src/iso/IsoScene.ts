import Phaser from 'phaser';
import { GAME_H, GAME_W, MAP_H, MAP_W } from '../config';
import { storyFor } from '../data/story';
import { EnemyKind, GridPos, NpcId, QuestId, ZoneId } from '../data/types';
import {
  BossDef,
  ChestDef,
  ExitDef,
  LoreDef,
  MechanismDef,
  NpcDef,
  RuneDef,
  ZoneDef,
  ZONES,
  ZONE_ORDER,
  charAt,
  isSolidChar,
} from '../data/zones';
import { createMaterials, disposeMaterials } from '../three/materials';
import type { MaterialSet } from '../three/materials';
import { Stage, sceneFadeIn, sceneFadeOut } from '../three/stage';
import type { WorldSnapshot } from '../three/types';
import { World3D } from '../three/World3D';
import { Audio } from '../systems/Audio';
import { Controls } from '../systems/Controls';
import { generateQuestion, Question } from '../systems/questions';
import { Save } from '../systems/SaveSystem';
import { isDialogueOpen, showLines, showStory } from '../ui/Dialogue';
import { hideHud, mountHud, setPrompt, showToast, updateHud } from '../ui/Hud';
import { openJournal } from '../ui/Journal';
import { isOverlayOpen, openPanel } from '../ui/Overlays';
import { askQuestion } from '../ui/QuestionModal';
import {
  DEPTH_AIR,
  DEPTH_DECAL,
  DEPTH_ENTITY,
  DEPTH_FLOOR,
  DEPTH_LIGHT,
  DEPTH_PROP,
  ISO_BG,
  ISO_CAMERA_ZOOM,
  ISO_PLAYER_R,
  ISO_SPEED,
  ISO_TILE_H,
  ISO_TILE_W,
} from './isoConfig';
import { clamp, dist, dot, gridDirToScreen, gridToScreen, isoDepth } from './isoMath';
import {
  HeroPose,
  ISO_GATE_ORIGIN_Y,
  ISO_WALL_ORIGIN_Y,
  bossKey,
  buildIsoTextures,
  enemyKey,
  heroKey,
} from './isoTextures';

interface GateEntry {
  sprite: Phaser.GameObjects.Image;
  type: 'D' | 'g';
  mechanism?: MechanismDef;
}

interface SwitchData {
  id: string;
  mech: MechanismDef;
}

type InteractableData = RuneDef | ExitDef | ChestDef | LoreDef | MechanismDef | NpcDef | SwitchData | null;

interface Interactable {
  kind: 'rune' | 'portal' | 'chest' | 'lore' | 'shrine' | 'switch' | 'npc' | 'boss';
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  label: () => string;
  data: InteractableData;
}

interface Enemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  state: 'idle' | 'chase' | 'windup' | 'recover';
  stateUntil: number;
  home: GridPos;
  facingX: number;
  facingY: number;
  flashUntil: number;
  dead: boolean;
}

interface Boss {
  def: BossDef;
  x: number;
  y: number;
  phaseIndex: number;
  hp: number;
  maxHp: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  state: 'idle' | 'windup' | 'recover' | 'stunned' | 'dead';
  stateUntil: number;
  nextAction: number;
  flashUntil: number;
  stunnedUntil: number;
  dead: boolean;
}

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  home: boolean;
  color: number;
}

interface PlayerState {
  x: number;
  y: number;
  velX: number;
  velY: number;
  stamina: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  facingX: number;
  facingY: number;
  pose: HeroPose;
  poseUntil: number;
  attackStart: number;
  attackDuration: number;
  attackReady: number;
  attackHeavy: boolean;
  attackHit: Set<string>;
  combo: number;
  comboWindow: number;
  dodgeUntil: number;
  dodgeReady: number;
  dodgeX: number;
  dodgeY: number;
  guardUntil: number;
  hurtUntil: number;
}

const ENEMY_STATS: Record<EnemyKind, { hp: number; speed: number }> = {
  espiritu: { hp: 24, speed: 1.65 },
  espino: { hp: 34, speed: 1.3 },
  centinela: { hp: 52, speed: 1.05 },
  arquero: { hp: 22, speed: 1.2 },
  sombra: { hp: 38, speed: 1.85 },
};

const NPC_TINTS: Record<NpcId, number> = {
  anciana: 0xb388c9,
  fubini: 0x4f8fd8,
  guardiana: 0x4fbfa2,
  cartografa: 0x9d6bd6,
  sabio: 0x6f9fe0,
  errante: 0xd49a5b,
  recaudador: 0x78a6c9,
};

export class IsoScene extends Phaser.Scene {
  private zoneId: ZoneId = 'cartesia';
  private zone!: ZoneDef;
  private spawn: GridPos = { x: 0, y: 0 };
  private active = false;
  private player!: PlayerState;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private projectiles: Projectile[] = [];
  private interactables: Interactable[] = [];
  private gates = new Map<string, GateEntry>();
  private runeSprites = new Map<string, Phaser.GameObjects.Image>();
  private switchSprites = new Map<string, Phaser.GameObjects.Image>();
  private chestSprites = new Map<string, Phaser.GameObjects.Image>();
  private mechProgress: Record<string, string[]> = {};
  private runesOpen = false;
  private lensGrid!: Phaser.GameObjects.Graphics;
  private lensOn = false;
  private uiModal = false;
  private journalOpen = false;
  private nextHud = 0;
  private nextSave = 0;
  private nextWaterFrame = 0;
  private hitStopUntil = 0;
  private cameraReady = false;
  private waterTiles: { img: Phaser.GameObjects.Image; phase: number }[] = [];
  private foliage: Phaser.GameObjects.Image[] = [];
  private stage: Stage | null = null;
  private world3D: World3D | null = null;
  private materials: MaterialSet | null = null;
  private readonly originX = 800;
  private readonly originY = 70;

  constructor() {
    super('World');
  }

  init(data: { zone?: ZoneId; spawn?: GridPos } = {}) {
    const candidate = (data.zone ?? Save.data.currentZone) as ZoneId;
    this.zoneId = ZONES[candidate] ? candidate : 'cartesia';
    this.zone = ZONES[this.zoneId];
    const saved = Save.data.position[this.zoneId];
    this.spawn = data.spawn ?? saved ?? this.zone.spawn;
  }

  create() {
    buildIsoTextures(this);
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.interactables = [];
    this.gates.clear();
    this.runeSprites.clear();
    this.switchSprites.clear();
    this.chestSprites.clear();
    this.mechProgress = {};
    this.uiModal = false;
    this.journalOpen = false;
    this.active = false;
    this.runesOpen = this.zone.runes.length > 0 && this.zone.runes.every((r) => !!Save.data.solvedRunes[r.id]);

    document.body.classList.add('playing');
    mountHud();
    Controls.refreshBindings();
    Audio.unlock();
    Audio.setTrack(this.zone.ambience);

    this.waterTiles = [];
    this.foliage = [];
    this.nextWaterFrame = 0;
    this.cameraReady = false;
    this.buildMap();
    this.placeMissingEntities();
    this.createPlayer();
    this.spawnNpcs();
    this.spawnEnemies();
    this.spawnBoss();
    this.createAtmosphere();
    this.createLensGrid();
    this.configureCamera();
    this.setupWorld3D();

    window.addEventListener('game-quit-menu', this.handleQuitMenuEvent);
    window.addEventListener('game-lens', this.handleLensEvent);
    window.addEventListener('game-quality-change', this.handleQualityEvent);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    Save.data.currentZone = this.zoneId;
    Save.data.discovered[this.zoneId] = true;
    Save.data.position[this.zoneId] = { x: this.player.x, y: this.player.y };
    Save.save();
    this.active = true;
    void this.playIntro();
  }

  private screenFor(gx: number, gy: number): { x: number; y: number } {
    const p = gridToScreen(gx, gy);
    return { x: p.x + this.originX, y: p.y + this.originY };
  }

  private tileCenter(x: number, y: number): { x: number; y: number } {
    return this.screenFor(x + 0.5, y + 0.5);
  }

  private configureCamera() {
    const w = window.innerWidth || GAME_W;
    const h = window.innerHeight || GAME_H;
    const portrait = h > w * 1.08;
    const short = h <= 520;
    const narrow = w <= 720;
    const zoom = portrait ? 0.76 : short ? 0.88 : narrow ? 0.86 : ISO_CAMERA_ZOOM;
    const cam = this.cameras.main;
    const corners = [
      this.screenFor(0, 0),
      this.screenFor(MAP_W, 0),
      this.screenFor(0, MAP_H),
      this.screenFor(MAP_W, MAP_H),
    ];
    const minX = Math.min(...corners.map((p) => p.x)) - 160;
    const maxX = Math.max(...corners.map((p) => p.x)) + 160;
    const minY = Math.min(...corners.map((p) => p.y)) - 220;
    const maxY = Math.max(...corners.map((p) => p.y)) + 180;
    cam.setBackgroundColor(ISO_BG);
    cam.setZoom(zoom);
    cam.setBounds(minX, minY, maxX - minX, maxY - minY);
    cam.startFollow(this.player.sprite, true, portrait ? 0.09 : 0.11, portrait ? 0.09 : 0.11);
    cam.setDeadzone(portrait ? 190 : short ? 230 : 200, portrait ? 130 : short ? 90 : 115);
    cam.setFollowOffset(0, portrait ? 26 : 0);
    if (!this.cameraReady) {
      cam.fadeIn(320, 8, 8, 20);
      this.cameraReady = true;
    }
  }

  private setupWorld3D() {
    try {
      const container = document.getElementById('game') ?? document.body;
      this.stage = new Stage(container, Save.data.settings.quality, 2);
      this.materials = createMaterials();
      this.world3D = new World3D(this.stage, this.zone, this.zoneId, this.materials);
      this.stage.resize(this.game.canvas);
      this.updateWorld3D(this.time.now, 0);
      this.game.canvas.style.visibility = 'hidden';
      void sceneFadeIn(320);
    } catch (error) {
      console.warn('Renderizador 3D no disponible; se mantiene la escena 2D.', error);
      this.disposeWorld3D();
      this.game.canvas.style.visibility = '';
      void sceneFadeIn(320);
    }
  }

  private disposeWorld3D() {
    this.world3D?.dispose();
    this.world3D = null;
    if (this.materials) disposeMaterials(this.materials);
    this.materials = null;
    this.stage?.dispose();
    this.stage = null;
  }

  private updateWorld3D(time: number, delta: number) {
    if (!this.world3D || !this.stage) return;
    this.world3D.sync(this.worldSnapshot(time));
    this.world3D.update(time, delta);
    this.stage.render();
  }

  private worldSnapshot(time: number): WorldSnapshot {
    const p = this.player;
    const attacking = time >= p.attackStart && time <= p.attackStart + p.attackDuration;
    const switchStates: Record<string, boolean> = {};
    this.zone.mechanisms.forEach((mech) => {
      mech.switches.forEach((sw) => {
        switchStates[sw.id] = !!Save.data.mechanisms[mech.id] || (this.mechProgress[mech.id] ?? []).includes(sw.id);
      });
    });
    const gateOpen: Record<string, boolean> = {};
    this.gates.forEach((gate, keyName) => {
      gateOpen[keyName] = gate.type === 'D'
        ? this.runesOpen
        : !!gate.mechanism && !!Save.data.mechanisms[gate.mechanism.id];
    });
    const boss = this.boss;
    return {
      time,
      zoneId: this.zoneId,
      player: {
        x: p.x,
        y: p.y,
        speed: Math.hypot(p.velX, p.velY),
        facingX: p.facingX,
        facingY: p.facingY,
        pose: p.pose,
        hurt: time < p.hurtUntil,
        dodge: time < p.dodgeUntil,
        guard: time < p.guardUntil,
        action: attacking ? 'attack' : '',
        actionProgress: attacking ? clamp((time - p.attackStart) / Math.max(1, p.attackDuration), 0, 1) : 0,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.x,
        y: e.y,
        facingX: e.facingX,
        facingY: e.facingY,
        speed: e.dead ? 0 : e.state === 'chase' ? e.speed : e.state === 'idle' ? 0.25 : 0,
        state: e.state,
        hurt: time < e.flashUntil,
        dead: e.dead,
      })),
      boss: boss ? {
        kind: boss.def.kind,
        x: boss.x,
        y: boss.y,
        phase: boss.phaseIndex,
        state: boss.state,
        dead: boss.dead,
        hurt: time < boss.flashUntil,
      } : null,
      npcs: this.zone.npcs.map((npc) => ({ id: npc.id, x: npc.x, y: npc.y })),
      projectiles: this.projectiles.map((pr) => ({ x: pr.x, y: pr.y, color: pr.color, home: pr.home })),
      solvedRunes: { ...Save.data.solvedRunes },
      openedChests: { ...Save.data.openedChests },
      mechanisms: { ...Save.data.mechanisms },
      switchStates,
      gateOpen,
      lens: this.lensOn,
    };
  }

  private buildMap() {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = charAt(this.zone, x, y);
        const p = this.tileCenter(x, y);
        const isBridge = this.zoneId === 'valle' && ch === '=' && [
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ].some(([dx, dy]) => charAt(this.zone, x + dx, y + dy) === '~');
        const floorKey = ch === '~' ? `iso_water${(x + y) % 4}`
          : isBridge ? 'iso_bridge'
          : ch === '=' ? 'iso_path'
          : ch === ',' || ch === '*' ? 'iso_moss'
          : ch === 'D' || ch === 'g' ? 'iso_secret'
          : ch === '^' || ch === 'v' ? 'iso_stairs'
          : `iso_floor_${this.zone.tileset}${(x * 7 + y * 3) % 4}`;
        const floor = this.add.image(p.x, p.y, floorKey)
          .setOrigin(0.5)
          .setDepth(isoDepth(x, y, DEPTH_FLOOR));
        if (ch === '~') this.waterTiles.push({ img: floor, phase: (x + y) % 4 });

        if (ch === '*') {
          const flowers = this.add.image(p.x, p.y - 4, 'iso_flowers')
            .setOrigin(0.5, 0.9)
            .setAlpha(0.85)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_DECAL));
          this.tweens.add({ targets: flowers, angle: { from: -2, to: 2 }, duration: 2400 + (x * 13 + y * 7) % 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        if ((ch === '.' || ch === ',') && (x * 13 + y * 7) % 37 === 0 && !(Math.abs(x - this.spawn.x) <= 1 && Math.abs(y - this.spawn.y) <= 1)) {
          const bush = this.add.image(p.x + 4, p.y + 3, `iso_bush${(x + y) % 2}`)
            .setOrigin(0.5, 0.86)
            .setScale(0.72)
            .setAlpha(0.85)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_DECAL));
          this.foliage.push(bush);
          this.tweens.add({ targets: bush, angle: { from: -2, to: 2 }, duration: 2000 + (x * 17 + y * 3) % 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        if (ch === '#') {
          this.add.image(p.x, p.y, `iso_wall${(x * 3 + y) % 4}`)
            .setOrigin(0.5, ISO_WALL_ORIGIN_Y)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
        } else if (ch === 'c') {
          this.add.image(p.x, p.y - 2, `iso_column${(x + y) % 2}`)
            .setOrigin(0.5, 0.88)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
        } else if (ch === 'T') {
          const tree = this.add.image(p.x, p.y + 6, `iso_tree${(x * 5 + y) % 3}`)
            .setOrigin(0.5, 0.86)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
          this.foliage.push(tree);
          this.tweens.add({ targets: tree, angle: { from: -1.4, to: 1.4 }, duration: 2600 + (x * 11 + y * 5) % 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (ch === 'o') {
          this.add.image(p.x, p.y + 2, `iso_rock${(x + y) % 2}`)
            .setOrigin(0.5, 0.84)
            .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
        } else if (ch === 'B') {
          this.placeBrazier(x, y);
        } else if (ch === 'R') {
          this.placeRune(x, y);
        } else if (ch === 'P') {
          this.placePortal(x, y);
        } else if (ch === 'C') {
          this.placeChest(x, y);
        } else if (ch === 'L') {
          this.placeLore(x, y);
        } else if (ch === 'S') {
          this.placeSwitch(x, y);
        } else if (ch === 'X') {
          this.placeShrine(x, y);
        } else if (ch === 'D' || ch === 'g') {
          this.placeGate(x, y, ch);
        }
      }
    }
  }

  private placeBrazier(x: number, y: number) {
    const p = this.tileCenter(x, y);
    this.add.image(p.x, p.y + 8, 'iso_brazier')
      .setOrigin(0.5, 0.9)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    this.add.image(p.x, p.y - 12, 'iso_glow_warm')
      .setOrigin(0.5)
      .setScale(0.38)
      .setAlpha(0.45)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_LIGHT);
    this.add.particles(p.x, p.y - 20, 'iso_dot', {
      speed: { min: 8, max: 26 },
      angle: { min: 250, max: 290 },
      lifespan: { min: 500, max: 950 },
      frequency: 110,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffb703, 0xff7a3d],
      blendMode: 'ADD',
    }).setDepth(DEPTH_LIGHT);
  }

  private placeRune(x: number, y: number) {
    const def = this.zone.runes.find((r) => r.x === x && r.y === y);
    const lit = def ? !!Save.data.solvedRunes[def.id] : false;
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y + 8, lit ? 'iso_rune_lit' : 'iso_rune_dark')
      .setOrigin(0.5, 0.9)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    if (def) {
      this.runeSprites.set(def.id, sprite);
      this.interactables.push({
        kind: 'rune', x, y, sprite, data: def,
        label: () => lit ? `${def.title} (resuelta)` : `Descifrar ${def.title}`,
      });
    }
  }

  private placePortal(x: number, y: number) {
    const def = this.zone.exits.find((e) => e.x === x && e.y === y);
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y + 10, 'iso_portal')
      .setOrigin(0.5, 0.88)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    this.add.image(p.x, p.y - 10, 'iso_glow_violet')
      .setScale(0.35)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_LIGHT);
    this.tweens.add({ targets: sprite, y: sprite.y - 3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (def) {
      this.interactables.push({ kind: 'portal', x, y, sprite, data: def, label: () => def.label });
    }
  }

  private placeChest(x: number, y: number) {
    const def = this.zone.chests.find((c) => c.x === x && c.y === y);
    const p = this.tileCenter(x, y);
    const opened = def ? !!Save.data.openedChests[def.id] : false;
    const sprite = this.add.image(p.x, p.y + 6, opened ? 'iso_chest_open' : 'iso_chest')
      .setOrigin(0.5, 0.82)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    if (def) {
      if (def.secret && !Save.data.items.lente) sprite.setAlpha(0.5);
      this.chestSprites.set(def.id, sprite);
      this.interactables.push({ kind: 'chest', x, y, sprite, data: def, label: () => opened ? 'Cofre vacío' : 'Abrir cofre' });
    }
  }

  private placeLore(x: number, y: number) {
    const def = this.zone.lore.find((l) => l.x === x && l.y === y);
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y + 4, 'iso_tablet')
      .setOrigin(0.5, 0.88)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    if (def) {
      this.interactables.push({ kind: 'lore', x, y, sprite, data: def, label: () => `Leer: ${def.title}` });
    }
  }

  private placeSwitch(x: number, y: number) {
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y + 6, 'iso_switch_off')
      .setOrigin(0.5, 0.88)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    const mech = this.zone.mechanisms.find((m) => m.switches.some((s) => s.x === x && s.y === y));
    if (mech) {
      const sw = mech.switches.find((s) => s.x === x && s.y === y)!;
      if (Save.data.mechanisms[mech.id] || (this.mechProgress[mech.id] ?? []).includes(sw.id)) sprite.setTexture('iso_switch_on');
      this.switchSprites.set(sw.id, sprite);
      this.interactables.push({
        kind: 'switch', x, y, sprite, data: { id: sw.id, mech },
        label: () => `Tocar pilar (${(this.mechProgress[mech.id] ?? []).length}/${mech.order.length})`,
      });
    }
  }

  private placeShrine(x: number, y: number) {
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y + 8, 'iso_shrine')
      .setOrigin(0.5, 0.88)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    this.add.image(p.x, p.y - 16, 'iso_glow_green')
      .setScale(0.32)
      .setAlpha(0.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_LIGHT);
    this.interactables.push({ kind: 'shrine', x, y, sprite, data: null, label: () => 'Orar y guardar' });
  }

  private placeGate(x: number, y: number, type: 'D' | 'g') {
    const mech = type === 'g' ? this.zone.mechanisms.find((m) => m.gate.x === x && m.gate.y === y) : undefined;
    const open = type === 'D' ? this.runesOpen : !!mech && !!Save.data.mechanisms[mech.id];
    const p = this.tileCenter(x, y);
    const sprite = this.add.image(p.x, p.y, open ? 'iso_gate_open' : 'iso_gate_closed')
      .setOrigin(0.5, ISO_GATE_ORIGIN_Y)
      .setDepth(isoDepth(x + 0.5, y + 0.5, DEPTH_PROP));
    this.gates.set(`${x},${y}`, { sprite, type, mechanism: mech });
  }

  private placeMissingEntities() {
    this.zone.runes.forEach((r) => {
      if (!this.runeSprites.has(r.id)) this.placeRune(r.x, r.y);
    });
    this.zone.chests.forEach((c) => {
      if (!this.chestSprites.has(c.id)) this.placeChest(c.x, c.y);
    });
    this.zone.mechanisms.forEach((m) => {
      m.switches.forEach((s) => {
        if (!this.switchSprites.has(s.id)) this.placeSwitch(s.x, s.y);
      });
    });
  }

  private createPlayer() {
    const px = this.spawn.x + 0.5;
    const py = this.spawn.y + 0.5;
    const p = this.screenFor(px, py);
    const shadow = this.add.image(p.x, p.y + 3, 'iso_shadow')
      .setOrigin(0.5)
      .setScale(0.9)
      .setAlpha(0.75)
      .setDepth(isoDepth(px, py, DEPTH_DECAL));
    const sprite = this.add.image(p.x, p.y, heroKey('front', 'idle', 0))
      .setOrigin(0.5, 0.92)
      .setScale(1.12)
      .setDepth(isoDepth(px, py, DEPTH_ENTITY));
    this.player = {
      x: px, y: py, velX: 0, velY: 0, stamina: 100, sprite, shadow,
      facingX: 0, facingY: 1,
      pose: 'idle', poseUntil: 0,
      attackStart: 0, attackDuration: 0, attackReady: 0, attackHeavy: false,
      attackHit: new Set<string>(), combo: 0, comboWindow: 0,
      dodgeUntil: 0, dodgeReady: 0, dodgeX: 0, dodgeY: 0,
      guardUntil: 0, hurtUntil: 0,
    };
  }

  private spawnNpcs() {
    this.zone.npcs.forEach((npc) => {
      const pos = this.freePos(npc.x, npc.y);
      const p = this.tileCenter(pos.x, pos.y);
      const shadow = this.add.image(p.x, p.y + 3, 'iso_shadow')
        .setOrigin(0.5)
        .setScale(0.75)
        .setAlpha(0.6)
        .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_DECAL));
      const sprite = this.add.image(p.x, p.y, heroKey('front', 'idle', 0))
        .setOrigin(0.5, 0.92)
        .setScale(1.02)
        .setTint(NPC_TINTS[npc.id])
        .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_ENTITY));
      this.tweens.add({ targets: sprite, y: sprite.y - 2, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.interactables.push({ kind: 'npc', x: pos.x, y: pos.y, sprite, data: npc, label: () => `Hablar con ${npc.name}` });
      void shadow;
    });
  }

  private spawnEnemies() {
    this.zone.enemies.forEach((spawn, i) => {
      const pos = this.freePos(spawn.x, spawn.y);
      const stats = ENEMY_STATS[spawn.kind];
      const p = this.tileCenter(pos.x, pos.y);
      const shadow = this.add.image(p.x, p.y + 3, 'iso_shadow')
        .setOrigin(0.5)
        .setScale(0.7)
        .setAlpha(0.65)
        .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_DECAL));
      const sprite = this.add.image(p.x, p.y, enemyKey(spawn.kind, 0))
        .setOrigin(0.5, 0.92)
        .setScale(0.92)
        .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_ENTITY));
      this.enemies.push({
        id: `enemy_${this.zoneId}_${i}`,
        kind: spawn.kind,
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        sprite, shadow,
        state: 'idle', stateUntil: 0,
        home: { x: pos.x + 0.5, y: pos.y + 0.5 },
        facingX: 0, facingY: 1,
        flashUntil: 0, dead: false,
      });
    });
  }

  private spawnBoss() {
    const def = this.zone.boss;
    if (!def || Save.data.completed[this.zoneId]) return;
    const phaseIndex = clamp(Save.data.bossPhase[this.zoneId] ?? 0, 0, def.phases.length - 1);
    const pos = this.freePos(def.x, def.y);
    const p = this.tileCenter(pos.x, pos.y);
    const shadow = this.add.image(p.x, p.y + 8, 'iso_shadow')
      .setOrigin(0.5)
      .setScale(2)
      .setAlpha(0.7)
      .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_DECAL));
    const sprite = this.add.image(p.x, p.y, bossKey(def.kind, 0))
      .setOrigin(0.5, 0.94)
      .setScale(1.25)
      .setDepth(isoDepth(pos.x + 0.5, pos.y + 0.5, DEPTH_ENTITY));
    this.boss = {
      def, x: pos.x + 0.5, y: pos.y + 0.5,
      phaseIndex,
      hp: 62 + phaseIndex * 26,
      maxHp: 62 + phaseIndex * 26,
      sprite, shadow,
      state: 'idle', stateUntil: 0,
      nextAction: this.time.now + 2200,
      flashUntil: 0,
      stunnedUntil: 0, dead: false,
    };
    this.interactables.push({
      kind: 'boss', x: pos.x, y: pos.y, sprite, data: null,
      label: () => `Desafiar a ${def.name} · ${def.phases[phaseIndex].title}`,
    });
  }

  private createAtmosphere() {
    this.add.image(0, 0, 'iso_vignette')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(GAME_W, GAME_H)
      .setDepth(DEPTH_AIR)
      .setAlpha(0.82);
    const fog = this.add.image(0, 0, 'iso_fog')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(GAME_W, GAME_H)
      .setDepth(DEPTH_AIR)
      .setAlpha(0.45);
    this.tweens.add({ targets: fog, alpha: 0.2, duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const corners = [
      this.screenFor(0, 0), this.screenFor(MAP_W, 0),
      this.screenFor(0, MAP_H), this.screenFor(MAP_W, MAP_H),
    ];
    const minX = Math.min(...corners.map((p) => p.x)) - 80;
    const maxX = Math.max(...corners.map((p) => p.x)) + 80;
    const minY = Math.min(...corners.map((p) => p.y)) - 140;
    const maxY = Math.max(...corners.map((p) => p.y)) + 120;
    const moteTint = this.zone.ambience === 'sanctum' ? [0xb38bff, 0xe0aaff]
      : this.zone.ambience === 'river' ? [0x8dffd8, 0x9fe0ff]
      : this.zone.ambience === 'city' ? [0xffd166, 0xffe9a3]
      : [0x9dffd6, 0xd8ffb0];
    const leafTint = this.zone.ambience === 'city' ? [0xb08a4a, 0xd7b45c]
      : this.zone.ambience === 'sanctum' ? [0x8a6bc9, 0xb38bff]
      : [0x4f9e58, 0x8fd06a, 0xc9a24a];

    this.add.particles(0, 0, 'iso_mote', {
      x: { min: minX, max: maxX },
      y: { min: minY, max: maxY },
      speed: { min: 3, max: 15 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 2600, max: 5200 },
      frequency: 150,
      quantity: 1,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: moteTint,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH_AIR);

    this.add.particles(0, 0, 'iso_leaf', {
      x: { min: minX, max: maxX },
      y: { min: minY, max: maxY },
      speedX: { min: -18, max: 12 },
      speedY: { min: 8, max: 26 },
      lifespan: { min: 4200, max: 7600 },
      frequency: this.zone.ambience === 'town' || this.zone.ambience === 'grove' ? 260 : 420,
      quantity: 1,
      scale: { start: 0.7, end: 0.35 },
      alpha: { start: 0.8, end: 0 },
      rotate: { min: 0, max: 360 },
      tint: leafTint,
    }).setDepth(DEPTH_AIR);

    if (this.zone.ambience === 'river' || this.zone.ambience === 'sanctum') {
      this.add.particles(0, 0, 'iso_ember', {
        x: { min: minX, max: maxX },
        y: { min: minY + 160, max: maxY },
        speedY: { min: -22, max: -8 },
        lifespan: { min: 1400, max: 2800 },
        frequency: 320,
        quantity: 1,
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.85, end: 0 },
        tint: moteTint,
        blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH_AIR);
    }
  }

  private createLensGrid() {
    this.lensGrid = this.add.graphics().setDepth(DEPTH_LIGHT).setVisible(false);
    this.lensGrid.lineStyle(1, 0x8dffd8, 0.24);
    for (let x = 0; x <= MAP_W; x++) {
      const a = this.screenFor(x, 0);
      const b = this.screenFor(x, MAP_H);
      this.lensGrid.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = 0; y <= MAP_H; y++) {
      const a = this.screenFor(0, y);
      const b = this.screenFor(MAP_W, y);
      this.lensGrid.lineBetween(a.x, a.y, b.x, b.y);
    }
    this.zone.runes.forEach((r) => {
      const p = this.tileCenter(r.x, r.y);
      this.lensGrid.strokeEllipse(p.x, p.y, ISO_TILE_W * 1.8, ISO_TILE_H * 2.2);
    });
  }

  private freePos(x: number, y: number): GridPos {
    if (!this.isSolidTile(x, y)) return { x, y };
    for (let r = 1; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!this.isSolidTile(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x, y };
  }

  private isSolidTile(tx: number, ty: number): boolean {
    const ch = charAt(this.zone, tx, ty);
    if (ch === 'D') return !this.runesOpen;
    if (ch === 'g') {
      const mech = this.zone.mechanisms.find((m) => m.gate.x === tx && m.gate.y === ty);
      return !mech || !Save.data.mechanisms[mech.id];
    }
    return isSolidChar(ch);
  }

  private blocked(cx: number, cy: number, radius: number): boolean {
    const minX = Math.floor(cx - radius);
    const maxX = Math.floor(cx + radius);
    const minY = Math.floor(cy - radius);
    const maxY = Math.floor(cy + radius);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const nx = clamp(cx, tx, tx + 1);
        const ny = clamp(cy, ty, ty + 1);
        if ((cx - nx) ** 2 + (cy - ny) ** 2 < radius * radius) return true;
      }
    }
    return false;
  }

  private moveWithCollision(pos: { x: number; y: number }, dx: number, dy: number, radius: number) {
    if (dx !== 0 && !this.blocked(pos.x + dx, pos.y, radius)) pos.x += dx;
    if (dy !== 0 && !this.blocked(pos.x, pos.y + dy, radius)) pos.y += dy;
  }

  update(time: number, delta: number) {
    if (!this.active) return;
    const dt = Math.min(delta / 1000, 0.05);
    Save.data.playtime += dt;
    this.updateAmbient(time);
    this.updateWorld3D(time, delta);
    if (this.isBusy()) {
      if (this.player) {
        this.player.velX = 0;
        this.player.velY = 0;
      }
      return;
    }

    this.handleInput(time);
    this.updatePlayer(dt, time);
    if (time >= this.hitStopUntil) {
      this.updateEnemies(dt, time);
      this.updateBoss(dt, time);
    }
    this.updateProjectiles(dt, time);
    this.applyPlayerHits(time);
    this.refreshDepths(time);
    this.updatePrompt();

    if (time >= this.nextHud) {
      this.nextHud = time + 160;
      updateHud({
        zone: this.zoneId,
        hp: Save.data.hearts,
        maxHp: Save.data.maxHearts,
        stamina: this.stamina(),
        player: { x: Math.floor(this.player.x), y: Math.floor(this.player.y) },
        runesSolved: this.zone.runes.filter((r) => !!Save.data.solvedRunes[r.id]).length,
        runesTotal: this.zone.runes.length,
        mainQuest: this.mainQuest(),
        boss: this.boss && !this.boss.dead ? {
          name: this.boss.def!.name,
          hp: this.boss.hp,
          maxHp: this.boss.maxHp,
          phase: this.boss.phaseIndex + 1,
          phases: this.boss.def!.phases.length,
        } : null,
      });
    }
    if (time >= this.nextSave) {
      this.nextSave = time + 5000;
      Save.data.position[this.zoneId] = { x: this.player.x, y: this.player.y };
      Save.save();
    }
  }

  private updateAmbient(time: number) {
    if (time < this.nextWaterFrame) return;
    this.nextWaterFrame = time + 230;
    for (const tile of this.waterTiles) {
      tile.phase = (tile.phase + 1) % 4;
      tile.img.setTexture(`iso_water${tile.phase}`);
    }
  }

  private shakeCamera(duration: number, intensity: number) {
    if (!Save.data.settings.shake) return;
    this.cameras.main.shake(duration, intensity);
    this.world3D?.shake(clamp(intensity * 60, 0.05, 0.4));
  }

  private isBusy(): boolean {
    return this.uiModal || this.journalOpen || isDialogueOpen() || isOverlayOpen();
  }

  private stamina(): number {
    return this.player.stamina;
  }

  private setStamina(v: number) {
    this.player.stamina = clamp(v, 0, 100);
  }

  private handleInput(time: number) {
    if (Controls.consume('menu')) { openPanel('pause', this.panelContext()); return; }
    if (Controls.consume('inventory')) { openPanel('inventory', this.panelContext()); return; }
    if (Controls.consume('map')) { openPanel('map', this.panelContext()); return; }
    if (Controls.consume('quests')) { openPanel('quests', this.panelContext()); return; }
    if (Controls.consume('journal')) { void this.openJournal(); return; }
    if (Controls.consume('lens')) { this.toggleLens(); return; }
    if (Controls.consume('heal')) { this.usePotion(); return; }
    if (Controls.consume('dodge')) this.tryDodge(time);
    if (Controls.consume('guard')) this.tryGuard(time);
    if (Controls.consume('heavy')) this.tryAttack(time, true);
    if (Controls.consume('attack')) this.tryAttack(time, false);
    if (Controls.consume('interact')) void this.interact();
  }

  private async openJournal() {
    this.journalOpen = true;
    await openJournal();
    this.journalOpen = false;
  }

  private updatePlayer(dt: number, time: number) {
    const p = this.player;
    const screenDir = Controls.dir;
    const gridX = screenDir.x - screenDir.y;
    const gridY = screenDir.x + screenDir.y;
    const len = Math.hypot(gridX, gridY);
    let dirX = len > 0.001 ? gridX / len : 0;
    let dirY = len > 0.001 ? gridY / len : 0;
    let speed = ISO_SPEED;
    if (Save.data.items.polar) speed *= 1.16;

    const dodging = time < p.dodgeUntil;
    if (dodging) {
      dirX = p.dodgeX;
      dirY = p.dodgeY;
      speed *= Save.data.equipped.relic === 'brujula_giros' ? 2.5 : 2.15;
      if (Save.data.equipped.relic === 'brujula_giros') this.setStamina(this.stamina() + 18 * dt);
      p.velX = dirX * speed;
      p.velY = dirY * speed;
    } else {
      const accel = 1 - Math.exp(-dt * (dirX || dirY ? 15 : 19));
      p.velX += (dirX * speed - p.velX) * accel;
      p.velY += (dirY * speed - p.velY) * accel;
      if (Math.hypot(p.velX, p.velY) < 0.015) {
        p.velX = 0;
        p.velY = 0;
      }
    }
    const beforeX = p.x;
    const beforeY = p.y;
    this.moveWithCollision(p, p.velX * dt, p.velY * dt, ISO_PLAYER_R);
    if (Math.abs(p.x - beforeX) < 1e-6) p.velX = 0;
    if (Math.abs(p.y - beforeY) < 1e-6) p.velY = 0;
    if (dirX !== 0 || dirY !== 0) {
      p.facingX = dirX;
      p.facingY = dirY;
    }

    if (time >= p.dodgeUntil && time >= p.attackStart + p.attackDuration && time >= p.guardUntil) {
      this.setStamina(this.stamina() + 22 * dt);
    }
    if (time < p.guardUntil) this.setStamina(this.stamina() - 9 * dt);

    if (time < p.hurtUntil) p.pose = 'hurt';
    else if (time < p.dodgeUntil) p.pose = 'dodge';
    else if (time < p.guardUntil) p.pose = 'guard';
    else if (time < p.attackStart + p.attackDuration) p.pose = 'attack';
    else if (dirX !== 0 || dirY !== 0) p.pose = 'walk';
    else p.pose = 'idle';

    const facing = Math.abs(p.facingX) >= Math.abs(p.facingY)
      ? 'side'
      : p.facingY < 0 ? 'back' : 'front';
    let frame = 0;
    if (p.pose === 'walk') frame = Math.floor(time / (Math.hypot(p.velX, p.velY) > ISO_SPEED * 1.3 ? 84 : 112)) % 4;
    else if (p.pose === 'attack') {
      const t = clamp((time - p.attackStart) / Math.max(1, p.attackDuration), 0, 0.99);
      frame = Math.min(2, Math.floor(t * 3));
    } else if (p.pose === 'idle') frame = Math.floor(time / 520) % 2;

    const s = this.screenFor(p.x, p.y);
    p.sprite.setPosition(s.x, s.y);
    p.shadow.setPosition(s.x, s.y + 3);
    p.sprite.setTexture(heroKey(facing, p.pose, frame));
    p.sprite.setFlipX(facing === 'side' && p.facingX < 0);
    p.sprite.setTint(time < p.hurtUntil && Math.floor(time / 70) % 2 === 0 ? 0xffaaaa : 0xffffff);
    p.sprite.setDepth(isoDepth(p.x, p.y, DEPTH_ENTITY));
    p.shadow.setDepth(isoDepth(p.x, p.y, DEPTH_DECAL));
  }

  private tryDodge(time: number) {
    const p = this.player;
    if (time < p.dodgeReady) return;
    const cost = Save.data.equipped.relic === 'brujula_giros' ? 12 : 22;
    if (this.stamina() < cost) { showToast('Sin resistencia para esquivar'); return; }
    this.setStamina(this.stamina() - cost);
    let x = p.facingX;
    let y = p.facingY;
    const d = Controls.dir;
    if (Math.hypot(d.x, d.y) > 0.1) {
      const gx = d.x - d.y;
      const gy = d.x + d.y;
      const l = Math.hypot(gx, gy) || 1;
      x = gx / l;
      y = gy / l;
    }
    p.dodgeX = x;
    p.dodgeY = y;
    p.dodgeUntil = time + (Save.data.equipped.relic === 'brujula_giros' ? 340 : 250);
    p.dodgeReady = time + 620;
    p.pose = 'dodge';
    Audio.play('dodge');
    this.burst(p.x, p.y, 0x9dffd6, 8);
  }

  private tryGuard(time: number) {
    const p = this.player;
    if (this.stamina() < 8) { showToast('Sin resistencia para defender'); return; }
    this.setStamina(this.stamina() - 8);
    p.guardUntil = time + 720;
    p.pose = 'guard';
    Audio.play('block');
  }

  private tryAttack(time: number, heavy: boolean) {
    const p = this.player;
    if (time < p.attackReady || time < p.dodgeUntil) return;
    const cost = heavy ? 24 : 8;
    if (this.stamina() < cost) { showToast('Sin resistencia para atacar'); return; }
    this.setStamina(this.stamina() - cost);
    p.attackHeavy = heavy;
    p.attackStart = time;
    p.attackDuration = heavy ? 500 : 260;
    p.attackReady = time + (heavy ? 690 : 320);
    p.attackHit.clear();
    p.combo = heavy || time > p.comboWindow ? 0 : (p.combo + 1) % 3;
    p.comboWindow = time + 520;
    p.pose = 'attack';
    Audio.play(heavy ? 'heavy' : 'slash');
    this.spawnSlash(heavy);
  }

  private spawnSlash(heavy: boolean) {
    const p = this.player;
    const direction = gridDirToScreen(p.facingX, p.facingY);
    const angle = Math.atan2(direction.y, direction.x);
    const sx = p.x + p.facingX * 0.55;
    const sy = p.y + p.facingY * 0.55;
    const pos = this.screenFor(sx, sy);
    const color = Save.data.equipped.weapon === 'fubini' ? 0x8dffd8 : 0xffffff;
    this.world3D?.slash(p.x, p.y, heavy, p.facingX, p.facingY, color);
    const arc = this.add.image(pos.x, pos.y - 12, 'slash_arc')
      .setOrigin(0.5)
      .setRotation(angle)
      .setScale(heavy ? 1.5 : 1)
      .setTint(color)
      .setDepth(DEPTH_LIGHT);
    this.tweens.add({
      targets: arc,
      alpha: 0,
      scale: heavy ? 2.3 : 1.5,
      duration: heavy ? 340 : 220,
      onComplete: () => arc.destroy(),
    });
    if (heavy) {
      const ring = this.add.image(pos.x, pos.y, 'magic_ring')
        .setScale(0.4)
        .setDepth(DEPTH_LIGHT)
        .setTint(0x8dffd8);
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    }
  }

  private applyPlayerHits(time: number) {
    const p = this.player;
    if (time < p.attackStart || time > p.attackStart + p.attackDuration) return;
    const t = (time - p.attackStart) / p.attackDuration;
    if (t < 0.16 || t > 0.66) return;
    const weaponBonus = Save.data.equipped.weapon === 'fubini' ? 0.45 : 0;
    const reach = (p.attackHeavy ? 1.55 : 1.05) + weaponBonus;
    const baseDamage = p.attackHeavy ? 26 : 10 + p.combo * 4 + (Save.data.equipped.weapon === 'fubini' ? 5 : 0);

    this.enemies.forEach((e) => {
      if (e.dead || p.attackHit.has(e.id)) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 0.001) return;
      const facing = dot(p.facingX, p.facingY, dx / d, dy / d);
      if (facing < (p.attackHeavy ? -0.2 : 0.05)) return;
      p.attackHit.add(e.id);
      this.damageEnemy(e, baseDamage, dx / d, dy / d, p.attackHeavy ? 0.55 : 0.28);
    });

    const boss = this.boss;
    if (boss && !boss.dead && !p.attackHit.has('boss')) {
      const dx = boss.x - p.x;
      const dy = boss.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= reach + 0.65 && d > 0.001 && dot(p.facingX, p.facingY, dx / d, dy / d) > -0.2) {
        p.attackHit.add('boss');
        const vulnerable = boss.state === 'stunned' && time < boss.stunnedUntil;
        this.damageBoss(baseDamage * (vulnerable ? 1 : 0.18), dx / d, dy / d);
        if (!vulnerable) showToast('El escudo mate resiste. Descifra la fase para abrirlo.');
      }
    }
  }

  private damageEnemy(enemy: Enemy, amount: number, kx: number, ky: number, knock: number) {
    enemy.hp -= amount;
    enemy.flashUntil = this.time.now + 110;
    enemy.sprite.setTint(0xffffff);
    this.moveWithCollision(enemy, kx * knock, ky * knock, 0.28);
    this.burst(enemy.x, enemy.y, 0xffd166, 8);
    this.shakeCamera(80, 0.0015);
    this.hitStopUntil = this.time.now + 34;
    Audio.play('hit');
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Enemy) {
    enemy.dead = true;
    enemy.sprite.destroy();
    enemy.shadow.destroy();
    Save.data.stats.kills++;
    Audio.play('enemyDie');
    this.burst(enemy.x, enemy.y, 0x8dffd8, 14);
    if (Math.random() < 0.45) this.spawnLoot(enemy.x, enemy.y);
  }

  private spawnLoot(x: number, y: number) {
    const gold = Phaser.Math.Between(2, 6);
    Save.data.stats.gold += gold;
    const p = this.screenFor(x, y);
    const orb = this.add.image(p.x, p.y - 12, 'iso_dot')
      .setTint(0xffd166)
      .setScale(1.5)
      .setDepth(DEPTH_LIGHT);
    this.tweens.add({
      targets: orb,
      y: p.y - 42,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => orb.destroy(),
    });
  }

  private updateEnemies(dt: number, time: number) {
    const p = this.player;
    this.enemies.forEach((e) => {
      if (e.dead) return;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 0.001;
      e.facingX = dx / d;
      e.facingY = dy / d;

      if (e.state === 'idle') {
        if (d < 5.8) {
          e.state = 'chase';
        } else {
          const t = time / 1000 + e.x * 3;
          const tx = e.home.x + Math.sin(t) * 0.55;
          const ty = e.home.y + Math.cos(t * 0.7) * 0.45;
          this.moveWithCollision(e, (tx - e.x) * dt, (ty - e.y) * dt, 0.25);
        }
      } else if (e.state === 'chase') {
        if (d > 0.95) {
          const speed = e.speed * dt;
          this.moveWithCollision(e, e.facingX * speed, e.facingY * speed, 0.26);
        }
        const range = e.kind === 'arquero' ? 4.2 : 1.35;
        if (d < range) {
          e.state = 'windup';
          e.stateUntil = time + (e.kind === 'arquero' ? 720 : 520);
          this.telegraph(e.x, e.y, e.kind === 'arquero' ? 1.5 : 1.1);
        }
        if (d > 8) e.state = 'idle';
      } else if (e.state === 'windup' && time >= e.stateUntil) {
        this.enemyAttack(e);
        e.state = 'recover';
        e.stateUntil = time + 620;
      } else if (e.state === 'recover' && time >= e.stateUntil) {
        e.state = 'chase';
      }

      const frame = Math.floor(time / 250) % 2;
      const pos = this.screenFor(e.x, e.y);
      e.sprite.setPosition(pos.x, pos.y);
      e.shadow.setPosition(pos.x, pos.y + 2);
      e.sprite.setTexture(enemyKey(e.kind, frame));
      if (time >= e.flashUntil) e.sprite.clearTint();
      e.sprite.setDepth(isoDepth(e.x, e.y, DEPTH_ENTITY));
      e.shadow.setDepth(isoDepth(e.x, e.y, DEPTH_DECAL));
    });
  }

  private enemyAttack(e: Enemy) {
    const d = dist(e.x, e.y, this.player.x, this.player.y);
    if (e.kind === 'arquero') {
      this.spawnProjectile(e.x, e.y, this.player.x, this.player.y, 4.6, 1, false, 0xff9f1c);
    } else if (d < 1.6) {
      this.damagePlayer(e.kind === 'centinela' ? 2 : 1, e.facingX, e.facingY);
    }
  }

  private telegraph(x: number, y: number, radius: number, color = 0xff6b6b) {
    this.world3D?.telegraph(x, y, radius, color);
    const p = this.screenFor(x, y);
    const ring = this.add.image(p.x, p.y, 'magic_ring')
      .setTint(color)
      .setScale(radius * 0.7)
      .setAlpha(0.9)
      .setDepth(DEPTH_LIGHT);
    this.tweens.add({ targets: ring, scale: radius * 1.35, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
  }

  private updateBoss(dt: number, time: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    const phase = b.def!.phases[b.phaseIndex];
    const dx = this.player.x - b.x;
    const dy = this.player.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;

    if (b.state === 'stunned') {
      if (time >= b.stunnedUntil) {
        b.state = 'recover';
        b.stateUntil = time + 700;
        b.nextAction = time + 1600;
        b.sprite.clearTint();
      }
    } else if (b.state === 'idle') {
      if (d > 3.2 && b.x > 18.5) {
        this.moveWithCollision(b, (dx / d) * 1.05 * dt, (dy / d) * 1.05 * dt, 0.52);
      }
      if (time >= b.nextAction) {
        b.state = 'windup';
        b.stateUntil = time + (phase.pattern === 'collapse' ? 900 : 700);
        this.telegraph(b.x, b.y, 3.2, 0xff70d0);
      }
    } else if (b.state === 'windup' && time >= b.stateUntil) {
      this.bossAttack(phase.pattern);
      b.state = 'recover';
      b.stateUntil = time + 850;
      b.nextAction = time + Phaser.Math.Between(1900, 2700);
    } else if (b.state === 'recover' && time >= b.stateUntil) {
      b.state = 'idle';
    }

    const frame = Math.floor(time / 260) % 2;
    const p = this.screenFor(b.x, b.y);
    b.sprite.setPosition(p.x, p.y);
    b.shadow.setPosition(p.x, p.y + 8);
    b.sprite.setTexture(bossKey(b.def!.kind, frame));
    if (b.state === 'stunned') b.sprite.setTint(0x8dffd8);
    else b.sprite.clearTint();
    b.sprite.setDepth(isoDepth(b.x, b.y, DEPTH_ENTITY));
    b.shadow.setDepth(isoDepth(b.x, b.y, DEPTH_DECAL));
  }

  private bossAttack(pattern: 'cleave' | 'burst' | 'dash' | 'summon' | 'collapse') {
    const b = this.boss;
    if (!b) return;
    const dx = this.player.x - b.x;
    const dy = this.player.y - b.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (pattern === 'cleave') {
      if (d < 2.6 && dot(dx / d, dy / d, dx / d, dy / d) > -1) this.damagePlayer(2, dx / d, dy / d);
      this.burst(b.x + dx * 0.4, b.y + dy * 0.4, 0xff70d0, 16);
    } else if (pattern === 'burst') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + this.time.now / 1000;
        this.spawnProjectile(b.x, b.y, b.x + Math.cos(a) * 3, b.y + Math.sin(a) * 3, 3.2, 1, false, 0xff70d0);
      }
    } else if (pattern === 'dash') {
      const steps = 9;
      for (let i = 0; i < steps; i++) {
        const nx = b.x + (dx / d) * (i + 1) * 0.25;
        const ny = b.y + (dy / d) * (i + 1) * 0.25;
        if (!this.blocked(nx, ny, 0.5)) { b.x = nx; b.y = ny; }
      }
      if (dist(b.x, b.y, this.player.x, this.player.y) < 1.5) this.damagePlayer(2, dx / d, dy / d);
      Audio.play('heavy');
    } else if (pattern === 'summon') {
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (alive < 4) {
        for (let i = 0; i < 2; i++) {
          const a = i === 0 ? 0.8 : -0.8;
          const sx = clamp(b.x + Math.cos(a) * 2.5, 18.5, MAP_W - 1.5);
          const sy = clamp(b.y + Math.sin(a) * 2.5, 1.5, MAP_H - 1.5);
          if (!this.blocked(sx, sy, 0.3)) this.addSummon(sx, sy);
        }
      }
      this.burst(b.x, b.y, 0xb388ff, 18);
    } else {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const sx = this.player.x + Math.cos(a) * 5;
        const sy = this.player.y + Math.sin(a) * 5;
        if (sx > 1 && sy > 1 && sx < MAP_W - 1 && sy < MAP_H - 1) {
          this.spawnProjectile(sx, sy, this.player.x, this.player.y, 3.6, 1, true, 0x8dffd8);
        }
      }
      this.shakeCamera(260, 0.004);
    }
  }

  private addSummon(x: number, y: number) {
    const p = this.screenFor(x, y);
    const shadow = this.add.image(p.x, p.y + 3, 'iso_shadow').setOrigin(0.5).setScale(0.65).setAlpha(0.6).setDepth(isoDepth(x, y, DEPTH_DECAL));
    const sprite = this.add.image(p.x, p.y, enemyKey('sombra', 0)).setOrigin(0.5, 0.92).setScale(0.85).setDepth(isoDepth(x, y, DEPTH_ENTITY));
    this.enemies.push({
      id: `summon_${this.time.now}_${Math.random()}`,
      kind: 'sombra', x, y, hp: 20, maxHp: 20, speed: 1.9,
      sprite, shadow, state: 'chase', stateUntil: 0,
      home: { x, y }, facingX: 0, facingY: 1,
      flashUntil: 0, dead: false,
    });
  }

  private damageBoss(amount: number, kx: number, ky: number) {
    const b = this.boss;
    if (!b) return;
    b.hp -= amount;
    b.flashUntil = this.time.now + 120;
    this.moveWithCollision(b, kx * 0.12, ky * 0.12, 0.52);
    this.burst(b.x, b.y, 0xff70d0, 12);
    this.shakeCamera(140, 0.003);
    Audio.play('bossHit');
    if (b.hp <= 0) void this.advanceBossPhase();
  }

  private async advanceBossPhase() {
    const b = this.boss;
    if (!b || b.dead) return;
    b.dead = true;
    b.state = 'dead';
    this.removeBossInteractable();
    this.burst(b.x, b.y, 0xffd166, 30);
    b.sprite.destroy();
    b.shadow.destroy();

    if (b.phaseIndex < b.def!.phases.length - 1) {
      b.phaseIndex++;
      Save.data.bossPhase[this.zoneId] = b.phaseIndex;
      Save.save();
      Audio.play('bossPhase');
      await showLines([b.def!.phaseLines[Math.min(b.phaseIndex - 1, b.def!.phaseLines.length - 1)]], b.def!.name, 'sage');
      b.dead = false;
      b.hp = 62 + b.phaseIndex * 26;
      b.maxHp = b.hp;
      b.state = 'idle';
      b.nextAction = this.time.now + 2200;
      const p = this.tileCenter(b.def!.x, b.def!.y);
      b.x = b.def!.x + 0.5;
      b.y = b.def!.y + 0.5;
      b.sprite = this.add.image(p.x, p.y, bossKey(b.def!.kind, 0)).setOrigin(0.5, 0.94).setScale(1.25).setDepth(isoDepth(b.x, b.y, DEPTH_ENTITY));
      b.shadow = this.add.image(p.x, p.y + 8, 'iso_shadow').setOrigin(0.5).setScale(2).setAlpha(0.7).setDepth(isoDepth(b.x, b.y, DEPTH_DECAL));
      this.interactables.push({
        kind: 'boss', x: b.def!.x, y: b.def!.y, sprite: b.sprite, data: null,
        label: () => `Desafiar a ${b.def!.name} · ${b.def!.phases![b.phaseIndex].title}`,
      });
      return;
    }

    Save.data.completed[this.zoneId] = true;
    Save.data.bossPhase[this.zoneId] = b.def!.phases.length;
    this.advanceMainQuest();
    Audio.play('victory');
    if (this.zone.reward && !Save.data.items[this.zone.reward.item]) {
      Save.addItem(this.zone.reward.item);
      await showLines(this.zone.reward.lines, 'Recompensa', 'sage');
    }
    await showLines(b.def!.defeatLines, b.def!.name, 'sage');
    if (this.zone.final) {
      Save.data.victory = true;
      Save.data.quests.llamada_cartografo.done = true;
      Save.save();
      showToast('Cartesia vuelve a caber en el mapa. Puedes seguir explorando.');
    }
    Save.save();
  }

  private removeBossInteractable() {
    this.interactables = this.interactables.filter((item) => item.kind !== 'boss');
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number, speed: number, damage: number, home: boolean, tint: number) {
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const p = this.screenFor(x, y);
    const sprite = this.add.image(p.x, p.y - 10, 'iso_dot')
      .setTint(tint)
      .setScale(1.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH_LIGHT);
    this.projectiles.push({
      sprite, x, y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      life: 2.6,
      damage,
      home,
      color: tint,
    });
  }

  private updateProjectiles(dt: number, time: number) {
    this.projectiles = this.projectiles.filter((pr) => {
      if (pr.home) {
        const dx = this.player.x - pr.x;
        const dy = this.player.y - pr.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(pr.vx, pr.vy);
        pr.vx = (dx / len) * speed;
        pr.vy = (dy / len) * speed;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      const p = this.screenFor(pr.x, pr.y);
      pr.sprite.setPosition(p.x, p.y - 10);
      pr.sprite.setScale(1.7 + Math.sin(time / 60) * 0.25);
      if (dist(pr.x, pr.y, this.player.x, this.player.y) < 0.42) {
        this.damagePlayer(pr.damage, pr.vx, pr.vy);
        pr.sprite.destroy();
        return false;
      }
      if (pr.life <= 0 || this.blocked(pr.x, pr.y, 0.05)) {
        this.burst(pr.x, pr.y, 0xff9f1c, 4);
        pr.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private damagePlayer(amount: number, kx: number, ky: number) {
    const now = this.time.now;
    const p = this.player;
    if (now < p.hurtUntil || now < p.dodgeUntil) return;
    let dmg = amount;
    if (Save.data.equipped.relic === 'corazon_roto') dmg *= 0.75;
    const guarding = now < p.guardUntil;
    if (guarding) {
      dmg *= 0.25;
      this.setStamina(this.stamina() - 12);
      Audio.play('block');
    } else {
      Audio.play('hurt');
    }
    const loss = Math.max(1, Math.ceil(dmg));
    Save.data.hearts = Math.max(0, Save.data.hearts - loss);
    p.hurtUntil = now + 760;
    p.pose = 'hurt';
    const len = Math.hypot(kx, ky) || 1;
    this.moveWithCollision(p, (kx / len) * 0.4, (ky / len) * 0.4, ISO_PLAYER_R);
    this.shakeCamera(120, 0.0035);
    if (Save.data.hearts <= 0) this.die();
    Save.save();
  }

  private die() {
    this.active = false;
    Save.data.stats.deaths++;
    Save.save();
    Audio.play('hurt');
    const shrine = this.zone.shrines[0] ?? this.zone.spawn;
    openPanel('death', {
      zone: this.zoneId,
      player: { x: Math.floor(this.player.x), y: Math.floor(this.player.y) },
      onRespawn: () => {
        Save.data.hearts = Save.data.maxHearts;
        Save.save();
        this.scene.restart({ zone: this.zoneId, spawn: shrine });
      },
    });
  }

  private usePotion() {
    if (!Save.data.items.pocion) { showToast('No tienes elixires de area'); return; }
    if (Save.data.hearts >= Save.data.maxHearts) { showToast('Ya estás al máximo de vida'); return; }
    if (Save.consume('pocion')) {
      Save.heal(3);
      Audio.play('heal');
      this.burst(this.player.x, this.player.y, 0x8dffd8, 14);
      showToast('Elixir de area: +3 corazones');
    }
  }

  private toggleLens() {
    if (!Save.data.items.lente) { showToast('Necesitas el Lente del Jacobiano'); return; }
    this.lensOn = !this.lensOn;
    this.lensGrid.setVisible(this.lensOn);
    Audio.play('ui');
    showToast(this.lensOn ? 'Lente activo: la cuadrícula se revela' : 'Lente desactivado');
  }

  private nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = 1.55;
    for (const item of this.interactables) {
      const d = dist(this.player.x, this.player.y, item.x + 0.5, item.y + 0.5);
      if (d < bestD) { best = item; bestD = d; }
    }
    return best;
  }

  private updatePrompt() {
    const target = this.nearestInteractable();
    setPrompt(target ? `E · ${target.label()}` : '');
  }

  private async interact() {
    const target = this.nearestInteractable();
    if (!target) return;
    if (target.kind === 'rune') await this.onRune(target.data as RuneDef);
    else if (target.kind === 'portal') this.onPortal(target.data as ExitDef);
    else if (target.kind === 'chest') await this.onChest(target.data as ChestDef);
    else if (target.kind === 'lore') await this.onLore(target.data as LoreDef);
    else if (target.kind === 'shrine') this.onShrine();
    else if (target.kind === 'switch') await this.onSwitch(target.data as SwitchData);
    else if (target.kind === 'npc') await this.onNpc(target.data as NpcDef);
    else if (target.kind === 'boss') await this.onBoss();
  }

  private async ask(q: Question, heading: string) {
    this.uiModal = true;
    let result;
    try {
      result = await askQuestion(q, {
        heading,
        maxAttempts: 3,
        freeHint: !!Save.data.items.lente,
        allowClose: true,
      });
    } finally {
      this.uiModal = false;
    }
    if (result.correct) Save.data.stats.correct++;
    else if (!result.canceled) Save.data.stats.wrong++;
    Save.save();
    return result;
  }

  private async onRune(rune: RuneDef) {
    if (Save.data.solvedRunes[rune.id]) { showToast('Esta runa ya brilla'); return; }
    const q = generateQuestion(rune.topic, rune.difficulty);
    const title = rune.title || q.title;
    const res = await this.ask(q, `Runa · ${title}`);
    if (!res.correct) {
      if (!res.canceled) showToast('La runa sigue apagada. Lee la solución y vuelve a intentarlo.');
      return;
    }
    Save.data.solvedRunes[rune.id] = true;
    this.runeSprites.get(rune.id)?.setTexture('iso_rune_lit');
    Audio.play('rune');
    this.burst(rune.x + 0.5, rune.y + 0.5, 0x8dffd8, 18);
    if (this.zone.runes.every((r) => !!Save.data.solvedRunes[r.id])) {
      this.runesOpen = true;
      this.openGates('D');
      showToast('Todas las runas se encienden. El sello se abre.');
    } else {
      showToast('Runa descifrada. El sello aún necesita más luz.');
    }
    const archivo = Save.data.quests.archivo_prohibido;
    archivo.progress = Math.max(archivo.progress, Math.ceil(this.zone.runes.filter((r) => Save.data.solvedRunes[r.id]).length / 2));
    Save.save();
  }

  private openGates(type: 'D' | 'g') {
    this.gates.forEach((gate, key) => {
      if (gate.type !== type) return;
      gate.sprite.setTexture('iso_gate_open');
      const [x, y] = key.split(',').map(Number);
      this.burst(x + 0.5, y + 0.5, 0x8dffd8, 12);
    });
  }

  private onPortal(exit: ExitDef) {
    if (exit.requires && !Save.data.completed[exit.requires]) {
      showToast(exit.lockedMsg ?? 'Ese camino sigue cerrado.');
      Audio.play('hurt');
      return;
    }
    const target = ZONES[exit.to];
    const spawn = exit.spawn ?? target.spawn;
    Save.data.currentZone = exit.to;
    Save.data.position[exit.to] = spawn;
    Save.data.discovered[exit.to] = true;
    Save.save();
    Audio.play('portal');
    void sceneFadeOut(260);
    this.cameras.main.fadeOut(260, 8, 8, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ zone: exit.to, spawn });
    });
  }

  private async onChest(chest: ChestDef) {
    if (Save.data.openedChests[chest.id]) { showToast('El cofre está vacío'); return; }
    Save.data.openedChests[chest.id] = true;
    this.chestSprites.get(chest.id)?.setTexture('iso_chest_open').setAlpha(1);
    if (chest.item) Save.addItem(chest.item);
    if (chest.gold) Save.data.stats.gold += chest.gold;
    if (chest.hearts) Save.heal(chest.hearts);
    Save.save();
    Audio.play('chest');
    this.burst(chest.x + 0.5, chest.y + 0.5, 0xffd166, 20);
    const parts = [];
    if (chest.item) parts.push(chest.item);
    if (chest.gold) parts.push(`${chest.gold} monedas`);
    if (chest.hearts) parts.push(`+${chest.hearts} corazones`);
    showToast(`Cofre abierto: ${parts.join(' · ') || 'un recuerdo'}`);
    if (chest.item === 'reliquia_carton') {
      Save.setFlag('reliquia_reunida');
      await showLines([
        'La reliquia se enciende entre tus manos. No pesa como el oro: pesa como todos los nombres que el Singular olvidó.',
        'El Recaudador tenía razón. La memoria del reino vuelve a tener un lugar donde guardarse.',
      ], 'Reliquia del Cartógrafo', 'collector');
    }
  }

  private async onLore(lore: LoreDef) {
    Save.setFlag(`lore_${lore.id}`);
    const archivo = Save.data.quests.archivo_prohibido;
    archivo.progress = Math.max(archivo.progress, 1);
    Save.save();
    Audio.play('dialog');
    await showLines(lore.text, lore.title, 'sage');
  }

  private onShrine() {
    Save.data.hearts = Save.data.maxHearts;
    Save.data.position[this.zoneId] = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
    Save.save();
    Audio.play('heal');
    this.burst(this.player.x, this.player.y, 0x8dffd8, 16);
    showToast('Santuario: vida restaurada y punto de guardado actualizado');
  }

  private async onSwitch(data: SwitchData) {
    const mech = data.mech;
    if (Save.data.mechanisms[mech.id]) { showToast('Los pilares ya están en calma'); return; }
    const progress = this.mechProgress[mech.id] ?? [];
    if (progress.length >= mech.order.length) return;
    const expected = mech.order[progress.length];
    if (data.id !== expected) {
      this.mechProgress[mech.id] = [];
      mech.switches.forEach((s) => this.switchSprites.get(s.id)?.setTexture('iso_switch_off'));
      Audio.play('hurt');
      await showLines([mech.wrongText], 'Ecos del templo', 'sage');
      return;
    }
    progress.push(data.id);
    this.mechProgress[mech.id] = progress;
    this.switchSprites.get(data.id)?.setTexture('iso_switch_on');
    Audio.play('switch');
    if (progress.length === mech.order.length) {
      Save.data.mechanisms[mech.id] = true;
      Save.save();
      this.openGates('g');
      showToast(mech.solvedText);
    } else {
      showToast(`Pilar ${progress.length}/${mech.order.length} encendido`);
    }
  }

  private async onNpc(npc: NpcDef) {
    const masters: NpcId[] = ['fubini', 'guardiana', 'cartografa'];
    if (masters.includes(npc.id) && !Save.data.flags[`maestro_${npc.id}`]) {
      Save.data.flags[`maestro_${npc.id}`] = true;
      Save.data.counters['maestros_oidos'] = (Save.data.counters['maestros_oidos'] ?? 0) + 1;
      Save.save();
    }
    Audio.play('dialog');
    await showStory(storyFor(npc.id, Save.data));
  }

  private async onBoss() {
    const b = this.boss;
    if (!b || b.dead) return;
    const phase = b.def!.phases[b.phaseIndex];
    if (b.state === 'stunned' && this.time.now < b.stunnedUntil) {
      showToast('El guardián está aturdido: ¡ataca ahora!');
      return;
    }
    if (!Save.data.flags[`boss_intro_${this.zoneId}`]) {
      Save.setFlag(`boss_intro_${this.zoneId}`);
      this.world3D?.cinematic(b.x, b.y, 1800);
      await showLines(b.def!.introLines, b.def!.name, 'sage');
    }
    const q = generateQuestion(phase.topic, phase.difficulty);
    const res = await this.ask(q, `${b.def!.name} · ${phase.title}`);
    if (res.correct) {
      b.state = 'stunned';
      b.stunnedUntil = this.time.now + 6500;
      b.sprite.setTint(0x8dffd8);
      Audio.play('bossPhase');
      this.burst(b.x, b.y, 0x8dffd8, 24);
      showToast('Escudo roto: seis segundos para atacar');
    } else if (!res.canceled) {
      this.damagePlayer(1 + b.phaseIndex * 0.35, this.player.x - b.x, this.player.y - b.y);
      showToast('El guardián se rehace. Estudia la solución y vuelve a desafiarlo.');
    }
  }

  private burst(x: number, y: number, tint: number, count: number) {
    this.world3D?.burst(x, y, tint, count);
    const p = this.screenFor(x, y);
    const emitter = this.add.particles(p.x, p.y, 'iso_dot', {
      speed: { min: 45, max: 160 },
      lifespan: { min: 300, max: 640 },
      quantity: count,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(DEPTH_LIGHT);
    emitter.explode(count);
    this.time.delayedCall(720, () => emitter.destroy());
  }

  private refreshDepths(time: number) {
    this.interactables.forEach((item) => {
      const bob = item.kind === 'portal' ? Math.sin(time / 400 + item.x) * 2 : 0;
      item.sprite.setDepth(isoDepth(item.x + 0.5, item.y + 0.5, DEPTH_PROP + bob));
    });
  }

  private mainQuest(): QuestId {
    if (Save.data.victory) return 'llamada_cartografo';
    if (!Save.data.completed.llanura) return 'llamada_cartografo';
    if (!Save.data.completed.valle) return 'llamada_cartografo';
    if (!Save.data.completed.ciudad) return 'llamada_cartografo';
    if (Save.data.flags['pista_reliquias'] && !Save.data.flags['reliquia_reunida']) return 'fragmentos_reliquia';
    return 'llamada_cartografo';
  }

  private advanceMainQuest() {
    const q = Save.data.quests.llamada_cartografo;
    const index = ZONE_ORDER.indexOf(this.zoneId);
    q.progress = Math.max(q.progress, Math.min(index + 2, 5));
    Save.save();
  }

  private panelContext() {
    return {
      zone: this.zoneId,
      player: { x: Math.floor(this.player.x), y: Math.floor(this.player.y) },
      onRespawn: () => {
        const shrine = this.zone.shrines[0] ?? this.zone.spawn;
        Save.data.hearts = Save.data.maxHearts;
        Save.save();
        this.scene.restart({ zone: this.zoneId, spawn: shrine });
      },
    };
  }

  private async playIntro() {
    if (Save.data.seenIntro[this.zoneId]) return;
    Save.data.seenIntro[this.zoneId] = true;
    Save.save();
    const portrait = this.zoneId === 'cartesia' ? 'old'
      : this.zoneId === 'templo' ? 'sage'
      : this.zoneId === 'ciudad' ? 'cartographer'
      : 'guard';
    await showLines(this.zone.intro, this.zone.name, portrait);
  }

  private readonly handleQuitMenuEvent = () => {
    Save.data.position[this.zoneId] = { x: this.player.x, y: this.player.y };
    Save.save();
    this.active = false;
    void sceneFadeOut(240);
    this.cameras.main.fadeOut(240, 8, 8, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Menu');
      void sceneFadeIn(320);
    });
  };

  private readonly handleQualityEvent = () => {
    if (!this.active) return;
    const spawn = { x: this.player.x, y: this.player.y };
    Save.data.position[this.zoneId] = spawn;
    Save.save();
    this.active = false;
    void sceneFadeOut(220);
    this.scene.restart({ zone: this.zoneId, spawn });
  };

  private readonly handleLensEvent = () => {
    if (this.active && !this.isBusy()) this.toggleLens();
  };

  private readonly handleResize = () => {
    if (!this.active || !this.player) return;
    this.configureCamera();
    this.stage?.resize(this.game.canvas);
  };

  private cleanup() {
    this.active = false;
    window.removeEventListener('game-quit-menu', this.handleQuitMenuEvent);
    window.removeEventListener('game-lens', this.handleLensEvent);
    window.removeEventListener('game-quality-change', this.handleQualityEvent);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.disposeWorld3D();
    this.game.canvas.style.visibility = '';
    document.body.classList.remove('playing');
    hideHud();
    setPrompt('');
  }
}
