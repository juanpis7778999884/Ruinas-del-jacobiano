import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { ZONES } from '../data/zones';
import { Audio } from '../systems/Audio';
import { Controls } from '../systems/Controls';
import { Save } from '../systems/SaveSystem';
import { hideHud } from '../ui/Hud';
import { openJournal } from '../ui/Journal';
import { openPanel } from '../ui/Overlays';

interface Entry {
  label: string;
  hint: string;
  fn: () => void;
  text?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
}

export class MenuScene extends Phaser.Scene {
  private entries: Entry[] = [];
  private sel = 0;
  private locked = false;
  private lastDirY = 0;

  constructor() {
    super('Menu');
  }

  create() {
    this.entries = [];
    this.sel = 0;
    this.locked = false;
    this.lastDirY = 0;
    document.body.classList.remove('playing');
    hideHud();
    Controls.setEnabled(true);
    Controls.clear();
    Audio.unlock();
    Audio.setTrack('menu');

    this.cameras.main.setBackgroundColor('#0d1024');
    this.buildBackground();

    const title = this.add.text(GAME_W / 2, 96, 'RUINAS DEL JACOBIANO', {
      fontFamily: 'Georgia, serif',
      fontSize: '54px',
      color: '#ffd166',
      fontStyle: 'bold',
      letterSpacing: 4,
    }).setOrigin(0.5);
    title.setShadow(0, 6, '#05060f', 16, false, true);
    this.add.text(GAME_W / 2, 142, 'Una aventura isométrica de exploración, acción y cálculo', {
      fontFamily: FONT,
      fontSize: '19px',
      color: '#8ecae6',
    }).setOrigin(0.5);

    const rule = this.add.graphics();
    rule.lineStyle(1, 0xffd166, 0.5);
    rule.lineBetween(GAME_W / 2 - 260, 166, GAME_W / 2 + 260, 166);

    const has = Save.exists();
    if (has) this.entries.push({ label: 'Continuar aventura', hint: 'Reanuda tu mapa y tu progreso', fn: () => this.start(false) });
    this.entries.push({
      label: has ? 'Nueva aventura' : 'Comenzar aventura',
      hint: has ? 'Borra la partida actual y vuelve a Cartesia' : 'Empieza en Cartesia',
      fn: () => this.start(true),
    });
    this.entries.push({ label: 'Diario de fórmulas', hint: 'Repasa Fubini, regiones, polares y |J|', fn: () => void this.journal() });
    this.entries.push({ label: 'Controles y créditos', hint: 'Ajusta las teclas, consulta la ayuda y los créditos', fn: () => this.credits() });

    this.entries.forEach((entry, i) => {
      const y = 222 + i * 62;
      const panel = this.add.rectangle(GAME_W / 2, y, 460, 50, 0x141834, 0.82)
        .setStrokeStyle(1, 0x3a3f70)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(GAME_W / 2 - 205, y - 8, entry.label, {
        fontFamily: FONT,
        fontSize: '23px',
        color: '#ffffff',
      });
      const hint = this.add.text(GAME_W / 2 - 205, y + 13, entry.hint, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#8b92c9',
      });
      entry.text = text;
      entry.hintText = hint;
      panel.on('pointerover', () => this.select(i));
      panel.on('pointerdown', () => { this.select(i); this.activate(); });
    });
    this.select(0);

    this.add.text(GAME_W / 2, GAME_H - 54, 'WASD o flechas: mover · E: interactuar · Espacio: atacar · H: golpe fuerte', {
      fontFamily: FONT, fontSize: '15px', color: '#a8afdd',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H - 28, 'Shift: esquivar · G: defender · I: inventario · M: mapa · J: fórmulas · ◈: lente', {
      fontFamily: FONT, fontSize: '14px', color: '#777fb3',
    }).setOrigin(0.5);

    if (has) {
      const done = Object.values(Save.data.completed).filter(Boolean).length;
      const state = Save.data.victory ? 'Cartesia restaurada' : `${done}/5 regiones liberadas`;
      this.add.text(GAME_W - 24, 24, state, {
        fontFamily: FONT, fontSize: '14px', color: '#8dffd8',
      }).setOrigin(1, 0);
    }

    this.input.once('pointerdown', () => Audio.unlock());
  }

  private buildBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x111735, 0x111735, 0x080a18, 0x080a18, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    for (let row = 0; row < 13; row++) {
      for (let col = 0; col < 20; col++) {
        const key = (row + col) % 5 === 0 ? 'iso_moss' : `iso_floor${(row * 3 + col) % 4}`;
        const x = col * 64 - row * 64 - 180;
        const y = row * 30 + col * 14 - 120;
        if (x < -80 || x > GAME_W + 80 || y < -60 || y > GAME_H + 60) continue;
        this.add.image(x, y, key).setOrigin(0.5).setAlpha(0.16);
      }
    }

    for (let i = 0; i < 7; i++) {
      const x = 70 + i * 145;
      const y = GAME_H - 20 - (i % 3) * 18;
      const column = this.add.image(x, y, `iso_column${i % 2}`)
        .setOrigin(0.5, 0.88)
        .setScale(1.1 + (i % 2) * 0.3)
        .setAlpha(0.34)
        .setTint(0x8f89a8);
      this.tweens.add({ targets: column, alpha: 0.16, duration: 2600 + i * 170, yoyo: true, repeat: -1 });
    }

    const glyphs = ['∬', '∫', '|J|', '∂', 'θ', 'r', 'dx', 'dy'];
    for (let i = 0; i < 24; i++) {
      const t = this.add.text(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, GAME_H), glyphs[i % glyphs.length], {
        fontFamily: 'Georgia, serif',
        fontSize: `${Phaser.Math.Between(18, 48)}px`,
        color: i % 3 === 0 ? '#8dffd8' : '#5965a8',
      }).setOrigin(0.5).setAlpha(0.18);
      this.tweens.add({
        targets: t,
        y: t.y - Phaser.Math.Between(24, 60),
        alpha: 0.03,
        duration: Phaser.Math.Between(3200, 6200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.add.image(0, 0, 'iso_vignette')
      .setOrigin(0)
      .setDisplaySize(GAME_W, GAME_H)
      .setAlpha(0.9)
      .setDepth(100);

    const portal = this.add.image(GAME_W / 2, 245, 'iso_portal')
      .setOrigin(0.5, 0.9)
      .setScale(3.6, 4.6)
      .setAlpha(0.12)
      .setTint(0xb38bff)
      .setDepth(1);
    this.tweens.add({ targets: portal, alpha: 0.2, duration: 2400, yoyo: true, repeat: -1 });
  }

  update() {
    if (this.locked) return;
    const dirY = Controls.dir.y;
    if (dirY !== 0 && this.lastDirY === 0) this.select(this.sel + (dirY > 0 ? 1 : -1));
    this.lastDirY = dirY;
    if (Controls.consume('interact') || Controls.consume('attack')) this.activate();
  }

  private select(i: number) {
    const n = this.entries.length;
    if (!n) return;
    this.sel = (i + n) % n;
    this.entries.forEach((entry, idx) => {
      const on = idx === this.sel;
      entry.text?.setColor(on ? '#ffd166' : '#e8ebff');
      entry.text?.setScale(on ? 1.04 : 1);
      entry.hintText?.setColor(on ? '#c9c2ae' : '#727ab0');
    });
  }

  private activate() {
    if (this.locked) return;
    Audio.play('ui');
    this.entries[this.sel]?.fn();
  }

  private start(fresh: boolean) {
    if (fresh) Save.reset();
    this.locked = true;
    Controls.refreshBindings();
    Controls.setEnabled(true);
    Save.data.currentZone = Save.data.currentZone in ZONES ? Save.data.currentZone : 'cartesia';
    Save.save();
    this.cameras.main.fadeOut(280, 8, 8, 20);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('World', { zone: Save.data.currentZone });
    });
  }

  private async journal() {
    this.locked = true;
    await openJournal();
    this.locked = false;
  }

  private credits() {
    this.locked = true;
    openPanel('controls', { zone: 'cartesia', player: { x: 0, y: 0 }, fromMenu: true });
    const unlock = () => {
      this.locked = false;
      window.removeEventListener('panel-closed', unlock);
    };
    window.addEventListener('panel-closed', unlock);
  }
}
