/**
 * Motor de preguntas: genera problemas con parámetros aleatorios.
 * Cada problema trae: enunciado en LaTeX, respuesta numérica, pistas y solución paso a paso.
 * Para agregar un tema nuevo: escribe un generador y regístralo en GENERATORS.
 */
import { integrate2D, jacobianNum, polygonArea } from './numeric';

export type Topic = 'rect' | 'general' | 'polar' | 'jacobian' | 'change';
export type Difficulty = 1 | 2 | 3;

export interface Question {
  topic: Topic;
  difficulty: Difficulty;
  title: string;
  statementTex: string;
  answer: number;
  tolerance: number;
  hints: string[];
  solutionTex: string[];
  /**
   * Verificación numérica INDEPENDIENTE de la fórmula cerrada:
   * calcula la respuesta por cuadratura o diferencias finitas con los
   * mismos parámetros del problema. No se guarda ni se muestra al jugador.
   */
  verify?: () => number;
}

const tex = String.raw;

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T>(arr: T[]): T => arr[ri(0, arr.length - 1)];
export const fmt = (n: number, d = 4): string => String(Number(n.toFixed(d)));
/** coeficiente para escribir 1x -> x, -1x -> -x */
const co = (n: number): string => (n === 1 ? '' : n === -1 ? '-' : String(n));
const nz = (a: number, b: number): number => {
  let v = 0;
  while (v === 0) v = ri(a, b);
  return v;
};
/** a*u + b*v bien escrito */
const lin = (a: number, u: string, b: number, v: string): string => {
  const parts: string[] = [];
  if (a !== 0) parts.push(`${co(a)}${u}`);
  if (b !== 0) parts.push(`${b > 0 && parts.length ? '+' : ''}${co(b)}${v}`);
  return parts.join('') || '0';
};
/** bordes del disco de radio R en cartesianas (para la verificación numérica) */
const diskLo = (R: number) => (x: number): number => -Math.sqrt(Math.max(0, R * R - x * x));
const diskHi = (R: number) => (x: number): number => Math.sqrt(Math.max(0, R * R - x * x));

function mk(
  topic: Topic,
  difficulty: Difficulty,
  title: string,
  statementTex: string,
  answer: number,
  hints: string[],
  solutionTex: string[],
  verify?: () => number,
  tolerance = 0.006,
): Question {
  return { topic, difficulty, title, statementTex, answer, tolerance, hints, solutionTex, verify };
}

/* ───────────────────────── Mundo 1 · Fubini sobre rectángulos ───────────────────────── */
function rect(d: Difficulty): Question {
  if (d === 1) {
    const p = ri(1, 4), q = ri(1, 4), a = ri(1, 4), b = ri(1, 4);
    const ans = (a * q * p * p) / 2 + (b * p * q * q) / 2;
    return mk(
      'rect', 1, 'Integral doble sobre un rectángulo',
      tex`\iint_R \left(${co(a)}x+${co(b)}y\right)\,dA,\qquad R=[0,${p}]\times[0,${q}]`,
      ans,
      [
        'Como R es un rectángulo, Fubini te deja integrar en cualquier orden. Empieza integrando respecto a y (x se comporta como constante).',
        'Recuerda: ∫₀ᵖ x dx = p²/2. Lo mismo para y.',
      ],
      [
        tex`\int_0^{${p}}\!\!\int_0^{${q}}\left(${co(a)}x+${co(b)}y\right)dy\,dx`,
        tex`\text{Interna: }\ ${co(a)}x\cdot ${q}+\tfrac{${b}\cdot ${q}^2}{2}=${co(a * q)}x+${fmt((b * q * q) / 2)}`,
        tex`\text{Externa: }\ ${fmt(a * q)}\cdot\tfrac{${p}^2}{2}+${fmt((b * q * q) / 2)}\cdot ${p}`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => a * x + b * y, 0, p, () => 0, () => q),
    );
  }
  if (d === 2) {
    const m = ri(1, 2), n = ri(1, 2), a = ri(1, 3), b = ri(1, 3);
    if (ri(1, 2) === 1) {
      const ans = (Math.pow(a, m + 1) * Math.pow(b, n + 1)) / ((m + 1) * (n + 1));
      return mk(
        'rect', 2, 'Integrando un producto de potencias',
        tex`\iint_R x^{${m}}y^{${n}}\,dA,\qquad R=[0,${a}]\times[0,${b}]`,
        ans,
        [
          'La función es producto de algo en x por algo en y y la región es un rectángulo: la integral se separa en dos integrales simples.',
          `∫₀^${a} x^${m} dx = ${a}^${m + 1}/${m + 1}  y  ∫₀^${b} y^${n} dy = ${b}^${n + 1}/${n + 1}.`,
        ],
        [
          tex`\iint_R x^{${m}}y^{${n}}dA=\left(\int_0^{${a}}x^{${m}}dx\right)\left(\int_0^{${b}}y^{${n}}dy\right)`,
          tex`=\frac{${a}^{${m + 1}}}{${m + 1}}\cdot\frac{${b}^{${n + 1}}}{${n + 1}}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => Math.pow(x, m) * Math.pow(y, n), 0, a, () => 0, () => b),
      );
    }
    const c = ri(2, 3);
    const ans = (c * Math.pow(a, m + 1) * Math.pow(b, n + 1)) / ((m + 1) * (n + 1));
    return mk(
      'rect', 2, 'Producto de potencias con factor',
      tex`\iint_R ${co(c)}x^{${m}}y^{${n}}\,dA,\qquad R=[0,${a}]\times[0,${b}]`,
      ans,
      [
        `El ${c} es una constante: sácalo de la integral y solo queda el producto de potencias.`,
        `∫₀^${a} x^${m} dx = ${a}^${m + 1}/${m + 1}  y  ∫₀^${b} y^${n} dy = ${b}^${n + 1}/${n + 1}.`,
      ],
      [
        tex`\iint_R ${co(c)}x^{${m}}y^{${n}}dA=${c}\left(\int_0^{${a}}x^{${m}}dx\right)\left(\int_0^{${b}}y^{${n}}dy\right)`,
        tex`=${c}\cdot\frac{${a}^{${m + 1}}}{${m + 1}}\cdot\frac{${b}^{${n + 1}}}{${n + 1}}=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * Math.pow(x, m) * Math.pow(y, n), 0, a, () => 0, () => b),
    );
  }
  const variante = ri(1, 3);
  if (variante === 1) {
    const a = ri(1, 3), b = ri(1, 2);
    const ans = ((a * a) / 2) * (Math.exp(b) - 1);
    return mk(
      'rect', 3, 'Separando variables con exponencial',
      tex`\iint_R x\,e^{y}\,dA,\qquad R=[0,${a}]\times[0,${b}]`,
      ans,
      [
        'Otra vez se separa: (∫ x dx)(∫ eʸ dy).',
        `∫₀^${b} eʸ dy = e^${b} − 1.`,
      ],
      [
        tex`\left(\int_0^{${a}}x\,dx\right)\left(\int_0^{${b}}e^{y}dy\right)=\frac{${a}^2}{2}\left(e^{${b}}-1\right)`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => x * Math.exp(y), 0, a, () => 0, () => b),
    );
  }
  if (variante === 2) {
    const k = ri(1, 2), a = ri(1, 3), b = ri(1, 3);
    const ans = ((a * a) / 2) * (Math.exp(k * b) - 1) / k;
    return mk(
      'rect', 3, 'Separando variables con exponencial de constante',
      tex`\iint_R x\,e^{${k}y}\,dA,\qquad R=[0,${a}]\times[0,${b}]`,
      ans,
      [
        'El integrando sigue siendo producto: (∫ x dx)(∫ eʏᵏ dy). La clave está en la segunda integral.',
        `Sustituye u = ${k}y: te queda (e^{${k}·${b}} − 1)/${k}.`,
      ],
      [
        tex`\iint_R x e^{${k}y}dA=\left(\int_0^{${a}}x\,dx\right)\left(\int_0^{${b}}e^{${k}y}dy\right)`,
        tex`=\frac{${a}^2}{2}\cdot\frac{e^{${k * b}}-1}{${k}}=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => x * Math.exp(k * y), 0, a, () => 0, () => b),
    );
  }
  const c = ri(1, 3);
  const regiones = [
    { x: '\\pi', y: '\\tfrac{\\pi}{2}', xv: Math.PI, yv: Math.PI / 2, sin: 2, cos: 1 },
    { x: '\\tfrac{\\pi}{2}', y: '\\tfrac{\\pi}{2}', xv: Math.PI / 2, yv: Math.PI / 2, sin: 1, cos: 1 },
    { x: '\\tfrac{\\pi}{2}', y: '\\tfrac{\\pi}{6}', xv: Math.PI / 2, yv: Math.PI / 6, sin: 1, cos: 0.5 },
  ];
  const r = pick(regiones);
  const ans = c * r.sin * r.cos;
  return mk(
    'rect', 3, 'Seno por coseno: ojo con los límites',
    tex`\iint_D ${co(c)}\sin(x)\cos(y)\,dA,\qquad D=[0,${r.x}]\times[0,${r.y}]`,
    ans,
    [
      'El integrando es producto: (∫ sin(x)dx)(∫ cos(y)dy). Solo hay que leer bien los límites del rectángulo.',
      'Valores útiles: ∫₀^π sin x dx = 2, ∫₀^{π/2} sin x dx = 1 y ∫₀^{π/6} cos y dy = 1/2.',
    ],
    [
      tex`\iint_D ${co(c)}\sin(x)\cos(y)dA=${c}\left(\int_0^{${r.xv}}\sin x\,dx\right)\left(\int_0^{${r.yv}}\cos y\,dy\right)`,
      tex`=${c}\cdot${fmt(r.sin)}\cdot${fmt(r.cos)}=${fmt(ans)}`,
    ],
    () => integrate2D((x, y) => c * Math.sin(x) * Math.cos(y), 0, r.xv, () => 0, () => r.yv),
  );
}

/* ───────────────────────── Mundo 2 · Regiones generales y cambio de orden ───────────────────────── */
function general(d: Difficulty): Question {
  if (d === 1) {
    const a = ri(1, 3), m = ri(1, 3), c = ri(1, 4);
    const variante = ri(1, 4);
    if (variante === 1) {
      const ans = (c * m * Math.pow(a, 3)) / 3;
      return mk(
        'general', 1, 'Región tipo I (entre rectas)',
        tex`\iint_D ${co(c)}x\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le ${co(m)}x\}`,
        ans,
        [
          'Región tipo I: x va de un número a otro, y va de una curva a otra que depende de x. Integra primero en y.',
          `Interna: ∫₀^{${m}x} ${c}x dy = ${c}x·${m}x = ${c * m}x².`,
        ],
        [
          tex`\int_0^{${a}}\!\!\int_0^{${co(m)}x}${co(c)}x\,dy\,dx=\int_0^{${a}}${co(c * m)}x^2\,dx`,
          tex`=${co(c * m)}\cdot\frac{${a}^3}{3}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x, 0, a, () => 0, (x) => m * x),
      );
    }
    if (variante === 2) {
      const ans = (c * (m + (m * m) / 2) * Math.pow(a, 3)) / 3;
      return mk(
        'general', 1, 'Región tipo I con integrando mixto',
        tex`\iint_D ${co(c)}(x+y)\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le ${co(m)}x\}`,
        ans,
        [
          'Integra primero en y (x es constante) y después en x. La región sigue siendo tipo I: 0 ≤ y ≤ m·x.',
          `Interna: ∫₀^{${m}x} ${c}(x+y) dy = ${c}·${m}x² + ${c}·${(m * m) / 2}x².`,
        ],
        [
          tex`\int_0^{${a}}\!\!\int_0^{${co(m)}x}${co(c)}(x+y)\,dy\,dx=\int_0^{${a}}${co(c)}\left(${co(m)}+\tfrac{${m * m}}{2}\right)x^2\,dx`,
          tex`=${co(c)}\left(${co(m)}+\frac{${m * m}}{2}\right)\cdot\frac{${a}^3}{3}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * (x + y), 0, a, () => 0, (x) => m * x),
      );
    }
    if (variante === 3) {
      const ans = (c * m * m * Math.pow(a, 3)) / 6;
      return mk(
        'general', 1, 'Región tipo II (entre rectas)',
        tex`\iint_D ${co(c)}x\,dA,\qquad D=\{(x,y):\,0\le y\le ${a},\ 0\le x\le ${co(m)}y\}`,
        ans,
        [
          'Esta región es tipo II: y va de un número a otro y x depende de y. Ahora integras primero en x.',
          `Interna: ∫₀^{${m}y} ${c}x dx = ${c}·${m * m}y²/2.`,
        ],
        [
          tex`\int_0^{${a}}\!\!\int_0^{${co(m)}y}${co(c)}x\,dx\,dy=\int_0^{${a}}${co(c)}\frac{${m * m}y^2}{2}\,dy`,
          tex`=${co(c)}\frac{${m * m}}{2}\cdot\frac{${a}^3}{3}=${fmt(ans)}`,
        ],
        // región tipo II: se integra con y como variable exterior
        () => integrate2D((y, x) => c * x, 0, a, () => 0, (y) => m * y),
      );
    }
    const ans = (c * m * Math.pow(a, 3)) / 3;
    return mk(
      'general', 1, 'Región tipo II integrando en y',
      tex`\iint_D ${co(c)}y\,dA,\qquad D=\{(x,y):\,0\le y\le ${a},\ 0\le x\le ${co(m)}y\}`,
      ans,
      [
        'Región tipo II: 0 ≤ y ≤ a y 0 ≤ x ≤ m·y. El orden natural es integrar primero en x.',
        `Interna: ∫₀^{${m}y} ${c}y dx = ${c * m}y².`,
      ],
      [
        tex`\int_0^{${a}}\!\!\int_0^{${co(m)}y}${co(c)}y\,dx\,dy=\int_0^{${a}}${co(c * m)}y^2\,dy`,
        tex`=${co(c * m)}\cdot\frac{${a}^3}{3}=${fmt(ans)}`,
      ],
      () => integrate2D((y, x) => c * y, 0, a, () => 0, (y) => m * y),
    );
  }
  if (d === 2) {
    const a = ri(1, 2), c = ri(1, 3);
    const variante = ri(1, 7);
    if (variante === 1) {
      const ans = (c * Math.pow(a, 6)) / 12;
      return mk(
        'general', 2, 'Región limitada por una parábola',
        tex`\iint_D ${co(c)}xy\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le x^2\}`,
        ans,
        [
          'Integra primero en y de 0 a x²; x queda como constante.',
          '∫₀^{x²} y dy = x⁴/2. Después te queda una integral de x⁵.',
        ],
        [
          tex`\int_0^{${a}}${co(c)}x\left(\int_0^{x^2}y\,dy\right)dx=\int_0^{${a}}${co(c)}x\cdot\frac{x^4}{2}\,dx`,
          tex`=\frac{${c}}{2}\cdot\frac{${a}^6}{6}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x * y, 0, a, () => 0, (x) => x * x),
      );
    }
    if (variante === 2) {
      const ans = c / 24;
      return mk(
        'general', 2, 'Región entre dos curvas',
        tex`\iint_D ${co(c)}xy\,dA,\qquad D=\{(x,y):\,0\le x\le 1,\ x^2\le y\le x\}`,
        ans,
        [
          'Ahora y va de una curva a otra: de x² (abajo) hasta x (arriba). Integra primero en y.',
          'Interna: ∫_{x²}^{x} xy dy = x·(x² − x⁴)/2.',
        ],
        [
          tex`\int_0^{1}${co(c)}x\left(\int_{x^2}^{x}y\,dy\right)dx=\int_0^{1}${co(c)}\frac{x^3-x^5}{2}\,dx`,
          tex`=\frac{${c}}{2}\left(\frac{1}{4}-\frac{1}{6}\right)=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x * y, 0, 1, (x) => x * x, (x) => x),
      );
    }
    if (variante === 3) {
      const ans = c / 12;
      return mk(
        'general', 2, 'Región entre dos curvas integrando x',
        tex`\iint_D ${co(c)}x\,dA,\qquad D=\{(x,y):\,0\le x\le 1,\ x^2\le y\le x\}`,
        ans,
        [
          'Misma región (entre x² y x), pero el integrando es solo x: al integrar en y aparece el alto de la franja.',
          'Interna: ∫_{x²}^{x} x dy = x·(x − x²).',
        ],
        [
          tex`\int_0^{1}${co(c)}x\left(\int_{x^2}^{x}dy\right)dx=\int_0^{1}${co(c)}(x^2-x^3)\,dx`,
          tex`=${co(c)}\left(\frac{1}{3}-\frac{1}{4}\right)=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x, 0, 1, (x) => x * x, (x) => x),
      );
    }
    if (variante === 4) {
      const ans = c / 15;
      return mk(
        'general', 2, 'Región entre dos curvas integrando y',
        tex`\iint_D ${co(c)}y\,dA,\qquad D=\{(x,y):\,0\le x\le 1,\ x^2\le y\le x\}`,
        ans,
        [
          'Aquí el integrando es y: al integrar en y sale y²/2 evaluado en las dos curvas.',
          'Interna: ∫_{x²}^{x} y dy = (x² − x⁴)/2.',
        ],
        [
          tex`\int_0^{1}\left(\int_{x^2}^{x}${co(c)}y\,dy\right)dx=\int_0^{1}${co(c)}\frac{x^2-x^4}{2}\,dx`,
          tex`=\frac{${c}}{2}\left(\frac{1}{3}-\frac{1}{5}\right)=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * y, 0, 1, (x) => x * x, (x) => x),
      );
    }
    if (variante === 5) {
      const ans = (c * Math.pow(a, 7)) / 14;
      return mk(
        'general', 2, 'Parábola con potencia en x',
        tex`\iint_D ${co(c)}x^2y\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le x^2\}`,
        ans,
        [
          'Misma región que antes, pero el integrando es x²·y. La integral interna sigue siendo x⁴/2.',
          `Tras integrar en y queda ∫₀^${a} x⁶/2 dx: recuerda que ∫₀^a xⁿ dx = a^{n+1}/(n+1).`,
        ],
        [
          tex`\int_0^{${a}}${co(c)}x^2\left(\int_0^{x^2}y\,dy\right)dx=\int_0^{${a}}${co(c)}x^2\cdot\frac{x^4}{2}\,dx`,
          tex`=\frac{${c}}{2}\cdot\frac{${a}^7}{7}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x * x * y, 0, a, () => 0, (x) => x * x),
      );
    }
    if (variante === 6) {
      const ans = (c * Math.pow(a, 8)) / 24;
      return mk(
        'general', 2, 'Parábola con potencia en y',
        tex`\iint_D ${co(c)}xy^2\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le x^2\}`,
        ans,
        [
          'El integrando es x·y²: al integrar en y aparece y³/3 en vez de y²/2.',
          'Interna: ∫₀^{x²} y² dy = x⁶/3.',
        ],
        [
          tex`\int_0^{${a}}${co(c)}x\left(\int_0^{x^2}y^2\,dy\right)dx=\int_0^{${a}}${co(c)}x\cdot\frac{x^6}{3}\,dx`,
          tex`=\frac{${c}}{3}\cdot\frac{${a}^8}{8}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * x * y * y, 0, a, () => 0, (x) => x * x),
      );
    }
    const ans = (c * Math.pow(a, 9)) / 27;
    return mk(
      'general', 2, 'Parábola con potencias en x e y',
      tex`\iint_D ${co(c)}x^2y^2\,dA,\qquad D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le x^2\}`,
      ans,
      [
        'Dos potencias y una parábola: integra en y primero, sin miedo al polinomio.',
        'Interna: ∫₀^{x²} y² dy = x⁶/3 y luego queda x⁸.',
      ],
      [
        tex`\int_0^{${a}}${co(c)}x^2\left(\int_0^{x^2}y^2\,dy\right)dx=\int_0^{${a}}${co(c)}x^2\cdot\frac{x^6}{3}\,dx`,
        tex`=\frac{${c}}{3}\cdot\frac{${a}^9}{9}=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * x * x * y * y, 0, a, () => 0, (x) => x * x),
    );
  }
  const c = ri(1, 3);
  const variante = ri(1, 4);
  if (variante === 1) {
    const a = pick([1, 2]);
    const ans = (c * (Math.exp(a * a) - 1)) / 2;
    return mk(
      'general', 3, '¡Cambia el orden de integración!',
      tex`\int_0^{${a}}\!\!\int_x^{${a}} ${co(c)}e^{y^2}\,dy\,dx`,
      ans,
      [
        'eʸ² no tiene antiderivada elemental: no se puede integrar primero en y. Dibuja la región: 0 ≤ x ≤ y ≤ ' + a + '.',
        'Con el orden dx dy: y va de 0 a ' + a + ' y x va de 0 a y. Aparece un factor y que sí permite sustitución.',
      ],
      [
        tex`\text{Región: }0\le x\le y\le ${a}\ \Rightarrow\ \int_0^{${a}}\!\!\int_0^{y}${co(c)}e^{y^2}\,dx\,dy`,
        tex`=\int_0^{${a}}${co(c)}\,y\,e^{y^2}\,dy=${co(c)}\cdot\frac{1}{2}\left(e^{${a * a}}-1\right)`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * Math.exp(y * y), 0, a, (x) => x, () => a),
    );
  }
  if (variante === 2) {
    const a = ri(1, 3);
    const ans = (c * (1 - Math.cos(a * a))) / 2;
    return mk(
      'general', 3, 'Cambia el orden: seno de y²',
      tex`\int_0^{${a}}\!\!\int_x^{${a}} ${co(c)}\sin(y^2)\,dy\,dx`,
      ans,
      [
        'Igual que antes: la integral en y no tiene antiderivada elemental. Cambia al orden dx dy.',
        'Aparece un factor y: ∫ y·sin(y²) dy se resuelve con u = y².',
      ],
      [
        tex`\text{Región: }0\le x\le y\le ${a}\ \Rightarrow\ \int_0^{${a}}\!\!\int_0^{y}${co(c)}\sin(y^2)\,dx\,dy`,
        tex`=\int_0^{${a}}${co(c)}\,y\,\sin(y^2)\,dy=${co(c)}\cdot\frac{1}{2}\left(1-\cos(${a * a})\right)`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * Math.sin(y * y), 0, a, (x) => x, () => a),
    );
  }
  if (variante === 3) {
    const a = ri(1, 3);
    const ans = c * (Math.exp(a * a) - 1);
    return mk(
      'general', 3, 'Cambia el orden: la región triangular',
      tex`\int_0^{${2 * a}}\!\!\int_{x/2}^{${a}} ${co(c)}e^{y^2}\,dy\,dx`,
      ans,
      [
        'La región es 0 ≤ x ≤ 2a y x/2 ≤ y ≤ a. Con el orden dx dy queda 0 ≤ y ≤ a y 0 ≤ x ≤ 2y.',
        'Al invertir el orden aparece un 2y multiplicando: justo lo que necesitas para el factor y.',
      ],
      [
        tex`\text{Región: }0\le x\le 2y,\ 0\le y\le ${a}\ \Rightarrow\ \int_0^{${a}}\!\!\int_0^{2y}${co(c)}e^{y^2}\,dx\,dy`,
        tex`=\int_0^{${a}}2${co(c)}\,y\,e^{y^2}\,dy=${co(c)}\left(e^{${a * a}}-1\right)`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * Math.exp(y * y), 0, 2 * a, (x) => x / 2, () => a),
    );
  }
  const a = ri(1, 3);
  const ans = c * (1 - Math.cos(a * a));
  return mk(
    'general', 3, 'Cambia el orden: seno en región triangular',
    tex`\int_0^{${2 * a}}\!\!\int_{x/2}^{${a}} ${co(c)}\sin(y^2)\,dy\,dx`,
    ans,
    [
      'Misma región triangular que el caso anterior, pero con sin(y²). Cambia el orden a dx dy.',
      'El factor 2y es justo lo que hace integrable y·sin(y²).',
    ],
    [
      tex`\text{Región: }0\le x\le 2y,\ 0\le y\le ${a}\ \Rightarrow\ \int_0^{${a}}\!\!\int_0^{2y}${co(c)}\sin(y^2)\,dx\,dy`,
      tex`=\int_0^{${a}}2${co(c)}\,y\,\sin(y^2)\,dy=${co(c)}\left(1-\cos(${a * a})\right)`,
      tex`=${fmt(ans)}`,
    ],
    () => integrate2D((x, y) => c * Math.sin(y * y), 0, 2 * a, (x) => x / 2, () => a),
  );
}

/* ───────────────────────── Mundo 3 · Coordenadas polares ───────────────────────── */
function polar(d: Difficulty): Question {
  if (d === 1) {
    const variante = ri(1, 4);
    if (variante === 1) {
      const R = ri(1, 3);
      const ans = (Math.PI * Math.pow(R, 4)) / 2;
      return mk(
        'polar', 1, 'Disco y x² + y²',
        tex`\iint_D (x^2+y^2)\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
        ans,
        [
          'Disco ⇒ polares: x² + y² = r², dA = r dr dθ. ¡No olvides el r extra!',
          `r va de 0 a ${R}, θ va de 0 a 2π.`,
        ],
        [
          tex`\int_0^{2\pi}\!\!\int_0^{${R}} r^2\cdot r\,dr\,d\theta=2\pi\cdot\frac{${R}^4}{4}`,
          tex`=\frac{\pi\cdot ${R}^4}{2}=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => x * x + y * y, -R, R, diskLo(R), diskHi(R)),
      );
    }
    if (variante === 2) {
      const R = ri(1, 4), c = ri(2, 3);
      const ans = (c * Math.PI * Math.pow(R, 4)) / 2;
      return mk(
        'polar', 1, 'Disco con factor',
        tex`\iint_D ${co(c)}(x^2+y^2)\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
        ans,
        [
          'El factor es constante: sácalo de la integral y vuelve al disco clásico.',
          `r va de 0 a ${R} y θ de 0 a 2π; el integrando queda ${c}·r²·r.`,
        ],
        [
          tex`\int_0^{2\pi}\!\!\int_0^{${R}} ${co(c)}r^2\cdot r\,dr\,d\theta=${co(c)}\cdot 2\pi\cdot\frac{${R}^4}{4}`,
          tex`=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * (x * x + y * y), -R, R, diskLo(R), diskHi(R)),
      );
    }
    if (variante === 3) {
      const R = ri(1, 4), c = ri(1, 3);
      const ans = (c * Math.PI * Math.pow(R, 4)) / 4;
      return mk(
        'polar', 1, 'Semidisco y x² + y²',
        tex`\iint_D ${co(c)}(x^2+y^2)\,dA,\qquad D:\ x^2+y^2\le ${R * R},\ y\ge 0`,
        ans,
        [
          'Es medio disco: en polares θ va de 0 a π (no de 0 a 2π).',
          `El integrando en polares es ${c}·r² y dA aporta el r: ${c}·r³.`,
        ],
        [
          tex`\text{Semidisco: }\theta\in[0,\pi],\ 0\le r\le ${R}`,
          tex`\int_0^{\pi}\!\!\int_0^{${R}} ${co(c)}r^2\cdot r\,dr\,d\theta=${co(c)}\cdot\pi\cdot\frac{${R}^4}{4}`,
          tex`=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * (x * x + y * y), -R, R, () => 0, diskHi(R)),
      );
    }
    const a = ri(1, 3), b = ri(a + 1, 4), c = ri(1, 3);
    const ans = (c * Math.PI * (Math.pow(b, 4) - Math.pow(a, 4))) / 2;
    return mk(
      'polar', 1, 'Anillo y x² + y²',
      tex`\iint_D ${co(c)}(x^2+y^2)\,dA,\qquad D:\ ${a * a}\le x^2+y^2\le ${b * b}`,
      ans,
      [
        'Un anillo es un disco menos otro disco: en polares r va de ' + a + ' a ' + b + '.',
        `El integrando queda ${c}·r³ y el ancho del anillo (${b} − ${a}) se integra con los dos discos.`,
      ],
      [
        tex`\int_${a}^{${b}}\!\!\int_0^{2\pi} ${co(c)}r^2\cdot r\,d\theta\,dr=${co(c)}\cdot 2\pi\cdot\frac{${b}^4-${a}^4}{4}`,
        tex`=${fmt(ans)}`,
      ],
      () =>
        integrate2D((x, y) => c * (x * x + y * y), -b, b, diskLo(b), diskHi(b)) -
        integrate2D((x, y) => c * (x * x + y * y), -a, a, diskLo(a), diskHi(a)),
    );
  }
  if (d === 2) {
    const variante = ri(1, 3);
    if (variante === 1) {
      const R = ri(1, 3), c = ri(1, 3);
      const ans = (c * 2 * Math.PI * Math.pow(R, 3)) / 3;
      return mk(
        'polar', 2, 'Distancia al origen sobre un disco',
        tex`\iint_D ${co(c)}\sqrt{x^2+y^2}\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
        ans,
        [
          '√(x²+y²) = r. El integrando queda c·r y el elemento de área aporta otro r.',
          `Te queda ∫₀^{2π} ∫₀^${R} ${c}r² dr dθ.`,
        ],
        [
          tex`\int_0^{2\pi}\!\!\int_0^{${R}} ${co(c)}\,r\cdot r\,dr\,d\theta=${co(c)}\cdot 2\pi\cdot\frac{${R}^3}{3}`,
          tex`=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => c * Math.sqrt(x * x + y * y), -R, R, diskLo(R), diskHi(R)),
      );
    }
    if (variante === 2) {
      const a = ri(1, 3), b = ri(a + 1, 4), c = ri(1, 3);
      const ans = (c * 2 * Math.PI * (Math.pow(b, 3) - Math.pow(a, 3))) / 3;
      return mk(
        'polar', 2, 'Distancia al origen sobre un anillo',
        tex`\iint_D ${co(c)}\sqrt{x^2+y^2}\,dA,\qquad D:\ ${a * a}\le x^2+y^2\le ${b * b}`,
        ans,
        [
          'Igual que el disco, pero r corre de ' + a + ' a ' + b + '.',
          `En polares el integrando es ${c}·r·r = ${c}r².`,
        ],
        [
          tex`\int_${a}^{${b}}\!\!\int_0^{2\pi} ${co(c)}\,r\cdot r\,d\theta\,dr=${co(c)}\cdot 2\pi\cdot\frac{${b}^3-${a}^3}{3}`,
          tex`=${fmt(ans)}`,
        ],
        () =>
          integrate2D((x, y) => c * Math.sqrt(x * x + y * y), -b, b, diskLo(b), diskHi(b)) -
          integrate2D((x, y) => c * Math.sqrt(x * x + y * y), -a, a, diskLo(a), diskHi(a)),
      );
    }
    const R = ri(1, 3), c = ri(1, 3);
    const ans = (c * Math.PI * Math.pow(R, 3)) / 6;
    return mk(
      'polar', 2, 'Distancia al origen en el primer cuadrante',
      tex`\iint_D ${co(c)}\sqrt{x^2+y^2}\,dA,\qquad D:\ x^2+y^2\le ${R * R},\ x\ge 0,\ y\ge 0`,
      ans,
      [
        'Primer cuadrante ⇒ θ va de 0 a π/2.',
        `El integrando en polares es ${c}·r² y r corre de 0 a ${R}.`,
      ],
      [
        tex`\int_0^{\pi/2}\!\!\int_0^{${R}} ${co(c)}\,r\cdot r\,dr\,d\theta=${co(c)}\cdot\frac{\pi}{2}\cdot\frac{${R}^3}{3}`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * Math.sqrt(x * x + y * y), 0, R, () => 0, diskHi(R)),
    );
  }
  const variante = ri(1, 6);
  if (variante === 1) {
    const R = ri(1, 3), c = ri(1, 4);
    const ans = (c * Math.pow(R, 4)) / 8;
    return mk(
      'polar', 3, 'Cuarto de disco',
      tex`\iint_D ${co(c)}xy\,dA,\qquad D:\ x^2+y^2\le ${R * R},\ x\ge 0,\ y\ge 0`,
      ans,
      [
        'Primer cuadrante ⇒ θ va de 0 a π/2. x = r cosθ, y = r senθ.',
        '∫₀^{π/2} cosθ senθ dθ = 1/2.',
      ],
      [
        tex`\int_0^{\pi/2}\!\!\int_0^{${R}} ${co(c)}\,r^2\cos\theta\sin\theta\cdot r\,dr\,d\theta`,
        tex`=${co(c)}\left(\int_0^{\pi/2}\cos\theta\sin\theta\,d\theta\right)\left(\int_0^{${R}}r^3dr\right)=${co(c)}\cdot\frac12\cdot\frac{${R}^4}{4}=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c * x * y, 0, R, () => 0, diskHi(R)),
    );
  }
  if (variante === 2) {
    const R = pick([1, 2]);
    const ans = Math.PI * (1 - Math.exp(-R * R));
    return mk(
      'polar', 3, 'La gaussiana clásica',
      tex`\iint_D e^{-(x^2+y^2)}\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
      ans,
      [
        'En cartesianas es imposible, en polares es regalada: e^{−r²}·r dr se integra con sustitución u = r².',
        '∫₀^R r e^{−r²} dr = (1 − e^{−R²})/2.',
      ],
      [
        tex`\int_0^{2\pi}\!\!\int_0^{${R}}e^{-r^2}\,r\,dr\,d\theta=2\pi\cdot\frac{1-e^{-${R * R}}}{2}`,
        tex`=\pi\left(1-e^{-${R * R}}\right)=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => Math.exp(-(x * x + y * y)), -R, R, diskLo(R), diskHi(R)),
    );
  }
  if (variante === 3) {
    const R = ri(1, 4), c = ri(1, 3);
    const ans = c * Math.PI * Math.log(1 + R * R);
    return mk(
      'polar', 3, 'El integrando 1/(1 + r²)',
      tex`\iint_D ${co(c)}\frac{1}{1+x^2+y^2}\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
      ans,
      [
        'En polares el denominador es 1 + r² y dA aporta el r: la integral es ∫ r/(1+r²) dr.',
        'Sustituye u = 1 + r² y el resultado es ½·ln(1 + r²).',
      ],
      [
        tex`\int_0^{2\pi}\!\!\int_0^{${R}} ${co(c)}\frac{r}{1+r^2}\,dr\,d\theta=${co(c)}\cdot 2\pi\cdot\frac{1}{2}\ln(1+${R * R})`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => c / (1 + x * x + y * y), -R, R, diskLo(R), diskHi(R)),
    );
  }
  if (variante === 4) {
    const R = ri(1, 4);
    const ans = (Math.PI * (1 - Math.exp(-R * R))) / 4;
    return mk(
      'polar', 3, 'La gaussiana en el primer cuadrante',
      tex`\iint_D e^{-(x^2+y^2)}\,dA,\qquad D:\ x^2+y^2\le ${R * R},\ x\ge 0,\ y\ge 0`,
      ans,
      [
        'Es un cuarto de la gaussiana clásica: en polares θ va de 0 a π/2.',
        'La integral radial es la misma: (1 − e^{−R²})/2.',
      ],
      [
        tex`\int_0^{\pi/2}\!\!\int_0^{${R}}e^{-r^2}\,r\,dr\,d\theta=\frac{\pi}{2}\cdot\frac{1-e^{-${R * R}}}{2}`,
        tex`=${fmt(ans)}`,
      ],
      () => integrate2D((x, y) => Math.exp(-(x * x + y * y)), 0, R, () => 0, diskHi(R)),
    );
  }
  if (variante === 5) {
    const R = ri(1, 4);
    const ans = (2 * Math.PI * Math.pow(R, 3)) / 3;
    return mk(
      'polar', 3, 'El volumen del hemisferio',
      tex`\iint_D \sqrt{${R * R}-x^2-y^2}\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
      ans,
      [
        'El integrando es la altura de la esfera de radio ' + R + ': la integral da el volumen del hemisferio.',
        'En polares el integrando es √(R² − r²) y dA aporta el r: ∫ r√(R² − r²) dr.',
      ],
      [
        tex`\int_0^{2\pi}\!\!\int_0^{${R}}\sqrt{${R * R}-r^2}\,r\,dr\,d\theta=2\pi\cdot\frac{${R}^3}{3}`,
        tex`=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          (x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y)),
          -R,
          R,
          diskLo(R),
          diskHi(R),
        ),
    );
  }
  const R = ri(1, 4), c = ri(2, 3);
  const ans = (c * 2 * Math.PI * Math.pow(R, 3)) / 3;
  return mk(
    'polar', 3, 'El volumen del hemisferio con factor',
    tex`\iint_D ${co(c)}\sqrt{${R * R}-x^2-y^2}\,dA,\qquad D:\ x^2+y^2\le ${R * R}`,
    ans,
    [
      'El integrando es la altura de la esfera de radio ' + R + ': la integral da el volumen del hemisferio.',
      'En polares el integrando es √(R² − r²) y dA aporta el r: ∫ r√(R² − r²) dr.',
    ],
    [
      tex`\int_0^{2\pi}\!\!\int_0^{${R}}${co(c)}\sqrt{${R * R}-r^2}\,r\,dr\,d\theta=${co(c)}\cdot 2\pi\cdot\frac{${R}^3}{3}`,
      tex`=${fmt(ans)}`,
    ],
    () =>
      integrate2D(
        (x, y) => c * Math.sqrt(Math.max(0, R * R - x * x - y * y)),
        -R,
        R,
        diskLo(R),
        diskHi(R),
      ),
  );
}

/* ───────────────────────── Mundo 4a · Jacobiano ───────────────────────── */
function jacobian(d: Difficulty): Question {
  if (d === 1) {
    let a = nz(-3, 4), b = nz(-3, 4), c = nz(-3, 4), dd = nz(-3, 4);
    while (a * dd - b * c === 0) dd = nz(-3, 4);
    const ans = a * dd - b * c;
    return mk(
      'jacobian', 1, 'Jacobiano de una transformación lineal',
      tex`x=${lin(a, 'u', b, 'v')},\qquad y=${lin(c, 'u', dd, 'v')}.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}`,
      ans,
      [
        'J = x_u · y_v − x_v · y_u (determinante de la matriz de derivadas parciales).',
        `x_u = ${a}, x_v = ${b}, y_u = ${c}, y_v = ${dd}.`,
      ],
      [
        tex`\frac{\partial(x,y)}{\partial(u,v)}=\begin{vmatrix}${a}&${b}\\${c}&${dd}\end{vmatrix}=(${a})(${dd})-(${b})(${c})=${ans}`,
      ],
      () => jacobianNum((u, v) => [a * u + b * v, c * u + dd * v], 0.3, -0.7),
      0.01,
    );
  }
  if (d === 2) {
    const variante = ri(1, 5);
    if (variante === 1) {
      const u0 = ri(1, 3), v0 = ri(1, 3);
      const ans = 4 * (u0 * u0 + v0 * v0);
      return mk(
        'jacobian', 2, 'Jacobiano evaluado en un punto',
        tex`x=u^2-v^2,\quad y=2uv.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
        ans,
        [
          'Deriva: x_u = 2u, x_v = −2v, y_u = 2v, y_v = 2u.',
          'J = (2u)(2u) − (−2v)(2v) = 4u² + 4v². Ahora evalúa.',
        ],
        [
          tex`J=\begin{vmatrix}2u&-2v\\2v&2u\end{vmatrix}=4u^2+4v^2`,
          tex`J(${u0},${v0})=4(${u0 * u0}+${v0 * v0})=${ans}`,
        ],
        () => jacobianNum((u, v) => [u * u - v * v, 2 * u * v], u0, v0),
        0.01,
      );
    }
    if (variante === 2) {
      const r0 = ri(1, 3), t0 = ri(0, 3);
      const ans = r0;
      return mk(
        'jacobian', 2, 'Jacobiano de las coordenadas polares',
        tex`x=r\cos\theta,\quad y=r\sin\theta.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(r,\theta)}\text{ en }(r,\theta)=(${r0},${t0})`,
        ans,
        [
          'Deriva: x_r = cosθ, x_θ = −r senθ, y_r = senθ, y_θ = r cosθ.',
          'J = cosθ·r cosθ − (−r senθ)·senθ = r(cos²θ + sen²θ) = r.',
        ],
        [
          tex`J=\begin{vmatrix}\cos\theta&-r\sin\theta\\ \sin\theta&r\cos\theta\end{vmatrix}=r(\cos^2\theta+\sin^2\theta)=r`,
          tex`J(${r0},${t0})=${ans}`,
        ],
        () => jacobianNum((u, v) => [u * Math.cos(v), u * Math.sin(v)], r0, t0),
        0.01,
      );
    }
    if (variante === 3) {
      const A = ri(1, 3), B = ri(1, 3), u0 = ri(1, 3), v0 = ri(1, 3);
      const ans = A * B * u0;
      return mk(
        'jacobian', 2, 'Jacobiano de coordenadas elípticas',
        tex`x=${A}u\cos v,\quad y=${B}u\sin v.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
        ans,
        [
          `Deriva: x_u = ${A}cos v, x_v = −${A}u sen v, y_u = ${B}sen v, y_v = ${B}u cos v.`,
          `J = ${A}·${B}u(cos²v + sen²v) = ${A * B}u.`,
        ],
        [
          tex`J=\begin{vmatrix}${A}\cos v&-${A}u\sin v\\ ${B}\sin v&${B}u\cos v\end{vmatrix}=${A * B}u(\cos^2 v+\sin^2 v)=${A * B}u`,
          tex`J(${u0},${v0})=${ans}`,
        ],
        () => jacobianNum((u, v) => [A * u * Math.cos(v), B * u * Math.sin(v)], u0, v0),
        0.01,
      );
    }
    if (variante === 4) {
      const u0 = ri(1, 3), v0 = ri(1, 3);
      const ans = 2 * u0;
      return mk(
        'jacobian', 2, 'Jacobiano de x = u²',
        tex`x=u^2,\quad y=u+v.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
        ans,
        [
          'Deriva: x_u = 2u, x_v = 0, y_u = 1, y_v = 1.',
          'J = (2u)(1) − (0)(1) = 2u.',
        ],
        [
          tex`J=\begin{vmatrix}2u&0\\1&1\end{vmatrix}=2u`,
          tex`J(${u0},${v0})=${ans}`,
        ],
        () => jacobianNum((u, v) => [u * u, u + v], u0, v0),
        0.01,
      );
    }
    const u0 = ri(1, 3), v0 = ri(1, 3);
    const ans = -1 - 2 * v0;
    return mk(
      'jacobian', 2, 'Jacobiano con u + v²',
      tex`x=u+v^2,\quad y=u-v.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
      ans,
      [
        'Deriva: x_u = 1, x_v = 2v, y_u = 1, y_v = −1.',
        'J = (1)(−1) − (2v)(1) = −1 − 2v.',
      ],
      [
        tex`J=\begin{vmatrix}1&2v\\1&-1\end{vmatrix}=-1-2v`,
        tex`J(${u0},${v0})=${ans}`,
      ],
      () => jacobianNum((u, v) => [u + v * v, u - v], u0, v0),
      0.01,
    );
  }
  const variante = ri(1, 5);
  if (variante === 1) {
    const u0 = ri(0, 1);
    const ans = Math.exp(2 * u0);
    return mk(
      'jacobian', 3, 'Polares «exponenciales»',
      tex`x=e^{u}\cos v,\quad y=e^{u}\sin v.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }u=${u0}\ (\text{cualquier }v)`,
      ans,
      [
        'x_u = eᵘ cos v, x_v = −eᵘ sen v, y_u = eᵘ sen v, y_v = eᵘ cos v.',
        'J = e²ᵘ (cos²v + sen²v) = e²ᵘ.',
      ],
      [
        tex`J=e^{2u}(\cos^2v+\sin^2v)=e^{2u}`,
        tex`J=e^{${2 * u0}}=${fmt(ans)}`,
      ],
      () => jacobianNum((u, v) => [Math.exp(u) * Math.cos(v), Math.exp(u) * Math.sin(v)], u0, 0),
    );
  }
  if (variante === 2) {
    const u0 = ri(1, 4), v0 = ri(1, 3);
    const ans = (-2 * u0) / v0;
    return mk(
      'jacobian', 3, 'Cociente en la transformación',
      tex`x=uv,\quad y=\frac{u}{v}.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
      ans,
      [
        'x_u = v, x_v = u, y_u = 1/v, y_v = −u/v².',
        'J = v(−u/v²) − u(1/v) = −2u/v.',
      ],
      [
        tex`J=\begin{vmatrix}v&u\\ 1/v&-u/v^2\end{vmatrix}=-\frac{u}{v}-\frac{u}{v}=-\frac{2u}{v}`,
        tex`J(${u0},${v0})=-\frac{${2 * u0}}{${v0}}=${fmt(ans)}`,
      ],
      () => jacobianNum((u, v) => [u * v, u / v], u0, v0),
    );
  }
  if (variante === 3) {
    const u0 = ri(1, 3), v0 = ri(1, 3);
    const ans = (2 * u0) / v0;
    return mk(
      'jacobian', 3, 'Cociente y producto a la vez',
      tex`x=\frac{u}{v},\quad y=uv.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
      ans,
      [
        'x_u = 1/v, x_v = −u/v², y_u = v, y_v = u.',
        'J = (1/v)(u) − (−u/v²)(v) = 2u/v.',
      ],
      [
        tex`J=\begin{vmatrix}1/v&-u/v^2\\v&u\end{vmatrix}=\frac{u}{v}+\frac{u}{v}=\frac{2u}{v}`,
        tex`J(${u0},${v0})=\frac{${2 * u0}}{${v0}}=${fmt(ans)}`,
      ],
      () => jacobianNum((u, v) => [u / v, u * v], u0, v0),
    );
  }
  if (variante === 4) {
    const u0 = ri(1, 3), v0 = ri(1, 3);
    const ans = 4 * u0 * v0 + 1;
    return mk(
      'jacobian', 3, 'Transformación con potencias cruzadas',
      tex`x=u^2-v,\quad y=u+v^2.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
      ans,
      [
        'x_u = 2u, x_v = −1, y_u = 1, y_v = 2v.',
        'J = (2u)(2v) − (−1)(1) = 4uv + 1.',
      ],
      [
        tex`J=\begin{vmatrix}2u&-1\\1&2v\end{vmatrix}=4uv+1`,
        tex`J(${u0},${v0})=${ans}`,
      ],
      () => jacobianNum((u, v) => [u * u - v, u + v * v], u0, v0),
      0.01,
    );
  }
  const u0 = ri(1, 3), v0 = ri(1, 3);
  const ans = -4 * u0 * v0 - 1;
  return mk(
    'jacobian', 3, 'Transformación con signo invertido',
    tex`x=u^2+v,\quad y=u-v^2.\qquad\text{Calcula }\frac{\partial(x,y)}{\partial(u,v)}\text{ en }(u,v)=(${u0},${v0})`,
    ans,
    [
      'x_u = 2u, x_v = 1, y_u = 1, y_v = −2v.',
      'J = (2u)(−2v) − (1)(1) = −4uv − 1.',
    ],
    [
      tex`J=\begin{vmatrix}2u&1\\1&-2v\end{vmatrix}=-4uv-1`,
      tex`J(${u0},${v0})=${ans}`,
    ],
    () => jacobianNum((u, v) => [u * u + v, u - v * v], u0, v0),
    0.01,
  );
}

/* ───────────────────────── Mundo 4b · Cambio de variables ───────────────────────── */
function change(d: Difficulty): Question {
  if (d === 1) {
    let a = nz(-2, 3), b = nz(-2, 3), c = nz(-2, 3), dd = nz(-2, 3);
    while (a * dd - b * c === 0) dd = nz(-2, 3);
    const p = ri(1, 3), q = ri(1, 3);
    const J = a * dd - b * c;
    const ans = Math.abs(J) * p * q;
    return mk(
      'change', 1, 'Área de una imagen bajo T',
      tex`T(u,v)=(${lin(a, 'u', b, 'v')},\ ${lin(c, 'u', dd, 'v')}),\quad R=[0,${p}]\times[0,${q}].\quad\text{Área de }T(R)=\ ?`,
      ans,
      [
        'Área de T(R) = ∬_R |J| du dv. Si T es lineal, |J| es constante.',
        'Calcula J = ad − bc, toma valor absoluto y multiplica por el área de R.',
      ],
      [
        tex`J=(${a})(${dd})-(${b})(${c})=${J}`,
        tex`\text{Área}=|J|\cdot(${p}\cdot ${q})=${Math.abs(J)}\cdot ${p * q}=${ans}`,
      ],
      () =>
        polygonArea([
          [a * 0 + b * 0, c * 0 + dd * 0],
          [a * p + b * 0, c * p + dd * 0],
          [a * p + b * q, c * p + dd * q],
          [a * 0 + b * q, c * 0 + dd * q],
        ]),
      0.01,
    );
  }
  if (d === 2) {
    const a = ri(1, 3), b = ri(1, 3);
    const variante = ri(1, 5);
    if (variante === 1) {
      const ans = (a * a * b * b) / 4;
      return mk(
        'change', 2, 'Cambio de variables con escalamiento',
        tex`D=\{0\le x\le ${a},\ 0\le y\le ${b}\}.\quad\text{Con }x=${co(a)}u,\ y=${co(b)}v:\quad \iint_D xy\,dA=\ ?`,
        ans,
        [
          'D es la imagen del cuadrado unitario [0,1]² bajo x = au, y = bv. J = ab.',
          'xy = (au)(bv) = ab·uv. La integral queda ∬ ab·uv·|ab| du dv.',
        ],
        [
          tex`\iint_D xy\,dA=\int_0^1\!\!\int_0^1 (${a}u)(${b}v)\cdot ${a * b}\,du\,dv`,
          tex`=${a * a * b * b}\cdot\frac12\cdot\frac12=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => x * y, 0, a, () => 0, () => b),
      );
    }
    if (variante === 2) {
      const ans = (a * a * b) / 2;
      return mk(
        'change', 2, 'Escalamiento integrando solo x',
        tex`D=\{0\le x\le ${a},\ 0\le y\le ${b}\}.\quad\text{Con }x=${co(a)}u,\ y=${co(b)}v:\quad \iint_D x\,dA=\ ?`,
        ans,
        [
          'Mismo escalamiento, pero ahora el integrando es solo x: en (u,v) queda au y el Jacobiano |J| = ab.',
          'La integral es ∫₀¹∫₀¹ au·ab du dv = a²b·½·1.',
        ],
        [
          tex`\iint_D x\,dA=\int_0^1\!\!\int_0^1 (${a}u)\cdot ${a * b}\,du\,dv`,
          tex`=${a * a * b}\cdot\frac12=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => x, 0, a, () => 0, () => b),
      );
    }
    if (variante === 3) {
      const ans = (a * b * b) / 2;
      return mk(
        'change', 2, 'Escalamiento integrando solo y',
        tex`D=\{0\le x\le ${a},\ 0\le y\le ${b}\}.\quad\text{Con }x=${co(a)}u,\ y=${co(b)}v:\quad \iint_D y\,dA=\ ?`,
        ans,
        [
          'Ahora el integrando es y: en (u,v) queda bv y sigue entrando el Jacobiano |J| = ab.',
          'La integral es ∫₀¹∫₀¹ bv·ab du dv = ab²·1·½.',
        ],
        [
          tex`\iint_D y\,dA=\int_0^1\!\!\int_0^1 (${b}v)\cdot ${a * b}\,du\,dv`,
          tex`=${a * b * b}\cdot\frac12=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => y, 0, a, () => 0, () => b),
      );
    }
    if (variante === 4) {
      const ans = (Math.pow(a, 3) * b) / 3 + (a * Math.pow(b, 3)) / 3;
      return mk(
        'change', 2, 'Escalamiento con suma de cuadrados',
        tex`D=\{0\le x\le ${a},\ 0\le y\le ${b}\}.\quad\text{Con }x=${co(a)}u,\ y=${co(b)}v:\quad \iint_D (x^2+y^2)\,dA=\ ?`,
        ans,
        [
          'El integrando se separa: x² + y². En (u,v) quedan a²u² + b²v², y el Jacobiano es ab.',
          'Integrales simples: ∫₀¹u² du = 1/3 y ∫₀¹v² dv = 1/3.',
        ],
        [
          tex`\iint_D (x^2+y^2)\,dA=\int_0^1\!\!\int_0^1\left(${a * a}u^2+${b * b}v^2\right)\cdot ${a * b}\,du\,dv`,
          tex`=${a * b}\left(${a * a}\cdot\frac13+${b * b}\cdot\frac13\right)=${fmt(ans)}`,
        ],
        () => integrate2D((x, y) => x * x + y * y, 0, a, () => 0, () => b),
      );
    }
    const ans = Math.PI * a * b;
    return mk(
      'change', 2, 'Área de una elipse',
      tex`D=\left\{(x,y):\,\frac{x^2}{${a * a}}+\frac{y^2}{${b * b}}\le 1\right\}\quad(\text{imagen de }x=${co(a)}u,\ y=${co(b)}v).\quad\text{Área de }D=\ ?`,
      ans,
      [
        'D es la imagen del disco unitario bajo x = au, y = bv: es una elipse con semiejes a y b.',
        'El Jacobiano es ab y el disco unitario tiene área π: el área de D es π·ab.',
      ],
      [
        tex`|J|=${a}\cdot${b}=${a * b}\qquad\text{Área del disco unitario}=\pi`,
        tex`\text{Área de }D=\pi\cdot${a * b}=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          () => 1,
          -a,
          a,
          (x) => -b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a))),
          (x) => b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a))),
        ),
    );
  }
  const variante = ri(1, 5);
  if (variante === 1) {
    const a = ri(1, 3), b = ri(1, 3);
    const ans = (a * a * b) / 4;
    return mk(
      'change', 3, 'Cambio de variables sobre un paralelogramo',
      tex`D=\{0\le x+y\le ${a},\ 0\le x-y\le ${b}\}.\quad\text{Usa }u=x+y,\ v=x-y\text{ para calcular }\iint_D (x+y)\,dA`,
      ans,
      [
        'Despeja: x = (u+v)/2, y = (u−v)/2. Entonces |∂(x,y)/∂(u,v)| = 1/2.',
        'x + y = u. La región en (u,v) es el rectángulo [0,a]×[0,b].',
      ],
      [
        tex`J=\begin{vmatrix}1/2&1/2\\1/2&-1/2\end{vmatrix}=-\tfrac12\ \Rightarrow\ |J|=\tfrac12`,
        tex`\iint_D(x+y)dA=\int_0^{${b}}\!\!\int_0^{${a}}u\cdot\tfrac12\,du\,dv=\tfrac12\cdot\frac{${a}^2}{2}\cdot ${b}=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          (x, y) => x + y,
          0,
          (a + b) / 2,
          (x) => Math.max(-x, x - b),
          (x) => Math.min(a - x, x),
        ),
    );
  }
  if (variante === 2) {
    const a = ri(1, 3), b = ri(1, 3);
    const ans = (a * a * b) / 6;
    return mk(
      'change', 3, 'Paralelogramo con u = x + 2y',
      tex`D=\{0\le x+2y\le ${a},\ 0\le x-y\le ${b}\}.\quad\text{Usa }u=x+2y,\ v=x-y\text{ para calcular }\iint_D (x+2y)\,dA`,
      ans,
      [
        'Despeja el sistema: x = (u+2v)/3 y y = (u−v)/3. El Jacobiano vale 1/3 en valor absoluto.',
        'x + 2y = u, y la región en (u,v) es el rectángulo [0,a]×[0,b].',
      ],
      [
        tex`x=\frac{u+2v}{3},\ y=\frac{u-v}{3}\ \Rightarrow\ \left|\frac{\partial(x,y)}{\partial(u,v)}\right|=\tfrac13`,
        tex`\iint_D(x+2y)dA=\int_0^{${b}}\!\!\int_0^{${a}}u\cdot\tfrac13\,du\,dv=\tfrac13\cdot\frac{${a}^2}{2}\cdot ${b}=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          (x, y) => x + 2 * y,
          0,
          (a + 2 * b) / 3,
          (x) => Math.max(-x / 2, x - b),
          (x) => Math.min((a - x) / 2, x),
        ),
    );
  }
  if (variante === 3) {
    const a = ri(1, 3), b = ri(1, 3);
    const ans = (a * a * b) / 6;
    return mk(
      'change', 3, 'Paralelogramo con u = x + y, v = x − 2y',
      tex`D=\{0\le x+y\le ${a},\ 0\le x-2y\le ${b}\}.\quad\text{Usa }u=x+y,\ v=x-2y\text{ para calcular }\iint_D (x+y)\,dA`,
      ans,
      [
        'Esta vez: x = (2u+v)/3 y y = (u−v)/3. El Jacobiano en valor absoluto sigue siendo 1/3.',
        'x + y = u y la región en (u,v) es el rectángulo [0,a]×[0,b].',
      ],
      [
        tex`x=\frac{2u+v}{3},\ y=\frac{u-v}{3}\ \Rightarrow\ \left|\frac{\partial(x,y)}{\partial(u,v)}\right|=\tfrac13`,
        tex`\iint_D(x+y)dA=\int_0^{${b}}\!\!\int_0^{${a}}u\cdot\tfrac13\,du\,dv=\tfrac13\cdot\frac{${a}^2}{2}\cdot ${b}=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          (x, y) => x + y,
          0,
          (2 * a + b) / 3,
          (x) => Math.max(-x, (x - b) / 2),
          (x) => Math.min(a - x, x / 2),
        ),
    );
  }
  if (variante === 4) {
    const a = ri(2, 4);
    const ans = ((a - 1) * Math.LN2) / 2;
    return mk(
      'change', 3, 'Región hiperbólica: el área',
      tex`D=\{(x,y):\,1\le xy\le ${a},\ x\le y\le 2x\}.\quad\text{Con }u=xy,\ v=y/x:\quad \text{área de }D=\ ?`,
      ans,
      [
        'Con u = xy y v = y/x la región uv es el rectángulo 1 ≤ u ≤ a, 1 ≤ v ≤ 2.',
        'El Jacobiano vale |J| = 1/(2v), así que el área es ∬ 1/(2v) du dv sobre ese rectángulo.',
      ],
      [
        tex`x=\sqrt{u/v},\ y=\sqrt{uv}\ \Rightarrow\ \left|\frac{\partial(x,y)}{\partial(u,v)}\right|=\frac{1}{2v}`,
        tex`\text{Área}=\int_1^{${a}}\!\!\int_1^{2}\frac{1}{2v}\,dv\,du=\frac{1}{2}\ln 2\cdot(${a}-1)=${fmt(ans)}`,
      ],
      () =>
        integrate2D(
          () => 1,
          1 / Math.SQRT2,
          Math.sqrt(a),
          (x) => Math.max(x, 1 / x),
          (x) => Math.min(2 * x, a / x),
        ),
    );
  }
  const a = ri(2, 4);
  const ans = (a - 1) / 2;
  return mk(
    'change', 3, 'Región hiperbólica: integral de y/x',
    tex`D=\{(x,y):\,1\le xy\le ${a},\ x\le y\le 2x\}.\quad\text{Con }u=xy,\ v=y/x:\quad \iint_D \frac{y}{x}\,dA=\ ?`,
    ans,
    [
      'Misma región y mismo Jacobiano |J| = 1/(2v), pero ahora el integrando y/x es exactamente v.',
      'En (u,v) el integrando queda v·(1/(2v)) = 1/2, así que la integral es fácil.',
    ],
    [
      tex`x=\sqrt{u/v},\ y=\sqrt{uv}\ \Rightarrow\ \left|\frac{\partial(x,y)}{\partial(u,v)}\right|=\frac{1}{2v}`,
      tex`\iint_D\frac{y}{x}dA=\int_1^{${a}}\!\!\int_1^{2}v\cdot\frac{1}{2v}\,dv\,du=\frac{1}{2}(${a}-1)=${fmt(ans)}`,
    ],
    () =>
      integrate2D(
        (x, y) => y / x,
        1 / Math.SQRT2,
        Math.sqrt(a),
        (x) => Math.max(x, 1 / x),
        (x) => Math.min(2 * x, a / x),
      ),
  );
}

const GENERATORS: Record<Topic, (d: Difficulty) => Question> = {
  rect,
  general,
  polar,
  jacobian,
  change,
};

/* ───────────────────────── Variedad: no repetir el enunciado de hace rato ───────────────────────── */
const MAX_RECENT = 5;
const MAX_TRIES = 12;
/** últimos enunciados por (tema, dificultad) — solo en memoria, no va al guardado */
const recentBuffer = new Map<string, string[]>();
/** cuántos enunciados distintos tiene cada (tema, dificultad) */
const poolSize = new Map<string, number>();

/**
 * Estimate cuántas variantes tiene un tema+dificultad. Se hace una sola vez
 * por combinación con 40 muestras: si el tema tiene pocas variantes se
 * detectan todas; si tiene muchas, da igual porque el tope es 5.
 */
function estimatePool(topic: Topic, difficulty: Difficulty): number {
  const key = `${topic}:${difficulty}`;
  let n = poolSize.get(key);
  if (n === undefined) {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(GENERATORS[topic](difficulty).statementTex);
    n = seen.size;
    poolSize.set(key, n);
  }
  return n;
}

export function generateQuestion(topic: Topic, difficulty: Difficulty): Question {
  const key = `${topic}:${difficulty}`;
  const buf = recentBuffer.get(key) ?? [];
  recentBuffer.set(key, buf);
  // ventana: hasta 5 recientes, pero nunca más que (variantes del tema − 1)
  const limit = Math.min(MAX_RECENT, Math.max(0, estimatePool(topic, difficulty) - 1));

  let q = GENERATORS[topic](difficulty);
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const window = buf.slice(-limit);
    if (!window.includes(q.statementTex)) break;
    q = GENERATORS[topic](difficulty);
  }
  buf.push(q.statementTex);
  if (buf.length > MAX_RECENT) buf.shift();
  return q;
}

export const TOPIC_LABEL: Record<Topic, string> = {
  rect: 'Fubini · Rectángulos',
  general: 'Regiones generales',
  polar: 'Coordenadas polares',
  jacobian: 'Jacobiano',
  change: 'Cambio de variables',
};
