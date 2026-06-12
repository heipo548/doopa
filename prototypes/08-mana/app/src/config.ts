// 真名 -マナ- 体験版 共通定数（SPEC.md §3, §13-0 準拠）

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const WORLD_WIDTH = 2880;
export const WORLD_HEIGHT = 1620;

export const SAVE_KEY = 'mana-demo-v1';
export const FONT = '"Shippori Mincho", "Hiragino Mincho ProN", serif';

export const PLAYER_SPEED = 160;
export const INTERACT_RADIUS = 48;
export const LISTEN_RADIUS = 90;
export const NAMING_RADIUS = 110;
export const LISTEN_HOLD_MS = 600;

export const DEFAULT_PLAYER_NAME = 'ヒビキ';
export const SISTER_NAME = '灯里'; // あかり。一文字目「灯」を体験版で取り戻す

export const COLORS = {
  paper: 0xf5f0e6,
  paperStr: '#F5F0E6',
  ink: 0x2a2426,
  inkStr: '#2A2426',
  inkSoft: 0x4a4a4a,
  inkSoftStr: '#4A4A4A',
  monoGround: 0xe9e4d8,
  flame: 0xe06a30,
  gold: 0xe0a030,
  bossRed: 0xb03030,
};

// 話者カラー（SPEC.md §13-0）
export const SPEAKERS: Record<string, { label: string; color: string }> = {
  kotono: { label: 'コトノ婆', color: '#8C6E4A' },
  system: { label: '', color: '#4A4A4A' },
  hint: { label: 'きき診', color: '#6A6A72' },
  akari: { label: '？？？', color: '#E0A030' },
  boss: { label: '火のナナシ', color: '#B03030' },
  villager: { label: '村人', color: '#5A6A72' },
  player: { label: '', color: '#3A322C' },
};

export interface DialogueLine {
  speaker: keyof typeof SPEAKERS;
  text: string;
}

export const DEBUG = typeof location !== 'undefined' && location.search.includes('debug=1');
