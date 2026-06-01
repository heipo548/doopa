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
  applyTone();        // 狂気／ぬくもり に応じて画面のトーンをそっと変える
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

  // きついことば（進化なら「進化」表記、それ以外は Lv）。name には実際のセリフが入っている。
  const weapons = p.weapons
    .map((id) => {
      const w = WEAPONS[id];
      const lv = w.evolved ? "★進化" : "Lv" + weaponLevel(id);
      return `「${w.name}」<small>(${lv})</small>`;
    })
    .join(" ／ ");

  // もちもの
  const items = Object.keys(p.items)
    .filter((k) => p.items[k] > 0)
    .map((k) => `${ITEMS[k].name}×${p.items[k]}`)
    .join(" ") || "なし";

  // パッシブ
  const passKeys = Object.keys(p.passives).filter((k) => p.passives[k]);
  const passives = passKeys.length
    ? passKeys.map((k) => CARDS.find((c) => c.key === k)?.name || k).join("・")
    : "なし";

  // ことば図鑑（最小版）：学んで増えた“やさしいことば”を見せる＝言えることが増えた手応え。
  const learned = learnedKindWords();
  const learnedChips = learned.length
    ? learned.map((id) => `<span class="word-chip">「${KIND_WORDS[id].word}」</span>`).join("")
    : `<span class="word-chip dim">まだ すくない…</span>`;

  // 狂気／ぬくもり（口喧嘩の2ゲージ）。バーの満タンは目安（狂気=上限／ぬくもり=閾値×4）。
  const kyokiPct = Math.min(100, Math.round((p.kyoki / BALANCE.kyokiMax) * 100));
  const nukuCap = BALANCE.nukumoriStep * 4;
  const nukuPct = Math.min(100, Math.round((p.nukumori / nukuCap) * 100));

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
    <div class="p-row mind-meters">
      <div class="meter kyoki" title="きついことばで上がる。高いほど ことばは鋭いが、世界が翳る">
        <span class="m-label">狂気</span>
        <div class="bar"><div class="fill" style="width:${kyokiPct}%"></div></div>
        <span class="m-num">${p.kyoki}</span>
      </div>
      <div class="meter nukumori" title="やさしいことばで上がる。閾値ごとに 最大HP＋＝救いの雪だるま">
        <span class="m-label">ぬくもり</span>
        <div class="bar"><div class="fill" style="width:${nukuPct}%"></div></div>
        <span class="m-num">${p.nukumori}</span>
      </div>
    </div>
    <div class="p-row p-detail">
      <span>きついことば：${weapons}</span>
    </div>
    <div class="p-row p-detail vocab">
      <span>ことば図鑑（やさしい）：${learnedChips}</span>
    </div>
    <div class="p-row p-detail">
      <span>もちもの：${items}</span>
      <span>パッシブ：${passives}</span>
    </div>
    ${game.counters.save > 0 ? `<div class="p-row p-detail bond"><span>🤝 きずな：むかえた友 ${game.counters.save}人 が 群れの反撃を <b>−${bondReduction()}</b> かばってくれる${bondReduction() >= BALANCE.bondReduceMax ? "（最大）" : ""}</span></div>` : ""}
  `;
}

// ── コマンドバー（祓う/こころみる/すくう/どうぐ/まもる） ──
function renderCommands() {
  const bar = $("command-bar");
  const active = game.state === STATES.PLAYER_TURN;
  const p = game.player;
  const hasItem = Object.keys(p.items).some((k) => p.items[k] > 0);

  // プレイヤーに見える名前は“ことばで戦う口喧嘩”に寄せる（内部の cmd キーは据え置き）。
  //   ぶつける＝とげとげした言葉 ／ きいてみる＝相手の声をきく ／ 手をのばす＝迎える ／ こらえる＝耐える
  const defs = [
    { cmd: "fight", label: "ぶつける", sub: "きついことば", cls: "c-fight", on: active },
    { cmd: "act", label: "きいてみる", sub: `きく・こころ-${BALANCE.actCost}`, cls: "c-act", on: active && p.kokoro >= BALANCE.actCost },
    { cmd: "save", label: "手をのばす", sub: `むかえる・こころ-${BALANCE.saveCost}`, cls: "c-save", on: active && p.kokoro >= BALANCE.saveCost },
    { cmd: "item", label: "もちもの", sub: "おまもり", cls: "c-item", on: active && hasItem },
    { cmd: "defend", label: "こらえる", sub: "まもる", cls: "c-defend", on: active },
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
    addHint("どの きついことばを ぶつける？");
    for (const id of game.player.weapons) {
      const w = WEAPONS[id];
      const tgt = targetLabel(w.target);
      const pow = w.evolved ? w.power : weaponPower(id);
      // とげのことばは「狂気＋」、進化した「いっしょに かえろう」は ぬくもり＋ を明記
      const meter = w.kyoki ? `・狂気+${w.kyoki}` : (w.nukumori ? `・ぬくもり+${w.nukumori}` : "");
      const b = addBtn(`「${w.name}」`, `${tgt}・威力${pow}${w.wallDown ? `・壁-${w.wallDown}` : ""}${meter}`, () => selectWeapon(id));
      if (b) b.classList.add(w.category === "yasashii" ? "word-yasashii" : "word-toge");
    }
    addCancel();
  } else if (ui.mode === "act") {
    // 相手は選択済み。その子に効きそうなことば＋少しのダミー＋学んだ汎用語を出す。
    const tgt = findEnemy(ui.pendingActTarget);
    const base = tgt ? (ENEMIES[tgt.type] || {}) : {};
    addHint(`「${tgt ? tgt.name : "相手"}」に どんな ことばを かける？${base.hint ? `（💭 ${base.hint}）` : ""}`);
    const list = ui.pendingActList || Object.keys(ACTS);
    for (const id of list) {
      const word = wordById(id);
      if (!word) continue;
      const b = addBtn(`「${word.name}」`, word.desc, () => selectAct(id));
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
    addHint("手をのばす相手を選ぶ（心の壁が消えた＝おだやかな子）");
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
  if (game.counters.kill === 0 && game.counters.save === 0) {
    return "💡 ここは ことばで たたかう夜。【ぶつける】＝きついことばで早く退ける（でも狂気がたまる）。やさしくいくなら【きいてみる】で相手の“心の壁”をほどき、0になったら【手をのばす】＝ともだちに（被弾も減る）。";
  }
  if (game.counters.save === 0) {
    return "💡 むかえかた：【きいてみる】→相手→効くことば で壁を0に→【手をのばす】。むかえると その子の“ことば”を教わって、言えることが増えるよ。";
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
  // ことば系（ぶつける/きいてみる/手をのばす）は “言ったことばの吹き出し”が主役なので
  // 中央の大きな動詞フラッシュは出さない。もちもの／こらえる だけ動詞を出す。
  if (seName === "item" || seName === "defend") bigFlash(seName);
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
    } else if (ev.t === "speak") {
      // 言ったことばを 吹き出しで見せる（カテゴリで色とトーンが変わる＝感情が伝わる）
      wordBubble(ev.text, ev.cat);
    } else if (ev.t === "kyoki") {
      meterFloat("kyoki", `狂気＋${ev.amount}`);
    } else if (ev.t === "nukumori") {
      meterFloat("nukumori", `ぬくもり＋${ev.amount}`);
      if (ev.bonus && ev.bonus.hpUp > 0) {
        const pb = $("player-bar");
        if (pb) { pb.classList.add("healpulse"); setTimeout(() => pb.classList.remove("healpulse"), 600); }
      }
    }
  }
  if (pdmg > 0) { screenShake(); hitVignette(); } // 被弾＝画面が揺れて赤くにじむ
  if (calmed) playSe("calm");
  if (healed) playSe("heal");
  game.fx = [];
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

// 狂気／ぬくもり メーターの近くに「＋N」をふわっと出す（ゲージが育つ手応え）。
function meterFloat(which, text) {
  const meter = document.querySelector(`.meter.${which}`);
  const host = $("game");
  if (!meter || !host) return;
  const mr = meter.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "meter-float " + which;
  el.textContent = text;
  el.style.left = (mr.left - hr.left + mr.width / 2) + "px";
  el.style.top = (mr.top - hr.top - 4) + "px";
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
  meter.classList.add("bump");
  setTimeout(() => meter.classList.remove("bump"), 360);
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

  // 狂気／ぬくもり の偏りを、同じ結末でも“翳り／灯り”として一言添える（積み方が結末の手触りに残る）。
  const p = game.player;
  let toneNote = "";
  if (p.kyoki >= 6 && p.kyoki > p.nukumori) toneNote = "きみの こえは、すこし とげとげしいまま 朝をむかえた。";
  else if (p.nukumori >= 6 && p.nukumori >= p.kyoki) toneNote = "やさしい ことばの ぬくもりが、まだ 手のひらに のこっている。";

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
      <div><span>おいはらった</span><b>${stats.kill}</b></div>
      <div><span>むかえた</span><b>${stats.save}</b></div>
      <div><span>むかえた率</span><b>${ratePct}%</b></div>
      <div><span>きずな</span><b>${stats.memory}</b></div>
      <div><span>たどりついた夜</span><b>${stats.reachedWave}/${totalWaves()}</b></div>
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
