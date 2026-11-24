/**
 * Datos del prototipo isométrico F1.
 *
 * Mapa ASCII propio (NO es el de data/zones.ts: la adaptación del juego 2D
 * al isométrico viene en fases posteriores).
 *
 * Leyenda:
 *   '#' muro (bloquea)          '.' suelo de piedra
 *   ',' suelo con musgo         '=' camino de tierra
 *   '~' agua (bloquea)          'T' árbol (bloquea)
 *   'b' arbusto (no bloquea)    'o' roca (bloquea)
 *   '*' flores (no bloquea)     'B' brasero (no bloquea)
 *   'R' runa (no bloquea)       'D' portón (bloquea hasta abrirlo)
 *   'P' punto de aparición del jugador
 */
import { Difficulty, Topic } from '../systems/questions';

export const ISO_MAP: string[] = [
  '##########D###########',
  '#TT...,........b....*#',
  '#..###,......###.....#',
  '#....,.......o...b...#',
  '#.P..###...B..###....#',
  '#......,............,#',
  '#..###.....####.##...#',
  '#..,.....~~.....*....#',
  '#......~~~...........#',
  '#..b...~~~......##...#',
  '#...R..~~~.....,.....#',
  '#......~~~......##...#',
  '#..oo..~~~...*...##..#',
  '#......~~~.......*..##',
  '#.####.######...######',
  '######################',
];

export interface IsoRuneDef {
  x: number;
  y: number;
  topic: Topic;
  difficulty: Difficulty;
  title: string;
}

export const ISO_RUNE: IsoRuneDef = {
  x: 4,
  y: 10,
  topic: 'jacobian',
  difficulty: 2,
  title: 'Runa del Jacobiano',
};

export const ISO_GATE = { x: 10, y: 0 };

export const ISO_SPAWN = { x: 3, y: 4 };

export const ISO_ZONE_NAME = 'Ruinas de Cartesia (prototipo 2.5D)';

/** Caracteres que bloquean el paso. */
export const ISO_SOLID_CHARS = new Set(['#', '~', 'T', 'o', 'D']);

/** Comprueba que el mapa es rectangular (evita errores silenciosos). */
export function validateIsoMap(rows: string[]): boolean {
  const w = rows[0]?.length ?? 0;
  return rows.every((r) => r.length === w);
}
