// 起動時データ検証 (§4.2)。
// words.ts に存在しないトークンが1つでもあれば起動エラーで止める（誤字事故の根絶）。
// あわせて、会話グラフの参照切れ・マップの行長ズレも全部ここで捕まえる。
import { WORDS } from "../data/words";
import { ALL_NODES, DUPLICATE_NODE_IDS } from "../data/dialogues";
import { NPCS } from "../data/npcs";
import { BATTLES } from "../data/battles";
import { HILL } from "../data/maps/hill";
import { VILLAGE } from "../data/maps/village";
import { CHAR_TO_TILE } from "../gfx/tileLegend";
import { extractTokens } from "./textMask";
import type { MapDef } from "../types";

export const MAPS: Record<string, MapDef> = { hill: HILL, village: VILLAGE };

export function validateData(): string[] {
  const errors: string[] = [];
  const warn = (msg: string) => console.warn("[validate]", msg);

  if (DUPLICATE_NODE_IDS.length) {
    errors.push(`会話ノードIDが重複: ${DUPLICATE_NODE_IDS.join(", ")}`);
  }

  // ---- words: 前提語の参照チェック ----
  for (const w of Object.values(WORDS)) {
    for (const p of w.prereq ?? []) {
      if (!WORDS[p]) errors.push(`語 ${w.id} の前提語が未定義: ${p}`);
    }
  }

  const nodeExists = (id: string | undefined, from: string) => {
    if (id && !ALL_NODES[id]) errors.push(`${from} が存在しないノードを参照: ${id}`);
  };

  // ---- 会話ノード ----
  for (const node of Object.values(ALL_NODES)) {
    // トークンが全部 words.ts にあるか（本作の生命線）
    for (const t of extractTokens(node.text)) {
      if (!WORDS[t]) errors.push(`ノード ${node.id} に未定義トークン: {${t}}`);
    }
    // 1文に未知語になりうるトークンは2つまで (§11)。超過は警告に留める
    if (extractTokens(node.text).length > 2) {
      warn(`ノード ${node.id}: トークンが3つ以上あります（§11ルール確認）`);
    }
    nodeExists(node.next, `ノード ${node.id} の next`);
    for (const c of node.choices ?? []) nodeExists(c.next, `ノード ${node.id} の選択肢`);
    if (node.palette) {
      nodeExists(node.palette.default, `ノード ${node.id} の palette.default`);
      for (const [wid, nid] of Object.entries(node.palette.accept)) {
        if (!WORDS[wid]) errors.push(`ノード ${node.id} の palette.accept に未定義語: ${wid}`);
        nodeExists(nid, `ノード ${node.id} の palette.accept[${wid}]`);
      }
    }
    for (const a of node.actions ?? []) {
      if (a.type === "learnWord" && !WORDS[a.id]) {
        errors.push(`ノード ${node.id} が未定義語を習得: ${a.id}`);
      }
      if (a.type === "startBattle" && !BATTLES[a.id]) {
        errors.push(`ノード ${node.id} が未定義バトルを参照: ${a.id}`);
      }
    }
  }

  // ---- NPC ----
  for (const npc of Object.values(NPCS)) {
    for (const e of npc.entries) nodeExists(e.node, `NPC ${npc.id} の entry`);
    for (const s of npc.spawns) {
      if (!MAPS[s.map]) errors.push(`NPC ${npc.id} のスポーン先マップが未定義: ${s.map}`);
    }
  }

  // ---- バトル ----
  for (const b of Object.values(BATTLES)) {
    nodeExists(b.winNode, `バトル ${b.id} の winNode`);
    nodeExists(b.retryNode, `バトル ${b.id} の retryNode`);
    for (const p of b.phases) {
      for (const t of extractTokens(p.line)) {
        if (!WORDS[t]) errors.push(`バトル ${b.id} のセリフに未定義トークン: {${t}}`);
      }
      for (const wid of Object.keys(p.matrix)) {
        if (!WORDS[wid]) errors.push(`バトル ${b.id} の matrix に未定義語: ${wid}`);
      }
    }
    for (const o of b.opponents) {
      if (!NPCS[o]) errors.push(`バトル ${b.id} の相手が未定義NPC: ${o}`);
    }
  }

  // ---- マップ ----
  for (const m of Object.values(MAPS)) {
    const w = m.grid[0]?.length ?? 0;
    m.grid.forEach((row, y) => {
      if (row.length !== w) errors.push(`マップ ${m.id} の行 ${y} の長さが不一致`);
      for (const ch of row) {
        if (!(ch in CHAR_TO_TILE)) errors.push(`マップ ${m.id} に未定義タイル文字: "${ch}"`);
      }
    });
    for (const ex of m.examinables) nodeExists(ex.node, `マップ ${m.id} のしらべ`);
    for (const z of m.zones) nodeExists(z.node, `マップ ${m.id} のゾーン`);
    for (const t of m.transitions) {
      if (!MAPS[t.to.map]) errors.push(`マップ ${m.id} の遷移先が未定義: ${t.to.map}`);
    }
  }

  return errors;
}
