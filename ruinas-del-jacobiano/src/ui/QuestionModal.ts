import katex from 'katex';
import { Controls } from '../systems/Controls';
import { Question, TOPIC_LABEL, fmt } from '../systems/questions';
import { checkAnswer, parseAnswer } from '../systems/mathParse';

export interface AskOptions {
  heading: string;
  maxAttempts: number;
  freeHint?: boolean;
  allowClose?: boolean;
}

export interface AskResult {
  correct: boolean;
  canceled: boolean;
  attempts: number;
  hintsUsed: number;
}

export function renderTex(el: HTMLElement, src: string, display = true) {
  try {
    katex.render(src, el, { displayMode: display, throwOnError: false });
  } catch {
    el.textContent = src;
  }
}

/** Muestra un problema en un modal DOM (con KaTeX) y devuelve el resultado. */
export function askQuestion(q: Question, opts: AskOptions): Promise<AskResult> {
  return new Promise<AskResult>((resolve) => {
    Controls.setEnabled(false);
    const root = document.getElementById('modal-root')!;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="card" role="dialog" aria-modal="true">
        <div class="card-head">
          <span class="tag"></span>
          <h2></h2>
        </div>
        <div class="statement"></div>
        <div class="answer-row">
          <input type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                 placeholder="Tu respuesta (ej: 7/2, 3.5, 2pi, e^2)" />
          <button class="primary" data-role="submit">Responder</button>
        </div>
        <div class="feedback" aria-live="polite"></div>
        <div class="hints"></div>
        <div class="solution"></div>
        <div class="card-foot">
          <button data-role="hint">💡 Pista</button>
          <button data-role="close">Salir</button>
        </div>
      </div>`;
    root.appendChild(overlay);

    const $ = <T extends HTMLElement>(sel: string) => overlay.querySelector<T>(sel)!;
    $('.tag').textContent = TOPIC_LABEL[q.topic];
    $('h2').textContent = opts.heading;
    renderTex($('.statement'), q.statementTex);

    const input = $<HTMLInputElement>('input');
    const feedback = $('.feedback');
    const hintsBox = $('.hints');
    const solution = $('.solution');
    const submitBtn = $<HTMLButtonElement>('[data-role="submit"]');
    const hintBtn = $<HTMLButtonElement>('[data-role="hint"]');
    const closeBtn = $<HTMLButtonElement>('[data-role="close"]');
    if (opts.allowClose === false) closeBtn.style.display = 'none';

    let attempts = 0;
    let hintsUsed = 0;
    let finished = false;
    let correct = false;

    const finish = (canceled: boolean) => {
      window.removeEventListener('keydown', onEsc, true);
      overlay.remove();
      Controls.setEnabled(true);
      resolve({ correct, canceled, attempts, hintsUsed });
    };

    const showHint = () => {
      if (hintsUsed >= q.hints.length) {
        feedback.textContent = 'Ya no hay más pistas. ¡Tú puedes!';
        feedback.className = 'feedback';
        return;
      }
      const div = document.createElement('div');
      div.className = 'hint';
      div.textContent = `💡 ${q.hints[hintsUsed]}`;
      hintsBox.appendChild(div);
      hintsUsed++;
    };

    const showSolution = () => {
      solution.innerHTML = '<h3>Solución paso a paso</h3>';
      q.solutionTex.forEach((line) => {
        const d = document.createElement('div');
        d.className = 'step';
        solution.appendChild(d);
        renderTex(d, line);
      });
      const ans = document.createElement('div');
      ans.className = 'final';
      ans.textContent = `Respuesta: ${fmt(q.answer)}`;
      solution.appendChild(ans);
    };

    const lockToContinue = () => {
      finished = true;
      input.disabled = true;
      hintBtn.style.display = 'none';
      submitBtn.textContent = 'Continuar';
      closeBtn.style.display = 'none';
      submitBtn.focus();
    };

    const submit = () => {
      if (finished) {
        finish(false);
        return;
      }
      const val = parseAnswer(input.value);
      if (val === null) {
        feedback.textContent = 'No entendí tu respuesta. Usa números, fracciones (7/2) o pi, e, sqrt(2).';
        feedback.className = 'feedback warn';
        return;
      }
      attempts++;
      if (checkAnswer(q.answer, val, q.tolerance)) {
        correct = true;
        feedback.textContent = '✅ ¡Correcto!';
        feedback.className = 'feedback ok';
        showSolution();
        lockToContinue();
        return;
      }
      if (attempts >= opts.maxAttempts) {
        feedback.textContent = '❌ Se acabaron los intentos. Mira la solución y aprende de ella.';
        feedback.className = 'feedback bad';
        showSolution();
        lockToContinue();
        return;
      }
      const left = opts.maxAttempts - attempts;
      feedback.textContent = `❌ Todavía no. Te quedan ${left} intento${left === 1 ? '' : 's'}.`;
      feedback.className = 'feedback bad';
      if (hintsUsed < q.hints.length) showHint();
      input.select();
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.allowClose !== false && !finished) {
        e.stopPropagation();
        finish(true);
      }
    };
    window.addEventListener('keydown', onEsc, true);

    submitBtn.addEventListener('click', submit);
    hintBtn.addEventListener('click', showHint);
    closeBtn.addEventListener('click', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    if (opts.freeHint) showHint();
    setTimeout(() => input.focus(), 50);
  });
}
