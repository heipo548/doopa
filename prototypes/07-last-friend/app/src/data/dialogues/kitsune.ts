// E4: きつねのこ（体験版の感情的クライマックス）。
// うそルート: lie:true のセリフ →「ちがう」→ うそ習得(dark+1) → 逃走 →
//             木の下で さみしい・かなしい習得（reveal_sad）→ ごめんね で仲直り
// だまるルート: うそは覚えないまま(kind+1) → 同じく さみしい・かなしい へ
// 仲直り後:「きみは ぼくの なに？」→ すき＋いっしょ が あれば
//           『ともだち』が むねの なかで 合成され、本人に言える (§9 E4)
import type { DialogueNode } from "../../types";

const N = (n: DialogueNode) => n;

export const KITSUNE_NODES: Record<string, DialogueNode> = {
  // E3 前は こっちを みているだけ
  k_pre: N({
    id: "k_pre",
    speaker: "kitsune",
    text: "･････（{ki}の かげから こっちを みて いる）",
  }),

  // ===== E4 本編 =====
  k1: N({
    id: "k1",
    speaker: "kitsune",
    text: "･･･なんだよ。ぼくに なにか ようか",
    next: "k2",
  }),
  k2: N({
    id: "k2",
    speaker: "kitsune",
    text: "{tomodachi}？ いらないよ、そんなの",
    next: "k3",
  }),
  k3: N({
    id: "k3",
    speaker: "kitsune",
    lie: true,
    text: "みんな ぼくの こと きらいだって。だから ひとりが いいんだ",
    next: "k4",
  }),
  k4: N({
    id: "k4",
    speaker: "narration",
    text: "いまの ことば、どこかが ひっかかる",
    next: "k5",
  }),
  k5: N({
    id: "k5",
    speaker: "narration",
    text: "どうしよう",
    choices: [
      { label: "それは ちがうと いう", next: "k_uso1" },
      { label: "だまって となりに すわる", next: "ks1" },
    ],
  }),

  // ===== A: うそルート =====
  k_uso1: N({
    id: "k_uso1",
    speaker: "narration",
    text: "ちがう。いま きいた ことばは、ほんとうじゃ ない",
    next: "k_uso2",
  }),
  k_uso2: N({
    id: "k_uso2",
    speaker: "narration",
    text: "ほんとうじゃ ない ことばの なまえを、きみは しって しまった",
    actions: [
      { type: "learnWord", id: "uso", src: "きつねのこの まえで" },
      { type: "kokoro", dark: 1 },
    ],
    next: "k_uso3",
  }),
  k_uso3: N({
    id: "k_uso3",
    speaker: "kitsune",
    text: "っ･･･！ なんだよ！ しらない くせに！",
    next: "k_uso4",
  }),
  k_uso4: N({
    id: "k_uso4",
    speaker: "narration",
    text: "きつねのこは かけて いって しまった",
    actions: [{ type: "setFlag", flag: "e4_ran" }],
  }),

  // 逃げた先（木の下・reveal_sad の現場）
  kc1: N({
    id: "kc1",
    speaker: "narration",
    text: "{ki}の したで、ちいさな せなかが ふるえて いる",
    next: "kc2",
  }),
  kc2: N({
    id: "kc2",
    speaker: "narration",
    text: "ひとりは つめたい。その きもちの なまえは",
    actions: [{ type: "learnWord", id: "samishii", src: "きつねのこの せなかで" }],
    next: "kc3",
  }),
  kc3: N({
    id: "kc3",
    speaker: "narration",
    text: "{samishii}。きつねのこは ずっと {samishii}かったんだ",
    next: "kc4",
  }),
  kc4: N({
    id: "kc4",
    speaker: "narration",
    text: "むねの おくが、ぎゅっと いたく なる",
    actions: [{ type: "learnWord", id: "kanashii", src: "なみだを みて" }],
    next: "kc5",
  }),
  kc5: N({
    id: "kc5",
    speaker: "narration",
    text: "{kanashii}。なみだの でる きもち",
    next: "kc6",
  }),
  kc6: N({
    id: "kc6",
    speaker: "kitsune",
    text: "･･･きらいって いわれたのは {uso}。ほんとは、こわかった だけ",
    next: "kc7",
  }),
  kc7: N({
    id: "kc7",
    speaker: "kitsune",
    text: "{gomenne}って いいたいのに、のどに つっかえて でて こないんだ",
    next: "kc8",
  }),
  kc8: N({
    id: "kc8",
    speaker: "kitsune",
    text: "･･･ねえ。てつだって くれる？",
    palette: { categories: ["kind", "sad"], accept: { gomenne: "kc9" }, default: "kc8d" },
  }),
  kc8d: N({
    id: "kc8d",
    speaker: "kitsune",
    text: "･･･ちがう。その ことばじゃ ない みたい",
    next: "kc8",
  }),
  kc9: N({
    id: "kc9",
    speaker: "kitsune",
    text: "{gomenne}･････。{gomenne}！ ････いえた！",
    actions: [{ type: "setFlag", flag: "e4_recon" }],
    next: "r1",
  }),

  // ===== B: だまるルート =====
  ks1: N({
    id: "ks1",
    speaker: "narration",
    text: "きみは なにも いわずに、となりに すわった",
    actions: [{ type: "kokoro", kind: 1 }],
    next: "ks2",
  }),
  ks2: N({
    id: "ks2",
    speaker: "narration",
    text: "{kaze}の おとだけが、しばらく つづいた",
    next: "ks3",
  }),
  ks3: N({
    id: "ks3",
    speaker: "kitsune",
    text: "･････ごめん。さっきのは {uso}",
    next: "ks4",
  }),
  ks4: N({
    id: "ks4",
    speaker: "kitsune",
    text: "ほんとはね、ずっと ひとりで つめたかったんだ",
    actions: [{ type: "learnWord", id: "samishii", src: "きつねのこの こえで" }],
    next: "ks5",
  }),
  ks5: N({
    id: "ks5",
    speaker: "narration",
    text: "{samishii}。その きもちの なまえを きみは しった",
    next: "ks6",
  }),
  ks6: N({
    id: "ks6",
    speaker: "narration",
    text: "きつねのこの ほっぺが、ひかって いた",
    actions: [{ type: "learnWord", id: "kanashii", src: "なみだを みて" }],
    next: "ks7",
  }),
  ks7: N({
    id: "ks7",
    speaker: "narration",
    text: "{kanashii}。なみだの でる きもち",
    next: "ks8",
  }),
  ks8: N({
    id: "ks8",
    speaker: "kitsune",
    text: "でも、きみが いて くれて、すこし あったかい",
    actions: [{ type: "setFlag", flag: "e4_recon" }],
    next: "r1",
  }),

  // ===== 合流: ともだち合成 =====
  r1: N({
    id: "r1",
    speaker: "kitsune",
    text: "ねえ。きいても いい？",
    next: "r2",
  }),
  r2: N({
    id: "r2",
    speaker: "kitsune",
    text: "きみは･･･ ぼくの、なに？",
    next: "r_synth",
  }),
  // すき＋いっしょ を知っていれば、あたらしい ことばが うまれる（ごうせい §6.2）
  r_synth: N({
    id: "r_synth",
    speaker: "narration",
    if: { hasWords: ["suki", "issho"], notWord: "tomodachi" },
    text: "むねの なかで {suki}と {issho}が とけあって、あたらしい ことばに なった",
    actions: [{ type: "learnWord", id: "tomodachi", src: "じぶんの むねから" }],
    next: "r_ask",
  }),
  r_ask: N({
    id: "r_ask",
    speaker: "kitsune",
    text: "････（こたえを まって いる）",
    palette: {
      categories: ["kind", "sad", "world"],
      accept: { tomodachi: "r_climax", suki: "r_suki" },
      default: "r_wait",
    },
  }),
  r_suki: N({
    id: "r_suki",
    speaker: "kitsune",
    text: "！ ･･･えへへ。ぼくも {suki}だよ。でも、それだけじゃ ない きも する",
    next: "r_wait",
  }),
  r_wait: N({
    id: "r_wait",
    speaker: "kitsune",
    text: "･･･まだ ことばに なって ないんだね。いいよ。ぼく、まってる",
    next: "r_end",
  }),
  r_climax: N({
    id: "r_climax",
    speaker: "kitsune",
    text: "{tomodachi}･･･！ ぼくたち、{tomodachi}！",
    actions: [
      { type: "setFlag", flag: "e4_climax" },
      { type: "kokoro", kind: 1 },
      { type: "event", name: "hearts" },
    ],
    next: "r_climax2",
  }),
  r_climax2: N({
    id: "r_climax2",
    speaker: "kitsune",
    text: "きみは ぼくの、はじめての {tomodachi}だ",
    next: "r_end",
  }),
  // 初回だけ夕方へ進める。2回目以降（再会話）は if が落ちて r_end_alt へ流れる
  r_end: N({
    id: "r_end",
    speaker: "kitsune",
    if: { notFlag: "e4_done" },
    text: "･･･{sora}が ももいろだ。きょうは ほしみだいに みんな あつまるんだって。いこ！",
    actions: [
      { type: "setFlag", flag: "e4_done" },
      { type: "phase", phase: "evening" },
      { type: "event", name: "save" },
    ],
    next: "r_end_alt",
  }),
  r_end_alt: N({
    id: "r_end_alt",
    speaker: "kitsune",
    text: "えへへ",
  }),

  // 再会話用
  r3: N({
    id: "r3",
    speaker: "kitsune",
    text: "ねえ、もういちど きいても いい？ きみは ぼくの、なに？",
    next: "r_synth",
  }),
  k_happy: N({
    id: "k_happy",
    speaker: "kitsune",
    text: "えへへ。{tomodachi}！",
  }),
  kitsune_morning: N({
    id: "kitsune_morning",
    speaker: "kitsune",
    text: "{ohayou}！ ねえ、{ohayou}って いい ことばだね",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),
};
