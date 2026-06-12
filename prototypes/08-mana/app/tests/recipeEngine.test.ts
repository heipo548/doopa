// RecipeEngine — 全レシピ＋失敗系（SPEC.md §15 M1 受け入れ条件）

import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data/recipes';
import { RecipeEngine } from '../src/systems/RecipeEngine';

const engine = new RecipeEngine(RECIPES);

describe('結字（順不同一致）', () => {
  it('日＋月 → 明', () => {
    expect(engine.resolve(['日', '月'])?.glyph).toBe('明');
    expect(engine.resolve(['月', '日'])?.glyph).toBe('明');
  });
  it('人＋木 → 休', () => {
    expect(engine.resolve(['人', '木'])?.glyph).toBe('休');
    expect(engine.resolve(['木', '人'])?.glyph).toBe('休');
  });
  it('火＋丁 → 灯', () => {
    expect(engine.resolve(['火', '丁'])?.glyph).toBe('灯');
  });
  it('未定義の組合せは null（ソフト失敗）', () => {
    expect(engine.resolve(['日', '木'])).toBeNull();
    expect(engine.resolve(['点', '止'])).toBeNull();
  });
});

describe('改字（targetBase ＋ 修飾字）', () => {
  it('大＋点 → 犬', () => {
    expect(engine.resolve(['点'], '大')?.glyph).toBe('犬');
  });
  it('風＋止 → 凪', () => {
    expect(engine.resolve(['止'], '風')?.glyph).toBe('凪');
  });
  it('烏＋点 → 鳥', () => {
    expect(engine.resolve(['点'], '烏')?.glyph).toBe('鳥');
  });
  it('王＋点 → 玉', () => {
    expect(engine.resolve(['点'], '王')?.glyph).toBe('玉');
  });
  it('木＋一 → 本', () => {
    expect(engine.resolve(['一'], '木')?.glyph).toBe('本');
  });
  it('改字テーブル不一致 → 結字フォールバック（ボス戦: base火＋丁 → 灯）', () => {
    expect(engine.resolve(['丁'], '火')?.glyph).toBe('灯');
  });
  it('base に合わない修飾字は null', () => {
    expect(engine.resolve(['一'], '大')).toBeNull();
    expect(engine.resolve(['止'], '烏')).toBeNull();
  });
});

describe('単字（対象タグ一致）', () => {
  it('火 → 竈（tag:hearth）', () => {
    expect(engine.resolve(['火'], undefined, ['hearth'])?.glyph).toBe('火');
  });
  it('火 → ボス（tag:fire_beast）', () => {
    expect(engine.resolve(['火'], undefined, ['fire_beast'])?.glyph).toBe('火');
  });
  it('木 → 流木 / 水 → 井戸 / 休 → 台座', () => {
    expect(engine.resolve(['木'], undefined, ['driftwood'])?.glyph).toBe('木');
    expect(engine.resolve(['水'], undefined, ['well'])?.glyph).toBe('水');
    expect(engine.resolve(['休'], undefined, ['bench'])?.glyph).toBe('休');
  });
  it('タグ不一致は null', () => {
    expect(engine.resolve(['火'], undefined, ['driftwood'])).toBeNull();
    expect(engine.resolve(['火'], undefined, [])).toBeNull();
    expect(engine.resolve(['点'], undefined, ['hearth'])).toBeNull();
  });
});

describe('システムレシピ（sys_en）はプレイヤー使用不可', () => {
  it('火＋火 → null', () => {
    expect(engine.resolve(['火', '火'])).toBeNull();
    expect(engine.resolve(['火'], '火')).toBeNull(); // 改字フォールバック経由でも不可
  });
});

describe('入力の正規化', () => {
  it('空入力は null', () => {
    expect(engine.resolve([])).toBeNull();
    expect(engine.resolve(['', ''])).toBeNull();
  });
  it('3字以上は null', () => {
    expect(engine.resolve(['日', '月', '木'])).toBeNull();
  });
});

describe('canComplete（おすすめ明滅）', () => {
  it('日を選択中 → 月で成立', () => {
    expect(engine.canComplete(['日'], '月')).toBe(true);
    expect(engine.canComplete(['日'], '木')).toBe(false);
  });
  it('改字: base大 → 点で成立', () => {
    expect(engine.canComplete([], '点', '大')).toBe(true);
    expect(engine.canComplete([], '一', '大')).toBe(false);
  });
});
