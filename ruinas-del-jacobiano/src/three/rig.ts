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

const geoSphere = new THREE.SphereGeometry(1, 10, 8);
const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 8);
const geoCone = new THREE.ConeGeometry(1, 1, 8);
const geoDodeca = new THREE.DodecahedronGeometry(1, 0);
const geoTorus = new THREE.TorusGeometry(1, 0.08, 6, 18);

[geoSphere, geoBox, geoCyl, geoCone, geoDodeca, geoTorus].forEach((g) => { g.userData.shared = true; });

const dynamic = <T extends THREE.Material>(material: T): T => {
  material.userData.dynamic = true;
  return material;
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
  parent.add(b);
  return b;
}

function finalize(root: THREE.Group, bones: Record<string, THREE.Bone>, kind: string, height: number, hover = 0): CharacterRig {
  root.updateMatrixWorld(true);
  const list = Object.values(bones);
  const skeleton = new THREE.Skeleton(list);
  return { root, bones, skeleton, kind, height, hover };
}

function addShadow(rig: CharacterRig, mats: MaterialSet, radius: number) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 16), mats.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.renderOrder = 1;
  rig.root.add(shadow);
}

function humanoid(mats: MaterialSet, options: {
  kind: string;
  height: number;
  body: THREE.Material;
  trim: THREE.Material;
  skin: THREE.Material;
  weapon?: 'sword' | 'bow' | 'spear' | 'staff' | null;
  shield?: boolean;
  cloak?: boolean;
  hover?: number;
}) {
  const root = new THREE.Group();
  const hips = bone(root, 'hips', 0, options.height * 0.52, 0);
  const torso = bone(hips, 'torso', 0, options.height * 0.16, 0);
  const head = bone(torso, 'head', 0, options.height * 0.31, 0);
  const armL = bone(torso, 'armL', -options.height * 0.2, options.height * 0.19, 0);
  const armR = bone(torso, 'armR', options.height * 0.2, options.height * 0.19, 0);
  const legL = bone(hips, 'legL', -options.height * 0.09, 0, 0);
  const legR = bone(hips, 'legR', options.height * 0.09, 0, 0);
  const weaponBone = bone(armR, 'weapon', 0, -options.height * 0.24, 0.04);
  const cloak = bone(torso, 'cloak', 0, options.height * 0.05, -0.14);

  torso.add(mesh(geoCyl, options.body, 0, 0, 0, options.height * 0.19, options.height * 0.3, options.height * 0.13));
  torso.add(mesh(geoBox, options.trim, 0, options.height * 0.08, 0.11, options.height * 0.32, options.height * 0.07, options.height * 0.06));
  head.add(mesh(geoSphere, options.skin, 0, 0, 0, options.height * 0.14, options.height * 0.16, options.height * 0.13));
  head.add(mesh(geoSphere, mats.cloth, 0, options.height * 0.09, -0.01, options.height * 0.15, options.height * 0.09, options.height * 0.14));
  head.add(mesh(geoBox, options.body, 0, options.height * 0.04, options.height * 0.12, options.height * 0.26, options.height * 0.05, options.height * 0.06));
  armL.add(mesh(geoCyl, options.body, 0, -options.height * 0.17, 0, options.height * 0.065, options.height * 0.2, options.height * 0.065));
  armR.add(mesh(geoCyl, options.body, 0, -options.height * 0.17, 0, options.height * 0.065, options.height * 0.2, options.height * 0.065));
  armL.add(mesh(geoSphere, options.trim, 0, -options.height * 0.03, 0, options.height * 0.09, options.height * 0.07, options.height * 0.09));
  armR.add(mesh(geoSphere, options.trim, 0, -options.height * 0.03, 0, options.height * 0.09, options.height * 0.07, options.height * 0.09));
  legL.add(mesh(geoCyl, mats.cloth, 0, -options.height * 0.2, 0, options.height * 0.08, options.height * 0.23, options.height * 0.08));
  legR.add(mesh(geoCyl, mats.cloth, 0, -options.height * 0.2, 0, options.height * 0.08, options.height * 0.23, options.height * 0.08));
  legL.add(mesh(geoBox, mats.stoneDark, 0, -options.height * 0.43, 0.04, options.height * 0.12, options.height * 0.07, options.height * 0.19));
  legR.add(mesh(geoBox, mats.stoneDark, 0, -options.height * 0.43, 0.04, options.height * 0.12, options.height * 0.07, options.height * 0.19));

  if (options.cloak) cloak.add(mesh(geoCone, options.trim, 0, -options.height * 0.16, 0, options.height * 0.25, options.height * 0.42, options.height * 0.14));
  if (options.shield) armL.add(mesh(geoBox, mats.metal, -0.08, -options.height * 0.18, 0.12, options.height * 0.22, options.height * 0.3, 0.05));

  if (options.weapon === 'sword' || options.weapon === 'spear') {
    const length = options.weapon === 'spear' ? options.height * 0.85 : options.height * 0.5;
    weaponBone.add(mesh(geoBox, mats.metal, 0, -length * 0.5, 0, options.height * 0.035, length, options.height * 0.02));
    weaponBone.add(mesh(geoBox, mats.gold, 0, -0.04, 0, options.height * 0.16, options.height * 0.025, options.height * 0.04));
  } else if (options.weapon === 'bow') {
    const bow = mesh(geoTorus, mats.wood, 0, -options.height * 0.2, 0.1, options.height * 0.18, options.height * 0.28, options.height * 0.18);
    bow.rotation.y = Math.PI / 2;
    weaponBone.add(bow);
  } else if (options.weapon === 'staff') {
    weaponBone.add(mesh(geoCyl, mats.wood, 0, -options.height * 0.4, 0, options.height * 0.025, options.height * 0.9, options.height * 0.025));
    weaponBone.add(mesh(geoDodeca, mats.rune, 0, -options.height * 0.86, 0, options.height * 0.08, options.height * 0.1, options.height * 0.08));
  }

  const rig = finalize(root, { hips, torso, head, armL, armR, legL, legR, weapon: weaponBone, cloak }, options.kind, options.height, options.hover ?? 0);
  addShadow(rig, mats, options.height * 0.28);
  return rig;
}

export function createHeroRig(mats: MaterialSet): CharacterRig {
  return humanoid(mats, {
    kind: 'hero',
    height: 1.72,
    body: mats.cloth,
    trim: mats.gold,
    skin: dynamic(new THREE.MeshStandardMaterial({ color: 0xd9a97f, roughness: 0.9 })),
    weapon: 'sword',
    cloak: true,
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
  const color = tint[npc] ?? 0x8f89a8;
  return humanoid(mats, {
    kind: 'npc',
    height: 1.66,
    body: dynamic(new THREE.MeshStandardMaterial({ color, roughness: 0.88 })),
    trim: mats.metal,
    skin: mats.marble,
    weapon: npc === 'guardiana' ? 'sword' : npc === 'sabio' || npc === 'fubini' ? 'staff' : null,
    cloak: true,
  });
}

export function createEnemyRig(kind: EnemyKind, mats: MaterialSet): CharacterRig {
  if (kind === 'espino') {
    const root = new THREE.Group();
    const body = bone(root, 'body', 0, 0.55, 0);
    body.add(mesh(geoDodeca, mats.bark, 0, 0, 0, 0.48, 0.38, 0.55));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = mesh(geoCone, mats.leaf, Math.cos(a) * 0.36, 0.2, Math.sin(a) * 0.36, 0.1, 0.42, 0.1);
      spike.rotation.z = Math.cos(a) * 0.5;
      spike.rotation.x = -Math.sin(a) * 0.5;
      body.add(spike);
    }
    const legs: Record<string, THREE.Bone> = { body };
    for (let i = 0; i < 4; i++) {
      const leg = bone(body, `leg${i}`, (i % 2 ? 0.3 : -0.3), -0.2, i < 2 ? 0.28 : -0.28);
      leg.add(mesh(geoCyl, mats.bark, 0, -0.18, 0, 0.07, 0.36, 0.07));
      legs[`leg${i}`] = leg;
    }
    const rig = finalize(root, legs, kind, 1.05);
    addShadow(rig, mats, 0.5);
    return rig;
  }
  if (kind === 'sombra' || kind === 'espiritu') {
    const root = new THREE.Group();
    const hips = bone(root, 'hips', 0, 0.8, 0);
    const torso = bone(hips, 'torso', 0, 0.18, 0);
    const head = bone(torso, 'head', 0, 0.42, 0);
    torso.add(mesh(geoCone, kind === 'sombra' ? mats.void : mats.cloth, 0, -0.18, 0, 0.42, 0.95, 0.36));
    head.add(mesh(geoSphere, mats.void, 0, 0, 0, 0.24, 0.28, 0.22));
    head.add(mesh(geoSphere, mats.rune, -0.09, 0.03, 0.18, 0.045, 0.05, 0.03));
    head.add(mesh(geoSphere, mats.rune, 0.09, 0.03, 0.18, 0.045, 0.05, 0.03));
    const armL = bone(torso, 'armL', -0.32, 0.15, 0);
    const armR = bone(torso, 'armR', 0.32, 0.15, 0);
    armL.add(mesh(geoCone, mats.cloth, 0, -0.26, 0, 0.12, 0.6, 0.12));
    armR.add(mesh(geoCone, mats.cloth, 0, -0.26, 0, 0.12, 0.6, 0.12));
    const rig = finalize(root, { hips, torso, head, armL, armR }, kind, 1.5, kind === 'espiritu' ? 0.22 : 0.1);
    addShadow(rig, mats, 0.38);
    return rig;
  }
  return humanoid(mats, {
    kind,
    height: kind === 'centinela' ? 1.9 : 1.62,
    body: kind === 'centinela' ? mats.metal : mats.stoneDark,
    trim: kind === 'arquero' ? mats.wood : mats.gold,
    skin: mats.marble,
    weapon: kind === 'arquero' ? 'bow' : 'sword',
    shield: kind === 'centinela',
  });
}

export function createBossRig(kind: BossKind, mats: MaterialSet): CharacterRig {
  if (kind === 'guardian') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.35, 0);
    core.add(mesh(geoBox, mats.stone, 0, 0, 0, 1.35, 1.05, 0.95));
    core.add(mesh(geoBox, mats.marble, 0, 0.72, 0, 1.0, 0.42, 0.82));
    core.add(mesh(geoBox, mats.rune, 0, 0.08, 0.5, 0.38, 0.24, 0.06));
    const armL = bone(core, 'armL', -0.92, 0.15, 0);
    const armR = bone(core, 'armR', 0.92, 0.15, 0);
    armL.add(mesh(geoBox, mats.stoneDark, 0, -0.55, 0, 0.42, 1.25, 0.42));
    armR.add(mesh(geoBox, mats.stoneDark, 0, -0.55, 0, 0.42, 1.25, 0.42));
    const legL = bone(core, 'legL', -0.4, -0.62, 0);
    const legR = bone(core, 'legR', 0.4, -0.62, 0);
    legL.add(mesh(geoBox, mats.stone, 0, -0.4, 0, 0.45, 0.9, 0.45));
    legR.add(mesh(geoBox, mats.stone, 0, -0.4, 0, 0.45, 0.9, 0.45));
    const rig = finalize(root, { core, armL, armR, legL, legR }, kind, 2.8);
    addShadow(rig, mats, 1.1);
    return rig;
  }
  if (kind === 'colossus') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.7, 0);
    core.add(mesh(geoSphere, mats.stone, 0, 0, 0, 0.8, 1.0, 0.65));
    for (let i = 0; i < 3; i++) {
      const ring = mesh(geoTorus, mats.gold, 0, 0, 0, 1.15 + i * 0.24, 1.15 + i * 0.24, 1);
      ring.rotation.x = Math.PI / 2 + i * 0.4;
      ring.rotation.y = i * 0.7;
      core.add(ring);
    }
    const armL = bone(core, 'armL', -0.95, 0.25, 0);
    const armR = bone(core, 'armR', 0.95, 0.25, 0);
    armL.add(mesh(geoCyl, mats.marble, 0, -0.7, 0, 0.22, 1.6, 0.22));
    armR.add(mesh(geoCyl, mats.marble, 0, -0.7, 0, 0.22, 1.6, 0.22));
    const rig = finalize(root, { core, armL, armR }, kind, 3.4, 0.25);
    addShadow(rig, mats, 1.2);
    return rig;
  }
  if (kind === 'singular') {
    const root = new THREE.Group();
    const core = bone(root, 'core', 0, 1.65, 0);
    core.add(mesh(geoCone, mats.void, 0, -0.15, 0, 0.85, 2.7, 0.7));
    core.add(mesh(geoSphere, mats.void, 0, 1.0, 0, 0.42, 0.5, 0.4));
    core.add(mesh(geoTorus, mats.portal, 0, 1.0, 0, 0.62, 0.62, 1));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      core.add(mesh(geoDodeca, mats.rune, Math.cos(a) * 1.2, 0.2 + (i % 3) * 0.5, Math.sin(a) * 1.2, 0.12, 0.18, 0.12));
    }
    const armL = bone(core, 'armL', -0.7, 0.6, 0);
    const armR = bone(core, 'armR', 0.7, 0.6, 0);
    armL.add(mesh(geoCone, mats.void, 0, -0.7, 0, 0.2, 1.4, 0.2));
    armR.add(mesh(geoCone, mats.void, 0, -0.7, 0, 0.2, 1.4, 0.2));
    const rig = finalize(root, { core, armL, armR }, kind, 3.6, 0.3);
    addShadow(rig, mats, 1.0);
    return rig;
  }
  const rig = humanoid(mats, {
    kind,
    height: 3.0,
    body: mats.metal,
    trim: mats.gold,
    skin: mats.stone,
    weapon: 'spear',
    shield: true,
    cloak: true,
  });
  const horns = bone(rig.bones.head, 'horns', 0, 0.15, 0);
  horns.add(mesh(geoCone, mats.gold, -0.22, 0.18, 0, 0.08, 0.4, 0.08));
  horns.add(mesh(geoCone, mats.gold, 0.22, 0.18, 0, 0.08, 0.4, 0.08));
  rig.bones.horns = horns;
  return rig;
}

export function animateRig(rig: CharacterRig, motion: RigMotion) {
  const bones = rig.bones;
  Object.values(bones).forEach((b) => b.rotation.set(0, 0, 0));
  const t = motion.time / 1000;
  const fast = motion.speed > 4.3;
  const gait = fast ? 11 : 8;
  const swing = Math.sin(t * gait) * Math.min(0.9, 0.25 + motion.speed * 0.12);
  rig.root.position.y = rig.hover + Math.sin(t * 2.2) * (rig.kind === 'espiritu' || rig.kind === 'sombra' ? 0.12 : 0.02);

  if (motion.dead) {
    if (bones.hips) bones.hips.rotation.x = -1.25;
    if (bones.torso) bones.torso.rotation.z = 0.45;
    if (bones.head) bones.head.rotation.x = 0.6;
    rig.root.position.y = Math.max(0.02, rig.root.position.y - 0.55);
    return;
  }

  if (bones.torso) bones.torso.rotation.y = Math.sin(t * 1.6) * 0.05;
  if (bones.head) bones.head.rotation.y = Math.sin(t * 1.1) * 0.08;

  if (motion.pose === 'walk' || motion.pose === 'run') {
    if (bones.legL) bones.legL.rotation.x = swing;
    if (bones.legR) bones.legR.rotation.x = -swing;
    if (bones.armL) bones.armL.rotation.x = -swing * 0.75;
    if (bones.armR) bones.armR.rotation.x = swing * 0.75;
    if (bones.torso) bones.torso.rotation.x = fast ? 0.16 : 0.07;
    rig.root.position.y += Math.abs(Math.sin(t * gait)) * (fast ? 0.06 : 0.025);
  } else if (motion.pose === 'attack') {
    const a = Math.sin(Math.min(1, motion.phase) * Math.PI);
    if (bones.torso) bones.torso.rotation.y = -0.6 + a * 1.4;
    if (bones.armR) bones.armR.rotation.x = -1.5 + a * 2.3;
    if (bones.armL) bones.armL.rotation.x = -0.5;
    if (bones.weapon) bones.weapon.rotation.z = -0.4 + a * 1.1;
  } else if (motion.pose === 'dodge') {
    if (bones.hips) bones.hips.rotation.x = -0.7;
    if (bones.torso) bones.torso.rotation.z = 0.35;
    if (bones.armL) bones.armL.rotation.x = -1.1;
    if (bones.armR) bones.armR.rotation.x = -1.1;
  } else if (motion.pose === 'guard') {
    if (bones.armL) bones.armL.rotation.x = -1.25;
    if (bones.armR) bones.armR.rotation.x = -1.25;
    if (bones.torso) bones.torso.rotation.x = 0.12;
  } else if (motion.pose === 'hurt') {
    if (bones.torso) bones.torso.rotation.x = -0.45;
    if (bones.head) bones.head.rotation.x = 0.4;
    if (bones.armL) bones.armL.rotation.z = -0.6;
    if (bones.armR) bones.armR.rotation.z = 0.6;
  } else if (motion.pose === 'interact') {
    const a = Math.sin(Math.min(1, motion.phase) * Math.PI);
    if (bones.armR) bones.armR.rotation.x = -1.35 * a;
    if (bones.torso) bones.torso.rotation.x = 0.18 * a;
  } else if (motion.pose === 'pickup') {
    const a = Math.sin(Math.min(1, motion.phase) * Math.PI);
    if (bones.hips) bones.hips.position.y = rig.height * 0.52 - 0.28 * a;
    if (bones.armL) bones.armL.rotation.x = -1.0 * a;
    if (bones.armR) bones.armR.rotation.x = -1.0 * a;
    if (bones.torso) bones.torso.rotation.x = 0.5 * a;
  } else if (rig.kind === 'espino') {
    Object.entries(bones).forEach(([name, b], i) => {
      if (name.startsWith('leg')) b.rotation.z = Math.sin(t * 6 + i) * 0.3;
    });
    rig.root.position.y += Math.abs(Math.sin(t * 5)) * 0.04;
  } else if (rig.kind === 'guardian' || rig.kind === 'colossus' || rig.kind === 'singular') {
    if (bones.core) bones.core.rotation.y = Math.sin(t * 0.9) * 0.12;
    if (bones.armL) bones.armL.rotation.x = Math.sin(t * 1.4) * 0.22;
    if (bones.armR) bones.armR.rotation.x = -Math.sin(t * 1.4) * 0.22;
  }

  if (motion.hurt) {
    if (bones.torso) bones.torso.rotation.z += Math.sin(t * 55) * 0.08;
  }
  if (bones.cloak) bones.cloak.rotation.x = Math.sin(t * 3.1) * 0.1 + Math.min(0.4, motion.speed * 0.04);
}
