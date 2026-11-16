# Las Ruinas del Jacobiano

Aventura estilo Zelda (top-down, modo historia) para repasar integrales dobles, Fubini,
regiones tipo I/II, coordenadas polares, Jacobiano y cambio de variables.
Corre en el navegador y se instala como PWA (funciona offline y en celular).

## Correr en local
```bash
npm install
npm run dev
```
Abre http://localhost:5173

## Controles
| Acción | Teclado | Celular |
|---|---|---|
| Mover | WASD / flechas | Joystick izquierdo |
| Interactuar / avanzar diálogo | E, Enter | Botón A |
| Atacar | Espacio, K | Botón B |
| Diario de fórmulas | J | Botón 📖 |
| Lente del Jacobiano | Q | Botón 🔍 |
| Menú | Esc | Botón ☰ Menú |

## Desplegar en Vercel
1. Sube el proyecto a GitHub.
2. En vercel.com → *Add New Project* → importa el repo.
3. Framework: **Vite** (lo detecta solo). Build: `npm run build`. Output: `dist`.
4. Deploy. Comparte el link: en el celular se puede "Agregar a pantalla de inicio".

## Usarlo con opencode
Abre la carpeta en opencode: lee `AGENTS.md` automáticamente. Si cambias de IA, usa `PROMPT_UNIVERSAL.md`.
