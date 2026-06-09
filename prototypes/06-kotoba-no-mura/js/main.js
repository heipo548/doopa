/*
 * main.js — 配線とイベントループ（DOM 依存）。各モジュールを“つなぐ”だけ。
 *
 * 画面の流れ：
 *   TITLE →(はじめる)→ FIELD(村) →(人)→ DIALOGUE / →(調べる)→ LOOK / →(言い争い)→ ARGUE
 *         →(左)→ もり →(ぬし)→ ARGUE →(もどる)→ 村 →(うた)→ かず →(上)→ ほこら
 *         →(かぞえうた)→ 審判（あなたの実挙動を読み上げ）→ なづけ → ENDING（トーンで分岐）
 *   ☰/Esc で PAUSE。失敗してもゲームオーバーにはしない。
 *
 * ★ メタ計測フック：
 *   ・どのクリックも metaNoteClick / 空き地クリックは metaNoteVoid
 *   ・タイプ中に送ったら metaNoteSkip（読み飛ばし）/ 出きってから送ったら metaNoteRead
 *   ・window の blur/focus で metaNoteBlur/Focus（よそ見）
 *
 * ※ DOM 依存。末尾で window へ明示エクスポート。
 */

let _audioReady = false, _raf = null, _lastTs = null;

function _initAudioOnce() { if (_audioReady) return; _audioReady = true; if (typeof initAudio === "function") initAudio(); }
function _reduceMain() { return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
function setHtml(id, h) { const e = (typeof document !== "undefined") ? document.getElementById(id) : null; if (e) e.innerHTML = h; }

// ──────────────────────────────────────────
// 起動
// ──────────────────────────────────────────
function main() {
  newGame();
  if (typeof metaReset === "function") metaReset();
  app.screen = "title";
  render();
  wireEvents();
}

function startGame() {
  _initAudioOnce();
  newGame();
  if (typeof metaReset === "function") metaReset();
  game.startedAt = Date.now();
  enterArea(PLAYER_INIT.spawnArea || "mura");
  render();
  if (typeof startBgm === "function") startBgm();
  startFieldLoop();
}
function continueGame() {
  _initAudioOnce();
  if (!(typeof loadGame === "function") || !loadGame()) { toast("セーブが ありません。"); return; }
  if (typeof metaReset === "function") metaReset();   // メタは“このプレイ”の記録なので数えなおす
  enterArea(game.currentArea || "mura", { fromSave: true });
  render();
  if (typeof startBgm === "function") startBgm();
  startFieldLoop();
  toast("つづきから さいかいした。");
}
function toTitle() {
  stopFieldLoop();
  if (typeof stopBgm === "function") stopBgm();
  if (game) game._narr = null;
  newGame();
  app.screen = "title";
  render();
}

// ──────────────────────────────────────────
// フィールドのループ（rAF）
// ──────────────────────────────────────────
function startFieldLoop() { stopFieldLoop(); _lastTs = null; if (typeof requestAnimationFrame === "function") _raf = requestAnimationFrame(fieldTick); }
function stopFieldLoop() {
  if (_raf && typeof cancelAnimationFrame === "function") { try { cancelAnimationFrame(_raf); } catch (e) {} }
  _raf = null;
  if (app.player) app.player.keys = {};
}
function fieldTick(ts) {
  if (app.screen !== "field") { _raf = null; return; }
  const dt = _lastTs ? (ts - _lastTs) / 1000 : 0.016;
  _lastTs = ts;
  fieldUpdate(dt);
  const p = app.player;
  if (p && p.justArrived) { p.justArrived = false; if (p.pendingObj) { const id = p.pendingObj; p.pendingObj = null; activateById(id); } }
  drawField();
  refreshFieldHud();
  if (app.screen === "field" && typeof requestAnimationFrame === "function") _raf = requestAnimationFrame(fieldTick);
}
function backToField() {
  game.state = STATES.FIELD; app.screen = "field";
  if (app.player) { app.player.target = null; app.player.pendingObj = null; app.player.keys = {}; }
  render();
  startFieldLoop();
}

// ──────────────────────────────────────────
// 汎用ナレーション（1行ずつクリックで送る）
// ──────────────────────────────────────────
function narrate(elId, lines, opts) {
  opts = opts || {};
  game._narr = { elId: elId, lines: lines.slice(), idx: 0, fresh: opts.fresh || null, onDone: opts.onDone || null, hintId: opts.hintId || null, speaker: opts.speaker || null };
  _narrShow();
}
function _narrShow() {
  const n = game._narr; if (!n) return;
  if (n.hintId) setHtml(n.hintId, "");
  typeInto(n.elId, n.lines[n.idx], { fresh: n.fresh, speaker: n.speaker, onDone: () => { if (n.hintId) setHtml(n.hintId, "▶"); } });
}
function narrAdvance() {
  const n = game._narr; if (!n) return;
  if (twActive()) { if (typeof metaNoteSkip === "function") metaNoteSkip(); twFinish(); return; }
  if (typeof metaNoteRead === "function") metaNoteRead();
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
    case "sign": startLines(obj.sign || ["……"]); break;
    case "npc": startNpc(obj.ref, obj); break;
    case "argue": startArg(obj.ref, obj); break;
    case "doneLook": startLines(obj.doneLook || ["……"]); break;
    case "exit": doExit(d.area); break;
    case "locked": startLines(obj.lockMsg || ["まだ ここからは いけない。"]); break;
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
  if (typeof saveGame === "function") saveGame();
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
function startLines(lines) {
  game.look = { obj: null, step: null, advance: false, phase: "plain" };
  game.state = STATES.LOOK; app.screen = "look"; stopFieldLoop(); render();
  setHtml("look-hint", "");
  narrate("look-body", lines, { hintId: "look-hint", onDone: () => { closeLook(); } });
}
function advanceLook() {
  if (game._narr) { narrAdvance(); return; }                  // plain（立て札）系
  if (twActive()) { if (typeof metaNoteSkip === "function") metaNoteSkip(); twFinish(); return; }
  if (typeof metaNoteRead === "function") metaNoteRead();
  const L = game.look; if (!L) return;
  if (L.phase === "say") {
    if (!L.advance) { closeLook(); return; }                  // 条件未達で前段を見せていただけ
    const st = L.step;
    if (st.give) giveItem(st.give);
    let learnedId = null;
    if (st.learn && !isKnown(st.learn)) { learnWord(st.learn); learnedId = st.learn; }
    bumpLookStep(L.obj.id, L.obj.look.steps.length);
    if (learnedId) {
      showLearn(learnedId, "word", () => {
        if (st.after) { L.phase = "after"; typeInto("look-body", st.after.join("\n"), { fresh: learnedId, onDone: () => setHtml("look-hint", "▶") }); }
        else closeLook();
      });
      return;
    }
    if (st.give) toast("はなを 1ぽん つんだ。");
    closeLook(); return;
  }
  if (L.phase === "after") { closeLook(); return; }
}
function closeLook() { game.look = null; game._narr = null; backToField(); }

// ──────────────────────────────────────────
// DIALOGUE（NPC会話）
// ──────────────────────────────────────────
function startNpc(npcId, obj) {
  const npc = NPCS[npcId];
  if (!npc) { backToField(); return; }
  let lines = npc.lines.slice();
  if (npc.gateFlag && hasFlag(npc.gateFlag) && npc.afterGate) lines = npc.afterGate.slice();
  game.dialogue = { npcId: npcId, lines: lines, idx: 0, learn: npc.learn || null, after: npc.after || null, gateFlag: npc.gateFlag || null, phase: "lines", gated: !!(npc.gateFlag && hasFlag(npc.gateFlag)) };
  game.state = STATES.DIALOGUE; app.screen = "dialogue"; stopFieldLoop(); render();
  setHtml("dia-name", renderText(npc.name || "？？？"));
  setHtml("dia-hint", "");
  typeInto("dia-body", lines[0], { speaker: npcId, onDone: () => setHtml("dia-hint", "▶") });
}
function advanceDialogue() {
  if (twActive()) { if (typeof metaNoteSkip === "function") metaNoteSkip(); twFinish(); return; }
  if (typeof metaNoteRead === "function") metaNoteRead();
  const d = game.dialogue; if (!d) return;
  if (d.phase === "lines") {
    d.idx++;
    if (d.idx < d.lines.length) { typeInto("dia-body", d.lines[d.idx], { speaker: d.npcId, onDone: () => setHtml("dia-hint", "▶") }); return; }
    setFlag("talked_" + d.npcId);
    // 初回かつ未習得なら覚える → after → ゲートを立てる（uta は uta_done＝ほこら解錠）
    if (!d.gated && d.learn && !isKnown(d.learn)) {
      learnWord(d.learn);
      showLearn(d.learn, "word", () => {
        setHtml("dia-name", renderText(NPCS[d.npcId].name || "？？？"));
        if (d.after) { d.phase = "after"; d.idx = 0; typeInto("dia-body", d.after[0], { fresh: d.learn, speaker: d.npcId, onDone: () => setHtml("dia-hint", "▶") }); }
        else closeDialogue();
      });
      return;
    }
    closeDialogue(); return;
  }
  if (d.phase === "after") {
    d.idx++;
    if (d.idx < d.after.length) { typeInto("dia-body", d.after[d.idx], { fresh: d.learn, speaker: d.npcId, onDone: () => setHtml("dia-hint", "▶") }); return; }
    closeDialogue(); return;
  }
}
function closeDialogue() {
  const d = game.dialogue;
  if (d && d.gateFlag) setFlag(d.gateFlag);           // moko/ton は talked_*、uta は uta_done を立てる
  game.dialogue = null;
  backToField();
  if (typeof saveGame === "function") saveGame();
}

// ──────────────────────────────────────────
// ARGUE（言い争い）。watcher は審判として別演出。
// ──────────────────────────────────────────
function startArg(argueId, obj) {
  if (argueId === "watcher") { startWatcher(obj); return; }
  _initAudioOnce();
  startArgue(argueId, { doneFlag: obj ? obj.doneFlag : null });
  stopFieldLoop();
  renderArgueShell(); render(); renderArgueFrame();
  setHtml("arg-actions", "");
  narrate("arg-say", argueOpenLines(), { hintId: "arg-hint", speaker: ARGUES[argueId].portrait, onDone: () => { renderArgueFrame(); } });
}
function onArgAction(actionId) {
  if (twActive()) { if (typeof metaNoteSkip === "function") metaNoteSkip(); twFinish(); }
  game._narr = null; // 導入ナレーションは行動で打ち切る
  const a = game.argue; if (!a || a.done) return;
  const res = argueChoose(actionId); if (!res) return;
  if (res.se && typeof playSe === "function") playSe(res.se);
  setHtml("arg-actions", "");
  typeInto("arg-say", res.say.join("\n"), {
    speaker: a.def.portrait, fresh: res.fresh,
    onDone: () => {
      renderArgueFrame();
      if (res.learn) {
        showLearn(res.learn.id, res.learn.kind, () => {
          renderArgueFrame();
          if (res.learnSay && res.learnSay.length) typeInto("arg-say", res.learnSay.join("\n"), { speaker: a.def.portrait, fresh: res.learn.id, onDone: () => { renderArgueFrame(); _argMaybeResolve(res); } });
          else _argMaybeResolve(res);
        });
        return;
      }
      _argMaybeResolve(res);
    },
  });
}
function _argMaybeResolve(res) { renderArgueFrame(); if (res.resolved) argFinish(res.resolved); }
function argFinish(kind) {
  const a = game.argue;
  if (typeof playSe === "function") playSe(kind === "warm" ? "success" : "fail");
  setHtml("arg-actions", "");
  const r = argueResolve(kind);
  narrate("arg-say", r.text, {
    hintId: "arg-hint", speaker: a.def.portrait,
    onDone: () => { _popupGained(r.gained, () => {
      if (r.gainedSay) narrate("arg-say", r.gainedSay, { hintId: "arg-hint", speaker: a.def.portrait, onDone: () => _argDone(r) });
      else _argDone(r);
    }); },
  });
}
function _argDone(r) {
  game.argue = null; game._narr = null;
  backToField();
  if (typeof saveGame === "function") saveGame();
  if (r && r.toast) toast(r.toast);
}
function _popupGained(ids, done) {
  if (!ids || !ids.length) { done(); return; }
  let i = 0; const step = () => { if (i >= ids.length) { done(); return; } showLearn(ids[i++], "word", step); }; step();
}

// ──────────────────────────────────────────
// かぞえうた（審判）＝ほこらの特別演出
// ──────────────────────────────────────────
function startWatcher(obj) {
  _initAudioOnce();
  if (typeof silence === "function") silence(); // 無音
  game.argue = { id: "watcher", def: ARGUES.watcher, done: false, doneFlag: (obj && obj.doneFlag) || "watcher_done" };
  game.state = STATES.ARGUE; app.screen = "argue"; stopFieldLoop();
  renderArgueShell(); render();
  if (typeof drawPortrait === "function") drawPortrait("arg-portrait", "watcher");
  setHtml("arg-speaker", renderText(ARGUES.watcher.speaker));
  setHtml("arg-mood", "しずかだ。 おとが、ひとつも ない。");
  setHtml("arg-actions", "");
  narrate("arg-say", ARGUES.watcher.open, { hintId: "arg-hint", speaker: "watcher", onDone: _watcherReveal });
}
function _watcherReveal() {
  if (typeof playSe === "function") playSe("reveal");
  learnWord("miteru");
  showLearn("miteru", "word", () => {
    if (typeof drawPortrait === "function") drawPortrait("arg-portrait", "watcher");
    narrate("arg-say", ARGUES.watcher.learnWatchSay, { hintId: "arg-hint", speaker: "watcher", fresh: "miteru", onDone: _watcherVerdict });
  });
}
function _watcherVerdict() {
  const lines = VERDICT.intro.concat((typeof metaVerdict === "function") ? metaVerdict() : []);
  narrate("arg-say", lines, { hintId: "arg-hint", speaker: "watcher", onDone: _watcherName });
}
function _watcherName() {
  narrate("arg-say", VERDICT.toName, {
    hintId: "arg-hint", speaker: "watcher",
    onDone: () => {
      setHtml("arg-hint", "");
      let html = "";
      NAME_CHOICES.forEach((c) => { html += '<button class="arg-btn say" data-namechoice="' + c.id + '">' + escapeHtml(c.label) + "</button>"; });
      setHtml("arg-actions", html);
    },
  });
}
function onNameChoice(id) {
  const c = NAME_CHOICES.find((x) => x.id === id); if (!c) return;
  setHtml("arg-actions", "");
  if (typeof playSe === "function") playSe("name");
  if (c.word) { learnWord(c.word); game.name = (WORDS[c.word] ? WORDS[c.word].text : c.label); }
  else game.name = null;
  const finish = () => narrate("arg-say", c.say, { hintId: "arg-hint", speaker: "watcher", fresh: c.word || null, onDone: () => { setFlag("watcher_done"); startEnding(); } });
  if (c.word) showLearn(c.word, "word", finish);
  else finish();
}

// ──────────────────────────────────────────
// ENDING（トーンで分岐）
// ──────────────────────────────────────────
function startEnding() {
  game.state = STATES.ENDING; app.screen = "ending"; stopFieldLoop();
  if (typeof stopBgm === "function") stopBgm();
  if (typeof saveGame === "function") saveGame();
  const kind = (typeof endingKind === "function") ? endingKind() : "dim";
  game.ending = kind;
  render(); renderEndingShell();
  setHtml("end-text", renderText(ENDING.montageIntro[0]));
  const words = (typeof knownWords === "function") ? knownWords() : [];
  let i = 0; const gap = _reduceMain() ? 30 : 280;
  const step = () => {
    if (i < words.length) { endingAddWord(words[i]); i++; setTimeout(step, gap); }
    else {
      const lines = (ENDING[kind] ? ENDING[kind].lines : []).concat(ENDING.closing);
      typeInto("end-text", lines.join("\n"), { onDone: () => { if (typeof playSe === "function") playSe("success"); endingShowTitlecard(kind); } });
    }
  };
  setTimeout(step, _reduceMain() ? 20 : 480);
}

// ──────────────────────────────────────────
// ポーズ・セーブ・図鑑
// ──────────────────────────────────────────
function openPause() { if (app.screen !== "field") return; stopFieldLoop(); app.prevScreen = "field"; app.screen = "pause"; render(); }
function resumePause() { app.screen = "field"; render(); startFieldLoop(); }
function doSave() { const ok = (typeof saveGame === "function") && saveGame(); toast(ok ? "セーブした。" : "セーブできなかった。"); }
function openVocab() { app.prevScreen = app.screen; app.screen = "vocab"; render(); }
function closeVocab() {
  const back = app.prevScreen || "field";
  app.screen = (back === "vocab") ? "field" : back; render();
  if (app.screen === "field") startFieldLoop();
}

// ──────────────────────────────────────────
// 入力配線
// ──────────────────────────────────────────
function handleAction(action) {
  switch (action) {
    case "start": startGame(); break;
    case "continue": continueGame(); break;
    case "again": startGame(); break;
    case "title": toTitle(); break;
    case "resume": resumePause(); break;
    case "save": doSave(); break;
    case "openVocab": openVocab(); break;
    case "closeVocab": closeVocab(); break;
    case "mute": if (typeof toggleMute === "function") { const m = toggleMute(); toast(m ? "おとを けした。" : "おとを つけた。"); } render(); break;
    default: break;
  }
}

function _canvasClick(e) {
  const c = document.getElementById("field-canvas"); if (!c) return;
  const rect = c.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const cx = (e.clientX - rect.left) * (c.width / rect.width);
  const cy = (e.clientY - rect.top) * (c.height / rect.height);
  const hit = fieldHandleClick(cx, cy);
  if (!hit && typeof metaNoteVoid === "function") metaNoteVoid(); // 空き地クリック＝手持ち無沙汰の くせ
}

function wireEvents() {
  if (typeof document === "undefined") return;

  document.addEventListener("click", (e) => {
    _initAudioOnce();
    if (typeof metaNoteClick === "function") metaNoteClick();
    if (e.target.closest && e.target.closest("#menu-btn")) { openPause(); return; }
    if (e.target.closest && e.target.closest("#vocab-badge")) { openVocab(); return; }
    const act = e.target.closest && e.target.closest("[data-action]");
    if (act) { if (!act.hasAttribute("disabled")) handleAction(act.getAttribute("data-action")); return; }
    const arg = e.target.closest && e.target.closest("[data-argact]");
    if (arg) { onArgAction(arg.getAttribute("data-argact")); return; }
    const nm = e.target.closest && e.target.closest("[data-namechoice]");
    if (nm) { onNameChoice(nm.getAttribute("data-namechoice")); return; }

    if (app.screen === "field" && e.target.closest && e.target.closest("#field-canvas")) { _canvasClick(e); return; }
    if (app.screen === "look" && e.target.closest && e.target.closest("#ov-look")) { advanceLook(); return; }
    if (app.screen === "dialogue" && e.target.closest && e.target.closest("#ov-dialogue")) { advanceDialogue(); return; }
    if (app.screen === "argue" && e.target.closest && e.target.closest("#ov-argue")) { if (game._narr) narrAdvance(); return; }
    if (app.screen === "ending" && e.target.closest && e.target.closest("#end-text")) { if (twActive()) { twFinish(); } return; }
  });

  document.addEventListener("keydown", (e) => {
    if (typeof metaNoteInput === "function") metaNoteInput();
    const k = e.key;
    if (app.screen === "field") {
      const p = app.player; if (!p) return;
      if (k === "ArrowLeft" || k === "a" || k === "A") { p.keys.left = true; e.preventDefault(); }
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
      else if (app.screen === "argue") { e.preventDefault(); if (game._narr) narrAdvance(); }
      else if (app.screen === "ending") { e.preventDefault(); if (twActive()) twFinish(); }
      else if (app.screen === "title") { e.preventDefault(); startGame(); }
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

  // よそ見（タブ/ウィンドウの 出入り）。神的存在は ぜんぶ 数えている。
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("blur", () => { if (typeof metaNoteBlur === "function") metaNoteBlur(); });
    window.addEventListener("focus", () => { if (typeof metaNoteFocus === "function") metaNoteFocus(); });
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { if (typeof metaNoteBlur === "function") metaNoteBlur(); }
        else { if (typeof metaNoteFocus === "function") metaNoteFocus(); }
      });
    }
  }
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
  window.narrAdvance = narrAdvance;
  window.activateById = activateById;
  window.advanceLook = advanceLook;
  window.advanceDialogue = advanceDialogue;
  window.onArgAction = onArgAction;
  window.onNameChoice = onNameChoice;
  window.startEnding = startEnding;
  window.openPause = openPause;
  window.openVocab = openVocab;
}
