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

// ── 上部バー（ウェーブ進行ドット・カウンタ） ─────────────
function renderTopbar() {
  // どこまで進めば夜明け（クリア）かが一目で分かるよう、ウェーブを●で並べる（★＝ボス）。
  const left = totalWaves() - waveNumber(); // 現在ウェーブを終えた後に残る数
  const leftText = isBossWave()
    ? "最後の夜"
    : `夜明けまで あと ${left}`;
  $("wave-info").innerHTML = `${waveDots()}<span class="wave-text">${leftText}</span>`;
  setText("c-kill", game.counters.kill);
  setText("c-save", game.counters.save);
  // 「記憶」改め「きずな」：救った数＝いま反撃をどれだけ和らげているか（救う見返りの可視化）
  const shield = bondReduction();
  setText("c-memory", game.counters.memory + (shield > 0 ? `（−${shield}）` : ""));
}

// ウェーブ進行の●を作る（済＝薄い／いま＝光る／★＝ボス）。
function waveDots() {
  let s = "";
  for (let i = 0; i < totalWaves(); i++) {
    const isBoss = !!(WAVES[i] && WAVES[i].boss);
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
    (ui.mode === "fightTarget" || ui.mode === "actTarget" || ui.mode === "save");

  for (const e of living) {
    const card = document.createElement("div");
    card.className = "enemy";
    card.setAttribute("data-uid", e.uid); // 演出（ダメージ数字）をこの要素に重ねるための目印
    if (e.boss) card.classList.add("boss");

    // 心の壁が消えた敵は「おだやか」＝もう攻撃してこない。顔も穏やかにする。
    const saveable = e.wall === 0;
    if (saveable) card.classList.add("calm");

    // すくえる相手だけ選べる「save」モードでは、壁0以外は選べない
    const selectable =
      targeting && (ui.mode !== "save" || e.wall === 0);
    if (selectable) card.classList.add("selectable");

    // 心の壁（♥＝残り, ♡＝消えた分）。0なら「すくえそう」表示
    let walls = "";
    for (let i = 0; i < e.maxWall; i++) walls += i < e.wall ? "♥" : "♡";

    // 状態（おだやか／無力化／攻撃力ダウン）
    const tags = [];
    if (saveable) tags.push("おだやか♪");
    if (e.status.silence > 0) tags.push("ひるみ");
    if (e.atk < e.baseAtk) tags.push("攻↓");

    const hpPct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));

    // 「だれを こころみる？」の段階だけ、その子の手がかり（hint）を出して総当たりを防ぐ。
    const base = ENEMIES[e.type] || {};
    const showHint = ui.mode === "actTarget" && !saveable && base.hint;

    card.innerHTML = `
      <div class="enemy-fig shape-${e.shape} ${e.sad ? "sad" : ""} ${saveable ? "calm" : ""}" style="--c:${e.color}">
        <span class="eye l"></span><span class="eye r"></span><span class="mouth"></span>
      </div>
      <div class="enemy-name">${e.name}</div>
      <div class="bar hp"><div class="fill" style="width:${hpPct}%"></div></div>
      <div class="enemy-hp">HP ${e.hp}/${e.maxHp}</div>
      <div class="walls ${saveable ? "ok" : ""}">${saveable ? "すくえそう" : walls}</div>
      ${tags.length ? `<div class="enemy-tags">${tags.join(" / ")}</div>` : ""}
      ${showHint ? `<div class="enemy-hint">💭 ${base.hint}</div>` : ""}
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
    ${game.counters.save > 0 ? `<div class="p-row p-detail bond"><span>🤝 きずな：助けた友 ${game.counters.save}人 が 群れの反撃を <b>−${bondReduction()}</b> かばってくれる${bondReduction() >= BALANCE.bondReduceMax ? "（最大）" : ""}</span></div>` : ""}
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
    // 相手は選択済み。その子に「効きそうなACT＋少しのダミー」だけを出す（6択の総当たりを解消）。
    const tgt = findEnemy(ui.pendingActTarget);
    const base = tgt ? (ENEMIES[tgt.type] || {}) : {};
    addHint(`「${tgt ? tgt.name : "相手"}」に どう こころみる？${base.hint ? `（💭 ${base.hint}）` : ""}`);
    const list = ui.pendingActList || Object.keys(ACTS);
    for (const id of list) {
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
    addHint("だれを こころみる？（上の敵をクリック。各カードの 💭 が手がかり）");
    addCancel();
  } else if (ui.mode === "save") {
    addHint("すくう相手を選ぶ（心の壁が消えた＝おだやかな相手）");
    addCancel();
  } else {
    // 初見のときだけ、次の一手をやさしく示す（チュートリアルの代わり）。
    const coach = coachLine();
    addHint(coach || "コマンドを選んでください");
  }
}

// その相手に「効きそうなACT＋少しのダミー」を作る。
//   敵の acts（正解）を必ず入れ、残りを他ACTから足して最大4つに。総当たり感を消しつつ少し悩ませる。
function actOptionsFor(uid) {
  const t = findEnemy(uid);
  const all = Object.keys(ACTS);
  if (!t) return all;
  const eff = t.acts.slice();                       // この敵に効くACT（ヒントと整合）
  const decoys = all.filter((id) => !eff.includes(id));
  shuffleArr(decoys);
  const want = Math.min(4, Math.max(3, eff.length + 1)); // 3〜4個に収める
  const list = eff.concat(decoys).slice(0, Math.max(eff.length, want));
  return shuffleArr(list); // 並びはランダム（正解が常に先頭…にならないように）
}

// 小さな配列シャッフル（cards.js の shuffle はあるが、依存順の都合でこちらにも軽量版を置く）
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 初見コーチング（ウェーブ1のあいだだけ、状況に応じた次の一手を返す）。
function coachLine() {
  if (waveNumber() !== 1) return null;
  if (game.counters.kill === 0 && game.counters.save === 0) {
    return "💡 はじめてなら：下の【祓う】で1体たおすと早い。やさしくいくなら【こころみる】で“心の壁”をほどき、0になったら【すくう】＝ともだちに（被弾も減る）。";
  }
  if (game.counters.save === 0) {
    return "💡 救いかた：【こころみる】→相手→効くやり方 で壁を0に→【すくう】。救うほど『きずな』で群れの反撃がやわらぐよ。";
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
    if (ws.length === 1) selectWeapon(ws[0]);
    else { ui.mode = "weapon"; renderPrompt(); renderCommands(); }
  } else if (cmd === "act") {
    // まず「だれを」こころみるか選ぶ → その子向けに候補ACTを絞る（6択総当たりの解消）
    ui.mode = "actTarget"; renderPrompt(); renderEnemies(); renderCommands();
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
  // 相手はもう選んである（actTarget で確定済み）。そのまま実行する。
  const uid = ui.pendingActTarget;
  doAction(() => cmdAct(aid, uid), "act");
}

function useItem(itemId) {
  doAction(() => cmdItem(itemId), "item");
}

function onEnemyClick(uid) {
  if (!game || game.state !== STATES.PLAYER_TURN) return;
  if (ui.mode === "fightTarget") {
    doAction(() => cmdFight(ui.pendingWeapon, uid), "fight");
  } else if (ui.mode === "actTarget") {
    // 相手を決めたら、その子に効きそうなACT＋少しのダミーだけを出す段階へ
    ui.pendingActTarget = uid;
    ui.pendingActList = actOptionsFor(uid);
    ui.mode = "act";
    playSe("select");
    renderPrompt(); renderEnemies(); renderCommands();
  } else if (ui.mode === "save") {
    doAction(() => cmdSave(uid), "save");
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

// コマンド実行の共通処理（音・状態遷移・再描画・演出）
function doAction(fn, seName) {
  const hpBefore = game.player.hp;
  if (Array.isArray(game.fx)) game.fx = []; // 今回の行動ぶんの演出イベントだけを集める

  const ok = fn(); // battle.js のコマンドを実行
  if (!ok) return; // 弾かれたら選択状態のまま

  playSe(seName);
  bigFlash(seName);                                   // 「いま何をしたか」を画面中央に一瞬 大きく
  if (game.player.hp < hpBefore) playSe("hit");       // 被弾
  if (game.state === STATES.LEVEL_UP) playSe("levelup");
  else if (game.state === STATES.DAWN) playSe("dawn");

  ui.mode = "idle";
  ui.pendingWeapon = null;
  ui.pendingAct = null;
  ui.pendingActTarget = null;
  ui.pendingActList = null;
  render();
  playFx(); // render の後に、敵へダメージ数字を重ねたり画面を揺らす（手応えを“体に来る”形に）
}

// ──────────────────────────────────────────
// 手応えの演出（ダメージ数字・揺れ・フラッシュ）
//   battle.js が game.fx に積んだ「何が起きたか」を、ここで見せる。
// ──────────────────────────────────────────
function playFx() {
  if (!Array.isArray(game.fx) || !game.fx.length) return;
  let pdmg = 0, calmed = false, healed = false;
  for (const ev of game.fx) {
    if (ev.t === "hit") {
      floatOnEnemy(ev.uid, `-${ev.dmg}`, ev.dead ? "dmg dead" : "dmg");
      shakeEnemy(ev.uid);
    } else if (ev.t === "calm") {
      floatOnEnemy(ev.uid, "ほっ…♪", "calm");
      calmed = true;
    } else if (ev.t === "save") {
      floatOnEnemy(ev.uid, "ありがとう", "save");
    } else if (ev.t === "pdmg") {
      pdmg += ev.dmg;
    } else if (ev.t === "pheal") {
      healed = true;
      const pb = $("player-bar");
      if (pb) { pb.classList.add("healpulse"); setTimeout(() => pb.classList.remove("healpulse"), 600); }
    }
  }
  if (pdmg > 0) { screenShake(); hitVignette(); } // 被弾＝画面が揺れて赤くにじむ
  if (calmed) playSe("calm");
  if (healed) playSe("heal");
  game.fx = [];
}

// 敵カードの上に、数字や言葉をふわっと浮かせて消す。
function floatOnEnemy(uid, text, cls) {
  const card = document.querySelector(`.enemy[data-uid="${uid}"]`);
  const host = $("game");
  if (!card || !host) return;
  const cr = card.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "float-num " + cls;
  el.textContent = text;
  el.style.left = (cr.left - hr.left + cr.width / 2) + "px";
  el.style.top = (cr.top - hr.top + 6) + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function shakeEnemy(uid) {
  const c = document.querySelector(`.enemy[data-uid="${uid}"]`);
  if (c) { c.classList.add("hitshake"); setTimeout(() => c.classList.remove("hitshake"), 320); }
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
    fight:  ["祓う！", "fx-fight"],
    act:    ["こころみる", "fx-act"],
    save:   ["すくう！", "fx-save"],
    item:   ["どうぐ", "fx-item"],
    defend: ["まもる", "fx-defend"],
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
    title = "よが あけなかった";
    text = "よるに のまれてしまった…。\nでも、まだ おわりじゃない。\nもう一度、あさを めざそう。";
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
