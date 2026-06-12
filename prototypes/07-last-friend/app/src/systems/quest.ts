// クエスト進行の小さなヘルパー。
// 状態そのものは G.flags に持たせ、ここでは「数える・判定する」だけにする
// （セーブ対象を G に一本化するため）。
import { G } from "./wordSystem";

// Q1「むらの ひとに あいさつ（4人）」の対象
export const Q1_TARGETS = ["kaeru", "mogura", "kotori", "obaa"] as const;

export function greetCount(): number {
  return Q1_TARGETS.filter((id) => G.hasFlag(`greeted_${id}`)).length;
}

export function isQ1Done(): boolean {
  return greetCount() >= Q1_TARGETS.length;
}

/** あいさつ成立時に呼ぶ。Q1 完了の瞬間なら true を返す（トースト出し分け用） */
export function recordGreet(npcId: string): boolean {
  const before = isQ1Done();
  G.setFlag(`greeted_${npcId}`);
  const after = isQ1Done();
  if (after && !before) {
    G.setFlag("q1_done");
    return true;
  }
  return false;
}
