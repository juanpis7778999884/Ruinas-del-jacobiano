/**
 * Mundo de Las Ruinas del Jacobiano: mapas isométricos, entidades y contenido.
 *
 * Leyenda de mapas (32 x 20):
 *   .  losa de piedra    ,  musgo         =  camino        *  flores
 *   #  muro / ruina      c  columna       o  roca          T  árbol
 *   ~  agua              B  brasero       R  runa          P  portal
 *   C  cofre             L  tabla de lore S  mecanismo     X  santuario
 *   D  puerta sellada    g  compuerta     ^  escalera      v  bajada
 */
import { MAP_H, MAP_W } from '../config';
import { Difficulty, Topic } from '../systems/questions';
import {
  EnemyKind,
  ItemId,
  LoreId,
  NpcId,
  ZoneId,
} from './types';

export interface RuneDef {
  id: string;
  x: number;
  y: number;
  topic: Topic;
  difficulty: Difficulty;
  title: string;
}

export interface NpcDef {
  id: NpcId;
  x: number;
  y: number;
  name: string;
  role: string;
}

export interface ExitDef {
  x: number;
  y: number;
  to: ZoneId;
  spawn?: { x: number; y: number };
  requires?: ZoneId;
  lockedMsg?: string;
  label: string;
}

export interface BossPhase {
  topic: Topic;
  difficulty: Difficulty;
  pattern: 'cleave' | 'burst' | 'dash' | 'summon' | 'collapse';
  title: string;
}

export interface BossDef {
  x: number;
  y: number;
  name: string;
  kind: 'guardian' | 'sentinel' | 'colossus' | 'singular';
  introLines: string[];
  phaseLines: string[];
  defeatLines: string[];
  phases: BossPhase[];
}

export interface EnemySpawn {
  x: number;
  y: number;
  kind: EnemyKind;
  patrol?: number;
}

export interface ChestDef {
  id: string;
  x: number;
  y: number;
  item?: ItemId;
  hearts?: number;
  gold?: number;
  secret?: boolean;
  hint: string;
}

export interface LoreDef {
  id: LoreId;
  x: number;
  y: number;
  title: string;
  text: string[];
}

export interface MechanismDef {
  id: string;
  gate: { x: number; y: number };
  switches: { id: string; x: number; y: number }[];
  order: string[];
  solvedText: string;
  wrongText: string;
}

export interface ZoneDef {
  id: ZoneId;
  name: string;
  shortName: string;
  subtitle: string;
  tileset: 'overworld' | 'dungeon' | 'temple';
  ambience: 'town' | 'grove' | 'river' | 'city' | 'sanctum';
  map: string[];
  spawn: { x: number; y: number };
  intro: string[];
  runes: RuneDef[];
  npcs: NpcDef[];
  exits: ExitDef[];
  enemies: EnemySpawn[];
  chests: ChestDef[];
  lore: LoreDef[];
  mechanisms: MechanismDef[];
  shrines: { x: number; y: number }[];
  boss?: BossDef;
  reward?: { item: ItemId; lines: string[] };
  final?: boolean;
}

export const ITEMS: Record<ItemId, { name: string; icon: string; desc: string; kind: 'weapon' | 'tool' | 'consumable' | 'relic' }> = {
  fubini: { name: 'Cuchilla de Fubini', icon: '⚔', desc: 'Hoja que separa el espacio en dos órdenes. Aumenta el alcance y el daño de los cortes.', kind: 'weapon' },
  polar: { name: 'Brújula Polar', icon: '✥', desc: 'Aguja que siempre apunta al centro. Movimiento más rápido y esquiva más larga.', kind: 'tool' },
  lente: { name: 'Lente del Jacobiano', icon: '◈', desc: 'Revela la cuadrícula deformada y regala la primera pista de cada runa.', kind: 'tool' },
  pocion: { name: 'Elixir de area', icon: '✚', desc: 'Restaura tres corazones. Se usa con R.', kind: 'consumable' },
  fragmento_norte: { name: 'Fragmento septentrional', icon: '◇', desc: 'Tercio de una reliquia cartográfica anterior al Exilio.', kind: 'relic' },
  fragmento_este: { name: 'Fragmento oriental', icon: '◇', desc: 'Lámina de cobre con inscripciones de mareas imposibles.', kind: 'relic' },
  fragmento_sur: { name: 'Fragmento meridional', icon: '◇', desc: 'Parte de un instrumento que medía el peso del area.', kind: 'relic' },
  reliquia_carton: { name: 'Reliquia del Cartógrafo', icon: '✧', desc: 'Reunida, devuelve la memoria de la civilización perdida.', kind: 'relic' },
};

export const RELICS: Record<import('./types').RelicId, { name: string; icon: string; desc: string }> = {
  corazon_roto: { name: 'Corazón roto', icon: '♥', desc: 'Aumenta un corazón máximo y reduce el daño recibido.' },
  brujula_giros: { name: 'Brújula de giros', icon: '✥', desc: 'La esquiva recupera resistencia y dura más.' },
  ojo_cartografo: { name: 'Ojo del cartógrafo', icon: '◉', desc: 'Revela cofres ocultos y muestra runas cercanas en el mapa.' },
};

/* ───────── helpers de mapa ───────── */
type Grid = string[][];

function grid(fill = '.'): Grid {
  return Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) =>
      x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : fill,
    ),
  );
}
function put(g: Grid, x: number, y: number, ch: string) {
  if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) g[y][x] = ch;
}
function fill(g: Grid, x1: number, y1: number, x2: number, y2: number, ch: string) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(g, x, y, ch);
}
function line(g: Grid, x1: number, y1: number, x2: number, y2: number, ch: string) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    put(g, Math.round(x1 + ((x2 - x1) * i) / steps), Math.round(y1 + ((y2 - y1) * i) / steps), ch);
  }
}
function ring(g: Grid, cx: number, cy: number, rx: number, ry: number, ch: string) {
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    put(g, Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), ch);
  }
}
const toMap = (g: Grid): string[] => g.map((row) => row.join(''));

function plaza(): string[] {
  const g = grid(',');
  line(g, 1, 10, 30, 10, '=');
  line(g, 16, 1, 16, 18, '=');
  [4, 11, 21, 28].forEach((x) => line(g, x, 1, x, 10, '='));
  fill(g, 14, 8, 18, 12, '=');
  fill(g, 15, 9, 17, 11, '~');
  put(g, 16, 10, 'B');
  // casas con tejado y columnas de esquina
  const house = (x: number, y: number, w: number, h: number) => {
    fill(g, x, y, x + w - 1, y + h - 1, '#');
    fill(g, x + 1, y + 1, x + w - 2, y + h - 2, '.');
    put(g, x + Math.floor(w / 2), y + h - 1, '=');
  };
  house(2, 5, 6, 4);
  house(21, 5, 5, 4);
  house(2, 14, 6, 4);
  house(24, 14, 6, 4);
  // jardines y braseros
  [[7, 3], [8, 4], [9, 3], [27, 9], [28, 10], [7, 16], [8, 17], [20, 16], [22, 17], [12, 4], [19, 16]].forEach(([x, y]) => put(g, x, y, 'T'));
  [[6, 12], [26, 12], [12, 8], [20, 8], [13, 17], [23, 3]].forEach(([x, y]) => put(g, x, y, 'B'));
  [[3, 9], [29, 16], [10, 14], [23, 12], [12, 2], [19, 2], [6, 18], [28, 5]].forEach(([x, y]) => put(g, x, y, '*'));
  [[9, 8], [22, 9], [5, 12], [25, 3], [18, 18]].forEach(([x, y]) => put(g, x, y, 'o'));
  // portales
  [[4, 2], [11, 2], [21, 2], [28, 2]].forEach(([x, y]) => put(g, x, y, 'P'));
  put(g, 30, 18, 'C');
  put(g, 9, 17, 'L');
  put(g, 16, 6, 'X');
  return toMap(g);
}

function sanctum(kind: 'llanura' | 'valle' | 'ciudad' | 'templo'): string[] {
  const g = grid(kind === 'llanura' ? '.' : kind === 'templo' ? ',' : '.');
  // muro divisorio y puerta de las runas
  for (let y = 1; y < MAP_H - 1; y++) put(g, 16, y, kind === 'templo' ? 'c' : '#');
  put(g, 16, 10, 'D');
  // sendero principal
  line(g, 2, 10, 30, 10, kind === 'templo' ? '=' : '=');
  line(g, 3, 3, 3, 17, '=');
  line(g, 28, 3, 28, 17, '=');

  if (kind === 'llanura') {
    // cuadrícula de losa antigua: orden perfecto, casi demasiado
    for (let y = 3; y <= 17; y += 3) for (let x = 3; x <= 28; x += 3) put(g, x, y, 'c');
    fill(g, 7, 5, 9, 6, '#');
    fill(g, 22, 13, 24, 14, '#');
    fill(g, 10, 15, 12, 16, '=');
    [[5, 4], [11, 4], [5, 16], [25, 4], [25, 16]].forEach(([x, y]) => put(g, x, y, 'R'));
    [[6, 7], [13, 5], [9, 13], [20, 5], [24, 9], [21, 16]].forEach(([x, y]) => put(g, x, y, '*'));
    [[12, 7], [19, 14], [7, 11], [27, 7]].forEach(([x, y]) => put(g, x, y, 'o'));
    [[4, 10], [29, 10], [14, 3], [18, 17]].forEach(([x, y]) => put(g, x, y, 'B'));
  } else if (kind === 'valle') {
    // río serpenteante con puente
    for (let y = 2; y < 18; y++) {
      const x = 8 + Math.round(Math.sin(y / 2.4) * 3);
      for (let dx = -1; dx <= 1; dx++) put(g, x + dx, y, '~');
    }
    fill(g, 7, 9, 12, 11, '=');
    fill(g, 19, 4, 24, 6, '~');
    fill(g, 20, 13, 23, 15, '~');
    [[5, 3], [6, 4], [13, 15], [26, 4], [27, 16]].forEach(([x, y]) => put(g, x, y, 'T'));
    [[4, 6], [5, 15], [14, 5], [25, 12], [29, 7]].forEach(([x, y]) => put(g, x, y, 'o'));
    [[11, 3], [13, 6], [6, 13], [23, 8], [26, 16]].forEach(([x, y]) => put(g, x, y, '*'));
    [[4, 10], [29, 10], [14, 2], [18, 18]].forEach(([x, y]) => put(g, x, y, 'B'));
    // mecanismo de compuerta: tres pilares en la ribera oriental
    put(g, 21, 10, 'g');
    put(g, 20, 7, 'S'); put(g, 25, 8, 'S'); put(g, 24, 14, 'S');
  } else if (kind === 'ciudad') {
    // anillos concéntricos: plaza circular y calles radiales
    ring(g, 23, 10, 7, 6, '=');
    ring(g, 23, 10, 4, 3, '.');
    [[16, 10], [23, 4], [30, 10], [23, 16]].forEach(([x, y]) => put(g, x, y, '='));
    [[6, 4], [10, 4], [6, 14], [10, 14], [12, 7], [12, 12], [26, 3], [26, 17]].forEach(([x, y]) => put(g, x, y, 'c'));
    fill(g, 5, 8, 7, 12, '#');
    [[8, 3], [9, 16], [13, 3], [28, 6], [28, 14]].forEach(([x, y]) => put(g, x, y, 'B'));
    [[11, 10], [14, 4], [14, 16], [27, 10], [22, 3], [22, 17]].forEach(([x, y]) => put(g, x, y, '*'));
    [[8, 8], [9, 12], [28, 4], [29, 16]].forEach(([x, y]) => put(g, x, y, 'o'));
  } else {
    // templo: nave de columnas, ábside elevado y cámara secreta
    [[5, 4], [10, 4], [5, 16], [10, 16], [19, 4], [24, 4], [19, 16], [24, 16], [28, 5], [28, 15]].forEach(([x, y]) => put(g, x, y, 'c'));
    fill(g, 21, 7, 26, 13, '=');
    fill(g, 22, 9, 25, 11, '#');
    put(g, 23, 10, 'R');
    [[12, 3], [20, 3], [12, 17], [20, 17], [29, 3], [29, 17]].forEach(([x, y]) => put(g, x, y, 'B'));
    [[14, 7], [14, 13], [7, 7], [7, 13], [21, 5], [21, 15]].forEach(([x, y]) => put(g, x, y, '*'));
    // cámara de los ecos: compuerta y tres obeliscos
    put(g, 12, 10, 'g');
    put(g, 8, 3, 'S'); put(g, 6, 9, 'S'); put(g, 8, 16, 'S');
    fill(g, 3, 8, 5, 12, '=');
  }

  put(g, 2, 18, 'P');
  put(g, 29, 3, 'C');
  put(g, 29, 17, 'C');
  put(g, 4, 7, 'C');
  put(g, 13, 17, 'L');
  put(g, 27, 7, 'L');
  put(g, 6, 10, 'X');
  return toMap(g);
}

/* ───────── ZONAS ───────── */
export const ZONES: Record<ZoneId, ZoneDef> = {
  cartesia: {
    id: 'cartesia',
    name: 'Cartesia · La ciudad deformada',
    shortName: 'Cartesia',
    subtitle: 'Donde los mapas dejaron de mentir',
    tileset: 'overworld',
    ambience: 'town',
    map: plaza(),
    spawn: { x: 16, y: 14 },
    intro: [
      'Cartesia se despierta torcida. Las calles se estiran al caminar y la fuente dibuja órbitas imposibles.',
      'La Anciana te espera junto al ayuntamiento. Dicen que lleva treinta años dibujando el mismo mapa y todavía no lo termina.',
    ],
    runes: [],
    npcs: [
      { id: 'anciana', x: 18, y: 12, name: 'Anciana Cartesia', role: 'Guardiana del archivo' },
      { id: 'errante', x: 11, y: 12, name: 'Errante de los caminos', role: 'Viajero sin maps' },
    ],
    exits: [
      { x: 4, y: 2, to: 'llanura', label: 'Llanura Rectangular' },
      { x: 11, y: 2, to: 'valle', requires: 'llanura', label: 'Valle de las Regiones', lockedMsg: 'El sello del Valle aún resiste. El Guardián Rectángulo debe caer primero.' },
      { x: 21, y: 2, to: 'ciudad', requires: 'valle', label: 'Ciudad Polar', lockedMsg: 'La Ciudad Polar está cerrada. El Centinela del Valle guarda la llave.' },
      { x: 28, y: 2, to: 'templo', requires: 'ciudad', label: 'Templo del Jacobiano', lockedMsg: 'Solo se abre ante quien domina el giro. Vence al Coloso Polar.' },
    ],
    enemies: [],
    chests: [{ id: 'cartesia_oculto', x: 30, y: 18, hearts: 1, gold: 20, secret: true, hint: 'Un cofre detrás del gran árbol del sureste.' }],
    lore: [{ id: 'tabla_origen', x: 9, y: 17, title: 'Tabla del origen', text: [
      'Antes del Exilio, los cartógrafos medían el mundo con hilos de luz.',
      'Cada hilo guardaba un área. Cada área, un nombre. Cada nombre, una memoria.',
      'Cuando el hilo se rompió, los nombres se fueron… y con ellos, la ciudad.',
    ] }],
    mechanisms: [],
    shrines: [{ x: 16, y: 6 }],
  },

  llanura: {
    id: 'llanura',
    name: 'Llanura Rectangular',
    shortName: 'Llanura',
    subtitle: 'El orden antes del desorden',
    tileset: 'dungeon',
    ambience: 'grove',
    map: sanctum('llanura'),
    spawn: { x: 2, y: 10 },
    intro: [
      'La llanura está dividida en parcelas perfectas. Hay runas talladas en cinco obeliscos; tres siguen despiertas.',
      'El Maestro Fubini dejó su cuchilla aquí. Se dice que corta un rectángulo en dos órdenes sin cambiar su área.',
    ],
    runes: [
      { id: 'llanura_r1', x: 5, y: 4, topic: 'rect', difficulty: 1, title: 'Runa del orden primero' },
      { id: 'llanura_r2', x: 11, y: 4, topic: 'rect', difficulty: 2, title: 'Runa del orden segundo' },
      { id: 'llanura_r3', x: 5, y: 16, topic: 'rect', difficulty: 2, title: 'Runa del producto' },
    ],
    npcs: [{ id: 'fubini', x: 4, y: 12, name: 'Maestro Fubini', role: 'Cartógrafo de los límites rectos' }],
    exits: [{ x: 2, y: 18, to: 'cartesia', spawn: { x: 4, y: 2 }, label: 'Volver a Cartesia' }],
    enemies: [
      { x: 9, y: 6, kind: 'espino' }, { x: 13, y: 13, kind: 'espiritu' },
      { x: 8, y: 15, kind: 'espino' }, { x: 22, y: 5, kind: 'arquero', patrol: 3 },
      { x: 25, y: 14, kind: 'espiritu' },
    ],
    chests: [
      { id: 'llanura_c1', x: 29, y: 3, item: 'pocion', gold: 12, hint: 'Al fondo de la parcela nororiental.' },
      { id: 'llanura_c2', x: 4, y: 8, hearts: 1, hint: 'Bajo una losa suelta, cerca del camino.' },
    ],
    lore: [{ id: 'carta_exilio', x: 13, y: 17, title: 'Carta del exilio', text: [
      'Firmada por el Primer Cartógrafo: "No fue una guerra la que nos expulsó, sino un error de medición."',
      'Midieron el relieve con un marco que no podía cambiar de tamaño. Al girar, el marco se negó.',
      'La gente que vivía dentro dejó de caber en el mapa.',
    ] }],
    mechanisms: [],
    shrines: [{ x: 6, y: 10 }],
    boss: {
      x: 26, y: 10, name: 'Guardián Rectángulo', kind: 'guardian',
      introLines: [
        'El Guardián se alza: un cuerpo de losas cuadriculadas, cada una con una suma inconclusa.',
        '«Cada celda mía es un rectángulo. Cambia el orden si te atreves: el área no cambiará… pero yo sí.»',
      ],
      phaseLines: ['La primera capa se agrieta. ¡Todavía quedan dos órdenes por probar!', 'Tu cuchilla atraviesa la segunda capa. El Guardián empieza a dudar.'],
      defeatLines: ['«Imposible… las sumas convergieron…»', 'Las losas vuelven a encajar. La Cuchilla de Fubini queda abandonada en el polvo.'],
      phases: [
        { topic: 'rect', difficulty: 1, pattern: 'cleave', title: 'Primer orden' },
        { topic: 'rect', difficulty: 2, pattern: 'burst', title: 'Orden invertido' },
        { topic: 'rect', difficulty: 3, pattern: 'dash', title: 'Producto separable' },
      ],
    },
    reward: { item: 'fubini', lines: ['Recoges la Cuchilla de Fubini. Tu ataque llega más lejos y corta con más fuerza.'] },
  },

  valle: {
    id: 'valle',
    name: 'Valle de las Regiones',
    shortName: 'Valle',
    subtitle: 'Fronteras que respiran',
    tileset: 'dungeon',
    ambience: 'river',
    map: sanctum('valle'),
    spawn: { x: 2, y: 10 },
    intro: [
      'El río del valle no sigue una línea: se curva como una frontera tipo I que cambia de parecer.',
      'La Guardiana Tipo-II vive entre los pilares. Solo abre los caminos a quien sabe dibujar la región antes de integrar.',
    ],
    runes: [
      { id: 'valle_r1', x: 5, y: 3, topic: 'general', difficulty: 1, title: 'Runa de la frontera curva' },
      { id: 'valle_r2', x: 13, y: 6, topic: 'general', difficulty: 2, title: 'Runa del orden invertido' },
      { id: 'valle_r3', x: 5, y: 16, topic: 'general', difficulty: 2, title: 'Runa de la región partida' },
    ],
    npcs: [{ id: 'guardiana', x: 4, y: 13, name: 'Guardiana Tipo-II', role: 'Tejedora de fronteras' }],
    exits: [{ x: 2, y: 18, to: 'cartesia', spawn: { x: 11, y: 2 }, label: 'Volver a Cartesia' }],
    enemies: [
      { x: 15, y: 5, kind: 'arquero', patrol: 3 }, { x: 15, y: 15, kind: 'espino' },
      { x: 26, y: 5, kind: 'espiritu' }, { x: 26, y: 15, kind: 'centinela' },
      { x: 22, y: 11, kind: 'arquero' },
    ],
    chests: [
      { id: 'valle_c1', x: 29, y: 3, item: 'pocion', gold: 18, hint: 'En la orilla alta, tras los árboles.' },
      { id: 'valle_c2', x: 29, y: 17, item: 'fragmento_este', secret: true, hint: 'Un cofre sin dueño junto al viejo puente roto.' },
    ],
    lore: [{ id: 'diario_ultimo', x: 13, y: 17, title: 'Diario del último tejedor', text: [
      'Hoy el río subió por la ladera y dibujó una parábola sobre la piedra.',
      'Cambié el orden de integración y encontré una mano pequeña atrapada entre los límites.',
      'Si alguien lee esto: las fronteras no son muros. Son promesas.',
    ] }],
    mechanisms: [{
      id: 'valle_compuerta',
      gate: { x: 21, y: 10 },
      switches: [{ id: 'v1', x: 20, y: 7 }, { id: 'v2', x: 25, y: 8 }, { id: 'v3', x: 24, y: 14 }],
      order: ['v2', 'v1', 'v3'],
      solvedText: 'Los tres pilares zumban al unísono. La compuerta se abre.',
      wrongText: 'El agua retrocede: el orden era distinto. Los pilares vuelven a apagarse.',
    }],
    shrines: [{ x: 6, y: 10 }],
    boss: {
      x: 27, y: 10, name: 'Centinela del Valle', kind: 'sentinel',
      introLines: [
        'El Centinela camina sobre el agua sin mojarse. Su cuerpo cambia de forma al mirarlo.',
        '«¿Tipo I o tipo II? La región es la misma. Solo una de las dos te dejará pasar.»',
      ],
      phaseLines: ['La primera frontera cae. Ahora viene la curva que no se deja integrar.', 'El Centinela se parte en dos regiones… y una de ellas es más difícil.'],
      defeatLines: ['«Cambiaste el orden… y mi muralla era solo una frontera mal dibujada.»', 'La Brújula Polar rueda hasta tus pies.'],
      phases: [
        { topic: 'general', difficulty: 1, pattern: 'burst', title: 'Frontera simple' },
        { topic: 'general', difficulty: 2, pattern: 'dash', title: 'Parábola cambiante' },
        { topic: 'general', difficulty: 3, pattern: 'summon', title: 'Región partida' },
      ],
    },
    reward: { item: 'polar', lines: ['La Brújula Polar se orienta hacia el centro del mundo. Te mueves más rápido.'] },
  },

  ciudad: {
    id: 'ciudad',
    name: 'Ciudad Polar',
    shortName: 'Ciudad Polar',
    subtitle: 'Donde el ángulo marca la hora',
    tileset: 'dungeon',
    ambience: 'city',
    map: sanctum('ciudad'),
    spawn: { x: 2, y: 10 },
    intro: [
      'La Ciudad Polar tiene calles circulares y relojes sin aguja: solo marcan ángulos.',
      'Cada plaza guarda un anillo de piedra. La Cartógrafa dice que olvidar el factor r es el pecado más caro de la ciudad.',
    ],
    runes: [
      { id: 'ciudad_r1', x: 4, y: 3, topic: 'polar', difficulty: 1, title: 'Runa del radio' },
      { id: 'ciudad_r2', x: 10, y: 7, topic: 'polar', difficulty: 2, title: 'Runa del ángulo' },
      { id: 'ciudad_r3', x: 5, y: 16, topic: 'polar', difficulty: 2, title: 'Runa del elemento de área' },
    ],
    npcs: [{ id: 'cartografa', x: 4, y: 12, name: 'Cartógrafa Polar', role: 'Relojera de los anillos' }],
    exits: [{ x: 2, y: 18, to: 'cartesia', spawn: { x: 21, y: 2 }, label: 'Volver a Cartesia' }],
    enemies: [
      { x: 9, y: 6, kind: 'espiritu' }, { x: 9, y: 14, kind: 'arquero' },
      { x: 20, y: 4, kind: 'centinela' }, { x: 20, y: 16, kind: 'centinela' },
      { x: 27, y: 10, kind: 'espino' }, { x: 14, y: 10, kind: 'sombra' },
    ],
    chests: [
      { id: 'ciudad_c1', x: 29, y: 3, item: 'pocion', gold: 25, hint: 'En el anillo exterior, al noreste.' },
      { id: 'ciudad_c2', x: 29, y: 17, item: 'fragmento_norte', secret: true, hint: 'Detrás del reloj detenido.' },
    ],
    lore: [{ id: 'inscripcion_singular', x: 13, y: 17, title: 'Inscripción del observatorio', text: [
      '«Cuando el radio sea cero, todas las direcciones serán la misma.»',
      'El Singular no quiere destruir el mundo: quiere que sea un único punto, fácil de medir.',
      'Pero un punto no tiene historia. Y un cartógrafo sin historia no es cartógrafo.',
    ] }],
    mechanisms: [],
    shrines: [{ x: 6, y: 10 }],
    boss: {
      x: 23, y: 10, name: 'Coloso Polar', kind: 'colossus',
      introLines: [
        'El Coloso gira sobre un disco de piedra. Cada giro comprime el aire en un anillo cada vez más pequeño.',
        '«Giro, giro, giro… y mi área se reduce. ¿Sientes falta del factor r?»',
      ],
      phaseLines: ['El primer anillo se rompe. Quedan dos vueltas.', 'El disco se acelera. La última fase exige valor absoluto.'],
      defeatLines: ['«Dejé de girar… la integral convergió.»', 'Del Coloso solo queda una brújula que apunta hacia adelante.'],
      phases: [
        { topic: 'polar', difficulty: 1, pattern: 'burst', title: 'Primer anillo' },
        { topic: 'polar', difficulty: 2, pattern: 'dash', title: 'Sector giratorio' },
        { topic: 'polar', difficulty: 3, pattern: 'collapse', title: 'Radio cero' },
      ],
    },
    reward: { item: 'lente', lines: ['El Lente del Jacobiano se ajusta a tu ojo. Ahora puedes ver cómo se deforma el espacio.'] },
  },

  templo: {
    id: 'templo',
    name: 'Templo del Jacobiano',
    shortName: 'Templo',
    subtitle: 'El lugar donde el área aprendió a cambiar',
    tileset: 'temple',
    ambience: 'sanctum',
    map: sanctum('templo'),
    spawn: { x: 2, y: 10 },
    intro: [
      'El templo está en pie, pero sus columnas se doblan en ángulos que no deberían existir.',
      'El Sabio Jacobi dice que el determinante es la huella que deja la transformación al pisar el terreno.',
    ],
    runes: [
      { id: 'templo_r1', x: 5, y: 4, topic: 'jacobian', difficulty: 1, title: 'Runa de la huella' },
      { id: 'templo_r2', x: 10, y: 6, topic: 'change', difficulty: 2, title: 'Runa del cambio' },
      { id: 'templo_r3', x: 10, y: 16, topic: 'jacobian', difficulty: 2, title: 'Runa del colapso' },
    ],
    npcs: [
      { id: 'sabio', x: 4, y: 12, name: 'Sabio Jacobi', role: 'Último lector del archivo' },
      { id: 'recaudador', x: 8, y: 8, name: 'Recaudador de ecos', role: 'Coleccionista de fragmentos' },
    ],
    exits: [{ x: 2, y: 18, to: 'cartesia', spawn: { x: 28, y: 2 }, label: 'Volver a Cartesia' }],
    enemies: [
      { x: 13, y: 6, kind: 'sombra' }, { x: 13, y: 14, kind: 'centinela' },
      { x: 20, y: 6, kind: 'arquero' }, { x: 20, y: 14, kind: 'espiritu' },
      { x: 27, y: 6, kind: 'sombra' }, { x: 27, y: 14, kind: 'centinela' },
      { x: 15, y: 10, kind: 'sombra' },
    ],
    chests: [
      { id: 'templo_c1', x: 29, y: 3, item: 'pocion', gold: 30, hint: 'En el ábside norte.' },
      { id: 'templo_c2', x: 29, y: 17, hearts: 1, gold: 25, hint: 'Bajo los restos del trono.' },
      { id: 'templo_secreto', x: 3, y: 3, item: 'reliquia_carton', gold: 60, secret: true, hint: 'La cámara de los ecos guarda algo más que polvo.' },
    ],
    lore: [
      { id: 'tabla_origen', x: 13, y: 17, title: 'Tabla sellada', text: [
        '«Toda transformación conserva algo y pierde algo. El cartógrafo solo decide qué.»',
        'Los antiguos grabaron esta frase en la entrada para recordar que el area nunca desaparece: solo cambia de forma.',
      ] },
    ],
    mechanisms: [{
      id: 'templo_ecos',
      gate: { x: 12, y: 10 },
      switches: [{ id: 't1', x: 8, y: 3 }, { id: 't2', x: 6, y: 9 }, { id: 't3', x: 8, y: 16 }],
      order: ['t3', 't1', 't2'],
      solvedText: 'Los obeliscos respiraron. La cámara de los ecos se abre.',
      wrongText: 'Un eco devuelve tu paso: el orden no era ese.',
    }],
    shrines: [{ x: 6, y: 10 }],
    boss: {
      x: 23, y: 10, name: 'El Singular', kind: 'singular',
      introLines: [
        'El Singular no tiene rostro: solo un punto que se traga la luz. A su alrededor, el suelo se pliega como papel.',
        '«Todo lo que existe puede reducirse a cero. Ven a comprobarlo.»',
      ],
      phaseLines: ['El primer pliegue se deshace. Todavía quedan cuatro formas de colapsar.', 'Tu cambio de variables deja un factor intacto. El punto duda.', 'Las regiones vuelven a abrirse. El Singular se está quedando sin argumentos.', 'Una última transformación. No falles el signo.'],
      defeatLines: [
        '«No… el determinante ya no es cero… el espacio vuelve a tener memoria…»',
        'El punto se despliega en miles de calles, nombres y pasos. Cartesia vuelve a caber en su mapa.',
        'Vuelve cuando quieras: las runas siguen ahí, esperando práctica.',
      ],
      phases: [
        { topic: 'jacobian', difficulty: 2, pattern: 'cleave', title: 'Determinante nulo' },
        { topic: 'change', difficulty: 2, pattern: 'burst', title: 'Cambio sin factor' },
        { topic: 'general', difficulty: 3, pattern: 'summon', title: 'Regiones que se pliegan' },
        { topic: 'polar', difficulty: 3, pattern: 'dash', title: 'Radio que se anula' },
        { topic: 'change', difficulty: 3, pattern: 'collapse', title: 'Última transformación' },
      ],
    },
    final: true,
  },
};

export const ZONE_ORDER: ZoneId[] = ['cartesia', 'llanura', 'valle', 'ciudad', 'templo'];

export function isSolidChar(ch: string): boolean {
  return ch === '#' || ch === 'c' || ch === 'T' || ch === 'o' || ch === '~' || ch === 'D' || ch === 'g';
}

export function charAt(zone: ZoneDef, x: number, y: number): string {
  const row = zone.map[y];
  if (!row || x < 0 || x >= row.length) return '#';
  return row[x];
}
