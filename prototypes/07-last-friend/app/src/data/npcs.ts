// NPC 8体の定義 (§5.2)。
// この世界には「なまえ」という ことばが失われているので (GAME_DESIGN §4.1)、
// みんな「うさぎ」「カエル」のように呼び合っている。これ自体が最大級の伏線。
//
// spawns: 上から最初に条件成立した場所に出現（時間帯・進行で引っ越す）
// entries: 話しかけたとき、上から最初に条件成立した会話ノードへ
import type { NpcDef } from "../types";

export const NPCS: Record<string, NpcDef> = {
  usagi: {
    id: "usagi",
    label: "うさぎ",
    look: { body: "momo", ear: "long", tail: "small" },
    spawns: [
      // E1: 丘のゲートに駆けてくる
      { map: "hill", x: 9, y: 13, if: [{ flag: "e1_seen" }, { notFlag: "e1_done" }] },
      // よる: ほしみだい
      { map: "village", x: 30, y: 6, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      // あさ: ひろば
      { map: "village", x: 18, y: 11, if: [{ flag: "e6_done" }] },
      // ひる: ひろばの北
      { map: "village", x: 18, y: 9, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "usagi_morning" },
      { if: [{ flag: "e6_done" }], node: "usagi_morning2" },
      { if: [{ flag: "e5_done" }], node: "usagi_night" },
      { if: [{ flag: "e4_done" }], node: "usagi_evening" },
      { if: [{ flag: "e3_done" }], node: "usagi_e4hint" },
      { if: [{ flag: "q1_done" }], node: "usagi_e3hint" },
      { node: "usagi_q1hint" },
    ],
  },

  kaeru: {
    id: "kaeru",
    label: "カエル",
    look: { body: "midori", ear: "none", tail: "none" },
    spawns: [
      { map: "village", x: 33, y: 6, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 26, y: 15, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "kaeru_morning" },
      { if: [{ notFlag: "greeted_kaeru" }], node: "kaeru_greet" },
      { if: [{ notFlag: "kaeru_gave_pan" }], node: "kaeru_t1" },
      { if: [{ flag: "has_pan" }, { notFlag: "q2_done" }], node: "kaeru_wait" },
      { if: [{ flag: "q2_done" }], node: "kaeru_idle2" },
      { node: "kaeru_idle" },
    ],
  },

  mogura: {
    id: "mogura",
    label: "モグラ",
    look: { body: "kotsuchi", ear: "round", tail: "small" },
    spawns: [
      { map: "village", x: 34, y: 5, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 28, y: 22, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "mogura_morning" },
      { if: [{ notFlag: "greeted_mogura" }], node: "mogura_greet" },
      { if: [{ notFlag: "mogura_t1_done" }], node: "mogura_t1" },
      { node: "mogura_idle" },
    ],
  },

  kotori: {
    id: "kotori",
    label: "ことり",
    look: { body: "sora", ear: "none", tail: "small", wing: true },
    spawns: [
      { map: "village", x: 31, y: 4, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 21, y: 12, if: [{ flag: "e6_done" }] },
      { map: "village", x: 23, y: 15, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "kotori_morning" },
      { if: [{ notFlag: "greeted_kotori" }], node: "kotori_greet" },
      { if: [{ notFlag: "kotori_t1_done" }], node: "kotori_t1" },
      { if: [{ flag: "e5_done" }], node: "kotori_night" },
      { node: "kotori_idle" },
    ],
  },

  obaa: {
    id: "obaa",
    label: "おばあ",
    look: { body: "tsuchi", ear: "round", tail: "small" },
    spawns: [
      { map: "village", x: 29, y: 5, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 7, y: 14, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "obaa_morning" },
      { if: [{ notFlag: "greeted_obaa" }], node: "obaa_greet" },
      { if: [{ flag: "has_pan" }, { notFlag: "q2_done" }], node: "obaa_pan1" },
      { if: [{ notFlag: "obaa_t1_done" }], node: "obaa_t1" },
      { if: [{ notFlag: "obaa_t2_done" }], node: "obaa_t2" },
      { if: [{ notFlag: "obaa_t3_done" }, { hasWord: "mukashi" }], node: "obaa_t3" },
      { node: "obaa_idle" },
    ],
  },

  risu: {
    id: "risu",
    label: "りす",
    look: { body: "ki", ear: "round", tail: "big" },
    spawns: [
      { map: "village", x: 32, y: 5, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 17, y: 14, if: [{ flag: "e6_done" }] },
      { map: "village", x: 18, y: 23, if: [{ flag: "q1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "risu_morning" },
      { if: [{ notFlag: "e3_seen" }], node: "e3_intro1" },
      { if: [{ notFlag: "e3_done" }], node: "e3_confront" },
      { if: [{ flag: "e5_done" }], node: "risu_night" },
      { node: "risu_after" },
    ],
  },

  fukurou: {
    id: "fukurou",
    label: "ふくろう",
    look: { body: "fuji", ear: "tuft", tail: "small", wing: true },
    spawns: [
      { map: "village", x: 33, y: 4, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      { map: "village", x: 22, y: 13, if: [{ flag: "e6_done" }] },
      { map: "village", x: 20, y: 23, if: [{ flag: "q1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "fukurou_morning" },
      { if: [{ notFlag: "e3_seen" }], node: "e3_intro1" },
      { if: [{ notFlag: "e3_done" }], node: "e3_confront" },
      { if: [{ flag: "e5_done" }], node: "fukurou_night" },
      { node: "fukurou_after" },
    ],
  },

  kitsune: {
    id: "kitsune",
    label: "きつねのこ",
    look: { body: "yamabuki", ear: "pointy", tail: "fluffy" },
    spawns: [
      // A ルート: 走り去って木の下で泣いている（reveal_sad の現場）
      { map: "village", x: 6, y: 6, if: [{ flag: "e4_ran" }, { notFlag: "e4_recon" }] },
      // よる: ほしみだい
      { map: "village", x: 31, y: 6, if: [{ flag: "e4_done" }, { notFlag: "e6_done" }] },
      // あさ: ひろば
      { map: "village", x: 18, y: 13, if: [{ flag: "e6_done" }] },
      // ひる: 森はずれの木（最初からずっと見えている）
      { map: "village", x: 7, y: 6, if: [{ flag: "e1_done" }] },
    ],
    entries: [
      { if: [{ phase: "morning" }, { notWord: "ohayou" }], node: "kitsune_morning" },
      { if: [{ notFlag: "e3_done" }], node: "k_pre" },
      { if: [{ flag: "e4_ran" }, { notFlag: "e4_recon" }], node: "kc1" },
      { if: [{ flag: "e4_climax" }], node: "k_happy" },
      { if: [{ flag: "e4_recon" }], node: "r3" },
      { node: "k1" },
    ],
  },
};
