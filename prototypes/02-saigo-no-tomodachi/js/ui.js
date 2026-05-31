/*
 * ui.js — 画面の描画とプレイヤー入力
 *
 * 戦闘はターン制なので、状態が変わるたびに render() で画面を作り直すシンプル方式。
 * 入力は「コマンド選択 → （武器/ACT/対象を選ぶ）→ 実行」という段階を ui.mode で管理する。
 */

// 入力の途中状態（どの段階で、何を選びかけているか）
const ui = {
  mode: "idle",        // idle / weapon / fightTarget / act / actTarget / save / item
  pendingWeapon: null, // 祓うで選んだ武器
  pendingAct: null,    // こころみるで選んだACT
};

// よく使うDOM取得＆生成のヘルパー
function $(id) { return document.getElementById(id); }
function setText(id, text) { const e = $(id); if (e) e.textContent = text; }

// ──────────────────────────────────────────
// 画面全体を描画（game.state を見て出すものを切り替える）
// ──────────────────────────────────────────
function render() {
  if (!game) return;
  renderTopbar();
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

// ── 上部バー（ウェーブ・カウンタ） ─────────────
function renderTopbar() {
  setText("wave-info", `WAVE ${waveNumber()} / ${totalWaves()}　夜明けまで`);
  setText("c-kill", game.counters.kill);
  setText("c-save", game.counters.save);
  setText("c-memory", game.counters.memory);
}

// ── 敵エリア ───────────────────────────────
function renderEnemies() {
  const area = $("enemy-area");
  area.innerHTML = "";
  const living = livingEnemies();

  // いまターゲットを選ぶ段階か？（選べる敵を光らせる）
  const targeting =
    game.state === STATES.PLAYER_TURN &&
    (ui.mode === "fightTarget" || ui.mode === "actTarget" || ui.mode === "save");

  for (const e of living) {
    const card = document.createElement("div");
    card.className = "enemy";
    if (e.boss) card.classList.add("boss");

    // すくえる相手だけ選べる「save」モードでは、壁0以外は選べない
    const selectable =
      targeting && (ui.mode !== "save" || e.wall === 0);
    if (selectable) card.classList.add("selectable");

    // 心の壁（♥＝残り, ♡＝消えた分）。0なら「すくえそう」表示
    let walls = "";
    for (let i = 0; i < e.maxWall; i++) walls += i < e.wall ? "♥" : "♡";
    const saveable = e.wall === 0;

    // 状態（無力化／攻撃力ダウン）
    const tags = [];
    if (e.status.silence > 0) tags.push("ひるみ");
    if (e.atk < e.baseAtk) tags.push("攻↓");

    const hpPct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));

    card.innerHTML = `
      <div class="enemy-fig shape-${e.shape} ${e.sad ? "sad" : ""}" style="--c:${e.color}">
        <span class="eye l"></span><span class="eye r"></span><span class="mouth"></span>
      </div>
      <div class="enemy-name">${e.name}</div>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <div class="enemy-hp">HP ${e.hp}/${e.maxHp}</div>
      <div class="walls ${saveable ? "ok" : ""}">${saveable ? "すくえそう" : walls}</div>
      ${tags.length ? `<div class="enemy-tags">${tags.join(" / ")}</div>` : ""}
    `;

    if (selectable) {
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

  // 武器（進化なら「進化」表記、それ以外は Lv）
  const weapons = p.weapons
    .map((id) => {
      const w = WEAPONS[id];
      const lv = w.evolved ? "★進化" : "Lv" + weaponLevel(id);
      return `${w.name}<small>(${lv})</small>`;
    })
    .join(" ／ ");

  // どうぐ
  const items = Object.keys(p.items)
    .filter((k) => p.items[k] > 0)
    .map((k) => `${ITEMS[k].name}×${p.items[k]}`)
    .join(" ") || "なし";

  // パッシブ
  const passKeys = Object.keys(p.passives).filter((k) => p.passives[k]);
  const passives = passKeys.length
    ? passKeys.map((k) => CARDS.find((c) => c.key === k)?.name || k).join("・")
    : "なし";

  $("player-bar").innerHTML = `
    <div class="p-row p-top">
      <span class="p-name">${p.name}</span>
      <span class="p-lv">Lv ${p.level}</span>
    </div>
    <div class="p-gauge">
      <span class="g-label">HP</span>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <span class="g-num">${p.hp}/${p.maxHp}</span>
    </div>
    <div class="p-gauge">
      <span class="g-label">こころ</span>
      <div class="bar kokoro"><div class="fill" style="width:${koPct}%"></div></div>
      <span class="g-num">${p.kokoro}/${p.maxKokoro}</span>
    </div>
    <div class="p-row p-detail">
      <span>武器：${weapons}</span>
    </div>
    <div class="p-row p-detail">
      <span>どうぐ：${items}</span>
      <span>パッシブ：${passives}</span>
    </div>
  `;
}

// ── コマンドバー（祓う/こころみる/すくう/どうぐ/まもる） ──
function renderCommands() {
  const bar = $("command-bar");
  const active = game.state === STATES.PLAYER_TURN;
  const p = game.player;
  const hasItem = Object.keys(p.items).some((k) => p.items[k] > 0);

  const defs = [
    { cmd: "fight", label: "祓う", sub: "FIGHT", cls: "c-fight", on: active },
    { cmd: "act", label: "こころみる", sub: `ACT・こころ-${BALANCE.actCost}`, cls: "c-act", on: active && p.kokoro >= BALANCE.actCost },
    { cmd: "save", label: "すくう", sub: `SAVE・こころ-${BALANCE.saveCost}`, cls: "c-save", on: active && p.kokoro >= BALANCE.saveCost },
    { cmd: "item", label: "どうぐ", sub: "ITEM", cls: "c-item", on: active && hasItem },
    { cmd: "defend", label: "まもる", sub: "DEFEND", cls: "c-defend", on: active },
  ];

  bar.innerHTML = "";
  for (const d of defs) {
    const b = document.createElement("button");
    b.className = "cmd " + d.cls;
    if (ui.mode === d.cmd || (d.cmd === "fight" && (ui.mode === "weapon" || ui.mode === "fightTarget")) ||
        (d.cmd === "act" && (ui.mode === "act" || ui.mode === "actTarget"))) {
      b.classList.add("on");
    }
    b.disabled = !d.on;
    b.innerHTML = `<span class="cmd-label">${d.label}</span><span class="cmd-sub">${d.sub}</span>`;
    if (d.on) b.addEventListener("click", () => onCommand(d.cmd));
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
  };
  const addHint = (text) => {
    const d = document.createElement("div");
    d.className = "prompt-hint";
    d.textContent = text;
    box.appendChild(d);
  };
  const addCancel = () => addBtn("やめる", "", cancelSelection);

  if (ui.mode === "weapon") {
    addHint("どの武器で祓う？");
    for (const id of game.player.weapons) {
      const w = WEAPONS[id];
      const tgt = targetLabel(w.target);
      const pow = w.evolved ? w.power : weaponPower(id);
      addBtn(w.name, `${tgt}・威力${pow}${w.wallDown ? `・壁-${w.wallDown}` : ""}`, () => selectWeapon(id));
    }
    addCancel();
  } else if (ui.mode === "act") {
    addHint("どう こころみる？（敵により効くものが違う）");
    for (const id of Object.keys(ACTS)) {
      addBtn(ACTS[id].name, ACTS[id].desc, () => selectAct(id));
    }
    addCancel();
  } else if (ui.mode === "item") {
    addHint("どのどうぐを つかう？");
    for (const k of Object.keys(game.player.items)) {
      if (game.player.items[k] > 0) {
        addBtn(ITEMS[k].name, `×${game.player.items[k]}・${ITEMS[k].desc}`, () => useItem(k));
      }
    }
    addCancel();
  } else if (ui.mode === "fightTarget") {
    addHint("祓う相手を選ぶ（上の敵をクリック）");
    addCancel();
  } else if (ui.mode === "actTarget") {
    addHint(`「${ACTS[ui.pendingAct].name}」を試す相手を選ぶ`);
    addCancel();
  } else if (ui.mode === "save") {
    addHint("すくう相手を選ぶ（心の壁が消えた相手）");
    addCancel();
  } else {
    addHint("コマンドを選んでください");
  }
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
    if (ws.length === 1) selectWeapon(ws[0]);
    else { ui.mode = "weapon"; renderPrompt(); renderCommands(); }
  } else if (cmd === "act") {
    ui.mode = "act"; renderPrompt(); renderCommands();
  } else if (cmd === "save") {
    const savable = livingEnemies().filter((e) => e.wall === 0);
    if (savable.length === 0) { showToast("すくえる相手がいない（先にこころみる）"); return; }
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
    ui.mode = "fightTarget"; renderPrompt(); renderEnemies(); renderCommands();
  } else {
    doAction(() => cmdFight(wid), "fight"); // 全体・前列はすぐ実行
  }
}

function selectAct(aid) {
  ui.pendingAct = aid;
  ui.mode = "actTarget"; renderPrompt(); renderEnemies(); renderCommands();
}

function useItem(itemId) {
  doAction(() => cmdItem(itemId), "item");
}

function onEnemyClick(uid) {
  if (!game || game.state !== STATES.PLAYER_TURN) return;
  if (ui.mode === "fightTarget") doAction(() => cmdFight(ui.pendingWeapon, uid), "fight");
  else if (ui.mode === "actTarget") doAction(() => cmdAct(ui.pendingAct, uid), "act");
  else if (ui.mode === "save") doAction(() => cmdSave(uid), "save");
}

function cancelSelection() {
  ui.mode = "idle";
  ui.pendingWeapon = null;
  ui.pendingAct = null;
  renderPrompt(); renderEnemies(); renderCommands();
}

// コマンド実行の共通処理（音・状態遷移・再描画）
function doAction(fn, seName) {
  const hpBefore = game.player.hp;
  const ok = fn(); // battle.js のコマンドを実行
  if (!ok) return; // 弾かれたら選択状態のまま

  playSe(seName);
  if (game.player.hp < hpBefore) playSe("hit");      // 被弾
  if (game.state === STATES.LEVEL_UP) playSe("levelup");
  else if (game.state === STATES.DAWN) playSe("dawn");

  ui.mode = "idle";
  ui.pendingWeapon = null;
  ui.pendingAct = null;
  render();
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
// オーバーレイ（結末 / RUN OVER）
// ──────────────────────────────────────────
function showResult(kind) {
  const ov = $("overlay-result");
  const stats = runStats();
  const ratePct = Math.round(stats.saveRate * 100);

  let title, text, theme;
  if (kind === "dawn") {
    const e = game.ending;
    title = e.title;
    text = e.text;
    theme = e.theme;
    setBgmTheme(theme); // 結末でBGMの雰囲気を切替
  } else {
    title = "RUN OVER";
    text = "夜に呑まれてしまった。\nもう一度、やりなおそう。";
    theme = "over";
  }

  // 背景テーマを body に反映（色を変える）
  document.body.className = "theme-" + theme;

  ov.querySelector(".ov-body").innerHTML = `
    <h2 class="result-title">${title}</h2>
    <p class="result-text">${text.replace(/\n/g, "<br>")}</p>
    <div class="result-stats">
      <div><span>殲滅</span><b>${stats.kill}</b></div>
      <div><span>救済</span><b>${stats.save}</b></div>
      <div><span>救済率</span><b>${ratePct}%</b></div>
      <div><span>記憶のカケラ</span><b>${stats.memory}</b></div>
      <div><span>到達ウェーブ</span><b>${stats.reachedWave}/${totalWaves()}</b></div>
      <div><span>ラン時間</span><b>${stats.seconds}秒</b></div>
    </div>
    <button class="restart-btn">もう1回</button>
  `;
  ov.querySelector(".restart-btn").addEventListener("click", () => {
    playSe("select");
    document.body.className = "theme-night";
    setBgmTheme("night");
    startRun();
    render();
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
