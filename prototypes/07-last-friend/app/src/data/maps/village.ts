// はじまりのむら（40×30・§7.2）。
// 中央ひろば / 北西: 森はずれの木（きつねのこ）/ 北: うさぎの家 /
// 北東: ほしみだい / 東: パンやとため池（カエル）/ 南東: はたけ（モグラ）/
// 西: おばあの家と川 / 南: 小さなひろば（E3の現場）/ 東端: 立て看板
import type { MapDef } from "../../types";
import { makeGrid, border, fillRect, vline, hline, scatter, set, toRows } from "./builder";

const g = makeGrid(40, 30, ".");
border(g, 2, "T");

// ---- 北ゲート（丘へ） ----
set(g, 19, 0, "-");
set(g, 19, 1, "-");

// ---- 道 ----
vline(g, 19, 2, 10, "-"); // ゲート → ひろば
fillRect(g, 15, 11, 10, 6, "-"); // 中央ひろば（15..24 × 11..16）
vline(g, 19, 17, 20, "-"); // ひろば → みなみひろば
fillRect(g, 16, 21, 8, 5, "-"); // みなみの小さなひろば（E3）
hline(g, 14, 25, 35, "-"); // ひろば → 東の立て看板
hline(g, 10, 24, 31, "-"); // ひろば → ほしみだいへの道
set(g, 31, 9, "-");

// ---- ほしみだい（北東の高台） ----
fillRect(g, 29, 3, 6, 5, "P"); // 床（29..34 × 3..7）
set(g, 31, 8, "s");
set(g, 32, 8, "s"); // 階段
hline(g, 2, 28, 35, "f"); // 高台のふち（柵）
vline(g, 28, 3, 7, "f");
vline(g, 35, 3, 7, "f");
hline(g, 8, 29, 30, "f");
hline(g, 8, 33, 34, "f");

// ---- うさぎの家（北） ----
fillRect(g, 15, 4, 3, 2, "R");
set(g, 15, 6, "W");
set(g, 16, 6, "D");
set(g, 17, 6, "W");

// ---- パンやの家（東・カエル） ----
fillRect(g, 26, 11, 3, 2, "R");
set(g, 26, 13, "W");
set(g, 27, 13, "D");
set(g, 28, 13, "W");

// ---- ため池（東） ----
fillRect(g, 29, 15, 5, 4, "~");

// ---- おばあの家（西） ----
fillRect(g, 4, 11, 3, 2, "R");
set(g, 4, 13, "W");
set(g, 5, 13, "D");
set(g, 6, 13, "W");

// ---- 川（南西） ----
fillRect(g, 2, 17, 2, 11, "~");

// ---- はたけ（南東） ----
fillRect(g, 29, 21, 7, 5, "F");

// ---- けいじばん（ひろば北） ----
set(g, 20, 10, "B");

// ---- 立て看板（東端・本編への伏線） ----
set(g, 36, 14, "S");
vline(g, 37, 12, 17, "f");

// ---- 飾り（道をふさがない位置だけ） ----
scatter(g, "T", [
  [8, 9],
  [12, 5],
  [24, 4],
  [27, 7],
  [13, 19],
  [7, 20],
  [26, 19],
  [34, 19],
  [10, 24],
  [13, 25],
  [25, 26],
  [36, 25],
]);
scatter(g, "b", [
  [3, 9],
  [22, 8],
  [36, 20],
  [6, 17],
  [11, 14],
]);
scatter(g, "*", [
  [10, 12],
  [22, 19],
  [28, 17],
  [8, 22],
  [14, 8],
  [33, 12],
  [25, 20],
]);
scatter(g, ",", [
  [9, 7],
  [21, 5],
  [30, 12],
  [12, 17],
  [26, 22],
  [17, 19],
  [5, 21],
  [33, 10],
  [23, 27],
  [15, 27],
]);
scatter(g, "r", [
  [12, 22],
  [35, 11],
]);

export const VILLAGE: MapDef = {
  id: "village",
  grid: toRows(g),
  examinables: [
    // けいじばん: 「むら」習得＋はり紙3枚（覚えるたび読める所が増える §9 E2）
    { x: 20, y: 10, node: "board_first", if: { notWord: "mura" } },
    { x: 20, y: 10, node: "board_loop", if: { hasWord: "mura" } },
    // はたけ: つち
    { x: 29, y: 21, w: 7, h: 5, node: "n_tsuchi_first", if: { notWord: "tsuchi" } },
    { x: 29, y: 21, w: 7, h: 5, node: "n_tsuchi_after", if: { hasWord: "tsuchi" } },
    // 水辺（川・ため池）: みず
    { x: 2, y: 17, w: 2, h: 11, node: "n_mizu_first", if: { notWord: "mizu" } },
    { x: 2, y: 17, w: 2, h: 11, node: "n_mizu_after", if: { hasWord: "mizu" } },
    { x: 29, y: 15, w: 5, h: 4, node: "n_mizu_first", if: { notWord: "mizu" } },
    { x: 29, y: 15, w: 5, h: 4, node: "n_mizu_after", if: { hasWord: "mizu" } },
    // 森はずれの木: き（きつねのこの定位置でもある）
    { x: 5, y: 4, w: 2, h: 2, node: "n_bigtree_first", if: { notWord: "ki" } },
    { x: 5, y: 4, w: 2, h: 2, node: "n_bigtree_after", if: { hasWord: "ki" } },
    // とびら: いえ
    { x: 16, y: 6, node: "n_ie_first", if: { notWord: "ie" } },
    { x: 16, y: 6, node: "n_ie_after", if: { hasWord: "ie" } },
    { x: 27, y: 13, node: "n_ie_first", if: { notWord: "ie" } },
    { x: 27, y: 13, node: "n_ie_after", if: { hasWord: "ie" } },
    { x: 5, y: 13, node: "n_ie_first", if: { notWord: "ie" } },
    { x: 5, y: 13, node: "n_ie_after", if: { hasWord: "ie" } },
    // 立て看板（トークンなしの平文・本編への伏線 §7.2）
    { x: 36, y: 14, node: "n_sign" },
    // ほしみだいの柵ごし: そらの見える場所
    { x: 28, y: 2, w: 8, h: 1, node: "n_hoshimidai_night", if: { phase: "night" } },
    { x: 28, y: 2, w: 8, h: 1, node: "n_hoshimidai_day" },
  ],
  zones: [
    // E3: みなみひろばの口げんか（Q1完了後）
    { x: 16, y: 20, w: 8, h: 2, node: "e3_intro1", if: { flag: "q1_done", notFlag: "e3_seen" } },
    // E5: ほしみだいに のぼると うたが はじまる
    { x: 29, y: 8, w: 6, h: 2, node: "e5_1", if: { flag: "e4_done", notFlag: "e5_done" } },
    // E7: あさ、ひろばの中心で しろいカード
    { x: 19, y: 13, w: 2, h: 2, event: "ending", if: { flag: "e6_done" }, once: "e7_card" },
  ],
  transitions: [{ x: 19, y: 0, w: 1, h: 1, to: { map: "hill", x: 9, y: 13 } }],
  props: [{ x: 5, y: 4, w: 2, h: 2, texture: "bigtree" }],
};
