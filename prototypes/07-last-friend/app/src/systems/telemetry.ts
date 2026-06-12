// 行動ログ (§4.6)。
// このデータはローカル保存のみ。外部送信は本プロジェクトでは永久に禁止
// （コンテスト応募書類の AI・権利関連開示でも明示する設計思想）。
// ゲーム中は一切表示しない。使うのは E6 のかみさまの一行と F1 デバッグだけ。
const KEY = "lastfriend.telemetry.v1";

export interface TelemetryData {
  playMs: number;
  sessions: number;
  keyPresses: number;
  clicks: number;
  steps: number;
  examines: number;
  dialogueAdvances: number;
  wordsLearned: { id: string; at: number; source: string }[];
  battlesWon: number;
  idleMs: number; // 60秒以上無入力だった時間の累積
}

function blank(): TelemetryData {
  return {
    playMs: 0,
    sessions: 0,
    keyPresses: 0,
    clicks: 0,
    steps: 0,
    examines: 0,
    dialogueAdvances: 0,
    wordsLearned: [],
    battlesWon: 0,
    idleMs: 0,
  };
}

class TelemetryClass {
  data: TelemetryData = blank();
  private lastTick = 0;
  private lastInput = 0;
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...blank(), ...JSON.parse(raw) };
    } catch {
      this.data = blank();
    }
    this.data.sessions += 1;
    const now = performance.now();
    this.lastTick = now;
    this.lastInput = now;

    // 入力カウントは window 直付け。シーンをまたいでも数え漏らさないため。
    window.addEventListener("keydown", () => {
      this.data.keyPresses += 1;
      this.touch();
    });
    window.addEventListener("pointerdown", () => {
      this.data.clicks += 1;
      this.touch();
    });
    // 5秒ごと＋タブ非表示時に保存 (§4.6)
    setInterval(() => this.tick(), 5000);
    document.addEventListener("visibilitychange", () => {
      this.tick();
    });
  }

  private touch() {
    this.lastInput = performance.now();
  }

  private tick() {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    this.data.playMs += dt;
    // 60秒を超えて無入力なら、その経過分を idle として積む
    if (now - this.lastInput > 60_000) this.data.idleMs += dt;
    this.save();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* localStorage が使えない環境では黙ってあきらめる（ゲームは続行） */
    }
  }

  step() {
    this.data.steps += 1;
  }
  examine() {
    this.data.examines += 1;
  }
  advance() {
    this.data.dialogueAdvances += 1;
  }
  learned(id: string, source: string) {
    this.data.wordsLearned.push({ id, at: Date.now(), source });
  }
  battleWon() {
    this.data.battlesWon += 1;
  }

  wipe() {
    this.data = blank();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  }
}

export const Telemetry = new TelemetryClass();
