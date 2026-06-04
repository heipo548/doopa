/*
 * ui.js — 画面の描画とプレイヤー入力
 *
 * 戦闘はターン制なので、状態が変わるたびに render() で画面を作り直すシンプル方式。
 * 入力は「コマンド選択 → （武器/ACT/対象を選ぶ）→ 実行」という段階を ui.mode で管理する。
 */

// 入力の途中状態（どの段階で、何を選びかけているか）
const ui = {
  mode: "idle",          // idle / weapon / fightTarget / actTarget / act / save / item
  pendingWeapon: null,   // 祓うで選んだ武器
  pendingAct: null,      // こころみるで選んだACT
  pendingActTarget: null,// 先に選んだ「こころみる相手」のuid（ACTを絞り込むため）
  pendingActList: null,  // その相手向けに絞った候補ACTのID配列（毎回シャッフルし直さないよう保持）
};

// よく使うDOM取得＆生成のヘルパー
function $(id) { return document.getElementById(id); }
function setText(id, text) { const e = $(id); if (e) e.textContent = text; }

// ──────────────────────────────────────────
// ピクセルスプライト生成（ドット絵）
//   なぜ：丸い図形をCSSグラデで描くと“ドット絵”に見えない、という指摘への回答。
//   実際に 16×16 の正方形セル（ピクセル）の集合で生きものを描く。色は敵ごとの色を使い、
//   crispEdges＋整数座標で“カクカクのドット”の質感を出す。重い計算なのでキャッシュする。
// ──────────────────────────────────────────
const SPR = 16; // スプライト解像度（16×16ドット）
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
function _inC(x, y, cx, cy, r) { const dx = x - cx + 0.5, dy = y - cy + 0.5; return dx * dx + dy * dy <= r * r; }
// 形ごとの体型（楕円）。全部おなじ丸を脱却し、シルエットで描き分ける。
const SHAPE_BODY = {
  circle: { cx: 8, cy: 10, rx: 6, ry: 5 },  // ずんぐり丸（かわいい・低い）
  bunny:  { cx: 8, cy: 9, rx: 5, ry: 6 },   // 縦長
  ghost:  { cx: 8, cy: 8, rx: 6, ry: 6 },   // 下を波打たせる
  spider: { cx: 8, cy: 9, rx: 7, ry: 5 },   // 横広・平たい
  boss:   { cx: 8, cy: 9, rx: 7, ry: 8 },   // 大きく縦に伸びて 威圧的
};
function _inE(x, y, b) { const dx = (x - b.cx + 0.5) / b.rx, dy = (y - b.cy + 0.5) / b.ry; return dx * dx + dy * dy <= 1; }

// 16×16 のカラーグリッド（null=透明）から、横方向の連続を1つの<rect>にまとめてSVG文字列を作る。
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

// 形ごとのアクセント（耳・脚・冠・ゴーストの裾）をグリッドに足す。
function _accent(grid, shape, col) {
  const put = (x, y, c) => { if (x >= 0 && x < SPR && y >= 0 && y < SPR) grid[y][x] = c; };
  if (shape === "circle") {
    // ちいさな丸い耳（ちいかわ的なまるい生きもの）
    [[4, 1], [4, 2], [11, 1], [11, 2]].forEach(([x, y]) => put(x, y, col.body));
    [[4, 1], [11, 1]].forEach(([x, y]) => put(x, y, col.OUT));
  } else if (shape === "bunny") {
    // 長い耳＋内側のピンク（うさぎ）
    [[4, 0], [4, 1], [4, 2], [5, 2], [11, 0], [11, 1], [11, 2], [10, 2]].forEach(([x, y]) => put(x, y, col.body));
    [[4, 0], [11, 0]].forEach(([x, y]) => put(x, y, col.OUT));
    put(4, 1, "#ff9ab0"); put(11, 1, "#ff9ab0");
  } else if (shape === "spider") {
    [[0, 9], [1, 9], [0, 11], [1, 11], [14, 9], [15, 9], [14, 11], [15, 11]].forEach(([x, y]) => put(x, y, col.OUT));
  } else if (shape === "boss") {
    // 冠＋とがった角＝“ぬし”の威圧感（ただ大きい丸からの脱却）
    [[5, 1], [7, 0], [9, 1]].forEach(([x, y]) => put(x, y, "#ffd86b"));
    [[5, 2], [6, 2], [7, 2], [8, 2], [9, 2]].forEach(([x, y]) => put(x, y, "#e0b24a"));
    [[2, 2], [2, 1], [13, 2], [13, 1]].forEach(([x, y]) => put(x, y, col.OUT)); // 左右の角
  } else if (shape === "ghost") {
    // 裾をギザギザに（足なし・ふわふわ）。下2行を互い違いに抜いて“おばけの裾”に。
    for (let x = 0; x < SPR; x++) {
      if (grid[14] && x % 2 === 0) grid[14][x] = null;
      if (grid[13] && x % 2 === 1 && grid[13][x] === null) { /* keep */ }
    }
    if (grid[13]) { grid[13][2] = null; grid[13][13] = null; }
  }
}

// 顔（表情）：neutral=つぶら / happy=ニコッ（むかえた・おだやか）/ sad=泣き
//   ちいかわ味：ほっぺの赤み＋目の白いきらめき。座標は体型 b 基準で置き、shapeごとのズレを防ぐ。
function _face(grid, expr, sad, b) {
  b = b || SHAPE_BODY.circle;
  const OUT = "#20203a", W = "#ffffff", TEAR = "#7fd0ff", M = "#20203a", BLUSH = "#ff9ab0";
  const put = (x, y, c) => { if (x >= 0 && x < SPR && y >= 0 && y < SPR) grid[y][x] = c; };
  const lx = b.cx - 4, rx = b.cx + 2, ey = b.cy - 2, my = b.cy + 1; // 左目/右目/目の高さ/口の高さ
  put(b.cx - 5, b.cy - 1, BLUSH); put(b.cx + 4, b.cy - 1, BLUSH);   // ほっぺ
  if (expr === "happy") {
    [[lx, ey + 1], [lx + 1, ey], [rx, ey], [rx + 1, ey + 1]].forEach(([x, y]) => put(x, y, OUT)); // ＾ ＾
    [[b.cx - 3, my], [b.cx - 2, my + 1], [b.cx - 1, my + 1], [b.cx, my + 1], [b.cx + 1, my + 1], [b.cx + 2, my]].forEach(([x, y]) => put(x, y, M));
  } else {
    [[lx, ey], [lx + 1, ey], [lx, ey + 1], [lx + 1, ey + 1], [rx, ey], [rx + 1, ey], [rx, ey + 1], [rx + 1, ey + 1]].forEach(([x, y]) => put(x, y, OUT));
    put(lx, ey, W); put(rx, ey, W); put(lx + 1, ey + 1, W); put(rx + 1, ey + 1, W); // きらめき
    if (sad || expr === "sad") {
      [[b.cx - 1, my], [b.cx, my], [b.cx - 1, my + 1], [b.cx, my + 1]].forEach(([x, y]) => put(x, y, M));
      put(lx, ey + 2, TEAR); put(lx, ey + 3, TEAR); // なみだ
    } else {
      [[b.cx - 1, my], [b.cx, my]].forEach(([x, y]) => put(x, y, M)); // ちいさな口
    }
  }
}

// 生きもの1体ぶんのSVG（色・形・表情）。
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
  _face(grid, expr, false, b);
  const svg = `<svg class="spr" viewBox="0 0 ${SPR} ${SPR}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${_gridToRects(grid)}</svg>`;
  _spriteCache[key] = svg;
  return svg;
}

// ──────────────────────────────────────────
// 画面全体を描画
//   v0.4：まず app.screen（街/夜の道/マクロ結末）で大きく分岐し、
//        戦闘(battle)のときだけ 従来の game.state ベースの戦闘描画に進む。
// ──────────────────────────────────────────
function render() {
  const sc = (typeof app !== "undefined" && app) ? app.screen : "battle";
  applyScreen(sc);    // 画面コンテナの表示/非表示を切り替える
  if (sc === "town") { renderTown(); return; }
  if (sc === "field") { renderField(); return; }
  if (sc === "macro") { showMacroResult(); return; }

  if (!game) return;
  applyTone();        // 狂気／ぬくもり に応じて画面のトーンをそっと変える
  renderTopbar();
  renderNakama();     // むかえた友（なかま）の列＝救った手応えの可視化
  renderEnemies();
  renderLog();
  renderPlayer();
  renderCommands();
  renderPrompt();

  // オーバーレイ（レベルアップ / 結末）
  hideOverlay("overlay-levelup");
  hideOverlay("overlay-result");
  if (game.state === STATES.LEVEL_UP) showLevelUp();
  else if (game.state === STATES.DAWN) showResult("dawn");
  else if (game.state === STATES.RUN_OVER) showResult("over");
}

// 狂気／ぬくもり の高まりを #game のクラスに反映する（CSS 側で色・揺らぎを変える）。
//   とげとげを重ねるほど 彩度が落ち翳り、やさしさを重ねるほど あたたかい灯りがにじむ。
//   ＝可愛い世界と残酷さの“落差”を、プレイの蓄積として見せる。
function applyTone() {
  const g = $("game");
  if (!g || !game) return;
  const p = game.player;
  const kLv = p.kyoki >= 8 ? 3 : p.kyoki >= 5 ? 2 : p.kyoki >= 2 ? 1 : 0;
  const nLv = p.nukumori >= 9 ? 3 : p.nukumori >= 6 ? 2 : p.nukumori >= 3 ? 1 : 0;
  g.classList.remove("kyoki-1", "kyoki-2", "kyoki-3", "nukumori-1", "nukumori-2", "nukumori-3");
  if (kLv) g.classList.add("kyoki-" + kLv);
  if (nLv) g.classList.add("nukumori-" + nLv);
  // ウェーブ1のあいだは「きもち」「なかま」を隠して画面を3段に＝最初の30秒の情報量を絞る。
  g.classList.toggle("first-wave", waveNumber() === 1);
  // 第一夜チュートリアルは さらに絞る：こころ／きもち／敵HP数値 を隠し、見る計器を HP 1本に（実機FB対策）。
  g.classList.toggle("tutorial", !!game.tutorial);
}

// ── 上部バー（ウェーブ進行ドット・カウンタ） ─────────────
function renderTopbar() {
  // 第一夜チュートリアルは ウェーブ管理を見せない＝「何をするゲームか」に集中させる（P0-2）。
  if (game.tutorial) {
    $("wave-info").innerHTML = `<span class="wave-text">よる の はじまり</span>`;
    return;
  }
  // どこまで進めば夜明け（クリア）かが一目で分かるよう、ウェーブを●で並べる（★＝ボス）。
  const left = totalWaves() - waveNumber(); // 現在ウェーブを終えた後に残る数
  const leftText = isBossWave()
    ? "最後の夜"
    : `夜明けまで あと ${left}`;
  $("wave-info").innerHTML = `${waveDots()}<span class="wave-text">${leftText}</span>`;
  // ※おいはらった/むかえた/きずな の“管理数値”は 前面に出さない（結果は街の景色で返す＝P0-3・2-5）。
}

// むかえた友（なかま）を上部トレイに並べる。増えた瞬間だけ ぽんっ と出す＝“救った感”。
function renderNakama() {
  const tray = $("nakama-tray");
  if (!tray) return;
  const friends = (game.savedFriends || []);
  if (!friends.length) {
    tray.innerHTML = `<span class="nakama-empty">なかま：まだ いない（「手をのばす」と ふえる）</span>`;
    ui.lastNakama = 0;
    return;
  }
  const lastSeen = ui.lastNakama || 0;
  tray.innerHTML =
    `<span class="nakama-label">🫂 なかま ${friends.length}</span>` +
    friends.map((f, i) =>
      `<span class="nakama ${i >= lastSeen ? "pop" : ""}" title="${f.name}">${creatureSVG(f.color, f.shape, "happy")}</span>`
    ).join("");
  ui.lastNakama = friends.length;
}

// ウェーブ進行の●を作る（済＝薄い／いま＝光る／★＝ボス）。
function waveDots() {
  let s = "";
  const waves = (typeof currentWaves === "function") ? currentWaves() : WAVES;
  for (let i = 0; i < totalWaves(); i++) {
    const isBoss = !!(waves[i] && waves[i].boss);
    let cls = "wd";
    if (i < game.waveIndex) cls += " done";
    else if (i === game.waveIndex) cls += " now";
    if (isBoss) cls += " boss";
    s += `<span class="${cls}">${isBoss ? "★" : "●"}</span>`;
  }
  return `<span class="wave-dots">${s}</span>`;
}

// ── 敵エリア ───────────────────────────────
function renderEnemies() {
  const area = $("enemy-area");
  area.innerHTML = "";
  const living = livingEnemies();

  // いまターゲットを選ぶ段階か？（選べる敵を光らせる）
  const targeting =
    game.state === STATES.PLAYER_TURN &&
    (ui.mode === "fightTarget" || ui.mode === "save");
  // v0.6：何も選んでいない時も、敵を直接クリックで攻撃できる（サクサク）。
  //   v0.7：主力ことばの こころコストを払えるときだけ（払えないなら 軽い手/こらえる へ誘導）。
  const _qp = primarySingleWeapon();
  const quickAttack = game.state === STATES.PLAYER_TURN && ui.mode === "idle" &&
    !!_qp && game.player.kokoro >= ((WEAPONS[_qp] && WEAPONS[_qp].cost) || 0);

  for (const e of living) {
    const card = document.createElement("div");
    card.className = "enemy";
    card.setAttribute("data-uid", e.uid); // 演出（ダメージ数字）をこの要素に重ねるための目印
    if (e.boss) card.classList.add("boss");

    // こころのかべが消えた敵は「おだやか」＝もう攻撃してこない。顔も穏やかにする。
    const saveable = e.wall === 0;
    if (saveable) card.classList.add("calm");

    // すくえる相手だけ選べる「save」モードでは、壁0以外は選べない
    const selectable =
      targeting && (ui.mode !== "save" || e.wall === 0);
    const clickable = selectable || quickAttack; // idle は直接クリックで攻撃できる
    if (selectable) card.classList.add("selectable");
    else if (quickAttack) card.classList.add("tappable"); // 控えめに「押せる」を示す

    // こころのかべ（♥＝残り, ♡＝消えた分）。0なら「すくえそう」表示
    let walls = "";
    for (let i = 0; i < e.maxWall; i++) walls += i < e.wall ? "♥" : "♡";

    // 状態は“いちばん大事な1つ”だけ出す（タグ乱立で情報過多にしない）。
    let tag = "";
    if (saveable) tag = "おだやか";
    else if (e.status.silence > 0) tag = "とまってる";
    else if (e.atk < e.baseAtk) tag = "おとなしい";

    const hpPct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));

    // 表情：おだやか(壁0)=ニコッ／悲しむ子=泣き／ふつう=つぶら
    const expr = saveable ? "happy" : (e.sad ? "sad" : "neutral");
    const sprite = creatureSVG(e.color, e.shape, expr);

    // きいてみる（みんなに話す）段階では、各カードの手がかり（hint）を出して ことば選びを助ける。
    const base = ENEMIES[e.type] || {};
    const showHint = ui.mode === "act" && !saveable && base.hint;

    card.innerHTML = `
      <div class="enemy-fig ${saveable ? "calm" : ""}">${sprite}</div>
      <div class="enemy-name">${e.name}</div>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <div class="enemy-hp">HP ${e.hp}/${e.maxHp}</div>
      <div class="walls ${saveable ? "ok" : ""}">${saveable ? "♡ すくえそう" : walls}</div>
      ${tag ? `<div class="enemy-tags">${tag}</div>` : ""}
      ${showHint ? `<div class="enemy-hint">💭 ${base.hint}</div>` : ""}
    `;

    if (clickable) {
      card.addEventListener("click", () => onEnemyClick(e.uid));
    }
    area.appendChild(card);
  }
}

// ── 戦闘ログ ───────────────────────────────
function renderLog() {
  const box = $("log");
  box.innerHTML = game.log.map((l) => `<div class="log-line">${l}</div>`).join("");
  box.scrollTop = box.scrollHeight; // つねに最新行を表示
}

// ── プレイヤーステータス ─────────────────────
function renderPlayer() {
  const p = game.player;
  const hpPct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
  const koPct = Math.max(0, Math.round((p.kokoro / p.maxKokoro) * 100));

  // 「きもち」バー（旧・狂気/ぬくもりを1本に統合）。中央から左へ＝とげとげ(狂気)、右へ＝やさしい(ぬくもり)。
  //   要素を減らす指摘への回答：2本のゲージ＋数値をやめ、左右に傾く1本の直感的なバーに。
  const kyokiW = Math.min(50, (p.kyoki / BALANCE.kyokiMax) * 50);
  const nukuW = Math.min(50, (p.nukumori / (BALANCE.nukumoriStep * 4)) * 50);

  // あかり（むかえた友の反撃軽減）は効いているときだけ、短く出す（用語整理：きずな→あかり）。
  const shield = bondReduction();
  const bondLine = game.counters.save > 0
    ? `<div class="p-row bond-line">🪔 あかり −${shield}（むかえた ${game.counters.save}人 が かばう）</div>`
    : "";

  $("player-bar").innerHTML = `
    <div class="p-gauge">
      <span class="g-label">HP</span>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <span class="g-num">${p.hp}/${p.maxHp}</span>
    </div>
    <div class="p-gauge kokoro-gauge">
      <span class="g-label">こころ</span>
      <div class="bar kokoro"><div class="fill" style="width:${koPct}%"></div></div>
      <span class="g-num">${p.kokoro}/${p.maxKokoro}</span>
    </div>
    <div class="mood-row">
      <span class="mood-end toge">とげとげ</span>
      <div class="mood-track">
        <div class="mood-fill kyoki" style="width:${kyokiW}%"></div>
        <div class="mood-fill nukumori" style="width:${nukuW}%"></div>
        <div class="mood-center"></div>
      </div>
      <span class="mood-end yasashii">やさしい</span>
    </div>
    ${bondLine}
  `;
}

// ── コマンドバー（祓う/こころみる/すくう/どうぐ/まもる） ──
function renderCommands() {
  const bar = $("command-bar");
  const active = game.state === STATES.PLAYER_TURN;
  const p = game.player;
  const hasItem = Object.keys(p.items).some((k) => p.items[k] > 0);
  const savableExists = livingEnemies().some((e) => e.wall === 0); // 「手をのばす」が押せる状況か
  const w1 = waveNumber() === 1; // ウェーブ1は最小コマンドに絞る（最初の認知コストを下げる）
  // ウェーブ1で まだ何もしていない間は ずっと「ぶつける」を脈動＝入口を見失わせない（turn条件は外す）。
  const firstTurn = w1 && game.counters.kill === 0 && game.counters.save === 0;

  // プレイヤーに見える名前は“ことばで戦う口喧嘩”に寄せる（内部の cmd キーは据え置き）。
  //   ぶつける＝とげとげした言葉 ／ きいてみる＝相手の声をきく ／ 手をのばす＝迎える ／ こらえる＝耐える
  //   show: ウェーブ1では ぶつける/きいてみる ＋（むかえられる時だけ）手をのばす だけ。もちもの/こらえる は2波目から。
  // ぶつける も こころを使う（v0.7）。どの ことばも払えないときは押せない＝軽い手/こらえる へ。
  const canFight = game.player.weapons.some((id) => ((WEAPONS[id] && WEAPONS[id].cost) || 0) <= p.kokoro);
  // 第一夜は“何をするか”を動詞で対比（おいはらう／こえを きく）＝押す前に二択が分かる（桜井#3）。
  //   こころが足りずに ぶつける が押せないときは その理由を sub に出す（桜井#5・P1-4と整合）。
  const fightSub = !canFight ? "こころが たりない" : (game.tutorial ? "おいはらう" : "きついことば");
  const actSub = game.tutorial ? "こえを きく" : (w1 ? "きく" : `きく・こころ-${BALANCE.actCost}`);
  const defs = [
    { cmd: "fight", label: "ぶつける", sub: fightSub, cls: "c-fight", on: active && canFight, show: true },
    { cmd: "act", label: "きいてみる", sub: actSub, cls: "c-act", on: active && p.kokoro >= BALANCE.actCost, show: true },
    { cmd: "save", label: "手をのばす", sub: savableExists ? (w1 ? "むかえる" : `むかえる・こころ-${BALANCE.saveCost}`) : "さきに きいてみる", cls: "c-save", on: active && p.kokoro >= BALANCE.saveCost && savableExists, show: !w1 || savableExists },
    { cmd: "item", label: "もちもの", sub: "おまもり", cls: "c-item", on: active && hasItem, show: !w1 },
    { cmd: "defend", label: "こらえる", sub: "まもる", cls: "c-defend", on: active, show: !w1 },
  ];

  const shown = defs.filter((d) => d.show);
  bar.style.gridTemplateColumns = `repeat(${shown.length}, 1fr)`; // 表示数に合わせて中央寄せ
  bar.innerHTML = "";
  const tut = game.tutorial;
  for (const d of shown) {
    const b = document.createElement("button");
    b.className = "cmd " + d.cls;
    // いま選択中（武器/ことば/対象）のコマンドを強調するための active 判定。
    const isActiveSub = (ui.mode === d.cmd) ||
      (d.cmd === "fight" && (ui.mode === "weapon" || ui.mode === "fightTarget")) ||
      (d.cmd === "act" && (ui.mode === "act" || ui.mode === "actTarget"));
    if (isActiveSub) b.classList.add("on");
    // 入口の脈動＝視線誘導。第一夜は「ぶつける→（効かない）→きいてみる→手をのばす」と脈動を移す（堀井案）。
    if (d.cmd === "fight" && ui.mode === "idle" && (tut ? (game._tutHitCount === 0 && !game.listened) : firstTurn)) b.classList.add("pulse");
    if (d.cmd === "act"   && ui.mode === "idle" && tut && game._tutHitCount >= 1 && !game.listened) b.classList.add("pulse");
    // 「手をのばす」が解禁された瞬間（壁0の子がいて まだ誰も迎えていない）は脈動で強調＝救いの一手に気づかせる。
    if (d.cmd === "save"  && d.on && savableExists && game.counters.save === 0 && ui.mode === "idle") b.classList.add("pulse");
    // 何かを選んでいる最中は、選択中コマンド以外を押せなくする＝スマホの誤タップ防止（桜井）。
    b.disabled = !d.on || (ui.mode !== "idle" && !isActiveSub);
    b.innerHTML = `<span class="cmd-label">${d.label}</span><span class="cmd-sub">${d.sub}</span>`;
    if (!b.disabled) b.addEventListener("click", () => onCommand(d.cmd));
    bar.appendChild(b);
  }
}

// ── サブ操作の案内（武器/ACT/対象/どうぐ の選択） ──
function renderPrompt() {
  const box = $("prompt");
  box.innerHTML = "";
  if (game.state !== STATES.PLAYER_TURN) return;

  const addBtn = (label, sub, onClick) => {
    const b = document.createElement("button");
    b.className = "sub-btn";
    b.innerHTML = `<span>${label}</span>${sub ? `<small>${sub}</small>` : ""}`;
    b.addEventListener("click", onClick);
    box.appendChild(b);
    return b; // 呼び出し側で カテゴリ色などのクラスを足せるように返す
  };
  const addHint = (text) => {
    const d = document.createElement("div");
    d.className = "prompt-hint";
    d.textContent = text;
    box.appendChild(d);
  };
  const addCancel = () => addBtn("やめる", "", cancelSelection);

  if (ui.mode === "weapon") {
    // 文字を減らし“読まずに分かる”：アイコン「ことば」＋ ⚡威力・♡こころ のグリフだけ（とげ色で性質を示す）。
    addHint("ぶつける ことばを えらぶ（♡＝かかる こころ）");
    for (const id of game.player.weapons) {
      const w = WEAPONS[id];
      const tgt = targetLabel(w.target);
      const pow = w.evolved ? w.power : weaponPower(id);
      const cost = w.cost || 0;
      const afford = game.player.kokoro >= cost; // こころ不足なら押せない
      const icon = WORD_ICON[id] || (w.category === "yasashii" ? "🌱" : "💢");
      const sub = `${tgt} ⚡${pow}${w.wallDown ? ` 壁-${w.wallDown}` : ""}　♡${cost}`;
      const b = addBtn(`${icon}「${w.name}」`, sub, () => selectWeapon(id));
      if (b) {
        b.classList.add(w.category === "yasashii" ? "word-yasashii" : "word-toge");
        if (pow >= 6) b.classList.add("strong");
        if (!afford) { b.classList.add("cant"); b.disabled = true; }
      }
    }
    addCancel();
  } else if (ui.mode === "act") {
    // v0.6：みんなに話す。どの ことばを かけるか だけ選ぶ（各カードの 💭 が手がかり）。
    addHint("みんなに かける ことばを えらぶ（💭＝それぞれの子の手がかり）");
    const list = ui.pendingActList || Object.keys(ACTS);
    for (const id of list) {
      const word = wordById(id);
      if (!word) continue;
      const icon = WORD_ICON[id] || (word.category === "yasashii" ? "🌱" : word.category === "silence" ? "🤫" : "💭");
      const b = addBtn(`${icon}「${word.name}」`, actWordSub(word), () => selectAct(id));
      if (b) b.classList.add(catClass(word.category));
    }
    addCancel();
  } else if (ui.mode === "item") {
    addHint("どの もちものを つかう？");
    for (const k of Object.keys(game.player.items)) {
      if (game.player.items[k] > 0) {
        addBtn(ITEMS[k].name, `×${game.player.items[k]}・${ITEMS[k].desc}`, () => useItem(k));
      }
    }
    addCancel();
  } else if (ui.mode === "fightTarget") {
    addHint("ことばを ぶつける相手を選ぶ（上の子をクリック）");
    addCancel();
  } else if (ui.mode === "actTarget") {
    addHint("だれの こえを きく？（上の子をクリック。各カードの 💭 が手がかり）");
    addCancel();
  } else if (ui.mode === "save") {
    addHint("手をのばす相手を選ぶ（こころのかべが消えた＝おだやかな子）");
    addCancel();
  } else {
    // 初見のときだけ、次の一手をやさしく示す（チュートリアルの代わり）。
    const coach = coachLine();
    addHint(coach || "コマンドを選んでください");
  }
}

// その相手に「効きそうなことば＋少しのダミー＋学んだ汎用語」を作る。
//   敵の acts（正解）を必ず入れ、ダミーを1つだけ足して総当たり感を消す。
//   さらに、学んで覚えた“やさしいことば”を末尾に足す＝語彙が増えるほど選べる手が広がる。
function actOptionsFor(uid) {
  const t = findEnemy(uid);
  if (!t) return Object.keys(ACTS);
  const eff = t.acts.slice();                                   // この敵に効く問いかけ（ヒントと整合）
  const decoys = Object.keys(ACTS).filter((id) => !eff.includes(id));
  shuffleArr(decoys);
  const innate = shuffleArr(eff.concat(decoys.slice(0, 1)));    // 正解＋ダミー1（並びはランダム）
  const learned = learnedKindWords();                          // 学んだ汎用語（いつでも使える）
  return innate.concat(learned);
}

// ことばカテゴリ → 色クラス（とげ＝不穏／やさしい＝あたたかい／問いかけ＝水色／沈黙＝淡い）
function catClass(cat) {
  return { toge: "word-toge", yasashii: "word-yasashii", toi: "word-toi", silence: "word-silence" }[cat] || "word-toi";
}
// きいてみる の選択肢サブを ぶつける側と同じ“圧縮グリフ”に揃える（直感UIを左右で統一・桜井#2）。
//   長い説明文(desc)ではなく、効果アイコンだけ＝読む量を半減し ひと目で違いが分かる。
function actWordSub(word) {
  const parts = [];
  const wall = word.wall || word.sadWall;
  if (wall) parts.push(`かべ-${wall}`);
  if (word.atkDown) parts.push("勢い↓");
  if (word.silence) parts.push("とめる");
  if (word.heal) parts.push(`HP+${word.heal}`);
  if (!parts.length) parts.push(word.category === "silence" ? "しずか" : "そっと");
  return parts.join(" ");
}
// ことばの役割アイコン＝読まずに違いが伝わる（選ぶ楽しさ）。罵声・問いかけ・ミーム。
const WORD_ICON = {
  namida: "💢", damare: "🤐", poyo: "🌀", hikari: "💨", kiero: "💥",
  daikouzui: "🌊", bakuretsu: "🌀💥", kyusai: "🤝",
  // ミーム きついことば
  ma: "❓", yowayowa: "🍃", zako: "😏", kusa: "🌿",
  // ミーム やさしい/問いかけ
  wakaru: "🫂", tsuyotsuyo: "💪", soudane: "🫧", pien: "🥺",
};

// ミーム専用の小演出＝知ってる人が「！」となる一言を、言った瞬間にふわっと出す。
const MEME_FX = {
  ma: "！？", kusa: "ｗｗｗ", zako: "ﾌﾟｸｽ♡", yowayowa: "ｽｯ…",
  wakaru: "うんうん", tsuyotsuyo: "✨", soudane: "……", pien: "；ω；",
};

// 小さな配列シャッフル（cards.js の shuffle はあるが、依存順の都合でこちらにも軽量版を置く）
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 初見コーチング（ウェーブ1のあいだだけ、状況に応じた次の一手を返す）。
//   ことばで戦う口喧嘩であること、3つの選択（ぶつける/きいてみる/手をのばす）の違いを伝える。
function coachLine() {
  if (waveNumber() !== 1) return null;
  const p = game.player;
  // 失敗理由は短く先に伝える（こころ不足＝なぜ押せないか）＝P1-4。第一夜は こころ非表示なので出さない。
  if (!game.tutorial && p.kokoro < BALANCE.actCost) return "💡 こころが たりない。【こらえる】で ひと息つこう。";
  // こころのかべが ほどけた子がいる＝手をのばせる（解禁を名指しで・最優先）。
  if (livingEnemies().some((e) => e.wall === 0)) {
    return game.tutorial
      ? "💡 こころのかべが ほどけた。いまなら【手をのばす】＝ともだちに。"
      : "💡 ♡が消えた子は【手をのばす】＝ともだちに！";
  }
  // 第一夜：ぶつけたのに 消えなかった → 「きいてみる」へ手を引く（予想の裏切りの回収・堀井案）。
  if (game.tutorial && game._tutHitCount >= 1 && !game.listened) {
    return "💡 ぶつけても、この子は きえない。【きいてみる】で こえを きいてみよう。";
  }
  // まだ何もしていない最初の一手。第一夜は“きみの ばん”の主語＋2つの関わり方を並べて選ばせる（桜井）。
  if (game.counters.kill === 0 && game.counters.save === 0 && !game.listened) {
    return game.tutorial
      ? "🐾 きみの ばん。【ぶつける】で 追い払う？ それとも【きいてみる】で こえを きく？"
      : "💡 きついことばで【ぶつける】と すぐ退けられる。まず ためしてみよう。";
  }
  // きいてみた後、まだ壁が残るなら「もう少し きく」を短く示す。
  if (game.listened && game.counters.save === 0) {
    return "💡 もう すこし【きいてみる】と、手を のばせそう。";
  }
  if (game.counters.save === 0) {
    return "💡 やさしくしたい子には【きいてみる】。♡が消えたら【手をのばす】！";
  }
  return null;
}

function targetLabel(t) {
  return { single: "単体", front2: "前列2体", front3: "前列3体", all: "全体" }[t] || t;
}

// ──────────────────────────────────────────
// 入力ハンドラ
// ──────────────────────────────────────────
function onCommand(cmd) {
  if (!game || game.state !== STATES.PLAYER_TURN) return;
  playSe("select");

  if (cmd === "fight") {
    const ws = game.player.weapons;
    // 第一夜チュートリアルは「ぶつける＝1タップで相手へ」に絞る（武器選びを挟まず迷わせない）。
    if (game.tutorial) { selectWeapon(primarySingleWeapon() || ws[0]); return; }
    if (ws.length === 1) selectWeapon(ws[0]);
    else { ui.mode = "weapon"; renderPrompt(); renderCommands(); }
  } else if (cmd === "act") {
    // v0.6：きいてみる は「みんなに話す」＝対象選択を飛ばして すぐ ことば選びへ（タップ削減＋自然）。
    //   候補は いまの群れに関係する問いかけ＋学んだやさしいことば。各カードの 💭 が手がかり。
    ui.pendingActList = actAllOptions();
    ui.mode = "act";
    renderPrompt(); renderEnemies(); renderCommands();
  } else if (cmd === "save") {
    const savable = livingEnemies().filter((e) => e.wall === 0);
    if (savable.length === 0) { showToast("まだ むかえられる子が いない（さきに「きいてみる」）"); return; }
    // むかえられる子が1体だけなら、選択を挟まず すぐ手をのばす（タップ削減）。
    if (savable.length === 1) { doAction(() => cmdSave(savable[0].uid), "save"); return; }
    ui.mode = "save"; renderPrompt(); renderEnemies(); renderCommands();
  } else if (cmd === "item") {
    ui.mode = "item"; renderPrompt(); renderCommands();
  } else if (cmd === "defend") {
    doAction(() => cmdDefend(), "defend");
  }
}

function selectWeapon(wid) {
  ui.pendingWeapon = wid;
  const w = WEAPONS[wid];
  if (w.target === "single") {
    // 対象が1体しかいないなら、わざわざ選ばせない＝即その子へ（タップ削減・自然）。
    const living = livingEnemies();
    if (living.length === 1) { doAction(() => cmdFight(wid, living[0].uid), "fight"); return; }
    ui.mode = "fightTarget"; renderPrompt(); renderEnemies(); renderCommands();
  } else {
    doAction(() => cmdFight(wid), "fight"); // 全体・前列はすぐ実行
  }
}

function selectAct(aid) {
  // v0.6：きいてみる は群れ全体へ。対象は取らない。
  doAction(() => cmdAct(aid), "act");
}

// きいてみる の選択肢：いまの群れに関係する問いかけ＋学んだ やさしいことば（みんなに話す前提）。
function actAllOptions() {
  const set = {};
  livingEnemies().forEach((e) => (e.acts || []).forEach((id) => { set[id] = true; }));
  const relevant = shuffleArr(Object.keys(set));
  return relevant.concat(learnedKindWords());
}

// サクサク：敵を直接クリックした時に使う「主力の単体きついことば」。
function primarySingleWeapon() {
  return game.player.weapons.find((id) => WEAPONS[id] && WEAPONS[id].target === "single") || null;
}

function useItem(itemId) {
  doAction(() => cmdItem(itemId), "item");
}

function onEnemyClick(uid) {
  if (!game || game.state !== STATES.PLAYER_TURN) return;
  if (ui.mode === "fightTarget") {
    doAction(() => cmdFight(ui.pendingWeapon, uid), "fight");
  } else if (ui.mode === "save") {
    doAction(() => cmdSave(uid), "save");
  } else if (ui.mode === "idle") {
    // v0.6 サクサク：何も選んでいない時に敵を直接クリック＝主力の単体きついことばで攻撃（1タップ）。
    //   v0.7：こころが足りなければ弾く（軽いことば／こらえる へ誘導）。
    const primary = primarySingleWeapon();
    if (primary) {
      const cost = (WEAPONS[primary] && WEAPONS[primary].cost) || 0;
      if (game.player.kokoro < cost) { showToast("こころが たりない（軽いことば／こらえる）"); return; }
      ui.pendingWeapon = primary; doAction(() => cmdFight(primary, uid), "fight");
    }
  }
}

function cancelSelection() {
  ui.mode = "idle";
  ui.pendingWeapon = null;
  ui.pendingAct = null;
  ui.pendingActTarget = null;
  ui.pendingActList = null;
  renderPrompt(); renderEnemies(); renderCommands();
}

// 行動前に、いまの敵カードの位置を控える。
//   なぜ：render() で倒した／むかえた敵は消えるため、その後に演出を出すと“居た場所”が分からない。
//   先に座標を控えておけば、撃破・救済の数字や光を「その子が居た場所」に出せる＝手応えが出る。
function captureEnemyRects() {
  const host = $("game");
  const map = {};
  if (!host) return map;
  const hr = host.getBoundingClientRect();
  document.querySelectorAll(".enemy[data-uid]").forEach((c) => {
    const cr = c.getBoundingClientRect();
    map[c.getAttribute("data-uid")] = {
      x: cr.left - hr.left + cr.width / 2,
      y: cr.top - hr.top + cr.height / 2,
    };
  });
  return map;
}

// コマンド実行の共通処理（音・状態遷移・再描画・演出）
function doAction(fn, seName) {
  const hpBefore = game.player.hp;
  if (Array.isArray(game.fx)) game.fx = []; // 今回の行動ぶんの演出イベントだけを集める
  const prevRects = captureEnemyRects();    // 消える敵の演出位置を先に確保

  const ok = fn(); // battle.js のコマンドを実行
  if (!ok) return; // 弾かれたら選択状態のまま

  playSe(seName);
  // ことば系（ぶつける/きいてみる/手をのばす）は “言ったことばの吹き出し”が主役なので
  // 中央の大きな動詞フラッシュは出さない。もちもの／こらえる だけ動詞を出す。
  if (seName === "item" || seName === "defend") bigFlash(seName);
  // 被弾音は playFx の「群れの反撃」フェーズで鳴らす（音→-N数字→赤ふち を1拍に揃える）
  if (game.state === STATES.LEVEL_UP) playSe("levelup");
  else if (game.state === STATES.DAWN) playSe("dawn");

  ui.mode = "idle";
  ui.pendingWeapon = null;
  ui.pendingAct = null;
  ui.pendingActTarget = null;
  ui.pendingActList = null;
  render();
  playFx(prevRects); // render の後に、敵へダメージ数字を重ねたり画面を揺らす（手応えを“体に来る”形に）
}

// ──────────────────────────────────────────
// 手応えの演出（ダメージ数字・揺れ・フラッシュ・撃破ポフ・むかえた光）
//   battle.js が game.fx に積んだ「何が起きたか」を、ここで“ログを読まなくても分かる”形で見せる。
//   prevRects: 行動前に控えた敵の位置（倒した/むかえた敵は消えているので、その場所に演出を出す）。
// ──────────────────────────────────────────
function playFx(prevRects) {
  prevRects = prevRects || {};
  if (!Array.isArray(game.fx) || !game.fx.length) return;
  let pdmg = 0;
  const impacts = [];  // 相手に“刺さる”系（少し遅らせ、複数は順に出して頭数を見せる）
  let learnEv = null;
  // ── ① プレイヤーが「言った／自分に起きた」ぶんは すぐ ──
  for (const ev of game.fx) {
    if (ev.t === "speak") { wordBubble(ev.text, ev.cat); if (ev.meme && MEME_FX[ev.meme]) memeFlair(MEME_FX[ev.meme]); }
    else if (ev.t === "kyoki") meterFloat("kyoki", "とげとげ＋");
    else if (ev.t === "nukumori") { meterFloat("nukumori", "やさしい＋"); if (ev.bonus && ev.bonus.hpUp > 0) pulsePlayerBar(); }
    else if (ev.t === "pheal") { pulsePlayerBar(); floatOnPlayer(`HP＋${ev.amount}`, "pheal"); playSe("heal"); }
    // こころの増減は同時に出すと重なって読めないので、消費(♡−N)は すぐ／回復(＋N)は ひと拍おく
    //   ＝「ことばを吐いて こころが減る → ひと息ついて すこし戻る」の順に体で分かるように。
    else if (ev.t === "kregen") { const a = ev.amount; setTimeout(() => { pulseKokoro(); floatOnPlayer(`こころ＋${a}`, "kregen"); }, 520); }
    else if (ev.t === "kspend") { pulseKokoro(); floatOnPlayer(`♡−${ev.amount}`, "kspend"); } // ぶつけて こころが減った
    else if (ev.t === "pdmg") pdmg += ev.dmg;
    else if (ev.t === "learn") learnEv = ev;
    else impacts.push(ev); // hit / calm / save / wallhit / noeffect
  }
  // ── ② 「言った→（ため）→刺さる」：相手への効果は少し遅らせ、複数は i*70ms で順に ──
  let calmPlayed = false;
  impacts.forEach((ev, i) => {
    const yoff = i * 12; // 複数体は少し縦にずらして“何体に効いたか”を見せる
    setTimeout(() => {
      if (ev.t === "hit") {
        floatOnEnemy(ev.uid, ev.dead ? `${ev.dmg}!` : `${ev.dmg}`, ev.dead ? "dmg dead" : "dmg", prevRects, yoff);
        if (ev.dead) { deadPoof(ev.uid, prevRects, ev.color); }
        else { shakeEnemy(ev.uid); flashEnemy(ev.uid); }
      } else if (ev.t === "wallhit") {
        floatOnEnemy(ev.uid, `♡ −${ev.amount}`, "calm", prevRects, yoff); flashEnemy(ev.uid);
      } else if (ev.t === "calm") {
        floatOnEnemy(ev.uid, "ほっ…", "calm", prevRects, yoff);
        if (!calmPlayed) { playSe("calm"); calmPlayed = true; }
      } else if (ev.t === "save") {
        floatOnEnemy(ev.uid, "なかまに なった！", "save", prevRects, yoff); saveBurst(ev.uid, prevRects);
      } else if (ev.t === "evoice") {
        enemyBubble(ev.uid, ev.text, prevRects, yoff); // 対話してる感：効いた子が ことばを返す
      } else if (ev.t === "noeffect") {
        if (ev.all) { wordBubble("…？", "toi"); } // みんなに響かなかった（中央に1つ）
        else floatOnEnemy(ev.uid, "…？", "miss", prevRects, yoff);
        playSe("miss");
      }
    }, 120 + i * 70);
  });
  // 撃破音は 1バッチ1回だけ（多重撃破で濁らない）
  if (impacts.some((e) => e.t === "hit" && e.dead)) setTimeout(() => playSe("die"), 130);
  const tail = 120 + impacts.length * 70;
  // ── ③ 「言えた！」は 救済の光が引いたあと、単独で立たせる（本作の核を一拍おいて刺す） ──
  if (learnEv) setTimeout(() => {
    const lastN = document.querySelector("#nakama-tray .nakama:last-child");
    if (lastN) lastN.classList.add("pop");
    wordBubble(`「${learnEv.text}」が 言えた！`, "yasashii");
    playSe("learn");
  }, tail + 260);
  // ── ④ 群れの反撃は ぜんぶの後に＝「自分が言った→刺さる→殴られた」の順で因果が体に来る ──
  if (pdmg > 0) setTimeout(() => {
    playSe("hit"); screenShake(); hitVignette();
    floatOnPlayer(`-${pdmg}`, "pdmg"); // 被弾音→数字→赤ふち を同時に（与ダメだけ見える非対称も解消）
  }, tail + 180);
  game.fx = [];
}

function pulsePlayerBar() {
  const pb = $("player-bar");
  if (pb) { pb.classList.add("healpulse"); setTimeout(() => pb.classList.remove("healpulse"), 600); }
}
function pulseKokoro() {
  const pb = $("player-bar");
  if (pb) { pb.classList.add("kokoropulse"); setTimeout(() => pb.classList.remove("kokoropulse"), 600); }
}
// 自分（プレイヤーバー）の上に数字を浮かせる（被弾・回復・こころ回復を“自分側でも”見せる）。
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

// 言ったことばの吹き出し（画面中央やや上に、カテゴリ色で“ぽんっ”と出す）。
//   とげとげ＝不穏な黒、やさしい＝あたたかい灯り、問いかけ＝水色、沈黙＝淡くかすれる。
function wordBubble(text, cat) {
  const host = $("game");
  if (!host || !text) return;
  const el = document.createElement("div");
  el.className = "word-bubble " + catClass(cat || "toi");
  el.textContent = "「" + text + "」";
  host.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// 敵の“返事”を その子の上に 吹き出しで出す（対話してる感）。倒した/居ない時は prevRects で位置補完。
function enemyBubble(uid, text, prevRects, yoff) {
  const host = $("game");
  if (!host || !text) return;
  let x, y;
  const card = document.querySelector(`.enemy[data-uid="${uid}"]`);
  if (card) { const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect(); x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top - 6; }
  else if (prevRects && prevRects[uid]) { x = prevRects[uid].x; y = prevRects[uid].y - 24; }
  else return;
  y -= (yoff || 0);
  const el = document.createElement("div");
  el.className = "enemy-bubble";
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ミーム専用のひとこと（「ｗｗｗ」等）を 画面中央やや右に ふわっと出す＝知ってる人が にやり。
function memeFlair(text) {
  const host = $("game");
  if (!host || !text) return;
  const el = document.createElement("div");
  el.className = "meme-flair";
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// 「きもち」バーの端に「＋」をふわっと出す（ゲージが傾く手応え）。
function meterFloat(which, text) {
  const track = document.querySelector(".mood-track");
  const host = $("game");
  if (!track || !host) return;
  const mr = track.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "meter-float " + which;
  el.textContent = text;
  // とげとげは左端、ぬくもりは右端に出す
  const sideX = which === "kyoki" ? (mr.left - hr.left + mr.width * 0.2) : (mr.left - hr.left + mr.width * 0.8);
  el.style.left = sideX + "px";
  el.style.top = (mr.top - hr.top - 6) + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
  track.classList.add("bump");
  setTimeout(() => track.classList.remove("bump"), 320);
}

// 敵カード（または“居た場所”prevRects）の上に、数字や言葉をふわっと浮かせて消す。
function floatOnEnemy(uid, text, cls, prevRects, yoff) {
  const host = $("game");
  if (!host) return;
  let x, y;
  const card = document.querySelector(`.enemy[data-uid="${uid}"]`);
  if (card) {
    const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect();
    x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top + 8;
  } else if (prevRects && prevRects[uid]) {
    x = prevRects[uid].x; y = prevRects[uid].y - 14; // 消えた敵は控えた中心の少し上に
  } else { return; }
  y -= (yoff || 0); // 複数同時ヒットを少し縦にずらす
  const el = document.createElement("div");
  el.className = "float-num " + cls;
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function shakeEnemy(uid) {
  const c = document.querySelector(`.enemy[data-uid="${uid}"]`);
  if (c) { c.classList.add("hitshake"); setTimeout(() => c.classList.remove("hitshake"), 320); }
}
// 被弾した敵を一瞬 白くピカッ＋ぐっと縮む（ことばが刺さった手応え）。
function flashEnemy(uid) {
  const fig = document.querySelector(`.enemy[data-uid="${uid}"] .enemy-fig`);
  if (fig) { fig.classList.add("hitpop"); setTimeout(() => fig.classList.remove("hitpop"), 260); }
}
// 退けた瞬間の“パンッ！”（敵は render で消えているので、居た場所に出す）＝ポフ＋ピクセルのかけら飛散。
function deadPoof(uid, prevRects, color) {
  const host = $("game");
  if (!host || !prevRects || !prevRects[uid]) return;
  const x = prevRects[uid].x, y = prevRects[uid].y;
  const el = document.createElement("div");
  el.className = "poof";
  el.style.left = x + "px";
  el.style.top = y + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 560);
  // かけら（ピクセル割れ）を4方向へ。色は退けた相手の色＝“その子がはじけた”手応え。
  const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  dirs.forEach((d) => {
    const s = document.createElement("div");
    s.className = "shard";
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.style.background = color || "#cfc4e6";
    s.style.setProperty("--dx", (d[0] * 18) + "px");
    s.style.setProperty("--dy", (d[1] * 18) + "px");
    host.appendChild(s);
    setTimeout(() => s.remove(), 520);
  });
}
// むかえた瞬間の あたたかい光のひろがり（“救った感”）。
function saveBurst(uid, prevRects) {
  const host = $("game");
  if (!host) return;
  let x, y;
  const card = document.querySelector(`.enemy[data-uid="${uid}"]`);
  if (card) { const hr = host.getBoundingClientRect(), cr = card.getBoundingClientRect(); x = cr.left - hr.left + cr.width / 2; y = cr.top - hr.top + cr.height / 2; }
  else if (prevRects && prevRects[uid]) { x = prevRects[uid].x; y = prevRects[uid].y; }
  else return;
  const el = document.createElement("div");
  el.className = "save-burst";
  el.style.left = x + "px";
  el.style.top = y + "px";
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

// 「祓う！」「すくう！」など、選んだ行動を画面中央に一瞬だけ大きく出す（何をしたか直感的に）。
function bigFlash(seName) {
  const map = {
    fight:  ["ぶつける", "fx-fight"],
    act:    ["きいてみる", "fx-act"],
    save:   ["手をのばす", "fx-save"],
    item:   ["もちもの", "fx-item"],
    defend: ["こらえる", "fx-defend"],
  };
  const m = map[seName];
  const host = $("game");
  if (!m || !host) return;
  const el = document.createElement("div");
  el.className = "act-flash " + m[1];
  el.textContent = m[0];
  host.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

// 進化演出（cards.js から呼ばれるフック）
function onEvolve(weapon) {
  playSe("evolve");
  showToast(`★進化：${weapon.name}！`);
}

// ──────────────────────────────────────────
// オーバーレイ（レベルアップの3択）
// ──────────────────────────────────────────
function showLevelUp() {
  const ov = $("overlay-levelup");
  const cards = game.pendingCards || [];
  ov.querySelector(".ov-body").innerHTML = `
    <h2 class="ov-title">レベルアップ！</h2>
    <p class="ov-sub">1枚えらんでビルドを伸ばそう（残り ${game.pendingLevelUps} 回）</p>
    <div class="cards"></div>
  `;
  const wrap = ov.querySelector(".cards");
  cards.forEach((card) => {
    const el = document.createElement("button");
    el.className = "card-pick";
    el.innerHTML = `
      <div class="card-name">${card.name}</div>
      <div class="card-desc">${card.desc}</div>
    `;
    el.addEventListener("click", () => pickCard(card));
    wrap.appendChild(el);
  });
  showOverlay("overlay-levelup");
}

function pickCard(card) {
  playSe("select");
  // 武器強化で、強化できる武器が複数あるなら「どれを強化するか」を選ばせる
  if (card.type === "weaponLv") {
    const ups = game.player.weapons.filter((id) => !WEAPONS[id].evolved && weaponLevel(id) < BALANCE.weaponMaxLv);
    if (ups.length > 1) { showWeaponPicker(card, ups); return; }
  }
  chooseCard(card); // cards.js（適用→進化判定→次へ）
  render();
}

function showWeaponPicker(card, weaponIds) {
  const ov = $("overlay-levelup");
  const wrap = ov.querySelector(".cards");
  wrap.innerHTML = "";
  ov.querySelector(".ov-sub").textContent = "どの武器を強化する？";
  weaponIds.forEach((id) => {
    const el = document.createElement("button");
    el.className = "card-pick";
    el.innerHTML = `<div class="card-name">${WEAPONS[id].name}</div><div class="card-desc">Lv${weaponLevel(id)} → Lv${weaponLevel(id) + 1}</div>`;
    el.addEventListener("click", () => { playSe("select"); chooseCard(card, id); render(); });
    wrap.appendChild(el);
  });
}

// ──────────────────────────────────────────
// v0.4 メタループの画面（街 / 夜のフィールド / マクロ結末）
// ──────────────────────────────────────────

// 画面コンテナの表示/非表示を切り替える（戦闘の #game と 各オーバーレイ）。
function applyScreen(sc) {
  const setShow = (id, show) => { const e = $(id); if (e) e.classList.toggle("hidden", !show); };
  setShow("game", sc === "battle");
  setShow("overlay-town", sc === "town");
  setShow("overlay-field", sc === "field");
  setShow("overlay-macro", sc === "macro");
  // 戦闘以外では、戦闘用オーバーレイ（レベルアップ/結末）は必ず畳む
  if (sc !== "battle") { hideOverlay("overlay-levelup"); hideOverlay("overlay-result"); }
}

// 主人公ぽちのスプライト（街・道で歩く姿）。あたたかいクリーム色のまる。
function pochiSVG(expr) { return creatureSVG("#f0e2b6", "circle", expr || "happy"); }

// ── 街（拠点）ハブ ─────────────────────────
//   夜カウンタ・灯り（救った友の累計）・なかま・覚えたことば・「夜へ でかける」。
function renderTown() {
  const ov = $("overlay-town");
  if (!ov || !meta) return;
  const body = ov.querySelector(".ov-body");
  if (!body) return;

  const isLast = meta.night >= meta.maxNights;
  const nightLabel = isLast ? "さいごの夜" : `${meta.night}夜目 / ${meta.maxNights}`;
  const lines = (typeof TOWN_LINES !== "undefined") ? TOWN_LINES : [];
  const line = lines[Math.min(meta.night - 1, lines.length - 1)] || "";

  // 灯り：救った友の数ぶん ともる（街の明るさ＝これまで救えた数の可視化）。
  //   ただし最低1つは「ぽち自身の灯り」を必ず点灯＝第一夜の真っ暗な空欄を避ける（STORY §6「灯りひとつ」）。
  const lit = Math.max(1, meta.friends.length);
  // ゆうべ 新しく増えた灯り（nightStartFriends→いま）は ぽっと灯す＝「救った＝街が明るくなる」を絵で見せる。
  const firstNewLit = (meta.gainedLightLastNight && typeof meta.nightStartFriends === "number")
    ? Math.max(1, meta.nightStartFriends) : -1; // それ以降の点灯ぶんに justlit を付ける
  let lanterns = "";
  for (let i = 0; i < Math.max(6, lit + 2); i++) {
    const on = i < lit;
    const justlit = on && firstNewLit >= 0 && i >= firstNewLit; // この夜 増えたぶん
    lanterns += `<span class="town-lantern ${on ? "on" : ""} ${justlit ? "justlit" : ""}"></span>`;
  }
  // 倒すだけの夜（灯りが増えなかった）は 街を 寒色に＝非対称を“絵”でも出す。
  const coldClass = (meta.night > 1 && meta.gainedLightLastNight === false) ? "town-cold" : "";

  const hasFriends = meta.friends.length > 0;
  const words = (meta.learnedWords || []).map((id) => KIND_WORDS[id] ? KIND_WORDS[id].word : id);
  const hasWords = words.length > 0;

  // 友がいるときは「街に みんなが いる場所」として 地面に立たせる（メニューでなく帰る場所に・実機FB#7）。
  //   ゆうべ連れ帰った子（index >= nightStartFriends）は ぽっと あらわれる（justhome）＝「連れ帰った」が絵で繋がる。
  //   さわると 生活セリフを話す（下のクリック配線）。いない（第一夜前）ときは“伸びしろ”の灰シルエット。
  const newFrom = (typeof meta.nightStartFriends === "number") ? meta.nightStartFriends : meta.friends.length;
  const nF = meta.friends.length;
  const stageFriends = meta.friends.map((f, i) => {
    const left = nF === 1 ? 50 : Math.round(13 + (74 * i) / (nF - 1)); // 横に均等に散らす
    const isNew = i >= newFrom;
    return `<span class="town-friend tappable ${isNew ? "justhome" : ""}" data-type="${f.type}" title="${f.name}" style="left:${left}%; animation-delay:${(i % 5) * 0.35}s">${creatureSVG(f.color, f.shape, "happy")}</span>`;
  }).join("");
  // 初めて街に友がいる回だけ「さわって みて」を一度（能動的に関わる入口）。
  let touchHint = "";
  if (hasFriends && !meta._seenTownTouch) { touchHint = `<span class="town-stage-hint">👆 友を さわって みて</span>`; meta._seenTownTouch = true; }
  // ① 倒した子の「空席」＝消えかけた輪郭。数が増えても席は1つ（さわると 違う子の名残）。救いと喪失を同じ街に。
  const hasLost = !!(meta.lostTypes && meta.lostTypes.length);
  const vacancyHtml = hasLost
    ? `<span class="town-vacancy tappable" data-ghost="1" style="left:${nF ? 88 : 50}%" title="…いなくなった子">${creatureSVG("#45416a", "circle", "neutral")}</span>`
    : "";
  const showStage = hasFriends || hasLost;
  const friendsSection = showStage ? `
    <div class="town-section">
      <div class="town-cap">🫂 なかま（${meta.friends.length}）</div>
      <div class="town-stage">
        <div class="town-ground"></div>
        ${stageFriends}
        ${vacancyHtml}
        ${touchHint}
      </div>
    </div>` : `
    <div class="town-section town-preview">
      <div class="town-cap">🫂 なかま（0）</div>
      <div class="town-friends">
        <span class="town-friend ghost">${creatureSVG("#6a6390", "circle", "neutral")}</span>
        <span class="town-friend ghost">${creatureSVG("#6a6390", "bunny", "neutral")}</span>
        <span class="town-friend ghost">${creatureSVG("#6a6390", "ghost", "neutral")}</span>
        <span class="town-preview-note">夜の道で 手をのばすと、ここに ともだちが かえってくる。<br>救うほど、この街は あかるくなる。</span>
      </div>
    </div>`;
  // ことばを覚えているときだけ「いえる ことば」セクションを出す。
  const wordsSection = hasWords ? `
    <div class="town-section">
      <div class="town-cap">💬 いえる ことば（${words.length}）</div>
      <div class="town-words">${words.map((w) => `<span class="town-word">「${w}」</span>`).join("")}</div>
    </div>` : "";

  const justGiven = field.townWordJustGiven && KIND_WORDS[field.townWordJustGiven]
    ? `<p class="town-learned">＋ 街で おぼえた：「${KIND_WORDS[field.townWordJustGiven].word}」</p>` : "";

  // ── 第一夜の結果を「街の景色」で返す（P0-4）──
  //   最初の街帰還（=2夜目）に一度だけ、選択に応じた静かな一言を出す。責めない・短い・断定しない。
  //   A=手をのばした（迎えた） / C=きいたが手をのばさず / B=ぶつけた（きかなかった）。
  let n1Line = "";
  let suppressBeats = false; // この帰還は n1Line が担うので、汎用の firstLight/noLight は出さない
  if (meta.night === 2 && meta._n1 && !meta._n1.shown) {
    meta._n1.shown = true;
    suppressBeats = true;
    if (meta._n1.outcome === "A") {
      n1Line = `<p class="town-learned">街に、ちいさな あかりが ふえた。</p>`;
      meta._seenFirstLight = true; // 同義の汎用ビートは以後も出さない
    } else if (meta._n1.outcome === "C") {
      n1Line = `<p class="town-nolight">きいた声が、まだ すこし 耳に のこっている。</p>`;
    } else {
      n1Line = `<p class="town-nolight">街は、さっきと おなじくらい しずかだった。<br>ぽちは、なにも いわなかった。</p>`;
      meta._seenFirstNoLight = true;
    }
  }

  // 物語ビート：初めて街に灯りが ふえた夜だけ、一拍の語り（救う＝あたたかい）。二度目は出さない。
  let firstLight = "";
  if (!suppressBeats && meta.gainedLightLastNight === true && !meta._seenFirstLight) {
    firstLight = `<p class="town-learned">ひとつ、灯りが ふえた。この街に、おかえり が いえる。</p>`;
    meta._seenFirstLight = true;
  }
  // 倒すだけの夜は 灯りが ふえない＝「街は さみしいまま」を そっと言語化（救う/倒すの非対称）。
  //   初回だけ ひと拍 ながめの語り、二度目以降は短い既存文に戻す（くどくしない）。
  let noLight = "";
  if (!suppressBeats && meta.night > 1 && meta.gainedLightLastNight === false) {
    if (!meta._seenFirstNoLight) {
      noLight = `<p class="town-nolight">だれも、つれて こなかった。…手は よごれて ないけど、さみしいね。</p>`;
      meta._seenFirstNoLight = true;
    } else {
      noLight = `<p class="town-nolight">ゆうべは、灯りが ひとつも ふえなかった。…倒すだけの夜は、街が さみしいまま。</p>`;
    }
  }

  // ⑤ やり直し（HP0で倒れて戻った）を 世界が薄く覚えている＝この帰還で一度だけ（責めない・断定しない）。
  let retryLine = "";
  if (meta._retryJustNow) {
    meta._retryJustNow = false;
    const rl = (typeof RETRY_LINES !== "undefined" && RETRY_LINES.length) ? RETRY_LINES : ["……まえも、ここで たおれた きが する。"];
    retryLine = `<p class="town-nolight">${meta._retried >= 2 ? rl[rl.length - 1] : rl[0]}</p>`;
  }

  // 第一夜（友0）は 唯一の出口「夜へ でかける」を点滅させて 視線を誘導する（迷わせない）。
  const goPulse = (meta.night === 1 && !hasFriends) ? "pulse" : "";

  body.innerHTML = `
    <div class="town-head ${coldClass}">
      <span class="town-night">${nightLabel}</span>
      <button id="town-mute" class="town-mute" title="音のON/OFF">♪</button>
    </div>
    <h2 class="town-title">よあけまえの 街</h2>
    <div class="town-lanterns ${coldClass}">${lanterns}</div>
    ${retryLine}
    ${n1Line}
    ${firstLight}
    <p class="town-line">${line}</p>
    ${noLight}
    ${justGiven}
    ${friendsSection}
    ${wordsSection}
    <button id="town-go" class="start-btn town-go ${goPulse}">▶ 夜へ でかける</button>
    <p class="town-foot">${meta.night === 1
      ? "夜の道を 歩いて、あの子に あいに いく。むかえた子は、この街に かえってくる。"
      : "夜の道を 歩いて、むきあう。むかえた子は この街に かえってくる。"}</p>
  `;
  const go = $("town-go");
  if (go) go.addEventListener("click", () => { playSe("select"); goToField(); });
  const mute = $("town-mute");
  if (mute) mute.addEventListener("click", () => { const m = toggleMute(); mute.textContent = m ? "♪×" : "♪"; });
  // P1-1：街の友を さわると“生活セリフ”を話す（報酬装置でなく、ここで暮らす存在に）。
  body.querySelectorAll(".town-friend[data-type]").forEach((el) => {
    el.addEventListener("click", () => {
      const t = el.getAttribute("data-type");
      const lines = (typeof FRIEND_TOWN_LINES !== "undefined" && FRIEND_TOWN_LINES[t]) ? FRIEND_TOWN_LINES[t] : null;
      if (!lines) return;
      const name = (ENEMIES[t] && ENEMIES[t].name) || "";
      showToast(`${name}「${lines[Math.floor(Math.random() * lines.length)]}」`);
      if (typeof playSe === "function") playSe("calm");
    });
  });
  // ① 空席をさわると、いなくなった子の名残（途中で切れた flavor）が ひとつ（数えない・名前を出さない）。
  const vac = body.querySelector(".town-vacancy[data-ghost]");
  if (vac) vac.addEventListener("click", () => {
    const lost = (meta.lostTypes && meta.lostTypes.length) ? meta.lostTypes : null;
    if (!lost) return;
    const t = lost[Math.floor(Math.random() * lost.length)];
    const line = (typeof TOWN_GHOST_LINES !== "undefined" && TOWN_GHOST_LINES[t]) ? TOWN_GHOST_LINES[t] : "……もう、いない。";
    showToast(line);
    if (typeof playSe === "function") playSe("miss");
  });
}

// ── 夜のフィールド（見下ろし帯・マウスカーソル追従）─────────
//   マウスで ぽちを自由に歩かせる（横=朝へ／縦=道幅）。ことばを拾い、友を むかえ/とおりすぎ、道のおわりで戦闘へ。
function renderField() {
  const ov = $("overlay-field");
  if (!ov) return;
  const body = ov.querySelector(".field-body");
  if (!body) return;

  const goal = field.goal || 1;
  const pochiLeft = Math.round((field.x / goal) * 100);
  const pochiTop = Math.round(50 + (field.y || 0) * 38);
  const progPct = pochiLeft;
  const yTop = (ny) => Math.round(50 + (ny || 0) * 38); // ノードの縦位置（-1..+1 → 12..88%・道幅を広げた）

  const lastPicked = field.picked.length ? field.picked[field.picked.length - 1] : null;
  // 道に点在する出来事（済みは薄く／拾った瞬間は pop／友は出会うと一拍ふるえる／近接はグロー）
  const nodesHtml = field.nodes.map((n) => {
    const left = Math.round((n.at / goal) * 100);
    const top = yTop(n.y);
    const glow = (!n.done && n._glow > 0.15) ? "near" : "";
    if (n.type === "word") {
      const popped = (n.done && n.word === lastPicked) ? "justpicked" : "";
      return `<span class="road-node node-word ${n.done ? "done" : ""} ${popped} ${glow}" style="left:${left}%;top:${top}%" title="おちている ことば">💬</span>`;
    } else if (n.type === "friend") {
      const base = ENEMIES[n.enemy] || {};
      const calling = (field.activeFriend === n) ? "calling" : "";
      return `<span class="road-node node-friend ${n.done ? "done" : ""} ${calling} ${glow}" style="left:${left}%;top:${top}%" title="${base.name}">${creatureSVG(base.color, base.shape, "sad")}</span>`;
    } else {
      // 群れ(⚔)＝出口。遠いほど薄く・近いほど濃く＝行くべき先を示す。
      const near = field.reachedBattle ? "climax" : "";
      const op = (0.3 + 0.7 * (field.x / goal)).toFixed(2);
      return `<span class="road-node node-battle ${n.done ? "done" : ""} ${near}" style="left:${left}%;top:${top}%;opacity:${op}" title="群れの けはい">⚔</span>`;
    }
  }).join("");

  // 操作（マウス追従。クリックが要るのは「友との選択」と「群れと むきあう」だけ）
  let controls = "";
  if (field.activeFriend) {
    controls = `
      <button class="field-btn greet" id="f-greet">🤝 こえをかける（むかえる・夜が 濃くなる）</button>
      <button class="field-btn pass" id="f-pass">… とおりすぎる（夜は 浅いまま）</button>`;
  } else if (field.reachedBattle) {
    // 第一夜は「群れ」という未知語を出さず「むきあう」だけ＝戦いの始まりを やさしく予告。
    controls = field.tutorial
      ? `<button class="field-btn battle" id="f-battle">むきあう（たたかいが はじまる）</button>`
      : `<button class="field-btn battle" id="f-battle">⚔ 群れと むきあう</button>`;
  } else {
    // ふだんは ボタン無し＝マウスでぽちを みちびく。やさしい操作ヒントだけ出す。
    //   第一夜（チュートリアル）は 寄り道/よふけ を言わない＝「歩いて、出会う」だけに絞る（P0-2）。
    controls = field.tutorial
      ? `<span class="field-hint">🖱 マウスで ぽちを みぎへ。……だれかが、まってる。</span>`
      : `<span class="field-hint">🖱 マウスで じゆうに（みぎ＝朝／はしの 💬 は たてに 寄り道して ひろう・寄るほど 夜が 濃くなる）</span>`;
  }

  const duskPct = Math.round(field.dusk || 0);
  // 第一夜は「夜のこさ（よふけ）」を出さない。出すときは効果が伝わる補足を添える（P0-3）。
  const duskRow = field.tutorial ? "" :
    `<div class="bar-row"><span class="bar-lab dusk">夜</span><div class="field-dusk" title="夜のこさ：濃いほど 次の戦いが つらくなる"><div class="fill" style="width:${duskPct}%"></div></div></div>`;
  const fieldNight = field.tutorial ? "はじめての夜"
    : (meta ? (meta.night >= meta.maxNights ? "さいごの夜" : meta.night + "夜目") : "夜");

  body.innerHTML = `
    <div class="field-top">
      <span class="field-night">${fieldNight}</span>
      <div class="field-bars">
        <div class="bar-row"><span class="bar-lab">朝</span><div class="field-progress ${field.reachedBattle ? "climax" : ""}"><div class="fill" style="width:${progPct}%"></div></div></div>
        ${duskRow}
      </div>
    </div>
    <div class="field-road">
      <div class="road-line"></div>
      ${nodesHtml}
      <span class="pochi ${field.paused ? "" : "walking"}" style="left:${pochiLeft}%;top:${pochiTop}%">${pochiSVG("happy")}</span>
    </div>
    <p class="field-msg">${field.message || ""}</p>
    <div class="field-controls">${controls}</div>
  `;
  // 追従ループが毎フレーム軽く動かすための要素をキャッシュ（再描画せずに ぽち・進捗・夜・足元を更新）。
  field._pochiEl = body.querySelector(".pochi");
  field._progEl = body.querySelector(".field-progress .fill");
  field._duskEl = body.querySelector(".field-dusk .fill");
  field._msgEl = body.querySelector(".field-msg");

  const bind = (id, fn) => { const e = $(id); if (e) e.addEventListener("click", fn); };
  bind("f-greet", () => fieldGreet());
  bind("f-pass", () => fieldPass());
  bind("f-battle", () => { playSe("select"); startNightBattle(); });
}

// ── マクロ結末（いくつもの夜の総和）─────────
// 旅で いちばん 言った ことば を ひとつ返す（meta.wordCount の最頻→表示テキスト）。無ければ null。
function topSaidWord() {
  if (!meta || !meta.wordCount) return null;
  let best = null, bestN = 0;
  for (const id in meta.wordCount) {
    if (meta.wordCount[id] > bestN) { bestN = meta.wordCount[id]; best = id; }
  }
  if (!best) return null;
  if (best === "_save") return "いっしょに かえろう";
  const w = (typeof ALL_WORDS !== "undefined" && ALL_WORDS[best]) ? ALL_WORDS[best]
          : (typeof WEAPONS !== "undefined" && WEAPONS[best]) ? WEAPONS[best] : null;
  return w ? (w.word || w.name) : best;
}

function showMacroResult() {
  const ov = $("overlay-macro");
  if (!ov || !field.macro) return;
  const body = ov.querySelector(".ov-body");
  if (!body) return;
  const e = field.macro.ending;
  const intro = (typeof MACRO_INTRO !== "undefined") ? MACRO_INTRO : "";
  const friendsHtml = meta.friends.length
    ? meta.friends.map((f) => `<span class="town-friend">${creatureSVG(f.color, f.shape, "happy")}</span>`).join("")
    : `<span class="town-empty">となりには、だれも いない。</span>`;
  // 迎えた友の“固有名”を一文差し込む＝総和の数字でなく、顔のある朝にする（“さいご”の感情接続）。
  //   2〜3人ぶんは実名で呼び、それ以上は「みんなも」でまとめる（顔ぶれを名前で返す）。
  let nameLine = "";
  if (meta.friends.length) {
    const names = meta.friends.map((f) => f.name);
    const shown = names.slice(0, 3);
    let body2 = `おかえり、${shown.join("。")}。`;
    if (names.length > shown.length) body2 += `そして、ほかの みんなも。`;
    nameLine = `<p class="result-text macro-name">${body2}</p>`;
  }
  // 結末分岐ごとの締め1行（断定せず、景色で返す）。
  const closeMap = {
    hikari: "まぶしい。となりに、みんな いる。",
    nibi: "おぼえてる なまえと、もう よべない なまえ。",
    shizuka: "かぜの おと だけ。……それでも、朝。",
  };
  const closeLine = closeMap[e.id] ? `<p class="result-tone">${closeMap[e.id]}</p>` : "";

  // ⑦ この旅で ぽちが いちばん いえた ことば を ひとつ返す（数えてる感は出さない・自分の夜の声）。
  //   harsh周回なら「バカ」、gentle周回なら「いっしょに かえろう」が出る＝説教なしの自己認識。
  const topWord = topSaidWord();
  const topLine = topWord ? `<p class="result-words">きみが いちばん いえた ことば　「${topWord}」</p>` : "";

  body.innerHTML = `
    <h2 class="result-title">${e.title}</h2>
    <p class="result-text">${intro.replace(/\n/g, "<br>")}</p>
    ${nameLine}
    <p class="result-text">${e.text.replace(/\n/g, "<br>")}</p>
    ${closeLine}
    ${topLine}
    <div class="macro-friends">${friendsHtml}</div>
    <div class="result-stats">
      <div><span>こえた夜</span><b>${meta.maxNights}</b></div>
      <div><span>街の友</span><b>${meta.friends.length}</b></div>
      <div><span>もういない</span><b>${meta.totalKill}</b></div>
      <div><span>ともだち</span><b>${meta.totalSave}</b></div>
      <div><span>いえる ことば</span><b>${(meta.learnedWords || []).length}</b></div>
    </div>
    <button class="restart-btn" id="macro-restart">はじめから</button>
  `;
  const r = $("macro-restart");
  if (r) r.addEventListener("click", () => { playSe("select"); restartJourney(); });
}

// 夜明け/敗北のボタン文言：次の夜が来ることを予告して“周回している実感”を切らさない。
//   dawn かつ さいごの夜を越えた → マクロ結末へ／途中 → 次の夜カウンタを併記。
function dawnButtonLabel(kind) {
  if (kind !== "dawn") return "🏠 街へ もどる";
  if (!meta) return "🏠 街へ かえる";
  if (meta.night >= meta.maxNights) return "🌅 ほんとうの夜明けへ";
  return `次の夜へ（${meta.night + 1}夜目）　→ 🏠`;
}

// ──────────────────────────────────────────
// オーバーレイ（結末 / RUN OVER）
// ──────────────────────────────────────────
function showResult(kind) {
  const ov = $("overlay-result");

  // 第一夜チュートリアルの夜明けは“結末グリッド”を出さない＝静かな一拍だけ置いて 街へ返す（P0-2/P0-4）。
  //   結果（迎えた/追い払った）は 街の景色で返すので、ここでは 数値や ENDINGS 文章を見せない。
  if (kind === "dawn" && game && game.tutorial) {
    if (typeof setBgmTheme === "function") setBgmTheme("warm");
    document.body.className = "theme-night";
    // 追い払っただけの朝に 罵声（バカ）を“のこった ことば”として出さない＝静けさで返す（桜井#6）。
    const tutLast = (game.counters.save === 0 && game.counters.kill > 0) ? "……" : (game.lastWord || "……");
    ov.querySelector(".ov-body").innerHTML = `
      <h2 class="result-title">よが あけた</h2>
      <p class="result-text">ながい よるの、はじめての あさ。</p>
      <p class="result-words">さいごに のこった ことば　「${tutLast}」</p>
      <button class="restart-btn">🏠 街へ かえる</button>
    `;
    ov.querySelector(".restart-btn").addEventListener("click", () => { playSe("select"); returnToTown(); });
    showOverlay("overlay-result");
    return;
  }

  const stats = runStats();

  let title, text, theme;
  if (kind === "dawn") {
    const e = game.ending;
    title = e.title;
    text = e.text;
    theme = e.theme;
    setBgmTheme(theme); // 結末でBGMの雰囲気を切替
  } else {
    title = "よが あけなかった";
    text = "よるに のまれてしまった…。\nでも、まだ おわりじゃない。\nもう一度、あさを めざそう。";
    theme = "over";
  }

  // 背景テーマを body に反映（色を変える）
  document.body.className = "theme-" + theme;

  // 狂気／ぬくもり の偏りを、同じ結末でも“翳り／灯り”として一言添える（積み方が結末の手触りに残る）。
  const p = game.player;
  let toneNote = "";
  if (p.kyoki >= 6 && p.kyoki > p.nukumori) toneNote = "きみの こえは、すこし とげとげしいまま 朝をむかえた。";
  else if (p.nukumori >= 6 && p.nukumori >= p.kyoki) toneNote = "やさしい ことばの あたたかさが、まだ 手のひらに のこっている。";

  // この夜 新しく言えるようになったことば（語彙の成長を結末で見せる）。
  const learnedNow = (game.newWords || []).map((id) => KIND_WORDS[id] ? KIND_WORDS[id].word : id);
  const lastWord = game.lastWord || "……";

  ov.querySelector(".ov-body").innerHTML = `
    <h2 class="result-title">${title}</h2>
    <p class="result-text">${text.replace(/\n/g, "<br>")}</p>
    ${toneNote ? `<p class="result-tone">${toneNote}</p>` : ""}
    <p class="result-words">さいごに のこった ことば　「${lastWord}」</p>
    ${learnedNow.length ? `<p class="result-words dim">この夜 おぼえた ことば：${learnedNow.map((w) => `「${w}」`).join("　")}</p>` : ""}
    <div class="result-stats">
      <div><span>もういない</span><b>${stats.kill}</b></div>
      <div><span>ともだち</span><b>${stats.save}</b></div>
      <div><span>あかり</span><b>${stats.memory}</b></div>
      <div><span>たどりついた夜</span><b>${stats.reachedWave}/${totalWaves()}</b></div>
    </div>
    <button class="restart-btn">${dawnButtonLabel(kind)}</button>
  `;
  // v0.4：もう「最初から」ではなく、メタループの街へ帰る。
  //   夜明け(dawn)＝この夜の戦果を街に持ち帰り、次の夜 or マクロ結末へ（returnToTown）。
  //   よが あけなかった(over)＝夜カウンタは進めず、街にもどって もう一度（townRetry）。
  ov.querySelector(".restart-btn").addEventListener("click", () => {
    playSe("select");
    if (kind === "dawn") returnToTown();
    else townRetry();
  });
  showOverlay("overlay-result");
}

// ── オーバーレイの表示/非表示 ──
function showOverlay(id) { $(id).classList.remove("hidden"); }
function hideOverlay(id) { $(id).classList.add("hidden"); }

// ── トースト（一時メッセージ。battle.js の flash から呼ばれる） ──
let _toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
}
