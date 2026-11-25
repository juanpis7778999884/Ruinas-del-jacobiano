# Ruinas del Jacobiano

Aventura **3D estilo PlayStation 2** de exploración, acción y cálculo. Recorre cinco regiones de un reino que se deforma, derrota guardianes con fases, descifra runas y recupera las herramientas de los antiguos cartógrafos antes de que El Singular reduzca toda el área a cero.

Incluye:

- Mundo tridimensional real con geometría procedural, texturas generadas por código, cámara perspectiva, niebla, braseros, partículas y sombras.
- Combate con combo ligero, golpe pesado, esquiva, defensa, resistencia, espectáculo de impactos y IA de enemigos.
- Cinco zonas conectadas por portales: Cartesia, Llanura Rectangular, Valle de las Regiones, Ciudad Polar y Templo del Jacobiano.
- Jefes con fases, patrones de ataque distintos y escudo matemático: solo se abre al resolver la pregunta de la fase.
- Runas, cofres, tablas de lore, santuarios, mecanismos de interruptores y puertas selladas.
- Diálogo ramificado con retratos, misiones, inventario, equipo, mapa, diario de fórmulas, guardado y ajustes.
- Música y efectos sintetizados en WebAudio; arte 100 % generado por código, sin recursos externos.
- Modales de preguntas con KaTeX, pistas, solución paso a paso y validación numérica segura.
- PWA instalable, controles táctiles y guardado automático en `localStorage`.

## Ejecutar

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Mover | WASD / flechas | Joystick izquierdo |
| Interactuar / avanzar diálogo | E, Enter | Botón A |
| Atacar | Espacio, K | Botón ⚔ |
| Golpe pesado | H | Botón ✦ |
| Esquivar | Shift | Botón ↷ |
| Defender | G | Botón ◇ |
| Diario de fórmulas | J | Botón ∫ |
| Lente del Jacobiano | Q | Botón ◈ |
| Inventario | I, Tab | Botón 🎒 |
| Mapa | M | Botón 🗺 |
| Misiones | L | Botón 📜 |
| Beber elixir | R | Botón ✚ |
| Pausa / ajustes | Esc | Botón ☰ |

Todas las teclas se pueden reasignar desde **Controles y ayuda** en el menú o en la pausa. Los botones táctiles son independientes y permiten moverse, atacar y usar accesos rápidos al mismo tiempo.

## Progresión

1. Habla con la Anciana en Cartesia y toma el portal de la Llanura.
2. Enciende las tres runas de cada región para abrir el sello del jefe.
3. Resuelve la pregunta de cada fase para romper el escudo y ataca mientras el jefe está aturdido.
4. Recupera la Cuchilla de Fubini, la Brújula Polar y el Lente del Jacobiano.
5. Busca los tres fragmentos de la reliquia y entra al Templo para enfrentar a El Singular.

No hay cronómetro, ranking ni castigos permanentes: equivocarse muestra la solución y permite volver a intentarlo.

## Verificación

```bash
npm run build        # tsc --noEmit + vite build
npm run verify:math  # 15000 respuestas verificadas numéricamente
npm run test:parser  # parser de respuestas
npm run check:latex  # renderizado KaTeX de enunciados y soluciones
npm run audit:variety
```

Estado verificado: `15000/15000` respuestas correctas, más de `32000` líneas de solución LaTeX renderizadas, `29/29` pruebas del parser y build de producción exitoso.

## Despliegue

El proyecto es estático. En Vercel: framework **Vite**, comando `npm run build`, salida `dist`. También puedes servir `dist` con cualquier host estático. El service worker y el manifiesto se generan con `vite-plugin-pwa`.

## Estructura

- `src/iso/`: escena principal, lógica de juego, colisión y texturas de respaldo.
- `src/three/`: renderizador 3D, materiales, esqueletos de personajes, escenarios y efectos.
- `src/data/`: zonas, mapas, objetos, jefes, narrativa y misiones.
- `src/systems/`: guardado, controles, audio y motor matemático.
- `src/ui/`: HUD, diálogo, preguntas, diario y paneles.
- `src/scenes/`: arranque y menú.
