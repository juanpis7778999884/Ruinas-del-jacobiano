import Phaser from 'phaser';

/** Genera todas las texturas por código (sin assets externos). Reemplázalas por pixel art cuando quieras. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const T = (key: string, w: number, h: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };
    const speckles = (color: number, pts: number[][]) => {
      g.fillStyle(color);
      pts.forEach(([x, y]) => g.fillRect(x, y, 3, 2));
    };

    T('grass', 32, 32, () => {
      g.fillStyle(0x4f9d4f);
      g.fillRect(0, 0, 32, 32);
      speckles(0x438f43, [[4, 6], [18, 3], [26, 14], [9, 22], [22, 26], [14, 15]]);
    });
    T('path', 32, 32, () => {
      g.fillStyle(0xc8a96e);
      g.fillRect(0, 0, 32, 32);
      speckles(0xb89858, [[6, 5], [20, 9], [12, 20], [25, 24], [3, 27]]);
    });
    T('water', 32, 32, () => {
      g.fillStyle(0x2d6cdf);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(2, 0x5b95ee);
      g.beginPath();
      g.moveTo(4, 10);
      g.lineTo(14, 10);
      g.moveTo(18, 22);
      g.lineTo(28, 22);
      g.strokePath();
    });
    T('tree', 32, 32, () => {
      g.fillStyle(0x4f9d4f);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x6b4423);
      g.fillRect(13, 20, 6, 10);
      g.fillStyle(0x1f6b2f);
      g.fillCircle(16, 14, 13);
      g.fillStyle(0x2a8a3e);
      g.fillCircle(12, 11, 6);
    });
    T('wall', 32, 32, () => {
      g.fillStyle(0x3b3f6b);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(2, 0x2c2f55);
      g.strokeRect(1, 1, 30, 30);
      g.beginPath();
      g.moveTo(0, 16);
      g.lineTo(32, 16);
      g.moveTo(16, 0);
      g.lineTo(16, 16);
      g.moveTo(8, 16);
      g.lineTo(8, 32);
      g.moveTo(24, 16);
      g.lineTo(24, 32);
      g.strokePath();
      g.fillStyle(0x4d5290);
      g.fillRect(2, 2, 12, 3);
    });
    T('floor', 32, 32, () => {
      g.fillStyle(0x56547a);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(1, 0x4a4870);
      g.strokeRect(0, 0, 32, 32);
      speckles(0x4f4d73, [[8, 8], [22, 20]]);
    });
    T('door', 32, 32, () => {
      g.fillStyle(0x56547a);
      g.fillRect(0, 0, 32, 32);
      g.fillStyle(0x5c3a1a);
      g.fillRect(2, 0, 28, 32);
      g.fillStyle(0x8b5a2b);
      g.fillRect(5, 3, 22, 26);
      g.fillStyle(0xffd166);
      g.fillCircle(16, 16, 5);
      g.fillStyle(0x1b1f3b);
      g.fillRect(15, 15, 2, 6);
    });
    T('player', 24, 28, () => {
      g.fillStyle(0x1d3557);
      g.fillRect(4, 12, 16, 14);
      g.fillStyle(0x2b6fd6);
      g.fillRect(5, 13, 14, 10);
      g.fillStyle(0xffd9b3);
      g.fillCircle(12, 8, 7);
      g.fillStyle(0xe63946);
      g.fillRect(4, 2, 16, 4);
      g.fillStyle(0x000000);
      g.fillRect(9, 8, 2, 2);
      g.fillRect(14, 8, 2, 2);
      g.fillStyle(0x6b4423);
      g.fillRect(6, 24, 5, 4);
      g.fillRect(14, 24, 5, 4);
    });
    T('npc', 24, 28, () => {
      g.fillStyle(0xffb703);
      g.fillRect(4, 12, 16, 14);
      g.fillStyle(0xfb8500);
      g.fillRect(5, 14, 14, 3);
      g.fillStyle(0xffd9b3);
      g.fillCircle(12, 8, 7);
      g.fillStyle(0xffffff);
      g.fillRect(6, 11, 12, 6);
      g.fillStyle(0x6a0572);
      g.fillTriangle(3, 5, 21, 5, 12, -4);
      g.fillStyle(0x000000);
      g.fillRect(9, 8, 2, 2);
      g.fillRect(14, 8, 2, 2);
    });
    T('rune', 32, 32, () => {
      g.fillStyle(0x777788);
      g.fillRect(6, 18, 20, 12);
      g.fillStyle(0x55556a);
      g.fillRect(6, 26, 20, 4);
      g.fillStyle(0x7bdff2);
      g.fillTriangle(16, 2, 26, 14, 6, 14);
      g.fillTriangle(16, 24, 26, 14, 6, 14);
      g.fillStyle(0xffffff);
      g.fillCircle(16, 14, 3);
    });
    T('rune_done', 32, 32, () => {
      g.fillStyle(0x777788);
      g.fillRect(6, 18, 20, 12);
      g.fillStyle(0x55556a);
      g.fillRect(6, 26, 20, 4);
      g.fillStyle(0x80ed99);
      g.fillTriangle(16, 2, 26, 14, 6, 14);
      g.fillTriangle(16, 24, 26, 14, 6, 14);
      g.fillStyle(0xffffff);
      g.fillCircle(16, 14, 3);
    });
    T('slime', 26, 22, () => {
      g.fillStyle(0xd62828);
      g.fillEllipse(13, 13, 24, 18);
      g.fillStyle(0xf77f00);
      g.fillEllipse(10, 9, 8, 5);
      g.fillStyle(0xffffff);
      g.fillCircle(9, 12, 3);
      g.fillCircle(18, 12, 3);
      g.fillStyle(0x000000);
      g.fillCircle(9, 12, 1);
      g.fillCircle(18, 12, 1);
    });
    T('boss', 64, 64, () => {
      g.fillStyle(0x3c096c);
      g.fillTriangle(8, 20, 18, 0, 26, 18);
      g.fillTriangle(24, 14, 32, -4, 40, 14);
      g.fillTriangle(38, 18, 46, 0, 56, 20);
      g.fillStyle(0x6a0572);
      g.fillCircle(32, 36, 28);
      g.fillStyle(0xffffff);
      g.fillCircle(21, 30, 7);
      g.fillCircle(43, 30, 7);
      g.fillStyle(0xff0054);
      g.fillCircle(21, 31, 3);
      g.fillCircle(43, 31, 3);
      g.lineStyle(3, 0x10002b);
      g.beginPath();
      g.moveTo(16, 46);
      g.lineTo(24, 52);
      g.lineTo(32, 46);
      g.lineTo(40, 52);
      g.lineTo(48, 46);
      g.strokePath();
    });
    T('portal', 32, 32, () => {
      g.fillStyle(0x9d4edd);
      g.fillCircle(16, 16, 15);
      g.fillStyle(0xc77dff);
      g.fillCircle(16, 16, 10);
      g.fillStyle(0xe0aaff);
      g.fillCircle(16, 16, 5);
      g.fillStyle(0xffffff);
      g.fillCircle(16, 16, 2);
    });
    T('slash', 28, 28, () => {
      g.lineStyle(5, 0xffffff, 0.95);
      g.beginPath();
      g.arc(14, 14, 10, -0.9, 0.9, false);
      g.strokePath();
    });

    g.destroy();
    this.scene.start('Menu');
  }
}
