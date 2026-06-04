/*
 * main.js — 起動と配線
 *
 * 各モジュール（data/audio/save/state/battle/cards/field/ui）は <script> で先に読み込み済み。
 * ここでタイトルのボタン・設定・つづきから・離脱時セーブをつなぎ、ゲームを始める。
 */

// 「はじめる」＝新しい旅（保存があっても まっさらから。次の保存点＝街/結末 で上書きされる）。
function startGame() {
  initAudio();        // 音はユーザー操作のあとで初期化（ブラウザの制約）
  meta = null;        // 新規の旅＝メタを作り直す（enterTown が initMeta する）
  hideOverlay("overlay-title");
  showOverlay("overlay-prologue"); // プロローグ表示。つづける/スキップ どちらでも街へ
}

// プロローグを閉じて 第一夜の街へ
function enterTownFromPrologue() {
  hideOverlay("overlay-prologue");
  enterTown();        // field.js：meta初期化＋街BGM＋描画（第一夜の街へ）
}

// 「つづきから」＝保存したメタ進行を復元し、その夜の街から再開（プロローグはスキップ）。
function continueGame() {
  initAudio();
  const m = (typeof loadProgress === "function") ? loadProgress() : null;
  if (!m) { startGame(); return; }
  meta = m;
  hideOverlay("overlay-title");
  enterTown();
}

// 設定メニューの 値ラベルを いまの SETTINGS に合わせる。
function refreshSettingsLabels() {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  if (typeof SETTINGS === "undefined") return;
  set("set-mute-v", SETTINGS.muted ? "OFF" : "ON");
  set("set-motion-v", SETTINGS.reduceMotion ? "ひかえめ" : "ふつう");
  set("set-text-v", SETTINGS.bigText ? "おおきめ" : "ふつう");
  const mb = document.getElementById("mute-btn"); if (mb) mb.textContent = SETTINGS.muted ? "♪×" : "♪";
}
function openSettings() { refreshSettingsLabels(); showOverlay("overlay-settings"); }
function closeSettings() { hideOverlay("overlay-settings"); }

window.addEventListener("DOMContentLoaded", () => {
  // ── 設定を 読み込んで 反映（音/モーション/文字の大きさ）──
  if (typeof loadSettings === "function") loadSettings();
  if (typeof applySettings === "function") applySettings();

  // タイトルの開始ボタン
  document.getElementById("start-btn").addEventListener("click", () => { playSe("select"); startGame(); });

  // つづきから（セーブがある時だけ表示）
  const cont = document.getElementById("title-continue");
  const sum = (typeof saveSummary === "function") ? saveSummary() : null;
  if (cont && sum) {
    cont.classList.remove("hidden");
    cont.textContent = `▶ つづきから（${sum.nightLabel}・なかま ${sum.friends}）`;
    cont.addEventListener("click", () => { playSe("select"); continueGame(); });
  }

  // 設定メニューの 開閉と トグル
  const ts = document.getElementById("title-settings");
  if (ts) ts.addEventListener("click", () => { playSe("select"); openSettings(); });
  const sclose = document.getElementById("set-close");
  if (sclose) sclose.addEventListener("click", () => { playSe("select"); closeSettings(); });
  const toggle = (id, key) => {
    const e = document.getElementById(id);
    if (e) e.addEventListener("click", () => {
      SETTINGS[key] = !SETTINGS[key];
      if (typeof applySettings === "function") applySettings();
      if (typeof saveSettings === "function") saveSettings();
      refreshSettingsLabels();
      playSe("select");
    });
  };
  toggle("set-mute", "muted");
  toggle("set-motion", "reduceMotion");
  toggle("set-text", "bigText");
  const sclear = document.getElementById("set-clear");
  if (sclear) sclear.addEventListener("click", () => {
    if (typeof clearSave === "function") clearSave();
    const c = document.getElementById("title-continue"); if (c) c.classList.add("hidden");
    closeSettings();
    if (typeof showToast === "function") showToast("セーブを けしました。タイトルから はじめから。");
  });

  // 音のON/OFF（戦闘上部の ♪）。toggleMute が SETTINGS に同期＆保存する。
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

  // 離脱（タブを隠す/閉じる）時に メタ進行を保存＝「借り物の保存領域」でも 取りこぼしを減らす（Web定石）。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && typeof saveProgress === "function") {
      try { saveProgress(); } catch (e) {}
    }
  });
});
