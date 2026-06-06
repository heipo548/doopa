/*
 * main.js — 配線（engine と ui をつなぐ）
 *
 * クリック → engine を動かす → ui を描き直す、という橋渡しだけを担当。
 * ポケモン型なので「L が1手 → 少し間をおいて 村長が1手」を交互に処理する。
 */

var Game = (function () {

  var BUSY = false; // 村長の番の演出中は二重操作を防ぐ

  // 言葉技を使う → 成功したら 村長の番へ（少し“間”を置いて応答）
  function useMove(moveId) {
    if (BUSY || state.phase !== 'player' || state.result) return;
    var ok = useMoveEngine(moveId); // engine.js の useMove
    if (!ok) { UI.render(); return; } // 残響切れ等：盤面だけ更新
    UI.render();

    // L の一手で勝負がついたら、ここで止める
    if (state.result || state.phase !== 'enemy') return;

    BUSY = true; // 村長が応答するまで操作ロック
    setTimeout(function () {
      enemyTurnEngine(); // engine.js: 村長の行動＋次の L の番開始
      BUSY = false;
      UI.render();
    }, 850);
  }

  // リスタート
  function restart() {
    BUSY = false;
    restartEngine();
    UI.render();
  }

  return { useMove: useMove, restart: restart };
})();

// engine.js のグローバル関数を分かりやすい別名で束ねる
// （engine 側の useMove と Game.useMove が同名なので、別名で呼び分ける）
function useMoveEngine(id) { return useMove(id); }
function enemyTurnEngine() { return enemyTurn(); }
function restartEngine() { return restart(); }

// 起動：DOM ができてからバトル開始
function boot() {
  newBattle('sonchou');
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
