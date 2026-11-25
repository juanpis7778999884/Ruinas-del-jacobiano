import * as THREE from 'three';

export interface MaterialSet {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  stoneWorn: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  crystal: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  leafDark: THREE.MeshStandardMaterial;
  leafLight: THREE.MeshStandardMaterial;
  flower: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  rune: THREE.MeshStandardMaterial;
  flame: THREE.MeshStandardMaterial;
  shadow: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial;
  portal: THREE.MeshStandardMaterial;
  portalSurface: THREE.ShaderMaterial;
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

function finishTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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
      const blotch = Math.sin((x + y) * 0.045 + seed * 0.7) * 0.1;
      cells[y * size + x] = wave + blotch + (rnd() - 0.5) * 0.55;
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
    ctx.strokeStyle = 'rgba(18,18,28,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = rnd() * size;
      let y = rnd() * size;
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (rnd() - 0.5) * 26;
        y += (rnd() - 0.5) * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    for (let i = 0; i < 12; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + rnd() * 20, y - 4 - rnd() * 12);
      ctx.stroke();
    }
  }
  return finishTexture(canvas);
}

function flagstoneTexture(seed: number, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = rng(seed);
  ctx.fillStyle = '#2b2b32';
  ctx.fillRect(0, 0, size, size);
  const step = size / 4;
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const jitter = () => (rnd() - 0.5) * 6;
      const x0 = gx * step + 2 + jitter();
      const y0 = gy * step + 2 + jitter();
      const x1 = (gx + 1) * step - 2 + jitter();
      const y1 = (gy + 1) * step - 2 + jitter();
      const tone = 118 + Math.floor(rnd() * 46);
      ctx.fillStyle = `rgb(${tone + 12}, ${tone + 3}, ${Math.max(0, tone - 10)})`;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, y0);
      ctx.lineTo(x1 - 3, y0 + 2);
      ctx.lineTo(x1, y1 - 5);
      ctx.lineTo(x1 - 5, y1);
      ctx.lineTo(x0 + 2, y1 - 2);
      ctx.lineTo(x0, y0 + 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,28,34,0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  return finishTexture(canvas);
}

function barkTexture(seed: number, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = rng(seed);
  ctx.fillStyle = '#4a3324';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size;
    const width = 1 + rnd() * 4;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(28,18,14,0.55)' : 'rgba(160,116,70,0.32)';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, -4);
    ctx.bezierCurveTo(x + (rnd() - 0.5) * 12, size * 0.32, x + (rnd() - 0.5) * 12, size * 0.68, x + (rnd() - 0.5) * 9, size + 4);
    ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(20,26,18,0.35)';
    ctx.beginPath();
    ctx.ellipse(rnd() * size, rnd() * size, 3 + rnd() * 8, 2 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finishTexture(canvas);
}

function leafTexture(seed: number, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = rng(seed);
  ctx.fillStyle = '#3c7b45';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 28; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 16 + rnd() * 30;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(181,225,137,0.28)' : 'rgba(22,62,36,0.36)';
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.4, y - 8, x + len, y - 2);
    ctx.stroke();
  }
  return finishTexture(canvas);
}

function waterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#123a60');
  grad.addColorStop(0.48, '#2f77a8');
  grad.addColorStop(1, '#102f52');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const rnd = rng(7717);
  for (let i = 0; i < 34; i++) {
    ctx.strokeStyle = `rgba(190,240,255,${0.06 + rnd() * 0.18})`;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    const y = rnd() * 128;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(32, y - 9, 64, y + 11, 96, y - 3);
    ctx.bezierCurveTo(112, y - 8, 122, y + 3, 128, y);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`;
    ctx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1);
  }
  return finishTexture(canvas);
}

function normalTexture(image: HTMLCanvasElement, strength = 2.2): THREE.CanvasTexture {
  const size = image.width;
  const src = image.getContext('2d')!.getImageData(0, 0, size, size).data;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(size, size);
  const lum = (x: number, y: number) => {
    const px = (x + size) % size;
    const py = (y + size) % size;
    const i = (py * size + px) * 4;
    return (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out.data[i] = ((-dx / length) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / length * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function roughnessTexture(image: HTMLCanvasElement, min = 0.65, max = 1): THREE.CanvasTexture {
  const size = image.width;
  const src = image.getContext('2d')!.getImageData(0, 0, size, size).data;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(size, size);
  for (let i = 0; i < src.length; i += 4) {
    const shade = (src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11) / 255;
    const value = (min + (max - min) * shade) * 255;
    out.data[i] = value;
    out.data[i + 1] = value;
    out.data[i + 2] = value;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function portalSurfaceMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0x3d1f7a) },
      uColorB: { value: new THREE.Color(0x9fffe4) },
      uGlow: { value: new THREE.Color(0xd6b1ff) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uGlow;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float angle = atan(p.y, p.x);
        float spiral = sin(angle * 4.0 - uTime * 1.8 + r * 12.0);
        float ripple = sin(r * 22.0 - uTime * 3.4 + spiral * 1.6);
        float bands = smoothstep(-0.35, 0.85, ripple * 0.65 + spiral * 0.35);
        vec3 color = mix(uColorA, uColorB, bands);
        float rim = smoothstep(0.62, 1.0, r);
        color += uGlow * rim * (0.45 + 0.35 * sin(uTime * 2.0));
        float core = smoothstep(0.85, 0.1, r);
        color += uGlow * core * 0.22;
        float alpha = 0.76 + bands * 0.18 + rim * 0.12;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
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
  const pathTex = add(flagstoneTexture(79));
  const woodTex = add(noiseTexture(0x4b3424, 0x9a6a3c, 89, true));
  const waterTex = add(waterTexture());
  const metalTex = add(noiseTexture(0x4a4f5c, 0x9aa3b3, 101, false));
  const crystalTex = add(noiseTexture(0x355f8d, 0xb6e6ff, 113, false));
  const barkTex = add(barkTexture(127));
  const leafTex = add(leafTexture(139));
  const clothTex = add(noiseTexture(0x3b3558, 0x736aa0, 151, false));

  const stoneNormal = add(normalTexture(stoneTex.image as HTMLCanvasElement, 2.6));
  const darkNormal = add(normalTexture(darkTex.image as HTMLCanvasElement, 2.2));
  const marbleNormal = add(normalTexture(marbleTex.image as HTMLCanvasElement, 1.7));
  const pathNormal = add(normalTexture(pathTex.image as HTMLCanvasElement, 3.1));
  const barkNormal = add(normalTexture(barkTex.image as HTMLCanvasElement, 2.8));
  const waterNormal = add(normalTexture(waterTex.image as HTMLCanvasElement, 1.3));
  const stoneRough = add(roughnessTexture(stoneTex.image as HTMLCanvasElement, 0.72, 1));
  const marbleRough = add(roughnessTexture(marbleTex.image as HTMLCanvasElement, 0.48, 0.86));
  const pathRough = add(roughnessTexture(pathTex.image as HTMLCanvasElement, 0.76, 1));

  const std = (
    map: THREE.Texture,
    color: number,
    roughness = 0.9,
    metalness = 0.02,
    normalMap?: THREE.Texture,
    roughnessMap?: THREE.Texture,
  ) => new THREE.MeshStandardMaterial({ map, color, roughness, metalness, normalMap, roughnessMap });

  const portalSurface = portalSurfaceMaterial();

  return {
    stone: std(stoneTex, 0xffffff, 0.94, 0.02, stoneNormal, stoneRough),
    stoneDark: std(darkTex, 0xffffff, 0.97, 0.01, darkNormal),
    stoneWorn: std(darkTex, 0xa6b59a, 0.98, 0.01, darkNormal),
    marble: std(marbleTex, 0xffffff, 0.62, 0.03, marbleNormal, marbleRough),
    plaster: std(marbleTex, 0xd9cdb1, 0.88, 0.01, marbleNormal),
    earth: std(earthTex, 0xffffff, 0.98, 0),
    moss: std(mossTex, 0xffffff, 0.97, 0),
    path: std(pathTex, 0xffffff, 0.94, 0.01, pathNormal, pathRough),
    wood: std(woodTex, 0xffffff, 0.9, 0.01, barkNormal),
    water: new THREE.MeshStandardMaterial({
      map: waterTex,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0.9,
      emissive: 0x0d3352,
      emissiveIntensity: 0.38,
    }),
    metal: std(metalTex, 0xffffff, 0.58, 0.48),
    crystal: new THREE.MeshStandardMaterial({
      map: crystalTex,
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.15,
      emissive: 0x1a6aa0,
      emissiveIntensity: 0.55,
    }),
    bark: std(barkTex, 0xffffff, 0.96, 0, barkNormal),
    leaf: std(leafTex, 0xffffff, 0.92, 0),
    leafDark: std(leafTex, 0x87b27a, 0.96, 0),
    leafLight: std(leafTex, 0xc7e39a, 0.9, 0),
    flower: new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xa06a1e,
      emissiveIntensity: 0.45,
      roughness: 0.72,
    }),
    cloth: std(clothTex, 0xffffff, 0.9, 0),
    gold: new THREE.MeshStandardMaterial({ color: 0xc7a24a, roughness: 0.38, metalness: 0.68 }),
    rune: new THREE.MeshStandardMaterial({
      color: 0x8dffd8,
      emissive: 0x31c79a,
      emissiveIntensity: 1.5,
      roughness: 0.34,
    }),
    flame: new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xff7b1c,
      emissiveIntensity: 2.2,
      roughness: 0.6,
      transparent: true,
      opacity: 0.92,
    }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x05060d, transparent: true, opacity: 0.34, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({
      color: 0x8dffd8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    portal: new THREE.MeshStandardMaterial({
      color: 0xb38bff,
      emissive: 0x6b3fc9,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
    portalSurface,
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
