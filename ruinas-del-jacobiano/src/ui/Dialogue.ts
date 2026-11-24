/** Diálogo ramificado con retratos, texto progresivo y opciones. */
import { StoryNode, StoryTree } from '../data/story';
import { Audio } from '../systems/Audio';
import { Controls } from '../systems/Controls';
import { Save } from '../systems/SaveSystem';

const PALETTES: Record<StoryTree['portrait'], { bg: string; robe: string; skin: string; hair: string; mark: string }> = {
  old: { bg: '#3b3155', robe: '#6b4b7a', skin: '#e8bd91', hair: '#d8d8e0', mark: '#ffd166' },
  sage: { bg: '#24445c', robe: '#2b6fd6', skin: '#f0c99e', hair: '#7a4a2b', mark: '#8ecae6' },
  guard: { bg: '#1d4b45', robe: '#277b6a', skin: '#d9a779', hair: '#303040', mark: '#8dffd8' },
  cartographer: { bg: '#3b2c58', robe: '#6b3fa0', skin: '#f2c7a5', hair: '#262238', mark: '#e0aaff' },
  wanderer: { bg: '#4a3a2c', robe: '#8b5a2b', skin: '#e4b98e', hair: '#4a2f1c', mark: '#ffd166' },
  collector: { bg: '#2c3a52', robe: '#465c86', skin: '#e8c5a0', hair: '#5b4430', mark: '#9dffd6' },
};

function portraitSvg(kind: StoryTree['portrait']): string {
  const p = PALETTES[kind];
  const hood = kind === 'guard' ? `<path d="M12 58 Q50 4 88 58 Z" fill="${p.robe}"/>` : '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="bg"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="#121326"/></radialGradient></defs>
    <rect width="100" height="100" rx="10" fill="url(#bg)"/>
    <path d="M8 100 Q16 68 50 68 Q84 68 92 100 Z" fill="${p.robe}"/>
    ${hood}
    <ellipse cx="50" cy="47" rx="22" ry="26" fill="${p.skin}"/>
    <path d="M27 38 Q30 14 50 16 Q70 14 73 38 Q66 28 50 28 Q34 28 27 38 Z" fill="${p.hair}"/>
    ${kind === 'old' ? `<path d="M32 56 Q50 70 68 56 Q64 76 50 78 Q36 76 32 56 Z" fill="#e6e6ef" opacity="0.85"/>` : ''}
    <circle cx="42" cy="47" r="2.6" fill="#1d1d2d"/><circle cx="58" cy="47" r="2.6" fill="#1d1d2d"/>
    <path d="M44 59 Q50 63 56 59" stroke="#8a5a4a" stroke-width="2" fill="none"/>
    <circle cx="50" cy="85" r="6" fill="${p.mark}" opacity="0.9"/>
  </svg>`;
}

interface DialogOptions {
  speaker: string;
  portrait: StoryTree['portrait'];
  onOption?: (opt: import('../data/story').StoryOption) => void;
}

let activeOverlay: HTMLElement | null = null;

export function isDialogueOpen(): boolean {
  return activeOverlay !== null;
}

function closeActive() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  Controls.setEnabled(true);
}

export function showLines(lines: string[], speaker: string, portrait: StoryTree['portrait'] = 'old'): Promise<void> {
  const nodes: Record<string, StoryNode> = {};
  lines.forEach((text, i) => {
    nodes[`n${i}`] = { text, options: [{ text: i === lines.length - 1 ? 'Cerrar' : 'Continuar', next: i === lines.length - 1 ? undefined : `n${i + 1}` }] };
  });
  return showStory({ start: 'n0', speaker, portrait, nodes });
}

/** Muestra un árbol de conversación y resuelve cuando se elige una opción terminal. */
export function showStory(tree: StoryTree, opts: Partial<DialogOptions> = {}): Promise<void> {
  return new Promise<void>((resolve) => {
    closeActive();
    Controls.setEnabled(false);
    const root = document.getElementById('modal-root');
    if (!root) { Controls.setEnabled(true); resolve(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'dialogue-overlay';
    overlay.innerHTML = `
      <div class="dialogue-card" role="dialog" aria-modal="true">
        <div class="dialogue-portrait">${portraitSvg(opts.portrait ?? tree.portrait)}</div>
        <div class="dialogue-main">
          <div class="dialogue-speaker"></div>
          <div class="dialogue-text" aria-live="polite"></div>
          <div class="dialogue-options" role="group"></div>
          <div class="dialogue-hint">Enter / Espacio: seguir · 1–9: elegir · clic: elegir</div>
        </div>
      </div>`;
    root.appendChild(overlay);
    activeOverlay = overlay;

    overlay.querySelector<HTMLElement>('.dialogue-speaker')!.textContent = opts.speaker ?? tree.speaker;
    const textEl = overlay.querySelector<HTMLElement>('.dialogue-text')!;
    const optionsEl = overlay.querySelector<HTMLElement>('.dialogue-options')!;
    const hintEl = overlay.querySelector<HTMLElement>('.dialogue-hint')!;
    let finished = false;
    let typing: number | null = null;
    let currentOptions: import('../data/story').StoryOption[] = [];
    let fullText = '';

    const finish = () => {
      if (finished) return;
      finished = true;
      if (typing !== null) window.clearInterval(typing);
      window.removeEventListener('keydown', onKey, true);
      closeActive();
      resolve();
    };

    const renderOptions = (node: StoryNode) => {
      currentOptions = node.options.filter((o) => !o.showIf || o.showIf(Save.data));
      optionsEl.innerHTML = '';
      currentOptions.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'dialogue-option';
        b.innerHTML = `<span class="option-key">${i + 1}</span><span></span>`;
        b.querySelector('span:last-child')!.textContent = opt.text;
        b.addEventListener('click', () => choose(opt));
        optionsEl.appendChild(b);
      });
      hintEl.style.display = currentOptions.length ? '' : 'none';
    };

    const typeText = (text: string) => {
      if (typing !== null) window.clearInterval(typing);
      fullText = text;
      if (!Save.data.settings.typewriter) { textEl.textContent = text; return; }
      textEl.textContent = '';
      let i = 0;
      typing = window.setInterval(() => {
        i += 2;
        textEl.textContent = fullText.slice(0, i);
        if (i >= fullText.length && typing !== null) {
          window.clearInterval(typing);
          typing = null;
        }
      }, 18);
    };

    const go = (id: string | undefined) => {
      if (!id) { finish(); return; }
      const node = tree.nodes[id];
      if (!node) { finish(); return; }
      typeText(node.text);
      renderOptions(node);
    };

    const choose = (opt: import('../data/story').StoryOption) => {
      if (finished) return;
      Audio.play('ui');
      opts.onOption?.(opt);
      if (opt.flag) Save.setFlag(opt.flag);
      if (opt.quest) {
        Save.data.quests[opt.quest.id].progress = Math.max(Save.data.quests[opt.quest.id].progress, opt.quest.progress);
        Save.save();
      }
      if (opt.give) Save.addItem(opt.give);
      if (opt.event) window.dispatchEvent(new CustomEvent('story-event', { detail: opt.event }));
      if (opt.next) go(opt.next);
      else finish();
    };

    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (['Enter', 'Space', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (typing !== null && ['Enter', 'Space', 'KeyE'].includes(e.code)) {
        window.clearInterval(typing);
        typing = null;
        textEl.textContent = fullText;
        return;
      }
      const n = /^Digit([1-9])$/.exec(e.code);
      if (n && currentOptions[Number(n[1]) - 1]) {
        choose(currentOptions[Number(n[1]) - 1]);
        return;
      }
      if (e.code === 'Enter' && currentOptions.length === 1) choose(currentOptions[0]);
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.dialogue-card') === null) finish();
    });
    go(tree.start);
  });
}
