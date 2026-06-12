// レシピ定義 — SPEC.md §8-2
// r_hi_boss / r_kyu_b は実装上の追記（SPEC.md §8-2 注記参照）:
//   - r_hi_boss: ボス戦 P1 の正解「火」（単字）を成立させる
//   - r_kyu_b:   一度「休」を覚えたら 2 つ目以降の台座へ単字適用できる

export type RecipeKind = 'tanji' | 'ketsuji' | 'kaiji' | 'system';

export interface RecipeDef {
  id: string;
  kind: RecipeKind;
  /** 結字: 2字 / 単字・改字: 1字 */
  inputs: string[];
  /** 改字のみ: 対象の base 字 */
  base?: string;
  /** 単字のみ: 対象タグ */
  targetTag?: string;
  output: string;
  /** 成立時に表示する成り立ちフレーバー */
  flavor?: string;
}

export const RECIPES: RecipeDef[] = [
  // ---- 結字 ----
  {
    id: 'r_mei', kind: 'ketsuji', inputs: ['日', '月'], output: '明',
    flavor: 'いちばん あかるいもの、ふたつ。日と月をあわせて――「明」。',
  },
  {
    id: 'r_kyu', kind: 'ketsuji', inputs: ['人', '木'], output: '休',
    flavor: 'ひとが、木かげに よりかかる。それが「休」。',
  },
  {
    id: 'r_tou', kind: 'ketsuji', inputs: ['火', '丁'], output: '灯',
    flavor: 'あばれる火に、灯芯（丁）を。それが「灯」。',
  },
  // ---- 改字 ----
  {
    id: 'r_inu', kind: 'kaiji', base: '大', inputs: ['点'], output: '犬',
    flavor: 'おおきいだけの影に、点をひとつ――「犬」！',
  },
  {
    id: 'r_nagi', kind: 'kaiji', base: '風', inputs: ['止'], output: '凪',
    flavor: '風のなかに、止をうちこむ――「凪」。やまとの字じゃ。',
  },
  {
    id: 'r_tori', kind: 'kaiji', base: '烏', inputs: ['点'], output: '鳥',
    flavor: '烏は くろくて 目が見えぬ。目（点）をかいて――「鳥」。',
  },
  {
    id: 'r_gyoku', kind: 'kaiji', base: '王', inputs: ['点'], output: '玉',
    flavor: '王に ひとつぶ そえて――「玉」。',
  },
  {
    id: 'r_hon', kind: 'kaiji', base: '木', inputs: ['一'], output: '本',
    flavor: '木の根元に しるしを。「本」とは、はじまりのこと。',
  },
  // ---- 単字 ----
  { id: 'r_hi', kind: 'tanji', inputs: ['火'], targetTag: 'hearth', output: '火' },
  { id: 'r_ki', kind: 'tanji', inputs: ['木'], targetTag: 'driftwood', output: '木' },
  { id: 'r_mizu', kind: 'tanji', inputs: ['水'], targetTag: 'well', output: '水' },
  { id: 'r_hi_boss', kind: 'tanji', inputs: ['火'], targetTag: 'fire_beast', output: '火' },
  { id: 'r_kyu_b', kind: 'tanji', inputs: ['休'], targetTag: 'bench', output: '休' },
  // ---- システム（プレイヤー使用不可・ボス Phase2 演出専用） ----
  { id: 'sys_en', kind: 'system', inputs: ['火', '火'], output: '炎' },
];
