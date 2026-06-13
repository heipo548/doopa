// AudioSystem — Web Audio API による自動シンセ（SPEC.md §12 J6）
// 外部音源ファイルは使用禁止。波形パラメータはデータ（SE_TABLE）として保持する。
// 琴の爪弾きは Karplus-Strong 合成（ノイズ励起＋短い遅延ループ）をオフライン生成してキャッシュする。

interface SePartial {
  type: OscillatorType;
  ratio: number; // 基音に対する倍率
  gain: number;
}

interface SeNoise {
  gain: number;
  filter: 'bandpass' | 'lowpass' | 'highpass';
  freq: number;
  q?: number;
  sweepTo?: number; // フィルタ周波数の終端倍率
}

interface SeDef {
  freq: number;
  attack: number;
  decay: number;
  gain: number;
  sweepTo?: number; // 発振周波数の終端倍率（グリッサンド）
  jitter?: number; // 再生ごとの周波数ゆらぎ（0-1）
  partials: SePartial[];
  noise?: SeNoise;
}

// J6: 決定(ポン)/拾得(キン)/命名和音(五度堆積)/失敗(濁った低音)/鐘(減衰サイン+倍音)/彩色(グリッサンド)
// ＋ 演出強化分: 足音・筆・紙・烏・突風・刻印・太鼓 ほか
const SE_TABLE: Record<string, SeDef> = {
  confirm: {
    freq: 660, attack: 0.005, decay: 0.14, gain: 0.22,
    partials: [{ type: 'triangle', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 0.3 }],
  },
  pickup: {
    freq: 1318, attack: 0.002, decay: 0.35, gain: 0.2,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2.01, gain: 0.4 }],
  },
  fail: {
    freq: 82, attack: 0.01, decay: 0.3, gain: 0.28,
    partials: [{ type: 'square', ratio: 1, gain: 0.7 }, { type: 'sawtooth', ratio: 1.06, gain: 0.5 }],
  },
  bell: {
    freq: 196, attack: 0.002, decay: 3.6, gain: 0.5,
    partials: [
      { type: 'sine', ratio: 1, gain: 1 },
      { type: 'sine', ratio: 2.76, gain: 0.55 },
      { type: 'sine', ratio: 5.4, gain: 0.3 },
      { type: 'sine', ratio: 8.93, gain: 0.12 },
    ],
  },
  colorize: {
    freq: 392, attack: 0.05, decay: 1.1, gain: 0.22, sweepTo: 2.2,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 1.5, gain: 0.5 }],
  },
  bird: {
    freq: 1900, attack: 0.005, decay: 0.12, gain: 0.1, sweepTo: 1.4, jitter: 0.1,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }],
  },
  bark: {
    freq: 240, attack: 0.005, decay: 0.18, gain: 0.28, sweepTo: 0.6,
    partials: [{ type: 'sawtooth', ratio: 1, gain: 0.8 }, { type: 'square', ratio: 0.5, gain: 0.4 }],
  },
  thud: {
    freq: 110, attack: 0.002, decay: 0.2, gain: 0.32, sweepTo: 0.5,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'triangle', ratio: 1.5, gain: 0.3 }],
  },
  // ---- 演出強化分 ----
  step: {
    freq: 92, attack: 0.002, decay: 0.07, gain: 0.07, jitter: 0.18, sweepTo: 0.7,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }],
    noise: { gain: 0.25, filter: 'lowpass', freq: 600 },
  },
  brush: {
    freq: 0, attack: 0.03, decay: 0.3, gain: 0.18,
    partials: [],
    noise: { gain: 1, filter: 'bandpass', freq: 2600, q: 0.7, sweepTo: 0.35 },
  },
  paper: {
    freq: 2300, attack: 0.001, decay: 0.04, gain: 0.08, jitter: 0.2,
    partials: [{ type: 'triangle', ratio: 1, gain: 0.6 }],
    noise: { gain: 0.8, filter: 'highpass', freq: 2800 },
  },
  caw: {
    freq: 760, attack: 0.01, decay: 0.22, gain: 0.16, sweepTo: 0.45,
    partials: [{ type: 'sawtooth', ratio: 1, gain: 0.8 }, { type: 'square', ratio: 1.5, gain: 0.2 }],
    noise: { gain: 0.25, filter: 'bandpass', freq: 1400, q: 2 },
  },
  gust: {
    freq: 0, attack: 0.25, decay: 0.7, gain: 0.16,
    partials: [],
    noise: { gain: 1, filter: 'bandpass', freq: 460, q: 0.8, sweepTo: 1.8 },
  },
  stamp: {
    freq: 130, attack: 0.002, decay: 0.16, gain: 0.3, sweepTo: 0.6,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }],
    noise: { gain: 0.5, filter: 'lowpass', freq: 900 },
  },
  taiko: {
    freq: 84, attack: 0.003, decay: 0.42, gain: 0.4, sweepTo: 0.55,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'triangle', ratio: 1.8, gain: 0.12 }],
    noise: { gain: 0.3, filter: 'lowpass', freq: 500 },
  },
  tick: {
    freq: 1700, attack: 0.001, decay: 0.02, gain: 0.035, jitter: 0.25,
    partials: [{ type: 'square', ratio: 1, gain: 0.6 }],
  },
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private breezeTimer: number | null = null;
  private ksCache = new Map<number, AudioBuffer>();
  muted = false;

  /** ユーザー操作後に呼ぶ（AudioContext の解禁） */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  /** BGM エンジン（MusicSystem）が同じ出力に乗るためのバス */
  bus(): { ctx: AudioContext; out: GainNode } {
    this.ensure();
    return { ctx: this.ctx as AudioContext, out: this.master as GainNode };
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    const ctx = this.ensure();
    this.masterNode().gain.setTargetAtTime(this.muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return this.muted;
  }

  se(name: keyof typeof SE_TABLE | string): void {
    const def = SE_TABLE[name];
    if (!def) return;
    this.playDef(def);
  }

  /** 琴の爪弾き（Karplus-Strong）。when は AudioContext 時刻（0=即時） */
  pluck(freq: number, when = 0, gain = 0.22): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;
    const t0 = when > 0 ? when : ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.ksBuffer(freq);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(freq * 9, 7800), t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 300), t0 + 0.9);
    src.connect(lp).connect(g).connect(this.masterNode());
    src.start(t0);
  }

  /** 字ごとの固有音色（五音音階を爪弾きで） */
  charTone(char: string, delaySec = 0, _decay = 0.9): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;
    this.pluck(this.charFreq(char), ctx.currentTime + delaySec, 0.18);
  }

  charFreq(char: string): number {
    // A 陰旋法（ヒラジョーシ）: A C D E F
    const SCALE = [220, 261.63, 293.66, 329.63, 349.23];
    const code = char.codePointAt(0) ?? 0;
    return SCALE[code % SCALE.length] * (code % 3 === 0 ? 2 : 1);
  }

  /** 命名和音（五度堆積）: 構成字の爪弾き ＋ 五度上の余韻 */
  namingChord(chars: string[]): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    chars.forEach((c, i) => this.pluck(this.charFreq(c), t + i * 0.11, 0.22));
    const last = chars[chars.length - 1] ?? '名';
    this.pluck(this.charFreq(last) * 1.5, t + chars.length * 0.11 + 0.06, 0.14);
    this.playDef(
      {
        freq: this.charFreq(last), attack: 0.04, decay: 1.8, gain: 0.07,
        partials: [{ type: 'sine', ratio: 2, gain: 1 }, { type: 'sine', ratio: 3, gain: 0.4 }],
      },
      chars.length * 0.11 + 0.1,
    );
  }

  /** 解決ファンファーレ（短い五音の駆け上がり） */
  solveJingle(): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;
    const t = ctx.currentTime;
    [220, 293.66, 329.63, 440].forEach((f, i) => this.pluck(f, t + i * 0.09, 0.18));
  }

  /** 嵐の風（P4）。level 0-1 */
  setWind(level: number): void {
    if (level <= 0) {
      if (this.windSrc) {
        try {
          this.windSrc.stop();
        } catch {
          /* already stopped */
        }
        this.windSrc = null;
      }
      return;
    }
    const ctx = this.ensure();
    if (!this.windSrc) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.8;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(filter).connect(this.windGain).connect(this.masterNode());
      src.start();
      this.windSrc = src;
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(Math.min(level, 1) * 0.25, ctx.currentTime, 0.15);
    }
  }

  /** 彩色後の環境音: そよ風＋ときどき鳥（§7-8「無音→鳥と風」） */
  startBreeze(): void {
    this.stopBreeze();
    const ctx = this.ensure();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    src.connect(filter).connect(g).connect(this.masterNode());
    src.start();
    this.breezeTimer = window.setInterval(() => {
      if (Math.random() < 0.6) {
        this.se('bird');
        window.setTimeout(() => this.se('bird'), 140);
      }
    }, 3200);
  }

  stopBreeze(): void {
    if (this.breezeTimer !== null) {
      window.clearInterval(this.breezeTimer);
      this.breezeTimer = null;
    }
  }

  // ---- internal ----

  private playDef(def: SeDef, delaySec = 0): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') return;
    const t0 = ctx.currentTime + delaySec;
    const jitter = def.jitter ? 1 + (Math.random() * 2 - 1) * def.jitter : 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(def.gain, t0 + def.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + def.attack + def.decay);
    env.connect(this.masterNode());
    for (const p of def.partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(def.freq * p.ratio * jitter, t0);
      if (def.sweepTo) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, def.freq * p.ratio * jitter * def.sweepTo),
          t0 + def.decay,
        );
      }
      const pg = ctx.createGain();
      pg.gain.value = p.gain;
      osc.connect(pg).connect(env);
      osc.start(t0);
      osc.stop(t0 + def.attack + def.decay + 0.1);
    }
    if (def.noise) {
      const n = def.noise;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = n.filter;
      filter.frequency.setValueAtTime(n.freq * jitter, t0);
      if (n.sweepTo) {
        filter.frequency.exponentialRampToValueAtTime(n.freq * jitter * n.sweepTo, t0 + def.decay);
      }
      if (n.q) filter.Q.value = n.q;
      const ng = ctx.createGain();
      ng.gain.value = n.gain;
      src.connect(filter).connect(ng).connect(env);
      src.start(t0);
      src.stop(t0 + def.attack + def.decay + 0.1);
    }
  }

  /** Karplus-Strong をオフライン計算してキャッシュ */
  private ksBuffer(freq: number): AudioBuffer {
    const key = Math.round(freq);
    const hit = this.ksCache.get(key);
    if (hit) return hit;
    const ctx = this.ensure();
    const sr = ctx.sampleRate;
    const dur = 1.6;
    const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    const damp = 0.9955;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % period];
      data[i] = cur;
      ring[idx] = damp * 0.5 * (cur + next);
      idx = (idx + 1) % period;
    }
    this.ksCache.set(key, buf);
    return buf;
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private masterNode(): GainNode {
    this.ensure();
    return this.master as GainNode;
  }

  private noiseCache: AudioBuffer | null = null;

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseCache) return this.noiseCache;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseCache = buf;
    return buf;
  }
}
