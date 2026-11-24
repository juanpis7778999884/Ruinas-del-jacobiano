/** Audio sintetizado en WebAudio: música por zona y efectos sin assets externos. */
import { Save } from './SaveSystem';

type Sfx =
  | 'step' | 'slash' | 'heavy' | 'hit' | 'hurt' | 'dodge' | 'block'
  | 'pickup' | 'chest' | 'rune' | 'portal' | 'dialog' | 'enemyDie'
  | 'bossHit' | 'bossPhase' | 'victory' | 'switch' | 'heal' | 'ui';

type Track = 'town' | 'grove' | 'river' | 'city' | 'sanctum' | 'combat' | 'boss' | 'menu';

interface Note { f: number; t: number; d: number; type: OscillatorType; gain: number }

const SCALES: Record<Track, number[]> = {
  town: [220, 261.63, 293.66, 329.63, 392, 440],
  grove: [196, 220, 261.63, 293.66, 349.23, 392],
  river: [174.61, 220, 261.63, 329.63, 392, 440],
  city: [233.08, 277.18, 349.23, 415.3, 466.16, 554.37],
  sanctum: [164.81, 196, 246.94, 293.66, 329.63, 392],
  combat: [146.83, 174.61, 220, 233.08, 293.66, 349.23],
  boss: [130.81, 155.56, 196, 207.65, 261.63, 311.13],
  menu: [261.63, 329.63, 392, 493.88, 523.25],
};

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private track: Track | null = null;
  private unlocked = false;

  unlock() {
    if (this.unlocked) {
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this.applyVolumes();
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 160);
    } catch {
      this.ctx = null;
    }
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.master.gain.value = 0.85;
    this.musicGain.gain.value = s.music * 0.22;
    this.sfxGain.gain.value = s.sfx * 0.5;
  }

  refreshVolumes() { this.applyVolumes(); }

  setTrack(track: Track) {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.08;
  }

  stopMusic() {
    this.track = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const track = this.track;
    const scale = SCALES[track];
    const fast = track === 'combat' || track === 'boss';
    const beat = fast ? 0.22 : 0.48;
    while (this.nextTime < ctx.currentTime + 0.4) {
      const i = this.step;
      const notes: Note[] = [];
      if (i % 8 === 0) {
        notes.push({ f: scale[0] / 2, t: this.nextTime, d: beat * 8, type: 'sine', gain: 0.5 });
        notes.push({ f: scale[2] / 2, t: this.nextTime, d: beat * 8, type: 'sine', gain: 0.3 });
      }
      if (i % 2 === 0 || fast) {
        const idx = (i * (fast ? 3 : 2) + Math.floor(i / 8)) % scale.length;
        notes.push({ f: scale[idx], t: this.nextTime, d: beat * (fast ? 0.8 : 1.7), type: track === 'boss' ? 'sawtooth' : 'triangle', gain: fast ? 0.2 : 0.16 });
      }
      if (fast && i % 4 === 2) {
        notes.push({ f: scale[1] * 2, t: this.nextTime, d: 0.08, type: 'square', gain: 0.08 });
      }
      for (const n of notes) this.tone(n.f, n.t, n.d, n.type, n.gain, this.musicGain);
      if (fast && i % 2 === 0) this.noise(this.nextTime, 0.045, 0.12, this.musicGain, 900);
      this.nextTime += beat;
      this.step++;
    }
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number, dest: GainNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + Math.min(0.05, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(filter); filter.connect(g); g.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, gain: number, dest: GainNode, cutoff = 2400) {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter); filter.connect(g); g.connect(dest);
    src.start(at);
  }

  private sweep(from: number, to: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(at); osc.stop(at + dur + 0.01);
  }

  play(name: Sfx) {
    if (!this.ctx || !this.sfxGain) return;
    const at = this.ctx.currentTime;
    switch (name) {
      case 'step': this.noise(at, 0.05, 0.05, this.sfxGain, 700); break;
      case 'slash': this.sweep(680, 180, 0.16, 'triangle', 0.22); this.noise(at, 0.09, 0.12, this.sfxGain, 3200); break;
      case 'heavy': this.sweep(320, 80, 0.28, 'sawtooth', 0.28); this.noise(at, 0.16, 0.18, this.sfxGain, 1800); break;
      case 'hit': this.noise(at, 0.11, 0.24, this.sfxGain, 1200); this.sweep(220, 70, 0.12, 'square', 0.14); break;
      case 'hurt': this.sweep(280, 110, 0.24, 'sawtooth', 0.2); break;
      case 'dodge': this.sweep(900, 420, 0.18, 'sine', 0.12); break;
      case 'block': this.sweep(1400, 600, 0.12, 'square', 0.12); break;
      case 'pickup': [660, 880, 1100].forEach((f, i) => this.tone(f, at + i * 0.06, 0.14, 'sine', 0.15, this.sfxGain)); break;
      case 'chest': [392, 523, 659, 784].forEach((f, i) => this.tone(f, at + i * 0.08, 0.3, 'triangle', 0.16, this.sfxGain)); break;
      case 'rune': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, at + i * 0.11, 0.5, 'sine', 0.16, this.sfxGain)); break;
      case 'portal': this.sweep(180, 900, 0.5, 'sine', 0.16); break;
      case 'dialog': this.tone(520, at, 0.05, 'square', 0.04, this.sfxGain); break;
      case 'enemyDie': this.sweep(400, 60, 0.34, 'triangle', 0.18); break;
      case 'bossHit': this.noise(at, 0.2, 0.3, this.sfxGain, 800); this.sweep(160, 50, 0.3, 'sawtooth', 0.24); break;
      case 'bossPhase': [110, 147, 175, 220].forEach((f, i) => this.tone(f, at + i * 0.1, 0.7, 'sawtooth', 0.16, this.sfxGain)); break;
      case 'victory': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, at + i * 0.15, 0.7, 'triangle', 0.2, this.sfxGain)); break;
      case 'switch': this.tone(740, at, 0.12, 'square', 0.12, this.sfxGain); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, at + i * 0.08, 0.4, 'sine', 0.14, this.sfxGain)); break;
      case 'ui': this.tone(440, at, 0.08, 'square', 0.07, this.sfxGain); break;
    }
  }

  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.ctx?.close();
    this.ctx = null;
    this.unlocked = false;
  }
}

export const Audio = new AudioSystem();
