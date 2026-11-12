# AGENTS.md — Las Ruinas del Jacobiano

> opencode (y otras herramientas de agentes) leen este archivo automáticamente.
> Léelo completo antes de tocar código.

## Qué es este proyecto
Juego tipo **Zelda top-down con modo historia** para repasar **Cálculo Multivariable**
(integrales dobles, Fubini, regiones tipo I/II, polares, Jacobiano, cambio de variables).
Es un proyecto universitario para puntos extra en el parcial. **No es competitivo**:
sin cronómetro, sin ranking, con guardado automático, pistas y soluciones paso a paso.
Debe poder jugarse en cualquier lado: **web / PWA**, con controles táctiles en celular.

## Historia
El reino de **Cartesia** se deforma porque **El Singular** quiere llevar todo a |J| = 0 (área cero).
El jugador es un aprendiz de cartógrafo que recorre 4 regiones, vence a un guardián en cada una
(jefe con fases, cada fase = un problema) y recupera 3 herramientas. Al final enfrenta a El Singular.

## Stack
- **Vite + TypeScript (strict)** · **Phaser 3** (arcade physics) · **KaTeX** (LaTeX en modales)
- **vite-plugin-pwa** (instalable y offline) · despliegue estático en **Vercel**
- Sin assets externos: las texturas se generan por código en `BootScene.ts`.
- Guardado en `localStorage` (clave `ruinas-del-jacobiano-save-v1`).

## Comandos
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build  (DEBE pasar siempre)
npm run preview
```

## Mapa de archivos
```
src/
  main.ts                 arranque de Phaser + UI táctil
  config.ts               constantes (tamaño, TILE, velocidad, clave de guardado)
  style.css               modales, HUD, joystick
  data/
    types.ts              ZoneId, ItemId
    zones.ts              TODAS las zonas: mapas ASCII, runas, NPCs, portales, enemigos, jefes, recompensas
  scenes/
    BootScene.ts          genera texturas por código → Menu
    MenuScene.ts          menú (continuar / nueva / diario)
    WorldScene.ts         escena genérica de zona: movimiento, combate, runas, jefe, portales, HUD, lente
  systems/
    questions.ts          motor de preguntas (generadores aleatorios + pistas + solución en LaTeX)
    mathParse.ts          parser seguro de respuestas ("7/2", "2pi", "e^2"); checkAnswer con tolerancia
    SaveSystem.ts         guardado (objeto Save)
    Controls.ts           teclado + joystick/botones táctiles (Controls.dir, Controls.consume)
    Dialog.ts             caja de diálogo
  ui/
    QuestionModal.ts      modal DOM de preguntas (KaTeX, pistas, intentos)
    Journal.ts            diario de fórmulas
```

## Reglas de arquitectura (respétalas)
1. **Contenido = datos.** Zonas, runas, NPCs, jefes y textos viven en `data/zones.ts`. No metas lógica de zona en `WorldScene`.
2. **Las escenas no leen teclas de Phaser.** Usan `Controls.dir` y `Controls.consume('interact'|'attack'|...)`.
3. **Los modales son DOM** (`QuestionModal`, `Journal`) y deben llamar `Controls.setEnabled(false)` al abrir y `true` al cerrar.
4. **Todo problema** sale de `generateQuestion(topic, difficulty)` y trae: `statementTex`, `answer`, `tolerance`, `hints[]`, `solutionTex[]`.
5. **Las respuestas se validan numéricamente** con `parseAnswer` + `checkAnswer` (nada de `eval`).
6. Progreso persistente **solo** vía `Save.data` + `Save.save()`.
7. TypeScript estricto: `npm run build` debe pasar antes de dar algo por terminado.
8. Texto del juego en **español**. Tono amigable, nada punitivo.

## Cómo agregar cosas
- **Nuevo tipo de problema:** escribe `function miTema(d: Difficulty): Question` en `questions.ts`, añade el `Topic` y regístralo en `GENERATORS` y `TOPIC_LABEL`. Verifica la respuesta con una integración numérica.
- **Nueva mazmorra:** agrega un `ZoneId` en `data/types.ts`, una entrada en `ZONES`, un portal en el hub (`cartesia.exits`).
- **Nuevo ítem:** `ItemId` en `types.ts`, entrada en `ITEMS` (zones.ts), efecto en `WorldScene` (como `fubini` en `attack()` o `polar` en `update()`).

## Estado actual (v0.1)
Hecho: menú, hub + 4 mazmorras jugables, 5 temas de preguntas × 3 dificultades, runas, puerta que se abre al resolverlas,
jefes por fases (último con 5 fases), combate básico con slimes, 3 ítems con efecto, lente (grid deformado),
diario de fórmulas, guardado automático, PWA, controles táctiles.

**Verificación matemática:** `scripts/verifyMath.ts` verifica numéricamente (cuadratura 2D y diferencias finitas para el Jacobiano)
todas las respuestas generadas. Resultado: 900/900 OK (100 %) en 5 temas × 3 dificultades × 60 muestras.
Comando: `npm run verify:math`.

## Roadmap sugerido (en este orden)
1. **Probar y pulir** en celular real (tamaños de botones, escala, rendimiento).
2. **Pixel art real** (Kenney.nl / itch.io, licencias libres) en vez de texturas generadas; animación de caminar.
3. **Puzzles de mazmorra con mecánica matemática**: "plantea los límites" arrastrando `g₁(x)`, `g₂(x)`; sala del Jacobiano donde el piso se deforma según |J|.
4. **Música y sonidos** (libres de derechos).
5. **Más preguntas**: integrales triples básicas, integrales sobre regiones con dos fronteras, áreas y volúmenes.
6. **Mapas en Tiled** (JSON) si los mapas ASCII se quedan cortos.
7. **Guardado en la nube** con Supabase (opcional).
8. ✅ **Pruebas**: script que genera 1000 preguntas por tema/dificultad y verifica cada respuesta con integración numérica (`scripts/verifyMath.ts`, `npm run verify:math`).
9. Tutorial del primer minuto más claro; accesibilidad (tamaño de fuente, daltonismo).

## Cosas a NO hacer
- No reescribir el proyecto desde cero ni cambiar de motor sin motivo.
- No agregar ranking, tiempos o competencia.
- No romper el guardado: si cambias la forma de `SaveData`, mantén compatibilidad con los defaults de `SaveSystem`.
- No dejar preguntas cuya respuesta no esté verificada matemáticamente.
