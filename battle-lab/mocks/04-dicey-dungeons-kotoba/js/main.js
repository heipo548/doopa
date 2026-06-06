/*
 * main.js — 配線（engine と ui をつなぐ）＋「いま選んでいる欠片」の管理
 *
 * 操作方式：ことばの欠片をクリックして選ぶ → 言葉装置をクリックして装填する
 * （ドラッグより迷いにくい「選択→装填」方式。仕様で許可されている）。
 * 相手の番は、プレイヤーが予告を読めるように“すこし間”を置いてから処理する。
 */

var Game = (function () {

  var selectedId = null; // いま選んでいる「ことばの欠片」の id（UIの選択状態）
  var BUSY = false;      // 相手の番の演出中は二重操作を防ぐ

  function getSelected() { return selectedId; }

  // 欠片を選ぶ（同じものを再クリックで選択解除）
  function selectKakera(id) {
    if (BUSY || state.phase !== 'player' || state.result) return;
    selectedId = (selectedId === id) ? null : id;
    state.lastError = null;
    UI.render();
  }

  // 選んでいる欠片を、押した装置に装填する
  function loadInto(deviceId) {
    if (BUSY || state.phase !== 'player' || state.result) return;
    if (!selectedId) {
      // 欠片を選ばずに装置を押したとき
      state.lastError = 'さきに ことばの欠片を 選んでください';
      UI.render();
      return;
    }
    var res = loadKakeraEngine(selectedId, deviceId); // engine.js の loadKakera
    if (res.ok) {
      selectedId = null; // 入った欠片は手放す（続けて次の欠片を選べる）
    }
    // 失敗時は選択を保持（別の装置をすぐ試せるように）
    UI.render();
  }

  // 装填中の欠片をプールへ戻す（ほんとう？ の途中でやめる）
  function unload(deviceId) {
    if (BUSY || state.phase !== 'player' || state.result) return;
    unloadDeviceEngine(deviceId);
    selectedId = null;
    UI.render();
  }

  // ターン終了 → 「相手の番…」を見せてから enemyTurn を実行
  function endTurn() {
    if (BUSY || state.phase !== 'player' || state.result) return;
    selectedId = null;
    endTurnEngine();   // engine.js: 残りの欠片を片付けて phase=enemy
    UI.render();       // ボタンが「相手の番…」になる
    BUSY = true;
    // 予告どおりの感情が来るのを“読む間”。約0.8秒後に解決する
    setTimeout(function () {
      enemyTurnEngine(); // engine.js: 相手の行動＋次の自分の番開始
      BUSY = false;
      UI.render();
    }, 800);
  }

  // リスタート
  function restart() {
    BUSY = false;
    selectedId = null;
    restartEngine();
    UI.render();
  }

  return {
    getSelected: getSelected, selectKakera: selectKakera,
    loadInto: loadInto, unload: unload, endTurn: endTurn, restart: restart
  };
})();

// engine.js のグローバル関数を、名前衝突を避けて別名で束ねる
// （loadKakera / endTurn などは engine 側にも Game 側にもあるため）
function loadKakeraEngine(kid, did) { return loadKakera(kid, did); }
function unloadDeviceEngine(did) { return unloadDevice(did); }
function endTurnEngine() { return endTurn(); }
function enemyTurnEngine() { return enemyTurn(); }
function restartEngine() { return restart(); }

// 起動：DOM ができてからバトル開始＆ボタン配線＆世界観テキスト差し込み
function boot() {
  // 画面上部の説明文（data.js の LORE から）
  var howto = document.getElementById('howto');
  if (howto) {
    for (var i = 0; i < LORE.howto.length; i++) {
      var p = document.createElement('p');
      p.textContent = LORE.howto[i];
      howto.appendChild(p);
    }
  }

  newBattle('sonchou');
  document.getElementById('end-turn-btn').onclick = function () { Game.endTurn(); };
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
