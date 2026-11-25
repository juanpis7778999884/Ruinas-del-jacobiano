import * as THREE from 'three';
import { MAP_H, MAP_W } from '../config';
import type { ZoneDef } from '../data/zones';
import type { ZoneId } from '../data/types';
import type { MaterialSet } from './materials';

export interface SceneryTile {
  x: number;
  y: number;
  ch?: string;
}

interface Swayer {
  object: THREE.Object3D;
  phase: number;
  amount: number;
}

const shared = <T extends THREE.BufferGeometry>(geo: T): T => {
  geo.userData.shared = true;
  return geo;
};

function slabGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = [
    [-0.47, -0.42], [-0.5, -0.1], [-0.42, 0.46], [0.1, 0.5],
    [0.47, 0.41], [0.5, -0.18], [0.36, -0.48], [-0.19, -0.5],
  ];
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return shared(geo);
}

function blockGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = [
    [-0.48, -0.46], [-0.5, 0.12], [-0.39, 0.49], [0.18, 0.5],
    [0.49, 0.35], [0.47, -0.31], [0.3, -0.49], [-0.24, -0.5],
  ];
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 1,
    steps: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return shared(geo);
}

function rockGeometry(seed: number): THREE.BufferGeometry {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const geo = new THREE.DodecahedronGeometry(0.42, 0);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bulge = 0.76 + rnd() * 0.56;
    pos.setXYZ(i, x * bulge, y * bulge * (0.72 + rnd() * 0.4), z * bulge);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return shared(geo);
}

function grassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const start = positions.length / 3;
    positions.push(-dx * 0.035, 0, -dz * 0.035);
    positions.push(dx * 0.035, 0, dz * 0.035);
    positions.push(dx * 0.012, 0.34, dz * 0.012);
    indices.push(start, start + 1, start + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return shared(geo);
}

const geo = {
  slab: slabGeometry(),
  block: blockGeometry(),
  cap: shared(new THREE.BoxGeometry(0.72, 0.16, 0.72)),
  water: shared(new THREE.BoxGeometry(0.99, 0.1, 0.99)),
  ripple: shared(new THREE.TorusGeometry(0.3, 0.012, 4, 18).rotateX(-Math.PI / 2)),
  plank: shared(new THREE.BoxGeometry(0.94, 0.1, 0.28)),
  rail: shared(new THREE.BoxGeometry(0.08, 0.46, 0.08)),
  column: shared(new THREE.CylinderGeometry(0.22, 0.29, 2.2, 12)),
  columnBand: shared(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12)),
  torus: shared(new THREE.TorusGeometry(0.38, 0.045, 6, 20)),
  trunk: shared(new THREE.CylinderGeometry(0.13, 0.22, 1, 7, 2)),
  branch: shared(new THREE.CylinderGeometry(1, 1, 1, 5)),
  crown: shared(new THREE.IcosahedronGeometry(1, 1)),
  crownLow: shared(new THREE.IcosahedronGeometry(1, 0)),
  cypress: shared(new THREE.ConeGeometry(1, 1, 7)),
  vine: shared(new THREE.CylinderGeometry(0.018, 0.028, 1, 4)),
  grass: grassGeometry(),
  fern: shared(new THREE.ConeGeometry(0.075, 0.5, 4)),
  pebble: shared(new THREE.DodecahedronGeometry(0.12, 0)),
  rockA: rockGeometry(17),
  rockB: rockGeometry(43),
  rockC: rockGeometry(91),
  shaft: shared(new THREE.ConeGeometry(1, 1, 12, 1, true)),
  spire: shared(new THREE.ConeGeometry(1, 1, 5)),
  marker: shared(new THREE.BoxGeometry(1, 1, 1)),
};

const skyPalettes: Record<ZoneDef['ambience'], { top: number; bottom: number; haze: number; shaft: number }> = {
  town: { top: 0x3d5b8c, bottom: 0xd2b98d, haze: 0x857f9d, shaft: 0xffe2a8 },
  grove: { top: 0x214a42, bottom: 0x8fc39b, haze: 0x537a65, shaft: 0xc7ffd2 },
  river: { top: 0x214d68, bottom: 0xa5cede, haze: 0x4c7992, shaft: 0xbfe9ff },
  city: { top: 0x3d2f52, bottom: 0xd8a45c, haze: 0x6c5c7d, shaft: 0xffd27a },
  sanctum: { top: 0x181034, bottom: 0x8a63c8, haze: 0x46376f, shaft: 0xd8b1ff },
};

const up = new THREE.Vector3(0, 1, 0);

export class Scenery {
  readonly root = new THREE.Group();
  private mats: MaterialSet;
  private rnd: () => number;
  private quality: 'high' | 'low';
  private zoneId: ZoneId;
  private ambience: ZoneDef['ambience'];
  private swayers: Swayer[] = [];
  private rippleMaterial: THREE.MeshBasicMaterial | null = null;
  private shaftMaterials: THREE.MeshBasicMaterial[] = [];
  private sky: THREE.Mesh | null = null;
  private grassMaterial: THREE.MeshStandardMaterial;

  constructor(parent: THREE.Object3D, mats: MaterialSet, options: {
    zoneId: ZoneId;
    ambience: ZoneDef['ambience'];
    tileset: ZoneDef['tileset'];
    quality: 'high' | 'low';
    seed: number;
  }) {
    this.mats = mats;
    this.quality = options.quality;
    this.zoneId = options.zoneId;
    this.ambience = options.ambience;
    let state = options.seed >>> 0;
    this.rnd = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    this.root.name = 'scenery';
    parent.add(this.root);
    this.grassMaterial = mats.leafLight.clone();
    this.grassMaterial.side = THREE.DoubleSide;
    this.grassMaterial.userData.dynamic = true;
  }

  private addInstanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    place: (index: number, dummy: THREE.Object3D) => void,
    color?: (index: number) => THREE.Color,
    shadows = true,
  ) {
    if (count <= 0) return null;
    const inst = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      place(i, dummy);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (color) inst.setColorAt(i, color(i));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = shadows && this.quality === 'high';
    inst.receiveShadow = shadows;
    inst.computeBoundingSphere();
    this.root.add(inst);
    return inst;
  }

  private branch(parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    const mesh = new THREE.Mesh(geo.branch, material);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    mesh.scale.set(radius, length, radius);
    mesh.castShadow = this.quality === 'high';
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private tilePosition(tile: SceneryTile, dummy: THREE.Object3D, y: number) {
    dummy.position.set(tile.x + 0.5, y, tile.y + 0.5);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
  }

  buildAtmosphere() {
    const palette = skyPalettes[this.ambience];
    const skyGeo = new THREE.SphereGeometry(110, 20, 12);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(palette.top) },
        uBottom: { value: new THREE.Color(palette.bottom) },
        uHaze: { value: new THREE.Color(palette.haze) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uHaze;
        varying vec3 vWorld;
        void main() {
          float h = clamp((normalize(vWorld).y + 0.25) * 0.85, 0.0, 1.0);
          vec3 color = mix(uBottom, uTop, pow(h, 0.72));
          color = mix(color, uHaze, smoothstep(0.1, 0.0, h) * 0.35);
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    skyMat.userData.dynamic = true;
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(MAP_W / 2, 0, MAP_H / 2);
    sky.renderOrder = -100;
    sky.frustumCulled = false;
    this.root.add(sky);
    this.sky = sky;

    const silhouettes = this.zoneId === 'cartesia' || this.zoneId === 'ciudad' || this.zoneId === 'templo' ? 18 : 12;
    const center = new THREE.Vector3(MAP_W / 2, 0, MAP_H / 2);
    for (let i = 0; i < silhouettes; i++) {
      const angle = (i / silhouettes) * Math.PI * 2 + this.rnd() * 0.18;
      const radius = 44 + this.rnd() * 16;
      const height = 5 + this.rnd() * 11;
      const mesh = new THREE.Mesh(geo.spire, this.zoneId === 'cartesia' ? this.mats.stoneWorn : this.mats.stoneDark);
      mesh.position.set(center.x + Math.cos(angle) * radius, height / 2 - 1, center.z + Math.sin(angle) * radius);
      mesh.rotation.y = this.rnd() * Math.PI;
      mesh.scale.set(2.5 + this.rnd() * 5, height, 2.5 + this.rnd() * 5);
      this.root.add(mesh);
    }

    if (this.ambience === 'grove' || this.ambience === 'sanctum' || this.zoneId === 'templo') {
      const shaftMat = new THREE.MeshBasicMaterial({
        color: palette.shaft,
        transparent: true,
        opacity: this.ambience === 'sanctum' ? 0.055 : 0.038,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      shaftMat.userData.dynamic = true;
      this.shaftMaterials.push(shaftMat);
      const count = this.quality === 'high' ? 9 : 4;
      for (let i = 0; i < count; i++) {
        const shaft = new THREE.Mesh(geo.shaft, shaftMat);
        shaft.position.set(2 + this.rnd() * (MAP_W - 4), 5.4, 2 + this.rnd() * (MAP_H - 4));
        shaft.rotation.z = (this.rnd() - 0.5) * 0.24;
        shaft.rotation.x = (this.rnd() - 0.5) * 0.2;
        shaft.scale.set(0.9 + this.rnd() * 1.5, 10 + this.rnd() * 4, 0.9 + this.rnd() * 1.5);
        shaft.renderOrder = 3;
        this.root.add(shaft);
      }
    }
  }

  buildGround(ground: SceneryTile[], moss: SceneryTile[], path: SceneryTile[]) {
    const groups = [
      { tiles: ground, material: this.mats.earth },
      { tiles: moss, material: this.mats.moss },
      { tiles: path, material: this.mats.path },
    ];
    if (this.zoneId === 'templo') groups[0].material = this.mats.marble;
    else if (this.zoneId !== 'cartesia') groups[0].material = this.mats.stone;
    if (this.zoneId === 'templo') groups[1].material = this.mats.stoneWorn;
    groups.forEach((group) => {
      this.addInstanced(geo.slab, group.material, group.tiles.length, (i, dummy) => {
        this.tilePosition(group.tiles[i], dummy, -0.055);
        dummy.rotation.y = (this.rnd() - 0.5) * 0.035;
        const scale = 0.96 + this.rnd() * 0.06;
        dummy.scale.set(scale, 0.9 + this.rnd() * 0.25, scale);
      }, () => {
        const v = 0.72 + this.rnd() * 0.33;
        return new THREE.Color(v, v * (0.96 + this.rnd() * 0.07), v * (0.9 + this.rnd() * 0.12));
      });
    });

    const detailTiles = [...ground, ...moss].filter(() => this.rnd() > 0.86);
    this.addInstanced(geo.pebble, this.mats.stoneWorn, detailTiles.length, (i, dummy) => {
      const t = detailTiles[i];
      dummy.position.set(t.x + 0.18 + this.rnd() * 0.64, 0.06, t.y + 0.18 + this.rnd() * 0.64);
      dummy.rotation.set(this.rnd(), this.rnd() * 6, this.rnd());
      dummy.scale.setScalar(0.6 + this.rnd() * 1.1);
    }, undefined, false);

    const mossPatches = [...ground, ...moss].filter(() => this.rnd() > 0.91);
    this.addInstanced(geo.crownLow, this.mats.moss, mossPatches.length, (i, dummy) => {
      const t = mossPatches[i];
      dummy.position.set(t.x + 0.2 + this.rnd() * 0.6, 0.05, t.y + 0.2 + this.rnd() * 0.6);
      dummy.rotation.set(0, this.rnd() * 6, 0);
      dummy.scale.set(0.14 + this.rnd() * 0.14, 0.025, 0.12 + this.rnd() * 0.12);
    }, undefined, false);
  }

  buildWater(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    this.addInstanced(geo.water, this.mats.water, tiles.length, (i, dummy) => {
      this.tilePosition(tiles[i], dummy, -0.035);
      dummy.rotation.y = (this.rnd() - 0.5) * 0.03;
      dummy.scale.set(1, 1, 1);
    }, () => new THREE.Color(0.7 + this.rnd() * 0.4, 0.82 + this.rnd() * 0.2, 1), false);

    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xb8ecff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    rippleMat.userData.dynamic = true;
    this.rippleMaterial = rippleMat;
    const ripples = tiles.filter(() => this.rnd() > 0.74);
    this.addInstanced(geo.ripple, rippleMat, ripples.length, (i, dummy) => {
      const t = ripples[i];
      dummy.position.set(t.x + 0.25 + this.rnd() * 0.5, 0.025, t.y + 0.25 + this.rnd() * 0.5);
      dummy.rotation.set(0, this.rnd() * 6, 0);
      dummy.scale.setScalar(0.55 + this.rnd() * 0.9);
    }, undefined, false);
  }

  buildBridges(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    this.addInstanced(geo.plank, this.mats.wood, tiles.length * 4, (i, dummy) => {
      const t = tiles[Math.floor(i / 4)];
      dummy.position.set(t.x + 0.5, 0.13 + (i % 4) * 0.012, t.y + 0.13 + (i % 4) * 0.245);
      dummy.rotation.y = (this.rnd() - 0.5) * 0.06;
      dummy.scale.set(1, 1, 0.92 + this.rnd() * 0.14);
    }, (i) => {
      const v = 0.66 + (i % 4) * 0.08 + this.rnd() * 0.12;
      return new THREE.Color(v, v * 0.82, v * 0.6);
    });
    this.addInstanced(geo.rail, this.mats.wood, tiles.length * 2, (i, dummy) => {
      const t = tiles[Math.floor(i / 2)];
      dummy.position.set(t.x + (i % 2 ? 0.92 : 0.08), 0.38, t.y + 0.5);
      dummy.rotation.set(0, 0, (this.rnd() - 0.5) * 0.05);
      dummy.scale.set(1, 1, 1);
    });
  }

  buildWalls(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    this.addInstanced(geo.block, this.mats.stoneWorn, tiles.length, (i, dummy) => {
      const t = tiles[i];
      this.tilePosition(t, dummy, 0);
      dummy.rotation.y = (this.rnd() - 0.5) * 0.1;
      dummy.scale.set(0.96 + this.rnd() * 0.08, 0.78 + this.rnd() * 0.46, 0.96 + this.rnd() * 0.08);
    }, () => {
      const v = 0.64 + this.rnd() * 0.36;
      return new THREE.Color(v, v * (0.96 + this.rnd() * 0.08), v * (0.9 + this.rnd() * 0.14));
    });

    const caps = tiles.filter((_, i) => i % 3 === 0 || this.rnd() > 0.8);
    this.addInstanced(geo.cap, this.mats.stoneDark, caps.length, (i, dummy) => {
      const t = caps[i];
      dummy.position.set(t.x + 0.5, 1.08 + this.rnd() * 0.24, t.y + 0.5);
      dummy.rotation.set((this.rnd() - 0.5) * 0.22, this.rnd() * 3, (this.rnd() - 0.5) * 0.22);
      dummy.scale.setScalar(0.72 + this.rnd() * 0.55);
    });

    const creepers = tiles.filter(() => this.rnd() > 0.42);
    this.addInstanced(geo.crownLow, this.mats.moss, creepers.length * 2, (i, dummy) => {
      const t = creepers[Math.floor(i / 2)];
      const side = i % 2 ? 0.48 : -0.48;
      dummy.position.set(t.x + 0.5 + side, 0.35 + this.rnd() * 0.62, t.y + 0.5 + (this.rnd() - 0.5) * 0.6);
      dummy.rotation.set(this.rnd() * 0.6, this.rnd() * 6, this.rnd() * 0.6);
      dummy.scale.set(0.15 + this.rnd() * 0.16, 0.06 + this.rnd() * 0.1, 0.14 + this.rnd() * 0.15);
    }, undefined, false);

    const buttresses = tiles.filter((_, i) => i % 5 === 2);
    this.addInstanced(geo.marker, this.mats.marble, buttresses.length, (i, dummy) => {
      const t = buttresses[i];
      dummy.position.set(t.x + 0.5, 0.48, t.y + 0.5);
      dummy.rotation.y = Math.PI / 4;
      dummy.scale.set(0.24, 0.96, 0.24);
    });
  }

  buildColumns(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    const material = this.zoneId === 'templo' ? this.mats.marble : this.mats.stone;
    this.addInstanced(geo.column, material, tiles.length, (i, dummy) => {
      const t = tiles[i];
      dummy.position.set(t.x + 0.5, 1.12, t.y + 0.5);
      dummy.rotation.set((this.rnd() - 0.5) * 0.024, this.rnd() * 1.2, (this.rnd() - 0.5) * 0.024);
      dummy.scale.set(0.92 + this.rnd() * 0.18, 0.84 + this.rnd() * 0.34, 0.92 + this.rnd() * 0.18);
    });
    this.addInstanced(geo.columnBand, this.mats.marble, tiles.length * 3, (i, dummy) => {
      const t = tiles[Math.floor(i / 3)];
      dummy.position.set(t.x + 0.5, 0.12 + (i % 3) * 1.08, t.y + 0.5);
      dummy.rotation.set(0, this.rnd() * 1.2, 0);
      const s = 0.9 + this.rnd() * 0.2;
      dummy.scale.set(s, 1, s);
    });
    const vines = tiles.filter(() => this.rnd() > 0.55);
    this.addInstanced(geo.torus, this.mats.moss, vines.length, (i, dummy) => {
      const t = vines[i];
      dummy.position.set(t.x + 0.5, 0.5 + this.rnd() * 1.2, t.y + 0.5);
      dummy.rotation.set(Math.PI / 2 + (this.rnd() - 0.5) * 0.4, this.rnd() * 6, this.rnd() * 0.4);
      dummy.scale.setScalar(0.28 + this.rnd() * 0.12);
    }, undefined, false);
  }

  buildRocks(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    const variants = [geo.rockA, geo.rockB, geo.rockC];
    variants.forEach((variant, variantIndex) => {
      const subset = tiles.filter((_, i) => i % 3 === variantIndex);
      this.addInstanced(variant, this.mats.stoneDark, subset.length, (i, dummy) => {
        const t = subset[i];
        dummy.position.set(t.x + 0.5, 0.24 + this.rnd() * 0.1, t.y + 0.5);
        dummy.rotation.set(this.rnd() * 3, this.rnd() * 6, this.rnd() * 3);
        dummy.scale.set(0.82 + this.rnd() * 0.65, 0.65 + this.rnd() * 0.8, 0.82 + this.rnd() * 0.65);
      });
    });
    const mossy = tiles.filter(() => this.rnd() > 0.62);
    this.addInstanced(geo.crownLow, this.mats.moss, mossy.length, (i, dummy) => {
      const t = mossy[i];
      dummy.position.set(t.x + 0.5 + (this.rnd() - 0.5) * 0.3, 0.46 + this.rnd() * 0.16, t.y + 0.5 + (this.rnd() - 0.5) * 0.3);
      dummy.rotation.set(0, this.rnd() * 6, 0);
      dummy.scale.set(0.16 + this.rnd() * 0.16, 0.04, 0.14 + this.rnd() * 0.14);
    }, undefined, false);
  }

  buildTrees(trees: SceneryTile[], bushes: SceneryTile[]) {
    trees.forEach((tile, index) => {
      const species = (index + Math.floor(this.rnd() * 3)) % 3;
      const root = new THREE.Group();
      root.position.set(tile.x + 0.5, 0, tile.y + 0.5);
      root.rotation.y = this.rnd() * Math.PI * 2;
      const scale = 0.82 + this.rnd() * 0.42;
      root.scale.setScalar(scale);
      this.root.add(root);

      const trunkHeight = species === 1 ? 2.8 : 1.9 + this.rnd() * 0.5;
      const trunk = new THREE.Mesh(geo.trunk, this.mats.bark);
      trunk.position.y = trunkHeight / 2;
      trunk.scale.set(0.9 + this.rnd() * 0.4, trunkHeight, 0.9 + this.rnd() * 0.4);
      trunk.rotation.z = species === 2 ? (this.rnd() - 0.5) * 0.24 : (this.rnd() - 0.5) * 0.08;
      trunk.castShadow = this.quality === 'high';
      trunk.receiveShadow = true;
      root.add(trunk);

      const rootCount = this.quality === 'high' ? 5 : 3;
      for (let i = 0; i < rootCount; i++) {
        const a = (i / rootCount) * Math.PI * 2 + this.rnd() * 0.4;
        this.branch(
          root,
          new THREE.Vector3(Math.cos(a) * 0.12, 0.22, Math.sin(a) * 0.12),
          new THREE.Vector3(Math.cos(a) * (0.46 + this.rnd() * 0.24), 0.035, Math.sin(a) * (0.46 + this.rnd() * 0.24)),
          0.055 + this.rnd() * 0.045,
          this.mats.bark,
        );
      }

      const crown = new THREE.Group();
      crown.position.y = trunkHeight;
      root.add(crown);
      if (species === 1) {
        for (let i = 0; i < 3; i++) {
          const cone = new THREE.Mesh(geo.cypress, i % 2 ? this.mats.leafDark : this.mats.leaf);
          cone.position.y = 0.35 + i * 0.62;
          cone.scale.set(0.92 - i * 0.17, 1.35 - i * 0.12, 0.92 - i * 0.17);
          cone.castShadow = this.quality === 'high';
          crown.add(cone);
        }
      } else {
        const branches = species === 2 ? 3 : 4;
        for (let i = 0; i < branches; i++) {
          const a = (i / branches) * Math.PI * 2 + this.rnd() * 0.7;
          const end = new THREE.Vector3(Math.cos(a) * (0.62 + this.rnd() * 0.34), 0.42 + this.rnd() * 0.45, Math.sin(a) * (0.62 + this.rnd() * 0.34));
          this.branch(root, new THREE.Vector3(0, trunkHeight * 0.76, 0), end.clone().add(new THREE.Vector3(0, trunkHeight * 0.24, 0)), 0.055 + this.rnd() * 0.04, this.mats.bark);
          const bunch = new THREE.Mesh(this.quality === 'high' ? geo.crown : geo.crownLow, i % 3 === 0 ? this.mats.leafLight : i % 3 === 1 ? this.mats.leaf : this.mats.leafDark);
          bunch.position.copy(end);
          bunch.scale.set(0.62 + this.rnd() * 0.36, 0.44 + this.rnd() * 0.26, 0.58 + this.rnd() * 0.34);
          bunch.rotation.set(this.rnd() * 0.5, this.rnd() * 6, this.rnd() * 0.5);
          bunch.castShadow = this.quality === 'high';
          crown.add(bunch);
        }
        const top = new THREE.Mesh(this.quality === 'high' ? geo.crown : geo.crownLow, this.mats.leafLight);
        top.position.y = 0.72 + this.rnd() * 0.3;
        top.scale.set(0.76 + this.rnd() * 0.3, 0.55 + this.rnd() * 0.2, 0.72 + this.rnd() * 0.3);
        top.castShadow = this.quality === 'high';
        crown.add(top);
      }

      if (this.quality === 'high' && species !== 1) {
        const vines = 3 + Math.floor(this.rnd() * 3);
        for (let i = 0; i < vines; i++) {
          const a = this.rnd() * Math.PI * 2;
          const length = 0.5 + this.rnd() * 0.85;
          const vine = new THREE.Mesh(geo.vine, this.mats.moss);
          vine.position.set(Math.cos(a) * 0.72, -length / 2 + 0.35, Math.sin(a) * 0.72);
          vine.scale.set(1, length, 1);
          crown.add(vine);
        }
      }
      this.swayers.push({ object: crown, phase: this.rnd() * Math.PI * 2, amount: species === 1 ? 0.018 : 0.045 });
    });

    if (!bushes.length) return;
    this.addInstanced(geo.crownLow, this.mats.leafDark, bushes.length * 2, (i, dummy) => {
      const t = bushes[Math.floor(i / 2)];
      dummy.position.set(t.x + 0.5 + (i % 2 ? 0.2 : -0.18), 0.24 + this.rnd() * 0.12, t.y + 0.5 + (this.rnd() - 0.5) * 0.34);
      dummy.rotation.set(this.rnd() * 0.4, this.rnd() * 6, this.rnd() * 0.4);
      dummy.scale.set(0.32 + this.rnd() * 0.3, 0.22 + this.rnd() * 0.2, 0.3 + this.rnd() * 0.3);
    });
  }

  buildUndergrowth(flora: SceneryTile[], trees: SceneryTile[], bushes: SceneryTile[]) {
    if (!flora.length) return;
    const grassCount = Math.min(flora.length * (this.quality === 'high' ? 8 : 3), this.quality === 'high' ? 900 : 260);
    this.addInstanced(geo.grass, this.grassMaterial, grassCount, (i, dummy) => {
      const t = flora[Math.floor(this.rnd() * flora.length)];
      dummy.position.set(t.x + 0.1 + this.rnd() * 0.8, 0.06, t.y + 0.1 + this.rnd() * 0.8);
      dummy.rotation.set((this.rnd() - 0.5) * 0.35, this.rnd() * Math.PI, (this.rnd() - 0.5) * 0.35);
      const s = 0.55 + this.rnd() * 0.85;
      dummy.scale.set(s, 0.6 + this.rnd() * 0.9, s);
    }, () => {
      const v = 0.72 + this.rnd() * 0.36;
      return new THREE.Color(v, v * (0.9 + this.rnd() * 0.16), v * 0.72);
    }, false);

    const fernTiles = [...trees, ...bushes];
    if (!fernTiles.length) return;
    const perTile = this.quality === 'high' ? 6 : 3;
    this.addInstanced(geo.fern, this.mats.leafDark, fernTiles.length * perTile, (i, dummy) => {
      const t = fernTiles[Math.floor(i / perTile)];
      const a = (i % perTile) * 1.05 + this.rnd() * 0.6;
      dummy.position.set(t.x + 0.5 + Math.cos(a) * (0.45 + this.rnd() * 0.3), 0.2, t.y + 0.5 + Math.sin(a) * (0.45 + this.rnd() * 0.3));
      dummy.rotation.set(Math.cos(a) * 0.75, a, Math.sin(a) * 0.75);
      dummy.scale.set(0.8 + this.rnd() * 0.5, 0.7 + this.rnd() * 0.7, 0.8 + this.rnd() * 0.5);
    }, undefined, false);
  }

  buildFlowers(tiles: SceneryTile[]) {
    if (!tiles.length) return;
    this.addInstanced(geo.fern, this.mats.flower, tiles.length * 3, (i, dummy) => {
      const t = tiles[Math.floor(i / 3)];
      dummy.position.set(t.x + 0.2 + (i % 3) * 0.27, 0.17, t.y + 0.22 + this.rnd() * 0.5);
      dummy.rotation.set((this.rnd() - 0.5) * 0.4, this.rnd() * 6, (this.rnd() - 0.5) * 0.4);
      dummy.scale.setScalar(0.42 + this.rnd() * 0.42);
    }, () => new THREE.Color(0.8 + this.rnd() * 0.4, 0.7 + this.rnd() * 0.5, 0.55 + this.rnd() * 0.5), false);
    this.addInstanced(geo.pebble, this.mats.glow, tiles.length, (i, dummy) => {
      const t = tiles[i];
      dummy.position.set(t.x + 0.5, 0.38, t.y + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.24 + this.rnd() * 0.18);
    }, undefined, false);
  }

  update(t: number) {
    this.swayers.forEach((sway) => {
      sway.object.rotation.z = Math.sin(t * 0.9 + sway.phase) * sway.amount;
      sway.object.rotation.x = Math.cos(t * 0.7 + sway.phase * 1.3) * sway.amount * 0.6;
    });
    if (this.rippleMaterial) this.rippleMaterial.opacity = 0.22 + Math.sin(t * 1.8) * 0.1;
    this.shaftMaterials.forEach((mat, i) => {
      mat.opacity = (this.ambience === 'sanctum' ? 0.05 : 0.035) + Math.sin(t * 0.6 + i) * 0.012;
    });
    if (this.sky) this.sky.rotation.y = t * 0.002;
  }

  dispose() {
    this.grassMaterial.dispose();
    this.rippleMaterial?.dispose();
    this.shaftMaterials.forEach((mat) => mat.dispose());
    if (this.sky) {
      this.sky.geometry.dispose();
      (this.sky.material as THREE.Material).dispose();
    }
    this.root.removeFromParent();
  }
}
