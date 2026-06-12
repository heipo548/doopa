// 体験版のことば 30 語（DEMO_SPEC §8 の確定リスト）。
// hint はノートに載る一言メモ。全かな・20字以内 (§8)。
// この30語と {token} 表記がゲーム全体の「読める/読めない」を決める心臓部。
import type { Word } from "../types";

export const WORDS: Record<string, Word> = {
  // ---- world（14）----
  hana: { id: "hana", text: "はな", category: "world", hint: "つちから さいて いいにおい" },
  sora: { id: "sora", text: "そら", category: "world", hint: "みあげると どこまでも ひろい" },
  kaze: { id: "kaze", text: "かぜ", category: "world", hint: "みえないけど ほっぺに あたる" },
  ki: { id: "ki", text: "き", category: "world", hint: "のっぽの みどり。とりの おうち" },
  mizu: { id: "mizu", text: "みず", category: "world", hint: "つめたくて きらきら ながれる" },
  tsuchi: { id: "tsuchi", text: "つち", category: "world", hint: "ふかふか。たねの ふとん" },
  hatake: { id: "hatake", text: "はたけ", category: "world", hint: "つちを たがやす ばしょ" },
  pan: { id: "pan", text: "パン", category: "world", hint: "やきたては ふんわり あったかい" },
  mura: { id: "mura", text: "むら", category: "world", hint: "みんなで くらす ばしょ" },
  uta: { id: "uta", text: "うた", category: "world", hint: "こえが おどると うたに なる" },
  hoshi: { id: "hoshi", text: "ほし", category: "world", hint: "よるの そらで ひかる つぶ" },
  yoru: { id: "yoru", text: "よる", category: "world", hint: "そらが くらくなる じかん" },
  donguri: { id: "donguri", text: "どんぐり", category: "world", hint: "りすの だいすきな きのみ" },
  ie: { id: "ie", text: "いえ", category: "world", hint: "かえる ばしょ。あかりが ともる" },

  // ---- kind（11）----
  konnichiwa: { id: "konnichiwa", text: "こんにちは", category: "kind", hint: "であった ときの あいさつ" },
  ohayou: { id: "ohayou", text: "おはよう", category: "kind", hint: "あさの あいさつ。ひかりの あじ" },
  arigatou: { id: "arigatou", text: "ありがとう", category: "kind", hint: "もらった ときの ぽかぽか" },
  oishii: { id: "oishii", text: "おいしい", category: "kind", hint: "たべると ほっぺが おちる" },
  suki: { id: "suki", text: "すき", category: "kind", hint: "むねが ぽかぽかする きもち" },
  issho: { id: "issho", text: "いっしょ", category: "kind", hint: "ひとりじゃ ない ということ" },
  tomodachi: {
    id: "tomodachi",
    text: "ともだち",
    category: "kind",
    hint: "すき と いっしょ から うまれた",
    prereq: ["suki", "issho"],
  },
  gomenne: { id: "gomenne", text: "ごめんね", category: "kind", hint: "けんかを とかす ひとこと" },
  daijoubu: { id: "daijoubu", text: "だいじょうぶ", category: "kind", hint: "こわくないよ、の おまじない" },
  tanoshii: { id: "tanoshii", text: "たのしい", category: "kind", hint: "わらいが とまらない きもち" },
  nakanaori: { id: "nakanaori", text: "なかなおり", category: "kind", hint: "けんかの おわりに さく はな" },

  // ---- sad（4）----
  samishii: { id: "samishii", text: "さみしい", category: "sad", hint: "ひとりの よるの つめたさ" },
  kanashii: {
    id: "kanashii",
    text: "かなしい",
    category: "sad",
    hint: "なみだが でてくる きもち",
    effects: ["reveal_sad"],
  },
  mukashi: { id: "mukashi", text: "むかし", category: "sad", hint: "いまじゃない とおい ひのこと" },
  omoide: {
    id: "omoide",
    text: "おもいで",
    category: "sad",
    hint: "むかしが むねに のこした たから",
    prereq: ["mukashi"],
  },

  // ---- dark（1）※取り逃し可 ----
  uso: {
    id: "uso",
    text: "うそ",
    category: "dark",
    hint: "ほんとう じゃない ことば",
    effects: ["lie_shake"],
  },

  // ---- truth（0）----
  // OPナレーションで「？？？」がチラ見えするのみ。
  // ノート最終ページに空枠を1つだけ置く（体験版では永遠に埋まらない伏線）。
};

export const WORD_COUNT = Object.keys(WORDS).length; // = 30

// ノート・パレットでのカテゴリ表示順と表示名
export const CATEGORY_ORDER = ["world", "kind", "sad", "dark", "truth"] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  world: "せかい",
  kind: "ぽかぽか",
  sad: "しんみり",
  dark: "くらやみ",
  truth: "？？？",
};
