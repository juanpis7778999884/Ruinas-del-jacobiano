import * as THREE from 'three';
import { MAP_H, MAP_W } from '../config';
import { charAt } from '../data/zones';
import type { ZoneDef } from '../data/zones';
import type { EnemyKind, ZoneId } from '../data/types';
import type { MaterialSet } from './materials';
import type { CharacterRig } from './rig';
import { animateRig, createBossRig, createEnemyRig, createHeroRig, createNpcRig } from './rig';
import type { Stage } from './stage';
import { Scenery } from './scenery';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import type { SceneryTile } from './scenery';
import type { BossSnapshot, EnemySnapshot, ProjectileSnapshot, WorldSnapshot } from './types';

interface ParticleEffect {
  points: THREE.Points;
  velocity: Float32Array;
  life: number;
  maxLife: number;
  gravity: number;
}

interface RingEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  grow: number;
}

interface EntityVisual {
  rig: CharacterRig;
  deadAt: number;
}

interface PortalVisual {
  root: THREE.Group;
  rings: THREE.Object3D[];
  light: THREE.PointLight | null;
  phase: number;
}

const key = (x: number, y: number) => `${x},${y}`;

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export class World3D {
  private stage: Stage;
  private zone: ZoneDef;
  private zoneId: ZoneId;
  private mats: MaterialSet;
  private root = new THREE.Group();
  private characterLayer = new THREE.Group();
  private effectLayer = new THREE.Group();
  private scenery: Scenery;
  private hero: CharacterRig;
  private npcs = new Map<string, CharacterRig>();
  private enemies = new Map<string, EntityVisual>();
  private boss: EntityVisual | null = null;
  private bossKind = '';
  private projectiles: THREE.Mesh[] = [];
  private runes = new Map<string, { root: THREE.Group; core: THREE.Mesh; light: THREE.PointLight | null }>();
  private runeIds = new Map<string, string>();
  private chests = new Map<string, { root: THREE.Group; lid: THREE.Group }>();
  private switches = new Map<string, { root: THREE.Group; core: THREE.Mesh }>();
  private gates = new Map<string, THREE.Group>();
  private flames: { mesh: THREE.Mesh; core: THREE.Mesh; light: THREE.PointLight | null; phase: number }[] = [];
  private portals: PortalVisual[] = [];
  private lensGrid: THREE.GridHelper;
  private ambient: THREE.Points | null = null;
  private ambientVelocity: Float32Array = new Float32Array(0);
  private effects: ParticleEffect[] = [];
  private rings: RingEffect[] = [];
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cinematicTarget: { x: number; z: number; until: number } | null = null;
  private cameraShake = 0;
  private nextFire = 0;
  private rnd: () => number;
  public readonly cameraController: ThirdPersonCamera;
  private colliders: THREE.Box3[] = [];
  private heroVisualYaw = 0;

  constructor(stage: Stage, zone: ZoneDef, zoneId: ZoneId, mats: MaterialSet) {
    this.stage = stage;
    this.zone = zone;
    this.zoneId = zoneId;
    this.mats = mats;
    this.rnd = seeded(hash(zoneId));
    stage.scene.add(this.root);
    this.root.add(this.characterLayer);
    this.root.add(this.effectLayer);
    this.scenery = new Scenery(this.root, mats, {
      zoneId,
      ambience: zone.ambience,
      tileset: zone.tileset,
      quality: stage.quality,
      seed: hash(zoneId) ^ 0x9e3779b9,
    });
    this.hero = createHeroRig(mats);
    this.characterLayer.add(this.hero.root);
    this.lensGrid = new THREE.GridHelper(MAP_W, MAP_W, 0x8dffd8, 0x3b8d78);
    this.lensGrid.position.set(MAP_W / 2, 0.16, MAP_H / 2);
    this.lensGrid.material.transparent = true;
    this.lensGrid.material.opacity = 0.35;
    this.lensGrid.visible = false;
    this.root.add(this.lensGrid);
    stage.setAtmosphere(zone.ambience);
    this.build();
    this.cameraController = new ThirdPersonCamera(this.stage);
    this.heroVisualYaw = this.hero.root.rotation.y;
    this.collectColliders();
    this.cameraController.setColliders(this.colliders);
  }

  private build() {
    const tiles: Record<string, SceneryTile[]> = {};
    const push = (bucket: string, tile: SceneryTile) => {
      (tiles[bucket] ??= []).push(tile);
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = charAt(this.zone, x, y);
        const tile: SceneryTile = { x, y, ch };
        if (ch === '~') push('water', tile);
        else if (ch === '=' && this.isNearWater(x, y)) push('bridge', tile);
        else if (ch === ',' || ch === '*') push('moss', tile);
        else if (ch === '=') push('path', tile);
        else push('ground', tile);
        if (ch === '.' || ch === ',' || ch === '*') push('flora', tile);
        if (ch === '#' || ch === 'c' || ch === 'o' || ch === 'T' || ch === '*' || ch === ',') push(`prop_${ch}`, tile);
        if (ch === 'B' || ch === 'R' || ch === 'P' || ch === 'C' || ch === 'L' || ch === 'S' || ch === 'X' || ch === 'g' || ch === 'D' || ch === '^' || ch === 'v') push(`obj_${ch}`, tile);
      }
    }
    this.scenery.buildAtmosphere();
    this.scenery.buildGround(tiles.ground ?? [], tiles.moss ?? [], tiles.path ?? []);
    this.scenery.buildWater(tiles.water ?? []);
    this.scenery.buildBridges(tiles.bridge ?? []);
    this.scenery.buildWalls(tiles['prop_#'] ?? []);
    this.scenery.buildColumns(tiles.prop_c ?? []);
    this.scenery.buildRocks(tiles.prop_o ?? []);
    this.scenery.buildTrees(tiles.prop_T ?? [], tiles['prop_,'] ?? []);
    this.scenery.buildUndergrowth(tiles.flora ?? [], tiles.prop_T ?? [], tiles['prop_,'] ?? []);
    this.scenery.buildFlowers(tiles['prop_*'] ?? []);
    this.buildProps(tiles);
    this.buildZoneSignature();
    this.buildNpcs();
    this.buildAmbientParticles();
  }

  private isNearWater(x: number, y: number) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (charAt(this.zone, x + dx, y + dy) === '~') return true;
      }
    }
    return false;
  }

  private buildProps(tiles: Record<string, SceneryTile[]>) {
    (tiles.obj_B ?? []).forEach((t) => this.buildBrazier(t.x, t.y));
    (tiles.obj_R ?? []).forEach((t) => this.buildRune(t.x, t.y));
    (tiles.obj_P ?? []).forEach((t) => this.buildPortal(t.x, t.y));
    (tiles.obj_C ?? []).forEach((t) => this.buildChest(t.x, t.y));
    (tiles.obj_L ?? []).forEach((t) => this.buildTablet(t.x, t.y));
    (tiles.obj_S ?? []).forEach((t) => this.buildSwitch(t.x, t.y));
    (tiles.obj_X ?? []).forEach((t) => this.buildShrine(t.x, t.y));
    (tiles.obj_g ?? []).forEach((t) => this.buildGate(t.x, t.y, 'g'));
    (tiles.obj_D ?? []).forEach((t) => this.buildGate(t.x, t.y, 'D'));
    (tiles['obj_^'] ?? []).forEach((t) => this.buildStairs(t.x, t.y));
    (tiles.obj_v ?? []).forEach((t) => this.buildStairs(t.x, t.y));
  }

  private buildBrazier(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.18, 8), this.mats.stone);
    plinth.position.y = 0.09;
    root.add(plinth);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.78, 8), this.mats.stoneDark);
    base.position.y = 0.49;
    base.castShadow = true;
    root.add(base);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16), this.mats.gold);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.78;
    root.add(collar);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.2, 10), this.mats.metal);
    bowl.position.y = 0.94;
    root.add(bowl);
    const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), this.mats.flame);
    coal.position.y = 1.02;
    root.add(coal);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.62, 8), this.mats.flame);
    flame.position.y = 1.34;
    root.add(flame);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.mats.glow);
    core.position.y = 1.2;
    root.add(core);
    let light: THREE.PointLight | null = null;
    if (this.stage.quality === 'high' && this.flames.length < 8) {
      light = new THREE.PointLight(0xffa64d, 2.6, 8, 2);
      light.position.y = 1.34;
      root.add(light);
    }
    this.root.add(root);
    this.flames.push({ mesh: flame, core, light, phase: this.rnd() * 6 });
  }

  private buildRune(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.54, 0.24, 10), this.mats.stone);
    base.position.y = 0.12;
    root.add(base);
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 6, 28), this.mats.gold);
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = 0.26;
    root.add(inlay);
    const coreMat = this.mats.stoneDark.clone();
    coreMat.userData.dynamic = true;
    coreMat.emissive = new THREE.Color(0x1c2b35);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), coreMat);
    core.position.y = 1.0;
    core.castShadow = true;
    root.add(core);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12, 0), coreMat);
      shard.position.set(Math.cos(a) * 0.46, 0.86 + (i % 2) * 0.32, Math.sin(a) * 0.46);
      shard.rotation.set(this.rnd() * 3, a, this.rnd() * 3);
      root.add(shard);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.032, 6, 28), this.mats.metal);
    ring.position.y = 1.0;
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const def = this.zone.runes.find((r) => r.x === x && r.y === y);
    if (def) this.runeIds.set(key(x, y), def.id);
    let light: THREE.PointLight | null = null;
    if (this.stage.quality === 'high' && def) {
      light = new THREE.PointLight(0x8dffd8, 0, 6, 2);
      light.position.y = 1.1;
      root.add(light);
    }
    this.root.add(root);
    this.runes.set(key(x, y), { root, core, light });
  }

  private buildPortal(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 1.85, 8), this.mats.marble);
      pillar.position.set(side * 0.78, 0.93, 0);
      pillar.castShadow = true;
      root.add(pillar);
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.48), this.mats.gold);
      capital.position.set(side * 0.78, 1.92, 0);
      root.add(capital);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.13, 10, 32, Math.PI), this.mats.marble);
    arch.position.y = 1.92;
    arch.castShadow = true;
    root.add(arch);
    const surface = new THREE.Mesh(new THREE.CircleGeometry(0.68, 36), this.mats.portalSurface);
    surface.position.y = 1.3;
    surface.renderOrder = 4;
    root.add(surface);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.82, 36), this.mats.portal);
    halo.position.set(0, 1.3, -0.03);
    root.add(halo);
    const rings: THREE.Object3D[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 + i * 0.14, 0.028, 6, 36), i === 1 ? this.mats.glow : this.mats.gold);
      ring.position.y = 1.3;
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.28;
      root.add(ring);
      rings.push(ring);
    }
    const light = new THREE.PointLight(0xb38bff, 1.8, 8, 2);
    light.position.y = 1.4;
    if (this.stage.quality === 'high') root.add(light);
    this.root.add(root);
    this.portals.push({ root, rings, light, phase: this.rnd() * Math.PI * 2 });
  }

  private buildChest(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.44, 0.54), this.mats.wood);
    body.position.y = 0.3;
    body.castShadow = true;
    root.add(body);
    for (const offset of [-0.22, 0.22]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.47, 0.56), this.mats.metal);
      band.position.set(offset, 0.3, 0);
      root.add(band);
    }
    const lid = new THREE.Group();
    lid.position.set(0, 0.52, -0.27);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.56), this.mats.wood);
    lidMesh.position.z = 0.28;
    lidMesh.castShadow = true;
    lid.add(lidMesh);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.1), this.mats.gold);
    crest.position.set(0, 0.02, 0.3);
    lid.add(crest);
    root.add(lid);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), this.mats.glow);
    gem.position.set(0, 0.36, 0.3);
    root.add(gem);
    this.root.add(root);
    this.chests.set(key(x, y), { root, lid });
  }

  private buildTablet(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.44), this.mats.stoneDark);
    base.position.y = 0.08;
    root.add(base);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.88, 0.16), this.mats.marble);
    slab.position.y = 0.62;
    slab.rotation.x = -0.18;
    slab.castShadow = true;
    root.add(slab);
    for (let i = 0; i < 3; i++) {
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(i === 1 ? 0.3 : 0.4, 0.035, 0.02), this.mats.rune);
      glyph.position.set(0, 0.82 - i * 0.15, 0.1);
      root.add(glyph);
    }
    this.root.add(root);
  }

  private buildSwitch(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.14, 8), this.mats.stoneDark);
    base.position.y = 0.07;
    root.add(base);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.08, 8), this.mats.stone);
    pillar.position.y = 0.6;
    pillar.castShadow = true;
    root.add(pillar);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 20), this.mats.gold);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 1.15;
    root.add(crown);
    const coreMat = this.mats.stoneDark.clone();
    coreMat.userData.dynamic = true;
    coreMat.emissive = new THREE.Color(0x111820);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), coreMat);
    core.position.y = 1.32;
    root.add(core);
    this.root.add(root);
    const id = this.zone.mechanisms.flatMap((m) => m.switches).find((s) => s.x === x && s.y === y)?.id;
    if (id) this.switches.set(id, { root, core });
  }

  private buildShrine(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.CylinderGeometry(0.78 - i * 0.12, 0.84 - i * 0.12, 0.12, 10), i === 1 ? this.mats.stoneDark : this.mats.marble);
      step.position.y = 0.06 + i * 0.12;
      root.add(step);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 6, 28), this.mats.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    root.add(ring);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), this.mats.rune);
    crystal.position.y = 0.98;
    root.add(crystal);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.13, 0), this.mats.crystal);
      shard.position.set(Math.cos(a) * 0.42, 0.72, Math.sin(a) * 0.42);
      shard.rotation.set(a, this.rnd() * 3, a);
      root.add(shard);
    }
    const light = new THREE.PointLight(0x8dffd8, 1.6, 6, 2);
    light.position.y = 1.0;
    if (this.stage.quality === 'high') root.add(light);
    this.root.add(root);
  }

  private buildGate(x: number, y: number, type: 'D' | 'g') {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.46), this.mats.stoneDark);
      foot.position.set(side * 0.45, 0.09, 0);
      root.add(foot);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 0.36), this.mats.marble);
      post.position.set(side * 0.45, 1.1, 0);
      post.castShadow = true;
      root.add(post);
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.5), this.mats.gold);
      capital.position.set(side * 0.45, 2.18, 0);
      root.add(capital);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.4), this.mats.marble);
    lintel.position.y = 2.3;
    root.add(lintel);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.86, 0.24), this.mats.stoneDark);
    slab.position.y = 1.0;
    slab.castShadow = true;
    slab.name = 'slab';
    root.add(slab);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.27), this.mats.metal);
      band.position.y = 0.5 + i * 0.5;
      slab.add(band);
    }
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24), type === 'g' ? this.mats.gold : this.mats.rune);
    seal.position.set(0, 1.12, 0.16);
    seal.name = 'seal';
    root.add(seal);
    this.root.add(root);
    this.gates.set(key(x, y), root);
  }

  private buildStairs(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (let i = 0; i < 5; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.2), i % 2 ? this.mats.marble : this.mats.stoneWorn);
      step.position.set(0, 0.05 + i * 0.12, -0.4 + i * 0.2);
      step.castShadow = true;
      root.add(step);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.0), this.mats.stone);
      rail.position.set(side * 0.48, 0.28, 0);
      rail.rotation.x = -0.12;
      root.add(rail);
    }
    this.root.add(root);
  }

  private buildZoneSignature() {
    if (this.zoneId === 'cartesia') {
      const fountain = new THREE.Group();
      fountain.position.set(16.5, 0, 10.5);
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.26, 16), this.mats.marble);
      basin.position.y = 0.13;
      fountain.add(basin);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), this.mats.water);
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.28;
      fountain.add(water);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 2.2, 10), this.mats.marble);
      column.position.y = 1.2;
      column.castShadow = true;
      fountain.add(column);
      for (let i = 0; i < 3; i++) {
        const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.28, 0.035, 6, 28), this.mats.gold);
        crownRing.rotation.x = Math.PI / 2 + i * 0.22;
        crownRing.position.y = 1.7 + i * 0.34;
        fountain.add(crownRing);
      }
      this.root.add(fountain);
    }
    if (this.zoneId === 'ciudad') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.18, 10, 56), this.mats.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(23.5, 0.14, 10.5);
      this.root.add(ring);
      const tower = new THREE.Group();
      tower.position.set(23.5, 0, 10.5);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.4, 10), this.mats.stone);
      base.position.y = 0.2;
      tower.add(base);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.72, 3.8, 8), this.mats.marble);
      spire.position.y = 2.3;
      spire.castShadow = true;
      tower.add(spire);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.4, 8), this.mats.gold);
      crown.position.y = 4.75;
      tower.add(crown);
      this.root.add(tower);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.2), this.mats.marble);
        marker.position.set(23.5 + Math.cos(a) * 4.6, 0.43, 10.5 + Math.sin(a) * 4.6);
        marker.rotation.y = -a;
        marker.castShadow = true;
        this.root.add(marker);
        if (i % 3 === 0) {
          const banner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.6), this.mats.cloth);
          banner.position.set(23.5 + Math.cos(a) * 4.6, 1.5, 10.5 + Math.sin(a) * 4.6);
          banner.rotation.y = -a;
          this.root.add(banner);
        }
      }
    }
    if (this.zoneId === 'llanura') {
      for (let i = 0; i < 6; i++) {
        const obelisk = new THREE.Group();
        obelisk.position.set(5 + i * 4.6, 0, i % 2 ? 4.5 : 15.5);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.9), this.mats.stoneDark);
        plinth.position.y = 0.15;
        obelisk.add(plinth);
        const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.6 + (i % 2) * 0.5, 4), this.mats.marble);
        shaft.position.y = 1.55;
        shaft.rotation.y = Math.PI / 4;
        shaft.castShadow = true;
        obelisk.add(shaft);
        const seal = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 18), this.mats.gold);
        seal.position.set(0, 1.1, 0.24);
        obelisk.add(seal);
        this.root.add(obelisk);
      }
    }
    if (this.zoneId === 'templo' || this.zoneId === 'cartesia') {
      for (let i = 0; i < 4; i++) {
        const statue = new THREE.Group();
        statue.position.set(6 + i * 6, 0, i % 2 ? 3 : 17);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 1.0), this.mats.stoneDark);
        plinth.position.y = 0.21;
        statue.add(plinth);
        const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.35, 8), this.mats.marble);
        robe.position.y = 1.05;
        robe.castShadow = true;
        statue.add(robe);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.62, 8), this.mats.marble);
        torso.position.y = 1.72;
        statue.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), this.mats.marble);
        head.position.y = 2.15;
        statue.add(head);
        const diadem = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 20), this.mats.gold);
        diadem.rotation.x = Math.PI / 2;
        diadem.position.y = 2.28;
        statue.add(diadem);
        this.root.add(statue);
      }
    }
    if (this.zoneId === 'valle') {
      for (let i = 0; i < 26; i++) {
        const reed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.95, 4), this.mats.leafDark);
        reed.position.set(2 + this.rnd() * 28, 0.46, 3 + this.rnd() * 14);
        reed.rotation.z = (this.rnd() - 0.5) * 0.42;
        this.root.add(reed);
      }
      for (let i = 0; i < 5; i++) {
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), this.mats.stoneWorn);
        stone.position.set(2 + i * 6, 0.35, 18 + (i % 2) * 0.5);
        stone.rotation.set(this.rnd(), this.rnd() * 6, this.rnd());
        stone.scale.set(0.8 + this.rnd() * 0.5, 0.6 + this.rnd() * 0.5, 0.8 + this.rnd() * 0.5);
        stone.castShadow = true;
        this.root.add(stone);
      }
    }
  }

  private buildNpcs() {
    this.zone.npcs.forEach((npc) => {
      const rig = createNpcRig(npc.id, this.mats);
      rig.root.position.set(npc.x + 0.5, 0, npc.y + 0.5);
      rig.root.rotation.y = Math.PI;
      this.characterLayer.add(rig.root);
      this.npcs.set(npc.id, rig);
    });
  }

  private buildAmbientParticles() {
    const count = this.stage.quality === 'high' ? 280 : 90;
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = this.rnd() * MAP_W;
      positions[i * 3 + 1] = 0.4 + this.rnd() * 5;
      positions[i * 3 + 2] = this.rnd() * MAP_H;
      velocity[i * 3] = (this.rnd() - 0.5) * 0.16;
      velocity[i * 3 + 1] = 0.04 + this.rnd() * 0.14;
      velocity[i * 3 + 2] = (this.rnd() - 0.5) * 0.16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const palette: Record<ZoneDef['ambience'], number> = {
      town: 0xd8ffb0,
      grove: 0x9dffd6,
      river: 0x9fe0ff,
      city: 0xffd166,
      sanctum: 0xd8a8ff,
    };
    const mat = new THREE.PointsMaterial({ color: palette[this.zone.ambience], size: 0.08, transparent: true, opacity: 0.7, depthWrite: false });
    mat.userData.dynamic = true;
    this.ambient = new THREE.Points(geo, mat);
    this.ambientVelocity = velocity;
    this.root.add(this.ambient);
  }

  private collectColliders() {
    this.colliders = [];
    const add = (x: number, y: number, sx: number, sy: number, sz: number) => {
      const min = new THREE.Vector3(x + 0.5 - sx / 2, 0, y + 0.5 - sz / 2);
      const max = new THREE.Vector3(x + 0.5 + sx / 2, sy, y + 0.5 + sz / 2);
      this.colliders.push(new THREE.Box3(min, max));
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = charAt(this.zone, x, y);
        if (ch === '#') add(x, y, 1, 1.2, 1);
        else if (ch === 'c') add(x, y, 0.55, 2.2, 0.55);
        else if (ch === 'o') add(x, y, 1, 0.8, 1);
        else if (ch === 'T') add(x, y, 1.2, 3, 1.2);
        else if (ch === 'g' || ch === 'D') add(x, y, 1, 2.2, 1);
      }
    }
  }

  sync(snapshot: WorldSnapshot, delta: number) {
    const time = snapshot.time;
    const p = snapshot.player;
    this.hero.root.position.x = p.x;
    this.hero.root.position.z = p.y;
    const targetYaw = Math.atan2(p.facingX, p.facingY);
    let diff = targetYaw - this.heroVisualYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heroVisualYaw += diff * (1 - Math.exp(-delta * 6));
    this.hero.root.rotation.y = this.heroVisualYaw;
    const action = p.action && p.actionProgress < 1 ? p.action : p.pose;
    animateRig(this.hero, {
      time,
      pose: action,
      speed: p.speed,
      hurt: p.hurt,
      dead: false,
      phase: p.actionProgress,
    });
    const heroSkin = this.hero.bones.head.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh | undefined;
    if (heroSkin) {
      const mat = heroSkin.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(p.hurt ? 0x8b2020 : 0x000000);
      mat.emissiveIntensity = p.hurt ? 0.6 : 0;
    }

    this.npcs.forEach((rig, id) => {
      const npc = this.zone.npcs.find((n) => n.id === id);
      if (!npc) return;
      animateRig(rig, { time: time + hash(id) % 1000, pose: 'idle', speed: 0, hurt: false, dead: false, phase: 0 });
    });

    this.syncEnemies(snapshot.enemies, time);
    this.syncBoss(snapshot.boss, time);
    this.syncProjectiles(snapshot.projectiles);
    this.syncWorldState(snapshot);
    this.lensGrid.visible = snapshot.lens;
  }

  private syncEnemies(list: EnemySnapshot[], time: number) {
    const seen = new Set<string>();
    list.forEach((e) => {
      seen.add(e.id);
      let visual = this.enemies.get(e.id);
      if (!visual) {
        visual = { rig: createEnemyRig(e.kind, this.mats), deadAt: 0 };
        this.characterLayer.add(visual.rig.root);
        this.enemies.set(e.id, visual);
      }
      if (e.dead && !visual.deadAt) visual.deadAt = time;
      visual.rig.root.visible = !e.dead || time - visual.deadAt < 1100;
      visual.rig.root.position.x = e.x;
      visual.rig.root.position.z = e.y;
      visual.rig.root.rotation.y = Math.atan2(e.facingX, e.facingY);
      animateRig(visual.rig, {
        time: time + hash(e.id) % 700,
        pose: e.dead ? 'dead' : e.state === 'windup' ? 'attack' : e.speed > 0.1 ? 'walk' : 'idle',
        speed: e.speed,
        hurt: e.hurt,
        dead: e.dead,
        phase: 0.5,
      });
      this.tintRig(visual.rig, e.hurt ? 0x7a2222 : 0x000000);
    });
    for (const [id, visual] of this.enemies) {
      if (seen.has(id)) continue;
      visual.rig.root.visible = false;
    }
  }

  private syncBoss(b: BossSnapshot | null, time: number) {
    if (!b) {
      if (this.boss) this.boss.rig.root.visible = false;
      return;
    }
    const kindName = String(b.kind);
    if (!this.boss || this.bossKind !== kindName) {
      if (this.boss) this.boss.rig.root.removeFromParent();
      this.boss = { rig: createBossRig(b.kind, this.mats), deadAt: 0 };
      this.bossKind = kindName;
      this.characterLayer.add(this.boss.rig.root);
    }
    this.boss.rig.root.position.x = b.x;
    this.boss.rig.root.position.z = b.y;
    this.boss.rig.root.rotation.y = Math.atan2(this.hero.root.position.x - b.x, this.hero.root.position.z - b.y);
    this.boss.rig.root.visible = !b.dead || time - this.boss.deadAt < 1400;
    if (b.dead && !this.boss.deadAt) this.boss.deadAt = time;
    animateRig(this.boss.rig, {
      time,
      pose: b.dead ? 'dead' : b.state === 'windup' ? 'attack' : b.state === 'stunned' ? 'hurt' : 'idle',
      speed: 0.8,
      hurt: b.hurt,
      dead: b.dead,
      phase: 0.45,
    });
    this.tintRig(this.boss.rig, b.state === 'stunned' ? 0x1f6f5b : b.hurt ? 0x7a2222 : 0x000000);
  }

  private tintRig(rig: CharacterRig, color: number) {
    rig.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (mat instanceof THREE.MeshStandardMaterial && mat.userData.dynamic) {
        mat.emissive.setHex(color);
      }
    });
  }

  private syncProjectiles(list: ProjectileSnapshot[]) {
    list.forEach((p, i) => {
      let mesh = this.projectiles[i];
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        mesh.userData.dynamic = true;
        this.effectLayer.add(mesh);
        this.projectiles.push(mesh);
      }
      mesh.visible = true;
      mesh.position.set(p.x, 0.95, p.y);
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(p.color);
      const s = p.home ? 1.25 : 1;
      mesh.scale.setScalar(s);
    });
    for (let i = list.length; i < this.projectiles.length; i++) this.projectiles[i].visible = false;
  }

  private syncWorldState(s: WorldSnapshot) {
    this.runes.forEach((visual, k) => {
      const id = this.runeIds.get(k);
      const lit = !!id && !!s.solvedRunes[id];
      const mat = visual.core.material as THREE.MeshStandardMaterial;
      mat.color.setHex(lit ? 0x8dffd8 : 0x5b6472);
      mat.emissive.setHex(lit ? 0x2ad3a5 : 0x14202a);
      mat.emissiveIntensity = lit ? 1.7 : 0.25;
      if (visual.light) visual.light.intensity = lit ? 2.2 : 0;
    });
    this.chests.forEach((visual, k) => {
      const [x, y] = k.split(',').map(Number);
      const def = this.zone.chests.find((c) => c.x === x && c.y === y);
      const opened = !!def && !!s.openedChests[def.id];
      visual.lid.rotation.x = opened ? -1.05 : 0;
    });
    this.switches.forEach((visual, id) => {
      const on = !!s.switchStates[id] || !!s.mechanisms[Object.keys(s.mechanisms).find((m) => this.zone.mechanisms.find((d) => d.id === m)?.switches.some((sw) => sw.id === id)) ?? ''];
      const mat = visual.core.material as THREE.MeshStandardMaterial;
      mat.color.setHex(on ? 0x8dffd8 : 0x555a68);
      mat.emissive.setHex(on ? 0x2ad3a5 : 0x111820);
      mat.emissiveIntensity = on ? 1.6 : 0.2;
    });
    this.gates.forEach((root, k) => {
      const [x, y] = k.split(',').map(Number);
      const open = !!s.gateOpen[k] || (charAt(this.zone, x, y) === 'g' && Object.values(s.mechanisms).some(Boolean)) || (charAt(this.zone, x, y) === 'D' && Object.values(s.solvedRunes).filter(Boolean).length >= this.zone.runes.length);
      const slab = root.getObjectByName('slab');
      const seal = root.getObjectByName('seal');
      if (slab) slab.position.y = open ? 2.4 : 0.95;
      if (seal) seal.visible = !open;
    });
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    const t = time / 1000;
    this.updateCamera(dt, time);
    this.updateAmbient(dt, t);
    this.updateEffects(dt);
    this.scenery.update(t);
    this.mats.portalSurface.uniforms.uTime.value = t;
    if (this.mats.water.map && this.mats.water.normalMap) {
      this.mats.water.map.offset.x = t * 0.035;
      this.mats.water.map.offset.y = Math.sin(t * 0.4) * 0.05;
      this.mats.water.normalMap.offset.x = -t * 0.022;
      this.mats.water.normalMap.offset.y = t * 0.017;
    }
    this.mats.water.emissiveIntensity = 0.32 + Math.sin(t * 1.2) * 0.1;
    this.flames.forEach((f, i) => {
      const wave = Math.sin(t * 7 + f.phase + i) * 0.14;
      f.mesh.scale.set(1 + wave, 1 + wave * 1.9, 1 + wave);
      f.mesh.rotation.y = t * 1.4 + i;
      f.core.scale.setScalar(0.9 + Math.sin(t * 11 + i) * 0.18);
      if (f.light) f.light.intensity = 2.3 + Math.sin(t * 9 + i) * 0.4;
    });
    if (time >= this.nextFire && this.flames.length) {
      this.nextFire = time + 160;
      const f = this.flames[Math.floor(this.rnd() * this.flames.length)];
      const p = new THREE.Vector3();
      f.mesh.getWorldPosition(p);
      this.spawnParticles(p.x, p.z, 0xffa64d, this.stage.quality === 'high' ? 4 : 2, 0.12, 0.5, 520, 0.85, p.y);
    }
    this.runes.forEach((r, k) => {
      const phase = (hash(k) % 628) / 100;
      r.root.rotation.y = Math.sin(t * 0.6 + phase) * 0.1;
      r.core.rotation.y = t * 0.7 + phase;
      r.core.position.y = 1.0 + Math.sin(t * 1.6 + phase) * 0.06;
    });
    this.portals.forEach((portal, index) => {
      portal.rings.forEach((ring, ringIndex) => {
        ring.rotation.z = t * (0.22 + ringIndex * 0.14) * (ringIndex % 2 ? -1 : 1) + portal.phase;
        ring.rotation.y = Math.sin(t * 0.5 + index + ringIndex) * 0.22;
      });
      if (portal.light) portal.light.intensity = 1.6 + Math.sin(t * 2.2 + portal.phase) * 0.45;
      if (this.rnd() > 0.982) {
        const p = new THREE.Vector3();
        portal.root.getWorldPosition(p);
        this.spawnParticles(p.x, p.z, 0xc4a4ff, this.stage.quality === 'high' ? 3 : 1, 1.1, 0.45, 720, -0.08, 1.2);
      }
    });
    this.lensGrid.position.y = 0.16 + Math.sin(t * 2) * 0.02;
  }

  private updateCamera(dt: number, time: number) {
    if (this.cinematicTarget) {
      this.cameraController.setCinematic(this.cinematicTarget.x, this.cinematicTarget.z, this.cinematicTarget.until);
      if (time >= this.cinematicTarget.until) this.cinematicTarget = null;
    } else {
      this.cameraController.clearCinematic();
    }
    this.cameraController.update(dt, time, this.hero.root.position);
    const cam = this.stage.camera;
    this.stage.sun.position.set(cam.position.x - 12, 22, cam.position.z + 9);
    this.stage.sun.target.position.set(cam.position.x, 0, cam.position.z);
    this.stage.sun.target.updateMatrixWorld();
  }

  private updateAmbient(dt: number, t: number) {
    if (!this.ambient) return;
    const attr = this.ambient.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this.ambientVelocity[i] * dt;
      arr[i + 1] += this.ambientVelocity[i + 1] * dt;
      arr[i + 2] += this.ambientVelocity[i + 2] * dt;
      if (arr[i + 1] > 6) {
        arr[i] = this.rnd() * MAP_W;
        arr[i + 1] = 0.3;
        arr[i + 2] = this.rnd() * MAP_H;
      }
    }
    attr.needsUpdate = true;
    this.ambient.rotation.y = Math.sin(t * 0.08) * 0.03;
  }

  private spawnParticles(x: number, z: number, color: number, count: number, spread: number, speed: number, life: number, gravity = 0.6, baseY = 0.5) {
    if (this.stage.quality === 'low') count = Math.max(2, Math.floor(count * 0.45));
    const positions = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (this.rnd() - 0.5) * spread;
      positions[i * 3 + 1] = baseY + this.rnd() * 0.35;
      positions[i * 3 + 2] = z + (this.rnd() - 0.5) * spread;
      const a = this.rnd() * Math.PI * 2;
      const s = speed * (0.4 + this.rnd() * 0.8);
      velocity[i * 3] = Math.cos(a) * s;
      velocity[i * 3 + 1] = speed * (0.7 + this.rnd() * 1.2);
      velocity[i * 3 + 2] = Math.sin(a) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.13, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    mat.userData.dynamic = true;
    const points = new THREE.Points(geo, mat);
    this.effectLayer.add(points);
    this.effects.push({ points, velocity, life, maxLife: life, gravity });
  }

  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt * 1000;
      const attr = fx.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let j = 0; j < arr.length; j += 3) {
        fx.velocity[j + 1] -= fx.gravity * dt;
        arr[j] += fx.velocity[j] * dt;
        arr[j + 1] += fx.velocity[j + 1] * dt;
        arr[j + 2] += fx.velocity[j + 2] * dt;
      }
      attr.needsUpdate = true;
      (fx.points.material as THREE.PointsMaterial).opacity = Math.max(0, fx.life / fx.maxLife);
      if (fx.life <= 0) {
        fx.points.removeFromParent();
        fx.points.geometry.dispose();
        (fx.points.material as THREE.Material).dispose();
        this.effects.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const fx = this.rings[i];
      fx.life -= dt * 1000;
      const k = Math.max(0, fx.life / fx.maxLife);
      fx.mesh.scale.setScalar(1 + (1 - k) * fx.grow);
      (fx.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.85;
      if (fx.life <= 0) {
        fx.mesh.removeFromParent();
        fx.mesh.geometry.dispose();
        (fx.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  burst(x: number, y: number, color: number, count: number) {
    this.spawnParticles(x, y, color, count, 0.55, 2.0, 640, 1.6, 0.8);
  }

  slash(x: number, y: number, heavy: boolean, facingX: number, facingY: number, color: number) {
    const geo = new THREE.TorusGeometry(heavy ? 1.0 : 0.75, 0.055, 6, 28, Math.PI * 1.25);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    mat.userData.dynamic = true;
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x + facingX * 0.55, 0.95, y + facingY * 0.55);
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = Math.atan2(facingX, facingY) - Math.PI / 2;
    this.effectLayer.add(ring);
    this.rings.push({ mesh: ring, life: heavy ? 360 : 240, maxLife: heavy ? 360 : 240, grow: 1.1 });
    this.spawnParticles(x, y, color, heavy ? 18 : 9, 0.7, 2.4, 420, 1.2, 0.9);
  }

  telegraph(x: number, y: number, radius: number, color: number) {
    const geo = new THREE.RingGeometry(radius * 0.62, radius * 0.74, 40);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    mat.userData.dynamic = true;
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.09, y);
    this.effectLayer.add(ring);
    this.rings.push({ mesh: ring, life: 520, maxLife: 520, grow: 0.5 });
  }

  cinematic(x: number, y: number, duration = 1800) {
    this.cinematicTarget = { x, z: y, until: performance.now() + duration };
  }

  shake(intensity = 0.2) {
    this.cameraShake = Math.max(this.cameraShake, intensity);
  }

  dispose() {
    this.scenery.dispose();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
        const geo = obj.geometry;
        if (!geo.userData.shared) geo.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat) => {
          if (mat.userData.dynamic) mat.dispose();
        });
      }
    });
    this.root.removeFromParent();
  }
}
