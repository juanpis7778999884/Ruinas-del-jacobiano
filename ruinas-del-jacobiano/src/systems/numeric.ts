/**
 * Utilidades numéricas para VERIFICAR las respuestas de los generadores.
 *
 * Nada aquí usa la fórmula cerrada del problema: todo se calcula por
 * cuadratura (Gauss-Legendre) sobre la región original en cartesianas
 * o por diferencias finitas sobre la transformación.
 * No se usa eval() ni nada del DOM: es código puro para Node y navegador.
 */

/** Nodos y pesos de la regla de Gauss-Legendre de orden n en [-1, 1]. */
export function gaussLegendre(n: number): { x: number[]; w: number[] } {
  const x = new Array<number>(n).fill(0);
  const w = new Array<number>(n).fill(0);
  const m = (n + 1) >> 1;
  for (let i = 0; i < m; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let pp = 0;
    for (let it = 0; it < 100; it++) {
      let p1 = 1;
      let p2 = 0;
      for (let j = 0; j < n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1);
      }
      pp = (n * (z * p1 - p2)) / (z * z - 1);
      const z1 = z;
      z = z1 - p1 / pp;
      if (Math.abs(z - z1) < 1e-15) break;
    }
    x[i] = -z;
    x[n - 1 - i] = z;
    w[i] = 2 / ((1 - z * z) * pp * pp);
    w[n - 1 - i] = w[i];
  }
  return { x, w };
}

const glCache = new Map<number, { x: number[]; w: number[] }>();
function gl(n: number): { x: number[]; w: number[] } {
  let g = glCache.get(n);
  if (!g) {
    g = gaussLegendre(n);
    glCache.set(n, g);
  }
  return g;
}

/**
 * Integral doble  ∫_{x0}^{x1} ∫_{ylo(x)}^{yhi(x)} f(x,y) dy dx
 * por cuadratura de Gauss-Legendre compuesta (en x) y simple (en y).
 *
 * @param nx panels en x · @param ny nodos de Gauss-Legendre en y
 */
export function integrate2D(
  f: (x: number, y: number) => number,
  x0: number,
  x1: number,
  ylo: (x: number) => number,
  yhi: (x: number) => number,
  nx = 24,
  ny = 16,
): number {
  const gx = gl(8);
  const gy = gl(ny);
  let total = 0;
  const hx = (x1 - x0) / nx;
  for (let i = 0; i < nx; i++) {
    const a = x0 + i * hx;
    const b = a + hx;
    const cx = (a + b) / 2;
    const hx2 = (b - a) / 2;
    let row = 0;
    for (let k = 0; k < gx.x.length; k++) {
      const x = cx + hx2 * gx.x[k];
      const lo = ylo(x);
      const hi = yhi(x);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) continue;
      const cy = (lo + hi) / 2;
      const hy = (hi - lo) / 2;
      let s = 0;
      for (let j = 0; j < gy.x.length; j++) s += gy.w[j] * f(x, cy + hy * gy.x[j]);
      row += gx.w[k] * s * hy;
    }
    total += row * hx2;
  }
  return total;
}

/** Jacobiano numérico por diferencias centrales: ∂(x,y)/∂(u,v) en (u,v). */
export function jacobianNum(
  T: (u: number, v: number) => [number, number],
  u: number,
  v: number,
  h = 1e-5,
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

/**
 * Área de un polígono (vértices en orden) por la fórmula del cordón.
 * Se usa para verificar áreas de imágenes de regiones SIN usar |J|·área.
 */
export function polygonArea(verts: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i];
    const [x2, y2] = verts[(i + 1) % verts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
