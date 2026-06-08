/*
 * ui.js — 描画（DOM＋canvas）
 *
 * 役割：
 *   ・render() … app.screen を見てオーバーレイの表示/非表示を切り替え、各画面の中身を作る。
 *   ・drawField() … 見下ろしマップを canvas に描く（地形・オブジェクト・主人公・“もや”・名札）。
 *   ・typeInto() … タイプライタ表示（言葉トークンは習得状況で色分け、覚えたては書き換え演出）。
 *   ・showLearn() … 「◯◯」を おぼえた ポップアップ。
 *
 *   ※ 進行（どの文を出すか／次に何を起こすか）は main.js が指揮する。ここは“見せ方”に徹する。
 *
 * ※ DOM/canvas 依存。headless では canvas が無くても落ちないよう全描画をガードする。末尾で window へ明示エクスポート。
 */

// ── DOM 小道具 ──
function _el(id) { return document.getElementById(id); }
function _show(id, on) { const e = _el(id); if (e) e.classList.toggle("hidden", !on); }
function _setHtml(id, html) { const e = _el(id); if (e) e.innerHTML = html; }
function _reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function _escUi(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────
// タイプライタ（セグメント単位で1文字ずつ。改行は <br>）
// ──────────────────────────────────────────
let _tw = null;

function _segHtmlUpTo(segs, count, freshId) {
  let html = "", c = 0;
  for (const sg of segs) {
    if (c >= count) break;
    const rem = count - c;
    const take = Math.min(sg.text.length, rem);
    const piece = _escUi(sg.text.slice(0, take)).replace(/\n/g, "<br>");
    c += take;
    const fresh = (freshId && sg.w === freshId) ? " is-reveal" : "";
    const cls = ("seg " + (sg.cls || "")).trim() + fresh;
    const dataW = sg.w ? ' data-w="' + sg.w + '"' : "";
    html += '<span class="' + cls + '"' + dataW + ">" + piece + "</span>";
  }
  return html;
}

// text: テンプレ文字列（複数行は "\n"）。opts.fresh で覚えたて語をハイライト。opts.onDone 完了コールバック。
function typeInto(elId, text, opts) {
  const el = _el(elId);
  opts = opts || {};
  if (_tw) _twStop();
  if (!el) { if (opts.onDone) opts.onDone(); return; }
  const segs = resolveSegments(text || "");
  const total = segs.reduce((a, s) => a + s.text.length, 0);
  const instant = _reduceMotion() || opts.instant;
  let count = instant ? total : 0;
  el.innerHTML = _segHtmlUpTo(segs, count, opts.fresh);
  if (count >= total) { if (opts.onDone) opts.onDone(); return; }
  _tw = { el: el, segs: segs, total: total, count: count, fresh: opts.fresh, speed: opts.speed || 2, onDone: opts.onDone, timer: null };
  _twTick();
}
function _twTick() {
  if (!_tw) return;
  _tw.count = Math.min(_tw.total, _tw.count + _tw.speed);
  _tw.el.innerHTML = _segHtmlUpTo(_tw.segs, _tw.count, _tw.fresh);
  if (typeof playSe === "function" && _tw.count % 5 === 0) playSe("page");
  if (_tw.count >= _tw.total) { const cb = _tw.onDone; _twStop(); if (cb) cb(); return; }
  _tw.timer = setTimeout(_twTick, 18);
}
function _twStop() { if (_tw && _tw.timer) clearTimeout(_tw.timer); _tw = null; }
function twActive() { return !!_tw; }
function twFinish() {
  if (!_tw) return;
  _tw.el.innerHTML = _segHtmlUpTo(_tw.segs, _tw.total, _tw.fresh);
  const cb = _tw.onDone; _twStop(); if (cb) cb();
}

// ──────────────────────────────────────────
// 習得ポップアップ ＆ トースト
// ──────────────────────────────────────────
let _learnTimer = null;
function showLearn(id, kind, onDone) {
  const pop = _el("learn-pop");
  const txt = (typeof learnPopupText === "function") ? learnPopupText(id, kind) : ("「" + id + "」");
  if (typeof playSe === "function") playSe(kind === "frag" ? "frag" : "learn");
  if (!pop) { if (onDone) onDone(); return; }
  pop.className = "learn-pop " + (kind === "frag" ? "frag" : "word") + " show";
  pop.innerHTML = '<span class="lp-spark">✦</span>' + _escUi(txt) + '<span class="lp-spark">✦</span>';
  if (_learnTimer) clearTimeout(_learnTimer);
  const hold = _reduceMotion() ? 650 : 1150;
  _learnTimer = setTimeout(() => {
    pop.classList.remove("show");
    if (onDone) onDone();
  }, hold);
}

let _toastTimer = null;
function toast(msg) {
  const t = _el("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ──────────────────────────────────────────
// 画面の出し分け
// ──────────────────────────────────────────
function render() {
  const s = app.screen;
  _show("view-field", s === "field" || s === "look" || s === "encounter" || s === "dialogue" || s === "pause");
  _show("ov-title", s === "title");
  _show("ov-encounter", s === "encounter");
  _show("ov-dialogue", s === "dialogue");
  _show("ov-look", s === "look");
  _show("ov-finale", s === "finale");
  _show("ov-ending", s === "ending");
  _show("ov-pause", s === "pause");
  _show("ov-vocab", s === "vocab");
  _show("menu-btn", s === "field");

  // フィールドの色テーマを body へ（CSS が背景色を寄せる）
  const area = (typeof curArea === "function") ? curArea() : null;
  document.body.setAttribute("data-theme", area ? area.theme : "title");

  if (s === "title") renderTitle();
  if (s === "field" || s === "look" || s === "dialogue") refreshFieldHud();
  if (s === "encounter") renderEncounterFrame();
  if (s === "pause") renderPause();
  if (s === "vocab") renderVocab();
}

// ── タイトル ──
function renderTitle() {
  const can = (typeof hasSave === "function") && hasSave();
  const muted = (typeof isMuted === "function") && isMuted();
  let logo = "";
  for (const ch of TITLE.name) logo += "<span>" + _escUi(ch) + "</span>";
  _setHtml("ov-title",
    '<div class="title-card">' +
      '<div class="title-logo" aria-label="' + _escUi(TITLE.name) + '">' + logo + '</div>' +
      '<div class="title-sub">— ' + _escUi(TITLE.sub) + ' —</div>' +
      '<p class="title-tag">' + _escUi(TITLE.tagline) + '</p>' +
      '<div class="title-prologue">' +
        TITLE.prologue.map((l) => "<p>" + _escUi(l) + "</p>").join("") +
      '</div>' +
      '<div class="title-btns">' +
        '<button class="btn primary" data-action="start">▶ はじめる</button>' +
        '<button class="btn ghost' + (can ? "" : " disabled") + '"' + (can ? '' : ' disabled') + ' data-action="continue">つづきから</button>' +
        '<button class="btn mini" data-action="mute">' + (muted ? "🔇 音オフ" : "🔊 音オン") + '</button>' +
      '</div>' +
    '</div>');
}

// ── フィールドの HUD（エリア名・目的・覚えた数）──
function refreshFieldHud() {
  const area = (typeof curArea === "function") ? curArea() : null;
  _setHtml("field-area", area ? _escUi(area.name) : "");
  const obj = (typeof fieldObjective === "function") ? fieldObjective() : "";
  _setHtml("field-objective", obj ? ("つぎ： " + _escUi(obj)) : "");
  const n = (typeof vocabCount === "function") ? vocabCount() : 0;
  _setHtml("vocab-count", String(n));
  // 画面下の一言ログ（最後の1行）
  const last = (game && game.log && game.log.length) ? game.log[game.log.length - 1] : "";
  _setHtml("field-msg", _escUi(last));
}

// ── 遭遇フレーム（相手の絵・セリフ・様子・選択肢）──
function renderEncounterFrame() {
  const enc = game.enc; if (!enc) return;
  drawPortrait("enc-portrait", enc.cfg.who, enc.w);
  _setHtml("enc-speaker", (typeof encSpeakerLabel === "function") ? encSpeakerLabel() : "");
  _setHtml("enc-speech", (typeof encSpeechHtml === "function") ? encSpeechHtml() : "");
  _setHtml("enc-mood", (typeof encMood === "function") ? renderText(encMood()) : "");
  // 選択肢
  const acts = (typeof encActions === "function") ? encActions() : [];
  let html = "";
  for (const a of acts) {
    const hint = a.hint ? '<small>' + _escUi(a.hint) + '</small>' : "";
    const cls = "enc-btn" + (a.route === "success" ? " ok" : "");
    html += '<button class="' + cls + '" data-encact="' + a.id + '">' +
            '<span class="ic">' + _escUi(a.icon || "") + '</span>' +
            '<span class="lb">' + _escUi(a.label) + '</span>' + hint + '</button>';
  }
  _setHtml("enc-actions", html);
}

// ── ポーズ ──
function renderPause() {
  _setHtml("ov-pause",
    '<div class="pause-card">' +
      '<h2>メニュー</h2>' +
      '<button class="btn primary" data-action="resume">▶ つづける</button>' +
      '<button class="btn ghost" data-action="save">💾 セーブ</button>' +
      '<button class="btn ghost" data-action="openVocab">📖 覚えた言葉</button>' +
      '<button class="btn ghost" data-action="title">タイトルへ</button>' +
    '</div>');
}

// ── 覚えた言葉 一覧 ──
function renderVocab() {
  const list = (typeof learnedList === "function") ? learnedList() : [];
  let grid = "";
  if (!list.length) grid = '<p class="vocab-empty">まだ ひとつも 覚えていない。</p>';
  else {
    for (const id of list) {
      const w = WORDS[id]; if (!w) continue;
      grid += '<div class="vocab-chip"><b>' + _escUi(w.disp) + '</b><small>' + _escUi(w.kind) + '</small></div>';
    }
  }
  const total = (typeof WORD_ORDER !== "undefined") ? WORD_ORDER.length : 16;
  _setHtml("ov-vocab",
    '<div class="vocab-card">' +
      '<h2>覚えた 言葉 <span>' + list.length + ' / ' + total + '</span></h2>' +
      '<div class="vocab-grid">' + grid + '</div>' +
      '<button class="btn primary" data-action="closeVocab">▶ もどる</button>' +
    '</div>');
}

// ── エンディング（モンタージュ：覚えた語が ひとつずつ ともる）──
function renderEndingShell() {
  _setHtml("ov-ending",
    '<div class="end-card">' +
      '<div id="end-montage" class="end-montage"></div>' +
      '<div id="end-text" class="end-text"></div>' +
      '<div id="end-titlecard" class="end-titlecard hidden">' +
        '<div class="end-name">' + _escUi(ENDING.titleCard.name) + '</div>' +
        '<div class="end-sub">' + _escUi(ENDING.titleCard.sub) + '</div>' +
      '</div>' +
      '<div id="end-actions" class="end-actions hidden">' +
        '<button class="btn primary" data-action="again">もう一度 歩く</button>' +
        '<button class="btn ghost" data-action="title">タイトルへ</button>' +
      '</div>' +
    '</div>');
}
function endingAddWord(id) {
  const w = WORDS[id]; if (!w) return;
  const m = _el("end-montage"); if (!m) return;
  const span = document.createElement("span");
  span.className = "end-word";
  span.textContent = w.disp;
  m.appendChild(span);
  if (typeof playSe === "function") playSe("frag");
}
function endingShowTitlecard() { _show("end-titlecard", true); _show("end-actions", true); }

// ══════════════════════════════════════════
// canvas：見下ろしマップ描画
// ══════════════════════════════════════════
let _canvas = null, _ctx = null;
function _ensureCanvas() {
  if (_ctx) return _ctx;
  _canvas = _el("field-canvas");
  if (_canvas && _canvas.getContext) _ctx = _canvas.getContext("2d");
  return _ctx;
}
// 角丸四角（古い環境向けに自前実装）
function _rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const THEME_COLORS = {
  forest:  { g1: "#d6ecbe", g2: "#bfe0a4", path: "#ead9ab", water: "#8fc9ea" },
  bridge:  { g1: "#cfe6c2", g2: "#b7daa8", path: "#e7d6a6", water: "#7bbbe2" },
  village: { g1: "#dcebc2", g2: "#c7e1a8", path: "#ecdcab", water: "#8fc9ea" },
};

function drawField() {
  const ctx = _ensureCanvas();
  const area = (typeof curArea === "function") ? curArea() : null;
  if (!ctx || !area) return;
  const T = FIELD_TILE, W = area.cols * T, H = area.rows * T;
  if (_canvas.width !== W) { _canvas.width = W; _canvas.height = H; }
  const col = THEME_COLORS[area.theme] || THEME_COLORS.forest;

  // 地面（草のグラデ）
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col.g1); g.addColorStop(1, col.g2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  _drawGrassTexture(ctx, area, W, H);

  // タイル（道・板・川・木）
  for (let y = 0; y < area.rows; y++) {
    for (let x = 0; x < area.cols; x++) {
      const ch = (area.grid[y] || "")[x] || " ";
      if (ch === "=") _drawPath(ctx, x, y, T, col);
      else if (ch === "B") _drawPlank(ctx, x, y, T);
      else if (ch === "~") _drawWater(ctx, x, y, T, col);
    }
  }
  // 木は最後の方で（影の重なり）
  for (let y = 0; y < area.rows; y++)
    for (let x = 0; x < area.cols; x++)
      if (((area.grid[y] || "")[x]) === "T") _drawTree(ctx, x, y, T);

  // オブジェクト＋主人公（y で奥行きソート）
  const objs = (typeof areaObjects === "function" ? areaObjects() : []).slice();
  const drawList = objs.map((o) => ({ kind: "obj", o: o, y: o.ty }));
  if (app.player) drawList.push({ kind: "player", y: app.player.y });
  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) {
    if (d.kind === "player") _drawPlayer(ctx, app.player);
    else _drawObject(ctx, d.o);
  }

  // もや（覚えた言葉が増えるほど晴れる）
  _drawFog(ctx, W, H);
  // 名札（？？？／語）— もやの上に
  for (const o of objs) _drawLabel(ctx, o);
  // 近接対象の強調リング
  if (app.fieldNear) _drawNearRing(ctx, app.fieldNear);
}

function _drawGrassTexture(ctx, area, W, H) {
  // 軽い斑点（草の手触り）。決定論的に配置（乱数を使わない＝再描画でちらつかない）。
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#9ccb7e";
  for (let i = 0; i < 80; i++) {
    const x = (i * 73) % W, y = (i * 149) % H;
    ctx.beginPath(); ctx.ellipse(x, y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function _drawPath(ctx, x, y, T, col) {
  ctx.fillStyle = col.path;
  ctx.fillRect(x * T, y * T, T, T);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x * T, y * T, T, T * 0.25);
}
function _drawPlank(ctx, x, y, T) {
  const px = x * T, py = y * T;
  ctx.fillStyle = "#c79a64"; _rr(ctx, px + 2, py + 4, T - 4, T - 8, 4); ctx.fill();
  ctx.strokeStyle = "#a87c48"; ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 2, py + 4 + i * (T - 8) / 3); ctx.lineTo(px + T - 2, py + 4 + i * (T - 8) / 3); ctx.stroke(); }
}
function _drawWater(ctx, x, y, T, col) {
  const px = x * T, py = y * T;
  ctx.fillStyle = col.water; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(px + T * 0.35, py + T * 0.4, T * 0.18, T * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px + T * 0.7, py + T * 0.7, T * 0.12, T * 0.04, 0, 0, Math.PI * 2); ctx.fill();
}
function _drawTree(ctx, x, y, T) {
  const cx = x * T + T / 2, by = y * T + T - 4;
  ctx.fillStyle = "rgba(60,80,50,0.18)";
  ctx.beginPath(); ctx.ellipse(cx, by, T * 0.32, T * 0.10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9a6f44"; _rr(ctx, cx - 4, by - T * 0.5, 8, T * 0.5, 3); ctx.fill();
  const greens = ["#5fa05a", "#74b76a", "#8cc97f"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = greens[i];
    ctx.beginPath();
    ctx.arc(cx - 8 + i * 8, by - T * 0.62 - (i === 1 ? 8 : 0), T * 0.30 - i * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// もや（中心ほど晴れ、周辺ほど かすむ。語数で全体が薄くなる）。
function _drawFog(ctx, W, H) {
  const known = (typeof vocabCount === "function") ? vocabCount() : 0;
  const haze = Math.max(0, 0.40 - known * 0.028);
  if (haze <= 0.012) return;
  const p = app.player;
  const cx = p ? p.x * FIELD_TILE + FIELD_TILE / 2 : W / 2;
  const cy = p ? p.y * FIELD_TILE + FIELD_TILE / 2 : H / 2;
  const grad = ctx.createRadialGradient(cx, cy, FIELD_TILE * 1.4, cx, cy, Math.max(W, H) * 0.72);
  grad.addColorStop(0, "rgba(238,242,252,0)");
  grad.addColorStop(1, "rgba(238,242,252," + haze.toFixed(3) + ")");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}

// 近接リング（“ここを 調べられる/話せる”）。
function _drawNearRing(ctx, o) {
  const cx = o.tx * FIELD_TILE + FIELD_TILE / 2, cy = o.ty * FIELD_TILE + FIELD_TILE * 0.9;
  ctx.save();
  ctx.strokeStyle = "rgba(255,212,120,0.95)"; ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.ellipse(cx, cy, FIELD_TILE * 0.46, FIELD_TILE * 0.20, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// 名札（オブジェクト頭上の ？？？／語）。label が null のものは出さない。
function _drawLabel(ctx, o) {
  if (!o.label) return;
  const seg = (typeof resolveSegments === "function") ? resolveSegments("{" + o.label + "}")[0] : null;
  const txt = seg ? seg.text : "？？？";
  const known = seg && seg.cls === "w-known";
  const cx = o.tx * FIELD_TILE + FIELD_TILE / 2;
  const top = o.ty * FIELD_TILE - 6;
  ctx.save();
  ctx.font = "bold 13px system-ui, 'Hiragino Maru Gothic ProN', sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(txt).width + 14;
  ctx.fillStyle = known ? "rgba(255,247,224,0.96)" : "rgba(232,228,240,0.86)";
  _rr(ctx, cx - w / 2, top - 11, w, 20, 9); ctx.fill();
  ctx.strokeStyle = known ? "#e7c98a" : "#cfc6d8"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = known ? "#7a5a2e" : "#9a93a8";
  ctx.fillText(txt, cx, top);
  ctx.restore();
}

// ── オブジェクトの絵（種類ごとに簡素なパステル図形）──
function _drawObject(ctx, o) {
  const cx = o.tx * FIELD_TILE + FIELD_TILE / 2;
  const by = o.ty * FIELD_TILE + FIELD_TILE - 4; // 足元
  _shadow(ctx, cx, by, FIELD_TILE * 0.30);
  const art = o.art || "rock";
  if (_ART[art]) _ART[art](ctx, cx, by, o);
  else _ART.rock(ctx, cx, by, o);
}
function _shadow(ctx, cx, by, r) {
  ctx.fillStyle = "rgba(60,60,80,0.16)";
  ctx.beginPath(); ctx.ellipse(cx, by, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
}

const _ART = {
  pond: (ctx, cx, by) => {
    ctx.fillStyle = "#7fc1e6";
    ctx.beginPath(); ctx.ellipse(cx, by - 8, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a9d9f2";
    ctx.beginPath(); ctx.ellipse(cx - 4, by - 11, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath(); ctx.ellipse(cx - 6, by - 12, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  },
  flower: (ctx, cx, by) => {
    ctx.strokeStyle = "#6fa85e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, by - 14); ctx.stroke();
    const petals = ["#f4a9c4", "#f7c97e", "#c9a9f0", "#f49aa0"];
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
      ctx.fillStyle = petals[i % petals.length];
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 6, by - 18 + Math.sin(a) * 6, 4, 6, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(cx, by - 18, 3.5, 0, Math.PI * 2); ctx.fill();
  },
  rock: (ctx, cx, by) => {
    ctx.fillStyle = "#b9b3a6"; _rr(ctx, cx - 13, by - 16, 26, 16, 7); ctx.fill();
    ctx.fillStyle = "#cdc8bd"; _rr(ctx, cx - 9, by - 18, 16, 9, 5); ctx.fill();
  },
  tree: (ctx, cx, by) => _drawTree(ctx, (cx - FIELD_TILE / 2) / FIELD_TILE, (by - FIELD_TILE + 4) / FIELD_TILE, FIELD_TILE),
  house: (ctx, cx, by) => {
    ctx.fillStyle = "#f3e6cf"; _rr(ctx, cx - 18, by - 26, 36, 26, 4); ctx.fill();
    ctx.fillStyle = "#d98c7a"; // 屋根
    ctx.beginPath(); ctx.moveTo(cx - 22, by - 26); ctx.lineTo(cx, by - 42); ctx.lineTo(cx + 22, by - 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#a9714f"; _rr(ctx, cx - 6, by - 16, 12, 16, 2); ctx.fill(); // ドア
    ctx.fillStyle = "#bfe0f0"; _rr(ctx, cx + 8, by - 22, 8, 8, 2); ctx.fill();   // 窓
  },
  gate: (ctx, cx, by, o) => {
    const locked = o && o.requires && !(typeof hasFlag === "function" && hasFlag(o.requires));
    ctx.fillStyle = locked ? "#bcae9a" : "#d8b88c";
    _rr(ctx, cx - 16, by - 30, 6, 30, 2); ctx.fill();
    _rr(ctx, cx + 10, by - 30, 6, 30, 2); ctx.fill();
    ctx.fillStyle = locked ? "#a99c88" : "#c79a64";
    _rr(ctx, cx - 18, by - 34, 36, 7, 3); ctx.fill();
    // 矢印（開いていれば）／鍵（閉じていれば）
    ctx.fillStyle = locked ? "#8a7d68" : "#7bbf6e";
    ctx.font = "16px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(locked ? "🔒" : "↓", cx, by - 16);
  },
  bridge: (ctx, cx, by) => {
    // 壊れた橋（手前から川へ。板が割れて欠けている）
    ctx.fillStyle = "#c79a64";
    _rr(ctx, cx - 20, by - 10, 16, 10, 3); ctx.fill();
    _rr(ctx, cx + 6, by - 10, 14, 10, 3); ctx.fill();
    ctx.strokeStyle = "#a87c48"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 18, by - 18); ctx.lineTo(cx - 18, by - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 18, by - 18); ctx.lineTo(cx + 18, by - 2); ctx.stroke();
    // 割れ目
    ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 2, by - 12); ctx.lineTo(cx + 3, by - 2); ctx.stroke();
  },
  villager: (ctx, cx, by, o) => _person(ctx, cx, by, { cloak: "#9bb0d8", hair: "#6b5a44", wave: true }),
  oldman:   (ctx, cx, by, o) => _person(ctx, cx, by, { cloak: "#b6a98f", hair: "#e8e4dc", short: true, flower: true }),
  mother:   (ctx, cx, by, o) => _person(ctx, cx, by, { cloak: "#d59ab0", hair: "#5a4636" }),
  child:    (ctx, cx, by, o) => _person(ctx, cx, by, { cloak: "#f0c98a", hair: "#7a5a3c", small: true, cry: true }),
  dog:      (ctx, cx, by) => {
    ctx.fillStyle = "#caa06a";
    _rr(ctx, cx - 12, by - 12, 22, 10, 5); ctx.fill();          // 体
    ctx.beginPath(); ctx.arc(cx + 12, by - 14, 7, 0, Math.PI * 2); ctx.fill(); // 頭
    ctx.fillStyle = "#a87f4c";
    ctx.beginPath(); ctx.moveTo(cx + 8, by - 20); ctx.lineTo(cx + 6, by - 12); ctx.lineTo(cx + 12, by - 16); ctx.fill(); // 耳
    ctx.fillStyle = "#5b4636";
    ctx.beginPath(); ctx.arc(cx + 14, by - 14, 1.4, 0, Math.PI * 2); ctx.fill();
  },
};

// 人の共通描画（フィールド用・小さめ）。
function _person(ctx, cx, by, opt) {
  const h = opt.small ? 0.82 : 1.0;
  // 体（マント）
  ctx.fillStyle = opt.cloak || "#9bb0d8";
  ctx.beginPath();
  ctx.moveTo(cx - 11 * h, by);
  ctx.quadraticCurveTo(cx - 13 * h, by - 22 * h, cx, by - 24 * h);
  ctx.quadraticCurveTo(cx + 13 * h, by - 22 * h, cx + 11 * h, by);
  ctx.closePath(); ctx.fill();
  // 頭
  ctx.fillStyle = "#f6dcc2";
  ctx.beginPath(); ctx.arc(cx, by - 28 * h, 8 * h, 0, Math.PI * 2); ctx.fill();
  // 髪
  ctx.fillStyle = opt.hair || "#6b5a44";
  ctx.beginPath(); ctx.arc(cx, by - 30 * h, 8 * h, Math.PI, 0); ctx.fill();
  if (!opt.short) { ctx.fillRect(cx - 8 * h, by - 31 * h, 16 * h, 5 * h); }
  // 目
  ctx.fillStyle = "#5b4636";
  ctx.beginPath(); ctx.arc(cx - 3 * h, by - 27 * h, 1.4 * h, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3 * h, by - 27 * h, 1.4 * h, 0, Math.PI * 2); ctx.fill();
  if (opt.cry) { // 涙
    ctx.fillStyle = "#8fd0f0";
    ctx.beginPath(); ctx.arc(cx - 3 * h, by - 23 * h, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3 * h, by - 23 * h, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  if (opt.wave) { // 手をふる
    ctx.strokeStyle = opt.cloak || "#9bb0d8"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx + 9 * h, by - 16 * h); ctx.lineTo(cx + 15 * h, by - 24 * h); ctx.stroke();
  }
  if (opt.flower) { ctx.fillStyle = "#f4a9c4"; ctx.beginPath(); ctx.arc(cx - 13, by - 14, 3.5, 0, Math.PI * 2); ctx.fill(); }
}

// 主人公（名もなき子）。向きで顔の位置を少しずらす。歩行で上下にバウンド。
function _drawPlayer(ctx, p) {
  if (!p) return;
  const cx = p.x * FIELD_TILE + FIELD_TILE / 2;
  const bob = (p.moving && !_reduceMotion()) ? Math.abs(Math.sin(p.bob)) * 3 : 0;
  const by = p.y * FIELD_TILE + FIELD_TILE - 4 - bob;
  _shadow(ctx, cx, p.y * FIELD_TILE + FIELD_TILE - 4, FIELD_TILE * 0.28);
  // マント（生成りの旅装）
  ctx.fillStyle = "#e8ddc7";
  ctx.beginPath();
  ctx.moveTo(cx - 10, by);
  ctx.quadraticCurveTo(cx - 12, by - 20, cx, by - 22);
  ctx.quadraticCurveTo(cx + 12, by - 20, cx + 10, by);
  ctx.closePath(); ctx.fill();
  // フード/頭
  ctx.fillStyle = "#f6dcc2";
  ctx.beginPath(); ctx.arc(cx, by - 26, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#caa66f"; // フード
  ctx.beginPath(); ctx.arc(cx, by - 28, 8, Math.PI, 0); ctx.fill();
  ctx.fillRect(cx - 8, by - 29, 16, 4);
  // 目（向き）
  const dx = p.dir === "left" ? -2 : p.dir === "right" ? 2 : 0;
  if (p.dir !== "up") {
    ctx.fillStyle = "#5b4636";
    ctx.beginPath(); ctx.arc(cx - 2.6 + dx, by - 25, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.6 + dx, by - 25, 1.3, 0, Math.PI * 2); ctx.fill();
  }
}

// ══════════════════════════════════════════
// 遭遇・ラストの “相手” 大きめポートレート（別 canvas）
// ══════════════════════════════════════════
function drawPortrait(canvasId, art, waryLevel) {
  const c = _el(canvasId);
  if (!c || !c.getContext) return;
  const ctx = c.getContext("2d");
  const S = 132; if (c.width !== S) { c.width = S; c.height = S; }
  ctx.clearRect(0, 0, S, S);
  const cx = S / 2, by = S - 16;
  _shadow(ctx, cx, by, 34);
  ctx.save(); ctx.translate(0, -6); ctx.scale(1.9, 1.9);
  const lx = cx / 1.9, lby = (by + 6) / 1.9;
  if (_ART[art]) _ART[art](ctx, lx, lby, {});
  else _person(ctx, lx, lby, { cloak: "#9bb0d8" });
  ctx.restore();
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.render = render;
  window.renderTitle = renderTitle;
  window.refreshFieldHud = refreshFieldHud;
  window.renderEncounterFrame = renderEncounterFrame;
  window.renderVocab = renderVocab;
  window.renderEndingShell = renderEndingShell;
  window.endingAddWord = endingAddWord;
  window.endingShowTitlecard = endingShowTitlecard;
  window.drawField = drawField;
  window.drawPortrait = drawPortrait;
  window.typeInto = typeInto;
  window.twActive = twActive;
  window.twFinish = twFinish;
  window.showLearn = showLearn;
  window.toast = toast;
}
