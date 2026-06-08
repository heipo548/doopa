/*
 * state.js — 現在の状態（game / app）と、状態を読み書きする最小の関数群
 *
 * ゲームは有限ステートマシンで進む：
 *   TITLE → FIELD(探索) →(調べる)→ LOOK / →(人)→ DIALOGUE / →(遭遇)→ ENCOUNTER
 *         → FINALE(母と再会) → ENDING。 ☰/Esc で PAUSE。
 *
 *   ・game … 現ランの状態（newGame が作る）。覚えた言葉・フラグ・持ち物・位置 など。
 *   ・app  … いま“どの画面か”（ui.render が app.screen を見て描画を切り替える）。
 *
 * ※ ビルドなし・依存ゼロ・file:// で動かすため ES Modules は使わない。末尾で window へ明示エクスポート。
 */

const STATES = {
  TITLE: "TITLE",
  FIELD: "FIELD",        // 見下ろし探索
  LOOK: "LOOK",          // 「調べる」テキスト
  DIALOGUE: "DIALOGUE",  // NPC会話
  ENCOUNTER: "ENCOUNTER",// 遭遇（橋・子ども）
  FINALE: "FINALE",      // ラスト（母と再会→友達）
  ENDING: "ENDING",      // 体験版エンド
  PAUSE: "PAUSE",        // 中断メニュー
};

// app.screen は STATES とほぼ対応するが「ビュー側の表示先」。vocab(言葉一覧)など UI 専用の値も持つ。
let game = null;
let app = { screen: "title", prevScreen: "field", player: null };

// ──────────────────────────────────────────
// 新しいランを作る
//   words … {id:0/1/2}。最初は全部 0（PLAYER_INIT.startWords があれば 2 にする）。
// ──────────────────────────────────────────
function newGame() {
  const words = {};
  (PLAYER_INIT.startWords || []).forEach((id) => { if (WORDS[id]) words[id] = 2; });

  game = {
    state: STATES.TITLE,
    words: words,           // 言葉の習得レベル
    wordsOrder: [],         // 覚えた順（エンディングのモンタージュ）
    lastLearned: null,      // 直近に覚えた語（書き換え演出のハイライト）
    flags: {},              // 進行フラグ（learned_xxx / bridge_done / child_solved 等）
    items: {},              // 持ち物（hana_item 等）
    currentArea: null,      // 今いるエリアid
    pos: null,              // 退室時のタイル位置 {tx,ty,dir}（セーブ復帰用）
    lookProgress: {},       // 調べた回数 objId -> step index
    enc: null,              // 遭遇の揮発状態（encounter.js が作る）
    dialogue: null,         // 会話の揮発状態
    finale: null,           // ラストの揮発状態
    log: [],                // 画面下の一言ログ
    fx: [],                 // 演出キュー（ui が消費）
    startedAt: null,        // 計測（クリア時間表示などに）
  };
  return game;
}

// ── フラグ ──
function setFlag(k) { if (game) game.flags[k] = true; }
function hasFlag(k) { return !!(game && game.flags[k]); }

// ── 持ち物（覚えた言葉とは別。花など “渡せる/見せられる” もの）──
function giveItem(id) { if (game) game.items[id] = true; }
function hasItem(id) { return !!(game && game.items && game.items[id]); }

// ── 調べた回数（look の段階送り）──
function lookStep(objId) { return (game && game.lookProgress[objId]) || 0; }
function bumpLookStep(objId, max) {
  if (!game) return 0;
  const cur = lookStep(objId);
  const next = (max != null) ? Math.min(cur + 1, max) : cur + 1;
  game.lookProgress[objId] = next;
  return next;
}

// ── ログ（画面下に流す一言。古いものは捨てる）──
function log(msg) {
  if (!game) return;
  game.log.push(msg);
  if (game.log.length > 40) game.log.shift();
}

// ──────────────────────────────────────────
// 進行ヒント（画面上部「つぎ：…」）。data.OBJECTIVES をフラグで引く。
// ──────────────────────────────────────────
function objectiveText(areaId) {
  const o = OBJECTIVES[areaId];
  if (!o) return "";
  if (o._order) { // 村：順番に評価して最初に当たったもの
    for (const row of o._order) {
      if (row._default) return row._default;
      if (hasFlag(row.flag)) return row.text;
    }
    return "";
  }
  // それ以外：フラグ名で引く（無ければ _default）
  for (const k in o) {
    if (k === "_default") continue;
    if (hasFlag(k)) return o[k];
  }
  return o._default || "";
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.STATES = STATES;
  window.game = game;
  window.app = app;
  window.newGame = newGame;
  window.setFlag = setFlag;
  window.hasFlag = hasFlag;
  window.giveItem = giveItem;
  window.hasItem = hasItem;
  window.lookStep = lookStep;
  window.bumpLookStep = bumpLookStep;
  window.log = log;
  window.objectiveText = objectiveText;
}
