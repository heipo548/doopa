// SaveSystem — localStorage（SPEC.md §7-7）
// 破損 JSON は try/catch で新規データへフォールバック（§16）

import { SAVE_KEY } from '../config';

export interface SaveData {
  name: string;
  flags: string[];
  knownGlyphs: string[];
  gems: number;
  pos: { x: number; y: number };
  playtime: number;
  hintLevels: Record<string, number>;
}

export class SaveSystem {
  save(data: SaveData): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<SaveData>;
      if (
        typeof data !== 'object' ||
        data === null ||
        typeof data.name !== 'string' ||
        !Array.isArray(data.flags) ||
        !Array.isArray(data.knownGlyphs) ||
        typeof data.pos?.x !== 'number' ||
        typeof data.pos?.y !== 'number'
      ) {
        return null;
      }
      return {
        name: data.name,
        flags: data.flags,
        knownGlyphs: data.knownGlyphs,
        gems: typeof data.gems === 'number' ? data.gems : 0,
        pos: { x: data.pos.x, y: data.pos.y },
        playtime: typeof data.playtime === 'number' ? data.playtime : 0,
        hintLevels: data.hintLevels && typeof data.hintLevels === 'object' ? data.hintLevels : {},
      };
    } catch {
      return null;
    }
  }

  exists(): boolean {
    return this.load() !== null;
  }
}
