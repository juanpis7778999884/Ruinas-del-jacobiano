/**
 * Parser seguro de respuestas matemáticas escritas por el jugador.
 * Acepta: 3.5  3,5  7/2  2pi  π/4  sqrt(2)  √2  sqrt2  e^2  e²  π²
 *         (e^4-1)/2  -3  2*pi^2  abs(-3)  tan(0.5)  atan(1)
 * NO usa eval().
 */

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  exp: Math.exp,
  ln: Math.log,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  atan: Math.atan,
  abs: Math.abs,
};

function tokenize(s: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (Number.isNaN(n)) return null;
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }
    if (/[a-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-z]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private t: Tok[]) {}

  parse(): number {
    const v = this.expr();
    if (this.p !== this.t.length) throw new Error('sobran símbolos');
    return v;
  }

  private isOp(v: string): boolean {
    const k = this.t[this.p];
    return !!k && k.t === 'op' && k.v === v;
  }

  private expr(): number {
    let v = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.t[this.p++] as { v: string }).v;
      const r = this.term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  private term(): number {
    let v = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.p++;
        v *= this.unary();
      } else if (this.isOp('/')) {
        this.p++;
        v /= this.unary();
      } else {
        const k = this.t[this.p];
        // multiplicación implícita: 2pi, 3(x), 2sqrt(2)
        if (k && (k.t === 'num' || k.t === 'id' || (k.t === 'op' && k.v === '('))) {
          v *= this.unary();
        } else break;
      }
    }
    return v;
  }

  private unary(): number {
    if (this.isOp('-')) {
      this.p++;
      return -this.unary();
    }
    if (this.isOp('+')) {
      this.p++;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const b = this.atom();
    if (this.isOp('^')) {
      this.p++;
      const e = this.unary();
      return Math.pow(b, e);
    }
    return b;
  }

  private atom(): number {
    const k = this.t[this.p++];
    if (!k) throw new Error('fin inesperado');
    if (k.t === 'num') return k.v;
    if (k.t === 'id') {
      if (k.v === 'pi') return Math.PI;
      if (k.v === 'e') return Math.E;
      const f = FUNCS[k.v];
      if (!f) throw new Error('función desconocida');
      if (this.isOp('(')) {
        this.p++;
        const a = this.expr();
        if (!this.isOp(')')) throw new Error('falta )');
        this.p++;
        return f(a);
      }
      // sqrt2, sqrt 2, abs3: argumento numérico sin paréntesis
      const nx = this.t[this.p];
      if (nx && nx.t === 'num') {
        this.p++;
        return f(nx.v);
      }
      throw new Error('falta (');
    }
    if (k.t === 'op' && k.v === '(') {
      const v = this.expr();
      if (!this.isOp(')')) throw new Error('falta )');
      this.p++;
      return v;
    }
    throw new Error('símbolo inesperado');
  }
}

export function parseAnswer(input: string): number | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*(\d+(\.\d+)?)/g, 'sqrt($1)')
    .replace(/√/g, 'sqrt')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/\*\*/g, '^')
    .replace(/,/g, '.');
  const toks = tokenize(s);
  if (!toks || toks.length === 0) return null;
  try {
    const v = new Parser(toks).parse();
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Tolerancia: 0.006 absoluto o 0.3 % relativo (lo que sea mayor).
 * El 0.3 % relativo deja pasar respuestas grandes redondeadas con poco error
 * absoluto; el 0.006 absoluto deja pasar un redondeo a 2 decimales
 * (0.859 → 0.86) pero NO un redondeo mal hecho (0.859 → 0.87).
 */
export function checkAnswer(expected: number, got: number, tol = 0.006): boolean {
  return Math.abs(expected - got) <= Math.max(tol, Math.abs(expected) * 0.003);
}
