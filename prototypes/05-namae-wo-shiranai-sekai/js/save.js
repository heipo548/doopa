/*
 * save.js — セーブ／ロード（localStorage への往復）
 *
 * 保存するもの：覚えた言葉(words/wordsOrder)・フラグ・持ち物・現在エリア・タイル位置・調べ回数。
 *   遭遇/会話の途中状態（揮発）は保存しない＝安全地点（FIELD）から再開する。
 *
 * 保存先：localStorage。キー "namae_save_v1"（他プロトと衝突しない 05 専用）。
 *
 * ★ 削除はしない（プロジェクト安全方針）：removeItem/delete は使わず「上書き(setItem)」のみ。
 *   clearSave も“空印オブジェクト”の上書きで表す（キーは残すが load は false を返す）。
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提。<script>（…→save→…）で読み、末尾で window へ明示エクスポート。
 */

const SAVE_KEY = "namae_save_v1"; // スキーマを壊す変更をしたら v2 へ
const SAVE_VERSION = 1;

function _hasLocalStorage() {
  try { return typeof localStorage !== "undefined" && localStorage !== null; }
  catch (e) { return false; }
}

// 退室時のタイル位置を game.pos に反映（app.player があればそこから、無ければ現状維持）。
function _syncPos() {
  if (!game) return;
  if (app && app.player && typeof app.player.x === "number") {
    game.pos = { tx: Math.round(app.player.x), ty: Math.round(app.player.y), dir: app.player.dir || "down" };
  }
}

function saveGame() {
  if (typeof game === "undefined" || !game) return false;
  if (!_hasLocalStorage()) return false;
  _syncPos();

  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    words: JSON.parse(JSON.stringify(game.words || {})),
    wordsOrder: JSON.parse(JSON.stringify(game.wordsOrder || [])),
    flags: JSON.parse(JSON.stringify(game.flags || {})),
    items: JSON.parse(JSON.stringify(game.items || {})),
    currentArea: game.currentArea,
    pos: game.pos ? JSON.parse(JSON.stringify(game.pos)) : null,
    lookProgress: JSON.parse(JSON.stringify(game.lookProgress || {})),
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload)); // 上書き（削除APIは使わない）
    return true;
  } catch (e) {
    return false; // 容量超過/プライベートモード等。落とさず false。
  }
}

function loadGame() {
  if (!_hasLocalStorage()) return false;
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  if (!raw) return false;

  let data = null;
  try { data = JSON.parse(raw); } catch (e) { return false; }
  if (!data || typeof data !== "object" || !data.words) return false; // 空印/不正は失敗扱い（消さない）

  newGame(); // 器を既定値で満たしてから被せる（前方互換の保険）
  if (data.words) game.words = data.words;
  if (data.wordsOrder) game.wordsOrder = data.wordsOrder;
  if (data.flags) game.flags = data.flags;
  if (data.items) game.items = data.items;
  if (typeof data.currentArea !== "undefined") game.currentArea = data.currentArea;
  if (data.pos) game.pos = data.pos;
  if (data.lookProgress) game.lookProgress = data.lookProgress;

  if (typeof window !== "undefined") window.game = game; // 参照を貼り直す
  return true;
}

// セーブの有無（タイトル「つづきから」活性判定）。
function hasSave() {
  if (!_hasLocalStorage()) return false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data && data.words);
  } catch (e) { return false; }
}

// 空印で上書き＝実質クリア（物理削除はしない）。
function clearSave() {
  if (!_hasLocalStorage()) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, cleared: true }));
    return true;
  } catch (e) { return false; }
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.SAVE_KEY = SAVE_KEY;
  window.saveGame = saveGame;
  window.loadGame = loadGame;
  window.hasSave = hasSave;
  window.clearSave = clearSave;
}
