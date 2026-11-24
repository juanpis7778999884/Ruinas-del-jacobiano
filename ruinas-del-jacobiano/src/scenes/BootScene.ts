import Phaser from 'phaser';
import { buildIsoTextures } from '../iso/isoTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildIsoTextures(this);
    this.scene.start('Menu');
  }
}
