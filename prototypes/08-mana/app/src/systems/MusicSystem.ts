// MusicSystem — ゾーン連動の生成BGMエンジン
// 楽譜ファイルも音源ファイルも持たない。A の陰旋法（ひらじょうし）を土台に、
// 琴（Karplus-Strong）・笛（正弦＋ビブラート＋息ノイズ）・太鼓・ドローンを
// 先読みスケジューラで確率的に紡ぐ。ムードはゾーンとゲーム進行で切り替わる。

import type { AudioSystem } from './AudioSystem';

export type MusicMood =
  | 'none'
  | 'title'
  | 'village'
  | 'dark'
  | 'river'
  | 'hill'
  | 'shrine'
  | 'boss'
  | 'celebrate';

interface DroneSpec {
  freq: number;
  type: OscillatorType;
  gain: number;
}

// A 陰旋法（A C D E F）を3オクターブ
const SCALE = [110, 130.81, 146.83, 164.81, 174.61, 220, 261.63, 293.66, 329.63, 349.23, 440, 523.25, 587.33];
// 彩色後だけ長旋法（A B C# E F#）に転じて世界が明るくなる
const SCALE_MAJOR = [110, 123.47, 138.59, 164.81, 185, 220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37];

const DRONES: Record<MusicMood, DroneSpec[]> = {
  none: [],
  title: [
    { freq: 110, type: 'sine', gain: 0.022 },
    { freq: 164.81, type: 'sine', gain: 0.012 },
  ],
  village: [{ freq: 110, type: 'sine', gain: 0.018 }],
  dark: [
    { freq: 73.42, type: 'sine', gain: 0.03 },
    { freq: 110, type: 'triangle', gain: 0.012 },
  ],
  river: [{ freq: 110, type: 'sine', gain: 0.014 }],
  hill: [
    { freq: 110, type: 'triangle', gain: 0.014 },
    { freq: 164.81, type: 'triangle', gain: 0.012 },
  ],
  shrine: [
    { freq: 110, type: 'sine', gain: 0.02 },
    { freq: 116.54, type: 'sine', gain: 0.008 },
  ],
  boss: [
    { freq: 82.41, type: 'sine', gain: 0.032 },
    { freq: 87.31, type: 'sine', gain: 0.022 },
  ],
  celebrate: [
    { freq: 110, type: 'sine', gain: 0.018 },
    { freq: 220, type: 'sine', gain: 0.01 },
    { freq: 329.63, type: 'sine', gain: 0.006 },
  ],
};

// 村の主題（32歩・八分音符格子）: [step, scale度数, 確率, 音量]
const VILLAGE_MOTIF: [number, number, number, number][] = [
  [0, 5, 0.95, 0.16], [5, 6, 0.5, 0.1], [6, 7, 0.85, 0.13], [10, 8, 0.6, 0.12],
  [14, 6, 0.7, 0.1], [16, 5, 0.9, 0.14], [22, 3, 0.6, 0.1], [24, 9, 0.4, 0.1],
  [27, 7, 0.4, 0.08], [30, 5, 0.3, 0.08],
];
// 彩色後の主題（少し歌う）
const CELEBRATE_MOTIF: [number, number, number, number][] = [
  [0, 5, 1, 0.16], [3, 7, 0.8, 0.12], [6, 8, 0.95, 0.15], [9, 9, 0.6, 0.11],
  [12, 10, 0.85, 0.15], [16, 9, 0.8, 0.12], [19, 8, 0.7, 0.11], [22, 7, 0.8, 0.12],
  [24, 5, 0.9, 0.14], [28, 6, 0.5, 0.1], [30, 7, 0.5, 0.1],
];

export class MusicSystem {
  private audio: AudioSystem;
  private bus: GainNode | null = null;
  private timer: number | null = null;
  private mood: MusicMood = 'none';
  private drones: { osc: OscillatorNode; g: GainNode }[] = [];
  private step = 0;
  private nextTime = 0;
  private readonly stepDur = 60 / 63 / 2; // 八分音符 @63bpm

  constructor(audio: AudioSystem) {
    this.audio = audio;
  }

  start(): void {
    if (this.timer !== null) return;
    const { ctx, out } = this.audio.bus();
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(out);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.rebuildDrones();
  }

  current(): MusicMood {
    return this.mood;
  }

  /** ボスのフェーズ転換などに撃つ早弾き */
  stinger(descend = false): void {
    const { ctx } = this.audio.bus();
    const t = ctx.currentTime;
    const notes = descend ? [10, 8, 6, 5] : [5, 6, 8, 10];
    notes.forEach((d, i) => this.audio.pluck(SCALE[d], t + i * 0.07, 0.2));
  }

  // ---- internal ----

  private schedule(): void {
    const { ctx } = this.audio.bus();
    if (ctx.state === 'suspended' || this.mood === 'none') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.45) {
      this.playStep(this.step % 32, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }

  private playStep(step: number, t: number): void {
    switch (this.mood) {
      case 'title':
        if (Math.random() < 0.035) this.audio.pluck(SCALE[this.pick([0, 2, 5, 6])], t, 0.1);
        break;
      case 'village':
        this.motif(VILLAGE_MOTIF, SCALE, step, t);
        if (step % 2 === 1 && Math.random() < 0.05) this.audio.pluck(SCALE[this.pick([7, 8, 9])], t, 0.05);
        break;
      case 'river':
        this.motif(VILLAGE_MOTIF, SCALE, step, t);
        if (step % 4 === 2 && Math.random() < 0.5) {
          this.audio.pluck(SCALE[this.pick([8, 9, 10, 11])], t, 0.06);
        }
        break;
      case 'hill':
        if (Math.random() < 0.05) this.audio.pluck(SCALE[this.pick([6, 8, 10])], t, 0.08);
        if (step === 0 && Math.random() < 0.55) this.flute(SCALE[this.pick([8, 9, 10])], t, 2.4);
        break;
      case 'dark':
        if (Math.random() < 0.04) this.audio.pluck(SCALE[this.pick([0, 1, 3])], t, 0.09);
        if (step === 16 && Math.random() < 0.35) this.audio.pluck(SCALE[11], t, 0.05);
        break;
      case 'shrine':
        if (step === 0 || step === 20) this.audio.se('taiko');
        if (Math.random() < 0.05) this.audio.pluck(SCALE[this.pick([5, 6, 8])], t, 0.07);
        break;
      case 'boss':
        if ([0, 6, 8, 12, 16, 22, 24, 28].includes(step)) this.audio.se('taiko');
        if (Math.random() < 0.07) {
          // 三連の早弾きで焦燥感
          for (let i = 0; i < 3; i++) this.audio.pluck(SCALE[this.pick([5, 6, 7])], t + i * 0.055, 0.1);
        }
        break;
      case 'celebrate':
        this.motif(CELEBRATE_MOTIF, SCALE_MAJOR, step, t);
        if (step === 8 && Math.random() < 0.4) this.flute(SCALE_MAJOR[this.pick([9, 10, 11])], t, 2.6);
        if (step % 8 === 4 && Math.random() < 0.3) this.audio.pluck(SCALE_MAJOR[12], t, 0.05);
        break;
      case 'none':
        break;
    }
  }

  private pick(degrees: number[]): number {
    return degrees[Math.floor(Math.random() * degrees.length)];
  }

  private motif(
    rows: [number, number, number, number][],
    scale: number[],
    step: number,
    t: number,
  ): void {
    for (const [s, deg, p, g] of rows) {
      if (s === step && Math.random() < p) this.audio.pluck(scale[deg], t, g);
    }
  }

  /** 笛: 正弦＋ゆるいビブラート＋息のノイズ */
  private flute(freq: number, t: number, dur: number): void {
    const { ctx } = this.audio.bus();
    if (!this.bus) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.05, t + 0.35);
    env.gain.setValueAtTime(0.05, t + dur - 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(this.bus);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.6;
    const lfoG = ctx.createGain();
    lfoG.gain.value = freq * 0.012;
    lfo.connect(lfoG).connect(osc.frequency);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.1);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }

  private rebuildDrones(): void {
    const { ctx } = this.audio.bus();
    // 旧ドローンをゆっくり落として止める
    for (const d of this.drones) {
      d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      d.osc.stop(ctx.currentTime + 2.2);
    }
    this.drones = [];
    if (!this.bus) return;
    for (const spec of DRONES[this.mood]) {
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = spec.freq;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(spec.gain, ctx.currentTime, 1.1);
      osc.connect(g).connect(this.bus);
      osc.start();
      this.drones.push({ osc, g });
    }
  }
}
