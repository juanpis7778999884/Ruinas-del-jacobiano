import Phaser from 'phaser';
import { Controls } from './Controls';
import { FONT, GAME_H, GAME_W } from '../config';

/** Caja de diálogo estilo RPG. show() devuelve una promesa que se resuelve al cerrar. */
export class Dialog {
  open = false;
  private container: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private idx = 0;
  private resolver: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    const w = GAME_W - 80;
    const h = 150;
    const x = 40;
    const y = GAME_H - h - 20;

    const bg = scene.add.graphics();
    bg.fillStyle(0x10132b, 0.96);
    bg.fillRoundedRect(0, 0, w, h, 14);
    bg.lineStyle(3, 0xffd166, 1);
    bg.strokeRoundedRect(0, 0, w, h, 14);

    this.nameText = scene.add.text(20, 10, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#ffd166',
      fontStyle: 'bold',
    });
    this.bodyText = scene.add.text(20, 42, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: w - 40 },
      lineSpacing: 6,
    });
    const arrow = scene.add
      .text(w - 18, h - 10, '▼', { fontFamily: FONT, fontSize: '18px', color: '#8ecae6' })
      .setOrigin(1, 1);

    this.container = scene.add
      .container(x, y, [bg, this.nameText, this.bodyText, arrow])
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false);

    scene.input.on('pointerdown', () => {
      if (this.open) this.next();
    });
  }

  show(lines: string[], speaker = ''): Promise<void> {
    return new Promise<void>((resolve) => {
      this.lines = lines;
      this.idx = 0;
      this.resolver = resolve;
      this.nameText.setText(speaker);
      this.open = true;
      this.container.setVisible(true);
      this.render();
    });
  }

  /** Llamar cada frame desde la escena. */
  update() {
    if (!this.open) return;
    const a = Controls.consume('interact');
    const b = Controls.consume('attack');
    // Mientras hay diálogo, el menú se descarta: no debe quedar encolado
    // para ejecutarse cuando el diálogo se cierre.
    Controls.consume('menu');
    if (a || b) this.next();
  }

  private render() {
    this.bodyText.setText(this.lines[this.idx] ?? '');
  }

  private next() {
    this.idx++;
    if (this.idx >= this.lines.length) {
      this.open = false;
      this.container.setVisible(false);
      const r = this.resolver;
      this.resolver = null;
      r?.();
    } else {
      this.render();
    }
  }
}
