/*
 * save.js — 設定と「いくつもの夜」の進行を localStorage に永続化する（v0.13 システム底上げ）
 *
 * なぜ：これまでは リロード/再訪で すべて消えた＝“試作”の手触り。
 *   roguelite のメタ進行（街の灯り・覚えたことば・周回の記憶）と 設定（音/モーション/文字）を
 *   セッションをまたいで残し、“製品”の手触りへ一段 引き上げる。
 *
 * 方針（Web の定石）：
 *   - localStorage は 5〜10MB。本作のセーブは数KB＝余裕。文字列化して保存。
 *   - 失敗（プライベートモード・未対応・JXA検証環境）は try/catch で黙って無視＝ゲームは無セーブでも動く。
 *   - こまめに書きすぎない（街に戻る/結末/設定変更/離脱時 だけ）。離脱(visibilitychange)でも保存。
 *   - версия（v）を持たせ、将来 形式が変わっても 読み分けられるように。
 *
 * ※ meta（state.js のグローバル）は プレーンなデータだけ＝そのまま JSON 化できる。
 */

var SAVE_KEY = "saigo.save.v1";
var SETTINGS_KEY = "saigo.settings.v1";

// プレイヤー設定（アクセシビリティ）。既定はすべて OFF。
var SETTINGS = { muted: false, reduceMotion: false, bigText: false };

// ── 設定の保存/読み込み ──
function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s && typeof s === "object") {
      if (typeof s.muted === "boolean") SETTINGS.muted = s.muted;
      if (typeof s.reduceMotion === "boolean") SETTINGS.reduceMotion = s.reduceMotion;
      if (typeof s.bigText === "boolean") SETTINGS.bigText = s.bigText;
    }
  } catch (e) { /* 無設定でOK */ }
  return SETTINGS;
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) {}
}

// 設定を 画面/音 に反映（boot 時・変更時に呼ぶ）。
function applySettings() {
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("reduce-motion", !!SETTINGS.reduceMotion);
    document.body.classList.toggle("big-text", !!SETTINGS.bigText);
  }
  if (typeof setMuted === "function") setMuted(!!SETTINGS.muted);
}

// ── 進行（メタ）の保存/読み込み ──
//   保存ポイントは「街」と「結末」＝夜の途中（戦闘中）の中断復帰は持たない（roguelite の節目で保存）。
function saveProgress() {
  try {
    if (typeof meta === "undefined" || !meta) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, meta: meta }));
  } catch (e) {}
}
function loadProgress() {
  try {
    var d = JSON.parse(localStorage.getItem(SAVE_KEY));
    // 旅の途中（night <= maxNights）だけ「つづき」として扱う＝結末を越えた完了状態は復元しない（壊れ防止）。
    if (d && d.meta && typeof d.meta.night === "number" && d.meta.night <= (d.meta.maxNights || 3)) return d.meta;
  } catch (e) {}
  return null;
}
function hasSave() { return !!loadProgress(); }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

// セーブの要約（タイトルの「つづきから」表示用）。無ければ null。
function saveSummary() {
  var m = loadProgress();
  if (!m) return null;
  var friends = (m.friends && m.friends.length) || 0;
  var nightLabel = (m.night >= (m.maxNights || 3)) ? "さいごの夜" : ((m.night || 1) + "夜目");
  return { night: m.night || 1, nightLabel: nightLabel, friends: friends };
}
