// レベルデータ「灯し村」 — SPEC.md §9（座標は §9-2 初期値準拠・構造維持で微調整済み）

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 常時有効な静的コリジョン（外周・崖・建物） */
export const WALLS: Rect[] = [
  { x: 0, y: 0, w: 2880, h: 100 }, // 外周・北
  { x: 0, y: 1460, w: 2880, h: 160 }, // 外周・南
  { x: 0, y: 0, w: 380, h: 1620 }, // 外周・西
  { x: 2600, y: 0, w: 280, h: 1620 }, // 外周・東
  { x: 380, y: 400, w: 180, h: 260 }, // 風の丘と広場の間（西）
  { x: 900, y: 400, w: 240, h: 260 }, // 犬の道と社の間
  { x: 1140, y: 400, w: 1460, h: 300 }, // 中央帯（社の南崖）
  { x: 1750, y: 100, w: 850, h: 300 }, // 社の東
  { x: 1150, y: 700, w: 350, h: 120 }, // 東通路の上
  { x: 1150, y: 1000, w: 350, h: 150 }, // 東通路の下
  { x: 1860, y: 700, w: 100, h: 200 }, // 暗がりの間・東壁（y900以下に抜け口）
  { x: 1500, y: 1010, w: 360, h: 140 }, // 暗がりの間・南壁
  { x: 1960, y: 700, w: 640, h: 200 }, // 川の北の崖
  { x: 380, y: 1150, w: 620, h: 310 }, // 広場の南西ふさぎ
  { x: 460, y: 730, w: 130, h: 100 }, // コトノ婆の家
  { x: 2100, y: 900, w: 500, h: 150 }, // 東岸の北崖
];

/** 川（x1960-2100）。mid は p2_bridge で通行可になる */
export const RIVER_SOLID: Rect[] = [
  { x: 1960, y: 900, w: 140, h: 370 },
  { x: 1960, y: 1330, w: 140, h: 130 },
];
export const RIVER_BRIDGE_GAP: Rect = { x: 1960, y: 1270, w: 140, h: 60 };
export const RIVER_VIEW: Rect = { x: 1960, y: 900, w: 140, h: 560 };

/** 大きな影（P3）の通せんぼコリジョン（p3_done で消える） */
export const SHADOW_BLOCKER: Rect = { x: 560, y: 530, w: 340, h: 70 };

/** 嵐（P4）の通せんぼ＆風圧ゾーン（p4_done で消える） */
export const STORM_ZONE: Rect = { x: 860, y: 100, w: 280, h: 300 };

/** 暗がりの間（P1） */
export const DARK_ZONE: Rect = { x: 1500, y: 700, w: 360, h: 310 };
export const DARK_DEEP_X = 1800; // 明なしでここより奥に進むと入口へ戻される
export const DARK_ENTRANCE = { x: 1520, y: 950 };

/** ボス戦アリーナ（社） */
export const BOSS_ARENA: Rect = { x: 1140, y: 100, w: 610, h: 300 };
export const BOSS_GATE: Rect = { x: 1140, y: 100, w: 24, h: 300 }; // 戦闘中のみ閉じる
export const BOSS_HOME = { x: 1480, y: 260 };
export const BOSS_TRIGGER_X = 1230; // p4_done 後、これより東でボス起動

export interface ZoneDef {
  id: string;
  rect: Rect;
  /** モノクロ時の地面トーン */
  mono: number;
  /** 彩色後の地面トーン */
  color: number;
}

export const ZONES: ZoneDef[] = [
  { id: 'plaza', rect: { x: 380, y: 650, w: 770, h: 510 }, mono: 0xe9e4d8, color: 0xf0e2c4 },
  { id: 'hill', rect: { x: 380, y: 100, w: 760, h: 560 }, mono: 0xe4e0d4, color: 0xd9e4c2 },
  { id: 'shrine', rect: { x: 1140, y: 100, w: 610, h: 300 }, mono: 0xe6e0d2, color: 0xf0d2bc },
  { id: 'path', rect: { x: 1150, y: 820, w: 350, h: 180 }, mono: 0xe7e2d6, color: 0xeae2c8 },
  { id: 'dark', rect: { x: 1500, y: 700, w: 360, h: 310 }, mono: 0xd8d4cc, color: 0xd8d8ea },
  { id: 'south', rect: { x: 1000, y: 1150, w: 700, h: 310 }, mono: 0xe7e1d2, color: 0xe6e0bc },
  { id: 'river', rect: { x: 1700, y: 900, w: 900, h: 560 }, mono: 0xe3e0d8, color: 0xcce0d8 },
];

/** 彩色クライマックスのカメラ巡行順（§7-8 / §12 J4） */
export const COLORIZE_PAN: { x: number; y: number; zone: string }[] = [
  { x: 760, y: 900, zone: 'plaza' },
  { x: 1300, y: 950, zone: 'path' },
  { x: 1650, y: 850, zone: 'dark' },
  { x: 1900, y: 1250, zone: 'river' },
  { x: 1350, y: 1280, zone: 'south' },
  { x: 650, y: 380, zone: 'hill' },
  { x: 1430, y: 250, zone: 'shrine' },
];

export interface DecorDef {
  type:
    | 'tree'
    | 'pine'
    | 'stone'
    | 'grass'
    | 'flower'
    | 'torii'
    | 'house'
    | 'shrineHouse'
    | 'fence'
    | 'stoneLantern'
    | 'path';
  x: number;
  y: number;
  s?: number;
}

export const DECORS: DecorDef[] = [
  // 建物・社
  { type: 'house', x: 525, y: 780 },
  { type: 'shrineHouse', x: 1480, y: 150 },
  { type: 'torii', x: 1180, y: 250 },
  // 木々
  { type: 'tree', x: 440, y: 1100, s: 1 },
  { type: 'tree', x: 1080, y: 700, s: 0.8 },
  { type: 'tree', x: 2480, y: 1100, s: 1.1 },
  { type: 'tree', x: 2240, y: 1190, s: 0.9 },
  { type: 'tree', x: 1620, y: 1400, s: 1 },
  { type: 'tree', x: 420, y: 200, s: 0.9 },
  { type: 'tree', x: 1280, y: 1180, s: 0.85 },
  { type: 'tree', x: 2520, y: 1380, s: 0.95 },
  { type: 'pine', x: 1700, y: 330, s: 1.1 },
  { type: 'pine', x: 1260, y: 170, s: 0.9 },
  { type: 'pine', x: 640, y: 150, s: 0.85 },
  // 石・草・花
  { type: 'stone', x: 950, y: 1080 },
  { type: 'stone', x: 1280, y: 1380 },
  { type: 'stone', x: 720, y: 240 },
  { type: 'stone', x: 2160, y: 1300, s: 0.7 },
  { type: 'grass', x: 880, y: 1020 },
  { type: 'grass', x: 1540, y: 1230 },
  { type: 'grass', x: 2300, y: 1330 },
  { type: 'grass', x: 600, y: 470 },
  { type: 'grass', x: 1340, y: 900 },
  { type: 'grass', x: 520, y: 950 },
  { type: 'grass', x: 1750, y: 1100 },
  { type: 'grass', x: 2450, y: 1240 },
  { type: 'grass', x: 800, y: 380 },
  { type: 'flower', x: 905, y: 1035 },
  { type: 'flower', x: 560, y: 935 },
  { type: 'flower', x: 1565, y: 1245 },
  { type: 'flower', x: 2320, y: 1345, s: 1.1 },
  { type: 'flower', x: 1360, y: 915 },
  { type: 'flower', x: 825, y: 395, s: 0.9 },
  { type: 'flower', x: 2425, y: 1255 },
  // 柵・敷石・石灯籠
  { type: 'fence', x: 470, y: 690 },
  { type: 'fence', x: 1100, y: 1170, s: 0.9 },
  { type: 'path', x: 760, y: 845, s: 0.9 },
  { type: 'path', x: 1320, y: 255, s: 1 },
  { type: 'stoneLantern', x: 1255, y: 305 },
  { type: 'stoneLantern', x: 1610, y: 300 },
  { type: 'stoneLantern', x: 640, y: 800, s: 0.9 },
];

export const PLAYER_START = { x: 700, y: 900 };
export const NPCS = [
  { id: 'kotono', x: 620, y: 840 },
  { id: 'villager_a', x: 980, y: 780 },
  { id: 'villager_b', x: 2420, y: 1230 },
];

/** 立て札（P2ヒント） */
export const TATEFUDA = { x: 1820, y: 1380 };

/** デバッグ用テレポート先（?debug=1 のみ） */
export const DEBUG_SPOTS: { key: string; x: number; y: number; label: string }[] = [
  { key: 'ONE', x: 700, y: 900, label: '広場' },
  { key: 'TWO', x: 1550, y: 900, label: '暗がり' },
  { key: 'THREE', x: 1880, y: 1200, label: '川辺' },
  { key: 'FOUR', x: 2300, y: 1200, label: '東岸' },
  { key: 'FIVE', x: 700, y: 470, label: '丘' },
  { key: 'SIX', x: 600, y: 250, label: '風の丘' },
  { key: 'SEVEN', x: 1300, y: 250, label: '社' },
];
