// はじまりのおか（20×15・§7.1）。
// 役割: 誕生 → 花（E0・最初のことば）→ みはらし（そら・かぜ）→ 森のゲート（E1）。
// 迷わない一本道にして、開始3分以内に最初の███が読める動線を保証する。
import type { MapDef } from "../../types";
import { makeGrid, border, fillRect, vline, hline, scatter, set, toRows } from "./builder";

const g = makeGrid(20, 15, ".");
border(g, 2, "T");

// 誕生地点（明るい草）
fillRect(g, 8, 1, 2, 2, "K");
set(g, 8, 1, "K");

// 一本道: 誕生地点の下 → みはらしの角 → 南ゲート
vline(g, 9, 3, 13, "-");
hline(g, 7, 9, 14, "-"); // みはらしへの寄り道（道なりに通る）

// みはらしポイントの岩（崖のふち）
scatter(g, "r", [
  [16, 6],
  [16, 7],
  [16, 8],
]);

// E0 の花。道のすぐ横に置いて自動で目に入るようにする
set(g, 8, 4, "*");

// 飾り
scatter(g, ",", [
  [4, 3],
  [13, 4],
  [5, 8],
  [14, 10],
  [4, 11],
  [12, 12],
  [6, 5],
]);
scatter(g, "*", [[14, 11]]);
scatter(g, "b", [
  [3, 6],
  [15, 3],
]);

// 南ゲート（木の壁に1マスの穴）
set(g, 9, 13, "-");
set(g, 9, 14, "-");

export const HILL: MapDef = {
  id: "hill",
  grid: toRows(g),
  examinables: [
    // E0: 最初のことば「はな」。開始3分以内の███解読体験 (§13)
    { x: 8, y: 4, node: "n_flower_first", if: { notWord: "hana" }, arrow: true },
    { x: 8, y: 4, node: "n_flower_after", if: { hasWord: "hana" } },
    // みはらしの岩: とおくに {mura} が みえる（次のエリアへの興味付け）
    { x: 16, y: 6, w: 1, h: 3, node: "n_ledge" },
  ],
  zones: [
    // みはらしポイント: 道なりに必ず踏む位置（そら・かぜ習得）
    { x: 9, y: 7, w: 2, h: 1, node: "e0_view", if: { notFlag: "e0_view_seen" }, once: "e0_view_seen" },
    // E1: うさぎとの出会い（ゲート直前で必ず発火）
    { x: 9, y: 12, w: 1, h: 1, node: "e1_1", if: { notFlag: "e1_done" }, once: "e1_seen" },
  ],
  transitions: [{ x: 9, y: 14, w: 1, h: 1, to: { map: "village", x: 19, y: 2 } }],
};
