import Phaser from 'phaser';
import 'katex/dist/katex.min.css';
import './style.css';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { mountTouchUI } from './systems/Controls';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1b1f3b',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, WorldScene],
});

mountTouchUI();

// Aviso de orientación: solo aparece en vertical y en pantallas táctiles.
// Si el jugador decide seguir en vertical, se guarda solo en esta sesión (memoria).
{
  const hint = document.getElementById('rotate-hint');
  const skip = document.getElementById('rotate-skip');
  let dismissed = false;
  const vertical = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  const apply = () => {
    if (hint) hint.hidden = dismissed || !vertical.matches;
  };
  skip?.addEventListener('click', () => {
    dismissed = true;
    apply();
  });
  vertical.addEventListener('change', apply);
  apply();
}
