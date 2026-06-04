/*
 * state.js — 現ランの状態と、状態を作る・調べる小さな関数群
 *
 * ゲーム全体は「有限ステートマシン」で進む（TITLE→FIELD→BATTLE→…→ENDING→META）。
 * ここでは “状態そのもの(game/app)” と “状態を作る newGame()”、そして
 * カードLv・傾向(凶暴/優しさ)・フラグ・結末判定・不穏度 といった
 * 「状態を読み書きする最小の関数」だけを置く。
 *   ・実際の戦闘処理 → battle.js
 *   ・3択カード     → cards.js
 *   ・フィールド歩行 → field.js
 * という責務分離（02-saigo-no-tomodachi の流儀を踏襲）。
 *
 * ※ ビルドなし・依存ゼロで file:// から動かすため ES Modules は使わない。
 *   普通の <script> として読み込み、window 直書きで共有する（data.js → audio.js →
 *   metrics.js → state.js の順で読まれる前提）。末尾で window へ明示エクスポートする。
 *
 * ── 署名メカニクスのうち state.js が支える核 ──
 *   ・傾向は kyoubou(凶暴)/yasashisa(優しさ) の2軸。「どう勝ったか・どう戦ったか」で積む。
 *   ・darkLevel() は player.tendency.kyoubou と BALANCE.darkenAt から 0..3 を返す
 *     （主人公(L)だけが翳る演出のトリガー。UI が body へ dark-N を付ける）。
 *   ・思いやり(omoiyari)は battle.js 側の話で、ここでは一切“見える化”しない。
 */

// ──────────────────────────────────────────
// STATES（ゲーム全体の有限ステートマシンの各ステート）
//   バトル内のサブ状態（player/enemy/end）は game.battle.phase 側で持つ（混同しない）。
// ──────────────────────────────────────────
const STATES = {
  TITLE: "TITLE",         // タイトル（WO_RD ロゴ・プロローグ）
  FIELD: "FIELD",         // マウス追従で歩く“道”
  BATTLE: "BATTLE",       // ことばのカードバトル
  CARDS: "CARDS",         // 3択カード入手／Lv上げ
  AREA_CLEAR: "AREA_CLEAR", // エリア踏破（次エリアへ）
  ENDING: "ENDING",       // 結末（優しさ率で分岐）
  META: "META",           // 神様的存在の見透かし演出（WO_RD→WORLD）
  GAMEOVER: "GAMEOVER",   // プレイヤーhp0。セーブからやり直せる
};

// ──────────────────────────────────────────
// グローバル
//   game：現ランの状態（newGame() が作る）。
//   app ：今どの画面か。ui.render() が app.screen を見て描画を切り替える。
//     screen: "title"|"field"|"battle"|"cards"|"result"|"meta"|"shop"|"dialogue"|"pause"
//   ※ STATES（モデル側の進行）と app.screen（ビュー側の表示先）は別物。
//     例：勝利後の3択は state=BATTLE のまま screen="cards" になり得る、等の自由度を残す。
// ──────────────────────────────────────────
let game = null;
let app = { screen: "title" };

// ──────────────────────────────────────────
// 新しいランを作る（はじめから／タイトルの「はじめる」で呼ぶ）
//   PLAYER_INIT を土台に player を組み、startCards を Lv1 で手札に入れる。
//   counters は「どう勝ったか」を集計する箱（harshWins/kindWins/battles）。
// ──────────────────────────────────────────
function newGame() {
  // 手札は { id: lv } の辞書で持つ（同じことばを育てる＝Lvが上がる手触りのため）。
  const cards = {};
  (PLAYER_INIT.startCards || []).forEach((id) => {
    // 念のため未知idを弾く（data.js を直接いじったときの事故防止）。
    if (WORDS[id]) cards[id] = 1; // 最初はみんな Lv1。
  });

  game = {
    state: STATES.TITLE,
    player: {
      name: PLAYER_INIT.name,                 // 隠し設定の本名「L」（=world の欠片）。
      displayName: PLAYER_INIT.displayName,    // 序盤の呼び名（型番/あだ名）。名前の謎を引っぱる。
      hp: PLAYER_INIT.hp,
      maxHp: PLAYER_INIT.maxHp,
      cards: cards,                            // { wordId: lv(1..3) } 覚えていることば。
      // 傾向（人格の傾き）。行動で積む2軸。エンド分岐とダーク化の源泉。
      tendency: { kyoubou: 0, yasashisa: 0 },
    },
    currentArea: null,        // 今いるエリアid（field.enterArea がセット）。
    flags: {},                // 進行フラグ（mura_boss / dokutsu_boss 等。exit解放などに使う）。
    counters: { harshWins: 0, kindWins: 0, battles: 0 }, // 勝ち方の集計。
    battle: null,             // バトル中の状態（battle.startBattle が作る。非戦闘時は null）。
    pendingCards: null,       // 現在提示中の3択（cards.offerCards がセット）。
    log: [],                  // 画面下に流すログ（戦闘・会話の一言）。
    fx: [],                   // 演出イベントの一時キュー（ui.playFx が描画後に消費）。
    lastWord: null,           // 最後に言ったことばid（演出/結末の“さいごのことば”用）。
    lastWinKind: null,        // 直近の勝ち方（true=寄り添い/false=言い負かし）。null=未決着。
    seen: {},                 // 一度だけ流す導入(intro/flavor)の既読記録。
    ending: null,             // 確定した結末（determineEnding の戻り）。
  };
  return game;
}

// ──────────────────────────────────────────
// カードLv・威力まわり（3段階成長／最大3）
//   cards は { id: lv }。lv は 1..3。威力は data.js の WORDS[id].power[lv-1]。
// ──────────────────────────────────────────
// このことばのLv（持っていなければ 0 を返す＝knowsCard と併用しやすい）。
function cardLevel(id) {
  return game.player.cards[id] || 0;
}
// このことばの“いまの効き目”。harsh=精神HPダメージ / kind=思いやり充填量。
//   持っていなければ 0。Lvに応じて power[lv-1] を返す（power は3要素前提）。
function cardPower(id) {
  const w = WORDS[id];
  const lv = cardLevel(id);
  if (!w || lv <= 0) return 0;
  // power 配列がLvより短い不正データでも落ちないよう末尾でクランプ。
  const idx = Math.min(lv - 1, w.power.length - 1);
  return w.power[idx];
}
// このことばを覚えているか（手札にあるか）。
function knowsCard(id) {
  return cardLevel(id) > 0;
}
// 手札のことばid一覧（コマンドバー／結末などの列挙用）。
function ownedCards() {
  return Object.keys(game.player.cards);
}
// ことばを覚える／育てる。
//   未知なら Lv1 で習得("learned")、既知なら Lv+1("leveled")、最大Lv3で"max"（それ以上は伸びない）。
//   戻り値は ui のトースト出し分け用に使う。
function addCard(id) {
  if (!WORDS[id]) return "max"; // 未知idは無視（安全側）。
  const lv = cardLevel(id);
  if (lv <= 0) {
    game.player.cards[id] = 1;
    return "learned";          // 新しいことばを覚えた（語彙が増えた手応え）。
  }
  if (lv >= 3) {
    return "max";              // もう最大。これ以上は育たない（上限は3）。
  }
  game.player.cards[id] = lv + 1;
  return "leveled";            // 言い方が一段つよく/やさしくなった（同じことばの成長）。
}

// ──────────────────────────────────────────
// 傾向（人格の傾き）＝ kyoubou / yasashisa を積む
//   battle/cards から「勝ち方・選び方・使い方」の重み(BALANCE)で呼ばれる。
//   ※ 0除算や負値で壊れないよう、積むのは 0 以上のみとする。
// ──────────────────────────────────────────
function addKyoubou(n) {
  if (!n || n < 0) return;
  game.player.tendency.kyoubou += n; // 凶暴（harshで積む）。darkLevel の源泉。
}
function addYasashisa(n) {
  if (!n || n < 0) return;
  game.player.tendency.yasashisa += n; // 優しさ（kindで積む）。
}

// 主人公(L)の翳り具合 0..3。
//   player.tendency.kyoubou が BALANCE.darkenAt=[t1,t2,t3] を超えるごとに +1。
//   UI はこの値を見て body へ dark-1/2/3 を付け、Lのセリフを不穏化する
//   （“急いで harsh を押し切った人ほど世界が翳る”という設計を可視化）。
function darkLevel() {
  const k = game.player.tendency.kyoubou;
  const th = BALANCE.darkenAt || [];
  let lv = 0;
  // しきい値を「超えた」ぶんだけ段階を上げる（th は昇順前提）。
  for (let i = 0; i < th.length; i++) {
    if (k >= th[i]) lv = i + 1;
  }
  return Math.min(3, lv); // 念のため上限3でクランプ。
}

// ──────────────────────────────────────────
// フラグ（進行の関門）
//   例：villageChief 撃破で setFlag("mura_boss") → exit が解放される（field.js が hasFlag で判定）。
// ──────────────────────────────────────────
function setFlag(k) {
  game.flags[k] = true;
}
function hasFlag(k) {
  return !!game.flags[k];
}

// ──────────────────────────────────────────
// 結末分岐：優しさ率 = yasashisa / (yasashisa + kyoubou)
//   ENDINGS は優しさ率の高い順（min 降順）に並ぶ前提で、min を満たす最初のものを返す。
//   一度も傾向が動いていない（両方0＝0除算）場合は中間寄りに倒すため率0で扱い、
//   最後の要素（最低 min=0 の cruel）まで落ちないよう ENDINGS の素直な走査に委ねる。
//   ★「どう勝ったか/どう戦ったか」が結末を決める、という署名メカニクスの最終出力。
// ──────────────────────────────────────────
function determineEnding() {
  const t = game.player.tendency;
  const total = t.kyoubou + t.yasashisa;
  const rate = total > 0 ? t.yasashisa / total : 0; // 0除算ガード（無行動は率0扱い）。
  for (const e of ENDINGS) {
    if (rate >= e.min) {
      game.ending = e;       // 確定結末を保持（result/meta 画面が参照）。
      return e;
    }
  }
  // 理論上ここには来ない（最後の要素は min=0）が、保険で末尾を返す。
  game.ending = ENDINGS[ENDINGS.length - 1];
  return game.ending;
}

// ──────────────────────────────────────────
// 不穏度ヘルパー
//   darkLevel>=1 なら主人公(L)のセリフを不穏化するか、を UI が問い合わせる。
//   （文字を揺らす／口が悪くなる演出の ON/OFF 判定。判定の一元化のためここに置く。）
// ──────────────────────────────────────────
function isUnstable() {
  return darkLevel() >= 1;
}

// ──────────────────────────────────────────
// ログ（画面下に流す一言。古いものは捨てて重くならないように）
//   02 同様、上限を設けて先頭から間引く。
// ──────────────────────────────────────────
function log(msg) {
  if (!game) return;          // newGame 前の呼び出しでも落ちないように。
  game.log.push(msg);
  if (game.log.length > 80) game.log.shift();
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.STATES = STATES;
  window.game = game;          // ※ 参照渡しではないので、newGame 後は window.game = game の再代入が要る場面に注意。
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
  window.setFlag = setFlag;
  window.hasFlag = hasFlag;
  window.determineEnding = determineEnding;
  window.isUnstable = isUnstable;
  window.log = log;
}
