import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, MAP_H, MAP_W, PLAYER_SPEED, TILE } from '../config';
import { BossDef, ExitDef, ITEMS, NpcDef, RuneDef, ZONES, ZoneDef } from '../data/zones';
import { ItemId, ZoneId } from '../data/types';
import { Save } from '../systems/SaveSystem';
import { Controls } from '../systems/Controls';
import { Dialog } from '../systems/Dialog';
import { Question, generateQuestion } from '../systems/questions';
import { askQuestion } from '../ui/QuestionModal';
import { openJournal } from '../ui/Journal';

type Sprite = Phaser.Physics.Arcade.Sprite;

interface RuneObj {
  def: RuneDef;
  key: string;
  sprite: Sprite;
}
interface NpcObj {
  def: NpcDef;
  sprite: Sprite;
}
interface ExitObj {
  def: ExitDef;
  sprite: Phaser.GameObjects.Image;
  locked: boolean;
}
type Target =
  | { kind: 'rune'; rune: RuneObj; x: number; y: number }
  | { kind: 'npc'; npc: NpcObj; x: number; y: number }
  | { kind: 'boss'; x: number; y: number }
  | { kind: 'door'; x: number; y: number };

const px = (t: number) => t * TILE + TILE / 2;

/**
 * Escena genérica de zona (overworld o mazmorra), 100 % guiada por datos de data/zones.ts.
 * Aquí viven: movimiento, combate básico, runas, jefe por fases, portales, HUD y lente.
 */
export class WorldScene extends Phaser.Scene {
  private zoneId: ZoneId = 'cartesia';
  private spawnOverride?: { x: number; y: number };
  private zone!: ZoneDef;

  private player!: Sprite;
  private facing = new Phaser.Math.Vector2(0, 1);
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private doorGroup!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private door?: Sprite;
  private bossSprite?: Sprite;
  private runes: RuneObj[] = [];
  private npcs: NpcObj[] = [];
  private exits: ExitObj[] = [];

  private dialog!: Dialog;
  private heartsText!: Phaser.GameObjects.Text;
  private itemsText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private lensGfx!: Phaser.GameObjects.Graphics;

  private modalOpen = false;
  private transitioning = false;
  private lensOn = false;
  private invuln = 0;
  private nextAttack = 0;
  private lastToast = 0;
  /** hasta este instante (ms) el empuje del daño manda sobre el input */
  private knockUntil = 0;

  constructor() {
    super('World');
  }

  init(data: { zone?: ZoneId; spawn?: { x: number; y: number } }) {
    this.zoneId = data.zone ?? Save.data.currentZone;
    this.spawnOverride = data.spawn;
    this.modalOpen = false;
    this.transitioning = false;
    this.lensOn = false;
    this.invuln = 0;
    this.nextAttack = 0;
    this.lastToast = 0;
    this.knockUntil = 0;
    this.runes = [];
    this.npcs = [];
    this.exits = [];
    this.door = undefined;
    this.bossSprite = undefined;
  }

  /* ─────────────────────────── creación ─────────────────────────── */
  create() {
    this.zone = ZONES[this.zoneId];
    Save.data.currentZone = this.zoneId;
    if (this.zoneId === 'cartesia') Save.data.hearts = Save.data.maxHearts; // el reino te cura
    Save.save();

    this.cameras.main.setBackgroundColor('#1b1f3b');
    this.cameras.main.setScroll(0, -(GAME_H - MAP_H * TILE) / 2);
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    this.walls = this.physics.add.staticGroup();
    this.solids = this.physics.add.staticGroup();
    this.doorGroup = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();

    this.buildMap();
    this.buildEntities();
    this.createPlayer();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.doorGroup);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.doorGroup);
    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onEnemyTouch(e as Sprite));

    this.lensGfx = this.add.graphics().setDepth(60).setVisible(false);
    this.dialog = new Dialog(this);
    this.createHud();
    this.drawHud();

    this.cameras.main.fadeIn(250);
    void this.runIntro();
  }

  private runKey(i: number) {
    return `${this.zone.id}:${i}`;
  }

  private solvedCount(): number {
    return this.zone.runes.filter((_, i) => Save.data.solvedRunes[this.runKey(i)]).length;
  }

  private buildMap() {
    const dungeon = this.zone.tileset === 'dungeon';
    const baseKey = dungeon ? 'floor' : 'grass';
    const doorOpen = this.zone.runes.length > 0 && this.solvedCount() >= this.zone.runes.length;

    this.zone.map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const X = x * TILE;
        const Y = y * TILE;
        const cx = X + TILE / 2;
        const cy = Y + TILE / 2;
        if (ch === '#') {
          this.walls.create(cx, cy, dungeon ? 'wall' : 'tree');
        } else if (ch === '~') {
          this.walls.create(cx, cy, 'water');
        } else if (ch === '=') {
          this.add.image(X, Y, 'path').setOrigin(0);
        } else {
          this.add.image(X, Y, baseKey).setOrigin(0);
          if (ch === 'D' && !doorOpen) {
            this.door = this.doorGroup.create(cx, cy, 'door') as Sprite;
          }
        }
      });
    });
  }

  private buildEntities() {
    // Runas
    this.zone.runes.forEach((def, i) => {
      const key = this.runKey(i);
      const solved = !!Save.data.solvedRunes[key];
      const sprite = this.solids.create(px(def.x), px(def.y), solved ? 'rune_done' : 'rune') as Sprite;
      sprite.setDepth(5);
      this.runes.push({ def, key, sprite });
    });

    // NPCs
    this.zone.npcs.forEach((def) => {
      const sprite = this.solids.create(px(def.x), px(def.y), 'npc') as Sprite;
      sprite.setDepth(5);
      this.add
        .text(px(def.x), px(def.y) - 26, def.name, {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#ffd166',
          backgroundColor: '#10132b',
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.npcs.push({ def, sprite });
    });

    // Portales
    this.zone.exits.forEach((def) => {
      const locked = !!def.requires && !Save.data.completed[def.requires];
      const sprite = this.add.image(px(def.x), px(def.y), 'portal').setDepth(4);
      if (locked) sprite.setTint(0x555566);
      else this.tweens.add({ targets: sprite, angle: 360, duration: 3000, repeat: -1 });
      this.add
        .text(px(def.x), px(def.y) + 26, def.label, {
          fontFamily: FONT,
          fontSize: '12px',
          color: locked ? '#888899' : '#e0aaff',
          backgroundColor: '#10132b',
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.exits.push({ def, sprite, locked });
    });

    // Enemigos
    this.zone.enemies.forEach((e) => {
      const s = this.enemies.create(px(e.x), px(e.y), 'slime') as Sprite;
      s.setCollideWorldBounds(true).setDepth(8);
      (s.body as Phaser.Physics.Arcade.Body).setSize(22, 18);
      s.setData('turn', 0);
    });

    // Jefe (si ya está derrotado, no aparece)
    const boss = this.zone.boss;
    if (boss && !Save.data.completed[this.zone.id]) {
      this.bossSprite = this.solids.create(px(boss.x), px(boss.y), 'boss') as Sprite;
      this.bossSprite.setDepth(7);
      this.add
        .text(px(boss.x), px(boss.y) - 46, boss.name, {
          fontFamily: FONT,
          fontSize: '13px',
          color: '#ff6b6b',
          backgroundColor: '#10132b',
        })
        .setOrigin(0.5)
        .setDepth(9);
    }
  }

  private createPlayer() {
    const s = this.spawnOverride ?? this.zone.spawn;
    this.player = this.physics.add.sprite(px(s.x), px(s.y), 'player');
    this.player.setCollideWorldBounds(true).setDepth(10);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 14);
    body.setOffset(4, 14);
  }

  private createHud() {
    const base = { fontFamily: FONT, color: '#ffffff' };
    this.heartsText = this.add
      .text(12, 8, '', { ...base, fontSize: '26px', color: '#ff4d6d' })
      .setScrollFactor(0)
      .setDepth(100);
    this.itemsText = this.add
      .text(12, 40, '', { ...base, fontSize: '22px' })
      .setScrollFactor(0)
      .setDepth(100);
    this.titleText = this.add
      .text(GAME_W / 2, 10, '', {
        ...base,
        fontSize: '18px',
        color: '#ffd166',
        backgroundColor: '#10132bcc',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.prompt = this.add
      .text(0, 0, '', {
        ...base,
        fontSize: '14px',
        backgroundColor: '#10132b',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
    this.toastText = this.add
      .text(GAME_W / 2, 84, '', {
        ...base,
        fontSize: '18px',
        color: '#ffd166',
        backgroundColor: '#10132bee',
        padding: { x: 10, y: 6 },
        align: 'center',
        wordWrap: { width: GAME_W - 160 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(150)
      .setAlpha(0);
  }

  private drawHud() {
    const h = Save.data.hearts;
    const m = Save.data.maxHearts;
    this.heartsText.setText('♥'.repeat(h) + '♡'.repeat(Math.max(0, m - h)));
    const owned = (Object.keys(ITEMS) as ItemId[]).filter((k) => Save.data.items[k]).map((k) => ITEMS[k].icon);
    this.itemsText.setText(owned.join(' '));
    const total = this.zone.runes.length;
    this.titleText.setText(total ? `${this.zone.name}  ·  Runas ${this.solvedCount()}/${total}` : this.zone.name);
  }

  private toast(msg: string) {
    this.lastToast = this.time.now;
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2200, duration: 500 });
  }

  private async runIntro() {
    if (Save.data.seenIntro[this.zone.id]) return;
    Save.data.seenIntro[this.zone.id] = true;
    Save.save();
    await this.dialog.show(this.zone.intro, this.zone.name);
  }

  /* ─────────────────────────── bucle principal ─────────────────────────── */
  private get busy(): boolean {
    return this.dialog.open || this.modalOpen || this.transitioning;
  }

  update(time: number) {
    if (this.lensOn) this.drawLens(time);
    this.dialog.update();

    if (this.busy) {
      this.player.setVelocity(0, 0);
      (this.enemies.getChildren() as Sprite[]).forEach((e) => e.active && e.setVelocity(0, 0));
      this.prompt.setVisible(false);
      return;
    }

    // Movimiento
    const d = Controls.dir;
    const speed = PLAYER_SPEED * (Save.data.items.polar ? 1.25 : 1);
    // durante el empujón el input no pisa la velocidad de knockback
    if (time >= this.knockUntil) this.player.setVelocity(d.x * speed, d.y * speed);
    if (d.x !== 0 || d.y !== 0) this.facing.set(d.x, d.y).normalize();
    if (d.x < -0.1) this.player.setFlipX(true);
    else if (d.x > 0.1) this.player.setFlipX(false);

    // Acciones
    if (Controls.consume('attack')) this.attack();
    if (Controls.consume('journal')) void this.journal();
    if (Controls.consume('lens')) this.toggleLens();
    if (Controls.consume('menu')) {
      this.backToMenu();
      return;
    }

    const target = this.findTarget();
    if (target) {
      this.prompt
        .setText(this.promptFor(target))
        .setPosition(target.x, target.y - 44)
        .setVisible(true);
      if (Controls.consume('interact')) void this.interact(target);
    } else {
      this.prompt.setVisible(false);
      Controls.consume('interact');
    }

    this.updateEnemies(time);
    this.checkExits();
  }

  private findTarget(): Target | null {
    let best: Target | null = null;
    let bd = 58;
    const consider = (t: Target) => {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
      if (dist < bd) {
        bd = dist;
        best = t;
      }
    };
    this.runes.forEach((r) => consider({ kind: 'rune', rune: r, x: r.sprite.x, y: r.sprite.y }));
    this.npcs.forEach((n) => consider({ kind: 'npc', npc: n, x: n.sprite.x, y: n.sprite.y }));
    if (this.bossSprite && this.bossSprite.active) {
      consider({ kind: 'boss', x: this.bossSprite.x, y: this.bossSprite.y });
    }
    if (this.door && this.door.active) consider({ kind: 'door', x: this.door.x, y: this.door.y });
    return best;
  }

  private promptFor(t: Target): string {
    const key = document.body.classList.contains('touch') ? 'A' : 'E';
    switch (t.kind) {
      case 'rune':
        return Save.data.solvedRunes[t.rune.key] ? `[${key}] Practicar runa` : `[${key}] Descifrar runa`;
      case 'npc':
        return `[${key}] Hablar`;
      case 'boss':
        return `[${key}] ¡Desafiar al guardián!`;
      case 'door':
        return `Puerta sellada (${this.solvedCount()}/${this.zone.runes.length})`;
    }
  }

  private async interact(t: Target) {
    switch (t.kind) {
      case 'npc': {
        const done = this.zone.id === 'cartesia' ? Save.data.victory : !!Save.data.completed[this.zone.id];
        const lines = done && t.npc.def.doneLines ? t.npc.def.doneLines : t.npc.def.lines;
        await this.dialog.show(lines, t.npc.def.name);
        break;
      }
      case 'rune':
        await this.solveRune(t.rune);
        break;
      case 'boss':
        await this.fightBoss();
        break;
      case 'door':
        this.toast(`La puerta sigue sellada. Descifra las runas (${this.solvedCount()}/${this.zone.runes.length}).`);
        break;
    }
  }

  /* ─────────────────────────── preguntas ─────────────────────────── */
  private async ask(q: Question, heading: string, maxAttempts: number) {
    this.modalOpen = true;
    this.player.setVelocity(0, 0);
    const res = await askQuestion(q, {
      heading,
      maxAttempts,
      allowClose: true,
      freeHint: Save.data.items.lente,
    });
    this.modalOpen = false;
    if (!res.canceled) {
      Save.data.stats.correct += res.correct ? 1 : 0;
      Save.data.stats.wrong += res.attempts - (res.correct ? 1 : 0);
      Save.save();
    }
    return res;
  }

  private async solveRune(r: RuneObj) {
    const already = !!Save.data.solvedRunes[r.key];
    const q = generateQuestion(r.def.topic, r.def.difficulty);
    const res = await this.ask(q, already ? 'Runa descifrada · práctica' : 'Runa antigua', 3);
    if (res.canceled || already) return;

    if (res.correct) {
      Save.data.solvedRunes[r.key] = true;
      Save.save();
      r.sprite.setTexture('rune_done');
      this.cameras.main.flash(200, 128, 237, 153);
      this.drawHud();
      if (this.door && this.solvedCount() >= this.zone.runes.length) {
        this.door.destroy();
        this.door = undefined;
        await this.dialog.show(['Las runas brillan al unísono…', '¡La puerta del guardián se abrió! Cruza al otro lado.']);
      }
    } else {
      this.toast('La runa sigue apagada. ¡Inténtalo otra vez: saldrá un problema nuevo!');
    }
  }

  private async fightBoss() {
    const boss = this.zone.boss as BossDef;
    const phase = Save.data.bossPhase[this.zone.id] ?? 0;
    const introKey = `boss:${this.zone.id}`;
    if (!Save.data.seenIntro[introKey]) {
      Save.data.seenIntro[introKey] = true;
      Save.save();
      await this.dialog.show(boss.introLines, boss.name);
    }

    const ph = boss.phases[phase];
    const q = generateQuestion(ph.topic, ph.difficulty);
    const res = await this.ask(q, `${boss.name} · Fase ${phase + 1}/${boss.phases.length}`, 2);
    if (res.canceled) return;

    if (res.correct) {
      const next = phase + 1;
      Save.data.bossPhase[this.zone.id] = next;
      Save.save();
      this.cameras.main.shake(180, 0.006);
      if (next >= boss.phases.length) {
        await this.bossDefeated(boss);
      } else {
        await this.dialog.show([boss.phaseLines[phase] ?? '¡Bien hecho!'], boss.name);
      }
    } else {
      await this.dialog.show(['¡Fallaste! El guardián te golpea…', 'No te rindas: la próxima vez saldrá un problema distinto.'], boss.name);
      this.damagePlayer(1);
    }
  }

  private async bossDefeated(boss: BossDef) {
    Save.data.completed[this.zone.id] = true;
    if (this.zone.final) Save.data.victory = true;
    if (this.zone.reward) Save.data.items[this.zone.reward.item] = true;
    Save.save();

    const sprite = this.bossSprite;
    this.bossSprite = undefined;
    if (sprite) {
      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scale: 0.2,
          duration: 600,
          onComplete: () => {
            sprite.destroy();
            resolve();
          },
        });
      });
    }
    await this.dialog.show(boss.defeatLines, boss.name);
    if (this.zone.reward) await this.dialog.show(this.zone.reward.lines);
    if (this.zone.final) {
      const s = Save.data.stats;
      await this.dialog.show([
        '🏆 ¡JUEGO COMPLETADO! 🏆',
        `Respuestas correctas: ${s.correct} · Intentos fallidos: ${s.wrong}`,
        'Puedes volver a las runas para seguir practicando para el parcial.',
      ]);
    }
    this.drawHud();
  }

  /* ─────────────────────────── combate ─────────────────────────── */
  private attack() {
    const now = this.time.now;
    if (now < this.nextAttack) return;
    this.nextAttack = now + 350;
    const reach = Save.data.items.fubini ? 58 : 40;
    const cx = this.player.x + this.facing.x * reach * 0.7;
    const cy = this.player.y + this.facing.y * reach * 0.7;
    const fx = this.add.image(cx, cy, 'slash').setRotation(this.facing.angle()).setDepth(20);
    this.tweens.add({ targets: fx, alpha: 0, duration: 180, onComplete: () => fx.destroy() });
    (this.enemies.getChildren() as Sprite[]).forEach((e) => {
      if (e.active && Phaser.Math.Distance.Between(cx, cy, e.x, e.y) < reach) this.killEnemy(e);
    });
  }

  private killEnemy(e: Sprite) {
    e.disableBody(true, false);
    this.tweens.add({ targets: e, alpha: 0, scale: 0.3, duration: 200, onComplete: () => e.destroy() });
    if (Math.random() < 0.25 && Save.data.hearts < Save.data.maxHearts) {
      Save.data.hearts++;
      Save.save();
      this.drawHud();
      this.toast('+1 ♥');
    }
  }

  private updateEnemies(time: number) {
    (this.enemies.getChildren() as Sprite[]).forEach((e) => {
      if (!e.active) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
      if (dist < 170) {
        this.physics.moveToObject(e, this.player, 55);
      } else if (time > (e.getData('turn') as number)) {
        const a = Math.random() * Math.PI * 2;
        e.setVelocity(Math.cos(a) * 30, Math.sin(a) * 30);
        e.setData('turn', time + 1200 + Math.random() * 1200);
      }
    });
  }

  private onEnemyTouch(e: Sprite) {
    if (this.busy || !e.active) return;
    this.damagePlayer(1, e);
  }

  private damagePlayer(n: number, from?: Sprite) {
    const now = this.time.now;
    if (now < this.invuln) return;
    this.invuln = now + 1000;
    Save.data.hearts = Math.max(0, Save.data.hearts - n);
    Save.save();
    this.drawHud();
    this.player.setTint(0xff6b6b);
    this.time.delayedCall(250, () => this.player.clearTint());
    if (from) {
      const v = new Phaser.Math.Vector2(this.player.x - from.x, this.player.y - from.y).normalize().scale(220);
      this.player.setVelocity(v.x, v.y);
      this.knockUntil = now + 150;
    }
    if (Save.data.hearts <= 0) void this.defeat();
  }

  private async defeat() {
    await this.dialog.show([
      'Tus fuerzas se agotan y todo se vuelve borroso…',
      'La energía de Cartesia te devuelve al inicio de la zona con los corazones llenos.',
    ]);
    Save.data.hearts = Save.data.maxHearts;
    Save.save();
    const s = this.zone.spawn;
    this.player.setPosition(px(s.x), px(s.y));
    this.drawHud();
    this.invuln = this.time.now + 1500;
  }

  /* ─────────────────────────── portales, diario, lente ─────────────────────────── */
  private checkExits() {
    for (const ex of this.exits) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ex.sprite.x, ex.sprite.y);
      if (d >= 24) continue;
      if (ex.locked) {
        if (this.time.now - this.lastToast > 1800) this.toast(ex.def.lockedMsg || 'El portal está sellado.');
        return;
      }
      this.transitioning = true;
      this.player.setVelocity(0, 0);
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ zone: ex.def.to, spawn: ex.def.spawn });
      });
      return;
    }
  }

  private async journal() {
    this.modalOpen = true;
    this.player.setVelocity(0, 0);
    await openJournal();
    this.modalOpen = false;
  }

  private toggleLens() {
    if (!Save.data.items.lente) {
      this.toast('Aún no tienes el Lente del Jacobiano. Lo guarda el Coloso de Ciudad Polar.');
      return;
    }
    this.lensOn = !this.lensOn;
    this.lensGfx.setVisible(this.lensOn);
    if (!this.lensOn) this.lensGfx.clear();
  }

  /** Cuadrícula deformada T(u,v): una transformación que cambia con el tiempo. */
  private drawLens(t: number) {
    const g = this.lensGfx;
    g.clear();
    g.lineStyle(1, 0x8ecae6, 0.55);
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    const warp = (u: number, v: number) => ({
      x: u + 9 * Math.sin(v / 42 + t / 700),
      y: v + 9 * Math.sin(u / 42 + t / 900),
    });
    for (let i = 0; i <= MAP_W; i++) {
      g.beginPath();
      for (let j = 0; j <= MAP_H * 4; j++) {
        const p = warp(i * TILE, (j * TILE) / 4);
        if (j === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    for (let j = 0; j <= MAP_H; j++) {
      g.beginPath();
      for (let i = 0; i <= MAP_W * 4; i++) {
        const p = warp((i * TILE) / 4, j * TILE);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    void W;
    void H;
  }

  private backToMenu() {
    Save.save();
    this.transitioning = true;
    this.cameras.main.fadeOut(200);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }
}
