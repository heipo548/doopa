/*
 * state.js — 現ランの状態と、状態を作る・調べる小さな関数群
 *
 * ゲーム全体は有限ステートマシンで進む（TITLE→FIELD→DIALOGUE→CARDS→BATTLE→RESULT→TITLE）。
 * ここには “状態そのもの(game/app)” と newGame()、カードLv・傾向(凶暴/優しさ)・フラグ・
 * 結末判定・翳り段 といった「状態を読み書きする最小の関数」だけを置く。
 *   ・実際の戦闘処理 → battle.js / 3択 → cards.js / フィールド → field.js
 *
 * ※ ビルドなし・依存ゼロで file:// から動かすため ES Modules は使わない。
 *   普通の <script>（data→audio→metrics→state→…）で読み、末尾で window へ明示エクスポート。
 *
 * ── state.js が支える核 ──
 *   ・傾向は kyoubou(凶暴)/yasashisa(優しさ) の2軸。「どう選び・どう勝ったか」で積む。
 *   ・darkLevel() は kyoubou と BALANCE.darkenAt から 0..3 を返す（主人公ルゥだけが翳る源泉）。
 *   ・思いやり(omoiyari)は battle.js 側の話で、ここでは一切“見える化”しない。
 */

// ──────────────────────────────────────────
// STATES（有限ステートマシンの各ステート）
//   バトル内のサブ状態は game.battle.phase 側で持つ（混同しない）。
// ──────────────────────────────────────────
const STATES = {
  TITLE: "TITLE",        // タイトル（仮ロゴ・プロローグ）
  FIELD: "FIELD",        // 村フィールド（ルゥをクリック移動）
  DIALOGUE: "DIALOGUE",  // NPC会話（typewriter）
  CARDS: "CARDS",        // ことばカード3択入手
  SHOP: "SHOP",          // 学校＝ことばショップ（1枚 受け取る）
  BATTLE: "BATTLE",      // 口喧嘩＝ことばのカードバトル
  RESULT: "RESULT",      // 結果／簡易エンド
  META: "META",          // 神様（井戸の こえ）の見透かし＋word→world 回収
  GAMEOVER: "GAMEOVER",  // player.hp0（非パーマデス。セーブから再開）
  PAUSE: "PAUSE",        // 中断メニュー
};

// ──────────────────────────────────────────
// グローバル
//   game：現ランの状態（newGame() が作る）。
//   app ：今どの画面か。ui.render() が app.screen を見て描画を切り替える。
//   ※ STATES（モデル側の進行）と app.screen（ビュー側の表示先）は別物。
// ──────────────────────────────────────────
let game = null;
let app = { screen: "title", prevScreen: "title" };

// ──────────────────────────────────────────
// 新しいランを作る（タイトルの「はじめる」で呼ぶ）
//   手札は { id: lv } の辞書（同じことばを育てる＝Lvが上がる手触り）。
// ──────────────────────────────────────────
function newGame() {
  const cards = {};
  (PLAYER_INIT.startCards || []).forEach((id) => {
    if (WORDS[id]) cards[id] = 1; // 未知idを弾く（データ事故防止）。最初はみんな Lv1。
  });

  game = {
    state: STATES.TITLE,
    player: {
      name: PLAYER_INIT.name,             // 隠し本名（前面化しない）
      displayName: PLAYER_INIT.displayName, // あだ名「ルゥ」（画面に出る呼び名）
      hp: PLAYER_INIT.hp,
      maxHp: PLAYER_INIT.maxHp,
      cards: cards,                        // { wordId: lv(1..3) }
      tendency: { kyoubou: 0, yasashisa: 0 }, // 人格の傾き（行動で積む2軸）
    },
    currentArea: null,   // 今いるエリアid（field.enterArea がセット）
    flags: {},           // 進行フラグ（talked_npc / got_card / battle_done / area_mura_clear）
    counters: { harshWins: 0, kindWins: 0, battles: 0 }, // 勝ち方の集計
    battle: null,        // バトル中の揮発状態（非戦闘時 null）
    pendingCards: null,  // 現在提示中の3択（cards.offerCards がセット）
    dialogue: null,      // 会話中の状態（{npcId, idx} 等。ui/main が使う）
    log: [],             // 画面下に流す一言ログ
    fx: [],              // 演出イベントの一時キュー（ui.playFx が消費）
    lastWord: null,      // 最後に言ったことばid
    lastWinKind: null,   // 直近の勝ち方（true=寄り添い/false=言い負かし/null=未決着）
    seen: {},            // 一度だけ流す導入の既読記録
    ending: null,        // 確定した結末（determineEnding の戻り）
  };
  return game;
}

// ──────────────────────────────────────────
// カードLv・威力まわり（3段階成長／最大3）
// ──────────────────────────────────────────
function cardLevel(id) {
  return (game && game.player.cards[id]) || 0;
}
// このことばの“いまの効き目”。harsh=精神HPダメージ / kind=思いやり充填量。
function cardPower(id) {
  const w = WORDS[id];
  const lv = cardLevel(id);
  if (!w || lv <= 0) return 0;
  const idx = Math.min(lv - 1, w.power.length - 1); // 不正データでも落ちないようクランプ
  return w.power[idx];
}
function knowsCard(id) {
  return cardLevel(id) > 0;
}
function ownedCards() {
  return game ? Object.keys(game.player.cards) : [];
}
// ことばを覚える／育てる。未知→Lv1("learned")、既知→Lv+1("leveled")、最大3で"max"。
function addCard(id) {
  if (!WORDS[id]) return "max"; // 未知idは無視（安全側）
  const lv = cardLevel(id);
  if (lv <= 0) { game.player.cards[id] = 1; return "learned"; }
  if (lv >= 3) { return "max"; }
  game.player.cards[id] = lv + 1;
  return "leveled";
}

// ──────────────────────────────────────────
// 傾向（人格の傾き）＝ kyoubou / yasashisa を積む
//   0除算や負値で壊れないよう、積むのは 0 以上のみ。
// ──────────────────────────────────────────
function addKyoubou(n) {
  if (!n || n < 0) return;
  game.player.tendency.kyoubou += n; // 凶暴（harshで積む）。darkLevel の源泉。
}
function addYasashisa(n) {
  if (!n || n < 0) return;
  game.player.tendency.yasashisa += n; // 優しさ（kindで積む）。
}

// 主人公(ルゥ)の翳り具合 0..3。kyoubou が darkenAt を超えるごとに +1。
//   UI はこの値を見て body へ dark-1/2/3 を付け、世界の色温度を寒色へ寄せる。
function darkLevel() {
  const k = game ? game.player.tendency.kyoubou : 0;
  const th = (typeof BALANCE !== "undefined" && BALANCE.darkenAt) ? BALANCE.darkenAt : [];
  let lv = 0;
  for (let i = 0; i < th.length; i++) {
    if (k >= th[i]) lv = i + 1; // 超えたぶんだけ段を上げる（th は昇順前提）
  }
  return Math.min(3, lv);
}
function isUnstable() {
  return darkLevel() >= 1;
}

// ──────────────────────────────────────────
// フラグ（進行の関門）
// ──────────────────────────────────────────
function setFlag(k) { if (game) game.flags[k] = true; }
function hasFlag(k) { return !!(game && game.flags[k]); }

// ──────────────────────────────────────────
// 結末分岐：優しさ率 = yasashisa / (yasashisa + kyoubou)
//   ENDINGS は優しさ率の高い順（min 降順）。満たす最初のものを返す。
//   両方0（無行動＝0除算）は率0扱い＝最後の要素(min=0)へ落ちる。
//   ★「どう勝ったか／どう戦ったか」が結末を決める署名メカニクスの最終出力。
// ──────────────────────────────────────────
function determineEnding() {
  const t = game.player.tendency;
  const total = t.kyoubou + t.yasashisa;
  const rate = total > 0 ? t.yasashisa / total : 0;
  for (const e of ENDINGS) {
    if (rate >= e.min) { game.ending = e; return e; }
  }
  game.ending = ENDINGS[ENDINGS.length - 1]; // 保険（理論上ここには来ない）
  return game.ending;
}

// 優しさ率（結果画面の傾向表示などで使う・0..1）。
function yasashisaRate() {
  if (!game) return 0;
  const t = game.player.tendency;
  const total = t.kyoubou + t.yasashisa;
  return total > 0 ? t.yasashisa / total : 0;
}

// ──────────────────────────────────────────
// ログ（画面下に流す一言。古いものは捨てる）
// ──────────────────────────────────────────
function log(msg) {
  if (!game) return;
  game.log.push(msg);
  if (game.log.length > 60) game.log.shift();
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.STATES = STATES;
  window.game = game;
  window.app = app;
  window.newGame = newGame;
  window.cardLevel = cardLevel;
  window.cardPower = cardPower;
  window.knowsCard = knowsCard;
  window.ownedCards = ownedCards;
  window.addCard = addCard;
  window.addKyoubou = addKyoubou;
  window.addYasashisa = addYasashisa;
  window.darkLevel = darkLevel;
  window.isUnstable = isUnstable;
  window.setFlag = setFlag;
  window.hasFlag = hasFlag;
  window.determineEnding = determineEnding;
  window.yasashisaRate = yasashisaRate;
  window.log = log;
}
