/**
 * Motor de preguntas: genera problemas con parámetros aleatorios.
 * Cada problema trae: enunciado en LaTeX, respuesta numérica, pistas y solución paso a paso.
 * Para agregar un tema nuevo: escribe un generador y regístralo en GENERATORS.
 */

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

function mk(
  topic: Topic,
  difficulty: Difficulty,
  title: string,
  statementTex: string,
  answer: number,
  hints: string[],
  solutionTex: string[],
  tolerance = 0.02,
): Question {
  return { topic, difficulty, title, statementTex, answer, tolerance, hints, solutionTex };
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
    );
  }
  if (d === 2) {
    const m = ri(1, 2), n = ri(1, 2), a = ri(1, 3), b = ri(1, 3);
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
    );
  }
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
  );
}

/* ───────────────────────── Mundo 2 · Regiones generales y cambio de orden ───────────────────────── */
function general(d: Difficulty): Question {
  if (d === 1) {
    const a = ri(1, 3), m = ri(1, 3), c = ri(1, 4);
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
    );
  }
  if (d === 2) {
    const a = ri(1, 2), c = ri(1, 3);
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
    );
  }
  const a = pick([1, 2]), c = ri(1, 3);
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
  );
}

/* ───────────────────────── Mundo 3 · Coordenadas polares ───────────────────────── */
function polar(d: Difficulty): Question {
  if (d === 1) {
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
    );
  }
  if (d === 2) {
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
    );
  }
  if (Math.random() < 0.5) {
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
    );
  }
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
      0.01,
    );
  }
  if (d === 2) {
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
      0.01,
    );
  }
  if (Math.random() < 0.5) {
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
    );
  }
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
      0.01,
    );
  }
  if (d === 2) {
    const a = ri(1, 3), b = ri(1, 3);
    const ans = (a * a * b * b) / 4;
    return mk(
      'change', 2, 'Cambio de variables con escalamiento',
      tex`D=\{(x,y):\,0\le x\le ${a},\ 0\le y\le ${b}\}.\quad\text{Con }x=${co(a)}u,\ y=${co(b)}v:\quad \iint_D xy\,dA=\ ?`,
      ans,
      [
        'D es la imagen del cuadrado unitario [0,1]² bajo x = au, y = bv. J = ab.',
        'xy = (au)(bv) = ab·uv. La integral queda ∬ ab·uv·|ab| du dv.',
      ],
      [
        tex`\iint_D xy\,dA=\int_0^1\!\!\int_0^1 (${a}u)(${b}v)\cdot ${a * b}\,du\,dv`,
        tex`=${a * a * b * b}\cdot\frac12\cdot\frac12=${fmt(ans)}`,
      ],
    );
  }
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
  );
}

const GENERATORS: Record<Topic, (d: Difficulty) => Question> = {
  rect,
  general,
  polar,
  jacobian,
  change,
};

export function generateQuestion(topic: Topic, difficulty: Difficulty): Question {
  return GENERATORS[topic](difficulty);
}

export const TOPIC_LABEL: Record<Topic, string> = {
  rect: 'Fubini · Rectángulos',
  general: 'Regiones generales',
  polar: 'Coordenadas polares',
  jacobian: 'Jacobiano',
  change: 'Cambio de variables',
};
