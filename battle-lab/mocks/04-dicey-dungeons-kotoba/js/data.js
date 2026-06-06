/*
 * data.js — 「言葉サイコロ装填バトル」のデータ定義（中核）
 *
 * Dicey Dungeons “参考” のモック。構造（毎ターン出る出目を装備/スキルに割り当てて
 * 効果を発動する）だけを借り、見た目・固有表現はオリジナルの「言葉」世界観に置き換える。
 *
 * このファイルだけを編集すれば、言葉装置・村長の感情・欠片・バランスを増やせる作りにしている。
 * なぜデータとロジックを分けるか：今後 装置や相手を増やすとき、進行ルール（engine.js）を
 * 触らずに済むようにするため。DOM に一切触れないので JXA でのヘッドレス検証にもそのまま使える。
 *
 * 用語はすべて世界観に言い換える（ふつうのゲーム用語は使わない）：
 *   サイコロ→ことばの欠片 / 出目→音の強さ / 装備→言葉装置 / スキル→発話
 *   HP→ノイズ耐性 / 敵HP→閉じた心 / ブロック→受容 / 状態異常→乱れ
 *   ショップ→学校 / レベルアップ→語彙の成長
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  playerMaxNoise: 24,      // プレイヤーHP＝「ノイズ耐性」。0 になると敗北
  enemyMaxHeart: 30,       // 敵HP＝村長の「閉じた心」。0 にすれば勝利
  kakeraPerTurn: 3,        // 毎ターン振る「ことばの欠片」の数
  diceMin: 1, diceMax: 6,  // 欠片の「音の強さ」の範囲（＝サイコロの目）
  chargeBonus: 2,          // 村長が「黙って見る」で溜めたとき、次のノイズに足す量
  whiteKakeraValue: 3,     // 白い欠片の「音の強さ」（まずは3固定）
  whiteBonusBlock: 1,      // 白い欠片を装置に使うと、追加で得る受容（相手の心配を受け取る感覚）
  worryHeartThreshold: 15, // 「閉じた心」がこれ以下だと、村長は『心配する』を取りやすくなる
  worryRandomChance: 0.12  // 上の条件を満たさなくても、低確率で『心配する』が出る
};

/* ───────────── 言葉装置（＝装備/スキルにあたる）の定義 ─────────────
 * 毎ターン出た「ことばの欠片」を、ここに“装填”して効果を出す。
 *
 *  capacity … 発動に必要な欠片の数（基本1。ほんとう？だけ2）
 *  accept   … 受け付ける欠片の条件（engine.js が判定する）：
 *     'any'      どの欠片でもよい
 *     'odd'      奇数の音（1,3,5）だけ
 *     'even'     偶数の音（2,4,6）だけ
 *     'max4'     4以下の音だけ
 *     'min4'     4以上の音だけ
 *     'discard'  欠片を1つ“捨てる”（沈黙する）
 *     'samePair' 同じ音の欠片を2つ（capacity:2）
 *     ※ 白い欠片は、どの条件にも合う「ワイルドカード」として扱う（engine 側で特別扱い）
 *  effect   … データで書ける効果。engine.js が解釈する：
 *     heartByValue:true … 閉じた心 −（装填した音の合計）
 *     blockByValue:true … 受容 ＋（装填した音の合計）
 *     heart:n           … 閉じた心 −n（固定）
 *     block:n           … 受容 ＋n（固定）
 *     blockIfHasOne:n   … 装填した欠片に「音1」が含まれていれば 受容 ＋n を追加
 *     kakeraNext:n      … 次のターンだけ、ことばの欠片を n 個多く振る
 *     noiseDownNext:n   … 次に受ける村長のノイズを n 軽減する
 *     selfNoise:n       … 自分のノイズ耐性を n 削る（強い言葉の反動）
 *     rerollIntent:true … 村長の「次の感情」を選び直す（＝表示し直す）
 *  cond / eff … 画面のカードに出す「条件」「効果」の説明文（表示専用）
 *  text       … 装置の下に出す、世界観のひとこと
 *  optional   … true は「余裕があれば」枠の装置（表示上の区別だけ。動作は同じ）
 *  levels     … 将来の「語彙の成長（3段階）」用の器（今回は未使用）
 */
var DEVICE_LIST = [
  {
    id: 'konnichiwa', name: 'こんにちは', capacity: 1, accept: 'any',
    cond: '任意の欠片1つ', eff: '閉じた心 −欠片の音',
    effect: { heartByValue: true },
    text: 'はじめて覚えた、世界に触れるための言葉。',
    levels: [] // 例）こんにちは → よく来たね → ここに いていい
  },
  {
    id: 'daijoubu', name: 'だいじょうぶ', capacity: 1, accept: 'any',
    cond: '任意の欠片1つ', eff: '受容 ＋欠片の音',
    effect: { blockByValue: true },
    text: '自分にも、相手にも使える短い支え。',
    levels: []
  },
  {
    id: 'doushite', name: 'どうして？', capacity: 1, accept: 'odd',
    cond: '奇数（1・3・5）の欠片1つ', eff: '閉じた心 −2／次ターン 欠片＋1',
    effect: { heart: 2, kakeraNext: 1 },
    text: 'わからないことを、わからないままにしない言葉。',
    levels: []
  },
  {
    id: 'matte', name: 'まって', capacity: 1, accept: 'even',
    cond: '偶数（2・4・6）の欠片1つ', eff: '次に受けるノイズ −3',
    effect: { noiseDownNext: 3 },
    text: '言葉を急がないための言葉。',
    levels: []
  },
  {
    id: 'chinmoku', name: '沈黙する', capacity: 1, accept: 'discard',
    cond: '欠片を1つ 捨てる', eff: '受容 ＋2（捨てた音が1なら ＋5）',
    effect: { block: 2, blockIfHasOne: 3 },
    text: '言葉がないことも、選択だった。',
    levels: []
  },

  /* ──── ここから下は「余裕があれば」枠。今回は全部入りで実装する ──── */
  {
    id: 'arigatou', name: 'ありがとう', capacity: 1, accept: 'max4', optional: true,
    cond: '4以下の欠片1つ', eff: '受容 ＋欠片の音／次のノイズ −1',
    effect: { blockByValue: true, noiseDownNext: 1 },
    text: '届きすぎると、少し嘘っぽくなる言葉。',
    levels: [] // 例）ありがとう → 本当にありがとう → ありがとう、いてくれて
  },
  {
    id: 'iyada', name: 'いやだ', capacity: 1, accept: 'min4', optional: true,
    cond: '4以上の欠片1つ', eff: '閉じた心 −8／自分にノイズ ＋2',
    effect: { heart: 8, selfNoise: 2 },
    text: '必要な拒絶。でも、使い方はむずかしい。',
    levels: []
  },
  {
    id: 'honto', name: 'ほんとう？', capacity: 2, accept: 'samePair', optional: true,
    cond: '同じ音の欠片2つ', eff: '閉じた心 −10／村長の感情を引き直す',
    effect: { heart: 10, rerollIntent: true },
    text: '同じ音が重なったときだけ出てくる問い。',
    levels: []
  }
];

// id から装置定義を引く早見表（engine / ui が使う）
var DEVICE_BY_ID = {};
for (var _di = 0; _di < DEVICE_LIST.length; _di++) {
  DEVICE_BY_ID[DEVICE_LIST[_di].id] = DEVICE_LIST[_di];
}

/* ───────────── 村長の「感情」（＝敵の行動）の定義 ─────────────
 * 毎ターン1つが「次の感情」として予告される。プレイヤーはそれを見て、
 * 受けとめる（受容）か・伝える（閉じた心を削る）かを選ぶ。
 *   noise        … プレイヤーが受けるノイズ量（0 もある）
 *   charge:true  … その番は何もせず、次の攻撃を強くする（黙って見る）
 *   kasureNext:n … 次ターンの欠片 n 個を「かすれ（音1固定）」にする（問いかける）
 *   whiteNext:n  … 次ターン、白い欠片を n 個 もらえる（心配する）
 *   requiresLowHeart:true … 「閉じた心」が低い時だけ（or 低確率で）出る（心配する）
 *   line         … 予告に出す、村長のセリフ／ようす（\n で改行）
 *   weight       … 抽選の重み
 */
var ENEMIES = {
  sonchou: {
    id: 'sonchou',
    name: '村長',
    title: '悪者ではない。あなたを 疑い、怖がり、でも どこか 心配している',
    maxHeart: BALANCE.enemyMaxHeart,
    moves: [
      {
        id: 'utagau', name: '疑う', noise: 6,
        line: '村長は、あなたを疑っている。',
        weight: 42
      },
      {
        id: 'toikakeru', name: '問いかける', noise: 4, kasureNext: 1,
        line: '村長「おまえは、何をしに来た」',
        weight: 32
      },
      {
        id: 'damatte', name: '黙って見る', noise: 0, charge: true,
        line: '村長は、何かを言いかけてやめた。',
        weight: 22
      },
      {
        id: 'shinpai', name: '心配する', noise: 3, whiteNext: 1, requiresLowHeart: true,
        line: '村長は、あなたを怖がっているのではない。\n心配している。',
        weight: 50
      }
    ]
  }
};

/* ───────────── 乱れ（＝プレイヤー側の状態。次ターンに効く予兆）の表示定義 ─────────────
 * 数値の増減は engine.js が行う。ここは「名前・説明」だけ。
 *   kasure  … 次ターンの欠片が1つ「かすれ（音1固定）」になる（村長の問いかけ）
 *   white   … 次ターン、白い欠片をもらえる（村長の心配）
 *   bonus   … 次ターン、欠片を1つ多く振れる（どうして？）
 */
var DISTURB_DEFS = {
  kasure: { key: 'kasure', name: 'かすれ', side: 'player',
            desc: '次のターン、ことばの欠片が1つ かすれて「音1」になる。' },
  white:  { key: 'white',  name: '白い欠片', side: 'player',
            desc: '次のターン、白い欠片を1つ もらえる（どの条件にも使える）。' },
  bonus:  { key: 'bonus',  name: '欠片＋', side: 'player',
            desc: '次のターンだけ、ことばの欠片を1つ多く振れる。' }
};

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'Dicey Dungeons参考：言葉サイコロ装填バトル',
  mockTitleEn: 'Word Dice Loading Battle',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  premise: '敵を倒すのではなく、言葉で「閉じた心」をほどいていく。',
  playerName: 'L',
  // 開始画面・ページ上部に出す説明（仕様で指定された文面）
  howto: [
    'これは完成版ではなく、バトルシステム検証用のモックです。',
    '出てきた「ことばの欠片」を言葉装置に入れて、村長の閉じた心をほどいてください。',
    'Lはまだ、言葉を完全には知りません。',
    'だから今ある欠片を使って、なんとか言葉にしていきます。'
  ],
  // 用語の言い換え（HUDのラベルに使う）
  termKakera: 'ことばの欠片',
  termValue: '音の強さ',
  termDevice: '言葉装置',
  termSpeak: '発話',
  termPlayerHp: 'ノイズ耐性',
  termEnemyHp: '閉じた心',
  termBlock: '受容',
  termDisturb: '乱れ',
  termIntent: '次の感情',
  // 操作のヒント
  opHint: 'ことばの欠片を選んでから、言葉装置を押すと装填できます。'
};

// 勝利時のメッセージ（村長の「閉じた心」が0になったら）
var WIN_TEXT = [
  '村長の閉じた心が、欠片のようにほどけていった。',
  '村長「……言葉はまだ少ないな。でも、逃げなかった」',
  '村長「学校へ行け。おまえに必要なのは、武器じゃない」',
  'Lは、まだ「ありがとう」の使い方を知らない。',
  'でも、その音だけは少し残った。'
];

// 敗北時のメッセージ（プレイヤーのノイズ耐性が0になったら）＝言葉がばらばらになる演出
var LOSE_TEXT = [
  'Lの中で、言葉がばらばらになった。',
  '「こんにちは」の意味を、一時的に忘れた。',
  'ことばの欠片は、ただの数字に戻った。'
];

// JXA（Node非対応のヘッドレス検証）でも参照できるよう、明示的に公開しておく
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, DEVICE_LIST: DEVICE_LIST, DEVICE_BY_ID: DEVICE_BY_ID,
    ENEMIES: ENEMIES, DISTURB_DEFS: DISTURB_DEFS, LORE: LORE,
    WIN_TEXT: WIN_TEXT, LOSE_TEXT: LOSE_TEXT
  };
}
