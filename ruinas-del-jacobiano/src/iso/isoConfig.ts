/** Constantes de la proyección isométrica 2:1 y del mundo. */

export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;
export const ISO_WALL_H = 30;
export const ISO_GATE_H = 58;

/** Velocidad base del héroe, en casillas por segundo. */
export const ISO_SPEED = 3.5;
/** Radio de colisión del héroe en unidades de casilla. */
export const ISO_PLAYER_R = 0.29;

export const ISO_CAMERA_ZOOM = 0.92;
export const ISO_BG = 0x0d1024;

export const DEPTH_FLOOR = 0;
export const DEPTH_DECAL = 2;
export const DEPTH_PROP = 4;
export const DEPTH_ENTITY = 6;
export const DEPTH_LIGHT = 40000;
export const DEPTH_AIR = 50000;
export const DEPTH_UI = 60000;
