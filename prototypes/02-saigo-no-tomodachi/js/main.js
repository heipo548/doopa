/*
 * main.js — 起動と配線
 *
 * 各モジュール（data/audio/state/battle/cards/ui）は <script> で先に読み込み済み。
 * ここでタイトル画面のボタンやミュートをつなぎ、ゲームを始める。
 */

// ゲーム開始（タイトルの「はじめる」から呼ぶ）
//   v0.4：いきなり戦闘ではなく、まず「街（拠点）」へ。
//        街 → 夜のフィールド → 戦闘 → 夜明けで街にかえる、の周回の入口。
function startGame() {
  initAudio();        // 音はユーザー操作のあとで初期化（ブラウザの制約）
  hideOverlay("overlay-title");
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

  // 夜のフィールドは「マウスカーソル追従」で歩く（キーボードは使わせない）。
  //   ポインタの横位置（道に対する割合）を field に渡し、ぽちが そこへ なめらかに追従する。
  //   pointermove はマウス移動でもタッチのドラッグでも発火する（クリック不要）。
  const fieldOverlay = document.getElementById("overlay-field");
  if (fieldOverlay) {
    const aim = (e) => {
      if (typeof app === "undefined" || !app || app.screen !== "field") return;
      const road = document.querySelector(".field-road");
      if (!road || typeof fieldSetTarget !== "function") return;
      const r = road.getBoundingClientRect();
      if (!r.width) return;
      fieldSetTarget((e.clientX - r.left) / r.width);
    };
    fieldOverlay.addEventListener("pointermove", aim);
    fieldOverlay.addEventListener("pointerdown", aim); // タップでも その方向へ向かう
  }
});
