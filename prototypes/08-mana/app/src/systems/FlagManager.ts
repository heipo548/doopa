// FlagManager — 進行フラグ管理

export class FlagManager {
  private flags = new Set<string>();

  set(flag: string): void {
    this.flags.add(flag);
  }

  has(flag: string): boolean {
    return this.flags.has(flag);
  }

  list(): string[] {
    return [...this.flags];
  }

  load(flags: string[]): void {
    this.flags = new Set(flags);
  }

  reset(): void {
    this.flags.clear();
  }
}
