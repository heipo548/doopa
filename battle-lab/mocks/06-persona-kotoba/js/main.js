/*
 * main.js — 配線（engine と ui をつなぐ）
 *
 * クリック → engine を動かす → ui を描き直す、という橋渡しだけを担当。
 * 村長の番は、プレイヤーがログを読めるように“すこし間”を置いてから処理する。
 *
 * 注意：engine.js の関数は素のグローバル（playSkill / uketomeru / sounari …）。
 *       Game の各メソッドは「プロパティ」なので、グローバルと名前がかぶらない。
 */

var Game = (function () {

  var BUSY = false;          // 村長の番の演出中は二重操作を防ぐ
  var ENEMY_DELAY = 720;     // 「村長の番…」を見せる間（ミリ秒）

  // プレイヤー行動の後、相手の番なら“間”を置いて村長を動かす
  function afterMove() {
    UI.render();
    if (state.result || BUSY) return;
    if (state.phase === 'enemy') {
      BUSY = true;
      UI.render(); // ボタンが「村長の番…」状態になる
      setTimeout(function () {
        enemyTurn();   // engine.js：村長の行動＋次の自分の番開始
        BUSY = false;
        UI.render();
      }, ENEMY_DELAY);
    }
  }

  // 言葉技
  function playSkillCmd(id) {
    if (BUSY) return;
    if (playSkill(id)) afterMove();
  }
  // 受けとめる
  function uketomeruCmd() {
    if (BUSY) return;
    if (uketomeru()) afterMove();
  }
  // ことばの総鳴り
  function sounariCmd() {
    if (BUSY) return;
    if (sounari()) afterMove();
  }
  // 対話を開く（選択肢を出すだけ。まだ相手の番には行かない）
  function openDialogueCmd() {
    if (BUSY) return;
    if (openDialogue()) UI.render();
  }
  // 対話の選択肢を選ぶ
  function chooseDialogueCmd(index) {
    if (BUSY) return;
    if (chooseDialogue(index)) afterMove();
  }
  // 対話をやめる
  function cancelDialogueCmd() {
    if (BUSY) return;
    if (cancelDialogue()) UI.render();
  }
  // リスタート
  function restartCmd() {
    BUSY = false;
    restart();
    UI.render();
  }

  return {
    playSkill: playSkillCmd,
    uketomeru: uketomeruCmd,
    sounari: sounariCmd,
    openDialogue: openDialogueCmd,
    chooseDialogue: chooseDialogueCmd,
    cancelDialogue: cancelDialogueCmd,
    restart: restartCmd
  };
})();

// 起動：DOM ができてからバトル開始
function boot() {
  newBattle();
  // コマンドの配線
  document.getElementById('cmd-uketomeru').onclick = function () { Game.uketomeru(); };
  document.getElementById('cmd-taiwa').onclick = function () { Game.openDialogue(); };
  document.getElementById('cmd-sounari').onclick = function () { Game.sounari(); };
  document.getElementById('dialogue-cancel').onclick = function () { Game.cancelDialogue(); };
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
