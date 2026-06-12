// HintSystem — きき診（SPEC.md §7-5）
// 対象ごとに3段階。使うたび段階が進む（3でとまる）。段階はセーブされる。
// 段階2以上で改字対象の base 字が判明する（NamingOverlay が参照）。

import { HINTS, HINT_FALLBACK } from '../data/hints';

export class HintSystem {
  private levels: Record<string, number> = {};

  /** 現在の段階のヒントを返し、段階を進める */
  listen(targetId: string): { text: string; stage: number } {
    const defs = HINTS[targetId];
    const cur = Math.min(this.levels[targetId] ?? 0, 2);
    if (!defs) return { text: HINT_FALLBACK, stage: cur + 1 };
    this.levels[targetId] = Math.min(cur + 1, 3);
    return { text: defs[cur as 0 | 1 | 2], stage: cur + 1 };
  }

  stage(targetId: string): number {
    return this.levels[targetId] ?? 0;
  }

  /** 改字対象の正体（base字）が判明しているか */
  baseRevealed(targetId: string): boolean {
    return this.stage(targetId) >= 2;
  }

  forceReveal(targetId: string): void {
    this.levels[targetId] = Math.max(this.levels[targetId] ?? 0, 2);
  }

  snapshot(): Record<string, number> {
    return { ...this.levels };
  }

  load(levels: Record<string, number>): void {
    this.levels = { ...levels };
  }

  reset(): void {
    this.levels = {};
  }
}
