/**
 * Chequeo de LaTeX: todo el LaTeX que ve el jugador debe renderizar.
 *
 * Para cada tema × dificultad genera 1000 preguntas y renderiza con KaTeX
 * (throwOnError) el enunciado y cada línea de la solución. Los hints son
 * texto plano: no se renderizan.
 * Falla (exit 1) si algo no renderiza, si el enunciado tiene llaves
 * desbalanceadas o si aparece NaN / undefined / Infinity.
 */
import katex from 'katex';
import { generateQuestion } from '../src/systems/questions';
import type { Topic, Difficulty } from '../src/systems/questions';

const TOPICS: Topic[] = ['rect', 'general', 'polar', 'jacobian', 'change'];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];
const SAMPLES = 1000;
const MAX_REPORTED = 3;

interface Problem {
  topic: Topic;
  difficulty: Difficulty;
  kind: 'enunciado' | 'solución';
  latex: string;
  reason: string;
}

const problems: Problem[] = [];
const rendered = { enunciados: 0, lineas: 0 };

/** Llaves {} balanceadas (ignora \{ y \} escapados). */
function bracesBalanced(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

const BAD_TOKENS = ['NaN', 'undefined', 'Infinity'];

function checkString(src: string, topic: Topic, difficulty: Difficulty, kind: Problem['kind']): void {
  for (const bad of BAD_TOKENS) {
    if (src.includes(bad)) {
      problems.push({ topic, difficulty, kind, latex: src, reason: `contiene "${bad}"` });
      return;
    }
  }
  if (kind === 'enunciado' && !bracesBalanced(src)) {
    problems.push({ topic, difficulty, kind, latex: src, reason: 'llaves desbalanceadas' });
    return;
  }
  try {
    katex.renderToString(src, { throwOnError: true, displayMode: true });
    if (kind === 'enunciado') rendered.enunciados++;
    else rendered.lineas++;
  } catch (e) {
    problems.push({
      topic,
      difficulty,
      kind,
      latex: src,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
}

for (const topic of TOPICS) {
  for (const d of DIFFICULTIES) {
    for (let i = 0; i < SAMPLES; i++) {
      const q = generateQuestion(topic, d);
      checkString(q.statementTex, topic, d, 'enunciado');
      for (const line of q.solutionTex) checkString(line, topic, d, 'solución');
    }
  }
}

console.log(
  `Renderizados con KaTeX: ${rendered.enunciados} enunciados y ${rendered.lineas} líneas de solución.`,
);
if (problems.length === 0) {
  console.log('✅ Todo el LaTeX renderiza bien.');
} else {
  console.log(`\n❌ ${problems.length} problema(s) de LaTeX. Primeros ${Math.min(MAX_REPORTED, problems.length)}:`);
  for (const p of problems.slice(0, MAX_REPORTED)) {
    console.log(`\n  ${p.topic} d${p.difficulty} · ${p.kind}`);
    console.log(`  razón: ${p.reason}`);
    console.log(`  LaTeX: ${p.latex}`);
  }
  process.exit(1);
}
