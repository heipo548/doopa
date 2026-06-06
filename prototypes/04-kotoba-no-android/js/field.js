/*
 * field.js — 村フィールドの進行ロジック（マップ／探索）
 *
 * 役割：エリア入場、ノード（NPC/敵/セーブ/立て札/出口）の状態と近接判定、
 *       ノードに触れたときの“次に何が起きるか”を返す（実際の遷移は main が指揮）。
 *   ・出口は requires フラグ（battle_done）が立つまでロック＝「ボス撃破→次へ」の型の最小版。
 *   ・座標は 0..1 正規化。ピクセル配置や追従の補間は ui/main 側（DOM）に委ね、ここは判定の素だけ。
 *
 * ※ DOM 非依存。末尾で window へ明示エクスポート。
 */

// エリアに入る。
function enterArea(id) {
  game.currentArea = id;
  game.state = STATES.FIELD;
  app.screen = "field";
  log((AREA && AREA.name ? AREA.name : "むら") + " に 入った。");
  return true;
}

// 現在エリアのノード一覧を“状態付き”で返す（ui が描画・判定に使う）。
//   locked：出口が requires フラグ未達でロック中か。
//   done  ：会話済みNPCか（再訪で同じ会話を起こさないための目印）。
function areaNodes() {
  if (!AREA || !AREA.nodes) return [];
  return AREA.nodes
    // appearWhen フラグが立っていないノードはまだ村に出ていない（学校/かどっこ/くちなしの段階出現）。
    .filter((n) => !n.appearWhen || hasFlag(n.appearWhen))
    .map((n) => {
      const out = {
        id: n.id, type: n.type, ref: n.ref || null,
        x: n.x, y: n.y, label: n.label || "", text: n.text || "",
      };
      if (n.type === "exit") out.locked = n.requires ? !hasFlag(n.requires) : false;
      if (n.type === "npc") out.done = hasFlag("talked_" + n.ref);
      return out;
    });
}

// 正規化座標(px,py: 0..1)から、半径 r 以内で最も近い“触れられる”ノードを返す（無ければ null）。
//   ui が主人公ルゥの現在位置を渡して「近づいたら光る」を実現する。
function nearestNode(px, py, r) {
  const nodes = areaNodes();
  let best = null, bestD = (r || 0.14);
  for (const n of nodes) {
    const dx = n.x - px, dy = n.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bestD) { bestD = d; best = n; }
  }
  return best;
}

// ノードに触れたときの“次の行動”を記述子で返す（main がこれを見て遷移）。
function interact(node) {
  if (!node) return { type: "none" };
  switch (node.type) {
    case "npc":
      return { type: "dialogue", npcId: node.ref };
    case "enemy":
      return { type: "battle", enemyId: node.ref };
    case "shop":
      return { type: "shop", shopId: node.ref };
    case "save":
      return { type: "save" };
    case "sign":
      return { type: "sign", text: node.text };
    case "exit":
      if (node.locked) return { type: "locked", msg: "まだ ここからは 出られない。……かどっこ と、はなしを つけてから。" };
      return { type: "exit" };
    default:
      return { type: "none" };
  }
}

// 出口を通れるか（＝村を一周し終えたか）。
function canAdvance() {
  return hasFlag("battle_done");
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.enterArea = enterArea;
  window.areaNodes = areaNodes;
  window.nearestNode = nearestNode;
  window.interact = interact;
  window.canAdvance = canAdvance;
}
