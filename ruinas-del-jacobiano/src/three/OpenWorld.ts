import * as THREE from 'three';
import type { Stage } from './stage';
import type { MaterialSet } from './materials';

const CHUNK_SIZE = 16;
const VERT_SCALE = 1.1;
const WATER_LEVEL = 2.6;
const LOAD_DISTANCE_CHUNKS = 5;
const UNLOAD_DISTANCE_CHUNKS = 7;

const hash2 = (ix: number, iz: number, seed: number): number => {
  let h = 2166136261 ^ seed;
  h = Math.imul(h ^ ix, 16777619);
  h = Math.imul(h ^ iz, 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const noise2 = (x: number, z: number, seed: number): number => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const wx = fx * fx * (3 - 2 * fx);
  const wz = fz * fz * (3 - 2 * fz);
  const h00 = hash2(ix, iz, seed);
  const h10 = hash2(ix + 1, iz, seed);
  const h01 = hash2(ix, iz + 1, seed);
  const h11 = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(h00, h10, wx), lerp(h01, h11, wx), wz);
};

const heightAt = (x: number, z: number, seed: number): number => {
  let h = 0;
  let amp = 1;
  let freq = 0.055;
  let maxAmp = 0;
  for (let o = 0; o < 5; o++) {
    h += noise2(x * freq, z * freq, seed + o * 977 + o) * amp;
    maxAmp += amp;
    amp *= 0.52;
    freq *= 2.05;
  }
  h /= maxAmp;
  const mountains = h > 0.62 ? Math.pow((h - 0.62) / 0.38, 1.8) * 22 : 0;
  const hills = h > 0.34 ? Math.pow((h - 0.34) / 0.28, 1.6) * 7 : 0;
  const valleys = h < 0.22 ? -Math.pow((0.22 - h) / 0.22, 1.8) * 3.5 : 0;
  return mountains + hills + valleys;
};

const shared = <T extends THREE.BufferGeometry>(geo: T): T => {
  geo.userData.shared = true;
  return geo;
};

function grassGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const start = positions.length / 3;
    positions.push(-dx * 0.03, 0, -dz * 0.03);
    positions.push(dx * 0.03, 0, dz * 0.03);
    positions.push(dx * 0.012, 0.3, dz * 0.012);
    indices.push(start, start + 1, start + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return shared(geo);
}

function terrainGeometry(originX: number, originZ: number, seed: number, segments: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
  const pos = geo.getAttribute('position');
  const colors: number[] = [];
  const color = new THREE.Color();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sz = pos.getY(i);
    const x = originX + sx;
    const z = originZ + sz;
    const h = heightAt(x, z, seed) * VERT_SCALE;
    pos.setXYZ(i, sx, h, sz);
    if (h < minY) minY = h;
    if (h > maxY) maxY = h;
    const t = Math.min(1, Math.max(0, (h + 3) / 26));
    color.setHSL(0.36 - t * 0.22, 0.55, 0.22 + t * 0.5);
    colors.push(color.r, color.g, color.b);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  (geo as any).userData = { ...geo.userData, minY, maxY };
  return geo;
}

function segmentForDistance(d: number): number {
  if (d < 22) return 8;
  if (d < 44) return 4;
  return 2;
}

interface ChunkData {
  mesh: THREE.Mesh;
  material: THREE.Material;
  collider: THREE.Box3;
  cx: number;
  cz: number;
  segments: number;
  instanced: THREE.InstancedMesh[];
  dispose(): void;
}

export class OpenWorldManager {
  readonly root = new THREE.Group();
  private chunks = new Map<string, ChunkData>();
  private mats: MaterialSet;
  private quality: 'high' | 'low';
  private seed: number;
  private geoTrunk: THREE.BufferGeometry;
  private geoCrown: THREE.BufferGeometry;
  private geoRock: THREE.BufferGeometry;
  private geoGrass: THREE.BufferGeometry;

  constructor(stage: Stage, mats: MaterialSet, options: { seed: number; quality: 'high' | 'low' }) {
    this.mats = mats;
    this.quality = options.quality;
    this.seed = options.seed;
    this.root.name = 'open-world';
    this.geoTrunk = shared(new THREE.CylinderGeometry(0.14, 0.24, 1.5, 7, 2));
    this.geoCrown = shared(new THREE.IcosahedronGeometry(1, 0));
    this.geoRock = shared(new THREE.DodecahedronGeometry(0.55, 0));
    this.geoGrass = grassGeometry();
    stage.scene.add(this.root);
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private seededForChunk(cx: number, cz: number): () => number {
    const base = hash2(cx, cz, this.seed);
    let s = (base * 2654435761) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  private sampleHeights(originX: number, originZ: number, count = 5): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= count; i++) {
      for (let j = 0; j <= count; j++) {
        const x = originX + (i / count) * CHUNK_SIZE;
        const z = originZ + (j / count) * CHUNK_SIZE;
        const h = heightAt(x, z, this.seed) * VERT_SCALE;
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
    return { min, max };
  }

  private addInstanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    shadows: boolean
  ): THREE.InstancedMesh | null {
    if (matrices.length === 0) return null;
    const inst = new THREE.InstancedMesh(geometry, material, matrices.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < matrices.length; i++) {
      dummy.matrix.copy(matrices[i]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = shadows && this.quality === 'high';
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    this.root.add(inst);
    return inst;
  }

  private createChunk(cx: number, cz: number, cameraX: number, cameraZ: number): ChunkData | null {
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    const dx = originX + CHUNK_SIZE / 2 - cameraX;
    const dz = originZ + CHUNK_SIZE / 2 - cameraZ;
    const dist = Math.hypot(dx, dz);
    const segments = segmentForDistance(dist);
    const geo = terrainGeometry(originX, originZ, this.seed, segments);
    const material = this.mats.earth.clone();
    material.vertexColors = true;
    material.userData.dynamic = true;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(0, 0, 0);
    mesh.castShadow = this.quality === 'high';
    mesh.receiveShadow = true;
    this.root.add(mesh);
    const { min: minY, max: maxY } = this.sampleHeights(originX, originZ);
    const collider = new THREE.Box3(
      new THREE.Vector3(originX, minY - 1, originZ),
      new THREE.Vector3(originX + CHUNK_SIZE, maxY + 2, originZ + CHUNK_SIZE)
    );
    const instanced: THREE.InstancedMesh[] = [];
    const rnd = this.seededForChunk(cx, cz);
    const trunkMatrices: THREE.Matrix4[] = [];
    const crownMatrices: THREE.Matrix4[] = [];
    const trunkCount = this.quality === 'high' ? 10 : 5;
    const crownCount = trunkCount;
    for (let i = 0; i < trunkCount; i++) {
      const lx = rnd() * CHUNK_SIZE;
      const lz = rnd() * CHUNK_SIZE;
      const h = heightAt(originX + lx, originZ + lz, this.seed) * VERT_SCALE;
      if (h > WATER_LEVEL + 0.8 && h < 24) {
        const th = 1.4 + rnd() * 1.6;
        const tr = new THREE.Object3D();
        tr.position.set(lx, h + th / 2, lz);
        tr.scale.set(0.75 + rnd() * 0.55, th, 0.75 + rnd() * 0.55);
        tr.rotation.y = rnd() * Math.PI * 2;
        tr.updateMatrix();
        trunkMatrices.push(tr.matrix);
        const cr = new THREE.Object3D();
        cr.position.set(lx, h + th + 0.35, lz);
        cr.scale.setScalar(0.85 + rnd() * 0.7);
        cr.updateMatrix();
        crownMatrices.push(cr.matrix);
      }
    }
    const trunkInst = this.addInstanced(this.geoTrunk, this.mats.bark, trunkMatrices, true);
    if (trunkInst) instanced.push(trunkInst);
    const crownInst = this.addInstanced(this.geoCrown, this.mats.leafLight, crownMatrices, true);
    if (crownInst) instanced.push(crownInst);

    const rockMatrices: THREE.Matrix4[] = [];
    const rockCount = this.quality === 'high' ? 6 : 3;
    for (let i = 0; i < rockCount; i++) {
      const lx = rnd() * CHUNK_SIZE;
      const lz = rnd() * CHUNK_SIZE;
      const h = heightAt(originX + lx, originZ + lz, this.seed) * VERT_SCALE;
      if (h > WATER_LEVEL + 0.2 && h < 20) {
        const s = 0.7 + rnd() * 0.9;
        const rk = new THREE.Object3D();
        rk.position.set(lx, h + s * 0.3, lz);
        rk.scale.set(s, s * (0.6 + rnd() * 0.6), s);
        rk.rotation.set(rnd(), rnd() * 6, rnd());
        rk.updateMatrix();
        rockMatrices.push(rk.matrix);
      }
    }
    const rockInst = this.addInstanced(this.geoRock, this.mats.stoneWorn, rockMatrices, true);
    if (rockInst) instanced.push(rockInst);

    const grassMatrices: THREE.Matrix4[] = [];
    const grassCount = this.quality === 'high' ? 28 : 12;
    for (let i = 0; i < grassCount; i++) {
      const lx = rnd() * CHUNK_SIZE;
      const lz = rnd() * CHUNK_SIZE;
      const h = heightAt(originX + lx, originZ + lz, this.seed) * VERT_SCALE;
      if (h > WATER_LEVEL - 0.5 && h < 14) {
        const gr = new THREE.Object3D();
        gr.position.set(lx, h + 0.04, lz);
        gr.scale.setScalar(0.7 + rnd() * 0.7);
        gr.rotation.y = rnd() * Math.PI * 2;
        gr.updateMatrix();
        grassMatrices.push(gr.matrix);
      }
    }
    const grassMat = this.mats.leafLight.clone();
    grassMat.userData.dynamic = true;
    grassMat.side = THREE.DoubleSide;
    const grassInst = this.addInstanced(this.geoGrass, grassMat, grassMatrices, false);
    if (grassInst) instanced.push(grassInst);

    const chunk: ChunkData = {
      mesh,
      material,
      collider,
      cx,
      cz,
      segments,
      instanced,
      dispose: () => {
        if (!geo.userData.shared) geo.dispose();
        material.dispose();
        instanced.forEach((inst) => {
          if (!inst.geometry.userData.shared) inst.geometry.dispose();
          const mats = Array.isArray(inst.material) ? inst.material : [inst.material];
          mats.forEach((mat) => {
            if (mat.userData.dynamic) mat.dispose();
          });
          inst.removeFromParent();
        });
        mesh.removeFromParent();
      },
    };
    this.chunks.set(this.chunkKey(cx, cz), chunk);
    return chunk;
  }

  private unloadChunk(key: string) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.dispose();
      this.chunks.delete(key);
    }
  }

  update(delta: number, player: { x: number; z: number }, camera: { x: number; z: number }): void {
    const cx = Math.floor(player.x / CHUNK_SIZE);
    const cz = Math.floor(player.z / CHUNK_SIZE);
    const toLoad: string[] = [];
    for (let dy = -LOAD_DISTANCE_CHUNKS; dy <= LOAD_DISTANCE_CHUNKS; dy++) {
      for (let dx = -LOAD_DISTANCE_CHUNKS; dx <= LOAD_DISTANCE_CHUNKS; dx++) {
        const key = this.chunkKey(cx + dx, cz + dy);
        if (!this.chunks.has(key)) toLoad.push(key);
      }
    }
    for (const key of toLoad) {
      const [sx, sz] = key.split(',').map(Number);
      this.createChunk(sx, sz, camera.x, camera.z);
    }
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2 - camera.x;
      const dz = chunk.cz * CHUNK_SIZE + CHUNK_SIZE / 2 - camera.z;
      const dist = Math.hypot(dx, dz);
      if (dist > UNLOAD_DISTANCE_CHUNKS * CHUNK_SIZE) {
        this.unloadChunk(key);
      } else {
        const segments = segmentForDistance(dist);
        if (segments !== chunk.segments && chunk.mesh) {
          const originX = chunk.cx * CHUNK_SIZE;
          const originZ = chunk.cz * CHUNK_SIZE;
          const geo = terrainGeometry(originX, originZ, this.seed, segments);
          const oldGeo = chunk.mesh.geometry;
          chunk.mesh.geometry = geo;
          chunk.segments = segments;
          if (!oldGeo.userData.shared) oldGeo.dispose();
        }
      }
    }
  }

  getHeight(x: number, z: number): number {
    return heightAt(x, z, this.seed) * VERT_SCALE;
  }

  getColliders(): THREE.Box3[] {
    return Array.from(this.chunks.values()).map((c) => c.collider);
  }

  dispose(): void {
    this.chunks.forEach((chunk) => chunk.dispose());
    this.chunks.clear();
    this.root.removeFromParent();
  }
}
