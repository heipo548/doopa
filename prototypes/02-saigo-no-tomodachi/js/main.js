/*
 * main.js — 起動と配線
 *
 * 各モジュール（data/audio/state/battle/cards/ui）は <script> で先に読み込み済み。
 * ここでタイトル画面のボタンやミュートをつなぎ、ゲームを始める。
 */

// ゲーム開始（タイトルの「はじめる」から呼ぶ）
function startGame() {
  initAudio();        // 音はユーザー操作のあとで初期化（ブラウザの制約）
  startBgm("night");  // 夜のBGM
  hideOverlay("overlay-title");
  startRun();         // battle.js：newGame → 最初のウェーブ
  render();           // ui.js：画面描画
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

  // キーボードでも音切替（M）。気軽に消せるように。
  window.addEventListener("keydown", (e) => {
    if (e.key === "m" || e.key === "M") {
      const muted = toggleMute();
      document.getElementById("mute-btn").textContent = muted ? "♪×" : "♪";
    }
  });
});
