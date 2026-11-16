/**
 * Verificación matemática: cada generador se verifica a sí mismo.
 *
 * Para cada tema × dificultad se generan 1000 preguntas y se compara la
 * respuesta del generador (`q.answer`) con la verificación numérica
 * independiente que trae el propio generador (`q.verify()`), usando
 * `checkAnswer`. Además se comprueba que la última línea de la solución
 * muestre la respuesta ya formateada.
 *
 * Falla (exit 1) si alguna respuesta no cuadra, si a un generador le falta
 * `verify` o si la solución no contiene la respuesta.
 */
import { generateQuestion, fmt } from '../src/systems/questions';
import type { Topic, Difficulty } from '../src/systems/questions';
import { checkAnswer } from '../src/systems/mathParse';

const TOPICS: Topic[] = ['rect', 'general', 'polar', 'jacobian', 'change'];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];
const SAMPLES = 1000;

interface Detail {
  reason: string;
  expected: number;
  got: number;
  statement: string;
}

interface Combo {
  topic: Topic;
  difficulty: Difficulty;
  passed: number;
  failed: number;
  solOk: number;
  solBad: number;
  maxRelErr: number;
  details: Detail[];
}

const results: Combo[] = [];

for (const topic of TOPICS) {
  for (const d of DIFFICULTIES) {
    const res: Combo = {
      topic,
      difficulty: d,
      passed: 0,
      failed: 0,
      solOk: 0,
      solBad: 0,
      maxRelErr: 0,
      details: [],
    };
    for (let i = 0; i < SAMPLES; i++) {
      const q = generateQuestion(topic, d);

      // 1) la solución debe mostrar la respuesta formateada
      const lastLine = q.solutionTex[q.solutionTex.length - 1] ?? '';
      if (lastLine.includes(fmt(q.answer))) res.solOk++;
      else {
        res.solBad++;
        if (res.details.length < 3) {
          res.details.push({
            reason: 'la solución no muestra la respuesta',
            expected: q.answer,
            got: NaN,
            statement: q.solutionTex[q.solutionTex.length - 1] ?? '',
          });
        }
      }

      // 2) verificación numérica independiente
      if (!q.verify) {
        res.failed++;
        if (res.details.length < 3) {
          res.details.push({
            reason: 'el generador no trae verify()',
            expected: NaN,
            got: q.answer,
            statement: q.statementTex,
          });
        }
        continue;
      }
      const expected = q.verify();
      if (!Number.isFinite(expected)) {
        res.failed++;
        if (res.details.length < 3) {
          res.details.push({
            reason: 'verify() devolvió un valor no finito',
            expected: NaN,
            got: q.answer,
            statement: q.statementTex,
          });
        }
        continue;
      }
      const rel = Math.abs(expected - q.answer) / Math.max(1e-12, Math.abs(q.answer));
      if (rel > res.maxRelErr) res.maxRelErr = rel;
      if (checkAnswer(q.answer, expected, q.tolerance)) res.passed++;
      else {
        res.failed++;
        if (res.details.length < 3) {
          res.details.push({
            reason: 'la respuesta no cuadra con la verificación numérica',
            expected,
            got: q.answer,
            statement: q.statementTex,
          });
        }
      }
    }
    results.push(res);
  }
}

let totalOk = 0;
let totalBad = 0;
let totalSolOk = 0;
let totalSolBad = 0;
for (const r of results) {
  totalOk += r.passed;
  totalBad += r.failed;
  totalSolOk += r.solOk;
  totalSolBad += r.solBad;
  const pct = ((r.passed / SAMPLES) * 100).toFixed(1);
  console.log(
    `${r.topic.padEnd(9)} d${r.difficulty}: ${r.passed}/${SAMPLES} OK (${pct}%) · ` +
      `solución ${r.solOk}/${SAMPLES} · error rel. máx ${r.maxRelErr.toExponential(2)}`,
  );
  for (const det of r.details) {
    console.log(`  FALLO [${det.reason}] esperado=${det.expected} obtenido=${det.got} :: ${det.statement}`);
  }
}

const total = SAMPLES * TOPICS.length * DIFFICULTIES.length;
console.log(`\nTOTAL: ${totalOk} OK / ${totalBad} FALLOS de ${total}`);
console.log(`SOLUCIÓN: ${totalSolOk} con respuesta visible / ${totalSolBad} incompletas`);
if (totalBad > 0 || totalSolBad > 0) {
  console.log('\n❌ Verificación fallida.');
  process.exit(1);
}
console.log('\n✅ Verificación numérica completa.');
