// 村人（うさぎ・カエル・モグラ・ことり・おばあ）の会話ノード。
// あいさつは「覚えたことばパレットから選ぶ」が返答のすべて (§6.3)。
// こんにちは を選んだときだけ greet が成立し Q1 が進む（メカニクスの学習）。
import type { DialogueNode } from "../../types";

const N = (n: DialogueNode) => n;

export const VILLAGER_NODES: Record<string, DialogueNode> = {
  // ===== うさぎ（あんないやく） =====
  usagi_q1hint: N({
    id: "usagi_q1hint",
    speaker: "usagi",
    text: "{mura}の みんなに {konnichiwa}、できたかな？",
    next: "usagi_q1hint2",
  }),
  usagi_q1hint2: N({
    id: "usagi_q1hint2",
    speaker: "usagi",
    text: "カエル、モグラ、ことり、おばあ。4にん だよ",
  }),
  usagi_e3hint: N({
    id: "usagi_e3hint",
    speaker: "usagi",
    text: "みなみの ひろばが、なんだか さわがしいよ･･･",
  }),
  usagi_e4hint: N({
    id: "usagi_e4hint",
    speaker: "usagi",
    text: "もりはずれの おおきな {ki}の したに、きつねのこが いるよ",
    next: "usagi_e4hint2",
  }),
  usagi_e4hint2: N({
    id: "usagi_e4hint2",
    speaker: "usagi",
    text: "いつも ひとりぼっち なんだ。あいに いって あげて",
  }),
  usagi_evening: N({
    id: "usagi_evening",
    speaker: "usagi",
    text: "もうすぐ はじまるよ。たのしみだね",
  }),
  usagi_night: N({
    id: "usagi_night",
    speaker: "usagi",
    text: "いい {yoru}だね",
  }),
  usagi_morning: N({
    id: "usagi_morning",
    speaker: "usagi",
    text: "{ohayou}！ あさの あいさつだよ",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
    next: "usagi_morning2",
  }),
  usagi_morning2: N({
    id: "usagi_morning2",
    speaker: "usagi",
    text: "{ohayou}！ ひろばに おいでよ",
  }),

  // ===== カエル（パンや） =====
  kaeru_greet: N({
    id: "kaeru_greet",
    speaker: "kaeru",
    text: "･････（こっちを じっと みて いる）",
    palette: { categories: ["kind"], accept: { konnichiwa: "kaeru_greet_ok" }, default: "kaeru_greet_no" },
  }),
  kaeru_greet_no: N({
    id: "kaeru_greet_no",
    speaker: "kaeru",
    text: "けろ？（くびを かしげて いる）",
  }),
  kaeru_greet_ok: N({
    id: "kaeru_greet_ok",
    speaker: "kaeru",
    text: "{konnichiwa}！ けろっ。きみが うわさの こだね",
    actions: [{ type: "event", name: "greet:kaeru" }],
    next: "kaeru_t1",
  }),
  kaeru_t1: N({
    id: "kaeru_t1",
    speaker: "kaeru",
    text: "ちょうど やきたてが あるんだ。ほら",
    next: "kaeru_t2",
  }),
  kaeru_t2: N({
    id: "kaeru_t2",
    speaker: "narration",
    text: "まるくて あったかい ものを もらった",
    actions: [{ type: "learnWord", id: "pan", src: "カエルから もらった" }],
    next: "kaeru_t3",
  }),
  kaeru_t3: N({
    id: "kaeru_t3",
    speaker: "kaeru",
    text: "{pan}！ ぼくの じまんの {pan}！ たべて たべて",
    next: "kaeru_t4",
  }),
  kaeru_t4: N({
    id: "kaeru_t4",
    speaker: "narration",
    text: "ひとくち かじって みた。ほっぺが おちそうだ",
    actions: [{ type: "learnWord", id: "oishii", src: "やきたてを たべて" }],
    next: "kaeru_t5",
  }),
  kaeru_t5: N({
    id: "kaeru_t5",
    speaker: "narration",
    text: "{oishii}！ この きもちは {oishii}だ",
    next: "kaeru_t6",
  }),
  kaeru_t6: N({
    id: "kaeru_t6",
    speaker: "kaeru",
    text: "でしょ！ けろけろっ",
    next: "kaeru_q2a",
  }),
  kaeru_q2a: N({
    id: "kaeru_q2a",
    speaker: "kaeru",
    text: "そうだ。にしの おばあに {pan}を とどけて くれない？",
    next: "kaeru_q2b",
  }),
  kaeru_q2b: N({
    id: "kaeru_q2b",
    speaker: "narration",
    text: "おばあの {pan}を あずかった",
    actions: [
      { type: "setFlag", flag: "has_pan" },
      { type: "setFlag", flag: "kaeru_gave_pan" },
      { type: "setFlag", flag: "q2_started" },
    ],
  }),
  kaeru_wait: N({
    id: "kaeru_wait",
    speaker: "kaeru",
    text: "おばあは にしの {ie}に いるよ。けろ",
  }),
  kaeru_idle2: N({
    id: "kaeru_idle2",
    speaker: "kaeru",
    text: "おばあ、よろこんでた？ けろっ",
  }),
  kaeru_idle: N({
    id: "kaeru_idle",
    speaker: "kaeru",
    text: "きょうも いい こなが やけたよ。けろ",
  }),
  kaeru_morning: N({
    id: "kaeru_morning",
    speaker: "kaeru",
    text: "{ohayou}！ けろっ",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),

  // ===== モグラ（はたけ） =====
  mogura_greet: N({
    id: "mogura_greet",
    speaker: "mogura",
    text: "････（じめんから かおを だした）",
    palette: { categories: ["kind"], accept: { konnichiwa: "mogura_greet_ok" }, default: "mogura_greet_no" },
  }),
  mogura_greet_no: N({
    id: "mogura_greet_no",
    speaker: "mogura",
    text: "もぐ？（めを ぱちぱち して いる）",
  }),
  mogura_greet_ok: N({
    id: "mogura_greet_ok",
    speaker: "mogura",
    text: "{konnichiwa}！ もぐっ。げんきな こえだね",
    actions: [{ type: "event", name: "greet:mogura" }],
    next: "mogura_t1",
  }),
  mogura_t1: N({
    id: "mogura_t1",
    speaker: "mogura",
    text: "ここを たがやして いるんだ。ひろいだろ",
    actions: [{ type: "learnWord", id: "hatake", src: "モグラから" }],
    next: "mogura_t1b",
  }),
  mogura_t1b: N({
    id: "mogura_t1b",
    speaker: "mogura",
    text: "{hatake}！ じまんの {hatake}だよ",
    next: "mogura_t1c",
  }),
  mogura_t1c: N({
    id: "mogura_t1c",
    speaker: "mogura",
    text: "{tsuchi}も さわって ごらん。いい {tsuchi}なんだ",
    actions: [{ type: "setFlag", flag: "mogura_t1_done" }],
  }),
  mogura_idle: N({
    id: "mogura_idle",
    speaker: "mogura",
    text: "{hatake}しごとは きもちいいぞ。もぐっ",
  }),
  mogura_morning: N({
    id: "mogura_morning",
    speaker: "mogura",
    text: "{ohayou}｡ もぐっ",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),

  // ===== ことり（うたいて） =====
  kotori_greet: N({
    id: "kotori_greet",
    speaker: "kotori",
    text: "（こずえで くびを かしげて いる）",
    palette: { categories: ["kind"], accept: { konnichiwa: "kotori_greet_ok" }, default: "kotori_greet_no" },
  }),
  kotori_greet_no: N({
    id: "kotori_greet_no",
    speaker: "kotori",
    text: "ぴ？（はねを ぱたぱた させた）",
  }),
  kotori_greet_ok: N({
    id: "kotori_greet_ok",
    speaker: "kotori",
    text: "{konnichiwa}♪ きれいな めを して いるのね",
    actions: [{ type: "event", name: "greet:kotori" }],
    next: "kotori_t1",
  }),
  kotori_t1: N({
    id: "kotori_t1",
    speaker: "kotori",
    text: "わたしはね、うたうのが いちばん なの",
    next: "kotori_t1b",
  }),
  kotori_t1b: N({
    id: "kotori_t1b",
    speaker: "narration",
    text: "むねが ぽかぽかする きもちの なまえを おしえて くれた",
    actions: [{ type: "learnWord", id: "suki", src: "ことりから" }],
    next: "kotori_t1c",
  }),
  kotori_t1c: N({
    id: "kotori_t1c",
    speaker: "kotori",
    text: "{suki}。うたうのが {suki}。きみの ことも {suki}よ",
    actions: [{ type: "setFlag", flag: "kotori_t1_done" }],
  }),
  kotori_idle: N({
    id: "kotori_idle",
    speaker: "kotori",
    text: "{yoru}に なったら、ほしみだいに きてね",
  }),
  kotori_night: N({
    id: "kotori_night",
    speaker: "kotori",
    text: "きいて くれて うれしかった♪",
  }),
  kotori_morning: N({
    id: "kotori_morning",
    speaker: "kotori",
    text: "{ohayou}♪ いい こえで いえるかな？",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),

  // ===== おばあ（くま） =====
  obaa_greet: N({
    id: "obaa_greet",
    speaker: "obaa",
    text: "････（ゆっくり めを あけた）",
    palette: { categories: ["kind"], accept: { konnichiwa: "obaa_greet_ok" }, default: "obaa_greet_no" },
  }),
  obaa_greet_no: N({
    id: "obaa_greet_no",
    speaker: "obaa",
    text: "ほっほ。かわいい こえだねえ",
  }),
  obaa_greet_ok: N({
    id: "obaa_greet_ok",
    speaker: "obaa",
    text: "{konnichiwa}･･･。ああ、いい ことばだ",
    actions: [{ type: "event", name: "greet:obaa" }],
    next: "obaa_t1",
  }),
  obaa_t1: N({
    id: "obaa_t1",
    speaker: "obaa",
    text: "あわてなくて いいんだよ。ゆっくり おいき",
    actions: [{ type: "learnWord", id: "daijoubu", src: "おばあから" }],
    next: "obaa_t1b",
  }),
  obaa_t1b: N({
    id: "obaa_t1b",
    speaker: "obaa",
    text: "{daijoubu}、{daijoubu}。おまじないさ",
    actions: [{ type: "setFlag", flag: "obaa_t1_done" }],
  }),
  obaa_pan1: N({
    id: "obaa_pan1",
    speaker: "obaa",
    text: "おやまあ。いい においだねえ",
    next: "obaa_pan2",
  }),
  obaa_pan2: N({
    id: "obaa_pan2",
    speaker: "narration",
    text: "あずかった {pan}を わたした",
    actions: [{ type: "setFlag", flag: "q2_done" }],
    next: "obaa_pan3",
  }),
  obaa_pan3: N({
    id: "obaa_pan3",
    speaker: "narration",
    text: "おばあが、あたたかい ことばを くれた",
    actions: [{ type: "learnWord", id: "arigatou", src: "おばあから" }],
    next: "obaa_pan4",
  }),
  obaa_pan4: N({
    id: "obaa_pan4",
    speaker: "obaa",
    text: "{arigatou}。むねが あったかく なるだろう？",
    actions: [
      { type: "kokoro", kind: 1 },
      { type: "event", name: "save" },
    ],
  }),
  obaa_t2: N({
    id: "obaa_t2",
    speaker: "obaa",
    text: "この {mura}にもねえ、いろいろ あったんだよ",
    actions: [{ type: "learnWord", id: "mukashi", src: "おばあから" }],
    next: "obaa_t2b",
  }),
  obaa_t2b: N({
    id: "obaa_t2b",
    speaker: "obaa",
    text: "{mukashi}の はなしさ。また して あげよう",
    actions: [{ type: "setFlag", flag: "obaa_t2_done" }],
  }),
  obaa_t3: N({
    id: "obaa_t3",
    speaker: "obaa",
    text: "{mukashi}はね、きえて なくなりは しないんだよ",
    actions: [{ type: "learnWord", id: "omoide", src: "おばあから" }],
    next: "obaa_t3b",
  }),
  obaa_t3b: N({
    id: "obaa_t3b",
    speaker: "obaa",
    text: "むねに のこって {omoide}に なる。たからものさ",
    actions: [{ type: "setFlag", flag: "obaa_t3_done" }],
  }),
  obaa_idle: N({
    id: "obaa_idle",
    speaker: "obaa",
    text: "{daijoubu}。ゆっくり おいき",
  }),
  obaa_morning: N({
    id: "obaa_morning",
    speaker: "obaa",
    text: "{ohayou}｡ よく ねむれたかい",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),
};
