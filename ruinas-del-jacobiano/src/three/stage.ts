import * as THREE from 'three';
import type { ZoneDef } from '../data/zones';

export type GraphicsQuality = 'auto' | 'high' | 'low';

const palettes: Record<ZoneDef['ambience'], { fog: number; density: number; sky: number; sun: number; hemi: number }> = {
  town: { fog: 0x26304a, density: 0.021, sky: 0x8fa8c8, sun: 0xffd9a0, hemi: 0x5f79a0 },
  grove: { fog: 0x1c352c, density: 0.026, sky: 0x8fc6a4, sun: 0xf4e2a8, hemi: 0x456f5a },
  river: { fog: 0x203e53, density: 0.024, sky: 0x91c4d8, sun: 0xd9f0ff, hemi: 0x4c7992 },
  city: { fog: 0x332c3f, density: 0.019, sky: 0xc2a97b, sun: 0xffd166, hemi: 0x6c5c7d },
  sanctum: { fog: 0x1d1633, density: 0.023, sky: 0xb38bff, sun: 0xe0c8ff, hemi: 0x46376f },
};

export function resolveQuality(quality: GraphicsQuality): 'high' | 'low' {
  if (quality === 'high') return 'high';
  if (quality === 'low') return 'low';
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse || memory <= 2 || cores <= 4 ? 'low' : 'high';
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly quality: 'high' | 'low';
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly fill: THREE.DirectionalLight;
  private container: HTMLElement;
  private width = 960;
  private height = 540;

  constructor(container: HTMLElement, quality: GraphicsQuality, zIndex = 2) {
    this.container = container;
    this.quality = resolveQuality(quality);
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality === 'high',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.6 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'three-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = String(zIndex);
    this.canvas.style.transformOrigin = 'top left';
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 180);
    this.camera.position.set(14, 18, 14);
    this.camera.lookAt(0, 0, 0);

    this.hemi = new THREE.HemisphereLight(0x9fb8d8, 0x2b2432, 1.35);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe3b0, 2.1);
    this.sun.position.set(-12, 22, 9);
    this.sun.castShadow = this.quality === 'high';
    this.sun.shadow.mapSize.set(this.quality === 'high' ? 1536 : 512, this.quality === 'high' ? 1536 : 512);
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 26;
    this.sun.shadow.camera.bottom = -26;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.bias = -0.0012;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight(0x7198d8, 0.55);
    this.fill.position.set(10, 12, -12);
    this.scene.add(this.fill);
    this.scene.background = new THREE.Color(0x0d1024);
    this.scene.fog = new THREE.FogExp2(0x26304a, 0.021);
  }

  setZIndex(zIndex: number) {
    this.canvas.style.zIndex = String(zIndex);
  }

  setAtmosphere(ambience: ZoneDef['ambience']) {
    const p = palettes[ambience];
    (this.scene.background as THREE.Color).setHex(p.sky);
    (this.scene.fog as THREE.FogExp2).color.setHex(p.fog);
    (this.scene.fog as THREE.FogExp2).density = p.density;
    this.hemi.color.setHex(p.sky);
    this.hemi.groundColor.setHex(p.fog);
    this.sun.color.setHex(p.sun);
    this.fill.color.setHex(p.hemi);
    this.renderer.toneMappingExposure = ambience === 'sanctum' ? 1.0 : 1.08;
  }

  resize(phaserCanvas: HTMLCanvasElement) {
    const r = phaserCanvas.getBoundingClientRect();
    const parent = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(r.width || window.innerWidth));
    const height = Math.max(1, Math.round(r.height || window.innerHeight));
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.left = `${Math.round(r.left - parent.left)}px`;
    this.canvas.style.top = `${Math.round(r.top - parent.top)}px`;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get size() {
    return { width: this.width, height: this.height };
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

let fadeEl: HTMLDivElement | null = null;
let fadeActive = false;

function getFade() {
  if (fadeEl) return fadeEl;
  fadeEl = document.createElement('div');
  fadeEl.id = 'scene-fade';
  document.body.appendChild(fadeEl);
  return fadeEl;
}

export function sceneFadeOut(duration = 280, color = '#05060f'): Promise<void> {
  const el = getFade();
  fadeActive = true;
  el.style.transition = 'none';
  el.style.background = color;
  el.style.opacity = '0';
  el.offsetWidth;
  el.style.transition = `opacity ${duration}ms ease`;
  el.style.opacity = '1';
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export function sceneFadeIn(duration = 320): Promise<void> {
  if (!fadeActive) return Promise.resolve();
  const el = getFade();
  fadeActive = false;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.offsetWidth;
  el.style.transition = `opacity ${duration}ms ease`;
  el.style.opacity = '0';
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
