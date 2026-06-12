// オートセーブのみ (§4.7)。手動セーブUIは存在しない。
// 契機: 各イベント E0〜E7 の完了時と visibilitychange。
// localStorage を消せば完全初期状態に戻ることが仕様 (§13)。
import { G, type GameSaveData } from "./wordSystem";

const KEY = "lastfriend.save.v1";

interface SaveFile {
  cleared: boolean; // 体験版クリア済みか（タイトルの？？？解禁に使う）
  game: GameSaveData | null;
}

function read(): SaveFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SaveFile;
  } catch {
    /* 壊れたセーブは無かったことにする（初期状態へ） */
  }
  return { cleared: false, game: null };
}

export const Save = {
  hasGame(): boolean {
    return read().game != null;
  },
  isCleared(): boolean {
    return read().cleared;
  },

  /** 現在の G の状態を書き込む */
  write() {
    const f = read();
    f.game = G.toJSON();
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* noop */
    }
  },

  markCleared() {
    const f = read();
    f.cleared = true;
    f.game = G.toJSON();
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* noop */
    }
  },

  /** つづきから。読み込めたら true */
  loadIntoG(): boolean {
    const f = read();
    if (!f.game) return false;
    G.loadFrom(f.game);
    return true;
  },

  /** はじめから。クリア記録（？？？解禁）は残し、進行だけ消す */
  newGame() {
    G.reset();
    const f = read();
    f.game = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* noop */
    }
  },

  /** デバッグ用の完全削除 */
  wipe() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
};

// タブを閉じる・切り替える瞬間にも取りこぼさない
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && G.hasFlag("game_started")) {
    Save.write();
  }
});
