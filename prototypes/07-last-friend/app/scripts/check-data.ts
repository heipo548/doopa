// Node 上で起動時検証と同じチェックを回す開発用スクリプト。
// 使い方: npm run check（esbuild でバンドルして node 実行）
// ブラウザを開かなくても、トークン誤字・参照切れ・マップ崩れを検出できる。
import { validateData, MAPS } from "../src/systems/validate";
import { WORDS, WORD_COUNT } from "../src/data/words";
import { ALL_NODES } from "../src/data/dialogues";
import { extractTokens } from "../src/systems/textMask";
import { NPCS } from "../src/data/npcs";
import { CHAR_TO_TILE, COLLIDING_TILES } from "../src/gfx/tileLegend";

const errors = validateData();
const notes: string[] = [];

// 30語ぴったりか (§8)
if (WORD_COUNT !== 30) errors.push(`語数が30ではない: ${WORD_COUNT}`);

// すべての語に習得経路（learnWord アクション）があるか（§13: コンプ可能性）
const learnable = new Set<string>();
for (const node of Object.values(ALL_NODES)) {
  for (const a of node.actions ?? []) {
    if (a.type === "learnWord") learnable.add(a.id);
  }
}
for (const id of Object.keys(WORDS)) {
  if (!learnable.has(id)) errors.push(`習得経路のない語: ${id}`);
}

// セリフ中に30語を「生テキスト」で書いていないか（トークン以外で出すとシステムの嘘になる）
// かみさまの行 (§9 E6) と E7 カードは仕様上の例外なので strings.ts は対象外
for (const node of Object.values(ALL_NODES)) {
  const stripped = node.text.replace(/\{[a-z0-9_]+\}/g, "");
  for (const w of Object.values(WORDS)) {
    if (w.text.length >= 2 && stripped.includes(w.text)) {
      notes.push(`ノード ${node.id}: 「${w.text}」が生テキストに含まれる（意図確認）`);
    }
  }
}

// NPC スポーン位置が歩行可能タイルか
for (const npc of Object.values(NPCS)) {
  for (const s of npc.spawns) {
    const m = MAPS[s.map];
    if (!m) continue;
    const ch = m.grid[s.y]?.[s.x];
    if (ch === undefined) {
      errors.push(`NPC ${npc.id} のスポーンがマップ外: ${s.map}(${s.x},${s.y})`);
      continue;
    }
    if (COLLIDING_TILES.includes(CHAR_TO_TILE[ch])) {
      errors.push(`NPC ${npc.id} のスポーンが通行不可タイル上: ${s.map}(${s.x},${s.y})="${ch}"`);
    }
  }
}

// ゾーン・しらべ・遷移の座標がマップ内か
for (const m of Object.values(MAPS)) {
  const H = m.grid.length;
  const W = m.grid[0].length;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  for (const z of m.zones) {
    if (!inside(z.x, z.y) || !inside(z.x + z.w - 1, z.y + z.h - 1)) {
      errors.push(`マップ ${m.id} のゾーンがはみ出し: (${z.x},${z.y},${z.w},${z.h})`);
    }
  }
  for (const ex of m.examinables) {
    if (!inside(ex.x, ex.y)) errors.push(`マップ ${m.id} のしらべがはみ出し: (${ex.x},${ex.y})`);
  }
  for (const t of m.transitions) {
    const dest = MAPS[t.to.map];
    const ch = dest.grid[t.to.y]?.[t.to.x];
    if (ch === undefined || COLLIDING_TILES.includes(CHAR_TO_TILE[ch])) {
      errors.push(`マップ ${m.id} の遷移先が通行不可: ${t.to.map}(${t.to.x},${t.to.y})`);
    }
  }
}

// マップをアスキー表示（目視確認用）
for (const m of Object.values(MAPS)) {
  console.log(`\n==== ${m.id} (${m.grid[0].length}x${m.grid.length}) ====`);
  console.log(m.grid.join("\n"));
}

console.log(`\nノード数: ${Object.keys(ALL_NODES).length} / 語数: ${WORD_COUNT}`);
const tokenCount = Object.values(ALL_NODES).reduce(
  (acc, n) => acc + extractTokens(n.text).length,
  0
);
console.log(`トークン出現数: ${tokenCount}`);

if (notes.length) {
  console.log("\n-- 確認メモ --");
  for (const n of notes) console.log("  " + n);
}
if (errors.length) {
  console.error("\n!! エラー !!");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("\nデータ検証 OK");
