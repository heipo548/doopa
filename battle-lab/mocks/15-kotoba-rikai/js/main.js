/*
 * main.js — 配線（engine と ui と 音 と チュートリアルをつなぐ）
 *
 * クリック → engine.choose() → SE → UI.render()。
 * このバトルは“相手の攻撃フェーズ”が無い（会話なので毎ターン Lの1手）。
 * よって setTimeout の往復は不要。選んだ瞬間に 反応を見せる。
 */
var acted = false; // 最初の1手を打ったか（おすすめハイライト消し用）

var Game = (function () {

  function choose(id) {
    if (state.phase !== 'player' || state.result) return;
    if (!acted) { acted = true; if (typeof Tutor !== 'undefined') Tutor.clearHighlight(); }

    var ok = choose_(id); // engine.js の choose
    if (!ok) { UI.render(); return; }

    // 効果音：選択の手応え（state.fx は engine が立てる）
    if (typeof SE !== 'undefined') {
      SE.play(state.fx || 'choice');
      if (state.result === 'win' || state.result === 'warmwin') delayed(function () { SE.play('win'); }, 200);
      else if (state.result === 'reject' || state.result === 'surface') delayed(function () { SE.play('lose'); }, 200);
    }
    UI.render();
  }

  function restart() {
    acted = false;
    restart_();
    fillIntro();
    UI.render();
    recommend();
  }

  function setEncounter(id) {
    acted = false;
    newBattle(id);
    fillIntro();
    applyTutorFor(id);
    UI.render();
    recommend();
  }

  return { choose: choose, restart: restart, setEncounter: setEncounter };
})();

// engine.js の同名関数を別名で束ねる（Game.choose と engine.choose が同名なので）
function choose_(id) { return choose(id); }
function restart_() { return restart(); }

// 簡易タイマー（テスト環境に setTimeout が無くても落ちないように）
function delayed(fn, ms) {
  if (typeof setTimeout === 'function') setTimeout(fn, ms); else fn();
}

/* ───────── 1ターン目だけ「観察・受け止める・距離」をおすすめハイライト ─────────
 * 「いきなり聞きすぎると相手が身構える」を、初手で体感させるため。
 */
function recommend() {
  if (typeof Tutor === 'undefined' || acted) return;
  Tutor.highlight('.choice[data-cat="kansatsu"], .choice[data-cat="kyori"], .choice[data-cat="uketomeru"]');
}

/* ───────── イントロ文（相手ごと）を流し込む ───────── */
function fillIntro() {
  var box = document.getElementById('mock-intro'); if (!box) return;
  box.innerHTML = '';
  var intro = ENCOUNTERS[state.encounterId].intro || [];
  for (var i = 0; i < intro.length; i++) {
    var p = document.createElement('p'); p.textContent = intro[i]; box.appendChild(p);
  }
}

/* ───────── チュートリアル設定 ───────── */
var TUTOR_TERMS = [
  { term:'理解', desc:'相手のことが どれだけ分かったか。目標まで上げると、相手の本音が見えてくる。' },
  { term:'警戒', desc:'相手が どれだけ身構えているか。上がりきると、相手は会話を拒絶する。' },
  { term:'余裕', desc:'L 側の落ち着き。重い言葉ほど消費する。なくなると 焦って、選べる言葉の質が落ちる。距離を取ると回復。' },
  { term:'聞く', desc:'情報を引き出す。話したがっている時に強い。連発すると警戒が上がる。' },
  { term:'受け止める', desc:'相手を安心させる。不安・怒りに有効。理解はあまり伸びない。' },
  { term:'伝える', desc:'こちらの考えを伝える。刺されば大きいが、外すと警戒が上がる。' },
  { term:'観察する', desc:'よく見る。次の選択肢が良くなり、本音のヒントが出る。余裕の消費が小さい。' },
  { term:'距離を取る', desc:'踏み込みすぎない。警戒を下げ、余裕が回復する。理解は上がりにくい。' },
  { term:'差し出す', desc:'記憶や持ち物を差し出す。合えば大きく、合わないと大きく警戒。回数制限あり。' },
  { term:'状態', desc:'安心／沈黙／強がり／動揺。同じ言葉でも、相手の状態しだいで効き方が変わる。' }
];

function applyTutorFor(id) {
  if (typeof Tutor === 'undefined') return;
  if (id === 'gatekeeper') {
    Tutor.setObjective('目標：門番を 観察し、強がりを ほどいて、本音を 話せる ところまで（警戒させすぎず）');
  } else {
    Tutor.setObjective('目標：相手の様子を見て ことばを選ぶ。倒すのではなく、理解して、警戒させすぎない。');
  }
}

function initTutor() {
  if (typeof Tutor === 'undefined') return;
  Tutor.init({
    objective:'目標：相手の様子を見て ことばを選ぶ。倒すのではなく、理解して、警戒させすぎない。',
    terms: TUTOR_TERMS,
    steps:[
      { title:'このバトルは?', body:'相手を 倒すゲームでは ありません。相手を 理解し、警戒させすぎずに、心の距離を 縮めます。毎ターン、3つの ことばから 1つを 選びます。' },
      { title:'まず「様子」を読む', body:'画面の上にある「相手の様子」を 読んでください。相手が どんな気持ちか 推測してから、ことばを 選びます。' },
      { title:'正解を当てる ゲームじゃない', body:'同じ やさしい言葉でも、相手によって 救いにも、踏み込みすぎにも なります。選んだあとの 反応を見て、学んでいきましょう。' },
      { title:'まずは やさしく', body:'いきなり 聞きすぎると、こわがりな子は 身構えます。観察したり、受け止めたり、すこし 待つ手も あります。', highlight:'.choice[data-cat="kansatsu"], .choice[data-cat="kyori"], .choice[data-cat="uketomeru"]' },
      { title:'余裕に 気をつけて', body:'重い言葉ほど「余裕」を 使います。なくなると 焦って、選べる言葉の 質が 落ちます。距離を取ると、余裕は 戻ります。' }
    ]
  });
}

/* ───────── 起動 ───────── */
function boot() {
  newBattle('naku_ko');
  fillIntro();

  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  var encBtns = document.querySelectorAll('.enc-btn');
  for (var i = 0; i < encBtns.length; i++) {
    encBtns[i].onclick = (function (id) { return function () { Game.setEncounter(id); }; })(encBtns[i].getAttribute('data-enc'));
  }

  if (typeof BGM !== 'undefined') BGM.setup('rikai'); // 最初はOFF。右下ボタンで再生。
  initTutor();
  UI.render();
  recommend();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
