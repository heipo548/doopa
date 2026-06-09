/*
 * state.js — 現在の状態（game / app）と、状態を読み書きする最小の関数群。
 *
 * 有限ステートマシン：
 *   TITLE → FIELD(探索) →(調べる)→ LOOK / →(人)→ DIALOGUE / →(言い争い)→ ARGUE
 *         → ほこらで ARGUE(かぞえうた=審判) → ENDING。 ☰/Esc で PAUSE。図鑑は VOCAB。
 *
 *   ・game … 現ランの状態（newGame が作る）。覚えた言葉・トーン(明暗)・フラグ・位置 など。
 *   ・app  … いま“どの画面か”（ui.render が app.screen を見て描画を切り替える）。
 *   ・tone … 世界の明暗スカラー(-100..100)。言い争いの言葉選びで動き、背景の色温度に出る。
 *
 * ※ ビルドなし・依存ゼロ・file:// で動かすため ES Modules は使わない。末尾で window へ明示エクスポート。
 */

const STATES = {
  TITLE: "TITLE",
  FIELD: "FIELD",
  LOOK: "LOOK",
  DIALOGUE: "DIALOGUE",
  ARGUE: "ARGUE",       // 言い争い（戦闘の代わり）＝ほこらでは審判
  ENDING: "ENDING",
  PAUSE: "PAUSE",
};

let game = null;
let app = { screen: "title", prevScreen: "field", player: null };

function newGame() {
  const words = {};
  (PLAYER_INIT.startWords || []).forEach((id) => { if (WORDS[id]) words[id] = true; });

  game = {
    state: STATES.TITLE,
    words: words,         // 覚えた言葉 {id:true}
    wordsOrder: [],       // 覚えた順（図鑑・エンディング）
    lastLearned: null,    // 直近に覚えた語（書き換え演出のハイライト）
    tone: 0,              // 世界の明暗(-100..100)。やわらか語+/とげ語-。
    flags: {},            // 進行フラグ（talked_xxx / learned_xxx / *_done 等）
    items: {},            // 持ち物（hana_item 等）
    currentArea: null,
    pos: null,            // 退室時のタイル位置 {tx,ty,dir}
    lookProgress: {},     // 調べた回数 objId -> step index
    argue: null,          // 言い争いの揮発状態（argue.js が作る）
    dialogue: null,       // 会話の揮発状態
    _narr: null,          // 汎用ナレーションの揮発状態（main が使う）
    name: null,           // 主人公が最後に選ぶ なまえ
    ending: null,         // エンディング種別（light/dim/dark）
    log: [],
    startedAt: null,
  };
  return game;
}

// ── フラグ ──
function setFlag(k) { if (game) game.flags[k] = true; }
function hasFlag(k) { return !!(game && game.flags[k]); }

// ── 持ち物 ──
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

// ── トーン（世界の明暗）──
function adjustTone(delta) {
  if (!game) return 0;
  game.tone = Math.max(-100, Math.min(100, (game.tone || 0) + delta));
  return game.tone;
}
// 背景の色温度バケツ。ui が body.dataset.tone に入れて css が拾う。
function toneBucket() {
  const t = game ? (game.tone || 0) : 0;
  if (t >= 24) return "light";
  if (t >= -6) return "warm";
  if (t >= -34) return "dim";
  return "dark";
}
// エンディング種別（明 / 中 / 暗）。
function endingKind() {
  const t = game ? (game.tone || 0) : 0;
  if (t >= 18) return "light";
  if (t <= -18) return "dark";
  return "dim";
}

// ── ログ（画面下に流す一言。古いものは捨てる）──
function log(msg) {
  if (!game) return;
  game.log.push(msg);
  if (game.log.length > 40) game.log.shift();
}

// ── 進行ヒント（画面上部「つぎ：…」）。data.OBJECTIVES をフラグで引く ──
function objectiveText(areaId) {
  const o = OBJECTIVES[areaId];
  if (!o) return "";
  if (o._order) {
    for (const row of o._order) {
      if (row._default) return row._default;
      if (hasFlag(row.flag)) return row.text;
    }
    return "";
  }
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
  window.adjustTone = adjustTone;
  window.toneBucket = toneBucket;
  window.endingKind = endingKind;
  window.log = log;
  window.objectiveText = objectiveText;
}
