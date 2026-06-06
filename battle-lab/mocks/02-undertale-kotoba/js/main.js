/*
 * main.js — 配線（engine / bullet / ui をつなぐ）
 *
 * クリック → engine を動かす → ui を描き直す、という橋渡し。
 * さらに、感情回避フェーズ（弾よけ）の リアルタイムループ（requestAnimationFrame）と
 * 入力（キーボード＋タッチ/マウス）もここで扱う。
 */

var Game = (function () {

  var field = null;     // 現在の弾よけフィールド（bullet.js）
  var rafId = null;     // アニメーションフレームID（停止用）
  var lastT = 0;        // 前フレームの時刻（dt 計算用）
  var canvas = null;

  /* ───────────── コマンド選択 ───────────── */
  function openCategory(catId) {
    if (state.phase !== 'command' || state.result) return;
    UI.openCategory(catId);
  }
  function closeCategory() { UI.closeCategory(); }

  // 小さな選択肢を選んだとき
  function choose(optId) {
    if (state.phase !== 'command' || state.result) return;
    var res = applyCommand(optId);

    if (res.kind === 'win') {
      UI.setDialogue(findLines(optId, 'winLines'));
      UI.render(); // オーバーレイ（勝利）が出る
      return;
    }
    if (res.kind === 'fail') {
      // ほどく失敗：コマンド選択に留まり、失敗テキストを会話欄に出す
      UI.setDialogue(state.pendingFail || findLines(optId, 'failLines'));
      UI.render();
      return;
    }
    if (res.kind === 'dodge') {
      // 村長の応答セリフを会話欄に出してから、感情回避フェーズへ
      UI.setDialogue(findLines(optId, 'lines'));
      UI.render();     // phase=dodge なので、ステージは弾よけパネルに切り替わる
      startDodge();
      return;
    }
    // kind === 'none' は何もしない
  }

  // optId から data.js のセリフ配列を取り出す補助
  function findLines(optId, key) {
    var f = findOption(optId);
    return (f && f.opt[key]) ? f.opt[key] : [];
  }

  /* ───────────── 感情回避フェーズ ───────────── */
  function startDodge() {
    var emotion = state.enemy.emotion;
    // canvas の論理サイズ（460x240）を弾よけエリアの座標系に使う
    field = makeDodgeField({
      emotion: emotion,
      wariness: state.enemy.wariness,
      slow: state.flags.slowNext,    // まって：少しゆっくり
      guard: state.flags.guardNext,  // 沈黙する：被ダメ軽減（集計時に反映）
      w: canvas.width, h: canvas.height
    });
    resetInput();
    UI.setDodgeEmotion(emotion);
    UI.showPhase('dodge');
    UI.setDodgeTimer(field.duration);

    lastT = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    if (!field) return;
    if (!lastT) lastT = ts;
    var dt = (ts - lastT) / 1000;
    lastT = ts;

    tickDodge(field, dt);
    UI.renderDodgeFrame(field);
    UI.setDodgeTimer(Math.max(0, field.duration - field.t));

    if (field.done) { endDodge(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function endDodge() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    var summary = dodgeSummary(field);
    field = null;
    resetInput();
    resolveDodge(summary); // 被ダメ・記憶のかけらを反映＋勝敗判定＋次ターン準備
    UI.render();           // コマンド選択に戻る（または敗北オーバーレイ）
  }

  /* ───────────── 入力（キーボード＋ポインタ） ───────────── */
  function resetInput() {
    if (!field) return;
    field.input.up = field.input.down = field.input.left = field.input.right = false;
    field.input.pointer.active = false;
  }

  function keyToDir(e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown' || k === 's' || k === 'S') return 'down';
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    return null;
  }
  function onKeyDown(e) {
    if (!field || state.phase !== 'dodge') return;
    var dir = keyToDir(e);
    if (dir) { field.input[dir] = true; e.preventDefault(); }
  }
  function onKeyUp(e) {
    if (!field) return;
    var dir = keyToDir(e);
    if (dir) { field.input[dir] = false; }
  }

  // 画面座標 → canvas の論理座標へ変換（CSSで拡大表示されているため）
  function toCanvasXY(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width;
    var sy = canvas.height / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }
  function onPointerDown(e) {
    if (!field || state.phase !== 'dodge') return;
    var p = toCanvasXY(e.clientX, e.clientY);
    field.input.pointer.active = true;
    field.input.pointer.x = p.x; field.input.pointer.y = p.y;
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!field || !field.input.pointer.active) return;
    var p = toCanvasXY(e.clientX, e.clientY);
    field.input.pointer.x = p.x; field.input.pointer.y = p.y;
    e.preventDefault();
  }
  function onPointerUp() {
    if (!field) return;
    field.input.pointer.active = false;
  }

  /* ───────────── リスタート ───────────── */
  function restart() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    field = null;
    restartBattle();
    UI.closeCategory();
    UI.setDialogue(introLines());
    UI.render();
  }

  function introLines() {
    return ['村長は、あなたを じっと 見ている。', 'どの 言葉から はじめる？'];
  }

  /* ───────────── 起動 ───────────── */
  function boot() {
    newBattle();
    UI.renderHowto();
    canvas = UI.initCanvas();
    UI.setDialogue(introLines());
    UI.render();

    // ボタン配線（戻るリンクは <a> なのでJS不要）
    document.getElementById('btn-again').onclick = function () { Game.restart(); };

    // 入力：キーボード（ページ全体で拾う。dodge中だけ反応）
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // 入力：ポインタ（タッチ/マウス兼用）。canvas 上でドラッグ
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  return {
    openCategory: openCategory, closeCategory: closeCategory, choose: choose,
    restart: restart, boot: boot
  };
})();

// DOM ができてからバトル開始
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Game.boot);
} else {
  Game.boot();
}
