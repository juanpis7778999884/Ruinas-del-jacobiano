/**
 * Pruebas del parser de respuestas y de la tolerancia de checkAnswer.
 * Falla (exit 1) si algún caso no coincide.
 */
import { checkAnswer, parseAnswer } from '../src/systems/mathParse';

interface ParseCase {
  input: string;
  expected: number | null;
  note: string;
}

const PARSE_CASES: ParseCase[] = [
  { input: '7/2', expected: 3.5, note: 'fracción' },
  { input: '3,5', expected: 3.5, note: 'coma decimal' },
  { input: '3.5', expected: 3.5, note: 'punto decimal' },
  { input: '2pi', expected: 2 * Math.PI, note: 'multiplicación implícita' },
  { input: 'pi/4', expected: Math.PI / 4, note: 'π' },
  { input: 'π²', expected: Math.PI ** 2, note: 'superíndice ²' },
  { input: 'e²', expected: Math.E ** 2, note: 'superíndice ²' },
  { input: 'e^-2', expected: Math.E ** -2, note: 'exponente negativo' },
  { input: 'sqrt2', expected: Math.SQRT2, note: 'sqrt sin paréntesis' },
  { input: 'sqrt 2', expected: Math.SQRT2, note: 'sqrt con espacio' },
  { input: '√2', expected: Math.SQRT2, note: 'raíz cuadrada' },
  { input: 'sqrt(2)', expected: Math.SQRT2, note: 'sqrt con paréntesis' },
  { input: '(e^4-1)/2', expected: (Math.E ** 4 - 1) / 2, note: 'expresión exacta' },
  { input: 'pi(1-e^-1)', expected: Math.PI * (1 - Math.E ** -1), note: 'pi por paréntesis' },
  { input: '1/(2pi)', expected: 1 / (2 * Math.PI), note: 'cociente' },
  { input: 'abs(-3)', expected: 3, note: 'valor absoluto' },
  { input: 'tan(0.5)', expected: Math.tan(0.5), note: 'tangente' },
  { input: 'atan(1)', expected: Math.atan(1), note: 'arcotangente' },
  { input: '-3', expected: -3, note: 'negativo' },
  { input: '1/0', expected: null, note: 'división por cero' },
  { input: 'texto basura', expected: null, note: 'basura' },
  { input: '', expected: null, note: 'vacío' },
];

interface TolCase {
  expected: number;
  input: string;
  shouldPass: boolean;
  note: string;
}

const TOL_CASES: TolCase[] = [
  { expected: 0.859, input: '0.86', shouldPass: true, note: 'redondeo a 2 decimales pasa' },
  { expected: 0.859, input: '0.87', shouldPass: false, note: 'redondeo mal hecho NO pasa' },
  { expected: (Math.E - 1) / 2, input: '(e-1)/2', shouldPass: true, note: 'expresión exacta pasa' },
  { expected: Math.PI, input: 'pi', shouldPass: true, note: 'pi exacto pasa' },
  { expected: 1 / 3, input: '0.3333', shouldPass: true, note: '4 decimales pasa' },
  { expected: 1 / 3, input: '0.34', shouldPass: false, note: '2 decimales de 1/3 NO pasa' },
  { expected: 16, input: '16.005', shouldPass: true, note: 'jacobiano entero con tol 0.01' },
];

let fails = 0;

console.log('── Parser ─────────────────────────────────────────────');
for (const c of PARSE_CASES) {
  const got = parseAnswer(c.input);
  const ok =
    c.expected === null
      ? got === null
      : got !== null && Math.abs(got - c.expected) <= 1e-9 * Math.max(1, Math.abs(c.expected));
  if (!ok) fails++;
  const shown = c.expected === null ? 'null' : String(c.expected);
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(c.input).padEnd(16)} → ${String(got).padEnd(22)} (esperado ${shown})  ${c.note}`);
}

console.log('\n── Tolerancia (checkAnswer) ───────────────────────────');
for (const c of TOL_CASES) {
  const got = parseAnswer(c.input);
  const ok = got !== null && checkAnswer(c.expected, got) === c.shouldPass;
  if (!ok) fails++;
  const real = got === null ? 'null' : String(checkAnswer(c.expected, got));
  console.log(
    `${ok ? '✓' : '✗'} esperado ${String(c.expected).padEnd(20)} entrada ${JSON.stringify(c.input).padEnd(14)} → ${real.padEnd(6)} (se esperaba ${c.shouldPass})  ${c.note}`,
  );
}

const total = PARSE_CASES.length + TOL_CASES.length;
console.log(`\n${total - fails}/${total} casos OK`);
if (fails > 0) {
  console.log(`❌ ${fails} caso(s) fallaron.`);
  process.exit(1);
}
console.log('✅ Todas las pruebas pasaron.');
