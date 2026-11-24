/** Matemáticas de la proyección isométrica 2:1. */
import { ISO_TILE_H, ISO_TILE_W } from './isoConfig';

export interface Vec2 {
  x: number;
  y: number;
}

/** Centro del tile (gx,gy) en coordenadas de pantalla. */
export function gridToScreen(gx: number, gy: number): Vec2 {
  return { x: (gx - gy) * (ISO_TILE_W / 2), y: (gx + gy) * (ISO_TILE_H / 2) };
}

/** Invierte la proyección para una dirección de pantalla normalizada. */
export function screenDirToGrid(sx: number, sy: number): Vec2 {
  const c = ISO_TILE_W / 2;
  const d = ISO_TILE_H / 2;
  let gx = (sx / c + sy / d) / 2;
  let gy = (sy / d - sx / c) / 2;
  const len = Math.hypot(gx, gy);
  if (len > 1e-6) {
    gx /= len;
    gy /= len;
  }
  return { x: gx, y: gy };
}

export function gridDirToScreen(gx: number, gy: number): Vec2 {
  const len = Math.hypot(gx, gy) || 1;
  gx /= len;
  gy /= len;
  return { x: gx - gy, y: (gx + gy) * (ISO_TILE_H / ISO_TILE_W) };
}

/** Orden de pintado: cuanto mayor gx+gy, más cerca del jugador. */
export function isoDepth(gx: number, gy: number, sub = 0): number {
  return (gx + gy) * 1000 + gx * 10 + sub;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}
