import { generateQuestion } from '../src/systems/questions';
import type { Topic, Difficulty } from '../src/systems/questions';
import { checkAnswer } from '../src/systems/mathParse';

const TOPICS: Topic[] = ['rect', 'general', 'polar', 'jacobian', 'change'];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];
const SAMPLES = 60;

interface Result {
  topic: Topic;
  difficulty: Difficulty;
  passed: number;
  failed: number;
  details: { ok: boolean; expected: number; got: number; statement: string }[];
}

const first = (s: string, re: RegExp): string | null => {
  const m = s.match(re);
  return m ? m[1] : null;
};

const coef = (term: string): number => {
  const t = term.trim();
  const body = t.replace(/[a-z]/g, '');
  if (body === '' || body === '+') return 1;
  if (body === '-') return -1;
  return Number(body);
};

const parseLinear = (expr: string): { u: number; v: number } => {
  const e = expr.replace(/\s/g, '');
  const terms = e.match(/([+-]?\d*)[uv]/g) ?? [];
  let u = 0;
  let v = 0;
  for (const term of terms) {
    const letter = term.slice(-1);
    const c = coef(term.slice(0, -1));
    if (letter === 'u') u += c;
    else v += c;
  }
  return { u, v };
};

function integrate2D(
  f: (x: number, y: number) => number,
  x0: number,
  x1: number,
  ylo: (x: number) => number,
  yhi: (x: number) => number,
  nx = 200,
  ny = 200
): number {
  let total = 0;
  const dx = (x1 - x0) / nx;
  for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * dx;
    const y0 = ylo(x);
    const y1 = yhi(x);
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= y0) continue;
    const dy = (y1 - y0) / ny;
    let row = 0;
    for (let j = 0; j < ny; j++) {
      row += f(x, y0 + (j + 0.5) * dy);
    }
    total += row * dy;
  }
  return total * dx;
}

function jacobianNum(
  T: (u: number, v: number) => [number, number],
  u: number,
  v: number,
  h = 1e-5
): number {
  const [xp, yp] = T(u + h, v);
  const [xm, ym] = T(u - h, v);
  const [xq, yq] = T(u, v + h);
  const [xr, yr] = T(u, v - h);
  const xu = (xp - xm) / (2 * h);
  const yu = (yp - ym) / (2 * h);
  const xv = (xq - xr) / (2 * h);
  const yv = (yq - yr) / (2 * h);
  return xu * yv - xv * yu;
}

function verifyRect(d: Difficulty, s: string): number | null {
  if (d === 1) {
    const inner = first(s, /\\left\(([^)]+)\\right\)/);
    if (!inner) return null;
    const m = inner.match(/^([-]?\d*)x\+(\d*)y$/);
    if (!m) return null;
    const a = m[1] === '' ? 1 : Number(m[1]);
    const b = m[2] === '' ? 1 : Number(m[2]);
    const pq = s.match(/\[0,([\d.]+)\]\\times\[0,([\d.]+)\]/);
    if (!pq) return null;
    const p = Number(pq[1]);
    const q = Number(pq[2]);
    return integrate2D((x, y) => a * x + b * y, 0, p, () => 0, () => q);
  }
  if (d === 2) {
    const m2 = s.match(/x\^\{(\d+)\}y\^\{(\d+)\}/);
    if (!m2) return null;
    const m = Number(m2[1]);
    const n = Number(m2[2]);
    const ab = s.match(/\[0,([\d.]+)\]\\times\[0,([\d.]+)\]/);
    if (!ab) return null;
    const a = Number(ab[1]);
    const b = Number(ab[2]);
    return integrate2D((x, y) => Math.pow(x, m) * Math.pow(y, n), 0, a, () => 0, () => b);
  }
  const ab = s.match(/\[0,([\d.]+)\]\\times\[0,([\d.]+)\]/);
  if (!ab) return null;
  const a = Number(ab[1]);
  const b = Number(ab[2]);
  return integrate2D((x, y) => x * Math.exp(y), 0, a, () => 0, () => b);
}

function verifyGeneral(d: Difficulty, s: string): number | null {
  if (d === 1) {
    const cm = s.match(/\\iint_D ([-]?\d*)x\\,dA/);
    if (!cm) return null;
    const c = cm[1] === '' ? 1 : Number(cm[1]);
    const rg = s.match(/0\\le x\\le ([\d.]+),[\s\\]*0\\le y\\le ([-]?\d*)x/);
    if (!rg) return null;
    const a = Number(rg[1]);
    const m = rg[2] === '' ? 1 : Number(rg[2]);
    return integrate2D((x, y) => c * x, 0, a, () => 0, (x) => m * x);
  }
  if (d === 2) {
    const cm = s.match(/\\iint_D ([-]?\d*)xy\\,dA/);
    if (!cm) return null;
    const c = cm[1] === '' ? 1 : Number(cm[1]);
    const rg = s.match(/0\\le x\\le ([\d.]+),[\s\\]*0\\le y\\le x\^2/);
    if (!rg) return null;
    const a = Number(rg[1]);
    return integrate2D((x, y) => c * x * y, 0, a, () => 0, (x) => x * x);
  }
  const rg = s.match(/\\int_0\^\{([\d.]+)\}\\!\\!\\int_x\^\{([\d.]+)\}\s*([-]?\d*)e\^\{y\^2\}/);
  if (!rg) return null;
  const a = Number(rg[1]);
  const c = rg[3] === '' ? 1 : Number(rg[3]);
  return integrate2D((x, y) => c * Math.exp(y * y), 0, a, (x) => x, () => a);
}

function verifyPolar(d: Difficulty, s: string): number | null {
  const rr = s.match(/x\^2\+\s*y\^2\\le ([\d.]+)/);
  if (!rr) return null;
  const R = Math.sqrt(Number(rr[1]));
  const diskLo = (x: number) => -Math.sqrt(Math.max(0, R * R - x * x));
  const diskHi = (x: number) => Math.sqrt(Math.max(0, R * R - x * x));
  if (d === 1) {
    return integrate2D((x, y) => x * x + y * y, -R, R, diskLo, diskHi);
  }
  if (d === 2) {
    const cm = s.match(/\\iint_D ([-]?\d*)\\sqrt\{x\^2\+\s*y\^2}\\,dA/);
    if (!cm) return null;
    const c = cm[1] === '' ? 1 : Number(cm[1]);
    return integrate2D((x, y) => c * Math.sqrt(x * x + y * y), -R, R, diskLo, diskHi);
  }
  if (s.includes('x\\ge 0')) {
    const cq = s.match(/\\iint_D ([-]?\d*)xy\\,dA/);
    const c3 = cq ? (cq[1] === '' ? 1 : Number(cq[1])) : 1;
    return integrate2D((x, y) => c3 * x * y, 0, R, () => 0, (x) => Math.sqrt(Math.max(0, R * R - x * x)));
  }
  return integrate2D((x, y) => Math.exp(-(x * x + y * y)), -R, R, diskLo, diskHi);
}

function verifyJacobian(d: Difficulty, s: string): number | null {
  if (d === 1) {
    const m = s.match(/x=([^,]+),\\qquad y=([^.]+)\./);
    if (!m) return null;
    const xp = parseLinear(m[1]);
    const yp = parseLinear(m[2]);
    const T = (u: number, v: number): [number, number] => [xp.u * u + xp.v * v, yp.u * u + yp.v * v];
    return jacobianNum(T, 0.3, -0.7);
  }
  if (d === 2) {
    const uv = s.match(/\(u,v\)=\(([\d.]+),([\d.]+)\)/);
    if (!uv) return null;
    const u0 = Number(uv[1]);
    const v0 = Number(uv[2]);
    return jacobianNum((u, v) => [u * u - v * v, 2 * u * v], u0, v0);
  }
  // Variante exponencial: x=e^u cos v, y=e^u sin v
  if (s.includes('e^{u}\\cos v')) {
    const u0 = first(s, /u\=([\d.]+)/);
    if (!u0) return null;
    return jacobianNum((u, v) => [Math.exp(u) * Math.cos(v), Math.exp(u) * Math.sin(v)], Number(u0), 0);
  }
  // Variante cociente: x=uv, y=u/v
  const uv = s.match(/\(u,v\)=\(([\d.]+),([\d.]+)\)/);
  if (!uv) return null;
  const u0 = Number(uv[1]);
  const v0 = Number(uv[2]);
  return jacobianNum((u, v) => [u * v, u / v], u0, v0);
}

function verifyChange(d: Difficulty, s: string): number | null {
  if (d === 1) {
    const m = s.match(/T\(u,v\)\=\(([^,]+),\s*([^)]+)\)/);
    if (!m) return null;
    const xp = parseLinear(m[1]);
    const yp = parseLinear(m[2]);
    const T = (u: number, v: number): [number, number] => [xp.u * u + xp.v * v, yp.u * u + yp.v * v];
    const J = Math.abs(jacobianNum(T, 0.2, 0.4));
    const pq = s.match(/R=\[0,([\d.]+)\]\\times\[0,([\d.]+)\]/);
    if (!pq) return null;
    const p = Number(pq[1]);
    const q = Number(pq[2]);
    return J * p * q;
  }
  if (d === 2) {
    const ax = s.match(/0\\le x\\le ([\d.]+)/);
    const by = s.match(/0\\le y\\le ([\d.]+)\\}/);
    if (!ax || !by) return null;
    const a = Number(ax[1]);
    const b = Number(by[1]);
    return integrate2D((x, y) => x * y, 0, a, () => 0, () => b);
  }
  const ax = s.match(/0\\le x\+y\\le ([\d.]+)/);
  const by = s.match(/0\\le x\-y\\le ([\d.]+)\\}/);
  if (!ax || !by) return null;
  const a = Number(ax[1]);
  const b = Number(by[1]);
  const x0 = -b / 2;
  const x1 = (a + b) / 2;
  return integrate2D((x, y) => x + y, x0, x1, (x) => Math.max(-x, x - b), (x) => Math.min(a - x, x));
}

function verify(topic: Topic, d: Difficulty, s: string): number | null {
  switch (topic) {
    case 'rect': return verifyRect(d, s);
    case 'general': return verifyGeneral(d, s);
    case 'polar': return verifyPolar(d, s);
    case 'jacobian': return verifyJacobian(d, s);
    case 'change': return verifyChange(d, s);
  }
}

const results: Result[] = [];

for (const topic of TOPICS) {
  for (const d of DIFFICULTIES) {
    const res: Result = { topic, difficulty: d, passed: 0, failed: 0, details: [] };
    for (let i = 0; i < SAMPLES; i++) {
      const q = generateQuestion(topic, d);
      const expected = verify(topic, d, q.statementTex);
      if (expected === null || !Number.isFinite(expected)) {
        res.failed++;
        res.details.push({ ok: false, expected: expected ?? NaN, got: q.answer, statement: q.statementTex });
        continue;
      }
      const ok = checkAnswer(expected, q.answer, q.tolerance);
      if (ok) res.passed++;
      else {
        res.failed++;
        res.details.push({ ok: false, expected, got: q.answer, statement: q.statementTex });
      }
    }
    results.push(res);
  }
}

let totalOk = 0;
let totalBad = 0;
for (const r of results) {
  totalOk += r.passed;
  totalBad += r.failed;
  const pct = ((r.passed / SAMPLES) * 100).toFixed(1);
  console.log(`${r.topic} d${r.difficulty}: ${r.passed}/${SAMPLES} OK (${pct}%)`);
  for (const det of r.details) {
    if (!det.ok) {
      console.log(`  FALLO expected=${det.expected} got=${det.got} :: ${det.statement}`);
    }
  }
}
console.log(`\nTOTAL: ${totalOk} OK / ${totalBad} FALLOS de ${SAMPLES * TOPICS.length * DIFFICULTIES.length}`);
if (totalBad > 0) process.exit(1);
