/*
 * ui.js — 画面の描画とプレイヤー入力（プロト#03「WO_RD → WORLD」）
 *
 * このファイルだけが DOM を触る。他ファイル（battle/cards/field/…）は
 * 「何が起きたか」を game.fx / game.log / game.battle 等に積むだけで、見せ方はすべてここに集約する
 * （02-saigo-no-tomodachi の流儀：render() の switch ＋ playFx キュー ＋ creatureSVG ＋ トースト）。
 *
 * ── このゲームで絶対に外せない描画ルール（署名メカニクス）──
 *   1. 敵には“ふたつのゲージ”があるが、UI に出すのは「精神HP(mindHp)」と「プレイヤーhp」だけ。
 *      「思いやり(omoiyari)」は数値もバーも吹き出しも一切描かない（急ぐ人ほど無意識に harsh＝凶暴へ流れる核）。
 *      ＝ playFx は battle.js が積んだイベントしか描かず、kind の充填量は最初から積まれていない。
 *   2. 主人公 L だけが darkLevel() に応じて翳る：body へ dark-1/2/3 を付け、L のセリフは
 *      isUnstable() のとき .unstable で文字を揺らす／口を不穏化する（世界が翳る体感）。
 *   3. テキストは typewriter で1文字ずつ。全文表示前にクリック＝スキップ。
 *      提示で textShown(len)、送りで textAdvanced({skipped})（metrics.js のグローバル関数）。
 *      ＝「言葉を覚える」ゲームで言葉を飛ばした人ほど、終盤のメタ演出で見透かされる。
 *   4. 終盤 renderMeta：神様的存在が metricsSummary を提示し、最後に「WO_RD」へ L を差し込み「WORLD」を見せる。
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提。普通の <script>（…→ field.js → ui.js → main.js）で読む。
 *   外部関数は typeof ガードで“呼べたら呼ぶ”（検証チェッカで単体 eval しても落ちないように）。
 *   末尾で window へ明示エクスポートする。
 */

// 入力の途中状態（どの画面の・何を選びかけているか）。02 の ui.mode に倣う最小の状態。
const ui = {
  typing: null,   // 現在の typewriter 状態（{ text, i, el, timer, done, onDone, skipMeasured }）。
  lastDark: -1,   // 直近で body に反映した darkLevel（毎フレーム class を付け替えないための差分）。
};

// よく使う DOM 取得＆生成のヘルパー（02 と同形）。
function $(id) { return document.getElementById(id); }
function setText(id, text) { const e = $(id); if (e) e.textContent = text; }
// HTML 文字列に値を差し込む前のエスケープ（ことば/名前に < > & が混ざっても壊れないように）。
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────
// ピクセルスプライト生成（ドット絵）— 02 の creatureSVG の流儀を踏襲
//   16×16 の正方形セル（ピクセル）の集合で生きものを描く。色は対象ごとの色。
//   crispEdges＋整数座標で“カクカクのドット”の質感を出す。重い計算なのでキャッシュ。
//   ★本作の shape：robot(=L/主人公) / villager / circle / ghost / bunny / boss。
//     expr：neutral / happy / sad / unstable（L のダーク化で unstable を使う）。
// ──────────────────────────────────────────
const SPR = 16;
const _spriteCache = {};

function _hex2rgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function _rgb2hex(a) {
  return "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function shade(hex, f) { const [r, g, b] = _hex2rgb(hex); return _rgb2hex([r * (1 - f), g * (1 - f), b * (1 - f)]); } // 暗く
function tint(hex, f) { const [r, g, b] = _hex2rgb(hex); return _rgb2hex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]); } // 明るく

// 形ごとの体型（楕円）。全部おなじ丸を脱却し、シルエットで描き分ける（02 SHAPE_BODY に倣う）。
//   robot＝主人公 L：四角めの頭（後で _accent で角ばらせる）。boss＝大きく威圧的。
const SHAPE_BODY = {
  robot:    { cx: 8, cy: 9, rx: 6, ry: 6 },   // L：箱型に見せるため後で四隅を埋める
  villager: { cx: 8, cy: 9, rx: 5, ry: 6 },   // 村人：縦長で人型っぽく
  circle:   { cx: 8, cy: 10, rx: 6, ry: 5 },  // ずんぐり丸（かわいい）
  bunny:    { cx: 8, cy: 9, rx: 5, ry: 6 },   // 縦長＋長い耳
  ghost:    { cx: 8, cy: 8, rx: 6, ry: 6 },   // 下を波打たせる
  boss:     { cx: 8, cy: 9, rx: 7, ry: 8 },   // 大きく縦に伸びて威圧的
};
function _inE(x, y, b) { const dx = (x - b.cx + 0.5) / b.rx, dy = (y - b.cy + 0.5) / b.ry; return dx * dx + dy * dy <= 1; }

// 16×16 のカラーグリッド（null=透明）から、横方向の連続を1つの <rect> にまとめて SVG 文字列を作る。
function _gridToRects(grid) {
  let out = "";
  for (let y = 0; y < SPR; y++) {
    let x = 0;
    while (x < SPR) {
      const c = grid[y][x];
      if (c == null) { x++; continue; }
      let w = 1;
      while (x + w < SPR && grid[y][x + w] === c) w++;
      out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  }
  return out;
}

// 形ごとのアクセント（L の角・アンテナ・耳・冠・ゴーストの裾）をグリッドに足す。
function _accent(grid, shape, col) {
  const put = (x, y, c) => { if (x >= 0 && x < SPR && y >= 0 && y < SPR) grid[y][x] = c; };
  if (shape === "robot") {
    // L＝アンドロイド：頭を箱型に（楕円の上を四角く埋める）＋頭頂のアンテナ（world の欠片＝L の象徴）。
    for (let x = 4; x <= 11; x++) { put(x, 3, col.body); put(x, 4, col.body); }
    put(4, 3, col.OUT); put(11, 3, col.OUT);
    put(8, 1, "#9fe8ff"); put(8, 2, col.OUT);  // アンテナの先＝小さな水色の灯り（L のサイン）。
    // 胴の左右に“ボルト”の点（無機質さ）。
    put(2, 10, col.dark); put(13, 10, col.dark);
  } else if (shape === "villager") {
    // 村人：頭の上に小さなフード/髪の出っぱり。人の好さの記号。
    [[6, 2], [7, 2], [8, 2], [9, 2]].forEach(([x, y]) => put(x, y, col.dark));
    [[6, 2], [9, 2]].forEach(([x, y]) => put(x, y, col.OUT));
  } else if (shape === "circle") {
    [[4, 1], [4, 2], [11, 1], [11, 2]].forEach(([x, y]) => put(x, y, col.body)); // ちいさな丸い耳
    [[4, 1], [11, 1]].forEach(([x, y]) => put(x, y, col.OUT));
  } else if (shape === "bunny") {
    [[4, 0], [4, 1], [4, 2], [5, 2], [11, 0], [11, 1], [11, 2], [10, 2]].forEach(([x, y]) => put(x, y, col.body)); // 長い耳
    [[4, 0], [11, 0]].forEach(([x, y]) => put(x, y, col.OUT));
    put(4, 1, "#ff9ab0"); put(11, 1, "#ff9ab0"); // 耳の内側のピンク
  } else if (shape === "boss") {
    [[5, 1], [7, 0], [9, 1]].forEach(([x, y]) => put(x, y, "#ffd86b"));            // 冠
    [[5, 2], [6, 2], [7, 2], [8, 2], [9, 2]].forEach(([x, y]) => put(x, y, "#e0b24a"));
    [[2, 2], [2, 1], [13, 2], [13, 1]].forEach(([x, y]) => put(x, y, col.OUT));    // 左右の角
  } else if (shape === "ghost") {
    // 裾をギザギザに（足なし・ふわふわ）。下の行を互い違いに抜いて“おばけの裾”に。
    for (let x = 0; x < SPR; x++) { if (grid[14] && x % 2 === 0) grid[14][x] = null; }
    if (grid[13]) { grid[13][2] = null; grid[13][13] = null; }
  }
}

// 顔（表情）：neutral=つぶら / happy=ニコッ / sad=泣き / unstable=L の不穏化（目が線・口がギザ）。
//   座標は体型 b 基準で置き、shape ごとのズレを防ぐ（02 _face に倣い、unstable を本作で追加）。
function _face(grid, expr, b) {
  b = b || SHAPE_BODY.circle;
  const OUT = "#20203a", W = "#ffffff", TEAR = "#7fd0ff", M = "#20203a", BLUSH = "#ff9ab0", GLITCH = "#c8407a";
  const put = (x, y, c) => { if (x >= 0 && x < SPR && y >= 0 && y < SPR) grid[y][x] = c; };
  const lx = b.cx - 4, rx = b.cx + 2, ey = b.cy - 2, my = b.cy + 1; // 左目/右目/目の高さ/口の高さ

  if (expr === "unstable") {
    // L が翳ったときの顔：ほっぺの赤みを消し、目を細い横線、口をギザギザに＝壊れかけ/口が悪い記号。
    [[lx, ey], [lx + 1, ey], [rx, ey], [rx + 1, ey]].forEach(([x, y]) => put(x, y, GLITCH));
    [[b.cx - 2, my], [b.cx - 1, my + 1], [b.cx, my], [b.cx + 1, my + 1], [b.cx + 2, my]].forEach(([x, y]) => put(x, y, M));
    return;
  }

  put(b.cx - 5, b.cy - 1, BLUSH); put(b.cx + 4, b.cy - 1, BLUSH); // ほっぺ
  if (expr === "happy") {
    [[lx, ey + 1], [lx + 1, ey], [rx, ey], [rx + 1, ey + 1]].forEach(([x, y]) => put(x, y, OUT)); // ＾ ＾
    [[b.cx - 3, my], [b.cx - 2, my + 1], [b.cx - 1, my + 1], [b.cx, my + 1], [b.cx + 1, my + 1], [b.cx + 2, my]].forEach(([x, y]) => put(x, y, M));
  } else {
    [[lx, ey], [lx + 1, ey], [lx, ey + 1], [lx + 1, ey + 1], [rx, ey], [rx + 1, ey], [rx, ey + 1], [rx + 1, ey + 1]].forEach(([x, y]) => put(x, y, OUT));
    put(lx, ey, W); put(rx, ey, W); put(lx + 1, ey + 1, W); put(rx + 1, ey + 1, W); // きらめき
    if (expr === "sad") {
      [[b.cx - 1, my], [b.cx, my], [b.cx - 1, my + 1], [b.cx, my + 1]].forEach(([x, y]) => put(x, y, M));
      put(lx, ey + 2, TEAR); put(lx, ey + 3, TEAR); // なみだ
    } else {
      [[b.cx - 1, my], [b.cx, my]].forEach(([x, y]) => put(x, y, M)); // ちいさな口（neutral）
    }
  }
}

// 生きもの1体ぶんの SVG（色・形・表情）。契約：robot/villager/circle/ghost/bunny/boss × neutral/happy/sad/unstable。
function creatureSVG(color, shape, expr) {
  const key = color + "|" + shape + "|" + expr;
  if (_spriteCache[key]) return _spriteCache[key];
  const grid = [];
  for (let y = 0; y < SPR; y++) grid.push(new Array(SPR).fill(null));
  const OUT = "#241a40";
  const body = color, dark = shade(color, 0.3), light = tint(color, 0.42);
  const b = SHAPE_BODY[shape] || SHAPE_BODY.circle;
  for (let y = 0; y < SPR; y++) for (let x = 0; x < SPR; x++) {
    if (!_inE(x, y, b)) continue;
    const edge = !_inE(x - 1, y, b) || !_inE(x + 1, y, b) || !_inE(x, y - 1, b) || !_inE(x, y + 1, b);
    if (edge) grid[y][x] = OUT;
    else if (y <= b.cy - 3) grid[y][x] = light;  // 上＝ハイライト
    else if (y >= b.cy + 3) grid[y][x] = dark;   // 下＝シェード
    else grid[y][x] = body;
  }
  _accent(grid, shape, { body, dark, OUT });
  _face(grid, expr, b);
  const svg = `<svg class="spr" viewBox="0 0 ${SPR} ${SPR}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${_gridToRects(grid)}</svg>`;
  _spriteCache[key] = svg;
  return svg;
}
// L（主人公）専用ヘルパ：翳っていれば unstable 顔で描く＝“主人公だけが翳る”を絵でも出す。
function playerSVG(expr) {
  const e = (typeof isUnstable === "function" && isUnstable()) ? "unstable" : (expr || "neutral");
  return creatureSVG("#cfe3ee", "robot", e); // L は無機質な薄い水色（アンドロイド）。
}

// ──────────────────────────────────────────
// 不穏化テキスト：L のセリフを darkLevel に応じて翳らせる
//   ・isUnstable() のとき .unstable クラスで包む（CSS が文字を揺らす）。
//   ・darkLevel が深いほど、語尾を不穏に（口が悪くなる）＝“言葉を覚えたのに、口だけ回る”の予感。
//   呼び出し側は span.unstable を innerHTML に差し込む。typewriter とは別系統（地の文の演出用）。
// ──────────────────────────────────────────
function lWord(text) {
  const t = esc(text);
  if (typeof isUnstable !== "function" || !isUnstable()) return t;
  return `<span class="unstable">${t}</span>`;
}

// ──────────────────────────────────────────
// 画面全体を描画：app.screen で大きく分岐（契約の render() switch）。
//   "title"|"field"|"battle"|"cards"|"shop"|"dialogue"|"result"|"meta"|"pause"
//   まずオーバーレイの表示/非表示を切り替え、body の dark-N を更新してから各 render を呼ぶ。
// ──────────────────────────────────────────
function render() {
  const sc = (typeof app !== "undefined" && app) ? app.screen : "title";
  applyScreen(sc);   // 画面コンテナ（#game / 各 .overlay）の表示・非表示
  applyDark();       // body の dark-1/2/3（主人公だけ翳る世界）
  switch (sc) {
    case "title":    renderTitle(); break;
    case "field":    renderField(); break;
    case "battle":   renderBattle(); break;
    case "cards":    renderCards(); break;
    case "shop":     renderShop(); break;
    case "dialogue": renderDialogue(); break;
    case "result":   renderResult(); break;
    case "meta":     renderMeta(); break;
    case "pause":    renderPause(); break;
    default:         renderTitle(); break; // 未知画面はタイトルへ倒す（安全側）。
  }
}

// 画面コンテナの表示/非表示。#game（バトルHUD）と各オーバーレイを app.screen に合わせて出し入れする。
//   契約：#game は class hidden を付け、バトル時だけ表示。オーバーレイは class="overlay" を hidden でトグル。
function applyScreen(sc) {
  const setShow = (id, show) => { const e = $(id); if (e) e.classList.toggle("hidden", !show); };
  setShow("game", sc === "battle");
  setShow("overlay-title", sc === "title");
  setShow("overlay-field", sc === "field");
  setShow("overlay-dialogue", sc === "dialogue");
  setShow("overlay-cards", sc === "cards");
  setShow("overlay-shop", sc === "shop");
  setShow("overlay-result", sc === "result");
  setShow("overlay-meta", sc === "meta");
  setShow("overlay-pause", sc === "pause");
}

// 主人公 L の翳り（darkLevel 0..3）を body の class へ反映する。
//   ★ダーク化は L だけの演出。body に dark-1/2/3 を付け、CSS が画面をそっと翳らせる。
//   既定は theme-pop（index.html が付与）。ここでは dark-N の差し替えだけ行う（毎フレーム無駄に書き換えない）。
function applyDark() {
  const dl = (typeof darkLevel === "function") ? darkLevel() : 0;
  if (dl === ui.lastDark) return;     // 変化がなければ何もしない（fieldStep が毎フレーム render を呼ぶため）。
  ui.lastDark = dl;
  const body = document.body;
  if (!body) return;
  body.classList.remove("dark-1", "dark-2", "dark-3");
  if (dl >= 1) body.classList.add("dark-" + Math.min(3, dl));
}

// ──────────────────────────────────────────
// typewriter — テキストを1文字ずつ表示し、クリックで送る／全文前のクリックでスキップ
//   ・提示開始で textShown(len)。
//   ・全文タイプ前にクリックして送ったら textAdvanced({skipped:true})＝読み飛ばし。
//   ・全文表示後のクリックは textAdvanced({skipped:false})。
//   onDone：このブロックを“送り切った”ときに呼ぶコールバック（次の行へ／会話終了など）。
//   ★ここが本作の肝の入口：飛ばした人ほど終盤のメタで見透かされる。
// ──────────────────────────────────────────
function typeInto(el, text, onDone) {
  if (!el) { if (onDone) onDone(); return; }
  // 直前のブロックが残っていたら締めてから（多重起動の保険。skipped 扱いにはしない）。
  finishTyping(false, true);

  const t = String(text == null ? "" : text);
  ui.typing = { text: t, i: 0, el: el, timer: null, done: false, onDone: onDone || null, skipMeasured: false };

  // 提示した瞬間に metrics へ「何文字 出したか」を伝える（滞在時間の計測開始）。
  //   ※ textShown / textAdvanced は metrics.js が定義する“グローバル関数”（metrics.メソッドではない）。
  if (typeof textShown === "function") textShown(t.length);

  el.classList.add("typing");
  el.textContent = "";
  _typeTick();
}

// 1文字ずつ進める内部ループ。改行は <br> に直すため textContent ではなく innerHTML を組み立てる。
function _typeTick() {
  const s = ui.typing;
  if (!s) return;
  if (s.i >= s.text.length) {       // 打ち切った＝全文表示完了。
    s.done = true;
    s.el.classList.remove("typing");
    s.el.classList.add("typed");
    return;
  }
  s.i++;
  // 改行を <br> にしてそのまま表示（esc 済みの安全な断片だけを入れる）。
  s.el.innerHTML = esc(s.text.slice(0, s.i)).replace(/\n/g, "<br>");
  // page 音は重くならないよう数文字に1回（02 のテキスト送り微音に倣う）。
  if (s.i % 3 === 0 && typeof playSe === "function") playSe("page");
  s.timer = setTimeout(_typeTick, 22); // 22ms/字＝読みやすく、急ぐ人はスキップしたくなる速さ。
}

// 現在のブロックを「送る」。全文前なら一気に表示してスキップ計測、全文後なら次へ進める。
//   silent=true は内部の締め直し用（metrics を汚さない）。
//   戻り値：true=このブロックを最後まで送り切って onDone を呼んだ／false=途中まで（全文表示しただけ）。
function finishTyping(advanced, silent) {
  const s = ui.typing;
  if (!s) return false;

  if (!s.done) {
    // まだタイプ途中でクリック＝スキップ（全文を即表示し、metrics に skipped を記録）。
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.el.innerHTML = esc(s.text).replace(/\n/g, "<br>");
    s.el.classList.remove("typing");
    s.el.classList.add("typed");
    s.done = true;
    if (!silent && !s.skipMeasured) {
      s.skipMeasured = true;
      if (typeof textAdvanced === "function") textAdvanced({ skipped: true });
    }
    return false; // 1回目のクリックは「全文を出す」まで。次へは進めない（読み切る猶予を一拍残す）。
  }

  // すでに全文表示済み＝このブロックを“送り切る”。
  if (!silent && !s.skipMeasured) {
    s.skipMeasured = true;
    // 全文を読み切ってから送った＝skipped:false（ちゃんと読んだ）。
    if (typeof textAdvanced === "function") textAdvanced({ skipped: false });
  }
  const cb = s.onDone;
  ui.typing = null;
  if (advanced && cb) cb();
  return true;
}

// 画面上のテキストをクリックで進める共通入口（各画面の本文要素に bind する）。
//   1回目：タイプ中なら全文表示（スキップ計測）／全文済みなら次へ。main.js の click でも拾える。
function advanceText() {
  finishTyping(true, false);
}

// ──────────────────────────────────────────
// renderTitle — タイトル（欠けた綴り「WO_RD」とプロローグ）
//   logo は WO_RD（L が抜けている＝主人公 L が世界の欠片という伏線）。
//   開始/つづきから/ミュート は index.html の #start-btn #continue-btn #mute-btn を使う（main.js が配線）。
//   ここでは表示の更新だけ（つづきから の活性／プロローグの流し込み）。
// ──────────────────────────────────────────
function renderTitle() {
  const ov = $("overlay-title");
  if (!ov) return;
  const body = ov.querySelector(".ov-body") || ov;

  const T = (typeof TITLE !== "undefined") ? TITLE : { logo: "WO_RD", sub: "", prologue: [], estPlay: "" };
  // 欠けた綴り：W O _ R D。アンダースコア部分を .gap で示し、終盤の WORLD 化への布石にする。
  const logoChars = String(T.logo || "WO_RD").split("").map((c) =>
    c === "_" ? `<span class="logo-ch gap">_</span>` : `<span class="logo-ch">${esc(c)}</span>`
  ).join("");

  body.innerHTML = `
    <div class="title-logo" aria-label="WO_RD">${logoChars}</div>
    <p class="title-sub">${esc(T.sub || "")}</p>
    <div class="title-prologue">${(T.prologue || []).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    <div class="title-actions">
      <button id="start-btn" class="start-btn">▶ はじめる</button>
      <button id="continue-btn" class="start-btn ghost">つづきから</button>
      <button id="mute-btn" class="mute-btn" title="音の ON/OFF">♪</button>
    </div>
    <p class="title-est">${esc(T.estPlay || "")}</p>
  `;
  // つづきから：セーブが無ければ押せない（save.js の hasSave）。
  const cont = $("continue-btn");
  if (cont) {
    const ok = (typeof hasSave === "function") ? hasSave(0) || hasSave() : false;
    cont.disabled = !ok;
    cont.classList.toggle("disabled", !ok);
  }
}

// ──────────────────────────────────────────
// renderField — マウス追従で歩く“道”（ポップな村／不穏な洞窟）
//   field.js の field（x,y,nodes,message…）を読んで描く。歩行は field.js の rAF が回し、
//   毎フレーム render() が呼ばれる。ここでは L・道・node・足元メッセージを描き直すだけ。
//   .field-road は main.js が getBoundingClientRect でマウス→0..1 に変換する基準面。
// ──────────────────────────────────────────
function renderField() {
  const ov = $("overlay-field");
  if (!ov) return;
  const bodyEl = ov.querySelector(".field-body");
  if (!bodyEl) return;

  const f = (typeof field !== "undefined") ? field : { x: 0.02, y: 0.5, nodes: [], message: "", paused: false };
  const areaName = (typeof AREAS !== "undefined" && AREAS[f.areaId]) ? AREAS[f.areaId].name : "";

  // L の位置（0..1 → %）。y は 0..1 で 0.5 が道の中央。
  const lLeft = Math.round((f.x || 0) * 100);
  const lTop = Math.round((typeof f.y === "number" ? f.y : 0.5) * 100);

  // node を道の上に配置。requires 未達はグレーアウト（通れない）、_done は薄く、近接（_glow）は光らせる。
  const nodeIcon = { npc: "💬", enemy: "⚔", boss: "★", sign: "📜", save: "✦", school: "🏫", exit: "🚪" };
  const nodesHtml = (f.nodes || []).map((n) => {
    const left = Math.round((typeof n.x === "number" ? n.x : 0.5) * 100);
    const top = Math.round((typeof n.y === "number" ? n.y : 0.5) * 100);
    const passable = (typeof nodePassable === "function") ? nodePassable(n) : true;
    const glow = (!n._done && passable && (n._glow || 0) > 0.2) ? "near" : "";
    const cls = [
      "road-node", "node-" + n.type,
      n._done ? "done" : "",
      passable ? "" : "locked",
      glow,
    ].filter(Boolean).join(" ");
    const icon = nodeIcon[n.type] || "・";
    return `<span class="${cls}" style="left:${left}%;top:${top}%" title="${esc(n.type)}">${icon}</span>`;
  }).join("");

  bodyEl.innerHTML = `
    <div class="field-top">
      <span class="field-area">${esc(areaName)}</span>
      <span class="field-hint">🖱 マウスで すすむ（みぎ＝さき）</span>
    </div>
    <div class="field-road">
      <div class="road-line"></div>
      ${nodesHtml}
      <span class="l-walker ${f.paused ? "" : "walking"}" style="left:${lLeft}%;top:${lTop}%">${playerSVG("happy")}</span>
    </div>
    <p class="field-msg">${lWord(f.message || "")}</p>
  `;
}

// ──────────────────────────────────────────
// renderDialogue — NPC との会話（typewriter で1行ずつ）
//   field.startNpcDialogue が作った game.dialogue（{name,shape,color,lines,index,givesCard}）を描く。
//   1行を typeInto で出し、クリックで送り切ったら次の行へ。最終行を送ったら endNpcDialogue()。
//   ★読み飛ばし（スキップ）は typeInto/finishTyping が metrics に記録する。
// ──────────────────────────────────────────
function renderDialogue() {
  const ov = $("overlay-dialogue");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  const d = (typeof game !== "undefined" && game) ? game.dialogue : null;
  if (!d) { bodyEl.innerHTML = ""; return; }

  const line = (d.lines && d.lines[d.index]) || "";

  bodyEl.innerHTML = `
    <div class="dlg-stage">
      <span class="dlg-fig">${creatureSVG(d.color || "#ccc", d.shape || "villager", "happy")}</span>
      <span class="dlg-name">${esc(d.name || "？")}</span>
    </div>
    <div class="dlg-box">
      <p class="dlg-text" id="dlg-text"></p>
      <span class="dlg-next">▼ クリックで すすむ</span>
    </div>
  `;
  const textEl = $("dlg-text");
  // この行を1文字ずつ出す。送り切ったら次行へ／最終行なら会話を終える（givesCard なら 3択へ）。
  typeInto(textEl, line, () => {
    if (!game || !game.dialogue) return;
    if (game.dialogue.index < game.dialogue.lines.length - 1) {
      game.dialogue.index++;
      renderDialogue();           // 次の行を描き直して再びタイプ開始。
    } else if (typeof endNpcDialogue === "function") {
      endNpcDialogue();           // 会話終了：givesCard なら offerCards で screen="cards"、それ以外は field へ。
      render();                   // 遷移後の画面を描く。
    }
  });
  // 会話エリアのクリックでテキストを送る（main.js の全体 click でも拾えるが、ここでも明示的に bind）。
  const box = ov.querySelector(".dlg-box");
  if (box) { box.onclick = advanceText; }
}

// ──────────────────────────────────────────
// renderCards — 3択カード（入手／Lv上げ）
//   cards.offerCards が game.pendingCards にセットした配列を描く。各カードは
//   { id, kind, isLevelUp, curLv, nextLv, label, flavor, tradeoff }。
//   ★harsh は赤系、kind は緑系で色分け＝「速いが凶暴／遅いが優しい」のトレードオフを毎回 目の前に。
//   クリックで pickCard(i)→ピック後 app.screen が戻るので render() で続行。
// ──────────────────────────────────────────
function renderCards() {
  const ov = $("overlay-cards");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  const cards = (typeof game !== "undefined" && game && game.pendingCards) ? game.pendingCards : [];

  const ctx = (game && game.cardsContext) ? game.cardsContext : {};
  const heading = ctx.reason === "shop" ? "どの ことばを おぼえる?" : "ことばを ひとつ えらぶ";

  bodyEl.innerHTML = `
    <h2 class="cards-title">${esc(heading)}</h2>
    <p class="cards-sub">速いが 凶暴な ことば／遅いが やさしい ことば。どちらを 選ぶ?</p>
    <div class="cards-row"></div>
  `;
  const row = bodyEl.querySelector(".cards-row");
  cards.forEach((card, i) => {
    const el = document.createElement("button");
    // harsh＝とげ色／kind＝やさしい色。Lv上げは枠を金色に（成長の手触り）。
    el.className = "card-pick " + (card.kind === "harsh" ? "card-harsh" : "card-kind") + (card.isLevelUp ? " card-levelup" : "");
    const lvBadge = card.isLevelUp
      ? `<span class="card-lv">Lv${card.curLv} → ${card.nextLv}</span>`
      : `<span class="card-lv new">あたらしい ことば</span>`;
    el.innerHTML = `
      <div class="card-kindtag">${card.kind === "harsh" ? "きつい ことば" : "やさしい ことば"}</div>
      <div class="card-name">「${esc(card.label)}」</div>
      ${lvBadge}
      <div class="card-flavor">${esc(card.flavor || "")}</div>
      <div class="card-tradeoff">${esc(card.tradeoff || "")}</div>
    `;
    el.addEventListener("click", () => onPickCard(i));
    row.appendChild(el);
  });
}

// カードを選んだ：cards.pickCard(i) が習得/Lv上げ＋傾向ナッジ＋画面戻しをやる。結果でトーストを出す。
function onPickCard(i) {
  if (typeof pickCard !== "function") return;
  const cards = (game && game.pendingCards) ? game.pendingCards : [];
  const card = cards[i];
  const res = pickCard(i); // "learned"|"leveled"|"max"。ここで app.screen が戻り先へ変わる。
  if (card) {
    if (res === "learned") showToast(`「${card.label}」を おぼえた`);
    else if (res === "leveled") showToast(`「${card.label}」が 一段 育った`);
  }
  // pickCard が app.screen を戻り先（field/shop など）にしているので、そこへ描き直す。
  //   ショップ由来なら shop に戻る＝続けて選べる（買う体験）。戦闘/会話由来は field。
  if (typeof backToField === "function" && app.screen === "field") backToField();
  else render();
}

// ──────────────────────────────────────────
// renderShop — 学校＝ことばショップ（1枚 選ぶ体験）
//   SHOP.greeting と SHOP.words[{wordId,price}] を並べる。price は表示用（所持金概念は簡易）。
//   1つ選ぶと offerCards（pool を1枚に絞る）で“買う＝覚える”体験にし、cards 画面へ。
//   「おわる」で field へ戻る（field.backToField）。
// ──────────────────────────────────────────
function renderShop() {
  const ov = $("overlay-shop");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  const shop = (typeof SHOP !== "undefined") ? SHOP : { greeting: "", words: [] };

  bodyEl.innerHTML = `
    <h2 class="shop-title">ことばの 学校</h2>
    <p class="shop-greeting">${esc(shop.greeting || "")}</p>
    <div class="shop-row"></div>
    <button id="shop-exit" class="start-btn ghost">おわる</button>
  `;
  const row = bodyEl.querySelector(".shop-row");
  (shop.words || []).forEach((entry) => {
    const w = (typeof WORDS !== "undefined") ? WORDS[entry.wordId] : null;
    if (!w) return;
    const lv = (typeof cardLevel === "function") ? cardLevel(entry.wordId) : 0;
    const maxed = lv >= 3;
    const label = (w.levels && w.levels[Math.max(0, Math.min(lv, w.levels.length - 1))]) || entry.wordId;
    const el = document.createElement("button");
    el.className = "shop-item " + (w.kind === "harsh" ? "card-harsh" : "card-kind") + (maxed ? " maxed" : "");
    el.innerHTML = `
      <div class="card-kindtag">${w.kind === "harsh" ? "きつい ことば" : "やさしい ことば"}</div>
      <div class="card-name">「${esc(label)}」</div>
      <div class="shop-price">${maxed ? "もう これ以上 育たない" : "💰 " + esc(entry.price)}</div>
      <div class="card-flavor">${esc(w.flavor || "")}</div>
    `;
    el.disabled = maxed;
    if (!maxed) el.addEventListener("click", () => onShopBuy(entry.wordId));
    row.appendChild(el);
  });
  const exit = $("shop-exit");
  if (exit) exit.addEventListener("click", () => {
    if (typeof playSe === "function") playSe("select");
    if (typeof backToField === "function") backToField(); else { app.screen = "field"; render(); }
  });
}

// ショップで1語を選んだ：その語だけの 3択（実質1枚＝買う体験）を出して cards 画面へ。
//   offerCards の pool を1語に絞り、from を shop にして「選んだら shop に戻って続けられる」体験にする。
function onShopBuy(wordId) {
  if (typeof playSe === "function") playSe("select");
  if (typeof offerCards === "function") {
    offerCards({ pool: [wordId], from: "shop", reason: "shop", harshKind: false });
    render(); // app.screen="cards" になっているので 3択を描く。
  }
}

// ──────────────────────────────────────────
// renderBattle — ことばのカードバトル（敵 精神HP ＋ プレイヤーhp のみ可視）
//   #game の内部（#topbar #enemy-area #log #player-bar #command-bar #prompt）を埋める。
//   ★思いやり(omoiyari)は描かない：敵に出すバーは mindHp だけ。コマンドにも充填量を出さない。
// ──────────────────────────────────────────
function renderBattle() {
  if (typeof game === "undefined" || !game || !game.battle) return;
  renderTopbar();
  renderEnemyArea();
  renderLog();
  renderPlayerBar();
  renderCommandBar();
  renderPrompt();
}

// 上部バー：エリア名・ターン・主人公 L の状態（翳り度）を控えめに。
function renderTopbar() {
  const bar = $("topbar");
  if (!bar) return;
  const b = game.battle;
  const areaName = (typeof AREAS !== "undefined" && AREAS[game.currentArea]) ? AREAS[game.currentArea].name : "";
  const dl = (typeof darkLevel === "function") ? darkLevel() : 0;
  // 翳りインジケータ：L が翳るほど●が増える（“主人公だけ翳る”を小さく可視化。思いやりとは無関係）。
  let dark = "";
  for (let i = 0; i < 3; i++) dark += `<span class="dark-dot ${i < dl ? "on" : ""}"></span>`;
  bar.innerHTML = `
    <span class="tb-area">${esc(areaName)}</span>
    <span class="tb-turn">ターン ${b.turn + 1}</span>
    <span class="tb-dark" title="主人公の 翳り">${dark}</span>
  `;
}

// 敵エリア：見た目＋名前＋“見える”精神HPバーだけ。思いやりゲージは一切描かない。
function renderEnemyArea() {
  const area = $("enemy-area");
  if (!area) return;
  const en = game.battle.enemy;

  const hpPct = Math.max(0, Math.round((en.mindHp / en.mindHpMax) * 100));
  // 表情：精神HP が残り少ないと sad、それ以外は neutral（敵が言い負かされかけている手触り）。
  const expr = (en.mindHp <= 0) ? "sad" : (hpPct <= 35 ? "sad" : "neutral");
  const sprite = creatureSVG(en.color, en.shape, expr);

  area.innerHTML = `
    <div class="enemy ${en.boss ? "boss" : ""}" data-uid="${esc(en.id)}">
      <div class="enemy-fig">${sprite}</div>
      <div class="enemy-name">${esc(en.name)}</div>
      <div class="bar mind"><div class="fill" style="width:${hpPct}%"></div></div>
      <div class="enemy-hp">精神HP ${Math.max(0, en.mindHp)}/${en.mindHpMax}</div>
    </div>
  `;
  // ★ここに omoiyari のバーや数値は絶対に出さない（見えないゲージを守る核）。
}

// 戦闘ログ：state.js の game.log を順に。つねに最新行を見せる。
function renderLog() {
  const box = $("log");
  if (!box) return;
  box.innerHTML = (game.log || []).map((l) => `<div class="log-line">${esc(l)}</div>`).join("");
  box.scrollTop = box.scrollHeight;
}

// プレイヤーステータス：見える hp のみ（L のアイコン＋ HP バー）。
function renderPlayerBar() {
  const pb = $("player-bar");
  if (!pb) return;
  const p = game.player;
  const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
  pb.innerHTML = `
    <span class="pb-fig">${playerSVG("neutral")}</span>
    <span class="pb-name">${lWord(p.displayName || p.name || "L")}</span>
    <div class="p-gauge">
      <span class="g-label">HP</span>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <span class="g-num">${Math.max(0, p.hp)}/${p.maxHp}</span>
    </div>
  `;
}

// コマンドバー：手札を harsh（左・とげ色）/ kind（右・やさしい色）で色分けして並べる。
//   battle.js の battleCommandList() が { harsh:[], kind:[] } を返す。各 { id,kind,label,power,lv,flavor }。
//   ★harsh は精神HPダメージ（power）を出す＝速さが見える。kind は数値を出さない＝遅さ＝重みを見せない（没入を保つ）。
function renderCommandBar() {
  const bar = $("command-bar");
  if (!bar) return;
  const b = game.battle;
  const active = b && b.phase === "player";

  const list = (typeof battleCommandList === "function") ? battleCommandList() : { harsh: [], kind: [] };

  const makeBtn = (c) => {
    const lvStar = c.lv >= 2 ? ` <span class="cmd-lv">Lv${c.lv}</span>` : "";
    // harsh だけ威力を出す（速い＝凶暴が“見える”）。kind は効果の手触りだけ言葉で添える。
    const sub = c.kind === "harsh"
      ? `精神HP −${c.power}`
      : (sideHint(c.id) || "そっと 寄りそう");
    return `<button class="cmd ${c.kind === "harsh" ? "c-harsh" : "c-kind"}" data-word="${esc(c.id)}" ${active ? "" : "disabled"}>
        <span class="cmd-label">「${esc(c.label)}」${lvStar}</span>
        <span class="cmd-sub">${esc(sub)}</span>
      </button>`;
  };

  bar.innerHTML = `
    <div class="cmd-col harsh-col">
      <div class="cmd-coltag toge">きつい ことば（速い）</div>
      ${(list.harsh || []).map(makeBtn).join("") || `<div class="cmd-empty">まだ ない</div>`}
    </div>
    <div class="cmd-col kind-col">
      <div class="cmd-coltag yasashii">やさしい ことば（おそい）</div>
      ${(list.kind || []).map(makeBtn).join("") || `<div class="cmd-empty">まだ ない</div>`}
    </div>
  `;
  // クリックで playerCard(id)。受理（true）なら演出→再描画。敵ターン中は disabled なので拾わない。
  if (active) {
    bar.querySelectorAll(".cmd[data-word]").forEach((btn) => {
      btn.addEventListener("click", () => onSayWord(btn.getAttribute("data-word")));
    });
  }
}

// kind カードの“やさしさの実利”を一言で（思いやりの量ではなく、副次効果の手触りだけ）。
//   ★これは omoiyari の数値ではない（side の演出ヒント）。見えないゲージは守りつつ kind の魅力を伝える。
function sideHint(id) {
  const w = (typeof WORDS !== "undefined") ? WORDS[id] : null;
  if (!w || !w.side) return "";
  const parts = [];
  if (w.side.healSelf) parts.push(`HP+${w.side.healSelf}`);
  if (w.side.lowerAtk) parts.push(`相手の こうげき↓`);
  return parts.join(" ");
}

// サブ案内（#prompt）：敵ターン/決着中はその旨、プレイヤーターンは軽いヒント。
function renderPrompt() {
  const box = $("prompt");
  if (!box) return;
  const b = game.battle;
  if (!b) { box.innerHTML = ""; return; }
  if (game.state === STATES.GAMEOVER) {
    box.innerHTML = `<div class="prompt-hint">ことばに のまれた……（セーブから やりなおせる）</div>`;
    return;
  }
  if (b.phase === "enemy") { box.innerHTML = `<div class="prompt-hint">…あいての ばん</div>`; return; }
  if (b.phase === "end") { box.innerHTML = `<div class="prompt-hint">…</div>`; return; }
  box.innerHTML = `<div class="prompt-hint">ことばを ひとつ えらぶ（左＝きつい・速い／右＝やさしい・おそい）</div>`;
}

// ことばを言う：playerCard が true（ターン消費）なら、その手番ぶんの演出を出して再描画。
function onSayWord(wordId) {
  if (!game || !game.battle || game.battle.phase !== "player") return;
  // 今回の手番ぶんの演出イベントだけを集めるため、直前に fx を空にしてから実行（02 doAction の流儀）。
  if (Array.isArray(game.fx)) game.fx = [];
  const prevRect = captureEnemyRect(); // 倒した敵は消えるので“居た場所”を先に控える。
  const ok = (typeof playerCard === "function") ? playerCard(wordId) : false;
  if (!ok) return; // 弾かれた（未習得・敵ターン等）ら何もしない。
  render();         // mindHp 減・hp 減・ログ更新を反映。
  playFx(prevRect); // render 後に数字フロート・揺れ・撃破・勝敗などを重ねる。
  // 勝敗で画面が cards/result/gameover へ遷移していれば、その画面を描く。
  if (app.screen === "cards") render();
}

// 行動前に敵カードの中心座標を控える（撃破で消えた後も“居た場所”に演出を出すため）。
function captureEnemyRect() {
  const host = $("game");
  const map = {};
  if (!host) return map;
  const hr = host.getBoundingClientRect();
  host.querySelectorAll(".enemy[data-uid]").forEach((c) => {
    const cr = c.getBoundingClientRect();
    map[c.getAttribute("data-uid")] = { x: cr.left - hr.left + cr.width / 2, y: cr.top - hr.top + cr.height / 2 };
  });
  return map;
}

// ──────────────────────────────────────────
// playFx — 手応えの演出（02 流：数字フロート・揺れ・撃破ポフ・勝敗・ダーク化パルス）
//   battle.js が game.fx に積んだイベントだけを描く。
//   ★思いやり(omoiyari)関連は battle.js が積まないので、ここでも自然に描かれない（見えないゲージを守る核）。
//   イベント：speak{text,cat} / hit{dmg,mindHp,mindHpMax} / calm / pheal{amount} /
//             win{kind} / dark / learn{text} / pdmg{dmg} / lose。
// ──────────────────────────────────────────
function playFx(prevRects) {
  prevRects = prevRects || {};
  if (!game || !Array.isArray(game.fx) || !game.fx.length) return;
  const uid = (game.battle && game.battle.enemy) ? game.battle.enemy.id : null;
  let pdmg = 0;
  let learnEv = null;
  const impacts = []; // 相手に“効く”系（少し遅らせて出す）。

  // ── ① 「言った／自分に起きた」ぶんは すぐ ──
  for (const ev of game.fx) {
    if (ev.t === "speak") wordBubble(ev.text, ev.cat);
    else if (ev.t === "pheal") { pulsePlayerBar(); floatOnPlayer(`HP＋${ev.amount}`, "pheal"); }
    else if (ev.t === "pdmg") pdmg += ev.dmg;
    else if (ev.t === "learn") learnEv = ev;
    else if (ev.t === "dark") darkPulse();        // 言い負かした瞬間の翳りパルス（主人公だけ翳る）。
    else if (ev.t === "win") { /* 勝敗演出は下でまとめて */ impacts.push(ev); }
    else impacts.push(ev);                          // hit / calm
  }

  // ── ② 相手への効果は少し遅らせて「言った→刺さる/ほどける」の因果を体に来させる ──
  impacts.forEach((ev, i) => {
    setTimeout(() => {
      if (ev.t === "hit") {
        // 精神HP 被弾＝見えるゲージの数字フロート（harsh の速さが“見える”）。
        floatOnEnemy(uid, `${ev.dmg}`, ev.mindHp <= 0 ? "dmg dead" : "dmg", prevRects);
        if (ev.mindHp <= 0) deadPoof(uid, prevRects, (game.battle && game.battle.enemy) ? game.battle.enemy.color : "#ccc");
        else { shakeEnemy(uid); flashEnemy(uid); }
      } else if (ev.t === "calm") {
        // kind が届いた合図＝“ほっ…”だけ。思いやりの「量」は絶対に出さない（数字を出さない）。
        floatOnEnemy(uid, "ほっ…", "calm", prevRects);
      } else if (ev.t === "win") {
        // 勝敗の余韻：harsh 勝ち＝静かに翳る／kind 勝ち＝あたたかい光（数値は出さない）。
        if (ev.kind) saveBurst(uid, prevRects);
      }
    }, 120 + i * 70);
  });

  const tail = 120 + impacts.length * 70;

  // ── ③ gift（寄り添って覚えたことば）は一拍おいて単独で立たせる（本作の核を刺す）──
  if (learnEv) setTimeout(() => {
    wordBubble(`「${learnEv.text}」を おぼえた`, "kind");
    if (typeof playSe === "function") playSe("calm");
  }, tail + 240);

  // ── ④ 敵の反撃（プレイヤー被弾）は ぜんぶの後に＝「言った→刺さる→殴られた」の順 ──
  if (pdmg > 0) setTimeout(() => {
    screenShake(); hitVignette();
    floatOnPlayer(`-${pdmg}`, "pdmg");
  }, tail + 160);

  game.fx = [];
}

// 言ったことばの吹き出し（画面中央やや上に、性質で色を変えて“ぽんっ”と）。harsh＝とげ色／kind＝やさしい灯り。
function wordBubble(text, cat) {
  const host = $("game");
  if (!host || !text) return;
  const el = document.createElement("div");
  el.className = "word-bubble " + (cat === "harsh" ? "w-harsh" : cat === "kind" ? "w-kind" : "w-neutral");
  el.textContent = "「" + text + "」";
  host.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// 敵カード（または“居た場所”prevRects）の上に、数字や言葉をふわっと浮かせて消す。
function floatOnEnemy(uid, text, cls, prevRects) {
  const host = $("game");
  if (!host) return;
  let x, y;
  const card = uid != null ? host.querySelector(`.enemy[data-uid="${cssEsc(uid)}"]`) : null;
  if (card) {
    const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect();
    x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top + 8;
  } else if (prevRects && uid != null && prevRects[uid]) {
    x = prevRects[uid].x; y = prevRects[uid].y - 14;
  } else { return; }
  const el = document.createElement("div");
  el.className = "float-num " + cls;
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// 自分（プレイヤーバー）の上に数字を浮かせる（被弾・回復を“自分側でも”見せる）。
function floatOnPlayer(text, cls) {
  const host = $("game"), pb = $("player-bar");
  if (!host || !pb) return;
  const hr = host.getBoundingClientRect(), pr = pb.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "float-num " + cls;
  el.textContent = text;
  el.style.left = (pr.left - hr.left + pr.width / 2) + "px";
  el.style.top = (pr.top - hr.top - 8) + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function pulsePlayerBar() {
  const pb = $("player-bar");
  if (pb) { pb.classList.add("healpulse"); setTimeout(() => pb.classList.remove("healpulse"), 600); }
}
function shakeEnemy(uid) {
  const c = uid != null ? document.querySelector(`.enemy[data-uid="${cssEsc(uid)}"]`) : null;
  if (c) { c.classList.add("hitshake"); setTimeout(() => c.classList.remove("hitshake"), 320); }
}
function flashEnemy(uid) {
  const fig = uid != null ? document.querySelector(`.enemy[data-uid="${cssEsc(uid)}"] .enemy-fig`) : null;
  if (fig) { fig.classList.add("hitpop"); setTimeout(() => fig.classList.remove("hitpop"), 260); }
}
// 言い負かした瞬間の“パンッ！”（敵は render で消える前提なので、居た場所に出す）＝ポフ＋かけら飛散。
function deadPoof(uid, prevRects, color) {
  const host = $("game");
  if (!host || uid == null) return;
  let x, y;
  if (prevRects && prevRects[uid]) { x = prevRects[uid].x; y = prevRects[uid].y; }
  else {
    const card = host.querySelector(`.enemy[data-uid="${cssEsc(uid)}"]`);
    if (!card) return;
    const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect();
    x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top + cr.height / 2;
  }
  const el = document.createElement("div");
  el.className = "poof"; el.style.left = x + "px"; el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 560);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((d) => {
    const s = document.createElement("div");
    s.className = "shard"; s.style.left = x + "px"; s.style.top = y + "px";
    s.style.background = color || "#cfc4e6";
    s.style.setProperty("--dx", (d[0] * 18) + "px");
    s.style.setProperty("--dy", (d[1] * 18) + "px");
    host.appendChild(s);
    setTimeout(() => s.remove(), 520);
  });
}
// kind 勝ちの“寄り添えた”光（あたたかい広がり）。思いやりの量は見せず、温度だけ見せる。
function saveBurst(uid, prevRects) {
  const host = $("game");
  if (!host) return;
  let x, y;
  const card = uid != null ? host.querySelector(`.enemy[data-uid="${cssEsc(uid)}"]`) : null;
  if (card) { const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect(); x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top + cr.height / 2; }
  else if (prevRects && uid != null && prevRects[uid]) { x = prevRects[uid].x; y = prevRects[uid].y; }
  else return;
  const el = document.createElement("div");
  el.className = "save-burst"; el.style.left = x + "px"; el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 720);
}
function screenShake() {
  const g = $("game");
  if (g) { g.classList.add("screenshake"); setTimeout(() => g.classList.remove("screenshake"), 360); }
}
function hitVignette() {
  const el = document.createElement("div");
  el.className = "hit-vignette";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 380);
}
// ダーク化パルス：画面全体を一瞬 翳らせる（言い負かした瞬間。主人公だけが翳る世界の“揺れ”）。
function darkPulse() {
  const sc = $("scene") || document.body;
  if (!sc) return;
  sc.classList.add("dark-pulse");
  setTimeout(() => sc.classList.remove("dark-pulse"), 520);
}
// CSS セレクタに入れる id を安全化（英数以外をエスケープ。data.js の id は英数とハイフンのみだが保険）。
function cssEsc(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }

// ──────────────────────────────────────────
// renderResult — 結末（優しさ率で分岐した ENDINGS の1つ）
//   state.determineEnding() が game.ending を確定済み。{ id, min, tone, title, body }。
//   body を typewriter で出し、「つづける」で meta（神様的存在の見透かし）へ。
//   tone（cruel/gray/warm）を body の class にも反映（背景の温度）。
// ──────────────────────────────────────────
function renderResult() {
  const ov = $("overlay-result");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  const e = (game && game.ending) ? game.ending : (typeof ENDINGS !== "undefined" ? ENDINGS[ENDINGS.length - 1] : { title: "", body: "", tone: "gray" });

  // 結末トーンを body へ（背景の温度を切替）。dark-N とは別レイヤ。
  document.body.classList.remove("tone-cruel", "tone-gray", "tone-warm");
  if (e.tone) document.body.classList.add("tone-" + e.tone);

  // さいごに言ったことば（“どう勝ったか”の残り香）。
  const lastW = (game && game.lastWord && typeof WORDS !== "undefined" && WORDS[game.lastWord])
    ? (WORDS[game.lastWord].levels ? WORDS[game.lastWord].levels[0] : game.lastWord) : "……";

  bodyEl.innerHTML = `
    <h2 class="result-title">${esc(e.title || "")}</h2>
    <p class="result-text" id="result-text"></p>
    <p class="result-words">さいごに のこった ことば　「${esc(lastW)}」</p>
    <button id="result-next" class="start-btn">つづける ▶</button>
  `;
  const textEl = $("result-text");
  typeInto(textEl, e.body || "", null);

  const next = $("result-next");
  if (next) next.addEventListener("click", () => {
    if (typeof playSe === "function") playSe("select");
    if (typeof stopBgm === "function") stopBgm();
    if (typeof playBgm === "function") playBgm("meta"); // メタへ：無機質に広がる曲。
    if (game) game.state = STATES.META;
    app.screen = "meta";
    if (typeof window !== "undefined") window.game = game;
    render();
  });
  // 本文クリックでも typewriter を送れる（スキップ計測のため）。
  bodyEl.onclick = function (ev) { if (ev.target && ev.target.id === "result-next") return; advanceText(); };
}

// ──────────────────────────────────────────
// renderMeta — 神様的存在の見透かし（metricsSummary 提示 → 語りかけ → WO_RD に L を差し WORLD）
//   META（godName/openLines/skipLines/clickLines/reveal/closeLines）を順に出す。
//   metricsSummary のしきい値（skipRatio / clicks）で skipLines・clickLines を high/low 出し分け。
//   最後に綴りアニメ：WO_RD のギャップへ L が挿入され WORLD になる気づきを演出する。
//   ★テーマ直結：言葉を覚えるゲームで言葉を飛ばした人ほど、ここで“見透かされる”。
// ──────────────────────────────────────────
function renderMeta() {
  const ov = $("overlay-meta");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  const M = (typeof META !== "undefined") ? META : { godName: "声", openLines: [], skipLines: { high: [], low: [] }, clickLines: { high: [], low: [] }, reveal: [], closeLines: [] };
  const sum = (typeof metricsSummary === "function") ? metricsSummary() : { skipRatio: 0, clicks: 0, readRatio: 1, avgDwellMs: 0, seconds: 0, cursorDist: 0 };

  // 計測の癖で見透かしセリフを選ぶ（しきい値：skipRatio 0.4 / clicks 60 を境に high/low）。
  const skipHigh = sum.skipRatio >= 0.4;
  const clickHigh = sum.clicks >= 60;
  const skipSet = skipHigh ? (M.skipLines && M.skipLines.high) : (M.skipLines && M.skipLines.low);
  const clickSet = clickHigh ? (M.clickLines && M.clickLines.high) : (M.clickLines && M.clickLines.low);

  // メタ画面で流す“語りの台本”を1本に組む（順番に typewriter）。
  //   open → skip 出し分け → click 出し分け → 鏡（数値の提示）→ reveal（綴り）→ close。
  const mirror =
    `わたしが 見ていた かずを、そっと 置いておくね。\n` +
    `・おくった ことば の かず：${Math.round(sum.clicks)}\n` +
    `・ことばを ちゃんと 読んだ わりあい：${Math.round((sum.readRatio || 0) * 100)}%\n` +
    `・ひとつの ことばを 見ていた 時間：${(sum.avgDwellMs / 1000).toFixed(1)}びょう`;

  const script = []
    .concat(M.openLines || [])
    .concat(skipSet || [])
    .concat(clickSet || [])
    .concat([mirror])
    .concat(M.reveal || [])
    .concat(M.closeLines || []);

  // reveal の何行目で綴りアニメを差し込むか（reveal の開始位置）。
  const revealStart = (M.openLines || []).length + (skipSet || []).length + (clickSet || []).length + 1;
  // 「WORLD」を見せる行（reveal の最終行で綴りが完成する想定）。
  const worldLineIndex = revealStart + Math.max(0, (M.reveal || []).length - 1);

  // メタ画面の状態（何行目まで進んだか）を game に持つ（render 再入で続きから描けるように）。
  if (!game.metaUi) game.metaUi = { i: 0 };
  const idx = Math.min(game.metaUi.i, script.length - 1);

  // 綴りの表示状態：worldLineIndex に達したら WORLD（L 挿入済み）を見せる。
  const spelled = (idx >= worldLineIndex);
  const logo = spelledLogo(spelled, idx >= revealStart);

  bodyEl.innerHTML = `
    <div class="meta-sky"></div>
    <div class="meta-logo">${logo}</div>
    <div class="meta-voice">
      <span class="meta-godname">${esc(M.godName || "声")}</span>
      <p class="meta-text" id="meta-text"></p>
      <span class="meta-next">▼ クリックで すすむ</span>
    </div>
  `;

  const textEl = $("meta-text");
  typeInto(textEl, script[idx] || "", () => {
    if (!game.metaUi) game.metaUi = { i: 0 };
    if (game.metaUi.i < script.length - 1) {
      game.metaUi.i++;
      renderMeta();         // 次の語りへ。
    } else {
      // 台本の最後：締めのトーストだけ出して、メタはそのまま余韻を残す（タイトルへは main.js / pause 任せ）。
      showToast("またね、L。");
    }
  });
  bodyEl.onclick = advanceText;
}

// メタ画面のロゴ綴り。
//   reveal 前：WO_RD（ギャップ _ ）／reveal 中：ギャップが光る／WORLD 完成：_ の位置へ L が差し込まれて WORLD。
function spelledLogo(spelled, revealing) {
  if (spelled) {
    // WORLD：W O R L D。差し込まれた L を強調（world の欠片＝主人公）。
    return ["W", "O", "R", "L", "D"].map((c) =>
      c === "L" ? `<span class="logo-ch inserted">L</span>` : `<span class="logo-ch">${c}</span>`
    ).join("");
  }
  // WO_RD：ギャップを示す。reveal 中はギャップを脈動させて“ここに何かが入る”を予感させる。
  return ["W", "O", "_", "R", "D"].map((c) =>
    c === "_" ? `<span class="logo-ch gap ${revealing ? "glow" : ""}">_</span>` : `<span class="logo-ch">${c}</span>`
  ).join("");
}

// ──────────────────────────────────────────
// renderPause — ポーズ（中断メニュー）
//   セーブ／タイトルへ／とじる。delete はしない（save.js の上書き方針）。
// ──────────────────────────────────────────
function renderPause() {
  const ov = $("overlay-pause");
  if (!ov) return;
  const bodyEl = ov.querySelector(".ov-body") || ov;
  bodyEl.innerHTML = `
    <h2 class="pause-title">ひとやすみ</h2>
    <button id="pause-save" class="start-btn">セーブする</button>
    <button id="pause-resume" class="start-btn ghost">つづける</button>
  `;
  const save = $("pause-save");
  if (save) save.addEventListener("click", () => {
    const ok = (typeof saveGame === "function") ? saveGame(0) : false;
    showToast(ok ? "セーブした" : "セーブできなかった…");
  });
  const resume = $("pause-resume");
  if (resume) resume.addEventListener("click", () => {
    // フィールドへ戻す（バトル中のポーズは未対応：体験版はフィールド復帰で十分）。
    if (typeof backToField === "function") backToField(); else { app.screen = "field"; render(); }
  });
}

// ──────────────────────────────────────────
// トースト（一時メッセージ。battle.js の flash() / 各所から呼ばれる）
//   契約の #toast を使う（class show でフェードイン、少し待って消す）。02 と同形。
// ──────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const/function が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.ui = ui;
  window.$ = window.$ || $;
  window.render = render;
  window.applyScreen = applyScreen;
  window.applyDark = applyDark;
  window.creatureSVG = creatureSVG;
  window.playerSVG = playerSVG;
  window.typeInto = typeInto;
  window.finishTyping = finishTyping;
  window.advanceText = advanceText;
  window.renderTitle = renderTitle;
  window.renderField = renderField;
  window.renderDialogue = renderDialogue;
  window.renderCards = renderCards;
  window.renderShop = renderShop;
  window.renderBattle = renderBattle;
  window.renderResult = renderResult;
  window.renderMeta = renderMeta;
  window.renderPause = renderPause;
  window.playFx = playFx;
  window.showToast = showToast;
}
