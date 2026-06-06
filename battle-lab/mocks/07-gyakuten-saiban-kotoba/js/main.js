/*
 * main.js — engine（ルール）と ui（描画）をつなぐ配線
 *
 * 役割は「操作 → engine を動かす → 描き直す」の橋渡しだけ。
 * ui.js のボタンは Game.* を呼ぶので、ここで Game を定義して公開する。
 */

var Game = (function () {

  // 発言を選ぶ
  function selectLine(id) { selectLine_(id); UI.render(); }

  // たずねる／考える（どちらもノイズは減らない）
  function ask()   { ask_();   UI.render(); }
  function think() { think_(); UI.render(); }

  // つきつけるモードの開始／取消
  function beginPresent()  { beginPresent_();  UI.render(); }
  function cancelPresent() { cancelPresent_(); UI.render(); }

  // 記憶のかけら／言葉を突きつける（正誤判定は engine 側）
  function present(kind, id) { present_(kind, id); UI.render(); }

  // 最初からやり直す
  function restart() { restart_(); UI.render(); }

  return {
    selectLine: selectLine, ask: ask, think: think,
    beginPresent: beginPresent, cancelPresent: cancelPresent,
    present: present, restart: restart
  };
})();

/*
 * engine.js の関数はどれも素のグローバル。Game の中の関数と名前が同じだと
 * 取り違えるので、engine 側を「_」付きの別名で束ねて呼び分ける。
 */
function selectLine_(id)      { return selectLine(id); }
function ask_()               { return ask(); }
function think_()             { return think(); }
function beginPresent_()      { return beginPresent(); }
function cancelPresent_()     { return cancelPresent(); }
function present_(kind, id)   { return present(kind, id); }
function restart_()           { return restart(); }

// 開始時の説明文（data.js の INTRO_TEXT）を画面上部に流し込む。
// HTML 側に文章を二重で持たないよう、表示はここ一箇所にまとめる。
function fillIntro() {
  var box = document.getElementById('mock-intro');
  if (!box) return;
  for (var i = 0; i < INTRO_TEXT.length; i++) {
    var p = document.createElement('p');
    if (INTRO_TEXT[i] === '') { p.className = 'blank'; p.innerHTML = '&nbsp;'; }
    else p.textContent = INTRO_TEXT[i];
    box.appendChild(p);
  }
}

// 起動：DOM ができてからバトル開始
function boot() {
  fillIntro();
  newBattle();
  // オーバーレイ内のボタン（静的に置いてある分）を配線
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
