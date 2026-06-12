// FlagManager

import { describe, expect, it } from 'vitest';
import { FlagManager } from '../src/systems/FlagManager';

describe('FlagManager', () => {
  it('set / has / list / load / reset', () => {
    const f = new FlagManager();
    expect(f.has('p0_done')).toBe(false);
    f.set('p0_done');
    f.set('p0_done');
    expect(f.has('p0_done')).toBe(true);
    expect(f.list()).toEqual(['p0_done']);
    f.load(['a', 'b']);
    expect(f.has('p0_done')).toBe(false);
    expect(f.has('a')).toBe(true);
    f.reset();
    expect(f.list()).toEqual([]);
  });
});
