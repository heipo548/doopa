// データ整合性 — 配線漏れをユニットテストで検出する
// ・命名可能な全対象に3段階ヒントがある（SPEC.md §7-5「全対象に3段階を定義」）
// ・プレイヤーが作れる全 glyph に EffectRegistry ハンドラがある（§7-4）

import { describe, expect, it } from 'vitest';
import { ENTITIES } from '../src/data/entities';
import { HINTS } from '../src/data/hints';
import { RECIPES } from '../src/data/recipes';
import { EffectRegistry } from '../src/systems/EffectRegistry';
import { HintSystem } from '../src/systems/HintSystem';

describe('hints データ', () => {
  it('命名可能な全エンティティ＋ボスに3段階ヒントがある', () => {
    for (const e of ENTITIES) {
      if (!e.nameable && e.id !== 'boss_fire') continue;
      expect(HINTS[e.id], `HINTS[${e.id}] がない`).toBeDefined();
      expect(HINTS[e.id]).toHaveLength(3);
    }
  });

  it('きき診は使うたび段階が進み、3で止まる。段階2で base 判明', () => {
    const h = new HintSystem();
    expect(h.baseRevealed('bigshadow')).toBe(false);
    expect(h.listen('bigshadow').stage).toBe(1);
    expect(h.baseRevealed('bigshadow')).toBe(false);
    expect(h.listen('bigshadow').stage).toBe(2);
    expect(h.baseRevealed('bigshadow')).toBe(true);
    expect(h.listen('bigshadow').stage).toBe(3);
    expect(h.listen('bigshadow').stage).toBe(3); // それ以上進まない
  });
});

describe('recipes × effects の配線', () => {
  it('プレイヤーが成立させうる全 glyph にハンドラがある', () => {
    const reg = new EffectRegistry();
    for (const r of RECIPES) {
      if (r.kind === 'system') continue;
      expect(reg.has(r.output), `EffectRegistry に「${r.output}」がない`).toBe(true);
    }
  });
});
