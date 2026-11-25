import * as THREE from 'three';
import type { MaterialSet } from './materials';
import type { EnemyKind } from '../data/types';

export type BossKind = 'guardian' | 'sentinel' | 'colossus' | 'singular';

export interface CharacterRig {
  root: THREE.Group;
  bones: Record<string, THREE.Bone>;
  skeleton: THREE.Skeleton;
  kind: string;
  height: number;
  hover: number;
}

export interface RigMotion {
  time: number;
  pose: string;
  speed: number;
  hurt: boolean;
  dead: boolean;
  phase: number;
}

const geoSphere = new THREE.SphereGeometry(1, 12, 9);
const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const geoTaper = new THREE.CylinderGeometry(0.7, 1, 1, 10);
const geoCone = new THREE.ConeGeometry(1, 1, 9);
const geoDodeca = new THREE.DodecahedronGeometry(1, 0);
const geoOcta = new THREE.OctahedronGeometry(1, 0);
const geoTetra = new THREE.TetrahedronGeometry(1, 0);
const geoTorus = new THREE.TorusGeometry(1, 0.08, 6, 20);
const geoIco = new THREE.IcosahedronGeometry(1, 1);

[geoSphere, geoBox, geoCyl, geoTaper, geoCone, geoDodeca, geoOcta, geoTetra, geoTorus, geoIco].forEach((g) => {
  g.userData.shared = true;
});

const dynamic = <T extends THREE.Material>(material: T): T => {
  material.userData.dynamic = true;
  return material;
};

const tinted = (material: THREE.Material, color: number): THREE.MeshStandardMaterial => {
  const copy = (material as THREE.MeshStandardMaterial).clone();
  copy.color.setHex(color);
  copy.userData.dynamic = true;
  return copy;
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function bone(parent: THREE.Object3D, name: string, x: number, y: number, z: number) {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  b.userData.basePosition = b.position.clone();
  parent.add(b);
  return b;
}

function finalize(root: THREE.Group, bones: Record<string, THREE.Bone>, kind: string, height: number, hover = 0): CharacterRig {
  root.updateMatrixWorld(true);
  return { root, bones, skeleton: new THREE.Skeleton(Object.values(bones)), kind, height, hover };
}

function addShadow(rig: CharacterRig, mats: MaterialSet, radius: number) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mats.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.renderOrder = 1;
  rig.root.add(shadow);
}

function eyes(parent: THREE.Object3D, mats: MaterialSet, y: number, z: number, spacing: number, glow = false) {
  const mat = glow ? mats.rune : mats.void;
  parent.add(mesh(geoSphere, mat, -spacing, y, z, 0.022, 0.026, 0.014));
  parent.add(mesh(geoSphere, mat, spacing, y, z, 0.022, 0.026, 0.014));
  if (!glow) {
    parent.add(mesh(geoBox, mats.void, -spacing, y + 0.045, z - 0.004, 0.06, 0.012, 0.012));
    parent.add(mesh(geoBox, mats.void, spacing, y + 0.045, z - 0.004, 0.06, 0.012, 0.012));
  }
}

function cape(parent: THREE.Object3D, mat: THREE.Material, height: number, width: number) {
  for (let i = -1; i <= 1; i++) {
    const panel = mesh(geoTaper, mat, i * width * 0.36, -height * 0.42, i === 0 ? -0.02 : -0.04, width * 0.3, height * 0.86, 0.035);
    panel.rotation.z = i * 0.12;
    parent.add(panel);
  }
  parent.add(mesh(geoSphere, mat, 0, 0.02, -0.08, width * 0.42, height * 0.12, 0.06));
}

function weapon(parent: THREE.Object3D, mats: MaterialSet, kind: 'sword' | 'bow' | 'spear' | 'staff', h: number) {
  if (kind === 'sword') {
    const blade = mesh(geoBox, mats.metal, 0, -h * 0.34, 0, h * 0.035, h * 0.56, h * 0.018);
    parent.add(blade);
    parent.add(mesh(geoBox, mats.gold, 0, -h * 0.06, 0, h * 0.2, h * 0.025, h * 0.04));
    parent.add(mesh(geoCyl, mats.cloth, 0, -h * 0.015, 0, h * 0.022, h * 0.1, h * 0.022));
    parent.add(mesh(geoSphere, mats.gold, 0, h * 0.04, 0, h * 0.045, h * 0.045, h * 0.045));
    parent.add(mesh(geoOcta, mats.rune, 0, -h * 0.06, h * 0.03, h * 0.026, h * 0.03, h * 0.02));
    return;
  }
  if (kind === 'spear') {
    parent.add(mesh(geoCyl, mats.wood, 0, -h * 0.42, 0, h * 0.018, h * 0.92, h * 0.018));
    parent.add(mesh(geoCone, mats.metal, 0, h * 0.12, 0, h * 0.055, h * 0.24, h * 0.055));
    parent.add(mesh(geoTorus, mats.gold, 0, h * 0.0, 0, h * 0.045, h * 0.045, h * 0.045));
    return;
  }
  if (kind === 'bow') {
    const bow = mesh(geoTorus, mats.wood, 0, -h * 0.22, h * 0.1, h * 0.2, h * 0.3, h * 0.2);
    bow.rotation.y = Math.PI / 2;
    parent.add(bow);
    parent.add(mesh(geoCyl, mats.metal, 0, -h * 0.22, h * 0.21, h * 0.006, h * 0.58, h * 0.006));
    return;
  }
  parent.add(mesh(geoCyl, mats.wood, 0, -h * 0.42, 0, h * 0.022, h * 0.94, h * 0.022));
  parent.add(mesh(geoOcta, mats.rune, 0, -h * 0.92, 0, h * 0.08, h * 0.11, h * 0.08));
  const ring = mesh(geoTorus, mats.gold, 0, -h * 0.86, 0, h * 0.1, h * 0.1, h * 0.1);
  ring.rotation.x = Math.PI / 2;
  parent.add(ring);
}

function accessory(parent: THREE.Object3D, mats: MaterialSet, type: string, h: number) {
  const has = (token: string) => type.includes(token);
  if (has('wideHat')) {
    parent.add(mesh(geoCyl, mats.cloth, 0, h * 0.1, 0, h * 0.29, h * 0.025, h * 0.26));
    parent.add(mesh(geoCone, mats.cloth, 0, h * 0.18, 0, h * 0.15, h * 0.2, h * 0.15));
  } else if (has('hood')) {
    const hood = mesh(geoCone, mats.cloth, 0, h * 0.06, -h * 0.02, h * 0.17, h * 0.26, h * 0.15);
    hood.rotation.x = -0.16;
    parent.add(hood);
  } else if (has('hat')) {
    parent.add(mesh(geoCyl, mats.cloth, 0, h * 0.13, 0, h * 0.16, h * 0.1, h * 0.16));
    parent.add(mesh(geoTorus, mats.gold, 0, h * 0.08, 0, h * 0.2, h * 0.2, h * 0.2));
  }
  if (has('goggles')) {
    for (const side of [-1, 1]) {
      const lens = mesh(geoTorus, mats.metal, side * h * 0.05, h * 0.03, h * 0.12, h * 0.045, h * 0.045, h * 0.045);
      lens.rotation.x = Math.PI / 2;
      parent.add(lens);
      parent.add(mesh(geoCyl, mats.crystal, side * h * 0.05, h * 0.03, h * 0.12, h * 0.035, h * 0.01, h * 0.035));
    }
    parent.add(mesh(geoBox, mats.wood, 0, h * 0.04, -h * 0.02, h * 0.28, h * 0.03, h * 0.04));
  }
  if (has('scarf')) {
    const scarf = mesh(geoTorus, mats.cloth, 0, -h * 0.03, 0, h * 0.14, h * 0.14, h * 0.14);
    scarf.rotation.x = Math.PI / 2;
    parent.add(scarf);
    parent.add(mesh(geoBox, mats.cloth, h * 0.12, -h * 0.12, -h * 0.1, h * 0.06, h * 0.24, h * 0.02));
  }
  if (has('crown')) {
    const band = mesh(geoTorus, mats.gold, 0, h * 0.14, 0, h * 0.16, h * 0.16, h * 0.16);
    band.rotation.x = Math.PI / 2;
    parent.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parent.add(mesh(geoCone, mats.gold, Math.cos(a) * h * 0.15, h * 0.2, Math.sin(a) * h * 0.15, h * 0.025, h * 0.09, h * 0.025));
    }
  }
  if (has('plume')) {
    const plume = mesh(geoCone, mats.cloth, 0, h * 0.22, -h * 0.02, h * 0.05, h * 0.24, h * 0.05);
    plume.rotation.z = 0.35;
    parent.add(plume);
  }
  if (has('visor')) {
    parent.add(mesh(geoBox, mats.metal, 0, h * 0.03, h * 0.11, h * 0.28, h * 0.07, h * 0.035));
    parent.add(mesh(geoBox, mats.void, 0, h * 0.03, h * 0.13, h * 0.22, h * 0.025, h * 0.015));
  }
  if (has('satchel')) {
    parent.add(mesh(geoBox, mats.wood, h * 0.22, -h * 0.15, h * 0.08, h * 0.16, h * 0.18, h * 0.09));
    const strap = mesh(geoTorus, mats.cloth, 0, h * 0.04, 0, h * 0.23, h * 0.29, h * 0.23);
    strap.rotation.y = 0.4;
    parent.add(strap);
  }
}

interface HumanoidOptions {
  kind: string;
  height: number;
  body: THREE.Material;
  trim: THREE.Material;
  skin: THREE.Material;
  weapon?: 'sword' | 'bow' | 'spear' | 'staff' | null;
  shield?: boolean;
  cloak?: boolean;
  hover?: number;
  accessory?: string;
  build?: 'slim' | 'normal' | 'stout';
}

function humanoid(mats: MaterialSet, options: HumanoidOptions): CharacterRig {
  const h = options.height;
  const girth = options.build === 'stout' ? 1.22 : options.build === 'slim' ? 0.88 : 1;
  const root = new THREE.Group();
  const hips = bone(root, 'hips', 0, h * 0.5, 0);
  const torso = bone(hips, 'torso', 0, h * 0.14, 0);
  const head = bone(torso, 'head', 0, h * 0.3, 0);
  const armL = bone(torso, 'armL', -h * 0.21 * girth, h * 0.18, 0);
  const armR = bone(torso, 'armR', h * 0.21 * girth, h * 0.18, 0);
  const legL = bone(hips, 'legL', -h * 0.09 * girth, 0, 0);
  const legR = bone(hips, 'legR', h * 0.09 * girth, 0, 0);
  const weaponBone = bone(armR, 'weapon', 0, -h * 0.28, h * 0.02);
  const cloakBone = bone(torso, 'cloak', 0, h * 0.08, -h * 0.1);
  const hairBone = bone(head, 'hair', 0, h * 0.08, 0);

  torso.add(mesh(geoTaper, options.body, 0, 0, 0, h * 0.18 * girth, h * 0.32, h * 0.12 * girth));
  torso.add(mesh(geoBox, options.trim, 0, h * 0.08, h * 0.105 * girth, h * 0.3 * girth, h * 0.055, h * 0.045));
  torso.add(mesh(geoBox, mats.cloth, 0, -h * 0.07, h * 0.115 * girth, h * 0.22 * girth, h * 0.16, h * 0.025));
  torso.add(mesh(geoSphere, options.trim, -h * 0.19 * girth, h * 0.14, 0, h * 0.085, h * 0.07, h * 0.1));
  torso.add(mesh(geoSphere, options.trim, h * 0.19 * girth, h * 0.14, 0, h * 0.085, h * 0.07, h * 0.1));

  head.add(mesh(geoSphere, options.skin, 0, 0, 0, h * 0.125, h * 0.145, h * 0.115));
  const nose = mesh(geoCone, options.skin, 0, -h * 0.02, h * 0.112, h * 0.028, h * 0.06, h * 0.028);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  eyes(head, mats, h * 0.025, h * 0.107, h * 0.045);
  head.add(mesh(geoBox, mats.stoneDark, 0, -h * 0.055, h * 0.108, h * 0.06, h * 0.012, h * 0.012));
  hairBone.add(mesh(geoSphere, mats.cloth, 0, h * 0.04, -h * 0.01, h * 0.135, h * 0.08, h * 0.125));
  hairBone.add(mesh(geoBox, mats.cloth, -h * 0.09, h * 0.01, h * 0.03, h * 0.05, h * 0.12, h * 0.09));
  hairBone.add(mesh(geoBox, mats.cloth, h * 0.09, h * 0.01, h * 0.03, h * 0.05, h * 0.12, h * 0.09));
  if (options.accessory) accessory(head, mats, options.accessory, h);

  for (const side of [-1, 1]) {
    const arm = side < 0 ? armL : armR;
    arm.add(mesh(geoTaper, options.body, 0, -h * 0.095, 0, h * 0.065, h * 0.2, h * 0.065));
    arm.add(mesh(geoCyl, options.skin, 0, -h * 0.22, 0, h * 0.048, h * 0.12, h * 0.048));
    arm.add(mesh(geoSphere, options.trim, 0, -h * 0.02, 0, h * 0.085, h * 0.07, h * 0.09));
    arm.add(mesh(geoSphere, options.skin, 0, -h * 0.29, h * 0.01, h * 0.06, h * 0.055, h * 0.055));
  }
  for (const side of [-1, 1]) {
    const leg = side < 0 ? legL : legR;
    leg.add(mesh(geoTaper, mats.cloth, 0, -h * 0.13, 0, h * 0.082 * girth, h * 0.28, h * 0.082 * girth));
    leg.add(mesh(geoCyl, mats.cloth, 0, -h * 0.31, 0, h * 0.065, h * 0.18, h * 0.065));
    leg.add(mesh(geoBox, mats.stoneDark, 0, -h * 0.44, h * 0.035, h * 0.12, h * 0.08, h * 0.2));
    leg.add(mesh(geoBox, options.trim, 0, -h * 0.47, h * 0.08, h * 0.125, h * 0.025, h * 0.22));
  }

  if (options.cloak) cape(cloakBone, options.trim, h * 0.62, h * 0.34);
  if (options.shield) {
    const shield = mesh(geoCyl, mats.metal, -h * 0.06, -h * 0.2, h * 0.14, h * 0.19, h * 0.035, h * 0.26);
    shield.rotation.x = Math.PI / 2;
    armL.add(shield);
    armL.add(mesh(geoTorus, mats.gold, -h * 0.06, -h * 0.2, h * 0.16, h * 0.19, h * 0.24, h * 0.19));
    armL.add(mesh(geoSphere, mats.gold, -h * 0.06, -h * 0.2, h * 0.18, h * 0.06, h * 0.06, h * 0.035));
  }
  if (options.weapon) weapon(weaponBone, mats, options.weapon, h);

  const rig = finalize(root, {
    hips, torso, head, armL, armR, legL, legR, weapon: weaponBone, cloak: cloakBone, hair: hairBone,
  }, options.kind, h, options.hover ?? 0);
  addShadow(rig, mats, h * 0.3);
  return rig;
}

export function createHeroRig(mats: MaterialSet): CharacterRig {
  return humanoid(mats, {
    kind: 'hero',
    height: 1.76,
    body: mats.cloth,
    trim: mats.gold,
    skin: dynamic(new THREE.MeshStandardMaterial({ color: 0xd9a97f, roughness: 0.88 })),
    weapon: 'sword',
    cloak: true,
    accessory: 'scarf',
    build: 'slim',
  });
}

export function createNpcRig(npc: string, mats: MaterialSet): CharacterRig {
  const tint: Record<string, number> = {
    anciana: 0xb388c9,
    fubini: 0x4f8fd8,
    guardiana: 0x4fbfa2,
    cartografa: 0x9d6bd6,
    sabio: 0x6f9fe0,
    errante: 0xd49a5b,
    recaudador: 0x78a6c9,
  };
  const accessories: Record<string, string> = {
    anciana: 'hood',
    fubini: 'goggles',
    guardiana: 'visor',
    cartografa: 'wideHat',
    sabio: 'hat',
    errante: 'hood',
    recaudador: 'hat',
  };
  const color = tint[npc] ?? 0x8f89a8;
  return humanoid(mats, {
    kind: 'npc',
    height: npc === 'sabio' ? 1.74 : 1.66,
    body: tinted(mats.cloth, color),
    trim: npc === 'guardiana' ? mats.metal : mats.gold,
    skin: tinted(mats.marble, npc === 'anciana' ? 0xd2ab91 : 0xe0b590),
    weapon: npc === 'guardiana' ? 'sword' : npc === 'sabio' || npc === 'fubini' ? 'staff' : null,
    shield: npc === 'guardiana',
    cloak: npc === 'anciana' || npc === 'errante',
    accessory: npc === 'recaudador' || npc === 'cartografa' || npc === 'fubini' ? `${accessories[npc] ?? ''} satchel` : accessories[npc] ?? '',
    build: npc === 'anciana' ? 'stout' : 'normal',
  });
}

export function createEnemyRig(kind: EnemyKind, mats: MaterialSet): CharacterRig {
  if (kind === 'espino') {
    const root = new THREE.Group();
    const body = bone(root, 'body', 0, 0.58, 0);
    const bark = tinted(mats.bark, 0x6f5436);
    const thorn = tinted(mats.leafDark, 0x4d7b3f);
    body.add(mesh(geoDodeca, bark, 0, 0, 0, 0.5, 0.4, 0.58));
    body.add(mesh(geoIco, thorn, 0, 0.22, 0.08, 0.42, 0.32, 0.4));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spike = mesh(geoCone, thorn, Math.cos(a) * 0.4, 0.16 + (i % 3) * 0.09, Math.sin(a) * 0.4, 0.1, 0.5, 0.1);
      spike.rotation.z = Math.cos(a) * 0.62;
      spike.rotation.x = -Math.sin(a) * 0.62;
      body.add(spike);
    }
    eyes(body, mats, 0.02, 0.5, 0.16, true);
    const legs: Record<string, THREE.Bone> = { body };
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const leg = bone(body, `leg${i}`, Math.cos(a) * 0.32, -0.18, Math.sin(a) * 0.32);
      leg.add(mesh(geoCyl, bark, 0, -0.2, 0, 0.075, 0.42, 0.075));
      const claw = mesh(geoCone, mats.stoneDark, 0, -0.43, 0.06, 0.08, 0.18, 0.08);
      claw.rotation.x = Math.PI / 2.3;
      leg.add(claw);
      legs[`leg${i}`] = leg;
    }
    const rig = finalize(root, legs, kind, 1.1);
    addShadow(rig, mats, 0.55);
    return rig;
  }
  if (kind === 'sombra' || kind === 'espiritu') {
    const root = new THREE.Group();
    const hips = bone(root, 'hips', 0, 0.85, 0);
    const torso = bone(hips, 'torso', 0, 0.16, 0);
    const head = bone(torso, 'head', 0, 0.44, 0);
    const robe = kind === 'sombra' ? tinted(mats.void, 0x161226) : tinted(mats.cloth, 0x5e88c9);
    for (let i = 0; i < 3; i++) {
      const layer = mesh(geoCone, i === 1 ? mats.cloth : robe, 0, -0.16 - i * 0.12, 0, 0.46 - i * 0.07, 1.05 - i * 0.18, 0.4 - i * 0.06);
      torso.add(layer);
    }
    head.add(mesh(geoDodeca, robe, 0, 0, 0, 0.25, 0.3, 0.23));
    head.add(mesh(geoBox, mats.marble, 0, -0.02, 0.2, 0.3, 0.22, 0.04));
    eyes(head, mats, 0.03, 0.23, 0.09, true);
    const armL = bone(torso, 'armL', -0.34, 0.16, 0);
    const armR = bone(torso, 'armR', 0.34, 0.16, 0);
    for (const arm of [armL, armR]) {
      arm.add(mesh(geoCone, robe, 0, -0.3, 0, 0.13, 0.68, 0.13));
      arm.add(mesh(geoSphere, mats.rune, 0, -0.66, 0.03, 0.07, 0.07, 0.07));
    }
    const rig = finalize(root, { hips, torso, head, armL, armR }, kind, 1.55, kind === 'espiritu' ? 0.24 : 0.1);
    addShadow(rig, mats, 0.42);
    return rig;
  }
  const enemyStyle: Record<string, { body: number; trim: number; accessory?: string; weapon?: 'sword' | 'bow' | 'spear' | 'staff' }> = {
    centinela: { body: 0x69748a, trim: 0xc7a24a, accessory: 'visor', weapon: 'sword' },
    arquero: { body: 0x6d5636, trim: 0x9d7c45, accessory: 'hood', weapon: 'bow' },
    sombra: { body: 0x2a2442, trim: 0x8f7bc7 },
    espiritu: { body: 0x5e88c9, trim: 0x9fd8ff },
    espino: { body: 0x6f5436, trim: 0x4d7b3f },
  };
  const style = enemyStyle[kind] ?? { body: 0x5b5668, trim: 0x9a8d70 };
  return humanoid(mats, {
    kind,
    height: kind === 'centinela' ? 1.94 : 1.66,
    body: tinted(mats.stoneDark, style.body),
    trim: tinted(mats.metal, style.trim),
    skin: tinted(mats.marble, 0xbfae9b),
    weapon: style.weapon,
    shield: kind === 'centinela',
    accessory: style.accessory,
    build: kind === 'centinela' ? 'stout' : 'normal',
  });
}

export function createBossRig(kind: BossKind, mats: MaterialSet): CharacterRig {
  if (kind === 'guardian') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.42, 0);
    const stone = tinted(mats.stone, 0x8c8579);
    const dark = tinted(mats.stoneDark, 0x4a4655);
    core.add(mesh(geoDodeca, stone, 0, 0, 0, 1.0, 0.82, 0.72));
    core.add(mesh(geoBox, mats.marble, 0, 0.64, 0, 1.25, 0.46, 0.86));
    core.add(mesh(geoBox, mats.rune, 0, 0.06, 0.67, 0.42, 0.28, 0.08));
    for (const side of [-1, 1]) {
      core.add(mesh(geoDodeca, dark, side * 0.78, 0.42, 0, 0.52, 0.36, 0.56));
      const eye = mesh(geoOcta, mats.rune, side * 0.28, 0.7, 0.44, 0.11, 0.09, 0.06);
      core.add(eye);
    }
    const armL = bone(core, 'armL', -1.05, 0.2, 0);
    const armR = bone(core, 'armR', 1.05, 0.2, 0);
    const legL = bone(core, 'legL', -0.42, -0.62, 0);
    const legR = bone(core, 'legR', 0.42, -0.62, 0);
    for (const arm of [armL, armR]) {
      arm.add(mesh(geoBox, dark, 0, -0.48, 0, 0.48, 1.15, 0.48));
      arm.add(mesh(geoDodeca, stone, 0, -1.1, 0, 0.42, 0.36, 0.42));
    }
    for (const leg of [legL, legR]) {
      leg.add(mesh(geoBox, stone, 0, -0.42, 0, 0.5, 0.92, 0.5));
      leg.add(mesh(geoBox, dark, 0, -0.92, 0.08, 0.54, 0.18, 0.66));
    }
    const rig = finalize(root, { core, armL, armR, legL, legR }, kind, 3.0);
    addShadow(rig, mats, 1.25);
    return rig;
  }
  if (kind === 'colossus') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.75, 0);
    const body = tinted(mats.marble, 0xc4b49b);
    core.add(mesh(geoIco, body, 0, 0, 0, 0.86, 1.08, 0.7));
    core.add(mesh(geoOcta, mats.rune, 0, 0.2, 0.68, 0.26, 0.34, 0.14));
    for (let i = 0; i < 4; i++) {
      const ring = mesh(geoTorus, i % 2 ? mats.gold : mats.marble, 0, 0, 0, 1.15 + i * 0.24, 1.15 + i * 0.24, 1);
      ring.rotation.x = Math.PI / 2 + i * 0.38;
      ring.rotation.y = i * 0.7;
      core.add(ring);
    }
    const armL = bone(core, 'armL', -1.0, 0.3, 0);
    const armR = bone(core, 'armR', 1.0, 0.3, 0);
    for (const arm of [armL, armR]) {
      arm.add(mesh(geoTaper, body, 0, -0.75, 0, 0.26, 1.7, 0.26));
      arm.add(mesh(geoDodeca, mats.stone, 0, -1.62, 0, 0.34, 0.32, 0.34));
    }
    const rig = finalize(root, { core, armL, armR }, kind, 3.5, 0.28);
    addShadow(rig, mats, 1.3);
    return rig;
  }
  if (kind === 'singular') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.7, 0);
    const voidMat = tinted(mats.void, 0x0b0818);
    core.add(mesh(geoCone, voidMat, 0, -0.12, 0, 0.92, 2.8, 0.74));
    core.add(mesh(geoSphere, voidMat, 0, 1.05, 0, 0.44, 0.52, 0.42));
    core.add(mesh(geoBox, mats.marble, 0, 1.02, 0.4, 0.42, 0.5, 0.05));
    eyes(core, mats, 1.12, 0.45, 0.12, true);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(geoTorus, i === 1 ? mats.portal : mats.rune, 0, 1.0, 0, 0.68 + i * 0.2, 0.68 + i * 0.2, 1);
      ring.rotation.x = Math.PI / 2 + i * 0.5;
      ring.rotation.y = i * 0.8;
      core.add(ring);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const shard = mesh(geoTetra, i % 2 ? mats.rune : mats.crystal, Math.cos(a) * 1.25, 0.15 + (i % 3) * 0.52, Math.sin(a) * 1.25, 0.14, 0.22, 0.14);
      shard.rotation.set(a, a * 1.7, a);
      core.add(shard);
    }
    const armL = bone(core, 'armL', -0.75, 0.6, 0);
    const armR = bone(core, 'armR', 0.75, 0.6, 0);
    for (const arm of [armL, armR]) {
      arm.add(mesh(geoCone, voidMat, 0, -0.72, 0, 0.22, 1.5, 0.22));
      arm.add(mesh(geoOcta, mats.rune, 0, -1.5, 0, 0.16, 0.2, 0.16));
    }
    const rig = finalize(root, { core, armL, armR }, kind, 3.7, 0.32);
    addShadow(rig, mats, 1.15);
    return rig;
  }
  const rig = humanoid(mats, {
    kind,
    height: 3.05,
    body: tinted(mats.metal, 0x6f7890),
    trim: mats.gold,
    skin: tinted(mats.stone, 0xa89b85),
    weapon: 'spear',
    shield: true,
    cloak: true,
    accessory: 'plume',
    build: 'stout',
  });
  const horns = bone(rig.bones.head, 'horns', 0, 0.16, 0);
  horns.add(mesh(geoCone, mats.gold, -0.25, 0.18, 0, 0.09, 0.46, 0.09));
  horns.add(mesh(geoCone, mats.gold, 0.25, 0.18, 0, 0.09, 0.46, 0.09));
  rig.bones.horns = horns;
  return rig;
}

export function animateRig(rig: CharacterRig, motion: RigMotion) {
  const bones = rig.bones;
  Object.values(bones).forEach((b) => {
    b.rotation.set(0, 0, 0);
    const base = b.userData.basePosition as THREE.Vector3 | undefined;
    if (base) b.position.copy(base);
  });
  const t = motion.time / 1000;
  const fast = motion.speed > 4.3;
  const gait = fast ? 11.5 : 8.2;
  const swing = Math.sin(t * gait) * Math.min(1.05, 0.28 + motion.speed * 0.13);
  const breathe = Math.sin(t * 1.9) * 0.022;
  const airborne = rig.kind === 'espiritu' || rig.kind === 'sombra' || rig.kind === 'colossus' || rig.kind === 'singular';
  rig.root.position.y = rig.hover + Math.sin(t * (airborne ? 1.6 : 2.2)) * (airborne ? 0.13 : 0.018);

  if (motion.dead) {
    if (bones.hips) bones.hips.rotation.x = -1.35;
    if (bones.torso) bones.torso.rotation.z = 0.52;
    if (bones.head) bones.head.rotation.x = 0.72;
    if (bones.core) bones.core.rotation.z = 0.85;
    if (bones.armL) bones.armL.rotation.z = -0.7;
    if (bones.armR) bones.armR.rotation.z = 0.7;
    rig.root.position.y = Math.max(0.015, rig.root.position.y - 0.6);
    return;
  }

  if (bones.hips) bones.hips.position.y += breathe * rig.height * 0.12;
  if (bones.torso) {
    bones.torso.rotation.y = Math.sin(t * 1.4) * 0.055;
    bones.torso.rotation.x = breathe * 0.5;
  }
  if (bones.head) {
    bones.head.rotation.y = Math.sin(t * 0.95) * 0.09;
    bones.head.rotation.z = Math.sin(t * 0.7) * 0.035;
  }
  if (bones.hair) bones.hair.rotation.z = Math.sin(t * 1.7) * 0.045;

  if (motion.pose === 'walk' || motion.pose === 'run') {
    if (bones.legL) bones.legL.rotation.x = swing;
    if (bones.legR) bones.legR.rotation.x = -swing;
    if (bones.armL) bones.armL.rotation.x = -swing * 0.8;
    if (bones.armR) bones.armR.rotation.x = swing * 0.8;
    if (bones.torso) bones.torso.rotation.x = fast ? 0.2 : 0.09;
    if (bones.weapon) bones.weapon.rotation.z = Math.sin(t * gait + 0.6) * 0.18;
    rig.root.position.y += Math.abs(Math.sin(t * gait)) * (fast ? 0.075 : 0.03);
  } else if (motion.pose === 'attack') {
    const p = Math.min(1, Math.max(0, motion.phase));
    const windup = p < 0.35 ? p / 0.35 : 1;
    const strike = p > 0.35 ? (p - 0.35) / 0.65 : 0;
    if (bones.torso) bones.torso.rotation.y = -0.72 * windup + strike * 1.65;
    if (bones.armR) bones.armR.rotation.x = -1.65 * windup + strike * 2.65;
    if (bones.armL) bones.armL.rotation.x = -0.55 * windup + strike * 0.4;
    if (bones.weapon) bones.weapon.rotation.z = -0.55 * windup + strike * 1.45;
    if (bones.legR) bones.legR.rotation.x = 0.3 * windup;
    if (bones.legL) bones.legL.rotation.x = -0.2 * strike;
  } else if (motion.pose === 'dodge') {
    if (bones.hips) {
      bones.hips.rotation.x = -0.85;
      bones.hips.position.y -= rig.height * 0.16;
    }
    if (bones.torso) bones.torso.rotation.z = 0.42;
    if (bones.armL) bones.armL.rotation.x = -1.2;
    if (bones.armR) bones.armR.rotation.x = -1.2;
    if (bones.legL) bones.legL.rotation.x = 0.9;
    if (bones.legR) bones.legR.rotation.x = 0.65;
  } else if (motion.pose === 'guard') {
    if (bones.hips) bones.hips.position.y -= rig.height * 0.05;
    if (bones.armL) bones.armL.rotation.x = -1.35;
    if (bones.armR) bones.armR.rotation.x = -1.15;
    if (bones.torso) bones.torso.rotation.x = 0.16;
    if (bones.legL) bones.legL.rotation.x = 0.24;
    if (bones.legR) bones.legR.rotation.x = -0.18;
  } else if (motion.pose === 'hurt') {
    if (bones.torso) bones.torso.rotation.x = -0.55;
    if (bones.head) bones.head.rotation.x = 0.48;
    if (bones.armL) bones.armL.rotation.z = -0.75;
    if (bones.armR) bones.armR.rotation.z = 0.75;
    rig.root.position.y -= 0.04;
  } else if (motion.pose === 'interact') {
    const a = Math.sin(Math.min(1, Math.max(0, motion.phase)) * Math.PI);
    if (bones.armR) bones.armR.rotation.x = -1.5 * a;
    if (bones.armL) bones.armL.rotation.x = -0.6 * a;
    if (bones.torso) bones.torso.rotation.x = 0.22 * a;
  } else if (motion.pose === 'pickup') {
    const a = Math.sin(Math.min(1, Math.max(0, motion.phase)) * Math.PI);
    if (bones.hips) bones.hips.position.y -= rig.height * 0.16 * a;
    if (bones.armL) bones.armL.rotation.x = -1.2 * a;
    if (bones.armR) bones.armR.rotation.x = -1.2 * a;
    if (bones.torso) bones.torso.rotation.x = 0.58 * a;
    if (bones.legL) bones.legL.rotation.x = 0.5 * a;
    if (bones.legR) bones.legR.rotation.x = 0.5 * a;
  } else if (rig.kind === 'espino') {
    Object.entries(bones).forEach(([name, b], i) => {
      if (name.startsWith('leg')) b.rotation.z = Math.sin(t * 6 + i * 1.4) * 0.34;
    });
    rig.root.position.y += Math.abs(Math.sin(t * 5)) * 0.05;
  } else if (rig.kind === 'guardian' || rig.kind === 'colossus' || rig.kind === 'singular') {
    if (bones.core) {
      bones.core.rotation.y = Math.sin(t * 0.85) * 0.14;
      bones.core.rotation.z = Math.sin(t * 0.55) * 0.05;
    }
    if (bones.armL) bones.armL.rotation.x = Math.sin(t * 1.3) * 0.26;
    if (bones.armR) bones.armR.rotation.x = -Math.sin(t * 1.3) * 0.26;
    if (bones.legL) bones.legL.rotation.x = Math.sin(t * 0.9) * 0.06;
    if (bones.legR) bones.legR.rotation.x = -Math.sin(t * 0.9) * 0.06;
  }

  if (motion.hurt) {
    if (bones.torso) bones.torso.rotation.z += Math.sin(t * 48) * 0.09;
    if (bones.head) bones.head.rotation.z += Math.sin(t * 52) * 0.05;
  }
  if (bones.cloak) {
    bones.cloak.rotation.x = Math.sin(t * 2.7) * 0.1 + Math.min(0.42, motion.speed * 0.045);
    bones.cloak.rotation.z = Math.sin(t * 1.8) * 0.06;
  }
  if (bones.weapon && motion.pose !== 'attack') {
    bones.weapon.rotation.x = Math.sin(t * 1.6) * 0.04;
  }
}
