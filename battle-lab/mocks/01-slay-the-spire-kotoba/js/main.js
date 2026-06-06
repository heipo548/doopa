/*
 * main.js — 配線（engine と ui をつなぐ）
 *
 * クリック → engine を動かす → ui を描き直す、という橋渡しだけを担当。
 * 相手の番は、プレイヤーが予告を読めるように“すこし間”を置いてから処理する。
 */

var Game = (function () {

  var BUSY = false; // 相手の番の演出中は二重操作を防ぐ

  // カードを使う
  function playCard(uid) {
    if (BUSY) return;
    var ok = playCardEngine(uid); // engine.js の playCard
    if (ok) UI.render();
  }

  // ターン終了 → 「相手の番…」を見せてから enemyTurn を実行
  function endTurn() {
    if (BUSY || state.phase !== 'player' || state.result) return;
    endTurnEngine();   // engine.js: 手札を片付けて phase=enemy
    UI.render();       // ボタンが「相手の番…」になる
    BUSY = true;
    // 予告どおりの行動が来るのを“読む間”。約0.8秒後に解決する
    setTimeout(function () {
      enemyTurnEngine(); // engine.js: 相手の行動＋次の自分の番開始
      BUSY = false;
      UI.render();
    }, 800);
  }

  // リスタート
  function restart() {
    BUSY = false;
    restartEngine();
    UI.render();
  }

  return { playCard: playCard, endTurn: endTurn, restart: restart };
})();

// engine.js のグローバル関数を分かりやすい別名で束ねる
// （engine 側は素のグローバル関数なので、そのまま呼べる）
function playCardEngine(uid) { return playCard(uid); }
function endTurnEngine() { return endTurn(); }
function enemyTurnEngine() { return enemyTurn(); }
function restartEngine() { return restart(); }

// ↑ 名前衝突を避けるため、Game の中では別名で呼んでいる点に注意。
//   （playCard という名前が engine.js と Game の両方にあるため）

// 起動：DOM ができてからバトル開始
function boot() {
  newBattle('sonchou');
  // ボタンの配線
  document.getElementById('end-turn-btn').onclick = function () { Game.endTurn(); };
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
