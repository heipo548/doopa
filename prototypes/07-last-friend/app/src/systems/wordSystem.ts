// ゲーム全体の状態（習得語・フラグ・こころ・現在地）と learnWord() の本体。
// Phaser に依存させない理由: データ検証やセーブ処理を UI と切り離してテスト
// しやすくするため。シーンへの通知は小さな自前イベントで行う。
import type { Cond, DayPhase } from "../types";
import { WORDS } from "../data/words";

type Handler = (...args: unknown[]) => void;

class MiniEmitter {
  private handlers: Record<string, Handler[]> = {};
  on(ev: string, fn: Handler) {
    (this.handlers[ev] ??= []).push(fn);
  }
  off(ev: string, fn: Handler) {
    this.handlers[ev] = (this.handlers[ev] ?? []).filter((h) => h !== fn);
  }
  emit(ev: string, ...args: unknown[]) {
    for (const fn of this.handlers[ev] ?? []) fn(...args);
  }
}

export interface LearnedMeta {
  src: string; // ノートに出す「どこで おぼえたか」
  order: number; // 習得順（ノートの並び）
}

class GameStateClass {
  readonly events = new MiniEmitter();

  learned = new Set<string>();
  learnedMeta: Record<string, LearnedMeta> = {};
  flags = new Set<string>();
  kokoro = { kind: 0, dark: 0 }; // 体験版は2軸の簡易版 (§10)。本編で3軸(+sad)に拡張する。
  phase: DayPhase = "day";
  map = "hill";
  x = 10; // タイル座標
  y = 2;

  // ---- ことば ----
  hasWord(id: string): boolean {
    return this.learned.has(id);
  }

  /** 習得できる状態か（未習得かつ前提語クリア） */
  canLearn(id: string): boolean {
    const w = WORDS[id];
    if (!w || this.learned.has(id)) return false;
    return (w.prereq ?? []).every((p) => this.learned.has(p));
  }

  /**
   * ことばを習得する。実際に習得したら true。
   * 既知・前提不足なら false（イベント側はその場合演出を出さない）。
   */
  learnWord(id: string, src: string): boolean {
    if (!this.canLearn(id)) return false;
    this.learned.add(id);
    this.learnedMeta[id] = { src, order: this.learned.size };
    this.events.emit("learn", id, src);
    return true;
  }

  // ---- フラグ ----
  hasFlag(f: string): boolean {
    return this.flags.has(f);
  }
  setFlag(f: string) {
    if (!this.flags.has(f)) {
      this.flags.add(f);
      this.events.emit("flag", f);
    }
  }

  // ---- 条件評価（会話・出現・ゾーンの共通分岐） ----
  checkCond(c?: Cond): boolean {
    if (!c) return true;
    if (c.hasWord && !this.hasWord(c.hasWord)) return false;
    if (c.hasWords && !c.hasWords.every((w) => this.hasWord(w))) return false;
    if (c.notWord && this.hasWord(c.notWord)) return false;
    if (c.flag && !this.hasFlag(c.flag)) return false;
    if (c.notFlag && this.hasFlag(c.notFlag)) return false;
    if (c.phase && this.phase !== c.phase) return false;
    if (c.kokoroDarkAtLeast !== undefined && this.kokoro.dark < c.kokoroDarkAtLeast) return false;
    return true;
  }
  checkConds(cs?: Cond[]): boolean {
    return (cs ?? []).every((c) => this.checkCond(c));
  }

  setPhase(p: DayPhase) {
    if (this.phase !== p) {
      this.phase = p;
      this.events.emit("phase", p);
    }
  }

  /** はじめから 用の完全リセット */
  reset() {
    this.learned = new Set();
    this.learnedMeta = {};
    this.flags = new Set();
    this.kokoro = { kind: 0, dark: 0 };
    this.phase = "day";
    this.map = "hill";
    this.x = 10;
    this.y = 2;
  }

  toJSON() {
    return {
      learned: [...this.learned],
      learnedMeta: this.learnedMeta,
      flags: [...this.flags],
      kokoro: { ...this.kokoro },
      phase: this.phase,
      map: this.map,
      x: this.x,
      y: this.y,
    };
  }

  loadFrom(d: ReturnType<GameStateClass["toJSON"]>) {
    this.learned = new Set(d.learned);
    this.learnedMeta = d.learnedMeta ?? {};
    this.flags = new Set(d.flags);
    this.kokoro = { kind: d.kokoro?.kind ?? 0, dark: d.kokoro?.dark ?? 0 };
    this.phase = d.phase ?? "day";
    this.map = d.map ?? "hill";
    this.x = d.x ?? 10;
    this.y = d.y ?? 2;
  }
}

// シングルトン。ゲーム中はどこからでも G を参照する。
export const G = new GameStateClass();
export type GameSaveData = ReturnType<GameStateClass["toJSON"]>;
