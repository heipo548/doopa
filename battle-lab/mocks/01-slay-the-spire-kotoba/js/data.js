/*
 * data.js — 「言葉デッキバトル」のデータ定義（中核）
 *
 * このファイルだけを編集すれば、カード・敵・状態異常・バランスを増やせる作りにしている。
 * なぜデータとロジックを分けるか：今後モック（UNDERTALE型/Inscryption型…）や
 * カード・敵を増やすとき、engine.js（進行ルール）を触らずに済むようにするため。
 *
 * 読み込みは <script src> の素のグローバル方式（依存ゼロ）。
 * DOM に一切触れないので、JXA（osascript）でのヘッドレス検証にもそのまま使える。
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  playerMaxNoise: 40, // プレイヤーHP＝「ノイズ耐性」。0 になると敗北
  energyPerTurn: 3,   // 毎ターン回復する「こころ」（＝エナジー）
  drawPerTurn: 5,     // 毎ターン引く「今いえる言葉」の枚数
  handLimit: 10,      // 手札上限（あふれた言葉は捨て札へ）
  chargeBonus: 3,     // 敵が「黙って見る」で溜めたとき、次の攻撃に足すノイズ
  mayoiTellPenalty: 2,    // 「迷い」1につき、次の『伝える』ダメージ -2
  hokorobiMultiplier: 1.5 // 「ほころび」1につき、相手が受ける次の『伝える』×1.5
};

/* ───────────── カード種別（＝言葉の働き）の表示ラベル ───────────── */
// 普通のRPGの「攻撃/防御」とは呼ばず、世界観の言い換えで統一する
var CARD_TYPES = {
  tell:    { label: 'つたえる', hint: '相手の閉じた心にはたらきかける' },
  receive: { label: 'うけとめる', hint: '受容を得て、自分を守る' },
  ask:     { label: 'たずねる', hint: 'やりとりを動かす' },
  special: { label: 'とくべつ', hint: 'すこし変わったはたらき' }
};

/* ───────────── カード定義（＝語彙ライブラリ） ─────────────
 * effect は「データで書ける効果」をキーで表現する。engine.js がこれを解釈する：
 *   damage: n        … 相手の「閉じた心」に n（『伝える』は迷い/ほころびで増減）
 *   block: n         … 「受容」を n 得る（＝そのターンのブロック）
 *   draw: n          … 「今いえる言葉」を n 枚引く
 *   applyEnemy: {...} … 相手に状態異常を付与（例 {hokorobi:1}）
 *   applySelf: {...}  … 自分に状態異常を付与
 *   discardRandom: n … 手札からランダムに n 枚 捨て札へ
 *
 * level は将来のレベルアップ用の“器”（今回は使わないが構造だけ用意）。
 *   例: ありがとう → 本当にありがとう → ありがとう、いてくれて
 */
var CARD_LIBRARY = {
  konnichiwa: {
    id: 'konnichiwa',
    name: 'こんにちは',
    cost: 1,
    type: 'tell',
    text: 'はじめて覚えた、世界に触れるための言葉。',
    effect: { damage: 6 },
    levels: [] // 今後：['本当にこんにちは', ...] のように段階を足せる
  },
  daijoubu: {
    id: 'daijoubu',
    name: 'だいじょうぶ',
    cost: 1,
    type: 'receive',
    text: '自分にも、相手にも使える短い支え。',
    effect: { block: 5 },
    levels: []
  },
  doushite: {
    id: 'doushite',
    name: 'どうして？',
    cost: 1,
    type: 'ask',
    text: 'わからないことを、わからないままにしない言葉。',
    effect: { draw: 1, applyEnemy: { hokorobi: 1 } },
    levels: []
  },
  chinmoku: {
    id: 'chinmoku',
    name: '沈黙する',
    cost: 0,
    type: 'special',
    text: '言葉がないことも、選択だった。',
    // 受容を2得て、手札を1枚 捨て札へ送る（言葉を飲み込む小さな代償）
    effect: { block: 2, discardRandom: 1 },
    levels: []
  }
};

/* ───────────── 初期デッキ（＝主人公が今もっている語彙） ─────────────
 * {id, count} の並びで持つので、枚数の調整やカード追加が一目で分かる。
 */
var STARTING_DECK = [
  { id: 'konnichiwa', count: 4 },
  { id: 'daijoubu',   count: 4 },
  { id: 'doushite',   count: 1 },
  { id: 'chinmoku',   count: 1 }
];

/* ───────────── 状態異常の定義（表示と説明） ─────────────
 * 実際の増減は engine.js が行う。ここは「名前・説明・どちら側に付くか」だけ。
 */
var STATUS_DEFS = {
  juyou: {
    key: 'juyou',
    name: '受容',
    side: 'player',
    desc: 'そのターン、相手から受けるノイズを軽減する。次の自分の番で0に戻る。'
  },
  mayoi: {
    key: 'mayoi',
    name: '迷い',
    side: 'player',
    desc: '次に使う『つたえる』言葉のダメージが少し弱くなる。'
  },
  hokorobi: {
    key: 'hokorobi',
    name: 'ほころび',
    side: 'enemy',
    desc: '相手が次に受ける『つたえる』ダメージが増える。'
  }
};

/* ───────────── 敵（＝相手 / 感情 / 誤解）の定義 ─────────────
 * moves は行動候補。engine.js が毎ターン1つ選び、その「次の感情」を予告表示する。
 *   kind:'attack' … noise 分のノイズを与える（applyPlayer があれば状態異常も）
 *   kind:'charge' … その番は何もせず、次の攻撃が強くなる（黙って見る）
 */
var ENEMIES = {
  sonchou: {
    id: 'sonchou',
    name: '村長',
    title: '主人公を 疑いながら 試してくる',
    maxHeart: 42, // 「閉じた心」（敵HP）
    moves: [
      {
        id: 'utagau',
        name: '疑う',
        kind: 'attack',
        noise: 8,
        intent: 'こちらを じっと 見定めている…',
        weight: 45
      },
      {
        id: 'toikakeru',
        name: '問いかける',
        kind: 'attack',
        noise: 5,
        applyPlayer: { mayoi: 1 },
        intent: 'なにかを 問おうとしている…',
        weight: 40
      },
      {
        id: 'damatte',
        name: '黙って見る',
        kind: 'charge',
        intent: '黙って こちらを 見ている…（次が 少し強くなる）',
        weight: 15
      }
    ]
  }
};

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'Slay the Spire参考：言葉デッキバトル',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  premise: '敵を倒すのではなく、言葉で「閉じた心」をほどいていく。',
  // 用語の言い換え（HUDのラベルに使う）
  termHand: '今いえる言葉',
  termEnergy: 'こころ',
  termPlayerHp: 'ノイズ耐性',
  termBlock: '受容',
  termEnemyHp: '閉じた心',
  termIntent: '次の感情'
};

// 勝利時のメッセージ（村長の「閉じた心」が0になったら）
var WIN_TEXT = [
  '村長の閉じた心が、少しだけほどけた。',
  '村長「……言葉はまだ少ないな。でも、逃げなかった」',
  '村長「学校へ行け。おまえに必要なのは、武器じゃない」'
];

// 敗北時のメッセージ（プレイヤーのノイズ耐性が0になったら）
var LOSE_TEXT = [
  'Lの中で、言葉がばらばらになった。',
  '「こんにちは」の意味を、一時的に忘れた。'
];

// JXA（Node非対応のヘッドレス検証）でも参照できるよう、明示的に公開しておく
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, CARD_TYPES: CARD_TYPES, CARD_LIBRARY: CARD_LIBRARY,
    STARTING_DECK: STARTING_DECK, STATUS_DEFS: STATUS_DEFS, ENEMIES: ENEMIES,
    LORE: LORE, WIN_TEXT: WIN_TEXT, LOSE_TEXT: LOSE_TEXT
  };
}
