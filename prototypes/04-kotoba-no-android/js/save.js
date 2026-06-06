/*
 * save.js — セーブ／ロード（localStorage への往復）
 *
 * なぜ metrics まで保存するのか：
 *   本作の肝は、プレイヤーの“操作の癖”（クリック数・読み飛ばし・カーソル移動）を裏で計測し、
 *   結果画面で“軽いメタ1行”として そっと見透かすこと。途中セーブ→ロードで metrics を
 *   復元しないと、その瞬間に“癖”がリセットされ、見透かしが成立しなくなる。
 *   だから player/flags/currentArea/counters に加えて metrics スナップショットも往復させる。
 *
 * 保存先：localStorage。キーは "kotoba_save_v1"（#03 の wo_rd_save_v1 と衝突しない 04 専用）。
 *
 * ★ 削除はしない（プロジェクト安全方針）：delete系は使わず「上書き(setItem)」だけ。
 *   clearSave も空印オブジェクトの上書きで表現する（キーは残すが load は false）。
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提。<script>（…→save→…）で読み、末尾で window へ明示エクスポート。
 */

const SAVE_KEY = "kotoba_save_v1"; // スキーマを壊す変更をしたら v2 へ
const SAVE_VERSION = 1;

// localStorage の安全ラッパ（file:// やプライベートモードで無い/書けない場合に落ちない）。
function _hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch (e) {
    return false;
  }
}

// slot から実キーを作る（未指定＝既定スロット）。
function _keyFor(slot) {
  if (slot === undefined || slot === null || slot === "") return SAVE_KEY;
  return SAVE_KEY + ":" + String(slot);
}

// metrics の“生カウンタ”を素直にコピー（途中状態 _curBlock* も含め、ロード後も継続できる）。
function _snapshotMetrics() {
  if (typeof metrics === "undefined" || !metrics) return null;
  return {
    clicks: metrics.clicks,
    cursorDist: metrics.cursorDist,
    skips: metrics.skips,
    blocksShown: metrics.blocksShown,
    blocksSkipped: metrics.blocksSkipped,
    dwellTotalMs: metrics.dwellTotalMs,
    startedAt: metrics.startedAt,
    _curBlockStart: metrics._curBlockStart,
    _curBlockChars: metrics._curBlockChars,
    _blockOpen: metrics._blockOpen,
  };
}

// 保存しておいた metrics を現在の metrics へ上書き復元（“癖”を丸ごと差し戻す）。
function _restoreMetrics(snap) {
  if (typeof metrics === "undefined" || !metrics || !snap) return;
  metrics.clicks = snap.clicks || 0;
  metrics.cursorDist = snap.cursorDist || 0;
  metrics.skips = snap.skips || 0;
  metrics.blocksShown = snap.blocksShown || 0;
  metrics.blocksSkipped = snap.blocksSkipped || 0;
  metrics.dwellTotalMs = snap.dwellTotalMs || 0;
  metrics.startedAt = snap.startedAt || 0;
  metrics._curBlockStart = snap._curBlockStart || 0;
  metrics._curBlockChars = snap._curBlockChars || 0;
  metrics._blockOpen = !!snap._blockOpen;
}

// ──────────────────────────────────────────
// セーブ：現ランの“続きに必要なもの”を1オブジェクトにまとめて保存。
//   戻り値：成功 true / 失敗 false。
//   battle/pendingCards/dialogue 等の揮発状態は保存しない（復帰は FIELD の安全地点から）。
// ──────────────────────────────────────────
function saveGame(slot) {
  if (typeof game === "undefined" || !game) return false;
  if (!_hasLocalStorage()) return false;

  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    // player はまるごと（cards=覚えたことばとLv / tendency=凶暴・優しさ / hp / 名前）を deep copy。
    player: JSON.parse(JSON.stringify(game.player)),
    flags: JSON.parse(JSON.stringify(game.flags || {})),
    currentArea: game.currentArea,
    counters: JSON.parse(JSON.stringify(game.counters || {})),
    state: game.state,
    metrics: _snapshotMetrics(), // ← 本作のセーブの肝（メタ演出の継続性）
  };

  try {
    localStorage.setItem(_keyFor(slot), JSON.stringify(payload)); // 上書き（削除APIは使わない）
    return true;
  } catch (e) {
    return false; // 容量超過/プライベートモード等。落とさず false。
  }
}

// ──────────────────────────────────────────
// ロード：保存データを読み、game と metrics の両方を復元する。
//   方式：まず newGame() で器を作り直し、その上に保存値を被せる（前方互換の保険）。
// ──────────────────────────────────────────
function loadGame(slot) {
  if (!_hasLocalStorage()) return false;

  let raw = null;
  try {
    raw = localStorage.getItem(_keyFor(slot));
  } catch (e) {
    return false;
  }
  if (!raw) return false;

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return false; // 壊れた/古い不正データはロード失敗扱い（上書きはしない＝消さない）
  }
  if (!data || typeof data !== "object") return false;
  if (!data.player) return false; // 空印（clearSave）や不完全データは失敗扱い

  newGame(); // 器を既定値で満たす

  if (data.player) game.player = data.player;
  if (data.flags) game.flags = data.flags;
  if (typeof data.currentArea !== "undefined") game.currentArea = data.currentArea;
  if (data.counters) game.counters = data.counters;
  if (typeof data.state !== "undefined") game.state = data.state;

  _restoreMetrics(data.metrics); // “癖”を復元（メタ演出が途切れない）

  if (typeof window !== "undefined") window.game = game; // const game を差し替えたので参照を貼り直す

  return true;
}

// セーブの有無（タイトルの「つづきから」活性判定）。
function hasSave(slot) {
  if (!_hasLocalStorage()) return false;
  try {
    const raw = localStorage.getItem(_keyFor(slot));
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data && data.player); // 空印は“無し”扱い
  } catch (e) {
    return false;
  }
}

// 既存セーブの一覧（将来の複数スロット用）。壊れたデータも“存在はする”形で返す（消さない）。
function listSaves() {
  const out = [];
  if (!_hasLocalStorage()) return out;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const isDefault = key === SAVE_KEY;
      const isSlot = key.indexOf(SAVE_KEY + ":") === 0;
      if (!isDefault && !isSlot) continue;
      const slot = isDefault ? null : key.slice((SAVE_KEY + ":").length);
      let savedAt = null, currentArea = null;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && typeof data === "object") {
          savedAt = data.savedAt || null;
          currentArea = (typeof data.currentArea !== "undefined") ? data.currentArea : null;
        }
      } catch (e) {}
      out.push({ slot: slot, key: key, savedAt: savedAt, currentArea: currentArea });
    }
  } catch (e) {
    return out;
  }
  out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return out;
}

// セーブを“空印で上書き”して実質クリア（removeItem は使わない＝物理削除しない方針）。
function clearSave(slot) {
  if (!_hasLocalStorage()) return false;
  try {
    localStorage.setItem(_keyFor(slot), JSON.stringify({ version: SAVE_VERSION, cleared: true }));
    return true;
  } catch (e) {
    return false;
  }
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.SAVE_KEY = SAVE_KEY;
  window.saveGame = saveGame;
  window.loadGame = loadGame;
  window.hasSave = hasSave;
  window.listSaves = listSaves;
  window.clearSave = clearSave;
}
