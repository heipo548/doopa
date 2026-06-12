// 言ノ葉（拾得物）定義 — SPEC.md §8-1
// ※「人」は初期所持（Inventory 初期化で付与）、「点」はコトノ婆の会話で付与、
//   「丁」はボス戦 Phase2 の鐘で動的スポーンするため、この表には置かない。

export interface FragmentDef {
  id: string;
  glyph: string;
  kind: '部首' | '修飾';
  x: number;
  y: number;
  /** このフラグが立つまで非表示（例: 水 は S1 クリア後） */
  hiddenUntilFlag?: string;
  /** 暗がりの間の内部（闇の中でも淡く光る） */
  inDark?: boolean;
  note?: string;
}

export const FRAGMENTS: FragmentDef[] = [
  { id: 'hi_fire', glyph: '火', kind: '部首', x: 880, y: 940, note: 'P0用・竈の前' },
  { id: 'nichi', glyph: '日', kind: '部首', x: 1460, y: 940, note: 'P1用・暗がりの間の入口の外' },
  { id: 'tsuki', glyph: '月', kind: '部首', x: 1750, y: 800, inDark: true, note: 'P1用・闇の中で淡く光る' },
  { id: 'ki', glyph: '木', kind: '部首', x: 1900, y: 1250, note: 'P2用・川辺の岸' },
  { id: 'tome', glyph: '止', kind: '修飾', x: 560, y: 300, note: 'P4用・壊れた水車のそば' },
  { id: 'ichi', glyph: '一', kind: '修飾', x: 1820, y: 1340, note: 'S2/本用・立て札のそば' },
  { id: 'mizu', glyph: '水', kind: '部首', x: 2390, y: 1110, hiddenUntilFlag: 's1_done', note: 'S3用・井戸の裏（鳥が在処を示す）' },
];

/** 初期所持語彙（チュートリアルで言及） */
export const INITIAL_GLYPHS = ['人'];
