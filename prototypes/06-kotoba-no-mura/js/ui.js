/*
 * ui.js — 画面切替・canvas 描画・タイプライタ・図鑑・言い争いの描画・習得ポップ・エンディング。
 *
 * 役割（描画ぜんぶ）：
 *   ・render()           … app.screen を見て表示を切り替え、body の data-theme / data-tone を更新。
 *   ・drawField()        … 見下ろしマップ（地形・どうぶつ・主人公・名札・トーンの色かぶせ）を canvas に。
 *   ・typeInto()         … {{id}} を割らずに 1 文字ずつ出すタイプライタ（しゃべり音つき）。
 *   ・showLearn()        … 「○○を おぼえた!」の中央ポップ。覚えた瞬間、世界の ？？？ が書き換わる。
 *   ・renderArgue*()     … 言い争いの 相手・様子・言える言葉ボタン。
 *   ・renderVocab()      … 言葉の図鑑（覚えた語＝色つき / 未習得＝？？？）。
 *   ・renderEnding* /Title/Pause … それぞれの画面。
 *   ・drawPortrait()     … 2頭身どうぶつの顔（自作 canvas・外部画像ゼロ）。
 *
 * ※ DOM 依存。headless でも fakeCtx で落ちないよう、canvas 取得は握りつぶす。末尾で window へ明示エクスポート。
 */

function _reduce() { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function _el(id) { return (typeof document !== "undefined") ? document.getElementById(id) : null; }
function _setHtml(id, h) { const e = _el(id); if (e) e.innerHTML = h; }
function _ctx(id) { const c = _el(id); if (!c || !c.getContext) return null; try { return c.getContext("2d"); } catch (e) { return null; } }
function _show(id, on) { const e = _el(id); if (!e) return; if (e.classList) { e.classList.toggle("hidden", !on); } }

// ──────────────────────────────────────────
// 画面切替
// ──────────────────────────────────────────
function applyTone() {
  if (typeof document === "undefined" || !document.body) return;
  try { document.body.setAttribute("data-tone", (typeof toneBucket === "function") ? toneBucket() : "warm"); } catch (e) {}
}

function render() {
  if (typeof document === "undefined" || !document.body) return;
  applyTone();
  const area = (typeof curArea === "function") ? curArea() : null;
  const theme = app.screen === "title" ? "title" : app.screen === "ending" ? "ending" : (area ? area.theme : "village");
  try { document.body.setAttribute("data-theme", theme); } catch (e) {}

  const fieldScreens = { field: 1, look: 1, dialogue: 1, argue: 1, pause: 1, vocab: 1 };
  _show("view-field", !!fieldScreens[app.screen]);
  _show("menu-btn", app.screen === "field");
  _show("vocab-badge", app.screen === "field");

  _show("ov-title", app.screen === "title");
  _show("ov-look", app.screen === "look");
  _show("ov-dialogue", app.screen === "dialogue");
  _show("ov-argue", app.screen === "argue");
  _show("ov-ending", app.screen === "ending");
  _show("ov-pause", app.screen === "pause");
  _show("ov-vocab", app.screen === "vocab");

  if (app.screen === "title") renderTitle();
  if (app.screen === "pause") renderPause();
  if (app.screen === "vocab") renderVocab();
  if (fieldScreens[app.screen] && app.screen !== "pause" && app.screen !== "vocab") { drawField(); refreshFieldHud(); }
}

// ──────────────────────────────────────────
// タイトル
// ──────────────────────────────────────────
function renderTitle() {
  const has = (typeof hasSave === "function") && hasSave();
  const muted = (typeof isMuted === "function") && isMuted();
  // soul（かぞえうたの記憶）：一度でもクリアしていると、タイトルの ささやきが かわる＝不気味の入口。
  const s = (typeof soulData === "function") ? soulData() : null;
  const cleared = !!(s && s.clears > 0);
  const found = s ? ["light", "dim", "dark"].filter((k) => s.endings && s.endings[k] > 0).length : 0;
  const whisper = cleared
    ? "…おかえり。 これで " + ((s.rounds || 0) + 1) + "かいめ、だね。"
    : "…だれかが、あなたを かぞえている。";

  // 浮遊する ？？？（クリア後は、覚えたはずの言葉が まじる）
  const floatWords = cleared ? ["？？？", "ともだち", "？？？", "みてる", "？？？", "すき"] : ["？？？", "？？？", "？？？", "？？？", "？？？", "？？？"];
  let sky = '<div class="title-sky" aria-hidden="true">';
  floatWords.forEach((w, i) => {
    sky += '<span class="title-float" style="left:' + (8 + i * 15) + '%; animation-duration:' + (9 + (i % 3) * 4) + 's; animation-delay:' + (i * 1.7) + 's; font-size:' + (12 + (i % 3) * 4) + 'px;">' + escapeHtml(w) + '</span>';
  });
  sky += '</div>';

  _setHtml("ov-title",
    sky +
    '<div class="title-card">' +
      '<div class="title-logo">ことばの むら</div>' +
      '<div class="title-sub">おぼえた ことばで、せかいが かわる。</div>' +
      '<div class="title-whisper">' + escapeHtml(whisper) + '</div>' +
      '<div class="title-menu">' +
        '<button class="btn primary" data-action="start">▶ はじめる</button>' +
        '<button class="btn" data-action="continue"' + (has ? "" : " disabled") + '>つづきから</button>' +
        '<button class="btn ghost" data-action="mute">' + (muted ? "🔇 おと: けし" : "🔊 おと: あり") + '</button>' +
      '</div>' +
      '<div class="title-foot">DOOPA proto #06 ／ なぐらない・ことばで いいあう むら ／ 15〜25ふん' +
        (cleared ? '　／　むすび ' + found + '/3' : '') + '</div>' +
    '</div>');
}

// ──────────────────────────────────────────
// フィールド HUD
// ──────────────────────────────────────────
function refreshFieldHud() {
  const area = (typeof curArea === "function") ? curArea() : null;
  _setHtml("field-area", area ? area.name : "");
  // ふだんは進行ヒント。…ただし“見られている度”が高いと、ごくまれに 一瞬だけ べつの文が まじる。
  let objText = "つぎ：" + ((typeof fieldObjective === "function") ? fieldObjective() : "");
  if (!_reduce() && typeof metaWatch === "function" && metaWatch() >= 45) {
    const tMs = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    if (Math.floor(tMs / 1000) % 17 === 16 && (tMs % 1000) < 420) objText = "…みてる。";
  }
  _setHtml("field-objective", objText);
  const vc = _el("vocab-count"); if (vc) vc.textContent = String((typeof vocabCount === "function") ? vocabCount() : 0);
  const msg = _el("field-msg");
  if (msg && game && game.log && game.log.length) msg.textContent = game.log[game.log.length - 1];
}

// ──────────────────────────────────────────
// 色（トーンで明暗が変わる）
// ──────────────────────────────────────────
const PALETTE = {
  village: { grass1: "#d7efbf", grass2: "#c3e7a6", path: "#e8d6a8", flower: ["#f4a7c0", "#f6d06f", "#a9d0f5"] },
  forest:  { grass1: "#bfe0b0", grass2: "#a7d199", path: "#d8c79a", flower: ["#e7b6cf", "#cfe3a0", "#bcd6f0"] },
  shrine:  { grass1: "#cfc7e0", grass2: "#bcb2d6", path: "#d8cbe6", flower: ["#e8c8e0", "#c9bce6", "#bcd0e6"] },
};
function _themeName() { const a = (typeof curArea === "function") ? curArea() : null; return a ? a.theme : "village"; }
// トーン色かぶせ。dim/dark は multiply（かけ算合成）＝色味を保ったまま“夜に沈む”。
function _toneOverlay() {
  const b = (typeof toneBucket === "function") ? toneBucket() : "warm";
  if (b === "light") return null;
  if (b === "warm") return { color: "rgba(255,238,200,0.05)", blend: "source-over" };
  if (b === "dim") return { color: "#a8a4cc", blend: "multiply" };
  return { color: "#646090", blend: "multiply" }; // dark
}

// ──────────────────────────────────────────
// フィールド描画
// ──────────────────────────────────────────
function _nowSec() { return (typeof performance !== "undefined" && performance.now) ? performance.now() / 1000 : 0; }

function drawField() {
  const ctx = _ctx("field-canvas"); if (!ctx) return;
  const area = (typeof curArea === "function") ? curArea() : null; if (!area) return;
  const T = (typeof FIELD_TILE === "number") ? FIELD_TILE : 44;
  const W = area.cols * T, H = area.rows * T;
  const pal = PALETTE[area.theme] || PALETTE.village;
  const t = _nowSec();

  ctx.clearRect(0, 0, W, H);
  // 地形
  for (let y = 0; y < area.rows; y++) {
    const line = area.grid[y] || "";
    for (let x = 0; x < area.cols; x++) {
      const ch = line[x] || " ";
      _drawTile(ctx, ch, x * T, y * T, T, pal, x, y, t);
    }
  }
  // オブジェクト（手前のものほど あとに描く＝下の行が前）
  const objs = (typeof areaObjects === "function") ? areaObjects().slice() : [];
  objs.sort((a, b) => a.ty - b.ty);
  const near = app.fieldNear;
  objs.forEach((o) => {
    if (o.kind === "scenic") { _drawSprite(ctx, o, o.tx * T + T / 2, o.ty * T + T / 2, T); return; }
    _drawSprite(ctx, o, o.tx * T + T / 2, o.ty * T + T / 2, T);
    // 近接マーカー＆名札
    if (near && near.id === o.id) _drawMarker(ctx, o.tx * T + T / 2, o.ty * T + T / 2 - T * 0.7, T);
    const tag = _objTag(o);
    if (tag) _drawNameTag(ctx, tag, o.tx * T + T / 2, o.ty * T + T / 2 - T * 0.95, T);
  });
  // 主人公
  const p = app.player;
  if (p) _drawPlayer(ctx, p.x * T + T / 2, p.y * T + T / 2, T, p);

  // トーンの色かぶせ（multiply＝夜に沈む。headless の fakeCtx でも安全）
  const ov = _toneOverlay();
  if (ov) {
    ctx.save();
    try { ctx.globalCompositeOperation = ov.blend || "source-over"; } catch (e) {}
    ctx.fillStyle = ov.color; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    try { ctx.globalCompositeOperation = "source-over"; } catch (e) {}
  }

  // 浮遊パーティクル（明＝はなびら／暗＝しずんだ ほこり）＝世界の“呼吸”
  const bucket = (typeof toneBucket === "function") ? toneBucket() : "warm";
  if (!_reduce()) _drawParticles(ctx, W, H, t, bucket);
  // ビネット（ふちを そっと しめる＝絵本の ページ感。暗いほど濃く）
  _drawVignette(ctx, W, H, bucket);
  // 暗いと“目”がよぎる（不気味の気配）
  if (bucket === "dark") _drawSkyEye(ctx, W, H);
}

// 浮遊パーティクル：状態を持たない（位置は時間 t から計算）＝headless でも安全・再開ずれなし。
function _drawParticles(ctx, W, H, t, bucket) {
  ctx.save();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const seedX = (i * 97 + 31) % W, seedY = (i * 53 + 17) % H;
    const drift = Math.sin(t * 0.7 + i * 1.7) * 14;
    if (bucket === "light" || bucket === "warm") {
      // はなびら：ふわふわ おちる
      const x = (seedX + drift + W) % W;
      const y = (seedY + t * (14 + (i % 3) * 6)) % H;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = (i % 2) ? "#f7b8cc" : "#fff3f7";
      ctx.beginPath(); ctx.ellipse(x, y, 3.2, 2.2, (t + i) % (Math.PI * 2), 0, Math.PI * 2); ctx.fill();
    } else {
      // しずんだ ほこり：ゆっくり のぼる（dim/dark）
      const x = (seedX + drift * 0.5 + W) % W;
      const y = H - ((seedY + t * (6 + (i % 3) * 3)) % H);
      ctx.globalAlpha = bucket === "dark" ? 0.30 : 0.18;
      ctx.fillStyle = bucket === "dark" ? "#9a8fd0" : "#cfc8e8";
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function _drawVignette(ctx, W, H, bucket) {
  try {
    const a = bucket === "dark" ? 0.30 : bucket === "dim" ? 0.18 : 0.09;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, "rgba(40,30,50,0)");
    g.addColorStop(1, "rgba(40,30,50," + a + ")");
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  } catch (e) {}
}

// フィールドの名札 ★ループ1の核心：世界は さいしょ ？？？ だらけ。
//   であった ひと・おぼえた ことば の分だけ、世界が“読める”ようになる（＝きみの語彙で 世界に 注釈がつく）。
function _objTag(o) {
  if (o.kind === "npc") {
    const n = NPCS[o.ref]; if (!n) return null;
    return hasFlag("met_" + o.ref) ? n.name : "？？？";
  }
  if (o.kind === "argue") {
    const d = ARGUES[o.ref];
    if (o.doneFlag && hasFlag(o.doneFlag)) return d ? d.speaker : null; // 解決後＝名前が わかる
    return "？？？！";                                                  // 解決前＝なにか 起きてる（読めない）
  }
  if (o.kind === "look" && o.tagWord) {
    return isKnown(o.tagWord) ? (o.tagText || (WORDS[o.tagWord] && WORDS[o.tagWord].text) || null) : "？？？";
  }
  if (o.kind === "sign") return isKnown("koe") ? "たてふだ" : "？？？";
  if (o.kind === "exit") return "→"; // 出入口だけは常に読める（迷子防止）
  return null;
}

function _rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function _drawTile(ctx, ch, px, py, T, pal, gx, gy, t) {
  // ベースのくさ（市松でほんのり濃淡）
  ctx.fillStyle = ((gx + gy) % 2 === 0) ? pal.grass1 : pal.grass2;
  ctx.fillRect(px, py, T, T);
  // くさの“穂”をまばらに（決定的な擬似乱数＝座標ハッシュ。毎フレーム同じ場所に生える）
  if (ch === "." && (gx * 7 + gy * 13) % 9 === 0) {
    ctx.strokeStyle = "rgba(110,160,90,0.45)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + T * 0.3, py + T * 0.74); ctx.lineTo(px + T * 0.26, py + T * 0.58);
    ctx.moveTo(px + T * 0.38, py + T * 0.74); ctx.lineTo(px + T * 0.4, py + T * 0.56);
    ctx.moveTo(px + T * 0.46, py + T * 0.74); ctx.lineTo(px + T * 0.52, py + T * 0.6);
    ctx.stroke();
  }
  if (ch === "=") {
    ctx.fillStyle = pal.path; _rr(ctx, px + 1.5, py + 1.5, T - 3, T - 3, 7); ctx.fill();
    // 小石をひとつ（道の手ざわり）
    if ((gx * 5 + gy * 11) % 7 === 0) { ctx.fillStyle = "rgba(160,130,90,0.35)"; ctx.beginPath(); ctx.arc(px + T * 0.62, py + T * 0.4, T * 0.05, 0, Math.PI * 2); ctx.fill(); }
  }
  else if (ch === ",") {
    const c = pal.flower[(gx * 3 + gy) % pal.flower.length];
    const sway = t ? Math.sin(t * 1.6 + gx * 1.3 + gy) * T * 0.02 : 0; // 風で ゆれる
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(px + T * 0.5 + sway, py + T * 0.55, T * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff6c8"; ctx.beginPath(); ctx.arc(px + T * 0.5 + sway, py + T * 0.55, T * 0.04, 0, Math.PI * 2); ctx.fill();
  } else if (ch === "T") { _drawTree(ctx, px + T / 2, py + T * 0.62, T); }
  else if (ch === "H") { _drawHouse(ctx, px, py, T); }
  else if (ch === "~") { _drawWater(ctx, px, py, T, gx, gy, t); }
  else if (ch === "o") { _drawStone(ctx, px, py, T); }
}

function _drawTree(ctx, cx, by, T) {
  // 木かげ（じめんに 落とす）
  ctx.fillStyle = "rgba(80,110,70,0.18)";
  ctx.beginPath(); ctx.ellipse(cx, by + T * 0.22, T * 0.3, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9b7b53"; ctx.fillRect(cx - T * 0.06, by - T * 0.05, T * 0.12, T * 0.28);
  ctx.fillStyle = "#7bbf6a"; ctx.beginPath(); ctx.arc(cx, by - T * 0.12, T * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8fd07c"; ctx.beginPath(); ctx.arc(cx - T * 0.12, by - T * 0.22, T * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.arc(cx + T * 0.12, by - T * 0.26, T * 0.12, 0, Math.PI * 2); ctx.fill();
}
function _drawHouse(ctx, px, py, T) {
  ctx.fillStyle = "#f3e6cf"; ctx.fillRect(px + T * 0.12, py + T * 0.4, T * 0.76, T * 0.5);
  ctx.fillStyle = "#e08a86"; ctx.beginPath();
  ctx.moveTo(px + T * 0.06, py + T * 0.42); ctx.lineTo(px + T * 0.5, py + T * 0.1); ctx.lineTo(px + T * 0.94, py + T * 0.42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#9b7b53"; ctx.fillRect(px + T * 0.42, py + T * 0.6, T * 0.16, T * 0.3);
  // 世界が くらいと、まどに あかりが ともる（むらは 生きている）
  const b = (typeof toneBucket === "function") ? toneBucket() : "warm";
  if (b === "dim" || b === "dark") {
    ctx.fillStyle = "rgba(255,214,130,0.9)"; ctx.fillRect(px + T * 0.2, py + T * 0.5, T * 0.14, T * 0.14);
    ctx.fillStyle = "rgba(255,214,130,0.25)"; ctx.beginPath(); ctx.arc(px + T * 0.27, py + T * 0.57, T * 0.18, 0, Math.PI * 2); ctx.fill();
  }
}
function _drawWater(ctx, px, py, T, gx, gy, t) {
  ctx.fillStyle = "#9fd4ea"; ctx.fillRect(px, py, T, T);
  // なみ：時間で うねる（headless では t=0 で 静止＝安全）
  const ph = t ? Math.sin(t * 1.8 + gx * 0.9 + gy * 1.3) * 3 : ((gx + gy) % 2) * 4;
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px + 6, py + T * 0.4 + ph); ctx.quadraticCurveTo(px + T * 0.5, py + T * 0.3 + ph * 0.5, px + T - 6, py + T * 0.45 + ph); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.moveTo(px + 10, py + T * 0.7 - ph * 0.6); ctx.quadraticCurveTo(px + T * 0.5, py + T * 0.62 - ph * 0.3, px + T - 10, py + T * 0.72 - ph * 0.6); ctx.stroke();
}
function _drawStone(ctx, px, py, T) {
  ctx.fillStyle = "#b9aed0"; _rr(ctx, px + T * 0.16, py + T * 0.18, T * 0.68, T * 0.7, 6); ctx.fill();
  ctx.fillStyle = "#cabfe0"; _rr(ctx, px + T * 0.22, py + T * 0.24, T * 0.4, T * 0.3, 4); ctx.fill();
}

// 近接マーカー（ぴょこっと）
function _drawMarker(ctx, cx, cy, T) {
  const bob = (typeof performance !== "undefined" && performance.now) ? Math.sin(performance.now() / 200) * 2 : 0;
  ctx.fillStyle = "#f4c14e"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.font = "bold " + Math.round(T * 0.5) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.strokeText("！", cx, cy + bob); ctx.fillText("！", cx, cy + bob);
}
function _drawNameTag(ctx, text, cx, cy, T) {
  ctx.font = Math.round(T * 0.28) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = (ctx.measureText(text).width || text.length * 8) + 12;
  ctx.fillStyle = "rgba(255,250,241,0.92)"; ctx.strokeStyle = "#e7cf9f"; ctx.lineWidth = 1.5;
  _rr(ctx, cx - w / 2, cy - T * 0.16, w, T * 0.32, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#6f5b48"; ctx.fillText(text, cx, cy);
}

// 空に よぎる目（dark トーンの不気味）
function _drawSkyEye(ctx, W, H) {
  const t = (typeof performance !== "undefined" && performance.now) ? performance.now() / 1000 : 0;
  const a = 0.12 + 0.08 * Math.sin(t);
  ctx.save(); ctx.globalAlpha = a;
  const cx = W * 0.5, cy = H * 0.14;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(cx, cy, 46, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a3a6a"; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── どうぶつ スプライト（フィールド上の小さい姿）──
function _drawSprite(ctx, o, cx, cy, T) {
  if (o.kind === "npc") return _drawAnimal(ctx, cx, cy, T, _npcColor(o.ref), o.ref);
  if (o.kind === "argue") { if (o.doneFlag && hasFlag(o.doneFlag)) return _drawAnimal(ctx, cx, cy, T, _argColor(o.ref), o.ref, true); return _drawAnimal(ctx, cx, cy, T, _argColor(o.ref), o.ref); }
  if (o.kind === "sign") return _drawSign(ctx, cx, cy, T);
  if (o.kind === "exit") return _drawExit(ctx, cx, cy, T, o.sprite);
  if (o.kind === "look") {
    if (o.sprite === "well") return _drawWell(ctx, cx, cy, T);
    if (o.sprite === "pond") return _drawSparkle(ctx, cx, cy, T, "#9fd4ea");
    if (o.sprite === "flower") return _drawSparkle(ctx, cx, cy, T, "#f4a7c0");
    if (o.sprite === "tree") return _drawTree(ctx, cx, cy + T * 0.1, T * 1.15);
    if (o.sprite === "sky") return _drawSkyMark(ctx, cx, cy, T);
    return;
  }
}
function _npcColor(ref) { return ({ moko: "#fdfaf4", ton: "#e2c79b", uta: "#d9cae6", piko: "#ffe08a" })[ref] || "#fdfaf4"; }
function _argColor(ref) { return ({ quarrel: "#f3c08a", nushi: "#7c6f5a", watcher: "#e9e4f2" })[ref] || "#ddd"; }

function _drawAnimal(ctx, cx, cy, T, color, key, calm) {
  const r = T * 0.3;
  // 影
  ctx.fillStyle = "rgba(80,70,60,0.16)"; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.9, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  // からだ（まる）
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // みみ
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx - r * 0.55, cy - r * 0.7, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.55, cy - r * 0.7, r * 0.28, 0, Math.PI * 2); ctx.fill();
  // かお
  if (key === "watcher") { // 監視者：たくさんの目
    ctx.fillStyle = "#4a4a78";
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - r * 0.4 + i * r * 0.4, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // め（ときどき まばたき＝生きてる感。位置ハッシュで個体ごとに タイミングが ずれる）
  const tA = _nowSec();
  const blink = !_reduce() && (((tA * 0.8 + (cx * 0.013 + cy * 0.007)) % 3.7) < 0.12);
  ctx.fillStyle = "#5b4636";
  if (blink) {
    ctx.fillRect(cx - r * 0.45, cy - r * 0.08, r * 0.22, r * 0.06);
    ctx.fillRect(cx + r * 0.23, cy - r * 0.08, r * 0.22, r * 0.06);
  } else {
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  // くち（ぬし/けんかは への字、それ以外は にこ）
  ctx.strokeStyle = "#5b4636"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (!calm && (key === "nushi" || key === "quarrel")) { ctx.moveTo(cx - r * 0.2, cy + r * 0.45); ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r * 0.2, cy + r * 0.45); }
  else { ctx.moveTo(cx - r * 0.2, cy + r * 0.32); ctx.quadraticCurveTo(cx, cy + r * 0.5, cx + r * 0.2, cy + r * 0.32); }
  ctx.stroke();
  // ほっぺ
  ctx.fillStyle = "rgba(243,168,176,0.5)";
  ctx.beginPath(); ctx.arc(cx - r * 0.55, cy + r * 0.18, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.55, cy + r * 0.18, r * 0.13, 0, Math.PI * 2); ctx.fill();
}
function _drawPlayer(ctx, cx, cy, T, p) {
  const bobY = p.moving ? Math.sin(p.bob) * 2 : 0;
  _drawAnimal(ctx, cx, cy + bobY, T, "#ffffff", "player");
  // 向きの ちいさな印
  ctx.fillStyle = "#5b4636";
  const r = T * 0.3, dx = p.dir === "left" ? -1 : p.dir === "right" ? 1 : 0, dy = p.dir === "up" ? -1 : p.dir === "down" ? 1 : 0;
  ctx.beginPath(); ctx.arc(cx + dx * r * 0.5, cy + bobY + dy * r * 0.5 - r * 0.05, r * 0.06, 0, Math.PI * 2); ctx.fill();
}
function _drawSign(ctx, cx, cy, T) {
  ctx.fillStyle = "#9b7b53"; ctx.fillRect(cx - T * 0.04, cy - T * 0.05, T * 0.08, T * 0.4);
  ctx.fillStyle = "#e7d3a6"; _rr(ctx, cx - T * 0.26, cy - T * 0.32, T * 0.52, T * 0.3, 4); ctx.fill();
  ctx.strokeStyle = "#b98a5e"; ctx.lineWidth = 1.5; ctx.stroke();
}
function _drawWell(ctx, cx, cy, T) {
  ctx.fillStyle = "#9aa6b5"; _rr(ctx, cx - T * 0.3, cy - T * 0.1, T * 0.6, T * 0.45, 6); ctx.fill();
  ctx.fillStyle = "#3a4256"; ctx.beginPath(); ctx.ellipse(cx, cy - T * 0.1, T * 0.24, T * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#9b7b53"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - T * 0.28, cy - T * 0.1); ctx.lineTo(cx - T * 0.22, cy - T * 0.5); ctx.moveTo(cx + T * 0.28, cy - T * 0.1); ctx.lineTo(cx + T * 0.22, cy - T * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - T * 0.26, cy - T * 0.48); ctx.lineTo(cx + T * 0.26, cy - T * 0.48); ctx.stroke();
}
function _drawSparkle(ctx, cx, cy, T, color) {
  ctx.fillStyle = color; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(cx, cy, T * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff8d0"; ctx.beginPath(); ctx.arc(cx - T * 0.05, cy - T * 0.05, T * 0.05, 0, Math.PI * 2); ctx.fill();
}
function _drawSkyMark(ctx, cx, cy, T) {
  // ちいさな くも＋きらめき（“そらを みあげる”しるし）
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath(); ctx.arc(cx - T * 0.12, cy, T * 0.13, 0, Math.PI * 2);
  ctx.arc(cx + T * 0.04, cy - T * 0.05, T * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + T * 0.2, cy, T * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff3a8"; ctx.font = "bold " + Math.round(T * 0.3) + "px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✦", cx + T * 0.05, cy - T * 0.04);
}
function _drawExit(ctx, cx, cy, T, sprite) {
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.strokeStyle = "#b98a5e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, T * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#c4587a"; ctx.font = "bold " + Math.round(T * 0.34) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const ar = sprite === "exitL" ? "←" : sprite === "exitR" ? "→" : sprite === "exitU" ? "↑" : "↓";
  ctx.fillText(ar, cx, cy);
}

// ──────────────────────────────────────────
// 2頭身どうぶつの顔（会話/言い争いの立ち絵）。drawPortrait(canvasId, key)
// ──────────────────────────────────────────
function drawPortrait(canvasId, key) {
  const ctx = _ctx(canvasId); const c = _el(canvasId); if (!ctx || !c) return;
  const W = c.width || 132, H = c.height || 132;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.54, r = W * 0.34;
  const color = _npcColor(key) !== "#fdfaf4" ? _npcColor(key) : _argColor(key);
  const col = (color && color !== "#ddd") ? color : (key === "player" ? "#ffffff" : "#fdfaf4");
  // 背景の まる
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2); ctx.fill();
  // からだ
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(cx - r * 0.55, cy - r * 0.78, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.55, cy - r * 0.78, r * 0.3, 0, Math.PI * 2); ctx.fill();
  if (key === "watcher") {
    ctx.fillStyle = "#4a4a78";
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.35, r * 0.11, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = "#5b4636";
  ctx.beginPath(); ctx.arc(cx - r * 0.34, cy - r * 0.04, r * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.34, cy - r * 0.04, r * 0.11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5b4636"; ctx.lineWidth = 2;
  ctx.beginPath();
  if (key === "nushi" || key === "quarrel") { ctx.moveTo(cx - r * 0.22, cy + r * 0.5); ctx.quadraticCurveTo(cx, cy + r * 0.3, cx + r * 0.22, cy + r * 0.5); }
  else { ctx.moveTo(cx - r * 0.22, cy + r * 0.34); ctx.quadraticCurveTo(cx, cy + r * 0.56, cx + r * 0.22, cy + r * 0.34); }
  ctx.stroke();
  ctx.fillStyle = "rgba(243,168,176,0.5)";
  ctx.beginPath(); ctx.arc(cx - r * 0.55, cy + r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.55, cy + r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
}

// ──────────────────────────────────────────
// タイプライタ（{{id}} を割らずに 1 文字ずつ）
// ──────────────────────────────────────────
let _tw = null;
function _atomize(s) {
  const atoms = []; let i = 0;
  while (i < s.length) {
    if (s[i] === "{" && s[i + 1] === "{") { const end = s.indexOf("}}", i); if (end !== -1) { atoms.push(s.slice(i, end + 2)); i = end + 2; continue; } }
    atoms.push(s[i]); i++;
  }
  return atoms;
}
function _twSpeed(atom) { if (atom === "、" || atom === "。" || atom === "—" || atom === "…") return 90; if (atom === "\n") return 60; return 24; }
function twActive() { return !!_tw; }
function twFinish() {
  if (!_tw) return;
  const o = _tw.opts, el = _tw.el, full = _tw.full;
  if (_tw.timer && typeof clearTimeout === "function") { try { clearTimeout(_tw.timer); } catch (e) {} }
  _tw = null;
  if (el) el.innerHTML = renderText(full);
  if (o && o.onDone) o.onDone();
}
function typeInto(elId, text, opts) {
  opts = opts || {};
  const el = _el(elId); if (!el) { if (opts.onDone) opts.onDone(); return; }
  if (_tw) { if (_tw.timer && typeof clearTimeout === "function") { try { clearTimeout(_tw.timer); } catch (e) {} } _tw = null; }
  const full = String(text == null ? "" : text);
  if (_reduce()) { el.innerHTML = renderText(full); if (opts.onDone) opts.onDone(); return; }
  const atoms = _atomize(full);
  _tw = { el: el, atoms: atoms, i: 0, opts: opts, timer: null, full: full, speaker: opts.speaker || null };
  el.innerHTML = "";
  const tick = () => {
    if (!_tw) return;
    _tw.i++;
    const prefix = atoms.slice(0, _tw.i).join("");
    el.innerHTML = renderText(prefix) + '<span class="tw-cursor">▍</span>';
    const last = atoms[_tw.i - 1];
    if (last && /\S/.test(last) && _tw.i % 2 === 0 && typeof audioBlip === "function") audioBlip(_tw.speaker);
    if (_tw.i >= atoms.length) { const o = _tw.opts; _tw = null; el.innerHTML = renderText(full); if (o.onDone) o.onDone(); return; }
    _tw.timer = setTimeout(tick, _twSpeed(last));
  };
  _tw.timer = setTimeout(tick, 12);
}

// ──────────────────────────────────────────
// 習得ポップ（覚えた瞬間に中央でぴょこっ）
// ──────────────────────────────────────────
function showLearn(id, kind, onDone) {
  const w = WORDS[id]; if (!w) { if (onDone) onDone(); return; }
  if (typeof playSe === "function") playSe(w.meta ? "reveal" : "learn");
  // 節目の言葉（reveal）は、世界ぜんたいが いっしゅん ひらく（白いパルス＋専用音）
  if (w.reveal && typeof document !== "undefined" && document.body && document.body.classList) {
    try {
      document.body.classList.add("world-pulse");
      if (typeof playSe === "function") playSe("pulse");
      setTimeout(() => { try { document.body.classList.remove("world-pulse"); } catch (e) {} }, _reduce() ? 60 : 950);
    } catch (e) {}
  }
  const pop = _el("learn-pop");
  const cls = w.tone === "toge" ? "toge" : w.tone === "yawa" ? "yawa" : "";
  if (pop) {
    pop.innerHTML = '<div class="lp-card ' + cls + '"><div class="lp-cap">ことばを おぼえた</div>' +
      '<div class="lp-word">' + escapeHtml(w.text) + '</div>' +
      '<div class="lp-desc">' + escapeHtml(w.desc || "") + '</div></div>';
    if (pop.classList) pop.classList.add("show");
  }
  // ことばバッジが ぴょこっと はねる（“ふえた”の体感）
  const badge = _el("vocab-badge");
  if (badge && badge.classList) {
    try { badge.classList.add("bump"); setTimeout(() => { try { badge.classList.remove("bump"); } catch (e) {} }, 500); } catch (e) {}
  }
  const hold = _reduce() ? 60 : 1100;
  setTimeout(() => { if (pop && pop.classList) pop.classList.remove("show"); if (onDone) onDone(); }, hold);
}

// ──────────────────────────────────────────
// 言い争い（描画）
// ──────────────────────────────────────────
function renderArgueShell() {
  _setHtml("ov-argue",
    '<div class="arg-card">' +
      '<div class="arg-head">' +
        '<canvas id="arg-portrait" class="arg-portrait" width="120" height="120" aria-hidden="true"></canvas>' +
        '<div class="arg-bubble"><div id="arg-speaker" class="arg-speaker"></div><div id="arg-mood" class="arg-mood"></div></div>' +
      '</div>' +
      '<div class="arg-saywrap"><div id="arg-say" class="arg-say"></div><div id="arg-hint" class="arg-hint"></div></div>' +
      '<div id="arg-actions" class="arg-actions"></div>' +
    '</div>');
}
function renderArgueFrame() {
  const f = (typeof argueFrame === "function") ? argueFrame() : null; if (!f) return;
  drawPortrait("arg-portrait", f.portrait);
  _setHtml("arg-speaker", renderText(f.speaker));
  _setHtml("arg-mood", renderText(f.mood));
  let html = "";
  (f.actions || []).forEach((a) => {
    if (a.kind === "observe") html += '<button class="arg-btn observe" data-argact="' + a.id + '">🔎 ' + escapeHtml(a.label) + '</button>';
    else { const tc = a.tone === "toge" ? "toge" : a.tone === "yawa" ? "yawa" : ""; html += '<button class="arg-btn say ' + tc + '" data-argact="' + a.id + '">「' + escapeHtml(a.label) + '」</button>'; }
  });
  _setHtml("arg-actions", html);
}

// ──────────────────────────────────────────
// 図鑑（覚えた言葉の一覧）
// ──────────────────────────────────────────
function renderVocab() {
  const got = (typeof vocabCount === "function") ? vocabCount() : 0;
  let cells = "";
  WORD_ORDER.forEach((id) => {
    const w = WORDS[id], known = isKnown(id);
    const tc = w.tone === "toge" ? "toge" : w.tone === "yawa" ? "yawa" : "";
    if (known) cells += '<div class="vc ' + tc + '"><div class="vc-word">' + escapeHtml(w.text) + '</div><div class="vc-desc">' + escapeHtml(w.desc || "") + '</div></div>';
    else cells += '<div class="vc locked"><div class="vc-word">？？？</div><div class="vc-desc vc-hint">' + escapeHtml(w.hint || "まだ しらない ことば") + '</div></div>';
  });
  _setHtml("ov-vocab",
    '<div class="vocab-card">' +
      '<div class="vocab-top"><div class="vocab-title">ことばの ずかん</div>' +
      '<div class="vocab-count">' + got + ' / ' + WORD_ORDER.length + '</div></div>' +
      '<div class="vocab-grid">' + cells + '</div>' +
      '<button class="btn" data-action="closeVocab">とじる（Esc）</button>' +
    '</div>');
}

// ──────────────────────────────────────────
// ポーズ
// ──────────────────────────────────────────
function renderPause() {
  const muted = (typeof isMuted === "function") && isMuted();
  _setHtml("ov-pause",
    '<div class="pause-card">' +
      '<div class="pause-title">ちょっと きゅうけい</div>' +
      '<button class="btn primary" data-action="resume">▶ つづける</button>' +
      '<button class="btn" data-action="save">💾 セーブ</button>' +
      '<button class="btn" data-action="openVocab">📖 ことばの ずかん</button>' +
      '<button class="btn ghost" data-action="mute">' + (muted ? "🔇 おと: けし" : "🔊 おと: あり") + '</button>' +
      '<button class="btn ghost" data-action="title">タイトルへ もどる</button>' +
    '</div>');
}

// ──────────────────────────────────────────
// エンディング（モンタージュ → むすび → タイトルカード）
// ──────────────────────────────────────────
function renderEndingShell() {
  _setHtml("ov-ending",
    '<div class="end-card">' +
      '<div id="end-montage" class="end-montage"></div>' +
      '<div id="end-text" class="end-text"></div>' +
      '<div id="end-card-title" class="end-titlecard"></div>' +
      '<div id="end-actions" class="end-actions"></div>' +
    '</div>');
}
function endingAddWord(id) {
  const m = _el("end-montage"); if (!m) return;
  const w = WORDS[id]; if (!w) return;
  const tc = w.tone === "toge" ? "toge" : w.tone === "yawa" ? "yawa" : "";
  const span = (typeof document !== "undefined") ? document.createElement("span") : null;
  if (span) { span.className = "end-word " + tc; span.textContent = w.text; m.appendChild(span); }
  if (typeof playSe === "function") playSe("page");
}
function endingShowTitlecard(kind) {
  const tc = _el("end-card-title");
  const t = (ENDING[kind] && ENDING[kind].title) || "ことばの むら";
  if (tc) tc.textContent = "—— " + t + " ——";
  // ちいさな統計（かぞえうたの“余韻”＝この周のきみ）。むすび回収率は周回の道しるべ。
  const s = (typeof soulData === "function") ? soulData() : null;
  const found = s ? ["light", "dim", "dark"].filter((k) => s.endings && s.endings[k] > 0).length : 0;
  const mins = (typeof metaElapsedSec === "function") ? Math.max(1, Math.round(metaElapsedSec() / 60)) : 0;
  const stats = '<div class="end-stats">ことば ' + ((typeof vocabCount === "function") ? vocabCount() : 0) + ' / ' + WORD_ORDER.length +
                '　·　' + mins + 'ふん' + (found ? '　·　むすび ' + found + '/3' : '') + '</div>';
  let html = stats +
             '<button class="btn primary" data-action="again">▶ もういちど（ちがう ことばで）</button>' +
             '<button class="btn" data-action="openVocab">📖 ことばの ずかん</button>' +
             '<button class="btn ghost" data-action="title">タイトルへ</button>';
  _setHtml("end-actions", html);
}

// ──────────────────────────────────────────
// トースト
// ──────────────────────────────────────────
let _toastTimer = null;
function toast(msg) {
  const t = _el("toast"); if (!t) return;
  t.textContent = msg; if (t.classList) t.classList.add("show");
  if (_toastTimer && typeof clearTimeout === "function") { try { clearTimeout(_toastTimer); } catch (e) {} }
  _toastTimer = setTimeout(() => { if (t.classList) t.classList.remove("show"); }, _reduce() ? 80 : 1800);
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.render = render;
  window.renderTitle = renderTitle;
  window.refreshFieldHud = refreshFieldHud;
  window.drawField = drawField;
  window.drawPortrait = drawPortrait;
  window.typeInto = typeInto;
  window.twActive = twActive;
  window.twFinish = twFinish;
  window.showLearn = showLearn;
  window.renderArgueShell = renderArgueShell;
  window.renderArgueFrame = renderArgueFrame;
  window.renderVocab = renderVocab;
  window.renderPause = renderPause;
  window.renderEndingShell = renderEndingShell;
  window.endingAddWord = endingAddWord;
  window.endingShowTitlecard = endingShowTitlecard;
  window.applyTone = applyTone;
  window.toast = toast;
}
