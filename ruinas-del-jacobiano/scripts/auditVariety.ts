/**
 * Auditoría de variedad: ¿cuántos enunciados distintos genera cada tema?
 *
 * Para cada tema × dificultad genera 3000 preguntas y cuenta cuántos
 * statementTex son únicos. Además revisa que no se repita un enunciado
 * dentro de una ventana de las últimas 5 (repetición inmediata).
 * Falla (exit 1) si alguna combinación tiene menos de 25 enunciados únicos.
 */
import { generateQuestion } from '../src/systems/questions';
import type { Topic, Difficulty } from '../src/systems/questions';

const TOPICS: Topic[] = ['rect', 'general', 'polar', 'jacobian', 'change'];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];
const SAMPLES = 3000;
const MIN_UNIQUE = 25;
const WINDOW = 5;

const uniq: Record<Topic, number[]> = {
  rect: [],
  general: [],
  polar: [],
  jacobian: [],
  change: [],
};
const repeats: Record<Topic, number[]> = {
  rect: [],
  general: [],
  polar: [],
  jacobian: [],
  change: [],
};

for (const topic of TOPICS) {
  for (const d of DIFFICULTIES) {
    const seen = new Set<string>();
    const window: string[] = [];
    let repeatsInWindow = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const q = generateQuestion(topic, d);
      seen.add(q.statementTex);
      if (window.length >= WINDOW && window.includes(q.statementTex)) repeatsInWindow++;
      window.push(q.statementTex);
      if (window.length > WINDOW) window.shift();
    }
    uniq[topic].push(seen.size);
    repeats[topic].push(repeatsInWindow);
  }
}

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`Muestras por combinación: ${SAMPLES} · mínimo exigido: ${MIN_UNIQUE} únicas\n`);
console.log(`${pad('tema', 10)}${pad('d1', 8)}${pad('d2', 8)}${pad('d3', 8)}`);
console.log('-'.repeat(34));
let fails = 0;
for (const topic of TOPICS) {
  const cells = uniq[topic].map((n) => {
    if (n < MIN_UNIQUE) fails++;
    return pad(String(n), 8);
  });
  console.log(`${pad(topic, 10)}${cells.join('')}`);
}
console.log('-'.repeat(34));

console.log('\nRepeticiones dentro de una ventana de 5 (0 = ideal):');
for (const topic of TOPICS) {
  console.log(`${pad(topic, 10)}${repeats[topic].map((n) => pad(String(n), 8)).join('')}`);
}

const worst = Math.min(...TOPICS.flatMap((t) => uniq[t]));
if (fails > 0) {
  console.log(`\n❌ ${fails} combinación(es) con menos de ${MIN_UNIQUE} enunciados únicos (mínimo actual: ${worst}).`);
  process.exit(1);
}
console.log(`\n✅ Todas las combinaciones tienen al menos ${MIN_UNIQUE} enunciados únicos (mínimo: ${worst}).`);
