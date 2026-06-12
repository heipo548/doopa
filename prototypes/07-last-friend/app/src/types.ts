// ゲーム全体で共有する型定義。
// 「データとロジックの分離」(DEMO_SPEC §3) を守るため、
// data/ 配下はこの型に従う純データだけを書く。

export type WordCategory = "kind" | "sad" | "dark" | "world" | "truth";

// 体験版で実装する効果は 2 種だけ (§4.5)。unlock_choice は Cond.hasWord で実現する。
export type WordEffect = "reveal_sad" | "lie_shake";

export interface Word {
  id: string; // 例 "hana"（キーは英字）
  text: string; // 例 "はな"（表示は全かな）
  category: WordCategory;
  hint: string; // ノートに載る一言メモ（全かな・20字以内）
  prereq?: string[]; // 前提語ID。未習得なら習得イベントが発火しない
  effects?: WordEffect[];
}

// 会話やイベントの出し分け条件
export interface Cond {
  hasWord?: string;
  hasWords?: string[]; // 複数語の AND（ともだち合成の判定などに使う）
  notWord?: string; // 「まだ知らないとき」の分岐に使う
  flag?: string;
  notFlag?: string;
  phase?: DayPhase; // 時間帯で出し分け（あさの「おはよう」など）
  kokoroDarkAtLeast?: number;
}

export type DayPhase = "day" | "evening" | "night" | "morning";

// 会話ノードから実行できる副作用。
// シーン側がこのデータを解釈して演出する（データ側に処理は書かない）。
export type Action =
  | { type: "learnWord"; id: string; src: string }
  | { type: "setFlag"; flag: string }
  | { type: "kokoro"; kind?: number; dark?: number }
  | { type: "startBattle"; id: string }
  | { type: "phase"; phase: DayPhase }
  | { type: "event"; name: string }; // toVillage / sleep / ending など、シーン固有の演出フック

export interface PaletteSpec {
  categories: WordCategory[]; // 表示するタブ
  accept: Record<string, string>; // 語ID → 次ノードID
  default: string; // accept にない語が出たときの次ノード（必須・会話を破綻させない）
}

export interface DialogueNode {
  id: string;
  speaker: string; // npcId | "narration" | "kamisama" | "player"
  text: string; // {token} 可。全角20字×最大3行
  lie?: boolean; // true なら「うそ」習得後に lie_shake の対象になる
  if?: Cond; // 不成立ならこのノードを next へ読み飛ばす
  choices?: { label: string; if?: Cond; next: string }[];
  palette?: PaletteSpec;
  actions?: Action[]; // テキスト送り後に実行
  next?: string;
}

export interface BattlePhase {
  emotion: "anger" | "sadness" | "stubborn";
  speaker: string; // このフェーズでまくしたてる相手（表示用）
  line: string; // 相手のセリフ（{token}可）
  matrix: Record<string, number>; // 語ID → ゲージ変化
  categoryMatrix?: Partial<Record<WordCategory, number>>; // matrix にない語の既定値
  clearAt: number; // このフェーズを抜けるゲージ値
}

export interface Battle {
  id: string;
  opponents: string[]; // npcId（複数可）
  phases: BattlePhase[];
  gaugeStart: number; // 50
  gaugeMax: number; // 100
  winNode: string; // 勝利後に飛ぶ会話ノード
  retryNode: string; // ゲージ0時の一言ノード（敗北・ゲームオーバーは存在しない）
}

// マップデータ (data/maps/)
export interface MapExaminable {
  x: number; // タイル座標
  y: number;
  w?: number; // 省略時 1
  h?: number;
  node: string; // しらべたときに開く会話ノード
  if?: Cond;
  arrow?: boolean; // E0 チュートリアル用: 矢印を出す（条件成立中のみ）
}

export interface MapZone {
  x: number;
  y: number;
  w: number;
  h: number;
  node?: string; // 踏むと開始する会話
  event?: string; // またはシーンイベント
  if?: Cond;
  once?: string; // 指定フラグが立っていたら発火しない＆発火時に立てる
}

export interface MapTransition {
  x: number;
  y: number;
  w: number;
  h: number;
  to: { map: string; x: number; y: number };
}

export interface MapDef {
  id: string;
  grid: string[]; // 1文字=1タイル。凡例は gfx/sprites.ts の CHAR_TO_TILE
  examinables: MapExaminable[];
  zones: MapZone[];
  transitions: MapTransition[];
  // タイルより大きい飾り（森はずれの木など）。タイル座標で置き、通行不可になる
  props?: { x: number; y: number; w: number; h: number; texture: string }[];
}

// NPC 定義 (data/npcs.ts)
export interface NpcSpawn {
  map: string;
  x: number;
  y: number;
  if?: Cond[]; // 全条件 AND。複数スポーンは上から最初に成立したもの
}

export interface NpcDef {
  id: string;
  label: string; // 会話ウィンドウの話者名（全かな）
  look: {
    body: PalNameLike; // 体色（パレット名）
    ear: "long" | "round" | "pointy" | "horn" | "none" | "tuft";
    tail: "none" | "big" | "fluffy" | "small";
    wing?: boolean;
  };
  spawns: NpcSpawn[]; // 上から最初に条件成立した場所に出現。どれも不成立なら非表示
  entries: { if?: Cond[]; node: string }[]; // 話しかけたとき、上から最初に成立したノード
}

// palette.ts と循環 import しないための弱い型
export type PalNameLike =
  | "shiro" | "kuro" | "momo" | "komomo" | "sora" | "fukasora" | "ki" | "yamabuki"
  | "wakaba" | "midori" | "fuji" | "kofuji" | "tsuchi" | "kotsuchi" | "yoru" | "hikari";
