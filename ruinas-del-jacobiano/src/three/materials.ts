import * as THREE from 'three';

export interface MaterialSet {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  crystal: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  rune: THREE.MeshStandardMaterial;
  flame: THREE.MeshStandardMaterial;
  shadow: THREE.MeshBasicMaterial;
  portal: THREE.MeshStandardMaterial;
  void: THREE.MeshStandardMaterial;
  textures: THREE.Texture[];
}

const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const rgb = (hex: number) => ({
  r: (hex >> 16) & 255,
  g: (hex >> 8) & 255,
  b: hex & 255,
});

function noiseTexture(base: number, accent: number, seed: number, cracks = false, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const a = rgb(base);
  const b = rgb(accent);
  const rnd = rng(seed);
  const cells = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin(x * 0.17 + seed) * 0.14 + Math.cos(y * 0.13 - seed) * 0.12;
      cells[y * size + x] = wave + (rnd() - 0.5) * 0.55;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.max(0, Math.min(1, cells[y * size + x] * 0.5 + 0.5));
      const grain = rnd() * 0.14 - 0.07;
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, a.r + (b.r - a.r) * v + grain * 255));
      img.data[i + 1] = Math.max(0, Math.min(255, a.g + (b.g - a.g) * v + grain * 255));
      img.data[i + 2] = Math.max(0, Math.min(255, a.b + (b.b - a.b) * v + grain * 255));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (cracks) {
    ctx.strokeStyle = 'rgba(18,18,28,0.42)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = rnd() * size;
      let y = rnd() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (rnd() - 0.5) * 24;
        y += (rnd() - 0.5) * 24;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 10; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + rnd() * 18, y - 4 - rnd() * 10);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function waterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#153b61');
  grad.addColorStop(0.5, '#2b6a9c');
  grad.addColorStop(1, '#123456');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const rnd = rng(7717);
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(180,235,255,${0.05 + rnd() * 0.15})`;
    ctx.beginPath();
    const y = rnd() * 128;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(32, y - 8, 64, y + 10, 96, y - 3);
    ctx.bezierCurveTo(112, y - 8, 122, y + 2, 128, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterials(): MaterialSet {
  const textures: THREE.Texture[] = [];
  const add = (tex: THREE.CanvasTexture) => {
    textures.push(tex);
    return tex;
  };
  const stoneTex = add(noiseTexture(0x77738a, 0xaaa4a0, 11, true));
  const darkTex = add(noiseTexture(0x403f52, 0x6d6a78, 23, true));
  const marbleTex = add(noiseTexture(0x9b8f7a, 0xd8cdb5, 37, true));
  const earthTex = add(noiseTexture(0x5a5245, 0x94846b, 53, false));
  const mossTex = add(noiseTexture(0x2f5735, 0x6d9b55, 67, false));
  const pathTex = add(noiseTexture(0x786a53, 0xb09a72, 79, true));
  const woodTex = add(noiseTexture(0x4b3424, 0x9a6a3c, 89, true));
  const waterTex = add(waterTexture());
  const metalTex = add(noiseTexture(0x4a4f5c, 0x9aa3b3, 101, false));
  const crystalTex = add(noiseTexture(0x355f8d, 0xb6e6ff, 113, false));
  const barkTex = add(noiseTexture(0x39291f, 0x76553a, 127, true));
  const leafTex = add(noiseTexture(0x1f4e2d, 0x6cae58, 139, false));
  const clothTex = add(noiseTexture(0x3b3558, 0x736aa0, 151, false));

  const std = (map: THREE.Texture, color: number, roughness = 0.9, metalness = 0.02) =>
    new THREE.MeshStandardMaterial({ map, color, roughness, metalness });

  return {
    stone: std(stoneTex, 0xffffff),
    stoneDark: std(darkTex, 0xffffff),
    marble: std(marbleTex, 0xffffff),
    earth: std(earthTex, 0xffffff),
    moss: std(mossTex, 0xffffff),
    path: std(pathTex, 0xffffff),
    wood: std(woodTex, 0xffffff),
    water: new THREE.MeshStandardMaterial({
      map: waterTex,
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
      emissive: 0x0a2c4a,
      emissiveIntensity: 0.35,
    }),
    metal: std(metalTex, 0xffffff, 0.62, 0.45),
    crystal: new THREE.MeshStandardMaterial({
      map: crystalTex,
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.12,
      emissive: 0x1a6aa0,
      emissiveIntensity: 0.45,
    }),
    bark: std(barkTex, 0xffffff),
    leaf: std(leafTex, 0xffffff),
    cloth: std(clothTex, 0xffffff),
    gold: new THREE.MeshStandardMaterial({ color: 0xc7a24a, roughness: 0.42, metalness: 0.65 }),
    rune: new THREE.MeshStandardMaterial({
      color: 0x8dffd8,
      emissive: 0x31c79a,
      emissiveIntensity: 1.4,
      roughness: 0.35,
    }),
    flame: new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xff7b1c,
      emissiveIntensity: 2.1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.92,
    }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x05060d, transparent: true, opacity: 0.32, depthWrite: false }),
    portal: new THREE.MeshStandardMaterial({
      color: 0xb38bff,
      emissive: 0x6b3fc9,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
    void: new THREE.MeshStandardMaterial({ color: 0x090914, roughness: 0.95, metalness: 0.05 }),
    textures,
  };
}

export function disposeMaterials(materials: MaterialSet) {
  Object.values(materials).forEach((value) => {
    if (value instanceof THREE.Material) value.dispose();
  });
  materials.textures.forEach((tex) => tex.dispose());
}
