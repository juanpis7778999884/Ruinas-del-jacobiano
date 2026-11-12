import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { Save } from '../systems/SaveSystem';
import { Controls } from '../systems/Controls';
import { openJournal } from '../ui/Journal';

export class MenuScene extends Phaser.Scene {
  private entries: { label: string; fn: () => void; text?: Phaser.GameObjects.Text }[] = [];
  private sel = 0;
  private locked = false;

  constructor() {
    super('Menu');
  }

  create() {
    this.locked = false;
    this.sel = 0;
    this.cameras.main.setBackgroundColor('#1b1f3b');

    const glyphs = ['∬', '∫', '|J|', '∂', 'θ', 'r'];
    for (let i = 0; i < 20; i++) {
      const t = this.add.text(
        Phaser.Math.Between(0, GAME_W),
        Phaser.Math.Between(0, GAME_H),
        glyphs[i % glyphs.length],
        { fontFamily: 'Georgia, serif', fontSize: `${Phaser.Math.Between(26, 70)}px`, color: '#262b57' },
      );
      this.tweens.add({
        targets: t,
        y: t.y + Phaser.Math.Between(20, 50),
        duration: Phaser.Math.Between(2500, 4500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add
      .text(GAME_W / 2, 90, 'Las Ruinas del Jacobiano', {
        fontFamily: 'Georgia, serif',
        fontSize: '52px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 145, 'Una aventura para dominar integrales dobles y cambio de variables', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#8ecae6',
      })
      .setOrigin(0.5);

    const has = Save.exists();
    this.entries = [];
    if (has) this.entries.push({ label: '▶  Continuar aventura', fn: () => this.start(false) });
    this.entries.push({
      label: has ? '★  Nueva aventura (borra tu progreso)' : '★  Comenzar aventura',
      fn: () => this.start(true),
    });
    this.entries.push({ label: '📖  Diario de fórmulas', fn: () => this.journal() });

    this.entries.forEach((e, i) => {
      const t = this.add
        .text(GAME_W / 2, 240 + i * 56, e.label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => this.select(i));
      t.on('pointerdown', () => {
        this.select(i);
        this.activate();
      });
      e.text = t;
    });
    this.select(0);

    this.add
      .text(
        GAME_W / 2,
        GAME_H - 60,
        'WASD / flechas: mover  ·  E o A: interactuar  ·  Espacio o B: atacar  ·  J: diario  ·  Q: lente',
        { fontFamily: FONT, fontSize: '16px', color: '#9aa0d6' },
      )
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, GAME_H - 32, 'Sin cronómetro, sin ranking: tu progreso se guarda solo.', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#9aa0d6',
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', () => this.select(this.sel - 1));
      kb.on('keydown-DOWN', () => this.select(this.sel + 1));
      kb.on('keydown-W', () => this.select(this.sel - 1));
      kb.on('keydown-S', () => this.select(this.sel + 1));
      kb.on('keydown-ENTER', () => this.activate());
      kb.on('keydown-SPACE', () => this.activate());
    }
  }

  private select(i: number) {
    const n = this.entries.length;
    this.sel = (i + n) % n;
    this.entries.forEach((e, idx) => {
      e.text?.setColor(idx === this.sel ? '#ffd166' : '#ffffff');
      e.text?.setScale(idx === this.sel ? 1.08 : 1);
    });
  }

  private activate() {
    if (this.locked) return;
    this.entries[this.sel]?.fn();
  }

  private start(fresh: boolean) {
    if (fresh) Save.reset();
    Controls.setEnabled(true);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('World', { zone: Save.data.currentZone });
    });
  }

  private async journal() {
    this.locked = true;
    await openJournal();
    this.locked = false;
  }
}
