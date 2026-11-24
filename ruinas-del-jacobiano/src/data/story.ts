import { ItemId, NpcId, QuestId } from '../data/types';
import { SaveData } from '../systems/SaveSystem';

export interface StoryOption {
  text: string;
  next?: string;
  flag?: string;
  quest?: { id: QuestId; progress: number };
  give?: ItemId;
  event?: string;
  showIf?: (s: SaveData) => boolean;
}

export interface StoryNode {
  text: string;
  options: StoryOption[];
}

export interface StoryTree {
  start: string;
  speaker: string;
  portrait: 'old' | 'sage' | 'guard' | 'cartographer' | 'wanderer' | 'collector';
  nodes: Record<string, StoryNode>;
}

const finished = (s: SaveData) => s.victory;
const hasZone = (s: SaveData, z: 'llanura' | 'valle' | 'ciudad' | 'templo') => !!s.completed[z];
const hasItem = (s: SaveData, id: ItemId) => (s.items[id] ?? 0) > 0;

function anciana(s: SaveData): StoryTree {
  const start = finished(s) ? 'final' : hasZone(s, 'llanura') ? 'return' : s.flags['charla_anciana'] ? 'guide' : 'first';
  return {
    start,
    speaker: 'Anciana Cartesia',
    portrait: 'old',
    nodes: {
      first: {
        text: '«Te acercas con el paso de quien aún cree que los mapas sirven de algo. Bien. Eso ya es más de lo que puedo decir de los demás.» «Cartesia se está quedando sin área. Algo llama a las cosas por su nombre y las deja en cero.»',
        options: [
          { text: '¿Quién hace eso?', next: 'singular' },
          { text: '¿Y qué pintas tú aquí, anciana?', next: 'anciana' },
          { text: 'Tengo que irme.', flag: 'charla_anciana', quest: { id: 'llamada_cartografo', progress: 1 } },
        ],
      },
      singular: {
        text: '«El Singular. Antes fue un cartógrafo como tú, solo que descubrió que si el determinante se anula, todo cabe en un punto.» «Un punto es fácil de gobernar. Un mundo, no.»',
        options: [
          { text: '¿Y cómo se le detiene?', next: 'sendero', flag: 'charla_anciana', quest: { id: 'llamada_cartografo', progress: 1 } },
          { text: 'Me da miedo.', next: 'miedo' },
        ],
      },
      anciana: {
        text: '«Dibujo el mapa que recuerdo, no el que veo. Cada mañana se me borra una calle y cada noche la vuelvo a trazar.» «Si alguien recupera las herramientas de los antiguos, quizá el mapa deje de olvidarse.»',
        options: [{ text: 'Entonces empezaré por el norte.', next: 'sendero', flag: 'charla_anciana', quest: { id: 'llamada_cartografo', progress: 1 } }],
      },
      miedo: {
        text: '«El miedo es una brújula que señala lo que importa. Sigue adelante aunque tiemble; el miedo también sabe el camino.»',
        options: [{ text: 'Iré a la Llanura Rectangular.', next: 'sendero', flag: 'charla_anciana', quest: { id: 'llamada_cartografo', progress: 1 } }],
      },
      sendero: {
        text: '«Cuatro regiones, tres herramientas y un templo. Empieza por la Llanura: allí las runas son rectas y perdonan errores.» «Cuando vuelvas con la Cuchilla de Fubini, abre el Valle. No te saltes el orden: las regiones también tienen memoria.»',
        options: [{ text: 'Entiendo. Iré a la Llanura.', flag: 'charla_anciana', quest: { id: 'llamada_cartografo', progress: 1 } }],
      },
      guide: {
        text: '«Vuelves con polvo en la capa. Cuéntame: ¿las runas siguen respondiendo a números o ya solo a golpes?»',
        options: [
          { text: 'Sigo necesitando práctica.', next: 'practica' },
          { text: '¿Qué sabes de las reliquias?', next: 'reliquias', showIf: (s) => hasZone(s, 'llanura') },
          { text: 'Me voy de nuevo.', flag: 'charla_anciana' },
        ],
      },
      practica: {
        text: '«Bien. Las runas se descifran resolviendo el problema que muestran. Si te equivocas, no te castigo: la solución aparece y mañana saldrá otra.» «La práctica es la única magia que no necesita varita.»',
        options: [{ text: 'Gracias, anciana.', flag: 'charla_anciana' }],
      },
      reliquias: {
        text: '«Los antiguos partieron su reliquia en tres para que ningún Singular pudiera reunirla. Hay un fragmento en el Valle, otro en Ciudad Polar y el tercero…» «El tercero se lo llevó el viento al sur del templo. Busca cofres sin dueño.»',
        options: [
          { text: 'Los buscaré.', flag: 'pista_reliquias', quest: { id: 'fragmentos_reliquia', progress: 1 } },
          { text: 'Ahora no.', flag: 'charla_anciana' },
        ],
      },
      return: {
        text: '«¡Has vuelto! Traes el polvo de otros mapas pegado a los zapatos. Eso significa que estás haciendo lo correcto.»',
        options: [
          { text: '¿Qué queda por hacer?', next: 'reliquias', showIf: (s) => !finished(s) },
          { text: 'Solo quería saludarte.', flag: 'charla_anciana' },
        ],
      },
      final: {
        text: '«El mapa ya no se borra. Esta mañana dibujé una calle nueva y, por primera vez en años, reconocí el nombre.» «Gracias, cartógrafo. Quédate todo lo que quieras: las runas siguen siendo buenas para el parcial.»',
        options: [{ text: 'Me quedaré un rato.', flag: 'charla_anciana' }],
      },
    },
  };
}

function fubini(s: SaveData): StoryTree {
  const done = hasZone(s, 'llanura');
  return {
    start: done ? 'done' : s.flags['charla_fubini'] ? 'more' : 'first',
    speaker: 'Maestro Fubini',
    portrait: 'sage',
    nodes: {
      first: {
        text: '«Joven, detente. Antes de correr hacia las runas, aprende a mirar un rectángulo.» «El área es la misma la recorras en filas o en columnas. Fubini no cambia el resultado: solo cambia el orden de contarlo.»',
        options: [
          { text: '¿Y eso cómo me ayuda?', next: 'truco' },
          { text: '¿Dónde está la cuchilla?', next: 'cuchilla', flag: 'charla_fubini' },
          { text: 'Adiós.', flag: 'charla_fubini' },
        ],
      },
      truco: {
        text: '«Cuando una integral se niegue, cambia el orden. Dibuja la región, encuentra las fronteras y vuelve a empezar. La paciencia también es una herramienta.»',
        options: [{ text: 'Lo probaré en las runas.', next: 'cuchilla', flag: 'charla_fubini' }],
      },
      cuchilla: {
        text: '«Mi cuchilla está más allá de la puerta sellada. Vence al Guardián y llévala: corta más lejos y con más fuerza.»',
        options: [{ text: 'Iré por ella.', flag: 'charla_fubini', quest: { id: 'llamada_cartografo', progress: 2 } }],
      },
      more: {
        text: '«¿Ya has despertado las tres runas? La puerta solo escucha cuando todas brillan a la vez.»',
        options: [{ text: 'Entiendo.', flag: 'charla_fubini' }],
      },
      done: {
        text: '«La cuchilla te eligió bien. Úsala con el orden adecuado y no con el que te parezca más cómodo.»',
        options: [{ text: 'Así lo haré.', flag: 'charla_fubini' }],
      },
    },
  };
}

function guardiana(s: SaveData): StoryTree {
  const done = hasZone(s, 'valle');
  return {
    start: done ? 'done' : s.flags['charla_guardiana'] ? 'more' : 'first',
    speaker: 'Guardiana Tipo-II',
    portrait: 'guard',
    nodes: {
      first: {
        text: '«El río dibuja una parábola. Si intentas contarlo como quien cuenta un rectángulo, te llevará por delante.» «Tipo I: primero y, después, x. Tipo II: cambias el orden y el agua se calma.»',
        options: [
          { text: '¿Y los pilares del otro lado?', next: 'pilares' },
          { text: '¿Cómo soy tipo II?', next: 'tipo' },
          { text: 'Me voy.', flag: 'charla_guardiana' },
        ],
      },
      tipo: {
        text: '«Observa qué variable va de constante a constante. Si y es la de afuera, estás en tipo II. Si la que cambia es x, dibuja primero las curvas y luego decide.» «Las fronteras no son muros: son promesas sobre dónde termina algo.»',
        options: [{ text: 'Probaré los pilares.', next: 'pilares', flag: 'charla_guardiana' }],
      },
      pilares: {
        text: '«Tres pilares, tres órdenes. La tabla que dejó el tejedor dice cuál es el correcto: el centro, el norte, el sur. Pero no te lo diré con palabras de cartógrafo: tendrás que leer la tabla.»',
        options: [
          { text: 'Buscaré la tabla.', flag: 'charla_guardiana', quest: { id: 'archivo_prohibido', progress: 2 } },
          { text: 'Prefiero pelear.', flag: 'charla_guardiana' },
        ],
      },
      more: { text: '«La compuerta no se abre con golpes. Se abre con atención.»', options: [{ text: 'Entendido.', flag: 'charla_guardiana' }] },
      done: { text: '«El valle vuelve a tener orillas. Te debo una: never confundas una curva con un capricho.»', options: [{ text: 'Gracias.', flag: 'charla_guardiana' }] },
    },
  };
}

function cartografa(s: SaveData): StoryTree {
  const done = hasZone(s, 'ciudad');
  return {
    start: done ? 'done' : s.flags['charla_cartografa'] ? 'more' : 'first',
    speaker: 'Cartógrafa Polar',
    portrait: 'cartographer',
    nodes: {
      first: {
        text: '«¿Oyes el reloj? No marca horas: marca ángulos.» «Aquí todo se mide con radio y giro. x es r cos θ, y es r sin θ, y el area de un anillo pequeñito es r dr dθ.»',
        options: [
          { text: '¿Por qué el r?', next: 'factor' },
          { text: '¿Y el Coloso?', next: 'coloso' },
          { text: 'Hasta luego.', flag: 'charla_cartografa' },
        ],
      },
      factor: {
        text: '«Porque un mismo giro abarca más terreno cuanto más lejos estés del centro. Olvidar el factor es como cobrar la entrada a alguien que no ha llegado.»',
        options: [{ text: 'Lo recordaré.', next: 'coloso', flag: 'charla_cartografa' }],
      },
      coloso: {
        text: '«El Coloso guarda el Lente. Gira y gira para comprimirlo todo. Si logras romper sus tres anillos, podrás tomarlo.» «Y no, no vale gritarle el factor: hay que demostrarlo.»',
        options: [{ text: 'A por los anillos.', flag: 'charla_cartografa', quest: { id: 'llamada_cartografo', progress: 4 } }],
      },
      more: { text: '«¿Sientes el giro? El mundo está a punto de volver a encajar.»', options: [{ text: 'Sí.', flag: 'charla_cartografa' }] },
      done: { text: '«El Lente está en tus manos. Mira bien: las cosas no son como parecen, sino como se transforman.»', options: [{ text: 'Miraré.', flag: 'charla_cartografa' }] },
    },
  };
}

function sabio(s: SaveData): StoryTree {
  const done = finished(s);
  return {
    start: done ? 'done' : s.flags['charla_sabio'] ? 'more' : 'first',
    speaker: 'Sabio Jacobi',
    portrait: 'sage',
    nodes: {
      first: {
        text: '«El templo lleva siglos esperando a alguien que pregunte por el determinante en vez de por la salida.» «J es la huella del cambio: cuánto se estira o se comprime el terreno al transformarlo. Si J es cero, la huella desaparece y nada puede volver atrás.»',
        options: [
          { text: '¿Eso es lo que quiere El Singular?', next: 'singular' },
          { text: '¿Y el valor absoluto?', next: 'absoluto' },
          { text: 'Debo seguir.', flag: 'charla_sabio' },
        ],
      },
      singular: {
        text: '«Sí. No odia el mundo: lo quiere simplificar hasta que quepa en un punto. Un punto no tiene vecinos, ni caminos, ni historia. Es una tumba muy ordenada.»',
        options: [{ text: 'No se lo permitiré.', next: 'absoluto', flag: 'charla_sabio' }],
      },
      absoluto: {
        text: '«El area no puede ser negativa, así que tomamos |J|. Si olvidas el signo, el mapa se da vuelta y el viajero cae fuera de él.» «Cinco fases, cinco preguntas. Cuida cada factor.»',
        options: [{ text: 'Estoy listo.', flag: 'charla_sabio', quest: { id: 'llamada_cartografo', progress: 6 } }],
      },
      more: { text: '«Las runas del templo no perdonan el descuido, pero sí enseñan. Eso es lo único que hace un sabio: enseñar a equivocarse mejor.»', options: [{ text: 'Lo tendré presente.', flag: 'charla_sabio' }] },
      done: { text: '«Ya sabes lo que yo: que el area vuelve siempre, aunque cambie de forma.»', options: [{ text: 'Gracias, maestro.', flag: 'charla_sabio' }] },
    },
  };
}

function errante(s: SaveData): StoryTree {
  const talked = (s.counters['errante_charlas'] ?? 0) >= 3;
  return {
    start: talked ? 'reward' : s.flags['charla_errante'] ? 'more' : 'first',
    speaker: 'Errante de los caminos',
    portrait: 'wanderer',
    nodes: {
      first: {
        text: '«He caminado tanto que ya no sé si voy o si el camino me lleva a mí.» «Tres maestros han dejado frases por el reino. Si las oyes todas, vuelve y te daré algo que pesa menos que una moneda y vale más.»',
        options: [
          { text: '¿Qué frase busco?', next: 'pista' },
          { text: 'Otra vez están las runas…', next: 'runas' },
          { text: 'Hasta luego.', flag: 'charla_errante' },
        ],
      },
      pista: {
        text: '«Pregunta por el orden, por las fronteras y por el giro. Cada maestro tiene una respuesta corta y una larga. Escucha las dos.»',
        options: [
          { text: 'Lo haré.', flag: 'charla_errante', quest: { id: 'ecos_del_bosque', progress: 1 } },
          { text: '¿Y eso para qué sirve?', next: 'runas', flag: 'charla_errante' },
        ],
      },
      runas: {
        text: '«Las runas son preguntas con paciencia. Resuélvelas, aprende y vuelve a por más. Nadie te quita tiempo por pensar.»',
        options: [{ text: 'Gracias.', flag: 'charla_errante' }],
      },
      more: {
        text: '«Sigo contando maestros. Llevo…» «Espera. Si llevo la cuenta, dejo de caminar. Mejor dime tú cuántos has oído.»',
        options: [
          { text: 'He oído a los tres.', next: 'reward', showIf: (s2) => (s2.counters['maestros_oidos'] ?? 0) >= 3 },
          { text: 'Todavía no.', flag: 'charla_errante' },
        ],
      },
      reward: {
        text: '«Entonces toma esto: una poción de area. La guardé para el día en que alguien recordara que escuchar también es explorar.»',
        options: [{ text: 'Gracias, errante.', give: 'pocion', flag: 'ecos_recompensa', quest: { id: 'ecos_del_bosque', progress: 4, } }],
      },
    },
  };
}

function recaudador(s: SaveData): StoryTree {
  const count = ['fragmento_norte', 'fragmento_este', 'fragmento_sur'].filter((id) => hasItem(s, id as ItemId)).length;
  return {
    start: count >= 3 ? 'reward' : 'first',
    speaker: 'Recaudador de ecos',
    portrait: 'collector',
    nodes: {
      first: {
        text: `«Tres pedazos de una reliquia. Reparto justo: yo guardo los nombres y tú te quedas con el peso.» «Traes ${count} de tres. Los cofres sin dueño guardan el resto.»`,
        options: [
          { text: '¿Qué hace la reliquia?', next: 'reliquia' },
          { text: 'Buscaré los fragmentos.', flag: 'pista_reliquias', quest: { id: 'fragmentos_reliquia', progress: 1 } },
          { text: 'Me voy.', flag: 'charla_recaudador' },
        ],
      },
      reliquia: {
        text: '«Devuelve la memoria de los que midieron antes que nosotros. Si el Singular borra un nombre, la reliquia lo recuerda por él.»',
        options: [{ text: 'La reuniré.', flag: 'pista_reliquias' }],
      },
      reward: {
        text: '«Tres fragmentos. La reliquia se calienta… y con razón: acaba de recordar quién eras antes de empezar este viaje.»',
        options: [{ text: 'La acepto.', give: 'reliquia_carton', flag: 'reliquia_reunida', quest: { id: 'fragmentos_reliquia', progress: 3 } }],
      },
    },
  };
}

export function storyFor(id: NpcId, save: SaveData): StoryTree {
  switch (id) {
    case 'anciana': return anciana(save);
    case 'fubini': return fubini(save);
    case 'guardiana': return guardiana(save);
    case 'cartografa': return cartografa(save);
    case 'sabio': return sabio(save);
    case 'errante': return errante(save);
    case 'recaudador': return recaudador(save);
  }
}

export interface QuestDef {
  id: QuestId;
  name: string;
  hook: string;
  steps: string[];
  reward: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'llamada_cartografo',
    name: 'La llamada del cartógrafo',
    hook: 'La Anciana pide recuperar tres herramientas antes de entrar al templo.',
    steps: ['Hablar con la Anciana', 'Vencer al Guardián Rectángulo', 'Vencer al Centinela del Valle', 'Vencer al Coloso Polar', 'Derrotar a El Singular'],
    reward: 'El mapa de Cartesia vuelve a ser legible',
  },
  {
    id: 'ecos_del_bosque',
    name: 'Ecos del bosque',
    hook: 'El Errante dice que tres maestros guardan una frase cada uno.',
    steps: ['Hablar con el Errante', 'Escuchar a los maestros de las cuatro regiones', 'Volver con el Errante'],
    reward: 'Elixir de area',
  },
  {
    id: 'fragmentos_reliquia',
    name: 'Fragmentos de la reliquia',
    hook: 'Una reliquia partida en tres puede devolver los nombres borrados.',
    steps: ['Oír hablar de la reliquia', 'Encontrar los tres fragmentos en cofres ocultos', 'Entregarlos al Recaudador de ecos'],
    reward: 'Reliquia del Cartógrafo',
  },
  {
    id: 'archivo_prohibido',
    name: 'El archivo prohibido',
    hook: 'Tablas, cartas y diarios cuentan lo que los habitantes olvidaron.',
    steps: ['Leer la Tabla del origen', 'Leer la Carta del exilio', 'Leer el Diario del último tejedor', 'Leer la Inscripción del observatorio'],
    reward: 'Comprensión del origen del Singular',
  },
];

export function questStatus(save: SaveData, id: QuestId): string {
  const q = save.quests[id];
  const def = QUESTS.find((qd) => qd.id === id)!;
  if (q.done) return `${def.name} — completada`;
  if (q.progress === 0) return `${def.name} — no iniciada`;
  return `${def.name} — ${q.progress}/${def.steps.length}: ${def.steps[Math.min(q.progress, def.steps.length - 1)]}`;
}
