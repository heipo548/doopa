// 会話エンジンの「データ側」(§4.3)。
// ノードの取得と if 条件の読み飛ばしだけを担当し、
// 表示・入力待ち・演出はシーン側の DialogueDirector (ui/) が担当する。
import type { DialogueNode } from "../types";
import { G } from "./wordSystem";

export class DialogueBook {
  constructor(public readonly nodes: Record<string, DialogueNode>) {}

  has(id: string): boolean {
    return id in this.nodes;
  }

  /**
   * id のノードを返す。if 不成立なら next を辿って読み飛ばす。
   * 無限ループ防止に 50 回で打ち切る（データ不備は起動時検証でも検出する）。
   */
  resolve(id: string | undefined): DialogueNode | null {
    let cur = id;
    for (let i = 0; i < 50 && cur; i++) {
      const node = this.nodes[cur];
      if (!node) {
        console.error(`[dialogue] ノードがありません: ${cur}`);
        return null;
      }
      if (G.checkCond(node.if)) return node;
      cur = node.next;
    }
    return null;
  }

  /** 選択肢のうち、表示条件を満たすものだけを返す */
  visibleChoices(node: DialogueNode) {
    return (node.choices ?? []).filter((c) => G.checkCond(c.if));
  }
}
