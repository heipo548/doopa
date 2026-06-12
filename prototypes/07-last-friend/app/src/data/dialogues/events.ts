// E0（はじまりのおか）・E1（うさぎ）・しらべ系・けいじばん・E5（うた）の会話ノード。
// 文章レギュレーション (§11): 全部ひらがな・カタカナ / 1文に未知語トークン2つまで /
// 30語をトークン以外の生テキストで書かない（システムの嘘になるため）。
import type { DialogueNode } from "../../types";

const N = (n: DialogueNode) => n;

export const EVENT_NODES: Record<string, DialogueNode> = {
  // ===== E0: OPナレーション（ほぼ全部███。最後の1行だけ読める） =====
  e0_op1: N({ id: "e0_op1", speaker: "narration", text: "███████　██████", next: "e0_op2" }),
  e0_op2: N({
    id: "e0_op2",
    speaker: "narration",
    text: "{yoru}の {sora}に ？？？が ひとつ",
    next: "e0_op3",
  }),
  e0_op3: N({ id: "e0_op3", speaker: "narration", text: "████　███████　████", next: "e0_op4" }),
  e0_op4: N({
    id: "e0_op4",
    speaker: "narration",
    text: "――きみは めを さました",
    actions: [
      { type: "setFlag", flag: "e0_op_done" },
      { type: "setFlag", flag: "game_started" },
      { type: "event", name: "wake" },
    ],
  }),

  // ===== E0: 花（最初のことば・開始3分以内） =====
  n_flower_first: N({
    id: "n_flower_first",
    speaker: "narration",
    text: "ちいさな いろが ゆれて いる",
    actions: [{ type: "learnWord", id: "hana", src: "おかで しらべた" }],
    next: "n_flower_known",
  }),
  n_flower_known: N({
    id: "n_flower_known",
    speaker: "narration",
    text: "{hana}！ {hana}が さいて いるんだ",
  }),
  n_flower_after: N({
    id: "n_flower_after",
    speaker: "narration",
    text: "{hana}が ゆれて いる。いい におい",
  }),

  // ===== E0: みはらしポイント（そら・かぜ） =====
  e0_view: N({
    id: "e0_view",
    speaker: "narration",
    text: "たかい ところに でた",
    next: "e0_view2",
  }),
  e0_view2: N({
    id: "e0_view2",
    speaker: "narration",
    text: "あたまの うえに、おおきくて あおいのが ひろがって いる",
    actions: [{ type: "learnWord", id: "sora", src: "みはらしで みあげた" }],
    next: "e0_view3",
  }),
  e0_view3: N({
    id: "e0_view3",
    speaker: "narration",
    text: "{sora}。{sora}って いうんだ",
    next: "e0_view4",
  }),
  e0_view4: N({
    id: "e0_view4",
    speaker: "narration",
    text: "ほっぺを、みえない なにかが とおりすぎた",
    actions: [{ type: "learnWord", id: "kaze", src: "みはらしで かんじた" }],
    next: "e0_view5",
  }),
  e0_view5: N({
    id: "e0_view5",
    speaker: "narration",
    text: "{kaze}。みえないのに、ちゃんと いる",
    next: "e0_view6",
  }),
  e0_view6: N({
    id: "e0_view6",
    speaker: "narration",
    text: "みちは まだ したへ つづいて いる",
    actions: [
      { type: "setFlag", flag: "e0_done" },
      { type: "event", name: "save" },
    ],
  }),
  n_ledge: N({
    id: "n_ledge",
    speaker: "narration",
    text: "とおくに {mura}が みえる",
  }),

  // ===== E1: うさぎとの出会い（初パレット） =====
  e1_1: N({
    id: "e1_1",
    speaker: "narration",
    text: "だれかが こっちへ かけてくる",
    next: "e1_2",
  }),
  e1_2: N({ id: "e1_2", speaker: "usagi", text: "！　████ ███？", next: "e1_3" }),
  e1_3: N({
    id: "e1_3",
    speaker: "usagi",
    text: "･････きこえてる？ {mura}の ████？",
    next: "e1_4",
  }),
  e1_4: N({
    id: "e1_4",
    speaker: "narration",
    text: "なにを いって いるか わからない。でも、めは わらって いた",
    next: "e1_5",
  }),
  e1_5: N({
    id: "e1_5",
    speaker: "usagi",
    text: "そっか。じゃあ、まずは これから",
    next: "e1_6",
  }),
  e1_6: N({
    id: "e1_6",
    speaker: "usagi",
    text: "{konnichiwa}。であった ときの ことばだよ",
    actions: [{ type: "learnWord", id: "konnichiwa", src: "うさぎから" }],
    next: "e1_7",
  }),
  e1_7: N({
    id: "e1_7",
    speaker: "usagi",
    text: "{konnichiwa}！ ねえ、いって みて？",
    palette: {
      categories: ["kind"],
      accept: { konnichiwa: "e1_8" },
      default: "e1_7d",
    },
  }),
  e1_7d: N({
    id: "e1_7d",
    speaker: "usagi",
    text: "ふふ、それも すてき。でも まずは {konnichiwa}！",
    next: "e1_7",
  }),
  e1_8: N({
    id: "e1_8",
    speaker: "usagi",
    text: "{konnichiwa}！ うん、いい こえ！",
    next: "e1_9",
  }),
  e1_9: N({
    id: "e1_9",
    speaker: "usagi",
    text: "わたしは うさぎ。{mura}に あんない するね",
    next: "e1_10",
  }),
  e1_10: N({
    id: "e1_10",
    speaker: "usagi",
    text: "{mura}の みんなにも {konnichiwa}、して あげて",
    next: "e1_11",
  }),
  e1_11: N({
    id: "e1_11",
    speaker: "narration",
    text: "みんなに あいさつ してみよう（4にん）",
    actions: [
      { type: "setFlag", flag: "e1_done" },
      { type: "setFlag", flag: "q1_started" },
      { type: "event", name: "toVillage" },
    ],
  }),

  // ===== けいじばん（むら習得＋はり紙3枚） =====
  board_first: N({
    id: "board_first",
    speaker: "narration",
    text: "『{mura}の おしらせ』と かいて ある",
    actions: [{ type: "learnWord", id: "mura", src: "けいじばんで よんだ" }],
    next: "board_p1",
  }),
  board_loop: N({
    id: "board_loop",
    speaker: "narration",
    text: "『{mura}の おしらせ』",
    next: "board_p1",
  }),
  board_p1: N({
    id: "board_p1",
    speaker: "narration",
    text: "『{pan}　やきたて　あります』",
    next: "board_p2",
  }),
  board_p2: N({
    id: "board_p2",
    speaker: "narration",
    text: "『{hoshi}の {yoru}に　みんなで　あつまろう』",
    next: "board_p3",
  }),
  board_p3: N({
    id: "board_p3",
    speaker: "narration",
    text: "『おとしもの：{donguri}』",
  }),

  // ===== しらべ系（み ず・き・つち・いえ・看板・ほしみだい） =====
  n_mizu_first: N({
    id: "n_mizu_first",
    speaker: "narration",
    text: "つめたい ながれが きらきら して いる",
    actions: [{ type: "learnWord", id: "mizu", src: "みずべで しらべた" }],
    next: "n_mizu_known",
  }),
  n_mizu_known: N({
    id: "n_mizu_known",
    speaker: "narration",
    text: "{mizu}。さわると きもちいい",
  }),
  n_mizu_after: N({
    id: "n_mizu_after",
    speaker: "narration",
    text: "{mizu}が さらさら ながれて いる",
  }),

  n_bigtree_first: N({
    id: "n_bigtree_first",
    speaker: "narration",
    text: "のっぽの みどりが、ざわざわ ゆれて いる",
    actions: [{ type: "learnWord", id: "ki", src: "もりはずれで しらべた" }],
    next: "n_bigtree_known",
  }),
  n_bigtree_known: N({
    id: "n_bigtree_known",
    speaker: "narration",
    text: "{ki}。とても おおきな {ki}だ",
  }),
  n_bigtree_after: N({
    id: "n_bigtree_after",
    speaker: "narration",
    text: "おおきな {ki}。ももいろの {hana}が さいて いる",
  }),

  n_tsuchi_first: N({
    id: "n_tsuchi_first",
    speaker: "narration",
    text: "ふかふかの くろい じめんだ",
    actions: [{ type: "learnWord", id: "tsuchi", src: "はたけで しらべた" }],
    next: "n_tsuchi_known",
  }),
  n_tsuchi_known: N({
    id: "n_tsuchi_known",
    speaker: "narration",
    text: "{tsuchi}。あったかい においが する",
  }),
  n_tsuchi_after: N({
    id: "n_tsuchi_after",
    speaker: "narration",
    text: "{hatake}の {tsuchi}は ふかふかだ",
  }),

  n_ie_first: N({
    id: "n_ie_first",
    speaker: "narration",
    text: "あかりの ともった とびらだ",
    actions: [{ type: "learnWord", id: "ie", src: "とびらで しらべた" }],
    next: "n_ie_known",
  }),
  n_ie_known: N({
    id: "n_ie_known",
    speaker: "narration",
    text: "{ie}。だれかの かえる ばしょ",
  }),
  n_ie_after: N({
    id: "n_ie_after",
    speaker: "narration",
    text: "{ie}の なかから いい においが する",
  }),

  // 立て看板（トークンなしの平文。本編への伏線 §7.2）
  n_sign: N({
    id: "n_sign",
    speaker: "narration",
    text: "『この さきは　だれも　しらない』",
  }),

  n_hoshimidai_day: N({
    id: "n_hoshimidai_day",
    speaker: "narration",
    text: "たかくて しずかな ばしょ。{sora}が ちかい",
  }),
  n_hoshimidai_night: N({
    id: "n_hoshimidai_night",
    speaker: "narration",
    text: "{hoshi}が、てが とどきそうな くらい ちかい",
  }),

  // ===== E5: ほしみだいの うた =====
  e5_1: N({
    id: "e5_1",
    speaker: "narration",
    text: "みんなが あつまって いる",
    next: "e5_2",
  }),
  e5_2: N({
    id: "e5_2",
    speaker: "kotori",
    text: "きょうは とくべつな ひ。あたらしい こが きた ひ だから",
    next: "e5_3",
  }),
  e5_3: N({
    id: "e5_3",
    speaker: "narration",
    text: "ことりが ちいさく いきを すって、こえを ふるわせた",
    actions: [{ type: "event", name: "song" }],
    next: "e5_4",
  }),
  e5_4: N({
    id: "e5_4",
    speaker: "narration",
    text: "こえが {sora}に とけて いく",
    actions: [{ type: "learnWord", id: "uta", src: "ほしみだいで きいた" }],
    next: "e5_5",
  }),
  e5_5: N({
    id: "e5_5",
    speaker: "narration",
    text: "{uta}。せかいが すこし ひかって きこえる",
    next: "e5_6",
  }),
  e5_6: N({ id: "e5_6", speaker: "kotori", text: "みて、{sora}の うえ", next: "e5_7" }),
  e5_7: N({
    id: "e5_7",
    speaker: "narration",
    text: "ちいさな ひかりが ひとつ、ふたつ",
    actions: [
      { type: "learnWord", id: "hoshi", src: "ほしみだいで みあげた" },
      { type: "phase", phase: "night" },
    ],
    next: "e5_8",
  }),
  e5_8: N({
    id: "e5_8",
    speaker: "narration",
    text: "{hoshi}だ。{sora}いっぱいの {hoshi}",
    next: "e5_9",
  }),
  e5_9: N({
    id: "e5_9",
    speaker: "narration",
    text: "あたりが ふかくて しずかな いろに なった",
    actions: [{ type: "learnWord", id: "yoru", src: "ほしみだいで むかえた" }],
    next: "e5_10",
  }),
  e5_10: N({
    id: "e5_10",
    speaker: "narration",
    text: "{yoru}。こわくない {yoru}も あるんだ",
    next: "e5_11",
  }),
  e5_11: N({
    id: "e5_11",
    speaker: "narration",
    text: "みんなの わらいごえが かさなる",
    actions: [{ type: "learnWord", id: "tanoshii", src: "みんなの わの なかで" }],
    next: "e5_12",
  }),
  e5_12: N({
    id: "e5_12",
    speaker: "narration",
    text: "{tanoshii}！ むねが ぽかぽか はずむ",
    next: "e5_13",
  }),
  e5_13: N({
    id: "e5_13",
    speaker: "usagi",
    text: "きょうは おやすみ。また あしたね",
    next: "e5_14",
  }),
  e5_14: N({
    id: "e5_14",
    speaker: "narration",
    text: "",
    actions: [
      { type: "setFlag", flag: "e5_done" },
      { type: "event", name: "sleep" },
    ],
  }),
};
