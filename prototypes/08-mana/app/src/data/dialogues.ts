// 会話・テキストデータ — SPEC.md §13（口調ガイド §13-0 準拠）
// {NAME} はプレイヤー名に置換される。

import type { DialogueLine } from '../config';

export const PROLOGUE_CUTS: { lines: string[]; visual?: 'table' }[] = [
  { lines: ['言ノ国。', 'すべてのものは、名前で 世界に つながれている。'] },
  { lines: ['名を失えば――ナナシ。', '色も、音も、覚えていたことすら、こぼれおちる。'] },
  { lines: ['（家の食卓。椅子が ひとつ、空いている）'], visual: 'table' },
  { lines: ['ゆうべ、黙（しじま）が 村の はずれを かすめた。'] },
  { lines: ['家族は だれも、気づいていない。', 'だれが いないのかすら、わからない。'] },
  { lines: ['でも、わたしだけが おぼえている。', '――あの椅子に すわっていた、ちいさな 声を。'] },
  { lines: ['コトノ婆が、{NAME}に', '名付け師の 言ノ葉を、しずかに 託す。'] },
  { lines: ['「ほれ。なまえを、とりもどしに ゆくかね。」'] },
];

export const DIALOGUES: Record<string, DialogueLine[]> = {
  // --- コトノ婆 ---
  kotono_intro: [
    { speaker: 'kotono', text: 'ようきたね、{NAME}。みての通り、村は 名を 食われちまった。' },
    { speaker: 'kotono', text: 'そこの けはい……ありゃあ、竈（かまど）じゃった ものよ。' },
    { speaker: 'kotono', text: 'まずは 言ノ葉を ひろいなされ。そこに「火」の カケラが おちておる。' },
    { speaker: 'kotono', text: 'Q長押しで ものの声を きき、Spaceで 名を つける。それが 名付け師の すべてじゃ。' },
  ],
  kotono_after_p0: [
    { speaker: 'kotono', text: 'みたかえ。名付けとは、なおすことでは ない。' },
    { speaker: 'kotono', text: 'いばしょを、あたえる ことじゃ。' },
    { speaker: 'kotono', text: 'ほれ、これは「点」。たった一画が、字をかえ、世界をかえる。' },
    { speaker: 'system', text: '言ノ葉「点」を さずかった。' },
    { speaker: 'kotono', text: '東の間（ま）は くらく、北の道は 影が ふさいでおる。いそぎなさんな、ひとつずつ じゃ。' },
  ],
  kotono_idle_early: [
    { speaker: 'kotono', text: 'こまったら、Qで 声を きくのじゃ。三度きけば、こたえの そばまで ゆける。' },
  ],
  kotono_idle_mid: [
    { speaker: 'kotono', text: 'ひろった字は、きえぬ。おまえの あたまの なかが、いちばんの 道具箱よ。' },
  ],
  kotono_idle_late: [
    { speaker: 'kotono', text: '北の社から、あつい 風が くる……。あの火に、居場所を つくって おやり。' },
  ],
  // --- 村人 ---
  villager_a_mono: [{ speaker: 'villager', text: '…………。（声が、色を なくしている）' }],
  villager_a_color: [
    { speaker: 'villager', text: 'あ……あったかい。火だ。火が、もどった……！' },
    { speaker: 'villager', text: 'あんた、名付け師かい。たいしたもんだねえ。' },
  ],
  villager_b_mono: [{ speaker: 'villager', text: '…………。（のどが、かわいて いるようだ）' }],
  villager_b_color: [
    { speaker: 'villager', text: 'みず……水だ！　井戸が いきかえった！' },
    { speaker: 'villager', text: 'ありがとうよ。これで 畑も たすかる。' },
  ],
  // --- 立て札・物・環境 ---
  tateful: [{ speaker: 'system', text: '『ひとは、木のそばで、やすむもの』' }],
  plaque_before: [{ speaker: 'system', text: '村の名標。……よめない。名前が、ぬけおちている。' }],
  plaque_after: [
    { speaker: 'system', text: '『灯し村』――名前が、もどっている。' },
  ],
  waterwheel_look: [
    { speaker: 'system', text: 'とまった水車。歯車に「止」の カケラが ひっかかって いた。' },
  ],
  dark_deep: [{ speaker: 'system', text: 'くらすぎて、すすめない。あかりが いる。' }],
  dark_lit: [{ speaker: 'system', text: 'やみが、ひいていく。' }],
  well_dry: [{ speaker: 'system', text: 'そこの見えない 涸れ井戸。かわいた 風の音だけが する。' }],
  hole_no_dog: [{ speaker: 'system', text: 'ちいさな 掘り跡。ひとり では くぐれない。' }],
  hole_dig: [{ speaker: 'system', text: '犬が 穴を 掘りすすめた！　近道が ひらいた。' }],
  bench_rest: [
    { speaker: 'system', text: 'ひとやすみ した。（セーブしました）' },
  ],
  book_lore: [
    { speaker: 'system', text: '『むらの言い――よろずの物は 真名（まな）で 世界に つながれ、' },
    { speaker: 'system', text: '名を 食われた ものは ナナシと なりて、黙（しじま）に かえる。' },
    { speaker: 'system', text: 'されど 名は、呼ぶ者の あるかぎり、ほろびぬ』' },
  ],
  storm_blocked: [{ speaker: 'system', text: '風が つよすぎて、すすめない！' }],
  // --- ボス（§13-4） ---
  boss_intro: [
    { speaker: 'system', text: '――社が、燃えている。' },
    { speaker: 'boss', text: 'アツイ……ヒ……ナノニ……イバショ、ガ……ナイ……。' },
    { speaker: 'kotono', text: 'その火を、消しては ならぬぞ。名を――居場所を、あたえて やりなさい！' },
  ],
  boss_named: [
    { speaker: 'kotono', text: '名は、あたった……！　されど、居場所が、ない！' },
  ],
  boss_phase2: [
    { speaker: 'system', text: '火と火が かさなり――「炎」と 化した！' },
  ],
  boss_assist: [
    { speaker: 'kotono', text: '鐘じゃ！　社の鐘を 鳴らしなされ！　あの子の 足を とめるのじゃ！' },
  ],
  boss_bell_first: [
    { speaker: 'system', text: '鐘の音が、炎を しずめた。――梁から「丁」の 言ノ葉が おちてきた！' },
  ],
  boss_bell: [{ speaker: 'system', text: '鐘の音が、炎を しずめている……いまだ！' }],
  boss_resolve: [
    { speaker: 'system', text: 'あばれていた火が――灯籠に、宿った。' },
    { speaker: 'kotono', text: 'それで いい。火は、ひとを やく ものじゃない。てらす ものじゃ。' },
  ],
  sister_voice: [
    { speaker: 'akari', text: '………………にいちゃん？' },
  ],
  boss_flee: [{ speaker: 'system', text: 'いまは、はなれられない！' }],
  boss_too_hot: [{ speaker: 'system', text: 'ちかづけない――熱が つよすぎる。鐘で 足を とめるんだ。' }],
  // --- 名付け汎用 ---
  naming_mismatch: [{ speaker: 'system', text: '……「{GLYPH}」は、ここの 名では ないようだ。' }],
  naming_gag_dog: [
    { speaker: 'system', text: 'わん！　……竈は、犬には なれないようだ。' },
  ],
};

export function fillName(text: string, name: string): string {
  return text.replace(/\{NAME\}/g, name);
}
