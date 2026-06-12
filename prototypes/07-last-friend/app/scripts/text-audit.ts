
import { ALL_NODES } from "../src/data/dialogues";
import { WORDS } from "../src/data/words";
import { STR } from "../src/data/strings";
import { extractTokens, resolveText, wrapJa } from "../src/systems/textMask";

const problems: string[] = [];
const kanjiRe = /[一-鿿]/;

for (const node of Object.values(ALL_NODES)) {
  const t = node.text;
  if (!t) continue;
  // 1. 漢字
  if (kanjiRe.test(t)) problems.push(`漢字: ${node.id}: ${t}`);
  // 2. トークン3つ以上
  if (extractTokens(t).length > 2) problems.push(`トークン${extractTokens(t).length}個: ${node.id}`);
  // 3. 最長解決時(全部習得済み)・最短解決時(全部未習得)の両方で3行に収まるか
  for (const know of [true, false]) {
    const resolved = resolveText(t, 0, () => know);
    const lines = wrapJa(resolved, node.speaker === "narration" ? 18 : 17, 99);
    if (lines.length > 3) {
      problems.push(`3行超過(${know ? "習得後" : "習得前"} ${lines.length}行): ${node.id}: ${resolved}`);
    }
  }
  // 4. 30語の生テキスト（単純包含・要目視判定）
  const stripped = t.replace(/\{[a-z0-9_]+\}/g, "");
  for (const w of Object.values(WORDS)) {
    if (w.text.length >= 3 && stripped.includes(w.text)) {
      problems.push(`生テキスト疑い「${w.text}」: ${node.id}: ${t}`);
    }
  }
}
// choices のラベル長（ボックスは画面内に収まるか: ~16字まで）
for (const node of Object.values(ALL_NODES)) {
  for (const c of node.choices ?? []) {
    if (c.label.length > 14) problems.push(`選択肢が長い(${c.label.length}字): ${node.id}: ${c.label}`);
    if (kanjiRe.test(c.label)) problems.push(`選択肢に漢字: ${node.id}: ${c.label}`);
  }
}
// strings.ts の漢字（タイトル画面系は全部かなのはず）
for (const [k, v] of Object.entries(STR)) {
  if (typeof v === "string" && kanjiRe.test(v)) problems.push(`strings漢字: ${k}: ${v}`);
}
if (problems.length) { console.log(problems.join("\n")); }
else console.log("文章監査: 問題なし");
