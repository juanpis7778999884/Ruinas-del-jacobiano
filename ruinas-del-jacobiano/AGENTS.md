# AGENTS.md — Ruinas del Jacobiano

Este archivo se lee automáticamente antes de tocar código.

## Qué es

Juego **2.5D isométrico** de exploración, acción y cálculo multivariable. El reino de Cartesia se deforma porque El Singular quiere llevar toda el área a |J| = 0. El jugador recorre cinco regiones, enciende runas, vence jefes con fases y recupera herramientas antes del enfrentamiento final.

Es un proyecto educativo no competitivo: sin cronómetro, sin ranking, con guardado automático, pistas y soluciones paso a paso. Debe funcionar como web/PWA, con controles táctiles en celular.

## Stack

- Vite + TypeScript strict
- Phaser 3
- KaTeX para enunciados y soluciones
- vite-plugin-pwa
- Sin assets externos: todo el arte y el audio se generan por código
- Guardado en `localStorage` (clave `ruinas-del-jacobiano-save-v1`, versión de datos 2 con migración desde 1)

## Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
npm run verify:math
npm run test:parser
npm run check:latex
npm run audit:variety
```

`npm run build` debe pasar siempre.

## Mapa de archivos

```text
src/
  main.ts                 arranque de Phaser + UI táctil
  config.ts               constantes
  iso/
    isoConfig.ts          constantes de proyección y profundidad
    isoMath.ts            proyección 2:1 y utilidades
    isoTextures.ts        arte procedural (suelos, muros, personajes, VFX)
    IsoScene.ts           escena principal: mundo, combate, IA, jefes, puzzles, UI
  data/
    types.ts              identificadores y tipos compartidos
    zones.ts              mapas, entidades, runas, cofres, jefes y objetos
    story.ts              diálogos ramificados, misiones y recompensas
  scenes/
    BootScene.ts          construye texturas y entra al menú
    MenuScene.ts          menú principal, créditos y acceso al diario
    WorldScene.ts         reexporta IsoScene como escena "World"
  systems/
    SaveSystem.ts         Save.data + persistencia + migración
    Controls.ts           teclado y táctil mediante acciones
    Audio.ts              música/SFX WebAudio
    questions.ts          generadores matemáticos verificados
    mathParse.ts          parser seguro y checkAnswer
    numeric.ts            integración y diferencias finitas
  ui/
    Hud.ts                vida, resistencia, runas, jefe, minimapa, avisos
    Dialogue.ts           diálogo con retratos y opciones
    QuestionModal.ts      modal KaTeX
    Journal.ts            diario de fórmulas
    Overlays.ts           inventario, mapa, misiones, pausa, muerte, créditos, controles y ayuda
```

## Reglas de arquitectura

1. El contenido vive en `data/`. La escena no hardcodea textos de zonas, jefes ni preguntas.
2. Las escenas no leen teclas de Phaser. Usan `Controls.dir` y `Controls.consume`.
3. Los modales son DOM y deben desactivar controles al abrir y reactivarlos al cerrar.
4. Toda pregunta sale de `generateQuestion(topic, difficulty)` y trae enunciado LaTeX, respuesta numérica, pistas y solución.
5. Las respuestas se validan con `parseAnswer` + `checkAnswer`; nunca con `eval`.
6. Progreso persistente solo mediante `Save.data` y `Save.save()`.
7. Todo el texto del juego está en español.
8. TypeScript strict: `npm run build` debe pasar antes de dar algo por terminado.

## Verificación matemática

`scripts/verifyMath.ts` comprueba numéricamente cada respuesta con cuadratura 2D o diferencias finitas. Estado actual: 15000/15000 respuestas y soluciones OK en 5 temas × 3 dificultades.

No agregar preguntas cuya respuesta no esté verificada matemáticamente.

## Estado actual

- Proyecto convertido de top-down a 2.5D isométrico.
- Combate, jefes, puzzles, narrativa, HUD, paneles, audio, reasignación de teclas y PWA integrados.
- `WorldScene` es la escena isométrica principal.
