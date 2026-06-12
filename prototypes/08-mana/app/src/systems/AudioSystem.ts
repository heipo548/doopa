// AudioSystem — Web Audio API による自動シンセ（SPEC.md §12 J6）
// 外部音源ファイルは使用禁止。波形パラメータはデータ（SE_TABLE）として保持する。

interface SePartial {
  type: OscillatorType;
  ratio: number; // 基音に対する倍率
  gain: number;
}

interface SeDef {
  freq: number;
  attack: number;
  decay: number;
  gain: number;
  sweepTo?: number; // 終端周波数（グリッサンド用・基音倍率）
  partials: SePartial[];
}

// J6: 決定(ポン)/拾得(キン)/命名和音(五度堆積)/失敗(濁った低音)/鐘(減衰サイン+倍音)/彩色(グリッサンド)
const SE_TABLE: Record<string, SeDef> = {
  confirm: {
    freq: 660, attack: 0.005, decay: 0.14, gain: 0.25,
    partials: [{ type: 'triangle', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2, gain: 0.3 }],
  },
  pickup: {
    freq: 1318, attack: 0.002, decay: 0.35, gain: 0.22,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 2.01, gain: 0.4 }],
  },
  fail: {
    freq: 82, attack: 0.01, decay: 0.3, gain: 0.3,
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
    freq: 392, attack: 0.05, decay: 1.1, gain: 0.25, sweepTo: 2.2,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 1.5, gain: 0.5 }],
  },
  bird: {
    freq: 1900, attack: 0.005, decay: 0.12, gain: 0.12, sweepTo: 1.4,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }],
  },
  bark: {
    freq: 240, attack: 0.005, decay: 0.18, gain: 0.3, sweepTo: 0.6,
    partials: [{ type: 'sawtooth', ratio: 1, gain: 0.8 }, { type: 'square', ratio: 0.5, gain: 0.4 }],
  },
  thud: {
    freq: 110, attack: 0.002, decay: 0.2, gain: 0.35, sweepTo: 0.5,
    partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'triangle', ratio: 1.5, gain: 0.3 }],
  },
};

/** 字ごとの固有音色（§9: 結字は構成音の和音として響く）— 五音音階 */
const PENTA = [220, 247.5, 275, 330, 366.7];

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private breezeTimer: number | null = null;

  /** ユーザー操作後に呼ぶ（AudioContext の解禁） */
  unlock(): void {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  se(name: keyof typeof SE_TABLE | string): void {
    const def = SE_TABLE[name];
    if (!def) return;
    this.playDef(def);
  }

  charTone(char: string, delaySec = 0, decay = 0.9): void {
    const code = char.codePointAt(0) ?? 0;
    const freq = PENTA[code % PENTA.length] * (code % 3 === 0 ? 2 : 1);
    this.playDef(
      {
        freq, attack: 0.01, decay, gain: 0.2,
        partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 3, gain: 0.15 }],
      },
      delaySec,
    );
  }

  /** 命名和音（五度堆積）: 構成字の音 ＋ 五度上の倍音 */
  namingChord(chars: string[]): void {
    chars.forEach((c, i) => this.charTone(c, i * 0.09, 1.4));
    const last = chars[chars.length - 1] ?? '名';
    const code = last.codePointAt(0) ?? 0;
    const base = PENTA[code % PENTA.length];
    this.playDef(
      {
        freq: base * 1.5, attack: 0.02, decay: 1.6, gain: 0.16,
        partials: [{ type: 'sine', ratio: 1, gain: 1 }, { type: 'sine', ratio: 1.5, gain: 0.5 }],
      },
      chars.length * 0.09 + 0.05,
    );
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
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(def.gain, t0 + def.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + def.attack + def.decay);
    env.connect(this.masterNode());
    for (const p of def.partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(def.freq * p.ratio, t0);
      if (def.sweepTo) {
        osc.frequency.exponentialRampToValueAtTime(def.freq * p.ratio * def.sweepTo, t0 + def.decay);
      }
      const pg = ctx.createGain();
      pg.gain.value = p.gain;
      osc.connect(pg).connect(env);
      osc.start(t0);
      osc.stop(t0 + def.attack + def.decay + 0.1);
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
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
