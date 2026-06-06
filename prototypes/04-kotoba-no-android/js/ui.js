/*
 * ui.js — 描画と DOM 操作の集約（唯一の DOM 依存コア）
 *
 * render() が app.screen を見て各 overlay / バトルHUD を出し分け、state/battle/metrics を
 * 読み取って表示する。思いやりゲージ(omoiyari)は“器ごと”描かない（本作の署名）。
 *
 * ・実際のデータ操作は state/battle/cards/field/save 側。ui は読み取りと描画に徹する。
 * ・入力（クリック/キー/カーソル）の配線は main.js。ui はボタンに data-action/data-word/data-node を
 *   付けるだけで、main がイベント委譲で拾う（疎結合）。
 *
 * ※ DOM 依存。末尾で window へ明示エクスポート。
 */

// 小さなヘルパ
function _el(id) { return document.getElementById(id); }
function _esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function _show(elm) { if (elm) elm.classList.remove("hidden"); }
function _hide(elm) { if (elm) elm.classList.add("hidden"); }

// screen → 表示する overlay の id
const SCREEN_OVERLAY = {
  title: "overlay-title",
  field: "overlay-field",
  dialogue: "overlay-dialogue",
  cards: "overlay-cards",
  shop: "overlay-shop",
  result: "overlay-result",
  meta: "overlay-meta",
  gameover: "overlay-gameover",
  pause: "overlay-pause",
};

// ──────────────────────────────────────────
// applyScreen — 可視状態（overlay/HUD/menu/body翳り）を app.screen に合わせる。
// ──────────────────────────────────────────
function applyScreen() {
  const screen = app.screen;
  // すべての overlay を畳んでから対象だけ出す
  Object.keys(SCREEN_OVERLAY).forEach((k) => {
    const o = _el(SCREEN_OVERLAY[k]);
    if (!o) return;
    if (k === screen) _show(o); else _hide(o);
  });
  // バトルHUD（#game）は battle のときだけ
  if (screen === "battle") _show(_el("game")); else _hide(_el("game"));
  // 中断メニュー（☰）は field/battle のときだけ
  const menu = _el("menu-btn");
  if (screen === "field" || screen === "battle") _show(menu); else _hide(menu);

  // 主人公だけ翳る：body へ dark-N（凶暴の蓄積に応じて）
  const d = (typeof darkLevel === "function") ? darkLevel() : 0;
  document.body.classList.remove("dark-1", "dark-2", "dark-3");
  if (d >= 1) document.body.classList.add("dark-" + Math.min(3, d));
}

// ──────────────────────────────────────────
// render — メインの描画入口（main が状態変更のたびに呼ぶ）。
// ──────────────────────────────────────────
function render() {
  switch (app.screen) {
    case "title": renderTitle(); break;
    case "field": renderField(); break;
    case "dialogue": renderDialogue(); break;
    case "cards": renderCards(); break;
    case "shop": renderShop(); break;
    case "battle": renderBattle(); break;
    case "result": renderResult(); break;
    case "meta": renderMeta(); break;
    case "gameover": renderGameover(); break;
    case "pause": renderPause(); break;
  }
  applyScreen();
  playFx();
}

// ── タイトル ──
function renderTitle() {
  const canContinue = (typeof hasSave === "function") && hasSave();
  const muted = (typeof isMuted === "function") && isMuted();
  const prologueHtml = _esc(TITLE.prologue).replace(/\n/g, "<br>");
  _el("overlay-title").querySelector(".title-panel").innerHTML =
    '<button class="mute-btn" data-action="mute" title="音の ON/OFF" aria-label="音の ON/OFF">' + (muted ? "🔇" : "♪") + '</button>' +
    '<h1 class="game-title">' + _esc(TITLE.title) + '</h1>' +
    '<p class="game-subtitle">' + _esc(TITLE.subtitle) + '</p>' +
    '<div class="title-prologue">' + prologueHtml + '</div>' +
    '<div class="title-btns">' +
      '<button class="start-btn" data-action="start">▶ はじめる</button>' +
      '<button class="continue-btn" data-action="continue"' + (canContinue ? "" : " disabled") + '>つづきから</button>' +
    '</div>' +
    '<p class="title-foot">' + _esc(TITLE.estPlay) + ' ／ そうさは マウス（またはキーボード）だけ</p>';
}

// ── フィールド（村）：広場にノードと主人公ルゥを置く ──
function renderField() {
  const body = _el("overlay-field");
  body.querySelector(".field-area").textContent = AREA.name;
  body.querySelector(".field-hint").textContent = AREA.hint;
  const plaza = body.querySelector(".field-plaza");

  // ノード（NPC/敵/セーブ/立て札/出口）をボタンで配置＝Tab で辿れて Enter/クリックで発火（アクセシブル）。
  const nodes = areaNodes();
  const objId = (typeof objectiveNodeId === "function") ? objectiveNodeId() : null;
  let html = "";
  nodes.forEach((n) => {
    const lockCls = (n.type === "exit" && n.locked) ? " locked" : "";
    const doneCls = (n.type === "npc" && n.done) ? " done" : "";
    const objCls = (n.id === objId) ? " objective" : "";   // いま向かうべきノードを強調
    const arrow = (n.id === objId) ? '<span class="node-arrow" aria-hidden="true">▾</span>' : "";
    html += '<button class="node node-' + n.type + lockCls + doneCls + objCls + '" data-node="' + _esc(n.id) + '"' +
            ' style="left:' + (n.x * 100) + '%; top:' + (n.y * 100) + '%"' +
            ' aria-label="' + _esc(n.label) + '">' +
            arrow +
            '<span class="node-ic" aria-hidden="true">' + nodeArt(n) + '</span>' +
            '<span class="node-label">' + _esc(n.label) + (n.type === "exit" && n.locked ? "（まだ）" : "") + '</span>' +
            '</button>';
  });
  // 主人公ルゥ（アバター＝SVG）
  html += '<div class="avatar" aria-label="ルゥ">' + sprite("ruu") + '</div>';
  plaza.innerHTML = html;

  // 参照を保持（main の rAF が位置と near 判定で使う）
  app._field = {
    plaza: plaza,
    avatar: plaza.querySelector(".avatar"),
    nodeEls: {},
  };
  nodes.forEach((n) => { app._field.nodeEls[n.id] = plaza.querySelector('[data-node="' + n.id + '"]'); });

  body.querySelector(".field-msg").textContent = (typeof objectiveHint === "function") ? objectiveHint() : "";
  body.querySelector(".field-sub").textContent = "ひかっている ところを クリック（キーボードは Tab→Enter）。";
}

function nodeIcon(type) {
  switch (type) {
    case "npc": return "💬";
    case "enemy": return "▲";
    case "save": return "✦";
    case "sign": return "▤";
    case "exit": return "⇪";
    default: return "・";
  }
}
// SPRITES からSVGを引く小ヘルパ（無ければ空文字＝落ちない）。
function sprite(id) {
  return (typeof SPRITES !== "undefined" && SPRITES[id]) ? SPRITES[id] : "";
}
// フィールドのノード絵：NPC/敵はキャラSVG、その他は記号アイコン。
function nodeArt(n) {
  let key = null;
  if (n.type === "npc" && typeof NPCS !== "undefined" && NPCS[n.ref]) key = NPCS[n.ref].sprite;
  else if (n.type === "enemy" && typeof ENEMIES !== "undefined" && ENEMIES[n.ref]) key = ENEMIES[n.ref].sprite;
  return (key && sprite(key)) ? sprite(key) : nodeIcon(n.type);
}

// main の rAF から呼ぶ：アバター位置の反映と、近接ノードの強調。
function positionAvatar(x, y) {
  if (!app._field || !app._field.avatar) return;
  app._field.avatar.style.left = (x * 100) + "%";
  app._field.avatar.style.top = (y * 100) + "%";
}
function highlightNear(node) {
  if (!app._field) return;
  Object.keys(app._field.nodeEls).forEach((id) => {
    const elm = app._field.nodeEls[id];
    if (!elm) return;
    if (node && node.id === id) elm.classList.add("near");
    else elm.classList.remove("near");
  });
  const sub = _el("overlay-field").querySelector(".field-sub");
  if (sub) sub.textContent = node ? ("▶ 「" + node.label + "」に ふれる") : "";
}

// ── 会話（typewriter は main が制御。ここは骨格描画） ──
function renderDialogue() {
  const d = game.dialogue;
  if (!d) return;
  const npc = NPCS[d.npcId];
  const panel = _el("overlay-dialogue").querySelector(".dialogue-panel");
  // 問い（offerPrompt）フェーズかどうかは d.asking で区別（main がセット）。
  panel.innerHTML =
    '<div class="dia-head"><span class="dia-face face-' + _esc(npc.shape) + '">' + sprite(npc.sprite) + '</span>' +
      '<span class="dia-name">' + _esc(npc.name) + '</span>' +
      '<span class="dia-role">' + _esc(npc.role || "") + '</span></div>' +
    '<div class="dia-body"></div>' +
    '<div class="dia-hint">▶ クリックで つづける</div>';
}

// ── カード3択 ──
function renderCards() {
  const panel = _el("overlay-cards").querySelector(".cards-panel");
  const ids = game.pendingCards || [];
  let cards = "";
  ids.forEach((id) => {
    const w = WORDS[id];
    if (!w) return;
    const isHarsh = w.kind === "harsh";
    const tag = isHarsh ? "とげの ことば" : "やわらかい ことば";
    const eff = isHarsh ? "削る（早い・凶暴へ）" : "寄りそう（おそい・優しさへ）";
    const icon = isHarsh ? "▲" : "●";
    cards +=
      '<button class="card-pick ' + (isHarsh ? "pick-harsh" : "pick-kind") + '" data-action="pick" data-word="' + _esc(id) + '">' +
        '<span class="pick-tag">' + icon + " " + tag + '</span>' +
        '<span class="pick-name">' + _esc(w.levels[0]) + '</span>' +
        '<span class="pick-flavor">' + _esc(w.flavor) + '</span>' +
        '<span class="pick-eff">' + eff + '</span>' +
      '</button>';
  });
  panel.innerHTML =
    '<h2 class="cards-title">どの ことばを ひろう?</h2>' +
    '<p class="cards-sub">えらんだ いろが、きみを 少し かたむける。</p>' +
    '<div class="cards-grid">' + cards + '</div>' +
    '<p class="card-tradeoff">とげ＝早いが 凶暴へ／やわ＝おそいが 優しさへ。</p>';
}

// ── バトルHUD（見えるゲージは2本だけ：敵 精神HP／自分 hp。思いやりは描かない） ──
function renderBattle() {
  const b = game.battle;
  if (!b) return;
  const en = ENEMIES[b.enemyId];
  const d = (typeof darkLevel === "function") ? darkLevel() : 0;

  // topbar：エリア・ターン・翳り段（dark dots）
  let dark = "";
  for (let i = 1; i <= 3; i++) dark += '<span class="dark-dot' + (d >= i ? " on" : "") + '"></span>';
  _el("topbar").innerHTML =
    '<span class="tb-area">' + _esc(AREA.name) + '</span>' +
    '<span class="tb-turn">ターン ' + b.turn + '</span>' +
    '<span class="tb-dark" title="ルゥの 翳り">' + dark + '</span>';

  // enemy-area：相手＋見える精神HPバー（思いやりは出さない）
  const mindPct = Math.max(0, Math.round((b.mindHp / b.mindHpMax) * 100));
  _el("enemy-area").innerHTML =
    '<div class="enemy-sprite shape-' + _esc(en.shape) + '" style="--col:' + _esc(en.color) + '">' + sprite(en.sprite) + '</div>' +
    '<div class="enemy-info">' +
      '<div class="enemy-name">' + _esc(en.name) + '</div>' +
      '<div class="bar-row"><span class="bar-label">精神HP</span>' +
        '<div class="bar mind"><span class="bar-fill" style="width:' + mindPct + '%"></span></div>' +
        '<span class="bar-num">' + Math.max(0, b.mindHp) + '/' + b.mindHpMax + '</span></div>' +
    '</div>';

  // log（直近4行）
  const lines = (game.log || []).slice(-4).map((l) => '<div class="log-line">' + _esc(l) + '</div>').join("");
  _el("log").innerHTML = lines;

  // player-bar：ルゥと見える hp のみ
  const hpPct = Math.max(0, Math.round((game.player.hp / game.player.maxHp) * 100));
  _el("player-bar").innerHTML =
    '<div class="player-sprite' + (d >= 1 ? " dimmed" : "") + '">' + sprite("ruu") + '</div>' +
    '<div class="player-info">' +
      '<div class="player-name">' + _esc(game.player.displayName) + '</div>' +
      '<div class="bar-row"><span class="bar-label">hp</span>' +
        '<div class="bar hp"><span class="bar-fill" style="width:' + hpPct + '%"></span></div>' +
        '<span class="bar-num">' + Math.max(0, game.player.hp) + '/' + game.player.maxHp + '</span></div>' +
    '</div>';

  // 敵ターン待ちは“相手が考えている”を出す。それ以外は翳り段に応じてルゥの内心（DARK_LINES）。
  const busy = !!app.battleBusy;
  const dl = busy
    ? ("…… " + en.name + " が、ことばを さがしている。")
    : ((typeof DARK_LINES !== "undefined" && DARK_LINES[Math.min(d, DARK_LINES.length - 1)]) || "ことばを えらぶ。");
  _el("prompt").innerHTML = '<span class="prompt-text' + (!busy && d >= 1 ? " unstable" : "") + '">' + _esc(dl) + '</span>';

  // command-bar：手札を harsh 列 / kind 列で（色＋形＋効果語の三重表現）
  //   ★敵ターン待ちは disabled 属性を“付けない”。理由：disabled は再描画漏れで固定化すると
  //     クリックが永久に発火せず詰む。代わりに JS 側 onCard の battleBusy ガードで弾き、見た目だけ
  //     .busy クラスで薄くする（ボタンは常に物理クリック可能＝二度と固まらない）。
  const cmd = battleCommandList();
  function btns(idList, isHarsh) {
    return idList.map((id) => {
      const lv = cardLevel(id);
      const face = cardFace(id);
      const icon = isHarsh ? "▲" : "●";
      const eff = isHarsh ? "削る" : "寄りそう";
      return '<button class="cmd ' + (isHarsh ? "cmd-harsh" : "cmd-kind") + '" data-action="card" data-word="' + _esc(id) + '">' +
        '<span class="cmd-face">' + icon + " " + _esc(face) + '</span>' +
        '<span class="cmd-eff">' + eff + (lv > 1 ? " ・Lv" + lv : "") + '</span></button>';
    }).join("");
  }
  const cbar = _el("command-bar");
  cbar.innerHTML =
    '<div class="cmd-col cmd-col-harsh"><div class="cmd-head">きつい ことば</div>' + btns(cmd.harsh, true) + '</div>' +
    '<div class="cmd-col cmd-col-kind"><div class="cmd-head">やさしい ことば</div>' + btns(cmd.kind, false) + '</div>';
  if (cbar.classList) cbar.classList.toggle("busy", !!app.battleBusy); // 見た目だけ薄く（クリックは可能）
}

// ── 結果／簡易エンド（勝ち方×傾向＋軽いメタ1行） ──
function renderResult() {
  const e = game.ending || (typeof determineEnding === "function" ? determineEnding() : null);
  const meta = (typeof metaLineForMetrics === "function") ? metaLineForMetrics() : "";
  const t = game.player.tendency;
  const rate = (typeof yasashisaRate === "function") ? yasashisaRate() : 0;
  const winWord = game.lastWinKind === true ? "寄り添って 収めた"
    : game.lastWinKind === false ? "言い負かした" : "場を 終えた";
  const labels = (typeof TENDENCY_LABELS !== "undefined") ? TENDENCY_LABELS : { kyoubou: "とがり", yasashisa: "やわらぎ" };

  _el("overlay-result").querySelector(".result-panel").innerHTML =
    '<div class="result-tone tone-' + _esc(e ? e.tone : "chukan") + '">' +
      '<h2 class="result-title">' + _esc(e ? e.title : "おわり") + '</h2>' +
      '<p class="result-win">きみは、' + winWord + '。</p>' +
    '</div>' +
    '<p class="result-text">' + _esc(e ? e.text : "") + '</p>' +
    '<div class="result-tendency">' +
      '<div class="tend-row"><span>' + _esc(labels.kyoubou) + '</span>' +
        '<div class="tend-bar"><span class="tend-fill tf-k" style="width:' + Math.round((1 - rate) * 100) + '%"></span></div></div>' +
      '<div class="tend-row"><span>' + _esc(labels.yasashisa) + '</span>' +
        '<div class="tend-bar"><span class="tend-fill tf-y" style="width:' + Math.round(rate * 100) + '%"></span></div></div>' +
    '</div>' +
    '<div class="result-meta">' + _esc(meta) + '</div>' +
    '<div class="result-btns">' +
      (hasFlag("boss_done")
        ? '<button class="r-btn" data-action="meta">井戸の こえ を、きく……</button>'
        : '<button class="r-btn" data-action="again">もう いちど</button>') +
      '<button class="r-btn ghost" data-action="title">タイトルへ</button>' +
    '</div>';
}

// ── ゲームオーバー（非パーマデス） ──
function renderGameover() {
  const canLoad = (typeof hasSave === "function") && hasSave();
  _el("overlay-gameover").querySelector(".gameover-panel").innerHTML =
    '<h2 class="go-title">ことばに のまれた</h2>' +
    '<p class="go-text">でも、おわりじゃない。<br>ひと息 ついて、もういちど。</p>' +
    '<div class="go-btns">' +
      '<button class="r-btn" data-action="load"' + (canLoad ? "" : " disabled") + '>セーブから やりなおす</button>' +
      '<button class="r-btn ghost" data-action="title">タイトルへ</button>' +
    '</div>';
}

// ── ポーズ（中断メニュー） ──
function renderPause() {
  const muted = (typeof isMuted === "function") && isMuted();
  _el("overlay-pause").querySelector(".pause-panel").innerHTML =
    '<h2 class="pause-title">ちょっと きゅうけい</h2>' +
    '<div class="pause-btns">' +
      '<button class="r-btn" data-action="resume">つづける</button>' +
      '<button class="r-btn" data-action="save">セーブ</button>' +
      '<button class="r-btn" data-action="mute">' + (muted ? "音を つける" : "音を けす") + '</button>' +
      '<button class="r-btn ghost" data-action="title">タイトルへ</button>' +
    '</div>';
}

// ── 学校＝ことばショップ（cards のスタイルを流用して1枚 受け取る） ──
function renderShop() {
  const panel = _el("overlay-shop").querySelector(".shop-panel");
  const stock = (game.pendingShop || ((typeof SHOP !== "undefined") ? SHOP.stock : []) || []).filter((id) => WORDS[id]);
  let items = "";
  stock.forEach((id) => {
    const w = WORDS[id];
    const isHarsh = w.kind === "harsh";
    const icon = isHarsh ? "▲" : "●";
    const tag = isHarsh ? "とげの ことば" : "やわらかい ことば";
    const eff = isHarsh ? "削る（早い・凶暴へ）" : "寄りそう（おそい・優しさへ）";
    items +=
      '<button class="card-pick ' + (isHarsh ? "pick-harsh" : "pick-kind") + '" data-action="buy" data-word="' + _esc(id) + '">' +
        '<span class="pick-tag">' + icon + " " + tag + '</span>' +
        '<span class="pick-name">' + _esc(w.levels[0]) + '</span>' +
        '<span class="pick-flavor">' + _esc(w.flavor) + '</span>' +
        '<span class="pick-eff">' + eff + '</span>' +
      '</button>';
  });
  panel.innerHTML =
    '<h2 class="cards-title">' + _esc(SHOP.name) + '</h2>' +
    '<p class="cards-sub">' + _esc(SHOP.intro) + '</p>' +
    '<div class="cards-grid">' + items + '</div>' +
    '<button class="r-btn ghost" data-action="leaveShop">かわずに 出る</button>';
}

// ── 神様メタ（井戸の こえ）：スケルトンだけ作る。中身は main が段階的に流し込む（dialogue と同じ流儀）──
function renderMeta() {
  const panel = _el("overlay-meta").querySelector(".meta-panel");
  const god = (typeof META !== "undefined") ? META.godName : "こえ";
  const tone = (game.ending ? game.ending.tone : "chukan");
  panel.innerHTML =
    '<div class="meta-god">' + _esc(god) + '</div>' +
    '<div class="meta-logo tone-' + _esc(tone) + '" aria-hidden="true">' + metaLogoHtml(false) + '</div>' +
    '<div class="meta-body"></div>' +
    '<div class="meta-foot"></div>';
}
// WOR[L]D の綴り：reveal 前は L の位置が欠け（·）、reveal 後は L が差し込まれ WORLD になる。
function metaLogoHtml(revealed) {
  const slot = revealed
    ? '<span class="rv rv-l on">L</span>'
    : '<span class="rv rv-l">·</span>';
  const jp = revealed ? "ことば に、きみ（L）。 → せかい" : "ことば に、ひとつ たりない……";
  return '<span class="rv">W</span><span class="rv">O</span><span class="rv">R</span>' + slot + '<span class="rv">D</span>' +
    '<div class="rv-jp">' + jp + '</div>';
}
// 計測の“鏡”（実値を採点でなく ただ うつして 見せる）。
function metaMirrorHtml() {
  const s = (typeof metricsSummary === "function") ? metricsSummary() : { skipRatio: 0, clicks: 0, avgDwellMs: 0, cursorDist: 0 };
  const M = (typeof META !== "undefined") ? META : { mirrorIntro: "", mirrorOutro: "" };
  function row(k, v) { return '<div class="mm-row"><dt>' + _esc(k) + '</dt><dd>' + _esc(v) + '</dd></div>'; }
  return '<p class="mm-intro">' + _esc(M.mirrorIntro || "") + '</p>' +
    '<dl class="meta-mirror">' +
      row("とばした わりあい", Math.round(s.skipRatio * 100) + " %") +
      row("おした かいすう", s.clicks + " 回") +
      row("1ブロック 滞在", (Math.round(s.avgDwellMs / 100) / 10) + " 秒") +
      row("カーソル いどう", Math.round(s.cursorDist) + " px") +
    '</dl>' +
    '<p class="mm-outro">' + _esc(M.mirrorOutro || "") + '</p>';
}

// ──────────────────────────────────────────
// typewriter — 1文字ずつ表示。main が「送る/スキップ」を制御するための状態を持つ。
// ──────────────────────────────────────────
let _tw = { timer: null, full: "", shown: 0, target: null, done: true };

function typewriter(targetEl, text) {
  if (!targetEl) return;
  if (_tw.timer) { clearInterval(_tw.timer); _tw.timer = null; }
  _tw.full = String(text || "");
  _tw.shown = 0;
  _tw.target = targetEl;
  _tw.done = false;
  targetEl.textContent = "";
  if (typeof textShown === "function") textShown(_tw.full.length); // 計測：このブロックを提示
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) { targetEl.textContent = _tw.full; _tw.shown = _tw.full.length; _tw.done = true; return; }
  _tw.timer = setInterval(() => {
    _tw.shown++;
    _tw.target.textContent = _tw.full.slice(0, _tw.shown);
    if (_tw.shown >= _tw.full.length) { clearInterval(_tw.timer); _tw.timer = null; _tw.done = true; }
  }, 28);
}
function twActive() { return !_tw.done; }       // まだタイプ途中か（クリック＝スキップ判定に使う）
function twFinish() {                            // 全文を即表示
  if (_tw.timer) { clearInterval(_tw.timer); _tw.timer = null; }
  if (_tw.target) _tw.target.textContent = _tw.full;
  _tw.shown = _tw.full.length;
  _tw.done = true;
}

// ──────────────────────────────────────────
// toast / playFx
// ──────────────────────────────────────────
let _toastTimer = null;
function toast(msg) {
  const t = _el("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

// 演出キュー（game.fx）を消費。MVP は軽い視覚反応のみ。
function playFx() {
  if (!game || !game.fx || !game.fx.length) return;
  const fxs = game.fx.splice(0, game.fx.length);
  const enemySp = document.querySelector("#enemy-area .enemy-sprite");
  const playerSp = document.querySelector("#player-bar .player-sprite");
  fxs.forEach((ev) => {
    if (ev.type === "harshHit") {
      floatNum(_el("enemy-area"), "-" + ev.n, "fx-harsh");
      react(enemySp, "hit");          // 敵がのけぞる
      shake(_el("enemy-area"));
    } else if (ev.type === "enemyHit") {
      floatNum(_el("player-bar"), "-" + ev.n, "fx-enemy");
      react(enemySp, "lunge");        // 敵が言葉を“突き出す”
      react(playerSp, "hit");         // ルゥがのけぞる
      shake(_el("game"));
    } else if (ev.type === "heal") {
      floatNum(_el("player-bar"), "+" + ev.n, "fx-heal");
    }
    // kindUse / lowerAtk は“数値を出さない”（見えない手応え）。緑の波紋＋敵がふっと和らぐ。
    else if (ev.type === "kindUse") {
      ripple(_el("enemy-area"));
      react(enemySp, "soften");
      glow(_el("enemy-area"));
    } else if (ev.type === "lowerAtk") {
      ripple(_el("enemy-area"));
      react(enemySp, "soften");
    }
  });
}
// スプライトに一瞬だけ反応クラスを付ける（CSSのkeyframesで動く）。
function react(elm, cls) {
  if (!elm) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elm.classList.remove("fx-hit", "fx-lunge", "fx-soften");
  // reflow を挟んで再アニメ
  void elm.offsetWidth;
  elm.classList.add("fx-" + cls);
  setTimeout(() => elm.classList.remove("fx-" + cls), 380);
}
// 緑の波紋（kindの“見えない手応え”を見える化。数値は出さない）。
function ripple(host) {
  if (!host) return;
  const r = document.createElement("span");
  r.className = "kind-ripple";
  host.appendChild(r);
  setTimeout(() => { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
}
function floatNum(host, text, cls) {
  if (!host) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const s = document.createElement("span");
  s.className = "float-num " + (cls || "");
  s.textContent = text;
  host.appendChild(s);
  setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, reduce ? 200 : 800);
}
function shake(host) {
  if (!host) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  host.classList.add("shake");
  setTimeout(() => host.classList.remove("shake"), 260);
}
function glow(host) {
  if (!host) return;
  host.classList.add("glow");
  setTimeout(() => host.classList.remove("glow"), 320);
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.render = render;
  window.applyScreen = applyScreen;
  window.renderField = renderField;
  window.renderShop = renderShop;
  window.renderMeta = renderMeta;
  window.metaLogoHtml = metaLogoHtml;
  window.metaMirrorHtml = metaMirrorHtml;
  window.positionAvatar = positionAvatar;
  window.highlightNear = highlightNear;
  window.typewriter = typewriter;
  window.twActive = twActive;
  window.twFinish = twFinish;
  window.toast = toast;
  window.playFx = playFx;
}
