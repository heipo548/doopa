/*
 * main.js — 配線とイベントループ（DOM 依存）
 *
 * 役割：起動 → タイトル。入力（クリック/キー）を受け、状態遷移を“指揮”する。
 *   実際の処理は state/words/field/encounter/save/ui に委譲（main は つなぐ だけ）。
 *
 * 画面の流れ：
 *   TITLE →(はじめる)→ FIELD(森) →(調べる)→ LOOK →(言葉)→ FIELD
 *         →(橋)→ ENCOUNTER(壊れた橋) → FIELD →(出口)→ FIELD(村)
 *         →(老人/母)→ DIALOGUE →(子ども)→ ENCOUNTER →(母)→ FINALE → ENDING
 *   ☰/Esc で PAUSE。失敗してもゲームオーバーにはしない（“すれ違い”として先へ）。
 *
 * ※ DOM 依存。末尾で window へ明示エクスポート。
 */

let _audioReady = false;
let _raf = null;
let _lastTs = null;
let _keysHeld = {};

function _initAudioOnce() { if (_audioReady) return; _audioReady = true; if (typeof initAudio === "function") initAudio(); }
function _reduce() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function setHtml(id, h) { const e = document.getElementById(id); if (e) e.innerHTML = h; }
function _narr() { return game ? game._narr : null; }

// ──────────────────────────────────────────
// 起動
// ──────────────────────────────────────────
function main() {
  newGame();
  app.screen = "title";
  render();
  wireEvents();
}

// ── タイトル → ゲーム ──
function startGame() {
  _initAudioOnce();
  newGame();
  game.startedAt = Date.now();
  enterArea(PLAYER_INIT.spawnArea || "mori");
  render();
  startFieldLoop();
}
function continueGame() {
  _initAudioOnce();
  if (!(typeof loadGame === "function") || !loadGame()) { toast("セーブが ありません。"); return; }
  enterArea(game.currentArea || "mori", { fromSave: true });
  render();
  startFieldLoop();
  toast("つづきから 再開した。");
}
function toTitle() {
  stopFieldLoop();
  if (game) game._narr = null;
  newGame();
  app.screen = "title";
  render();
}

// ──────────────────────────────────────────
// フィールドのループ（rAF）
// ──────────────────────────────────────────
function startFieldLoop() { stopFieldLoop(); _lastTs = null; _raf = requestAnimationFrame(fieldTick); }
function stopFieldLoop() {
  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  _keysHeld = {};
  if (app.player) app.player.keys = {};
}
function fieldTick(ts) {
  if (app.screen !== "field") { _raf = null; return; }
  const dt = _lastTs ? (ts - _lastTs) / 1000 : 0.016;
  _lastTs = ts;
  fieldUpdate(dt);

  const p = app.player;
  // クリックで対象へ向かい、着いたら起動
  if (p && p.justArrived) { p.justArrived = false; if (p.pendingObj) { const id = p.pendingObj; p.pendingObj = null; activateById(id); } }
  // 橋などの auto 遭遇：近づいたら自然に始まる
  if (app.screen === "field" && p) {
    const near = app.fieldNear;
    if (near && near.kind === "encounter" && near.auto && !(near.doneFlag && hasFlag(near.doneFlag))) {
      const d = Math.hypot(near.tx - p.x, near.ty - p.y);
      if (d < 0.85) activateById(near.id);
    }
  }

  drawField();
  refreshFieldHud();
  if (app.screen === "field") _raf = requestAnimationFrame(fieldTick);
}

function backToField() {
  game.state = STATES.FIELD;
  app.screen = "field";
  if (app.player) { app.player.target = null; app.player.pendingObj = null; app.player.keys = {}; }
  render();
  startFieldLoop();
}

// ──────────────────────────────────────────
// 汎用ナレーション（1行ずつクリックで送る）。遭遇結果・ラスト・エンディングで使う。
// ──────────────────────────────────────────
function narrate(elId, lines, opts) {
  opts = opts || {};
  game._narr = { elId: elId, lines: lines.slice(), idx: 0, fresh: opts.fresh || null, onDone: opts.onDone || null, hintId: opts.hintId || null };
  _narrShow();
}
function _narrShow() {
  const n = game._narr; if (!n) return;
  typeInto(n.elId, n.lines[n.idx], { fresh: n.fresh, onDone: () => { if (n.hintId) setHtml(n.hintId, "▶"); } });
}
function narrAdvance() {
  const n = game._narr; if (!n) return;
  if (twActive()) { twFinish(); return; }
  if (n.hintId) setHtml(n.hintId, "");
  n.idx++;
  if (n.idx < n.lines.length) { _narrShow(); return; }
  const cb = n.onDone; game._narr = null; if (cb) cb();
}

// ──────────────────────────────────────────
// フィールド：対象を起動
// ──────────────────────────────────────────
function activateById(id) {
  const obj = areaObjects().find((o) => o.id === id);
  if (!obj) return;
  if (typeof playSe === "function") playSe(obj.kind === "look" ? "look" : "select");
  const d = interactDescriptor(obj);
  switch (d.type) {
    case "look": startLook(obj); break;
    case "npc": startNpc(obj.ref, obj); break;
    case "encounter": startEnc(obj.ref); break;
    case "doneLook": startLines(obj.doneLook || ["……"]); break;
    case "exit": doExit(d.area); break;
    case "locked": startLines(obj.lockMsg || ["まだ ここからは いけない。"]); break;
    case "sign": startLines(obj.sign || ["……"]); break;
    default: break;
  }
}
function tryAction() {
  if (app.screen !== "field") return;
  const near = app.fieldNear;
  if (near) activateById(near.id);
}
function doExit(area) {
  stopFieldLoop();
  if (typeof saveGame === "function") saveGame(); // 場面転換でオートセーブ
  enterArea(area);
  render();
  startFieldLoop();
  toast(curArea().name + " へ。");
}

// ──────────────────────────────────────────
// LOOK（調べる）
// ──────────────────────────────────────────
function startLook(obj) {
  if (!obj.look) { startLines([obj.text || "……"]); return; }
  const steps = obj.look.steps;
  let prog = lookStep(obj.id);
  if (prog >= steps.length) prog = steps.length - 1;
  let step = steps[prog], advance = true;
  if (step.need && !isKnown(step.need)) { step = steps[Math.max(0, prog - 1)]; advance = false; }
  game.look = { obj: obj, step: step, advance: advance, phase: "say" };
  game.state = STATES.LOOK; app.screen = "look"; stopFieldLoop(); render();
  setHtml("look-hint", "");
  typeInto("look-body", step.say.join("\n"), { onDone: () => setHtml("look-hint", "▶") });
}
// シンプルな立て札/ロック表示（学習なし）。
function startLines(lines) {
  game.look = { obj: null, step: null, advance: false, phase: "plain" };
  game.state = STATES.LOOK; app.screen = "look"; stopFieldLoop(); render();
  setHtml("look-hint", "");
  narrate("look-body", lines, { hintId: "look-hint", onDone: () => { closeLook(); } });
}
function advanceLook() {
  if (game._narr) { narrAdvance(); return; }       // plain（立て札）系はナレーションで送る
  if (twActive()) { twFinish(); return; }
  const L = game.look; if (!L) return;
  if (L.phase === "say") {
    if (!L.advance) { closeLook(); return; }        // 条件未達で前段を見せていただけ → 閉じる
    const st = L.step;
    if (st.give) giveItem(st.give);
    let learnedId = null, kind = null;
    if (st.frag && wordLevel(st.frag) < 1) { learnFrag(st.frag); learnedId = st.frag; kind = "frag"; }
    if (st.learn && wordLevel(st.learn) < 2) { learnWord(st.learn); learnedId = st.learn; kind = "word"; }
    bumpLookStep(L.obj.id, L.obj.look.steps.length);
    if (learnedId) {
      showLearn(learnedId, kind, () => {
        if (st.after) { L.phase = "after"; typeInto("look-body", st.after.join("\n"), { fresh: learnedId, onDone: () => setHtml("look-hint", "▶") }); }
        else closeLook();
      });
      return;
    }
    if (st.give) toast("花を 1本 つんだ。");
    closeLook(); return;
  }
  if (L.phase === "after") { closeLook(); return; }
}
function closeLook() { game.look = null; game._narr = null; backToField(); }

// ──────────────────────────────────────────
// DIALOGUE（NPC会話）
// ──────────────────────────────────────────
function startNpc(npcId, obj) {
  // 母：子どもを解決済みなら ラストイベントへ分岐
  if (npcId === "mother" && hasFlag("child_solved") && !hasFlag("finale_done")) { startFinale(); return; }
  const npc = NPCS[npcId];
  if (!npc) { backToField(); return; }
  let lines = npc.lines.slice();
  if (npc.gateFlag && hasFlag(npc.gateFlag) && npc.afterGate) lines = npc.afterGate.slice();
  game.dialogue = { npcId: npcId, lines: lines, idx: 0, learn: npc.learn || null, after: npc.after || null, phase: "lines" };
  game.state = STATES.DIALOGUE; app.screen = "dialogue"; stopFieldLoop(); render();
  setHtml("dia-name", renderText(npc.name || "？？？"));
  setHtml("dia-hint", "");
  typeInto("dia-body", lines[0], { onDone: () => setHtml("dia-hint", "▶") });
}
function advanceDialogue() {
  if (twActive()) { twFinish(); return; }
  const d = game.dialogue; if (!d) return;
  if (d.phase === "lines") {
    d.idx++;
    if (d.idx < d.lines.length) { typeInto("dia-body", d.lines[d.idx], { onDone: () => setHtml("dia-hint", "▶") }); return; }
    setFlag("talked_" + d.npcId);
    if (d.learn && wordLevel(d.learn) < 2) {
      learnWord(d.learn);
      showLearn(d.learn, "word", () => {
        setHtml("dia-name", renderText(NPCS[d.npcId].name || "？？？"));
        if (d.after) { d.phase = "after"; d.idx = 0; typeInto("dia-body", d.after[0], { fresh: d.learn, onDone: () => setHtml("dia-hint", "▶") }); }
        else closeDialogue();
      });
      return;
    }
    closeDialogue(); return;
  }
  if (d.phase === "after") {
    d.idx++;
    if (d.idx < d.after.length) { typeInto("dia-body", d.after[d.idx], { fresh: d.learn, onDone: () => setHtml("dia-hint", "▶") }); return; }
    closeDialogue(); return;
  }
}
function closeDialogue() { game.dialogue = null; backToField(); }

// ──────────────────────────────────────────
// ENCOUNTER（遭遇）
// ──────────────────────────────────────────
function startEnc(encId) {
  _initAudioOnce();
  startEncounter(encId);
  stopFieldLoop();
  render(); // renderEncounterFrame が 相手の絵・セリフ・様子・選択肢 を描く
  narrate("enc-say", encOpenLines(), { hintId: "enc-hint", onDone: () => setHtml("enc-hint", "") });
}
function onEncAction(actionId) {
  if (twActive()) twFinish();   // 表示中のタイプは即完了
  game._narr = null;            // 導入ナレーションは「行動」で打ち切る（ボタンはすぐ効く）
  const enc = game.enc; if (!enc || enc.done) return;
  const res = encChoose(actionId);
  if (!res) return;
  if (res.se && typeof playSe === "function") playSe(res.se);
  // 選んだ結果の文 → 相手セリフ/様子/選択肢を更新 → 習得ポップ → 自動習得 → 決着
  typeInto("enc-say", res.say.join("\n"), {
    fresh: res.fresh,
    onDone: () => {
      renderEncounterFrame();
      if (res.learn) showLearn(res.learn.id, res.learn.kind, () => { renderEncounterFrame(); _afterEncBeat(res); });
      else _afterEncBeat(res);
    },
  });
}
function _afterEncBeat(res) {
  if (res.autoLearn) {
    typeInto("enc-say", res.autoLearn.say.join("\n"), {
      fresh: res.autoLearn.id,
      onDone: () => {
        renderEncounterFrame();
        showLearn(res.autoLearn.id, "word", () => { renderEncounterFrame(); _maybeResolve(res); });
      },
    });
    return;
  }
  _maybeResolve(res);
}
function _maybeResolve(res) {
  renderEncounterFrame();
  if (res.resolved) encFinish(res.resolved);
}
function encFinish(kind) {
  const r = encResolve(kind);
  setHtml("enc-actions", "");
  if (typeof playSe === "function") playSe(kind === "success" ? "success" : "fail");
  narrate("enc-say", r.text, {
    hintId: "enc-hint",
    onDone: () => { _popupGained(r.gained, () => onEncResolvedDone(kind)); },
  });
}
function _popupGained(ids, done) {
  if (!ids || !ids.length) { done(); return; }
  let i = 0;
  const step = () => { if (i >= ids.length) { done(); return; } showLearn(ids[i++], "word", step); };
  step();
}
function onEncResolvedDone(kind) {
  const area = curArea();
  game.enc = null; game._narr = null;
  backToField();
  if (typeof saveGame === "function") saveGame();
  if (area && area.id === "hashi") toast("ことばが 届いた。村への 道が ひらけた。");
  else if (area && area.id === "mura") toast("その子を、お母さんの ところへ。");
}

// ──────────────────────────────────────────
// FINALE（母と再会 → 友達）
// ──────────────────────────────────────────
function startFinale() {
  game.finale = {}; game._narr = null;
  game.state = STATES.FINALE; app.screen = "finale"; stopFieldLoop();
  setHtml("ov-finale",
    '<div class="fin-card">' +
      '<canvas id="fin-portrait" class="fin-portrait" width="132" height="132" aria-hidden="true"></canvas>' +
      '<div id="fin-body" class="fin-body"></div>' +
      '<div id="fin-prompt" class="fin-prompt"></div>' +
      '<div id="fin-choices" class="fin-choices"></div>' +
      '<div id="fin-hint" class="fin-hint"></div>' +
    '</div>');
  render();
  drawPortrait("fin-portrait", "mother");
  const seq = FINALE.open.concat([FINALE.motherLine, FINALE.childLine, FINALE.childWhisper]);
  narrate("fin-body", seq, { hintId: "fin-hint", onDone: _showFinaleChoices });
}
function _showFinaleChoices() {
  setHtml("fin-hint", "");
  setHtml("fin-prompt", renderText(FINALE.prompt));
  let html = "";
  FINALE.choices.forEach((c) => {
    html += '<button class="enc-btn" data-finchoice="' + c.id + '"><span class="lb">' + c.label + "</span></button>";
  });
  setHtml("fin-choices", html);
}
function onFinChoice(id) {
  const c = FINALE.choices.find((x) => x.id === id);
  if (!c) return;
  setHtml("fin-choices", ""); setHtml("fin-prompt", "");
  if (typeof playSe === "function") playSe("select");
  if (c.retry) { narrate("fin-body", c.say, { hintId: "fin-hint", onDone: _showFinaleChoices }); return; }
  narrate("fin-body", c.say, {
    hintId: "fin-hint",
    onDone: () => {
      learnWord("tomodachi");
      showLearn("tomodachi", "word", () => {
        drawPortrait("fin-portrait", "mother");
        narrate("fin-body", [FINALE.motherAfter].concat(FINALE.afterLearn), {
          fresh: "tomodachi", hintId: "fin-hint",
          onDone: () => { setFlag("finale_done"); startEnding(); },
        });
      });
    },
  });
}

// ──────────────────────────────────────────
// ENDING
// ──────────────────────────────────────────
function startEnding() {
  game.state = STATES.ENDING; app.screen = "ending"; stopFieldLoop();
  if (typeof saveGame === "function") saveGame();
  render();
  renderEndingShell();
  const words = ENDING.montage.filter((id) => isKnown(id));
  let i = 0;
  const gap = _reduce() ? 130 : 470;
  const step = () => {
    if (i < words.length) { endingAddWord(words[i]); i++; setTimeout(step, gap); }
    else {
      typeInto("end-text", ENDING.lines.concat(ENDING.closing).join("\n"), {
        onDone: () => { if (typeof playSe === "function") playSe("success"); endingShowTitlecard(); },
      });
    }
  };
  setTimeout(step, 500);
}

// ──────────────────────────────────────────
// ポーズ・セーブ・言葉一覧
// ──────────────────────────────────────────
function openPause() {
  if (app.screen !== "field") return;
  stopFieldLoop();
  app.prevScreen = "field";
  app.screen = "pause"; render();
}
function resumePause() { app.screen = "field"; render(); startFieldLoop(); }
function doSave() { const ok = (typeof saveGame === "function") && saveGame(); toast(ok ? "セーブした。" : "セーブできなかった。"); }
function openVocab() { app.prevScreen = app.screen; app.screen = "vocab"; render(); }
function closeVocab() {
  const back = app.prevScreen || "field";
  app.screen = back; render();
  if (back === "field") startFieldLoop();
}

// ──────────────────────────────────────────
// 入力配線
// ──────────────────────────────────────────
function handleAction(action) {
  switch (action) {
    case "start": startGame(); break;
    case "continue": continueGame(); break;
    case "mute":
      if (typeof toggleMute === "function") { const m = toggleMute(); toast(m ? "音を けした。" : "音を つけた。"); }
      render(); break;
    case "again": startGame(); break;
    case "title": toTitle(); break;
    case "resume": resumePause(); break;
    case "save": doSave(); break;
    case "openVocab": openVocab(); break;
    case "closeVocab": closeVocab(); break;
    default: break;
  }
}

function _canvasClick(e) {
  const c = document.getElementById("field-canvas");
  if (!c) return;
  const rect = c.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const cx = (e.clientX - rect.left) * (c.width / rect.width);
  const cy = (e.clientY - rect.top) * (c.height / rect.height);
  fieldHandleClick(cx, cy);
}

function wireEvents() {
  document.addEventListener("click", (e) => {
    _initAudioOnce();
    if (e.target.closest("#menu-btn")) { openPause(); return; }
    const act = e.target.closest("[data-action]");
    if (act) { if (!act.hasAttribute("disabled")) handleAction(act.getAttribute("data-action")); return; }
    const enc = e.target.closest("[data-encact]");
    if (enc) { onEncAction(enc.getAttribute("data-encact")); return; }
    const fin = e.target.closest("[data-finchoice]");
    if (fin) { onFinChoice(fin.getAttribute("data-finchoice")); return; }

    if (app.screen === "field" && e.target.closest("#field-canvas")) { _canvasClick(e); return; }
    if (app.screen === "look" && e.target.closest("#ov-look")) { advanceLook(); return; }
    if (app.screen === "dialogue" && e.target.closest("#ov-dialogue")) { advanceDialogue(); return; }
    if (app.screen === "encounter" && e.target.closest("#ov-encounter")) {
      if (twActive()) { twFinish(); return; }
      if (game._narr) { narrAdvance(); }
      return;
    }
    if (app.screen === "finale" && e.target.closest("#ov-finale")) {
      if (game._narr) narrAdvance(); return;
    }
    if (app.screen === "ending" && e.target.closest("#end-text")) {
      if (twActive()) twFinish(); return;
    }
  });

  // キーボード
  document.addEventListener("keydown", (e) => {
    const k = e.key;
    if (app.screen === "field") {
      const p = app.player; if (!p) return;
      if (k === "ArrowLeft" || k === "a" || k === "A") { p.keys.left = true; _keysHeld.left = true; e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { p.keys.right = true; e.preventDefault(); }
      else if (k === "ArrowUp" || k === "w" || k === "W") { p.keys.up = true; e.preventDefault(); }
      else if (k === "ArrowDown" || k === "s" || k === "S") { p.keys.down = true; e.preventDefault(); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); tryAction(); }
      else if (k === "Escape") { openPause(); }
      return;
    }
    if (k === "Enter" || k === " ") {
      if (app.screen === "look") { e.preventDefault(); advanceLook(); }
      else if (app.screen === "dialogue") { e.preventDefault(); advanceDialogue(); }
      else if (app.screen === "encounter") { e.preventDefault(); if (twActive()) twFinish(); else if (game._narr) narrAdvance(); }
      else if (app.screen === "finale") { e.preventDefault(); if (game._narr) narrAdvance(); }
      else if (app.screen === "ending") { e.preventDefault(); if (twActive()) twFinish(); }
      return;
    }
    if (k === "Escape") {
      if (app.screen === "pause") resumePause();
      else if (app.screen === "vocab") closeVocab();
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!app.player) return;
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") app.player.keys.left = false;
    else if (k === "ArrowRight" || k === "d" || k === "D") app.player.keys.right = false;
    else if (k === "ArrowUp" || k === "w" || k === "W") app.player.keys.up = false;
    else if (k === "ArrowDown" || k === "s" || k === "S") app.player.keys.down = false;
  });

  // タブが背面に行ったら歩行ループは自然に止まる（rAF が呼ばれない）。復帰時 dt 抑制は fieldUpdate 側。
}

// 起動
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.main = main;
  window.startGame = startGame;
  window.continueGame = continueGame;
  window.toTitle = toTitle;
  window.narrate = narrate;
  window.activateById = activateById;
}
