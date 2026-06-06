/*
 * main.js — 配線とイベントループ（DOM 依存）
 *
 * 役割：起動 → タイトル描画。クリック/カーソル/キーの入力を受け、ステート遷移を指揮する。
 *   ・実際の処理は state/battle/cards/field/save/ui に委譲（main は“つなぐ”だけ）。
 *   ・入力はイベント委譲（data-action / data-node）で拾い、計測（metrics）もここで起動する。
 *
 * 画面の流れ（MVP 単一ループ）：
 *   TITLE →(はじめる)→ FIELD(村) →(NPC)→ DIALOGUE →(終)→ CARDS(3択) →(選ぶ)→ FIELD
 *        →(かどっこ)→ BATTLE →(勝つ)→ RESULT →(タイトルへ)→ TITLE
 *   ※ hp0 は GAMEOVER（非パーマデス：セーブから再開）。☰/Esc で PAUSE。
 *
 * ※ DOM 依存。末尾で window へ明示エクスポート。
 */

let _audioReady = false;
let _lastPointer = null;

function _clamp01(v) { return Math.max(0, Math.min(1, v)); }
function _prefersReduce() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function _initAudioOnce() {
  if (_audioReady) return;
  _audioReady = true;
  if (typeof initAudio === "function") initAudio();
}

// ──────────────────────────────────────────
// 起動
// ──────────────────────────────────────────
function main() {
  newGame();
  app.screen = "title";
  render();
  wireEvents();
}

// ──────────────────────────────────────────
// 遷移
// ──────────────────────────────────────────
function startGame() {
  _initAudioOnce();
  newGame();
  startMetrics();                 // 新規プレイ＝計測開始（ロード時は呼ばない）
  app.player = { x: 0.5, y: 0.86, tx: 0.5, ty: 0.86, pendingNode: null };
  enterArea("mura");              // state=FIELD / screen=field
  render();
  positionAvatar(app.player.x, app.player.y);
  startFieldLoop();
}

function continueGame() {
  _initAudioOnce();
  if (!(typeof loadGame === "function") || !loadGame()) {
    toast("セーブが ありません。");
    return;
  }
  // ロード後は metrics を復元済み（startMetrics は呼ばない＝“癖”が途切れない）。
  app.player = { x: 0.5, y: 0.86, tx: 0.5, ty: 0.86, pendingNode: null };
  enterArea(game.currentArea || "mura");
  render();
  positionAvatar(app.player.x, app.player.y);
  startFieldLoop();
  toast("つづきから 再開した。");
}

function toTitle() {
  if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
  newGame();
  app.screen = "title";
  render();
}

function backToField() {
  if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
  game.state = STATES.FIELD;
  app.screen = "field";
  app.player.tx = app.player.x; // その場で止める
  app.player.ty = app.player.y;
  app.player.pendingNode = null;
  render();
  positionAvatar(app.player.x, app.player.y);
  startFieldLoop();
}

// ── フィールドの歩行ループ（rAF） ──
function startFieldLoop() {
  if (app._raf) cancelAnimationFrame(app._raf);
  const tick = () => {
    if (app.screen !== "field") { app._raf = null; return; }
    const p = app.player;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = _prefersReduce() ? 1 : 0.035; // reduced-motion は瞬間移動
    if (dist > 0.006) {
      const step = Math.min(speed, dist);
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    } else {
      p.x = p.tx; p.y = p.ty;
      if (p.pendingNode) { const n = p.pendingNode; p.pendingNode = null; fieldInteract(n); return; }
    }
    positionAvatar(p.x, p.y);
    highlightNear(nearestNode(p.x, p.y, 0.13));
    app._raf = requestAnimationFrame(tick);
  };
  app._raf = requestAnimationFrame(tick);
}

// ノードに到達したときの行動
function fieldInteract(node) {
  const act = interact(node);
  switch (act.type) {
    case "dialogue": startDialogue(act.npcId); break;
    case "battle": enterBattle(act.enemyId); break;
    case "save": doSave(); break;
    case "sign": toast(act.text); break;
    case "locked": toast(act.msg); break;
    case "exit": finishGame(); break;
    default: break;
  }
}

// ── 会話 ──
function startDialogue(npcId) {
  const npc = NPCS[npcId];
  if (!npc) return;
  const lines = npc.lines.slice();
  if (npc.gives && npc.offerPrompt) lines.push(npc.offerPrompt); // 最後に「どの言葉を…?」
  game.dialogue = { npcId: npcId, idx: 0, lines: lines };
  game.state = STATES.DIALOGUE;
  app.screen = "dialogue";
  render();
  showDialogueLine();
}
function showDialogueLine() {
  const d = game.dialogue;
  if (!d) return;
  const body = document.querySelector("#overlay-dialogue .dia-body");
  typewriter(body, d.lines[d.idx]);
}
function advanceDialogue() {
  const d = game.dialogue;
  if (!d) return;
  if (twActive()) {                         // タイプ途中でクリック＝スキップ（読み飛ばし）
    twFinish();
    if (typeof textAdvanced === "function") textAdvanced({ skipped: true });
    return;
  }
  if (typeof textAdvanced === "function") textAdvanced({ skipped: false });
  d.idx++;
  if (d.idx < d.lines.length) { showDialogueLine(); return; }
  // 会話おわり
  const npcId = d.npcId;
  const npc = NPCS[npcId];
  setFlag("talked_" + npcId);
  game.dialogue = null;
  if (npc.gives) { offerCards(npcId); render(); } // → 3択
  else { backToField(); }
}

// ── カード3択 ──
function onPick(wordId) {
  const r = chooseCard(wordId);
  if (!r) return;
  if (typeof playSe === "function") playSe("pick");
  const w = WORDS[wordId];
  toast(r === "leveled" ? ("「" + w.levels[0] + "」が そだった！") : ("「" + w.levels[0] + "」を ひろった！"));
  backToField();
}

// ── バトル ──
function enterBattle(enemyId) {
  if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
  startBattle(enemyId);   // state=BATTLE / screen=battle
  render();
}
function onCard(wordId) {
  if (!game.battle || isBattleOver()) return;
  playerCard(wordId);     // 勝てば winBattle が screen=result、死ねば onGameOver が screen=gameover
  render();
}

// ── セーブ ──
function doSave() {
  const ok = (typeof saveGame === "function") && saveGame();
  toast(ok ? "セーブした（ことばの泉）。" : "セーブできなかった。");
}

// ── ポーズ ──
function openPause() {
  if (app.screen !== "field" && app.screen !== "battle") return;
  if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
  app.prevScreen = app.screen;
  app.screen = "pause";
  render();
}
function resumePause() {
  const back = app.prevScreen || "field";
  app.screen = back;
  render();
  if (back === "field") { positionAvatar(app.player.x, app.player.y); startFieldLoop(); }
}

// ── 結果 → タイトルへ閉じる ──
function finishGame() {
  if (app._raf) { cancelAnimationFrame(app._raf); app._raf = null; }
  if (typeof determineEnding === "function") determineEnding();
  game.state = STATES.RESULT;
  app.screen = "result";
  render();
}

// ──────────────────────────────────────────
// 入力配線
// ──────────────────────────────────────────
function handleAction(action, elm) {
  switch (action) {
    case "start": startGame(); break;
    case "continue": continueGame(); break;
    case "mute":
      if (typeof toggleMute === "function") { const m = toggleMute(); toast(m ? "音を けした。" : "音を つけた。"); }
      render();
      break;
    case "pick": onPick(elm.getAttribute("data-word")); break;
    case "card": onCard(elm.getAttribute("data-word")); break;
    case "again": startGame(); break;
    case "title": toTitle(); break;
    case "load": continueGame(); break;
    case "resume": resumePause(); break;
    case "save": doSave(); break;
    default: break;
  }
}

function wireEvents() {
  // クリック（計測＋イベント委譲）
  document.addEventListener("click", (e) => {
    if (typeof noteClick === "function") noteClick();
    _initAudioOnce();

    if (e.target.closest("#menu-btn")) { openPause(); return; }

    const actEl = e.target.closest("[data-action]");
    if (actEl) { handleAction(actEl.getAttribute("data-action"), actEl); return; }

    if (app.screen === "field") {
      const nodeEl = e.target.closest("[data-node]");
      if (nodeEl) { onNodeActivate(nodeEl.getAttribute("data-node")); return; }
    }

    if (app.screen === "dialogue" && e.target.closest("#overlay-dialogue")) {
      advanceDialogue();
      return;
    }
  });

  // フィールド：床クリック/タップで移動目標を決める（ノード近くなら そのノードへ歩く）
  document.addEventListener("pointerdown", (e) => {
    if (app.screen !== "field") return;
    const fld = app._field;
    if (!fld || !fld.plaza) return;
    if (!e.target.closest(".field-plaza")) return;
    const rect = fld.plaza.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = _clamp01((e.clientX - rect.left) / rect.width);
    const ny = _clamp01((e.clientY - rect.top) / rect.height);
    const node = nearestNode(nx, ny, 0.09); // クリック地点の近くにノードがあれば そこへ
    app.player.tx = node ? node.x : nx;
    app.player.ty = node ? node.y : ny;
    app.player.pendingNode = node || null;
  });

  // カーソル移動距離（落ち着きのなさ）を計測
  document.addEventListener("pointermove", (e) => {
    if (_lastPointer != null && typeof noteCursor === "function") {
      noteCursor(e.clientX - _lastPointer.x, e.clientY - _lastPointer.y);
    }
    _lastPointer = { x: e.clientX, y: e.clientY };
  });

  // キーボード（移動の代替＋会話送り＋ポーズ）
  document.addEventListener("keydown", (e) => {
    if (app.screen === "field") {
      let dx = 0, dy = 0;
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") dx = -1;
      else if (k === "ArrowRight" || k === "d" || k === "D") dx = 1;
      else if (k === "ArrowUp" || k === "w" || k === "W") dy = -1;
      else if (k === "ArrowDown" || k === "s" || k === "S") dy = 1;
      if (dx || dy) {
        e.preventDefault();
        app.player.tx = _clamp01(app.player.tx + dx * 0.12);
        app.player.ty = _clamp01(app.player.ty + dy * 0.12);
        app.player.pendingNode = null;
        return;
      }
      if (k === "Enter" || k === " ") {
        // ノードボタンにフォーカスがあるならボタン側の click に任せる
        const af = document.activeElement;
        if (af && af.closest && af.closest("[data-node]")) return;
        const n = nearestNode(app.player.x, app.player.y, 0.13);
        if (n) { app.player.tx = n.x; app.player.ty = n.y; app.player.pendingNode = n; e.preventDefault(); }
        return;
      }
    }
    if (app.screen === "dialogue" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); advanceDialogue(); return;
    }
    if (e.key === "Escape") {
      if (app.screen === "field" || app.screen === "battle") openPause();
      else if (app.screen === "pause") resumePause();
    }
  });
}

// ノードをクリック/Enter で起動（＝そのノードへ歩いて触れる）。キーボード操作の入口でもある。
function onNodeActivate(nodeId) {
  const n = (typeof areaNodes === "function") ? areaNodes().find((x) => x.id === nodeId) : null;
  if (!n) return;
  app.player.tx = n.x; app.player.ty = n.y; app.player.pendingNode = n;
  if (!app._raf) startFieldLoop(); // 念のため止まっていたら歩行再開
}

// 起動
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.startGame = startGame;
  window.continueGame = continueGame;
  window.toTitle = toTitle;
  window.main = main;
}
