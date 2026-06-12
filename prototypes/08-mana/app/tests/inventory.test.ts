// Inventory — 語彙は消費なし・重複なし・習得順（SPEC.md §7-2）

import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/systems/Inventory';

describe('Inventory', () => {
  it('追加と重複排除', () => {
    const inv = new Inventory();
    expect(inv.add('火')).toBe(true);
    expect(inv.add('火')).toBe(false);
    expect(inv.has('火')).toBe(true);
    expect(inv.list()).toEqual(['火']);
  });

  it('習得順を保持し、recent は直近 n 字', () => {
    const inv = new Inventory();
    for (const g of ['人', '火', '日', '月', '明', '木']) inv.add(g);
    expect(inv.list()).toEqual(['人', '火', '日', '月', '明', '木']);
    expect(inv.recent(5)).toEqual(['火', '日', '月', '明', '木']);
  });

  it('load / reset', () => {
    const inv = new Inventory();
    inv.load(['火', '火', '木'], 2);
    expect(inv.list()).toEqual(['火', '木']);
    expect(inv.gems).toBe(2);
    inv.reset(['人']);
    expect(inv.list()).toEqual(['人']);
    expect(inv.gems).toBe(0);
  });
});
