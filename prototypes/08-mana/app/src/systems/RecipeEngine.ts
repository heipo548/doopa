// RecipeEngine — SPEC.md §7-3（純粋関数・テスト必須）
// 解決順序:
//  ① targetBase があれば改字テーブル（不一致なら base＋修飾字 で結字テーブルへフォールバック。
//     例: ボス戦の改字UI 火＋丁 → 灯）
//  ② 2字なら結字テーブル（順不同一致・system は除外）
//  ③ 1字なら単字テーブル（対象タグと一致するもの）
//  ④ null（ソフト失敗）

import type { RecipeDef } from '../data/recipes';

export type RecipeResult = { glyph: string; recipeId: string; flavor?: string } | null;

export class RecipeEngine {
  constructor(private readonly recipes: RecipeDef[]) {}

  resolve(inputs: string[], targetBase?: string, targetTags: string[] = []): RecipeResult {
    const ins = inputs.filter((c) => c.length > 0);
    if (ins.length === 0) return null;

    // ① 改字
    if (targetBase && ins.length === 1) {
      const modifier = ins[0];
      const kaiji = this.recipes.find(
        (r) => r.kind === 'kaiji' && r.base === targetBase && r.inputs[0] === modifier,
      );
      if (kaiji) return { glyph: kaiji.output, recipeId: kaiji.id, flavor: kaiji.flavor };
      const fallback = this.findKetsuji([targetBase, modifier]);
      if (fallback) return { glyph: fallback.output, recipeId: fallback.id, flavor: fallback.flavor };
    }

    // ② 結字
    if (ins.length === 2) {
      const ketsuji = this.findKetsuji(ins);
      if (ketsuji) return { glyph: ketsuji.output, recipeId: ketsuji.id, flavor: ketsuji.flavor };
    }

    // ③ 単字
    if (ins.length === 1) {
      const tanji = this.recipes.find(
        (r) =>
          r.kind === 'tanji' &&
          r.inputs[0] === ins[0] &&
          r.targetTag !== undefined &&
          targetTags.includes(r.targetTag),
      );
      if (tanji) return { glyph: tanji.output, recipeId: tanji.id, flavor: tanji.flavor };
    }

    return null;
  }

  /** UI のおすすめ明滅用: 今の選択に c を足すとレシピが成立するか */
  canComplete(selected: string[], c: string, targetBase?: string, targetTags: string[] = []): boolean {
    return this.resolve([...selected, c], targetBase, targetTags) !== null;
  }

  private findKetsuji(pair: string[]): RecipeDef | undefined {
    return this.recipes.find(
      (r) =>
        r.kind === 'ketsuji' &&
        ((r.inputs[0] === pair[0] && r.inputs[1] === pair[1]) ||
          (r.inputs[0] === pair[1] && r.inputs[1] === pair[0])),
    );
  }
}
