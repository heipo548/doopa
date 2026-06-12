// エンティティ定義 — SPEC.md §8-3 / §9-2
// 状態機械: UNNAMED --正しい名付け--> NAMED（実体化・彩色） / 無効はソフト失敗（§7-1）

export type EntityState = 'unnamed' | 'named' | 'env' | 'device' | 'boss';

export interface EntityDef {
  id: string;
  /** 調べ・きき診時の呼称 */
  label: string;
  x: number;
  y: number;
  state: EntityState;
  /** 改字対象の base 字（きき診 stage2 以上で判明。state==='named' なら最初から見える） */
  base?: string;
  /** 単字レシピの対象タグ */
  tags: string[];
  /** 解決済みを示すフラグ */
  doneFlag?: string;
  /** ナナシ描画の半径 */
  size?: number;
  /** 名付け（Space）可能か */
  nameable: boolean;
}

export const ENTITIES: EntityDef[] = [
  {
    id: 'kamado', label: 'なにかの けはい', x: 840, y: 880, state: 'unnamed',
    tags: ['hearth'], doneFlag: 'p0_done', size: 26, nameable: true,
  },
  {
    id: 'darkness', label: 'くらやみ', x: 1565, y: 860, state: 'env',
    tags: ['dark'], doneFlag: 'p1_done', size: 30, nameable: true,
  },
  {
    id: 'driftwood', label: 'ながれついた なにか', x: 2010, y: 1300, state: 'unnamed',
    tags: ['driftwood'], doneFlag: 'p2_bridge', size: 24, nameable: true,
  },
  {
    id: 'bench1', label: '休み処の台座', x: 1880, y: 1180, state: 'device',
    tags: ['bench'], doneFlag: 'bench1_built', size: 18, nameable: true,
  },
  {
    id: 'bench2', label: '休み処の台座', x: 1200, y: 300, state: 'device',
    tags: ['bench'], doneFlag: 'bench2_built', size: 18, nameable: true,
  },
  {
    id: 'bigshadow', label: 'おおきな影', x: 700, y: 560, state: 'unnamed',
    base: '大', tags: ['shadow'], doneFlag: 'p3_done', size: 64, nameable: true,
  },
  {
    id: 'stormwall', label: 'あれくるう風', x: 800, y: 280, state: 'unnamed',
    base: '風', tags: ['storm'], doneFlag: 'p4_done', size: 50, nameable: true,
  },
  {
    id: 'crow', label: '烏', x: 2200, y: 1400, state: 'named',
    base: '烏', tags: ['crow'], doneFlag: 's1_done', size: 16, nameable: true,
  },
  {
    // §9-2 初期値は社の裏(1550,240)だが、ボス起動トリガー内で取得不能になるため
    // 参道（嵐の通路・凪の後に通れる）へ移動（SPEC.md §19-7）
    id: 'king_statue', label: '王の像', x: 1085, y: 255, state: 'named',
    base: '王', tags: ['statue'], doneFlag: 's2_done', size: 22, nameable: true,
  },
  {
    id: 'well', label: '涸れ井戸', x: 2350, y: 1150, state: 'unnamed',
    tags: ['well'], doneFlag: 's3_done', size: 24, nameable: true,
  },
  {
    id: 'old_tree', label: '川辺の古木', x: 1750, y: 1230, state: 'named',
    base: '木', tags: ['tree'], doneFlag: 'tree_done', size: 30, nameable: true,
  },
  {
    id: 'boss_fire', label: '火のナナシ', x: 1480, y: 260, state: 'boss',
    base: '火', tags: ['fire_beast'], doneFlag: 'boss_done', size: 60, nameable: false, // BossController が管理
  },
  {
    id: 'bell', label: '社の鐘', x: 1400, y: 180, state: 'device', tags: [], nameable: false,
  },
  {
    id: 'plaque', label: '村の名標', x: 700, y: 980, state: 'unnamed',
    tags: [], doneFlag: 'boss_done', size: 14, nameable: false, // 灯で自動解決（§8-3）
  },
  {
    id: 'waterwheel', label: 'こわれた水車', x: 600, y: 320, state: 'device', tags: [], nameable: false,
  },
  {
    id: 'hole_hill', label: '掘り跡', x: 760, y: 470, state: 'device', tags: ['hole'], nameable: false,
  },
  {
    // 大きな影(700,560)への名付け動線と干渉しないよう、広場側の穴は東に離す
    id: 'hole_plaza', label: '掘り跡', x: 880, y: 720, state: 'device', tags: ['hole'], nameable: false,
  },
];

export function entityById(id: string): EntityDef {
  const def = ENTITIES.find((e) => e.id === id);
  if (!def) throw new Error(`unknown entity: ${id}`);
  return def;
}
