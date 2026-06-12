// 全会話ノードを1冊にまとめる。
// ノードIDが重複したらデータ事故なので、ここで検出して起動を止める。
import type { DialogueNode } from "../../types";
import { EVENT_NODES } from "./events";
import { VILLAGER_NODES } from "./villagers";
import { PLAZA_NODES } from "./plaza";
import { KITSUNE_NODES } from "./kitsune";

const books = [EVENT_NODES, VILLAGER_NODES, PLAZA_NODES, KITSUNE_NODES];

export const ALL_NODES: Record<string, DialogueNode> = {};
export const DUPLICATE_NODE_IDS: string[] = [];

for (const book of books) {
  for (const [id, node] of Object.entries(book)) {
    if (ALL_NODES[id]) DUPLICATE_NODE_IDS.push(id);
    ALL_NODES[id] = node;
  }
}
