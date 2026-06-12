// WebAudio 合成のみで音を作る (§6)。音声ファイルは一切使わない
// （権利リスクゼロ・差し替え容易、という DEMO_SPEC の方針）。
// ブラウザの自動再生制限があるため、最初のユーザー入力時に resume する。

type BgmKind = "day" | "evening" | "night" | "none";

class AudioClass {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private bgmKind: BgmKind = "none";
  private bgmTimer: number | null = null;
  private bgmNextTime = 0;
  private bgmStep = 0;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** 最初の入力で呼ぶ（自動再生制限の解除） */
  unlock() {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }
  isMuted() {
    return this.muted;
  }

  // ---- 低レベル: 1音鳴らす ----
  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = 0,
    slideTo?: number
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // クリックノイズを避けるため、立ち上がりと減衰を短く付ける
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(g).connect(this.master);
    src.start();
  }

  // ---- SE (§6) ----
  seDecide() {
    this.tone(880, 0.07, "square", 0.06);
  }
  seCancel() {
    this.tone(440, 0.08, "square", 0.05, 0, 330);
  }
  seTick() {
    this.tone(1320, 0.025, "square", 0.025);
  }
  seCursor() {
    this.tone(660, 0.04, "square", 0.04);
  }
  seBump() {
    this.tone(120, 0.06, "triangle", 0.05);
  }
  /** ことば習得: 琴っぽい上昇アルペジオ */
  seLearn() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.3, "triangle", 0.06, i * 0.07));
  }
  seGaugeUp() {
    this.tone(523, 0.18, "sine", 0.07, 0, 784); // ぽわん（上向き）
  }
  seGaugeDown() {
    this.tone(330, 0.2, "sine", 0.06, 0, 196); // しゅん（下向き）
  }
  seNoise() {
    this.noise(0.1, 0.05); // ？？？のホワイトノイズ 0.1秒
  }
  seHeal() {
    [659, 784, 988].forEach((f, i) => this.tone(f, 0.25, "sine", 0.05, i * 0.09));
  }

  // ---- BGM: 短いループを先読みスケジュールで回す（M6・任意要素） ----
  // 音数を少なくしてある理由: 320×180 の小さな世界に対して音が前に出すぎないように。
  setBgm(kind: BgmKind) {
    if (this.bgmKind === kind) return;
    this.bgmKind = kind;
    this.bgmStep = 0;
    if (this.bgmTimer != null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (kind === "none") return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.bgmNextTime = ctx.currentTime + 0.1;
    this.bgmTimer = window.setInterval(() => this.pump(), 120);
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || this.bgmKind === "none") return;
    // ペンタトニック基調。day=明るく / evening=ゆっくり低め / night=さらに疎らに
    const conf = {
      day: { bpm: 104, base: 0, vol: 0.035, melody: [72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 72, 69, 67, 64, 67] },
      evening: { bpm: 84, base: -3, vol: 0.03, melody: [72, 0, 76, 74, 0, 69, 67, 0, 69, 72, 0, 74, 72, 0, 67, 0] },
      night: { bpm: 70, base: -5, vol: 0.025, melody: [72, 0, 0, 76, 0, 0, 74, 0, 67, 0, 0, 69, 0, 0, 64, 0] },
    }[this.bgmKind];
    const beat = 60 / conf.bpm / 2; // 8分音符
    while (this.bgmNextTime < ctx.currentTime + 0.4) {
      const i = this.bgmStep % conf.melody.length;
      const note = conf.melody[i];
      const when = this.bgmNextTime - ctx.currentTime;
      if (note > 0) {
        const f = 440 * Math.pow(2, (note + conf.base - 69) / 12);
        this.tone(f, beat * 1.6, "triangle", conf.vol, when);
      }
      if (i % 4 === 0) {
        const bassNote = (i % 8 === 0 ? 48 : 43) + conf.base;
        const bf = 440 * Math.pow(2, (bassNote - 69) / 12);
        this.tone(bf, beat * 3, "sine", conf.vol * 0.9, when);
      }
      this.bgmNextTime += beat;
      this.bgmStep += 1;
    }
  }
}

export const Sound = new AudioClass();
