// E3: みなみひろばの口げんか（りす×ふくろう）前後の会話。
// バトル本体は data/battles.ts。ここは導入（ごめんね習得）と勝利後
// （なかなおり・いっしょ・どんぐり習得）を受け持つ。
import type { DialogueNode } from "../../types";

const N = (n: DialogueNode) => n;

export const PLAZA_NODES: Record<string, DialogueNode> = {
  // ===== 導入（ゾーン or 本人に話しかけて発火） =====
  e3_intro1: N({
    id: "e3_intro1",
    speaker: "narration",
    text: "おおきな こえが きこえる",
    actions: [{ type: "setFlag", flag: "e3_seen" }],
    next: "e3_intro2",
  }),
  e3_intro2: N({
    id: "e3_intro2",
    speaker: "fukurou",
    text: "それは わしの {donguri}じゃ！",
    next: "e3_intro3",
  }),
  e3_intro3: N({
    id: "e3_intro3",
    speaker: "risu",
    text: "ちがうもん！ ぼくが ひろったの！",
    next: "e3_intro4",
  }),
  e3_intro4: N({
    id: "e3_intro4",
    speaker: "usagi",
    text: "けんかだ･･･。ねえ、これを おぼえてて",
    actions: [{ type: "learnWord", id: "gomenne", src: "うさぎから" }],
    next: "e3_intro5",
  }),
  e3_intro5: N({
    id: "e3_intro5",
    speaker: "usagi",
    text: "{gomenne}。けんかを とかす ことば",
    next: "e3_intro6",
  }),
  e3_intro6: N({
    id: "e3_intro6",
    speaker: "usagi",
    text: "おねがい。ふたりを とめて あげて",
    next: "e3_confront",
  }),
  e3_confront: N({
    id: "e3_confront",
    speaker: "narration",
    text: "ふたりは にらみあって いる",
    choices: [
      { label: "あいだに はいる", next: "e3_go" },
      { label: "もうすこし みて いる", next: "e3_leave" },
    ],
  }),
  e3_go: N({
    id: "e3_go",
    speaker: "narration",
    text: "",
    actions: [{ type: "startBattle", id: "e3" }],
  }),
  e3_leave: N({
    id: "e3_leave",
    speaker: "narration",
    text: "ふたりの こえは まだ つづいて いる･･･",
  }),

  // ===== バトル中のリトライ（敗北は存在しない §4.4） =====
  e3_retry: N({
    id: "e3_retry",
    speaker: "usagi",
    text: "{daijoubu}。もういちど、ゆっくり はなそう",
  }),

  // ===== 勝利後 =====
  e3_win1: N({
    id: "e3_win1",
    speaker: "narration",
    text: "ふたりの かたから、ふっと ちからが ぬけた",
    next: "e3_win2",
  }),
  e3_win2: N({
    id: "e3_win2",
    speaker: "fukurou",
    text: "･･･わしも いいすぎたのじゃ。{gomenne}",
    next: "e3_win3",
  }),
  e3_win3: N({
    id: "e3_win3",
    speaker: "risu",
    text: "ぼくこそ {gomenne}、なの",
    next: "e3_win4",
  }),
  e3_win4: N({
    id: "e3_win4",
    speaker: "narration",
    text: "ふたりの あいだに、あたたかい ものが もどって いく",
    actions: [{ type: "learnWord", id: "nakanaori", src: "けんかの おわりに" }],
    next: "e3_win5",
  }),
  e3_win5: N({
    id: "e3_win5",
    speaker: "narration",
    text: "{nakanaori}。けんかの おわりの ことば",
    next: "e3_win6",
  }),
  e3_win6: N({
    id: "e3_win6",
    speaker: "risu",
    text: "ねえ、はんぶんこに しよう！ ふたりで たべよ！",
    actions: [{ type: "learnWord", id: "issho", src: "ふたりを みて いて" }],
    next: "e3_win7",
  }),
  e3_win7: N({
    id: "e3_win7",
    speaker: "narration",
    text: "{issho}。ひとりじゃ ない、って ことばだ",
    next: "e3_win8",
  }),
  e3_win8: N({
    id: "e3_win8",
    speaker: "fukurou",
    text: "ほっほ。これは きみに おれいじゃ",
    next: "e3_win9",
  }),
  e3_win9: N({
    id: "e3_win9",
    speaker: "narration",
    text: "まるくて つやつやの きのみを もらった",
    actions: [{ type: "learnWord", id: "donguri", src: "ふくろうから もらった" }],
    next: "e3_win10",
  }),
  e3_win10: N({
    id: "e3_win10",
    speaker: "narration",
    text: "{donguri}！ りすの たからもの",
    next: "e3_win11",
  }),
  e3_win11: N({
    id: "e3_win11",
    speaker: "usagi",
    text: "すごい すごい！ ふたりとも にっこりだ！",
    next: "e3_win12",
  }),
  e3_win12: N({
    id: "e3_win12",
    speaker: "usagi",
    text: "ねえ。もりはずれの {ki}の したの きつねのこにも、あいに いって あげて",
    actions: [
      { type: "setFlag", flag: "e3_done" },
      { type: "kokoro", kind: 1 },
      { type: "event", name: "save" },
    ],
  }),

  // ===== その後の りす・ふくろう =====
  risu_after: N({
    id: "risu_after",
    speaker: "risu",
    text: "{donguri}、はんぶんこ したの！ {issho}に たべたの！",
  }),
  fukurou_after: N({
    id: "fukurou_after",
    speaker: "fukurou",
    text: "ほっほ。わしらは {nakanaori} したのじゃ",
  }),
  risu_night: N({
    id: "risu_night",
    speaker: "risu",
    text: "{hoshi}、きらきら なの",
  }),
  fukurou_night: N({
    id: "fukurou_night",
    speaker: "fukurou",
    text: "ほっほ。{yoru}は わしの じかんじゃ",
  }),
  risu_morning: N({
    id: "risu_morning",
    speaker: "risu",
    text: "{ohayou}！ なの！",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),
  fukurou_morning: N({
    id: "fukurou_morning",
    speaker: "fukurou",
    text: "{ohayou}｡ ほっほ、ねむい のう",
    actions: [{ type: "learnWord", id: "ohayou", src: "あさの むらで" }],
  }),
};
