/**
 * Arte original generado por código para Las Ruinas del Jacobiano.
 * Todo se dibuja en canvas/Graphics: no hay assets de terceros ni de Zelda.
 */
import Phaser from 'phaser';
import { ISO_GATE_H, ISO_TILE_H, ISO_TILE_W, ISO_WALL_H } from './isoConfig';

const T = ISO_TILE_W;
const H = ISO_TILE_H;
const WH = ISO_WALL_H;
const GH = ISO_GATE_H;

type Facing = 'front' | 'back' | 'side';
export type HeroPose = 'idle' | 'walk' | 'attack' | 'dodge' | 'guard' | 'hurt' | 'dead';

function shade(hex: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (hex & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}

function diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, fill?: number, stroke?: number, lw = 1) {
  g.beginPath();
  g.moveTo(cx, cy - h / 2);
  g.lineTo(cx + w / 2, cy);
  g.lineTo(cx, cy + h / 2);
  g.lineTo(cx - w / 2, cy);
  g.closePath();
  if (fill !== undefined) { g.fillStyle(fill); g.fillPath(); }
  if (stroke !== undefined) { g.lineStyle(lw, stroke); g.strokePath(); }
}

function poly(g: Phaser.GameObjects.Graphics, pts: number[], fill?: number, stroke?: number) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill !== undefined) { g.fillStyle(fill); g.fillPath(); }
  if (stroke !== undefined) { g.lineStyle(1, stroke); g.strokePath(); }
}

function seg(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, c: number, w = 1) {
  g.lineStyle(w, c);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.clear();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ─────────────────────────────── suelos ─────────────────────────────── */

const SUBS = [
  { cx: 32, cy: 8 }, { cx: 48, cy: 16 }, { cx: 16, cy: 16 }, { cx: 32, cy: 24 },
];

function floorTexture(scene: Phaser.Scene, key: string, base: number, seed: number, kind: 'stone' | 'moss' | 'path' | 'water' | 'secret' | 'bridge' | 'stair') {
  make(scene, key, T, H, (g) => {
    const rand = rng(seed * 7919 + 13);
    const grout = shade(base, -18);
    SUBS.forEach((s, i) => {
      const v = shade(base, ((i + seed) % 3 - 1) * 7 + Math.round((rand() - 0.5) * 8));
      diamond(g, s.cx, s.cy, 32, 16, v);
      diamond(g, s.cx, s.cy, 32, 16, undefined, grout);
    });

    if (kind === 'stone' || kind === 'secret') {
      if (seed % 3 === 0) {
        seg(g, 8, 12, 20, 20, shade(base, -40));
        seg(g, 20, 20, 27, 19, shade(base, -40));
      } else if (seed % 3 === 1) {
        seg(g, 44, 10, 40, 22, shade(base, -40));
        seg(g, 40, 22, 34, 26, shade(base, -40));
      } else {
        seg(g, 30, 4, 33, 14, shade(base, -40));
      }
      for (let i = 0; i < 5; i++) {
        const x = 6 + rand() * 50, y = 5 + rand() * 20;
        g.fillStyle(shade(base, 16));
        g.fillRect(x, y, 2, 1);
      }
    }
    if (kind === 'moss') {
      g.fillStyle(0x3f8050, 0.55);
      g.fillEllipse(14, 14, 13, 7);
      g.fillEllipse(39, 11, 11, 6);
      g.fillStyle(0x62b267, 0.4);
      g.fillEllipse(45, 24, 10, 5);
      for (let i = 0; i < 4; i++) g.fillRect(6 + rand() * 50, 6 + rand() * 20, 2, 1);
    }
    if (kind === 'path') {
      g.fillStyle(shade(base, 14), 0.5);
      g.fillEllipse(32, 16, 34, 15);
      g.fillStyle(shade(base, -16), 0.5);
      g.fillEllipse(24, 20, 7, 3);
      g.fillEllipse(42, 11, 6, 3);
    }
    if (kind === 'water') {
      diamond(g, 32, 16, 62, 30, 0x23517f, 0x163959, 2);
      diamond(g, 32, 16, 48, 23, 0x2f6ba8);
      g.fillStyle(0x8fd3ff, 0.6);
      g.fillRect(18, 13, 10, 1);
      g.fillRect(30, 20, 8, 1);
      g.fillRect(40, 10, 6, 1);
      g.fillStyle(0x0f2b4d, 0.4);
      g.fillRect(24, 25, 12, 1);
    }
    if (kind === 'bridge') {
      g.fillStyle(0x6b4a2a);
      for (let i = -2; i <= 2; i++) poly(g, [32 + i * 9, 5, 39 + i * 9, 16, 32 + i * 9, 27, 25 + i * 9, 16]);
      g.fillStyle(0x8a6238);
      for (let i = -2; i <= 2; i++) poly(g, [32 + i * 9, 6, 37 + i * 9, 16, 32 + i * 9, 26, 27 + i * 9, 16]);
      g.lineStyle(1, 0x3c2817);
      for (let i = -2; i <= 2; i++) seg(g, 32 + i * 9, 5, 32 + i * 9, 27, 0x3c2817);
    }
    if (kind === 'stair') {
      g.fillStyle(0xb8b2a0, 0.4);
      poly(g, [0, 16, 32, 32, 64, 16, 32, 0]);
      g.lineStyle(2, 0x6e6a60);
      for (let i = -2; i <= 2; i++) seg(g, 32 + i * 10, 5, 32 + i * 10, 27, 0x6e6a60, 2);
    }
    if (kind === 'secret') {
      g.fillStyle(0x8d76c9, 0.16);
      diamond(g, 32, 16, 58, 28);
    }
  });
}

/* ─────────────────────────────── muros ─────────────────────────────── */

function wallTexture(scene: Phaser.Scene, key: string, seed: number) {
  const th = H + WH;
  make(scene, key, T, th, (g) => {
    const top = [0x807b93, 0x746f88, 0x8a849e, 0x6e6a82][seed % 4];
    const left = shade(top, -34);
    const right = shade(top, -10);
    poly(g, [0, 16, 32, 32, 32, 32 + WH, 0, 16 + WH], left);
    poly(g, [32, 32, 64, 16, 64, 16 + WH, 32, 32 + WH], right);
    for (let k = 1; k <= 3; k++) {
      const t = (WH / 4) * k;
      seg(g, 0, 16 + t, 32, 32 + t, shade(left, -18));
      seg(g, 32, 32 + t, 64, 16 + t, shade(right, -18));
    }
    for (const u of [0.34, 0.68]) {
      seg(g, u * 32, 16 + u * 16, u * 32, 16 + WH + u * 16, shade(left, -18));
      seg(g, 32 + u * 32, 32 - u * 16, 32 + u * 32, 32 + WH - u * 16, shade(right, -18));
    }
    SUBS.forEach((s, i) => {
      const v = shade(top, ((i + seed) % 2 === 0 ? 8 : -8));
      diamond(g, s.cx, s.cy, 32, 16, v);
      diamond(g, s.cx, s.cy, 32, 16, undefined, shade(top, -14));
    });
    g.fillStyle(0x3f8050, 0.45);
    g.fillEllipse(18, 14, 11, 6);
    if (seed % 2 === 0) g.fillEllipse(44, 22, 9, 5);
    if (seed % 3 === 0) {
      seg(g, 6, 22, 12, 30, 0x2d2b3e);
      seg(g, 12, 30, 10, 38, 0x2d2b3e);
    }
    g.fillStyle(0xffffff, 0.07);
    g.fillTriangle(32, 2, 40, 8, 32, 8);
  });
}

function columnTexture(scene: Phaser.Scene, key: string, seed: number) {
  const h = 86;
  make(scene, key, 56, h, (g) => {
    g.fillStyle(0x3a3650);
    poly(g, [10, 72, 28, 80, 46, 72, 46, 66, 28, 74, 10, 66]);
    g.fillStyle(0x77728d);
    g.fillRect(19, 20, 18, 50);
    g.fillStyle(0x4c4865);
    g.fillRect(31, 20, 6, 50);
    g.fillStyle(0x8d879f);
    g.fillRect(19, 20, 4, 50);
    for (let y = 26; y < 70; y += 11) {
      g.fillStyle(0x69637f);
      g.fillRect(19, y, 18, 2);
    }
    g.fillStyle(0x9690a8);
    poly(g, [12, 14, 28, 20, 44, 14, 44, 21, 28, 27, 12, 21]);
    g.fillStyle(0x5b5672);
    poly(g, [12, 14, 28, 8, 44, 14, 28, 20]);
    g.fillStyle(0x3f8050, 0.35);
    g.fillEllipse(22, 62, 8, 5);
    if (seed % 2) seg(g, 22, 32, 26, 48, 0x3a354e);
  });
}

/* ─────────────────────────────── vegetación ─────────────────────────────── */

function treeTexture(scene: Phaser.Scene, key: string, seed: number) {
  make(scene, key, 78, 108, (g) => {
    const rand = rng(seed * 101 + 7);
    g.fillStyle(0x12321e, 0.8);
    g.fillEllipse(38, 47, 58, 42);
    g.fillStyle(0x5a3b21);
    g.fillRect(32, 62, 12, 44);
    g.fillRect(29, 80, 18, 26);
    g.fillStyle(0x3b2615);
    g.fillRect(29, 80, 5, 26);
    g.fillStyle(0x7a512b);
    g.fillRect(34, 62, 3, 34);
    g.fillStyle(0x3b2615);
    g.fillRect(23, 98, 14, 7);
    g.fillRect(47, 98, 12, 7);
    const greens = [0x184d29, 0x236a32, 0x328a3d, 0x55ac56, 0x7fd06e];
    for (let i = 0; i < 9; i++) {
      const cx = 38 + (rand() - 0.5) * 42;
      const cy = 36 + (rand() - 0.5) * 30;
      g.fillStyle(greens[i % greens.length]);
      g.fillCircle(cx, cy, 13 + rand() * 10);
    }
    g.fillStyle(0xa8e07f, 0.55);
    g.fillCircle(27, 24, 5);
    g.fillCircle(49, 31, 4);
  });
}

function bushTexture(scene: Phaser.Scene, key: string, seed: number) {
  make(scene, key, 54, 44, (g) => {
    g.fillStyle(0x174f28);
    g.fillEllipse(27, 28, 48, 29);
    g.fillStyle(0x277b38);
    g.fillEllipse(22, 24, 34, 23);
    g.fillEllipse(35, 27, 24, 17);
    g.fillStyle(0x4ba554, 0.9);
    g.fillEllipse(19, 18, 13, 9);
    if (seed % 2 === 0) {
      g.fillStyle(0xf0d272);
      g.fillCircle(30, 17, 2);
      g.fillCircle(38, 23, 2);
    }
  });
}

function rockTexture(scene: Phaser.Scene, key: string, seed: number) {
  make(scene, key, 50, 42, (g) => {
    g.fillStyle(0x454558);
    poly(g, [5, 38, 12, 16, 27, 5, 42, 17, 46, 38]);
    g.fillStyle(0x61617b);
    poly(g, [12, 16, 27, 5, 31, 21, 16, 27]);
    g.fillStyle(0x333345);
    poly(g, [31, 21, 42, 17, 46, 38, 31, 38]);
    g.fillStyle(0x2b2b3b);
    g.fillRect(9, 36, 34, 4);
    g.fillStyle(0x3f8050, 0.5);
    g.fillEllipse(20, 14, 10, 5);
    if (seed % 2) seg(g, 27, 6, 31, 21, 0x8a8ba5);
  });
}

function flowersTexture(scene: Phaser.Scene, key: string) {
  make(scene, key, 42, 30, (g) => {
    g.fillStyle(0x2f7a3c);
    g.fillRect(8, 18, 2, 9);
    g.fillRect(19, 14, 2, 13);
    g.fillRect(29, 20, 2, 7);
    g.fillStyle(0x47a052);
    g.fillRect(5, 16, 7, 2);
    g.fillRect(17, 12, 7, 2);
    g.fillStyle(0xffd166); g.fillCircle(9, 17, 2);
    g.fillStyle(0xf472b6); g.fillCircle(20, 13, 2);
    g.fillStyle(0xa78bfa); g.fillCircle(29, 19, 2);
  });
}

/* ─────────────────────────────── objetos ─────────────────────────────── */

function brazierTexture(scene: Phaser.Scene, key: string) {
  make(scene, key, 46, 60, (g) => {
    g.fillStyle(0x414155);
    g.fillRect(17, 41, 12, 17);
    g.fillRect(12, 54, 22, 5);
    g.fillStyle(0x60607a);
    g.fillRect(17, 41, 4, 17);
    g.fillStyle(0x4e4e66);
    poly(g, [7, 30, 39, 30, 32, 43, 14, 43]);
    g.fillStyle(0x74748f);
    poly(g, [7, 30, 39, 30, 36, 35, 10, 35]);
    g.fillStyle(0xff7a3d); g.fillRect(12, 28, 22, 3);
    g.fillStyle(0xffb703); g.fillRect(15, 25, 16, 3);
    g.fillStyle(0xfff0b3); g.fillRect(19, 23, 8, 2);
  });
}

function runeTexture(scene: Phaser.Scene, key: string, lit: boolean) {
  make(scene, key, 54, 88, (g) => {
    g.fillStyle(0x35354c);
    poly(g, [16, 84, 38, 84, 35, 20, 27, 5, 19, 20]);
    g.fillStyle(lit ? 0x5a6b82 : 0x4b4b66);
    poly(g, [16, 84, 27, 84, 25, 20, 19, 20]);
    g.fillStyle(0x28283c);
    poly(g, [31, 84, 38, 84, 35, 20, 29, 22]);
    g.fillStyle(0x3e3e56);
    g.fillRect(12, 78, 30, 8);
    g.fillStyle(0x5a5a76);
    g.fillRect(12, 78, 30, 2);
    const gem = lit ? 0x9dffd6 : 0x5d7f96;
    g.fillStyle(gem);
    g.fillRect(21, 28, 12, 11);
    g.fillStyle(lit ? 0xeafff4 : 0x8fb0c4, lit ? 1 : 0.6);
    g.fillRect(23, 30, 8, 7);
    if (lit) {
      g.fillStyle(0xffffff, 0.6); g.fillRect(24, 31, 3, 3);
      seg(g, 20, 48, 34, 48, 0x8dffd8, 2);
      seg(g, 27, 43, 27, 60, 0x8dffd8, 2);
    } else {
      seg(g, 21, 48, 33, 48, 0x2a2a3d, 2);
      seg(g, 27, 43, 27, 58, 0x2a2a3d, 2);
    }
  });
}

function gateTexture(scene: Phaser.Scene, key: string, open: boolean) {
  make(scene, key, T, H + GH, (g) => {
    const base = 0x484860;
    g.fillStyle(shade(base, -28));
    poly(g, [4, 74, 18, 74, 18, 14, 4, 14]);
    poly(g, [46, 74, 60, 74, 60, 14, 46, 14]);
    g.fillStyle(shade(base, 18));
    poly(g, [4, 74, 8, 74, 8, 14, 4, 14]);
    poly(g, [46, 74, 50, 74, 50, 14, 46, 14]);
    g.fillStyle(base); g.fillRect(4, 2, 56, 14);
    g.fillStyle(shade(base, 20)); g.fillRect(4, 2, 56, 3);
    g.fillStyle(shade(base, -24)); g.fillRect(4, 13, 56, 3);
    for (let x = 10; x < 58; x += 12) g.fillRect(x, 5, 2, 8);
    g.fillStyle(open ? 0x0d1830 : 0x1b1b2e);
    g.fillRect(18, 16, 28, 58);
    if (open) {
      g.fillStyle(0x2b6fb0, 0.5); g.fillRect(20, 34, 24, 40);
      g.fillStyle(0x6fc7ff, 0.35); g.fillRect(24, 46, 16, 28);
    } else {
      g.fillStyle(0x5c3a1a); g.fillRect(18, 16, 28, 58);
      g.fillStyle(0x6f4520);
      for (let x = 20; x < 46; x += 6) g.fillRect(x, 16, 4, 58);
      g.fillStyle(0x3c3f6b);
      g.fillRect(18, 26, 28, 4);
      g.fillRect(18, 59, 28, 4);
      g.fillStyle(0x7bdff2); g.fillCircle(32, 44, 8);
      g.fillStyle(0xe0faff); g.fillCircle(32, 44, 4);
      g.fillStyle(0x1b1f3b);
      g.fillRect(30, 38, 4, 12); g.fillRect(26, 42, 12, 4);
    }
  });
}

function portalTexture(scene: Phaser.Scene, key: string) {
  make(scene, key, 64, 92, (g) => {
    g.fillStyle(0x2c2745);
    poly(g, [10, 86, 54, 86, 50, 78, 14, 78]);
    g.fillStyle(0x494163);
    poly(g, [10, 86, 32, 78, 54, 86]);
    g.fillStyle(0x3a3454);
    g.fillRect(14, 18, 8, 64);
    g.fillRect(42, 18, 8, 64);
    g.fillStyle(0x5c5480);
    g.fillRect(14, 18, 3, 64);
    g.fillRect(42, 18, 3, 64);
    g.fillStyle(0x171a35);
    g.fillRect(22, 16, 20, 66);
    g.fillStyle(0x7b61c9, 0.75);
    g.fillEllipse(32, 48, 18, 60);
    g.fillStyle(0xb893ff, 0.7);
    g.fillEllipse(32, 48, 10, 48);
    g.fillStyle(0xe6d7ff, 0.8);
    g.fillEllipse(32, 48, 4, 30);
    g.fillStyle(0x8e83b5);
    g.fillRect(12, 12, 40, 7);
    g.fillStyle(0xb8aede);
    g.fillRect(12, 12, 40, 2);
  });
}

function chestTexture(scene: Phaser.Scene, key: string, open: boolean) {
  make(scene, key, 48, 42, (g) => {
    g.fillStyle(0x3a2618);
    g.fillRect(7, 18, 34, 19);
    g.fillStyle(0x6b4524);
    g.fillRect(9, 20, 30, 15);
    g.fillStyle(0x805531);
    for (let x = 10; x < 38; x += 6) g.fillRect(x, 20, 4, 15);
    g.fillStyle(0x3a3f6b);
    g.fillRect(9, 25, 30, 3);
    g.fillStyle(0xffd166);
    g.fillRect(21, 24, 6, 6);
    if (open) {
      g.fillStyle(0x4a301d);
      poly(g, [7, 18, 41, 18, 37, 5, 11, 5]);
      g.fillStyle(0x7c532d);
      poly(g, [10, 16, 38, 16, 35, 7, 13, 7]);
      g.fillStyle(0xffe9a3, 0.65);
      g.fillEllipse(24, 16, 22, 5);
    } else {
      g.fillStyle(0x4a301d);
      poly(g, [7, 18, 41, 18, 38, 6, 10, 6]);
      g.fillStyle(0x7c532d);
      poly(g, [10, 16, 38, 16, 36, 8, 12, 8]);
      g.fillStyle(0x3a3f6b);
      g.fillRect(10, 6, 28, 3);
      g.fillStyle(0xffd166);
      g.fillRect(22, 6, 5, 5);
    }
  });
}

function tabletTexture(scene: Phaser.Scene, key: string) {
  make(scene, key, 48, 60, (g) => {
    g.fillStyle(0x4a465e);
    poly(g, [10, 56, 38, 56, 35, 8, 13, 8]);
    g.fillStyle(0x67627f);
    poly(g, [10, 56, 24, 56, 22, 8, 13, 8]);
    g.fillStyle(0x323047);
    for (let y = 14; y < 47; y += 6) g.fillRect(17, y, 14, 2);
    g.fillStyle(0x8ecae6, 0.75);
    g.fillRect(18, 18, 11, 1);
    g.fillRect(19, 30, 9, 1);
    g.fillStyle(0x3f8050, 0.45);
    g.fillEllipse(15, 50, 9, 5);
  });
}

function switchTexture(scene: Phaser.Scene, key: string, on: boolean) {
  make(scene, key, 42, 56, (g) => {
    g.fillStyle(0x3b3850);
    poly(g, [10, 52, 32, 52, 29, 10, 13, 10]);
    g.fillStyle(0x5a5674);
    poly(g, [10, 52, 21, 52, 20, 10, 13, 10]);
    const c = on ? 0x8dffd8 : 0x5a5878;
    g.fillStyle(c);
    g.fillCircle(21, 20, 7);
    g.fillStyle(on ? 0xffffff : 0x35334b);
    g.fillCircle(21, 20, 3);
    if (on) {
      g.lineStyle(2, 0x8dffd8, 0.7);
      g.strokeCircle(21, 20, 11);
    }
  });
}

function shrineTexture(scene: Phaser.Scene, key: string) {
  make(scene, key, 60, 70, (g) => {
    g.fillStyle(0x40405c);
    poly(g, [8, 66, 52, 66, 46, 58, 14, 58]);
    g.fillStyle(0x585878);
    poly(g, [8, 66, 30, 58, 52, 66]);
    g.fillStyle(0x4d4b68);
    g.fillRect(22, 28, 16, 30);
    g.fillStyle(0x6a6889);
    g.fillRect(22, 28, 4, 30);
    g.fillStyle(0x8dffd8);
    g.fillCircle(30, 24, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(30, 24, 4);
    g.fillStyle(0x3f8050, 0.5);
    g.fillEllipse(17, 58, 10, 5);
    g.fillEllipse(43, 58, 10, 5);
  });
}

/* ─────────────────────────────── personajes ─────────────────────────────── */

const U = 2;
function px(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number, a = 1) {
  g.fillStyle(c, a);
  g.fillRect(x * U, y * U, w * U, h * U);
}

function drawHero(g: Phaser.GameObjects.Graphics, facing: Facing, pose: HeroPose, frame: number) {
  const step = frame % 2 === 1;
  const attack = pose === 'attack';
  const hurt = pose === 'hurt';
  const dead = pose === 'dead';
  const dodge = pose === 'dodge';
  const guard = pose === 'guard';
  const breath = frame % 2 === 1 && pose === 'idle' ? 1 : 0;
  const cape = hurt ? 0xff8b8b : 0x9d3547;
  const capeDark = hurt ? 0xd95a5a : 0x742838;
  const skin = hurt ? 0xffc0b0 : 0xffd9b3;
  const tunic = 0x2b6fd6;
  const tunicDark = 0x1f54a8;

  if (dead) {
    px(g, 3, 24, 18, 4, cape);
    px(g, 5, 22, 14, 3, tunic);
    px(g, 2, 20, 5, 4, skin);
    px(g, 6, 19, 8, 4, 0x8a5a2b);
    px(g, 16, 21, 4, 1, 0xc9d3df);
    return;
  }

  // capa
  if (facing === 'front') {
    px(g, 4, 11 - breath, 14, 14, cape);
    px(g, 4, 11 - breath, 14, 3, capeDark);
  } else if (facing === 'back') {
    px(g, 3, 10 - breath, 16, 16, cape);
    px(g, 4, 12 - breath, 4, 13, capeDark);
    px(g, 13, 12 - breath, 4, 13, capeDark);
  } else {
    px(g, 4, 11 - breath, 13, 14, cape);
  }

  // piernas
  if (facing === 'side') {
    px(g, step ? 8 : 9, 21, 6, 5, 0x33465c);
    px(g, step ? 7 : 10, 26, 7, 4, 0x4a3227);
  } else {
    px(g, 6, 21, 10, 5, 0x33465c);
    px(g, step ? 5 : 6, 26, 4, 4, 0x4a3227);
    px(g, step ? 13 : 12, 26, 4, 4, 0x4a3227);
  }

  // torso
  if (facing === 'side') {
    px(g, 8, 13 - breath, 8, 9, tunic);
    px(g, 8, 21, 8, 2, 0x6b4423);
  } else {
    px(g, 5, 13 - breath, 12, 9, tunic);
    if (facing === 'front') px(g, 13, 13 - breath, 4, 9, tunicDark);
    px(g, 5, 21, 12, 2, 0x6b4423);
    px(g, 10, 21, 2, 2, 0xffd166);
  }
  if (facing === 'front') px(g, 9, 12 - breath, 4, 2, 0xffd166);

  // brazos y espada
  if (facing === 'side') {
    if (attack) {
      const sw = frame === 0 ? 0 : frame === 1 ? -3 : 3;
      px(g, 13 + sw, 12 - breath, 4, 7, skin);
      px(g, 16 + sw, 6, 2, 14, 0xc9d3df);
      px(g, 14 + sw, 18, 5, 1, 0x8a5a2b);
    } else if (guard) {
      px(g, 13, 14, 4, 7, skin);
      px(g, 17, 12, 2, 12, 0x8b93a8);
      px(g, 19, 15, 1, 7, 0xffd166);
    } else {
      px(g, 13, 14 - breath, 4, 7, skin);
      px(g, 13, 14, 4, 3, tunicDark);
      px(g, 15, 8, 2, 12, 0xc9d3df);
      px(g, 14, 19, 4, 1, 0x8a5a2b);
    }
  } else {
    if (attack) {
      const sw = frame === 0 ? -3 : frame === 1 ? 4 : 1;
      px(g, 3 + sw, 12 - breath, 4, 7, skin);
      px(g, 17 + sw, 12 - breath, 4, 7, skin);
      px(g, 20 + sw, 5, 2, 14, 0xc9d3df);
      px(g, 18 + sw, 18, 5, 1, 0x8a5a2b);
    } else if (guard) {
      px(g, 3, 14, 4, 7, skin);
      px(g, 16, 14, 4, 7, skin);
      px(g, 17, 12, 3, 12, 0x8b93a8);
      px(g, 18, 15, 1, 7, 0xffd166);
    } else {
      px(g, 3, 14 - breath, 4, 7, skin);
      px(g, 16, 14 - breath, 4, 7, skin);
      px(g, 3, 14, 4, 3, tunicDark);
      px(g, 16, 14, 4, 3, tunicDark);
      px(g, 18, 4, 2, 12, 0xc9d3df);
      px(g, 17, 15, 4, 1, 0x8a5a2b);
    }
  }

  // cabeza
  if (facing === 'front') {
    px(g, 7, 4 - breath, 8, 9, skin);
    px(g, 6, 2 - breath, 10, 5, 0x8a5a2b);
    px(g, 6, 7, 2, 5, 0x8a5a2b);
    px(g, 14, 7, 2, 4, 0x8a5a2b);
    px(g, 9, 9, 1, 1, 0x1b1f3b);
    px(g, 12, 9, 1, 1, 0x1b1f3b);
  } else if (facing === 'back') {
    px(g, 7, 4 - breath, 8, 8, skin);
    px(g, 6, 2 - breath, 10, 8, 0x8a5a2b);
    px(g, 18, 4, 2, 12, 0xc9d3df);
    px(g, 17, 15, 4, 1, 0x8a5a2b);
  } else {
    px(g, 8, 4 - breath, 8, 9, skin);
    px(g, 7, 2 - breath, 9, 6, 0x8a5a2b);
    px(g, 15, 8, 2, 2, 0xe8a87c);
    px(g, 13, 9, 1, 1, 0x1b1f3b);
  }

  if (dodge) {
    g.fillStyle(0x9dffd6, 0.35);
    g.fillEllipse(22, 30, 44, 12);
  }
}

function enemyTexture(g: Phaser.GameObjects.Graphics, kind: string, frame: number) {
  const bob = frame === 1 ? 2 : 0;
  g.fillStyle(0x000000, 0.35);
    g.fillEllipse(32, 62, 38, 10);
    if (kind === 'espiritu') {
      g.fillStyle(0x7bdff2, 0.55); g.fillEllipse(32, 38 - bob, 34, 40);
      g.fillStyle(0x4aa8d8, 0.85); g.fillEllipse(32, 34 - bob, 26, 34);
      g.fillStyle(0xe6fbff); g.fillCircle(24, 32 - bob, 4); g.fillCircle(40, 32 - bob, 4);
      g.fillStyle(0x123048); g.fillCircle(24, 33 - bob, 2); g.fillCircle(40, 33 - bob, 2);
      g.fillStyle(0xa8ecff, 0.6); g.fillTriangle(32, 54 - bob, 26, 44 - bob, 38, 44 - bob);
    } else if (kind === 'espino') {
      g.fillStyle(0x5d3b28); g.fillEllipse(32, 46 - bob, 34, 26);
      g.fillStyle(0x7c5230); g.fillEllipse(30, 42 - bob, 24, 18);
      g.fillStyle(0x2f5c2a);
      for (let i = 0; i < 5; i++) g.fillTriangle(18 + i * 7, 30 - bob, 22 + i * 7, 12 - bob - (i % 2) * 5, 26 + i * 7, 30 - bob);
      g.fillStyle(0xff6b6b); g.fillCircle(25, 43 - bob, 3); g.fillCircle(39, 43 - bob, 3);
      g.fillStyle(0xffd166); g.fillCircle(25, 43 - bob, 1); g.fillCircle(39, 43 - bob, 1);
    } else if (kind === 'centinela') {
      g.fillStyle(0x54506b); poly(g, [16, 60 - bob, 20, 18 - bob, 44, 18 - bob, 48, 60 - bob]);
      g.fillStyle(0x6e6989); poly(g, [20, 18 - bob, 32, 10 - bob, 44, 18 - bob, 32, 26 - bob]);
      g.fillStyle(0x3c3952); poly(g, [16, 60 - bob, 24, 60 - bob, 24, 26 - bob]);
      g.fillStyle(0x8dffd8); g.fillRect(27, 28 - bob, 10, 3);
      g.fillStyle(0xffd166); g.fillCircle(32, 18 - bob, 3);
      g.lineStyle(2, 0x9a94b8); seg(g, 48, 22 - bob, 56, 54 - bob, 0x9a94b8, 3);
    } else if (kind === 'arquero') {
      g.fillStyle(0x3a3550); g.fillEllipse(32, 48 - bob, 28, 24);
      g.fillStyle(0x5b5477); g.fillCircle(32, 26 - bob, 12);
      g.fillStyle(0x2a263e); g.fillTriangle(20, 24 - bob, 44, 24 - bob, 32, 6 - bob);
      g.fillStyle(0xffd166); g.fillCircle(27, 26 - bob, 2); g.fillCircle(37, 26 - bob, 2);
      g.lineStyle(2, 0x9b7b4a); g.beginPath(); g.arc(46, 38 - bob, 16, -1.2, 1.2); g.strokePath();
      seg(g, 46, 22 - bob, 46, 54 - bob, 0xe8e2d0);
    } else {
      g.fillStyle(0x1e1b32, 0.9); g.fillEllipse(32, 42 - bob, 32, 42);
      g.fillStyle(0x5c3a7a, 0.85); g.fillEllipse(32, 38 - bob, 24, 34);
      g.fillStyle(0xe0aaff); g.fillCircle(25, 34 - bob, 3); g.fillCircle(39, 34 - bob, 3);
      g.fillStyle(0x120e22); g.fillCircle(25, 34 - bob, 1); g.fillCircle(39, 34 - bob, 1);
      g.fillStyle(0x9d4edd, 0.5); g.fillTriangle(32, 6 - bob, 24, 22 - bob, 40, 22 - bob);
    }
}

function bossTexture(g: Phaser.GameObjects.Graphics, kind: string, frame: number) {
  const bob = frame === 1 ? 3 : 0;
  g.fillStyle(0x000000, 0.4); g.fillEllipse(54, 106, 80, 16);
    const glow = kind === 'singular' ? 0x9d4edd : kind === 'colossus' ? 0x7bdff2 : kind === 'sentinel' ? 0x8dffd8 : 0xffb703;
    g.fillStyle(glow, 0.16); g.fillCircle(54, 56 - bob, 46);
    if (kind === 'guardian') {
      g.fillStyle(0x54506b); poly(g, [20, 100 - bob, 24, 24 - bob, 84, 24 - bob, 88, 100 - bob]);
      g.fillStyle(0x77728f);
      for (let y = 30; y < 96; y += 14) for (let x = 28; x < 84; x += 18) g.fillRect(x, y + bob * 0, 14, 10);
      g.fillStyle(0x2c2a42); g.fillRect(34, 34 - bob, 40, 10);
      g.fillStyle(0xffd166); g.fillCircle(42, 39 - bob, 4); g.fillCircle(66, 39 - bob, 4);
      g.fillStyle(0x8a5a2b); g.fillTriangle(26, 28 - bob, 54, 4 - bob, 82, 28 - bob);
    } else if (kind === 'sentinel') {
      g.fillStyle(0x3c4a63); poly(g, [24, 100 - bob, 32, 30 - bob, 76, 30 - bob, 84, 100 - bob]);
      g.fillStyle(0x60809b); poly(g, [32, 30 - bob, 54, 12 - bob, 76, 30 - bob, 54, 44 - bob]);
      g.fillStyle(0x8dffd8); g.fillRect(42, 46 - bob, 24, 4);
      g.fillStyle(0x14283b); g.fillCircle(54, 34 - bob, 8);
      g.fillStyle(0x8dffd8); g.fillCircle(54, 34 - bob, 4);
      g.lineStyle(4, 0x9ec8e0); seg(g, 84, 36 - bob, 100, 86 - bob, 0x9ec8e0, 4);
    } else if (kind === 'colossus') {
      g.fillStyle(0x3e5b7a); g.fillCircle(54, 62 - bob, 40);
      g.fillStyle(0x5f88ab); g.fillCircle(54, 58 - bob, 30);
      g.fillStyle(0x1b3554); g.fillCircle(54, 58 - bob, 18);
      g.fillStyle(0x7bdff2); g.fillCircle(54, 58 - bob, 9);
      g.lineStyle(3, 0x9ec8e0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + frame * 0.2;
        seg(g, 54 + Math.cos(a) * 42, 58 - bob + Math.sin(a) * 42, 54 + Math.cos(a) * 52, 58 - bob + Math.sin(a) * 52, 0x9ec8e0, 3);
      }
      g.fillStyle(0xffffff); g.fillCircle(54, 58 - bob, 3);
    } else {
      g.fillStyle(0x150f2b, 0.92); g.fillCircle(54, 58 - bob, 44);
      g.fillStyle(0x4c2373, 0.9); g.fillCircle(54, 58 - bob, 30);
      g.fillStyle(0x0a0616); g.fillCircle(54, 58 - bob, 12);
      g.fillStyle(0xe0aaff); g.fillCircle(54, 58 - bob, 5);
      g.lineStyle(2, 0x9d4edd, 0.7);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - frame * 0.3;
        seg(g, 54 + Math.cos(a) * 34, 58 - bob + Math.sin(a) * 34, 54 + Math.cos(a + 0.5) * 50, 58 - bob + Math.sin(a + 0.5) * 50, 0x9d4edd, 2);
      }
      g.fillStyle(0xff70d0); g.fillCircle(32, 46 - bob, 3); g.fillCircle(76, 68 - bob, 3);
    }
}

/* ─────────────────────────────── Efectos ─────────────────────────────── */

function softTexture(scene: Phaser.Scene, key: string, size: number, color: string, power: number) {
  makeCanvas(scene, key, size, size, (ctx) => {
    const c = size / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, color);
    grad.addColorStop(power, color.replace(/[\d.]+\)$/, '0.32)'));
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  });
}

/* ─────────────────────────────── API ─────────────────────────────── */

export const ISO_WALL_ORIGIN_Y = (H / 2 + WH) / (H + WH);
export const ISO_GATE_ORIGIN_Y = (H / 2 + GH) / (H + GH);

export function heroKey(facing: Facing, pose: HeroPose, frame = 0): string {
  return `hero_${facing}_${pose}_${frame}`;
}

export function enemyKey(kind: string, frame = 0): string {
  return `enemy_${kind}_${frame}`;
}

export function bossKey(kind: string, frame = 0): string {
  return `boss_${kind}_${frame}`;
}

export function buildIsoTextures(scene: Phaser.Scene) {
  // suelos
  const floors: [string, number, number, 'stone' | 'moss' | 'path' | 'water' | 'secret' | 'bridge' | 'stair'][] = [
    ['iso_floor0', 0x8b8579, 0, 'stone'],
    ['iso_floor1', 0x968f80, 1, 'stone'],
    ['iso_floor2', 0x807b71, 2, 'stone'],
    ['iso_floor3', 0x91897a, 3, 'stone'],
    ['iso_moss', 0x7f8a72, 4, 'moss'],
    ['iso_path', 0xa8926a, 5, 'path'],
    ['iso_water', 0x24507f, 6, 'water'],
    ['iso_secret', 0x6c608f, 7, 'secret'],
    ['iso_bridge', 0x6b4a2a, 8, 'bridge'],
    ['iso_stairs', 0x8d8879, 9, 'stair'],
  ];
  floors.forEach(([key, color, seed, kind]) => floorTexture(scene, key, color, seed, kind));

  // muros y columnas
  for (let i = 0; i < 4; i++) wallTexture(scene, `iso_wall${i}`, i);
  for (let i = 0; i < 2; i++) columnTexture(scene, `iso_column${i}`, i);

  // vegetación
  for (let i = 0; i < 3; i++) treeTexture(scene, `iso_tree${i}`, i);
  for (let i = 0; i < 2; i++) {
    bushTexture(scene, `iso_bush${i}`, i);
    rockTexture(scene, `iso_rock${i}`, i);
  }
  flowersTexture(scene, 'iso_flowers');

  // objetos
  brazierTexture(scene, 'iso_brazier');
  runeTexture(scene, 'iso_rune_dark', false);
  runeTexture(scene, 'iso_rune_lit', true);
  gateTexture(scene, 'iso_gate_closed', false);
  gateTexture(scene, 'iso_gate_open', true);
  portalTexture(scene, 'iso_portal');
  chestTexture(scene, 'iso_chest', false);
  chestTexture(scene, 'iso_chest_open', true);
  tabletTexture(scene, 'iso_tablet');
  switchTexture(scene, 'iso_switch_off', false);
  switchTexture(scene, 'iso_switch_on', true);
  shrineTexture(scene, 'iso_shrine');

  // héroe
  const facings: Facing[] = ['front', 'back', 'side'];
  const frames: Record<HeroPose, number> = {
    idle: 2, walk: 4, attack: 3, dodge: 2, guard: 2, hurt: 1, dead: 1,
  };
  (Object.keys(frames) as HeroPose[]).forEach((pose) => {
    for (const f of facings) {
      for (let i = 0; i < frames[pose]; i++) {
        make(scene, heroKey(f, pose, i), 52, 62, (g) => drawHero(g, f, pose, i));
      }
    }
  });

  // enemigos y jefes
  ['espiritu', 'espino', 'centinela', 'arquero', 'sombra'].forEach((kind) => {
    for (let i = 0; i < 2; i++) make(scene, enemyKey(kind, i), 64, 66, (g) => enemyTexture(g, kind, i));
  });
  ['guardian', 'sentinel', 'colossus', 'singular'].forEach((kind) => {
    for (let i = 0; i < 2; i++) make(scene, bossKey(kind, i), 108, 112, (g) => bossTexture(g, kind, i));
  });

  // suaves y partículas
  makeCanvas(scene, 'iso_shadow', 64, 32, (ctx) => {
    const grad = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 32);
  });
  softTexture(scene, 'iso_glow_warm', 160, 'rgba(255,196,110,0.85)', 0.35);
  softTexture(scene, 'iso_glow_cool', 160, 'rgba(120,220,255,0.85)', 0.35);
  softTexture(scene, 'iso_glow_green', 160, 'rgba(141,255,216,0.85)', 0.35);
  softTexture(scene, 'iso_glow_violet', 160, 'rgba(190,140,255,0.85)', 0.35);
  makeCanvas(scene, 'iso_dot', 8, 8, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(4, 4, 3.2, 0, Math.PI * 2); ctx.fill();
  });
  make(scene, 'slash_arc', 86, 86, (g) => {
    g.lineStyle(9, 0xffffff, 0.28);
    g.beginPath(); g.arc(43, 43, 32, -0.95, 0.95); g.strokePath();
    g.lineStyle(4, 0xffffff, 0.95);
    g.beginPath(); g.arc(43, 43, 32, -0.85, 0.85); g.strokePath();
    g.lineStyle(2, 0xffe9a3, 1);
    g.beginPath(); g.arc(43, 43, 36, -0.6, 0.6); g.strokePath();
  });
  make(scene, 'magic_ring', 96, 48, (g) => {
    g.lineStyle(3, 0x9dffd6, 0.9);
    g.strokeEllipse(48, 24, 88, 40);
    g.lineStyle(1, 0xffffff, 0.7);
    g.strokeEllipse(48, 24, 70, 30);
  });
  makeCanvas(scene, 'iso_vignette', 512, 288, (ctx) => {
    const grad = ctx.createRadialGradient(256, 144, 90, 256, 144, 300);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 288);
  });
  makeCanvas(scene, 'iso_fog', 512, 256, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(150,180,220,0.16)');
    grad.addColorStop(0.5, 'rgba(150,180,220,0.04)');
    grad.addColorStop(1, 'rgba(150,180,220,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
  });
  void mix;
}
