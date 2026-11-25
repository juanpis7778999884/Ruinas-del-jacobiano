import * as THREE from 'three';
import { MAP_H, MAP_W } from '../config';
import { charAt } from '../data/zones';
import type { ZoneDef } from '../data/zones';
import type { EnemyKind, ZoneId } from '../data/types';
import type { MaterialSet } from './materials';
import type { CharacterRig } from './rig';
import { animateRig, createBossRig, createEnemyRig, createHeroRig, createNpcRig } from './rig';
import type { Stage } from './stage';
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
  private flames: { mesh: THREE.Mesh; light: THREE.PointLight | null; phase: number }[] = [];
  private waterMesh: THREE.InstancedMesh | null = null;
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

  constructor(stage: Stage, zone: ZoneDef, zoneId: ZoneId, mats: MaterialSet) {
    this.stage = stage;
    this.zone = zone;
    this.zoneId = zoneId;
    this.mats = mats;
    this.rnd = seeded(hash(zoneId));
    stage.scene.add(this.root);
    this.root.add(this.characterLayer);
    this.root.add(this.effectLayer);
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
  }

  private addInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, place: (i: number, dummy: THREE.Object3D) => void, color?: (i: number) => THREE.Color) {
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      place(i, dummy);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (color) inst.setColorAt(i, color(i));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.root.add(inst);
    return inst;
  }

  private build() {
    const tiles: Record<string, { x: number; y: number; ch: string; bridge: boolean }[]> = {};
    const push = (bucket: string, x: number, y: number, ch: string, bridge = false) => {
      (tiles[bucket] ??= []).push({ x, y, ch, bridge });
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = charAt(this.zone, x, y);
        const bridge = ch === '=' && this.isNearWater(x, y);
        if (ch === '~') push('water', x, y, ch);
        else if (bridge) push('bridge', x, y, ch, true);
        else if (ch === ',' || ch === '*') push('moss', x, y, ch);
        else if (ch === '=') push('path', x, y, ch);
        else push('ground', x, y, ch);
        if (ch === '#' || ch === 'c' || ch === 'o' || ch === 'T' || ch === '*' || ch === ',') push(`prop_${ch}`, x, y, ch);
        if (ch === 'B' || ch === 'R' || ch === 'P' || ch === 'C' || ch === 'L' || ch === 'S' || ch === 'X' || ch === 'g' || ch === 'D' || ch === '^' || ch === 'v') push(`obj_${ch}`, x, y, ch);
      }
    }
    this.buildGround(tiles.ground ?? [], tiles.moss ?? [], tiles.path ?? []);
    this.buildWater(tiles.water ?? []);
    this.buildBridges(tiles.bridge ?? []);
    this.buildWalls(tiles['prop_#'] ?? []);
    this.buildColumns(tiles.prop_c ?? []);
    this.buildRocks(tiles.prop_o ?? []);
    this.buildTrees(tiles.prop_T ?? [], tiles['prop_,'] ?? []);
    this.buildFlowers(tiles['prop_*'] ?? []);
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

  private groundMaterial(ch: string) {
    if (this.zone.tileset === 'temple') return this.mats.marble;
    if (this.zone.tileset === 'overworld') return ch === ',' || ch === '*' ? this.mats.moss : this.mats.earth;
    return ch === ',' || ch === '*' ? this.mats.moss : this.mats.stone;
  }

  private buildGround(ground: { x: number; y: number }[], moss: { x: number; y: number }[], path: { x: number; y: number }[]) {
    const set = [...ground, ...moss, ...path];
    const variants = new Map<THREE.Material, number[]>();
    set.forEach((t, i) => {
      const use = path.includes(t) ? this.mats.path : moss.includes(t) ? this.mats.moss : this.groundMaterial('.');
      if (!variants.has(use)) variants.set(use, []);
      variants.get(use)!.push(i);
    });
    variants.forEach((indices, mat) => {
      const geo = new THREE.BoxGeometry(0.98, 0.16, 0.98);
      this.addInstanced(geo, mat, indices.length, (i, dummy) => {
        const t = set[indices[i]];
        dummy.position.set(t.x + 0.5, -0.08, t.y + 0.5);
        dummy.rotation.y = 0;
        dummy.scale.set(1, 1, 1);
      }, (i) => {
        const v = 0.78 + this.rnd() * 0.28;
        return new THREE.Color(v, v * (0.97 + this.rnd() * 0.05), v * (0.93 + this.rnd() * 0.08));
      });
    });
  }

  private buildWater(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    this.waterMesh = this.addInstanced(new THREE.BoxGeometry(0.99, 0.1, 0.99), this.mats.water, tiles.length, (i, dummy) => {
      dummy.position.set(tiles[i].x + 0.5, -0.04, tiles[i].y + 0.5);
      dummy.rotation.y = 0;
      dummy.scale.set(1, 1, 1);
    }, () => new THREE.Color(0.75 + this.rnd() * 0.35, 0.8 + this.rnd() * 0.2, 1));
    this.waterMesh.castShadow = false;
    const stones: { x: number; y: number }[] = [];
    tiles.forEach((t) => {
      if (this.rnd() > 0.72 && charAt(this.zone, t.x + 1, t.y) !== '~') stones.push({ x: t.x + 1, y: t.y });
      if (this.rnd() > 0.8 && charAt(this.zone, t.x, t.y + 1) !== '~') stones.push({ x: t.x, y: t.y + 1 });
    });
    if (stones.length) {
      this.addInstanced(new THREE.DodecahedronGeometry(0.22, 0), this.mats.stone, stones.length, (i, dummy) => {
        dummy.position.set(stones[i].x + 0.5, 0.08, stones[i].y + 0.5);
        dummy.rotation.set(this.rnd(), this.rnd() * 6, this.rnd());
        dummy.scale.setScalar(0.7 + this.rnd() * 0.7);
      });
    }
  }

  private buildBridges(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    this.addInstanced(new THREE.BoxGeometry(0.96, 0.12, 0.3), this.mats.wood, tiles.length * 3, (i, dummy) => {
      const t = tiles[Math.floor(i / 3)];
      const row = i % 3;
      dummy.position.set(t.x + 0.5, 0.13 + row * 0.01, t.y + 0.18 + row * 0.32);
      dummy.rotation.y = (this.rnd() - 0.5) * 0.05;
      dummy.scale.set(1, 1, 1);
    }, (i) => new THREE.Color(0.75 + (i % 3) * 0.08, 0.7 + this.rnd() * 0.2, 0.65 + this.rnd() * 0.2));
    this.addInstanced(new THREE.BoxGeometry(0.08, 0.5, 0.08), this.mats.wood, tiles.length * 2, (i, dummy) => {
      const t = tiles[Math.floor(i / 2)];
      dummy.position.set(t.x + (i % 2 ? 0.92 : 0.08), 0.36, t.y + 0.5);
      dummy.rotation.y = 0;
      dummy.scale.set(1, 1, 1);
    });
  }

  private buildWalls(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    this.addInstanced(new THREE.BoxGeometry(0.98, 1.15, 0.98), this.mats.stone, tiles.length, (i, dummy) => {
      const t = tiles[i];
      dummy.position.set(t.x + 0.5, 0.52, t.y + 0.5);
      dummy.rotation.y = (this.rnd() - 0.5) * 0.06;
      dummy.scale.set(1, 0.86 + this.rnd() * 0.28, 1);
    }, () => new THREE.Color(0.72 + this.rnd() * 0.3, 0.72 + this.rnd() * 0.25, 0.78 + this.rnd() * 0.22));
    const caps = tiles.filter(() => this.rnd() > 0.62);
    if (caps.length) {
      this.addInstanced(new THREE.BoxGeometry(0.7, 0.22, 0.7), this.mats.stoneDark, caps.length, (i, dummy) => {
        dummy.position.set(caps[i].x + 0.5, 1.16, caps[i].y + 0.5);
        dummy.rotation.set((this.rnd() - 0.5) * 0.2, this.rnd() * 3, (this.rnd() - 0.5) * 0.2);
        dummy.scale.setScalar(0.8 + this.rnd() * 0.5);
      });
    }
  }

  private buildColumns(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    const shaft = new THREE.CylinderGeometry(0.25, 0.3, 2.3, 8);
    this.addInstanced(shaft, this.zone.tileset === 'temple' ? this.mats.marble : this.mats.stone, tiles.length, (i, dummy) => {
      dummy.position.set(tiles[i].x + 0.5, 1.15, tiles[i].y + 0.5);
      dummy.rotation.set(0, this.rnd() * 0.8, 0);
      dummy.scale.set(1, 0.85 + this.rnd() * 0.3, 1);
    });
    this.addInstanced(new THREE.BoxGeometry(0.72, 0.16, 0.72), this.mats.marble, tiles.length * 2, (i, dummy) => {
      const t = tiles[Math.floor(i / 2)];
      dummy.position.set(t.x + 0.5, i % 2 ? 2.32 : 0.12, t.y + 0.5);
      dummy.rotation.y = 0;
      dummy.scale.set(1, 1, 1);
    });
  }

  private buildRocks(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    this.addInstanced(new THREE.DodecahedronGeometry(0.42, 0), this.mats.stoneDark, tiles.length, (i, dummy) => {
      dummy.position.set(tiles[i].x + 0.5, 0.24, tiles[i].y + 0.5);
      dummy.rotation.set(this.rnd() * 3, this.rnd() * 6, this.rnd() * 3);
      dummy.scale.set(0.8 + this.rnd() * 0.6, 0.6 + this.rnd() * 0.7, 0.8 + this.rnd() * 0.6);
    });
  }

  private buildTrees(trees: { x: number; y: number }[], bushes: { x: number; y: number }[]) {
    trees.forEach((t, i) => {
      const root = new THREE.Group();
      root.position.set(t.x + 0.5, 0, t.y + 0.5);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.0, 6), this.mats.bark);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      root.add(trunk);
      for (let j = 0; j < 3; j++) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 - j * 0.14, 1), this.mats.leaf);
        crown.position.set((this.rnd() - 0.5) * 0.5, 2.0 + j * 0.55, (this.rnd() - 0.5) * 0.5);
        crown.scale.set(1.25 + this.rnd() * 0.35, 0.85, 1.1 + this.rnd() * 0.3);
        crown.castShadow = true;
        root.add(crown);
      }
      for (let j = 0; j < 3; j++) {
        const rootlet = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.5, 5), this.mats.bark);
        rootlet.position.set(Math.cos(j * 2.1) * 0.35, 0.16, Math.sin(j * 2.1) * 0.35);
        rootlet.rotation.z = Math.cos(j * 2.1) * 0.7;
        rootlet.rotation.x = -Math.sin(j * 2.1) * 0.7;
        root.add(rootlet);
      }
      root.rotation.y = this.rnd() * 6.28;
      root.scale.setScalar(0.85 + (i % 3) * 0.12);
      this.root.add(root);
    });
    if (!bushes.length) return;
    this.addInstanced(new THREE.IcosahedronGeometry(0.36, 0), this.mats.leaf, bushes.length, (i, dummy) => {
      dummy.position.set(bushes[i].x + 0.5, 0.22, bushes[i].y + 0.5);
      dummy.rotation.set(this.rnd(), this.rnd() * 6, this.rnd());
      dummy.scale.set(1 + this.rnd() * 0.5, 0.6 + this.rnd() * 0.4, 1 + this.rnd() * 0.5);
    });
  }

  private buildFlowers(tiles: { x: number; y: number }[]) {
    if (!tiles.length) return;
    this.addInstanced(new THREE.ConeGeometry(0.07, 0.3, 5), this.mats.rune, tiles.length * 3, (i, dummy) => {
      const t = tiles[Math.floor(i / 3)];
      dummy.position.set(t.x + 0.25 + (i % 3) * 0.24, 0.16, t.y + 0.3 + this.rnd() * 0.4);
      dummy.rotation.y = this.rnd() * 6;
      dummy.scale.setScalar(0.7 + this.rnd() * 0.6);
    });
  }

  private buildProps(tiles: Record<string, { x: number; y: number; ch: string }[]>) {
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
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.8, 6), this.mats.stoneDark);
    base.position.y = 0.4;
    base.castShadow = true;
    root.add(base);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.18, 8), this.mats.metal);
    bowl.position.y = 0.86;
    root.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 7), this.mats.flame);
    flame.position.y = 1.22;
    root.add(flame);
    let light: THREE.PointLight | null = null;
    if (this.stage.quality === 'high' && this.flames.length < 6) {
      light = new THREE.PointLight(0xffa64d, 2.4, 7, 2);
      light.position.y = 1.3;
      root.add(light);
    }
    this.root.add(root);
    this.flames.push({ mesh: flame, light, phase: this.rnd() * 6 });
  }

  private buildRune(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 8), this.mats.stone);
    base.position.y = 0.11;
    root.add(base);
    const coreMat = this.mats.stoneDark.clone();
    coreMat.userData.dynamic = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), coreMat);
    coreMat.emissive = new THREE.Color(0x1c2b35);
    core.position.y = 0.92;
    core.castShadow = true;
    root.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 6, 24), this.mats.metal);
    ring.position.y = 0.92;
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const def = this.zone.runes.find((r) => r.x === x && r.y === y);
    if (def) this.runeIds.set(key(x, y), def.id);
    let light: THREE.PointLight | null = null;
    if (this.stage.quality === 'high' && def) {
      light = new THREE.PointLight(0x8dffd8, 0, 5, 2);
      light.position.y = 1.1;
      root.add(light);
    }
    this.root.add(root);
    this.runes.set(key(x, y), { root, core, light });
  }

  private buildPortal(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 24, Math.PI * 1.6), this.mats.marble);
    arch.position.y = 1.3;
    arch.rotation.z = Math.PI * 0.2;
    arch.castShadow = true;
    root.add(arch);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.58, 24), this.mats.portal);
    disc.position.y = 1.22;
    root.add(disc);
    const light = new THREE.PointLight(0xb38bff, 1.6, 6, 2);
    light.position.y = 1.3;
    if (this.stage.quality === 'high') root.add(light);
    this.root.add(root);
  }

  private buildChest(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.5), this.mats.wood);
    body.position.y = 0.28;
    body.castShadow = true;
    root.add(body);
    const lid = new THREE.Group();
    lid.position.set(0, 0.49, -0.25);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.52), this.mats.wood);
    lidMesh.position.z = 0.25;
    lid.add(lidMesh);
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.08), this.mats.gold));
    root.add(lid);
    this.root.add(root);
    this.chests.set(key(x, y), { root, lid });
  }

  private buildTablet(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.14), this.mats.marble);
    slab.position.y = 0.62;
    slab.rotation.x = -0.22;
    slab.castShadow = true;
    root.add(slab);
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.02), this.mats.rune);
    glyph.position.set(0, 0.78, 0.09);
    root.add(glyph);
    this.root.add(root);
  }

  private buildSwitch(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.1, 6), this.mats.stone);
    pillar.position.y = 0.55;
    pillar.castShadow = true;
    root.add(pillar);
    const coreMat = this.mats.stoneDark.clone();
    coreMat.userData.dynamic = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), coreMat);
    coreMat.emissive = new THREE.Color(0x111820);
    core.position.y = 1.22;
    root.add(core);
    this.root.add(root);
    const id = this.zone.mechanisms.flatMap((m) => m.switches).find((s) => s.x === x && s.y === y)?.id;
    if (id) this.switches.set(id, { root, core });
  }

  private buildShrine(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.2, 8), this.mats.marble);
    base.position.y = 0.1;
    root.add(base);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), this.mats.rune);
    crystal.position.y = 0.85;
    root.add(crystal);
    const light = new THREE.PointLight(0x8dffd8, 1.5, 5, 2);
    light.position.y = 0.9;
    if (this.stage.quality === 'high') root.add(light);
    this.root.add(root);
  }

  private buildGate(x: number, y: number, type: 'D' | 'g') {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.0, 0.32), this.mats.marble);
      post.position.set(side * 0.42, 1.0, 0);
      post.castShadow = true;
      root.add(post);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.8, 0.22), this.mats.stoneDark);
    slab.position.y = 0.95;
    slab.castShadow = true;
    slab.name = 'slab';
    root.add(slab);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 20), type === 'g' ? this.mats.gold : this.mats.rune);
    seal.position.set(0, 1.1, 0.14);
    seal.name = 'seal';
    root.add(seal);
    this.root.add(root);
    this.gates.set(key(x, y), root);
  }

  private buildStairs(x: number, y: number) {
    const root = new THREE.Group();
    root.position.set(x + 0.5, 0, y + 0.5);
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.22), this.mats.marble);
      step.position.set(0, 0.05 + i * 0.13, -0.33 + i * 0.22);
      root.add(step);
    }
    this.root.add(root);
  }

  private buildZoneSignature() {
    if (this.zoneId === 'ciudad') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.16, 8, 48), this.mats.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(23.5, 0.12, 10.5);
      this.root.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), this.mats.marble);
        marker.position.set(23.5 + Math.cos(a) * 4.4, 0.4, 10.5 + Math.sin(a) * 4.4);
        marker.rotation.y = -a;
        marker.castShadow = true;
        this.root.add(marker);
      }
    }
    if (this.zoneId === 'llanura') {
      for (let i = 0; i < 5; i++) {
        const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 4), this.mats.marble);
        obelisk.position.set(5 + i * 5, 1.2, 4 + (i % 2) * 12);
        obelisk.rotation.y = Math.PI / 4;
        obelisk.castShadow = true;
        this.root.add(obelisk);
      }
    }
    if (this.zoneId === 'templo' || this.zoneId === 'cartesia') {
      for (let i = 0; i < 4; i++) {
        const statue = new THREE.Group();
        statue.position.set(6 + i * 6, 0, i % 2 ? 3 : 17);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), this.mats.stone);
        plinth.position.y = 0.2;
        statue.add(plinth);
        const figure = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.2, 6), this.mats.marble);
        figure.position.y = 1.0;
        figure.castShadow = true;
        statue.add(figure);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), this.mats.marble);
        head.position.y = 1.72;
        statue.add(head);
        this.root.add(statue);
      }
    }
    if (this.zoneId === 'valle') {
      for (let i = 0; i < 18; i++) {
        const reed = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9, 4), this.mats.leaf);
        reed.position.set(2 + this.rnd() * 28, 0.45, 4 + this.rnd() * 12);
        reed.rotation.z = (this.rnd() - 0.5) * 0.4;
        this.root.add(reed);
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

  sync(snapshot: WorldSnapshot) {
    const time = snapshot.time;
    const p = snapshot.player;
    this.hero.root.position.x = p.x;
    this.hero.root.position.z = p.y;
    this.hero.root.rotation.y = Math.atan2(p.facingX, p.facingY);
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
    if (this.waterMesh) {
      const mat = this.mats.water;
      if (mat.map) {
        mat.map.offset.x = t * 0.035;
        mat.map.offset.y = Math.sin(t * 0.4) * 0.05;
      }
      mat.emissiveIntensity = 0.28 + Math.sin(t * 1.2) * 0.08;
    }
    this.flames.forEach((f, i) => {
      const wave = Math.sin(t * 7 + f.phase + i) * 0.12;
      f.mesh.scale.set(1 + wave, 1 + wave * 1.8, 1 + wave);
      f.mesh.rotation.y = t * 1.4 + i;
      if (f.light) f.light.intensity = 2.0 + Math.sin(t * 9 + i) * 0.35;
    });
    if (time >= this.nextFire && this.flames.length) {
      this.nextFire = time + 160;
      const f = this.flames[Math.floor(this.rnd() * this.flames.length)];
      const p = new THREE.Vector3();
      f.mesh.getWorldPosition(p);
      this.spawnParticles(p.x, p.z, 0xffa64d, this.stage.quality === 'high' ? 4 : 2, 0.12, 0.5, 520, 0.85, p.y);
    }
    this.runes.forEach((r) => r.root.rotation.y = Math.sin(t * 0.6) * 0.08);
    this.lensGrid.position.y = 0.16 + Math.sin(t * 2) * 0.02;
  }

  private updateCamera(dt: number, time: number) {
    let targetX = this.hero.root.position.x;
    let targetZ = this.hero.root.position.z;
    if (this.cinematicTarget && time < this.cinematicTarget.until) {
      targetX = THREE.MathUtils.lerp(targetX, this.cinematicTarget.x, 0.55);
      targetZ = THREE.MathUtils.lerp(targetZ, this.cinematicTarget.z, 0.55);
    } else this.cinematicTarget = null;
    const clampedX = THREE.MathUtils.clamp(targetX, 5, MAP_W - 5);
    const clampedZ = THREE.MathUtils.clamp(targetZ, 4, MAP_H - 4);
    this.cameraTarget.x += (clampedX - this.cameraTarget.x) * (1 - Math.exp(-dt * 3.4));
    this.cameraTarget.z += (clampedZ - this.cameraTarget.z) * (1 - Math.exp(-dt * 3.4));
    const { width, height } = this.stage.size;
    const portrait = height > width * 1.08;
    const short = height <= 520;
    const distance = portrait ? 33 : short ? 25 : width <= 720 ? 30 : 27;
    const cam = this.stage.camera;
    cam.position.set(this.cameraTarget.x + distance * 0.56, distance * 0.76, this.cameraTarget.z + distance * 0.56);
    if (this.cameraShake > 0.001) {
      cam.position.x += (this.rnd() - 0.5) * this.cameraShake;
      cam.position.y += (this.rnd() - 0.5) * this.cameraShake * 0.6;
      cam.position.z += (this.rnd() - 0.5) * this.cameraShake;
      this.cameraShake *= Math.exp(-dt * 9);
    } else this.cameraShake = 0;
    cam.lookAt(this.cameraTarget.x, 1.0, this.cameraTarget.z);
    this.stage.sun.position.set(this.cameraTarget.x - 12, 22, this.cameraTarget.z + 9);
    this.stage.sun.target.position.set(this.cameraTarget.x, 0, this.cameraTarget.z);
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
