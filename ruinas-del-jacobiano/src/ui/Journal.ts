import { Controls } from '../systems/Controls';
import { renderTex } from './QuestionModal';

interface Section {
  title: string;
  formulas: string[];
  note: string;
}

const tex = String.raw;

const SECTIONS: Section[] = [
  {
    title: '1 · Fubini sobre rectángulos',
    formulas: [
      tex`\iint_R f\,dA=\int_a^b\!\!\int_c^d f(x,y)\,dy\,dx=\int_c^d\!\!\int_a^b f(x,y)\,dx\,dy`,
      tex`\text{Si }f(x,y)=g(x)h(y):\quad \iint_R f\,dA=\left(\int_a^b g\right)\left(\int_c^d h\right)`,
    ],
    note: 'Integra de adentro hacia afuera. La variable de afuera se trata como constante en la integral interna.',
  },
  {
    title: '2 · Regiones tipo I y tipo II',
    formulas: [
      tex`\text{Tipo I: }D=\{a\le x\le b,\ g_1(x)\le y\le g_2(x)\}\Rightarrow \int_a^b\!\!\int_{g_1(x)}^{g_2(x)}f\,dy\,dx`,
      tex`\text{Tipo II: }D=\{c\le y\le d,\ h_1(y)\le x\le h_2(y)\}\Rightarrow \int_c^d\!\!\int_{h_1(y)}^{h_2(y)}f\,dx\,dy`,
    ],
    note: 'Dibuja SIEMPRE la región. Si una integral no tiene antiderivada elemental (como e^{y²}), prueba cambiar el orden.',
  },
  {
    title: '3 · Coordenadas polares',
    formulas: [
      tex`x=r\cos\theta,\quad y=r\sin\theta,\quad x^2+y^2=r^2`,
      tex`\iint_D f(x,y)\,dA=\iint_{D'} f(r\cos\theta,r\sin\theta)\;\mathbf{r}\,dr\,d\theta`,
      tex`\text{Disco de radio }R:\ 0\le r\le R,\ 0\le\theta\le 2\pi`,
    ],
    note: 'El factor r extra es el Jacobiano de la transformación a polares. ¡El que se olvida pierde puntos!',
  },
  {
    title: '4 · Jacobiano (2×2)',
    formulas: [
      tex`\frac{\partial(x,y)}{\partial(u,v)}=\begin{vmatrix}x_u&x_v\\y_u&y_v\end{vmatrix}=x_u y_v-x_v y_u`,
    ],
    note: '|J| mide cuánto se estira o se encoge el área al aplicar la transformación. Si J = 0, el área colapsa (¡el villano del juego!).',
  },
  {
    title: '5 · Cambio de variables',
    formulas: [
      tex`\iint_D f(x,y)\,dA=\iint_R f\big(x(u,v),y(u,v)\big)\left|\frac{\partial(x,y)}{\partial(u,v)}\right|du\,dv`,
      tex`\text{Área}(T(R))=\iint_R |J|\,du\,dv`,
    ],
    note: 'Pasos: (1) elige u, v que simplifiquen la región o el integrando; (2) despeja x, y; (3) calcula |J|; (4) transforma los límites; (5) integra.',
  },
];

export function openJournal(): Promise<void> {
  return new Promise<void>((resolve) => {
    Controls.setEnabled(false);
    const root = document.getElementById('modal-root')!;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const card = document.createElement('div');
    card.className = 'card journal';
    card.innerHTML = `<div class="card-head"><span class="tag">Diario del cartógrafo</span><h2>Fórmulas esenciales</h2></div>`;
    overlay.appendChild(card);

    SECTIONS.forEach((s) => {
      const sec = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = s.title;
      sec.appendChild(h);
      s.formulas.forEach((f) => {
        const d = document.createElement('div');
        d.className = 'formula';
        sec.appendChild(d);
        renderTex(d, f);
      });
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = s.note;
      sec.appendChild(p);
      card.appendChild(sec);
    });

    const foot = document.createElement('div');
    foot.className = 'card-foot';
    const close = document.createElement('button');
    close.className = 'primary';
    close.textContent = 'Cerrar diario';
    foot.appendChild(close);
    card.appendChild(foot);
    root.appendChild(overlay);

    const finish = () => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      Controls.setEnabled(true);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') {
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', onKey, true);
    close.addEventListener('click', finish);
    close.focus();
  });
}
