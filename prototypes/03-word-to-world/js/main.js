/*
 * main.js — 起動と入力の配線（最後に読み込まれる総元締め）
 *
 * 各モジュール（data/audio/metrics/state/save/battle/cards/field/ui）は
 * <script> で先に読み込み済み。ここでは「ゲームを始める／続ける」と、
 * このゲームの肝である“操作の癖の計測”（クリック・カーソル距離・読み飛ばし）を
 * 裏で常時動かすための入力配線だけを担う。
 *
 * 配線の方針（契約「main.js」節）：
 *   ・#start-btn    → startGame()（initAudio → タイトルを隠す → startMetrics → enterArea("mura")）
 *   ・#continue-btn → continueGame()（loadGame で復帰し、いたエリアから再開）
 *   ・#mute-btn     → toggleMute()（戻り値で表示を ♪ / ♪× に切替）
 *   ・document 全体の click → metrics.noteClick()（せっかちさ＝クリック総数を常時計測）
 *   ・#overlay-field の pointermove / pointerdown
 *        → fieldSetTarget(0..1, 0..1)（マウス追従の目標）＋ noteCursor(dx,dy)（移動距離）
 *   ・requestAnimationFrame ループ：app.screen=="field" のとき fieldStep(now) を進める
 *
 * ★ なぜ計測を main.js に置くか：
 *   metrics は「見られていると気づかせない」のが肝。だから個別画面ではなく、
 *   document/フィールド面の“いちばん外側”で静かに積む。終盤のメタ演出で神様的存在が
 *   この集計を提示して“見透かす”——その土台をここで一度だけ張る。
 *
 * ★ ボタン配線は「イベント委譲」で行う：
 *   ui.renderTitle() はタイトルを描くたびに innerHTML を作り直すため、
 *   #start-btn / #continue-btn / #mute-btn は毎回“別物の要素”に置き換わる。
 *   個別要素へ addEventListener しても再描画で剥がれてしまうので、
 *   document に1回だけ委譲リスナを張り、クリックされた要素の id で振り分ける。
 *   こうすれば再描画後のボタンにも確実に効く。
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提。外部関数は typeof ガードで“呼べたら呼ぶ”。
 */

// ──────────────────────────────────────────
// startGame()：はじめから（音初期化 → タイトルを隠す → 計測開始 → 村へ）
//   契約どおりの順番。initAudio はユーザー操作（クリック）の後に呼ぶ必要があるため、
//   ボタン押下のこの文脈で初めて音を起こす。
// ──────────────────────────────────────────
function startGame() {
  if (typeof initAudio === "function") initAudio();   // 音はユーザー操作のあとで初期化（ブラウザ制約）。

  // 新規ランの器を作る（player/flags/counters/seen…を既定値で用意）。
  if (typeof newGame === "function") newGame();

  // 計測アキュムレータを 0 にして開始時刻を記録（ここからが“癖”の計測の開始点）。
  if (typeof startMetrics === "function") startMetrics();

  // タイトルを隠して村（mura）へ。enterArea が app.screen="field" にし、render() と追従ループを起こす。
  //   applyScreen がタイトルを hidden にするので、ここで明示的に DOM を触る必要はない。
  if (typeof enterArea === "function") enterArea("mura");
}

// ──────────────────────────────────────────
// continueGame()：つづきから（セーブを読み、いたエリアから再開）
//   loadGame は game と metrics の“両方”を復元する（途中ロードでも癖が途切れずメタ演出が成立）。
//   復帰先エリアは保存された currentArea。無ければ村へフォールバック。
// ──────────────────────────────────────────
function continueGame() {
  if (typeof initAudio === "function") initAudio();   // ここも操作後なので音を起こせる。

  // セーブが無い／壊れているなら何もしない（タイトルに留まる）。ボタンは ui が disabled にしている。
  const ok = (typeof loadGame === "function") ? loadGame(0) || loadGame() : false;
  if (!ok) {
    if (typeof showToast === "function") showToast("つづきが みつからなかった…");
    return;
  }

  // 復帰先エリアへ。loadGame が metrics も戻しているので、ここで startMetrics は呼ばない
  //   （呼ぶと計測がリセットされ“癖”が消える＝メタ演出が崩れる）。
  const area = (game && game.currentArea) ? game.currentArea : "mura";
  if (typeof enterArea === "function") enterArea(area);
}

// ──────────────────────────────────────────
// rAF ループ：フィールドにいる間だけ L を追従させる（契約：screen=="field" で fieldStep）
//   field.js も enterArea/backToField で自前の追従ループ（startFieldLoop）を起こす。
//   同じフレームで二重に fieldStep を呼ぶと L が倍速で動いてしまうため、
//   field.js のループが動いていない（field._raf == null）ときだけ、ここが肩代わりする。
//   ＝“単一の歩進”を保ちつつ、契約どおり main がフィールドの rAF 責務を持つ。
// ──────────────────────────────────────────
function _mainLoop(now) {
  if (typeof app !== "undefined" && app && app.screen === "field") {
    // field.js の専用ループが回っていない時だけ、main が fieldStep を進める（二重歩進の回避）。
    const fieldLoopIdle = (typeof field === "undefined") || !field || field._raf == null;
    if (fieldLoopIdle && typeof fieldStep === "function") fieldStep(now);
  }
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(_mainLoop);
}

window.addEventListener("DOMContentLoaded", () => {

  // ── ① ボタン配線（イベント委譲）──────────────────
  //   タイトル再描画で要素が作り直されても効くよう、document に1回だけ張る。
  //   closest を使い、ボタン内の文字やアイコンをクリックしても拾えるようにする。
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || typeof t.closest !== "function") return;

    // はじめから
    if (t.closest("#start-btn")) {
      if (typeof playSe === "function") playSe("select");
      startGame();
      return;
    }
    // つづきから（無効化ボタンは押されても無視）
    const cont = t.closest("#continue-btn");
    if (cont) {
      if (cont.disabled || cont.classList.contains("disabled")) return;
      if (typeof playSe === "function") playSe("select");
      continueGame();
      return;
    }
    // 音の ON/OFF（戻り値が「いまミュート中か」。表示を ♪ / ♪× に合わせる）
    const mute = t.closest("#mute-btn");
    if (mute) {
      const muted = (typeof toggleMute === "function") ? toggleMute() : false;
      mute.textContent = muted ? "♪×" : "♪";
      return;
    }
  });

  // ── ② クリック総数の計測（せっかちさ）──────────────
  //   ①と同じ click だが、こちらは「数えるだけ」。capture 段で拾い、
  //   どのボタンでも・どこをクリックしても確実に1回ぶん積む（操作量の指標）。
  document.addEventListener("click", () => {
    if (typeof noteClick === "function") noteClick();
  }, true); // capture=true：他のハンドラより先に必ず数える。

  // ── ③ フィールド面のマウス追従＋カーソル距離の計測 ──
  //   pointermove はマウス移動でもタッチのドラッグでも発火する（クリック不要）。
  //   .field-road の矩形でマウス座標を 0..1 に正規化し、fieldSetTarget へ渡す＝Lが向かう先。
  //   同時に、前フレームからの移動量（dx,dy）を noteCursor に積む＝“落ち着きのなさ”の指標。
  const fieldOverlay = document.getElementById("overlay-field");
  if (fieldOverlay) {
    // カーソル距離は「前回位置との差分」で測る。pointer の movementX/Y は環境差があるため、
    //   自前で直前座標を覚えて引き算する（どのブラウザでも同じ尺度で積める）。
    let lastX = null, lastY = null;

    const aim = (e) => {
      // フィールド以外（会話・戦闘中など）では追従も計測もしない。
      if (typeof app === "undefined" || !app || app.screen !== "field") return;

      // カーソル移動距離を加算（前回位置がある時だけ。最初の1点は基準作りで距離0）。
      if (lastX !== null && typeof noteCursor === "function") {
        noteCursor(e.clientX - lastX, e.clientY - lastY);
      }
      lastX = e.clientX; lastY = e.clientY;

      // マウス座標 → 道面の 0..1 へ。基準は .field-road（getBoundingClientRect）。
      const road = document.querySelector(".field-road");
      if (!road || typeof fieldSetTarget !== "function") return;
      const r = road.getBoundingClientRect();
      if (!r.width || !r.height) return; // 非表示・未レイアウト時は触らない（0除算回避）。
      fieldSetTarget((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };

    fieldOverlay.addEventListener("pointermove", aim);
    fieldOverlay.addEventListener("pointerdown", aim); // タップ／クリックでも その方向へ向かう。
  }

  // ── ④ タイトルの初期表示を整える ＆ 追従ループを起こす ──
  //   index.html はタイトルの骨格（#start-btn/#continue-btn/#mute-btn）を静的に持つので、
  //   起動直後に render() を呼ばなくてもタイトルは見える。
  //   ★ここで render() を呼ばない理由：タイトル時点では game がまだ null。
  //     ui.render()→applyDark()→darkLevel() は game.player.tendency を読むため、
  //     game 未生成のまま描くと落ちる。だから初回はゲーム開始（startGame/continueGame で
  //     newGame/loadGame 後）に任せ、ここでは「つづきから」の活性判定だけ自前で行う。
  const cont = document.getElementById("continue-btn");
  if (cont) {
    const hasAny = (typeof hasSave === "function") ? (hasSave(0) || hasSave()) : false;
    cont.disabled = !hasAny;
    cont.classList.toggle("disabled", !hasAny);
  }

  // フィールド用の rAF ループを起動（中身は screen=="field" のときだけ働く）。
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(_mainLoop);
});

// ── グローバル公開（契約：startGame / continueGame をグローバルに）。
//   タイトルのボタンは委譲で拾うが、外（コンソール検証や将来の配線）からも呼べるようにしておく。
if (typeof window !== "undefined") {
  window.startGame = startGame;
  window.continueGame = continueGame;
}
