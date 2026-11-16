/**
 * Definición de TODAS las zonas del juego. Agregar contenido = agregar datos aquí.
 *
 * Mapas ASCII (30 x 16 casillas de 32 px):
 *   '#' pared/árbol (bloquea)   '.' suelo/pasto   '=' camino   '~' agua (bloquea)
 *   'D' puerta del guardián (se abre al resolver todas las runas de la zona)
 * Todas las coordenadas de entidades están en casillas (x, y).
 */
import { MAP_H, MAP_W } from '../config';
import { Difficulty, Topic } from '../systems/questions';
import { ItemId, ZoneId } from './types';

export interface RuneDef {
  x: number;
  y: number;
  topic: Topic;
  difficulty: Difficulty;
}
export interface NpcDef {
  x: number;
  y: number;
  name: string;
  lines: string[];
  doneLines?: string[];
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
}
export interface BossDef {
  x: number;
  y: number;
  name: string;
  introLines: string[];
  phaseLines: string[]; // una por fase, menos la última
  defeatLines: string[];
  phases: BossPhase[];
}
export interface ZoneDef {
  id: ZoneId;
  name: string;
  tileset: 'overworld' | 'dungeon';
  map: string[];
  spawn: { x: number; y: number };
  intro: string[];
  runes: RuneDef[];
  npcs: NpcDef[];
  exits: ExitDef[];
  enemies: { x: number; y: number }[];
  boss?: BossDef;
  reward?: { item: ItemId; lines: string[] };
  final?: boolean;
}

export const ITEMS: Record<ItemId, { name: string; icon: string; desc: string }> = {
  fubini: { name: 'Cuchilla de Fubini', icon: '⚔️', desc: 'Corta el espacio en dos órdenes: más alcance de ataque.' },
  polar: { name: 'Brújula Polar', icon: '🧭', desc: 'Te orienta en (r, θ): caminas un 25 % más rápido.' },
  lente: { name: 'Lente del Jacobiano', icon: '🔍', desc: 'Muestra la cuadrícula deformada (tecla Q) y te da la primera pista gratis.' },
};

/* ───────── helpers para armar mapas ───────── */
type Grid = string[][];

function grid(fill: string): Grid {
  return Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) => (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : fill)),
  );
}
function put(g: Grid, x: number, y: number, ch: string) {
  g[y][x] = ch;
}
function fillRect(g: Grid, x1: number, y1: number, x2: number, y2: number, ch: string) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) put(g, x, y, ch);
}
const toMap = (g: Grid): string[] => g.map((r) => r.join(''));

/** Mazmorra base: sala izquierda (runas) + pared con puerta en (13,8) + sala derecha (jefe). */
function dungeon(decor: (g: Grid) => void): string[] {
  const g = grid('.');
  for (let y = 1; y < MAP_H - 1; y++) put(g, 13, y, '#');
  put(g, 13, 8, 'D');
  decor(g);
  return toMap(g);
}

function hub(): string[] {
  const g = grid('.');
  fillRect(g, 1, 8, MAP_W - 2, 8, '='); // calle principal
  fillRect(g, 14, 8, 14, MAP_H - 2, '='); // calle sur
  [4, 11, 18, 25].forEach((x) => fillRect(g, x, 3, x, 8, '=')); // calles a los portales
  fillRect(g, 20, 11, 24, 13, '~'); // estanque
  [
    [2, 2], [3, 12], [8, 11], [9, 12], [6, 13], [27, 13], [26, 10], [28, 5],
    [8, 2], [15, 2], [22, 2], [1, 6], [28, 12], [17, 12], [12, 13],
  ].forEach(([x, y]) => put(g, x, y, '#'));
  return toMap(g);
}

const back = (x: number, y: number): ExitDef => ({
  x: 2,
  y: 14,
  to: 'cartesia',
  spawn: { x, y },
  label: 'Volver a Cartesia',
});

/* ───────── ZONAS ───────── */
export const ZONES: Record<ZoneId, ZoneDef> = {
  cartesia: {
    id: 'cartesia',
    name: 'Cartesia · El Reino',
    tileset: 'overworld',
    map: hub(),
    spawn: { x: 14, y: 12 },
    intro: [
      'Cartesia lleva días deformándose: las calles se estiran, los ríos cambian de forma y los mapas ya no coinciden con el terreno.',
      'Dicen que un ser llamado El Singular quiere llevar todo el reino a |J| = 0: área cero, nada invertible, nada que medir.',
      'Tú eres el nuevo aprendiz de cartógrafo. Habla con la Anciana Cartesia (acércate y presiona E o el botón A).',
    ],
    runes: [],
    npcs: [
      {
        x: 15,
        y: 10,
        name: 'Anciana Cartesia',
        lines: [
          'Bienvenido, aprendiz. Tu misión: recorrer cuatro regiones y recuperar las herramientas que mantienen estable el espacio.',
          'En cada mazmorra hay RUNAS: descífralas resolviendo integrales. Cuando todas brillen, se abre la puerta del guardián.',
          'Controles: moverte con WASD/flechas · E o A para interactuar · ESPACIO o B para atacar · J abre el Diario de fórmulas.',
          'En Cartesia siempre recuperas tus corazones. Empieza por la Llanura Rectangular, al noroeste.',
        ],
        doneLines: [
          '¡Lo lograste! El Singular se desvaneció y el reino volvió a su forma.',
          'Puedes seguir practicando en las runas ya descifradas: te servirán para el parcial. ¡Gracias, cartógrafo!',
        ],
      },
    ],
    exits: [
      { x: 4, y: 3, to: 'llanura', label: 'Llanura Rectangular', lockedMsg: '' },
      { x: 11, y: 3, to: 'valle', requires: 'llanura', label: 'Valle de las Regiones', lockedMsg: 'El portal del Valle está sellado. Vence al Guardián Rectángulo primero.' },
      { x: 18, y: 3, to: 'ciudad', requires: 'valle', label: 'Ciudad Polar', lockedMsg: 'El portal de Ciudad Polar está sellado. Vence al Centinela del Valle primero.' },
      { x: 25, y: 3, to: 'templo', requires: 'ciudad', label: 'Templo del Jacobiano', lockedMsg: 'El Templo del Jacobiano está sellado. Vence al Coloso Polar en Ciudad Polar primero.' },
    ],
    enemies: [],
  },

  llanura: {
    id: 'llanura',
    name: 'Llanura Rectangular',
    tileset: 'dungeon',
    map: dungeon((g) => {
      fillRect(g, 7, 9, 8, 10, '#');
      fillRect(g, 17, 4, 18, 5, '#');
      fillRect(g, 17, 11, 18, 12, '#');
    }),
    spawn: { x: 3, y: 8 },
    intro: [
      'La Llanura Rectangular: aquí todo es ordenado… o lo era. Los bloques de piedra se desacomodaron.',
      'Pista del reino: sobre un rectángulo, el orden de integración no importa (Fubini). ¡Aprovéchalo!',
    ],
    runes: [
      { x: 4, y: 3, topic: 'rect', difficulty: 1 },
      { x: 9, y: 6, topic: 'rect', difficulty: 1 },
      { x: 5, y: 12, topic: 'rect', difficulty: 2 },
    ],
    npcs: [
      {
        x: 2,
        y: 4,
        name: 'Maestro Fubini',
        lines: [
          'Escucha: si integras f(x,y) sobre [a,b]×[c,d], puedes ir primero en y y luego en x… o al revés. ¡Mismo resultado!',
          'Si además f(x,y) = g(x)·h(y), la integral doble es el producto de dos integrales simples.',
          'Ejemplo: ∬ x·y sobre [0,2]×[0,3] = (∫₀² x dx)(∫₀³ y dy) = 2 · 4.5 = 9.',
        ],
        doneLines: ['El Guardián cayó. Llévate la Cuchilla de Fubini; ¡parte el espacio en dos órdenes!'],
      },
    ],
    exits: [back(4, 5)],
    enemies: [{ x: 9, y: 11 }, { x: 7, y: 2 }, { x: 20, y: 9 }],
    boss: {
      x: 22,
      y: 8,
      name: 'Guardián Rectángulo',
      introLines: [
        'Soy el Guardián Rectángulo. Cada celda de mi cuadrícula es una suma de Riemann que no pudiste terminar.',
        'Responde mis tres fases. Si fallas, perderás un corazón… pero el problema cambiará.',
      ],
      phaseLines: ['¡Mi primera capa cayó! Pero la segunda es más espesa…', 'Tu Fubini es sólido… ¡aguanta mi última fase!'],
      defeatLines: ['Imposible… el rectángulo se cerró. Las sumas convergieron.', 'El Guardián se desvanece en una lluvia de cuadritos.'],
      phases: [
        { topic: 'rect', difficulty: 1 },
        { topic: 'rect', difficulty: 2 },
        { topic: 'rect', difficulty: 3 },
      ],
    },
    reward: {
      item: 'fubini',
      lines: ['¡Obtuviste la CUCHILLA DE FUBINI! ⚔️', 'Efecto: tu ataque llega más lejos. El portal al Valle de las Regiones se desbloqueó.'],
    },
  },

  valle: {
    id: 'valle',
    name: 'Valle de las Regiones',
    tileset: 'dungeon',
    map: dungeon((g) => {
      fillRect(g, 6, 7, 9, 9, '~');
      fillRect(g, 17, 3, 20, 4, '~');
      fillRect(g, 17, 12, 20, 13, '~');
    }),
    spawn: { x: 3, y: 8 },
    intro: [
      'El Valle de las Regiones: aquí las fronteras ya no son rectas. Hay parábolas, diagonales… y límites que dependen de x.',
      'Consejo: dibuja la región, decide si es tipo I o tipo II y, si la integral se pone fea, ¡cambia el orden!',
    ],
    runes: [
      { x: 4, y: 3, topic: 'general', difficulty: 1 },
      { x: 10, y: 5, topic: 'general', difficulty: 1 },
      { x: 5, y: 12, topic: 'general', difficulty: 2 },
    ],
    npcs: [
      {
        x: 2,
        y: 4,
        name: 'Guardiana Tipo-II',
        lines: [
          'Tipo I: x entre constantes, y entre curvas en x. Tipo II: y entre constantes, x entre curvas en y.',
          'Ejemplo: D: 0 ≤ x ≤ 2, 0 ≤ y ≤ x. ∬ x dA = ∫₀² x·x dx = 8/3.',
          'Truco de jefes: si ∫ e^{y²} dy te bloquea, mira la región y cambia a dx dy. ¡Aparecerá una y que arregla todo!',
        ],
        doneLines: ['¡Dominaste las regiones! La Brújula Polar es tuya.'],
      },
    ],
    exits: [back(11, 5)],
    enemies: [{ x: 9, y: 12 }, { x: 4, y: 7 }, { x: 22, y: 5 }, { x: 24, y: 11 }],
    boss: {
      x: 22,
      y: 8,
      name: 'Centinela del Valle',
      introLines: [
        'Soy el Centinela. Mis fronteras son curvas y mis límites cambian con x.',
        '¿Sabrás plantear bien la región… y cambiar el orden cuando toque?',
      ],
      phaseLines: ['Bien planteado… pero mi segunda frontera es una parábola.', 'Última prueba: la integral que no se deja integrar.'],
      defeatLines: ['Ya veo… cambiaste el orden y mi muralla se deshizo.', 'El Centinela se disuelve en un mar de límites.'],
      phases: [
        { topic: 'general', difficulty: 1 },
        { topic: 'general', difficulty: 2 },
        { topic: 'general', difficulty: 3 },
      ],
    },
    reward: {
      item: 'polar',
      lines: ['¡Obtuviste la BRÚJULA POLAR! 🧭', 'Efecto: caminas un 25 % más rápido. El portal a Ciudad Polar se desbloqueó.'],
    },
  },

  ciudad: {
    id: 'ciudad',
    name: 'Ciudad Polar',
    tileset: 'dungeon',
    map: dungeon((g) => {
      [[6, 4], [10, 4], [6, 12], [10, 12], [17, 3], [17, 13], [24, 3], [24, 13], [20, 6], [20, 10]].forEach(([x, y]) => put(g, x, y, '#'));
    }),
    spawn: { x: 3, y: 8 },
    intro: [
      'Ciudad Polar: calles circulares, plazas redondas y un reloj que marca ángulos en vez de horas.',
      'Aquí x² + y² = r² y dA = r dr dθ. Olvidar el r extra es la multa más cara de la ciudad.',
    ],
    runes: [
      { x: 4, y: 3, topic: 'polar', difficulty: 1 },
      { x: 9, y: 7, topic: 'polar', difficulty: 1 },
      { x: 5, y: 12, topic: 'polar', difficulty: 2 },
    ],
    npcs: [
      {
        x: 2,
        y: 4,
        name: 'Cartógrafa Polar',
        lines: [
          'Cambia a polares cuando la región sea un disco, un anillo o un sector, o cuando veas x² + y² en el integrando.',
          'x = r cosθ, y = r senθ. El elemento de área es r dr dθ.',
          'Ejemplo: ∬ (x²+y²) dA sobre r ≤ 1 → ∫₀^{2π}∫₀¹ r²·r dr dθ = 2π · 1/4 = π/2.',
        ],
        doneLines: ['El Coloso cayó. El Lente del Jacobiano te enseñará cómo se deforma el espacio.'],
      },
    ],
    exits: [back(18, 5)],
    enemies: [{ x: 8, y: 10 }, { x: 4, y: 12 }, { x: 22, y: 4 }, { x: 22, y: 12 }, { x: 16, y: 8 }],
    boss: {
      x: 22,
      y: 8,
      name: 'Coloso Polar',
      introLines: [
        'Giro y giro y nunca termino. Soy el Coloso Polar, guardián del ángulo y del radio.',
        '¿Recuerdas el r de r dr dθ? Más te vale.',
      ],
      phaseLines: ['Mi primer anillo se rompió… ¡pero hay más vueltas!', 'Casi me tienes. Ahora, la gaussiana o el cuadrante: ¡escoge bien!'],
      defeatLines: ['Dejé de girar… la integral convergió.', 'El Coloso se desarma en pedazos de arco.'],
      phases: [
        { topic: 'polar', difficulty: 1 },
        { topic: 'polar', difficulty: 2 },
        { topic: 'polar', difficulty: 3 },
      ],
    },
    reward: {
      item: 'lente',
      lines: ['¡Obtuviste el LENTE DEL JACOBIANO! 🔍', 'Efecto: tecla Q (o botón Lente) muestra la cuadrícula deformada y las preguntas te dan la primera pista gratis. El Templo se desbloqueó.'],
    },
  },

  templo: {
    id: 'templo',
    name: 'Templo del Jacobiano',
    tileset: 'dungeon',
    map: dungeon((g) => {
      fillRect(g, 4, 5, 5, 6, '#');
      fillRect(g, 8, 10, 9, 11, '#');
      fillRect(g, 17, 3, 18, 4, '#');
      fillRect(g, 17, 12, 18, 13, '#');
      fillRect(g, 24, 5, 25, 6, '#');
      fillRect(g, 24, 10, 25, 11, '#');
    }),
    spawn: { x: 3, y: 8 },
    final: true,
    intro: [
      'El Templo del Jacobiano. El aire se siente delgado: aquí el espacio se estira y se comprime a cada paso.',
      'El Singular está más allá de la puerta. Para vencerlo tendrás que dominar el determinante de las derivadas parciales y el cambio de variables.',
    ],
    runes: [
      { x: 4, y: 3, topic: 'jacobian', difficulty: 1 },
      { x: 10, y: 6, topic: 'change', difficulty: 1 },
      { x: 5, y: 12, topic: 'jacobian', difficulty: 2 },
    ],
    npcs: [
      {
        x: 2,
        y: 4,
        name: 'Sabio Jacobi',
        lines: [
          'El Jacobiano ∂(x,y)/∂(u,v) = x_u y_v − x_v y_u mide cuánto cambia el área bajo la transformación.',
          'Si J = 0 en algún punto, la transformación colapsa ahí. Por eso El Singular lo busca.',
          'Cambio de variables: ∬ f dA = ∬ f(x(u,v), y(u,v)) |J| du dv. ¡Valor absoluto! Y recuerda transformar también la región.',
        ],
        doneLines: ['Lo lograste. Ahora sabes que |J| nunca debe quedar en cero.'],
      },
    ],
    exits: [back(25, 5)],
    enemies: [{ x: 9, y: 4 }, { x: 8, y: 13 }, { x: 4, y: 9 }, { x: 22, y: 4 }, { x: 22, y: 12 }, { x: 16, y: 8 }],
    boss: {
      x: 22,
      y: 8,
      name: 'El Singular',
      introLines: [
        'Soy El Singular. Mi objetivo es simple: |J| = 0 en todas partes. Sin área, sin integrales, sin problemas.',
        'Cinco fases. Todo lo que aprendiste, a prueba. ¡Que comience la deformación!',
      ],
      phaseLines: [
        'Mi jacobiano se vuelve invertible… ¡no!',
        'Cambiaste las variables sin perder un factor. Impresionante.',
        'Regiones, polares… ¿cómo lo haces?',
        'Una última transformación, aprendiz.',
      ],
      defeatLines: [
        'No… |J| ya no es cero… el espacio vuelve a ser invertible…',
        'El Singular se disuelve y las calles de Cartesia recobran su forma.',
        '¡Felicidades, cartógrafo! Salvaste el reino… y de paso repasaste todo el tema del parcial.',
      ],
      phases: [
        { topic: 'jacobian', difficulty: 2 },
        { topic: 'change', difficulty: 2 },
        { topic: 'general', difficulty: 3 },
        { topic: 'polar', difficulty: 3 },
        { topic: 'change', difficulty: 3 },
      ],
    },
  },
};
