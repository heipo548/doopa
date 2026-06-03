/*
 * main.js — 起動と配線
 *
 * 各モジュール（data/audio/state/battle/cards/ui）は <script> で先に読み込み済み。
 * ここでタイトル画面のボタンやミュートをつなぎ、ゲームを始める。
 */

// ゲーム開始（タイトルの「はじめる」から呼ぶ）
//   v0.4：いきなり戦闘ではなく、まず「プロローグ（物語の入口）」→「街（拠点）」へ。
//        街 → 夜のフィールド → 戦闘 → 夜明けで街にかえる、の周回の入口。
function startGame() {
  initAudio();        // 音はユーザー操作のあとで初期化（ブラウザの制約）
  hideOverlay("overlay-title");
  showOverlay("overlay-prologue"); // プロローグ表示。つづける/スキップ どちらでも街へ（main の配線）
}

// プロローグを閉じて 第一夜の街へ
function enterTownFromPrologue() {
  hideOverlay("overlay-prologue");
  enterTown();        // field.js：meta初期化＋街BGM＋描画（第一夜の街へ）
}

window.addEventListener("DOMContentLoaded", () => {
  // タイトルの開始ボタン
  document.getElementById("start-btn").addEventListener("click", () => {
    playSe("select");
    startGame();
  });

  // 音のON/OFF
  document.getElementById("mute-btn").addEventListener("click", () => {
    const muted = toggleMute();
    document.getElementById("mute-btn").textContent = muted ? "♪×" : "♪";
  });

  // プロローグ：つづける/スキップ どちらでも 第一夜の街へ（マウスのみ）。
  const pgo = document.getElementById("prologue-go");
  if (pgo) pgo.addEventListener("click", () => { playSe("select"); enterTownFromPrologue(); });
  const pskip = document.getElementById("prologue-skip");
  if (pskip) pskip.addEventListener("click", () => { enterTownFromPrologue(); });

  // 夜のフィールドは「マウスカーソル追従」で 自由に歩く（キーボードは使わせない）。
  //   ポインタの 横位置(=朝への前進)＋縦位置(=道幅) を field に渡し、ぽちが そこへ なめらかに追従する。
  //   pointermove はマウス移動でもタッチのドラッグでも発火する（クリック不要）。
  const fieldOverlay = document.getElementById("overlay-field");
  if (fieldOverlay) {
    const aim = (e) => {
      if (typeof app === "undefined" || !app || app.screen !== "field") return;
      const road = document.querySelector(".field-road");
      if (!road || typeof fieldSetTarget !== "function") return;
      const r = road.getBoundingClientRect();
      if (!r.width || !r.height) return;
      fieldSetTarget((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    fieldOverlay.addEventListener("pointermove", aim);
    fieldOverlay.addEventListener("pointerdown", aim); // タップでも その方向へ向かう
  }
});
