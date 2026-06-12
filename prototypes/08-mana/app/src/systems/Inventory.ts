// Inventory — 言ノ葉は消費なし・語彙として永続（SPEC.md §7-2）

export class Inventory {
  private glyphs: string[] = [];
  gems = 0;

  add(glyph: string): boolean {
    if (this.glyphs.includes(glyph)) return false;
    this.glyphs.push(glyph);
    return true;
  }

  has(glyph: string): boolean {
    return this.glyphs.includes(glyph);
  }

  /** 習得順の語彙一覧 */
  list(): string[] {
    return [...this.glyphs];
  }

  /** HUD 用: 直近 n 字 */
  recent(n: number): string[] {
    return this.glyphs.slice(-n);
  }

  load(glyphs: string[], gems: number): void {
    this.glyphs = [...new Set(glyphs)];
    this.gems = gems;
  }

  reset(initial: string[]): void {
    this.glyphs = [...initial];
    this.gems = 0;
  }
}
