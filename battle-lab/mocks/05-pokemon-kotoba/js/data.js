/*
 * data.js — 「Pokémon参考：言葉タイプ相性バトル」のデータ定義（中核）
 *
 * このファイルだけを編集すれば、言葉技・相手・タイプ相性・バランスを増やせる作りにしている。
 * なぜデータとロジックを分けるか：今後 言葉技を増やしたり、相手を足したりするとき、
 * engine.js（進行ルール）を触らずに済むようにするため。
 *
 * 読み込みは <script src> の素のグローバル方式（依存ゼロ）。
 * DOM に一切触れないので、JXA（osascript）でのヘッドレス検証にもそのまま使える。
 *
 * ── 用語の置き換え（ポケモン用語 → この世界の言葉）─────────────────
 *   技      = 言葉技
 *   タイプ  = 言葉タイプ / 感情タイプ
 *   HP      = ノイズ耐性（プレイヤー L）
 *   敵HP    = 閉じた心（相手 村長）
 *   PP      = 残響
 *   ダメージ = 届いた量 / 閉じた心をほどいた量
 *   状態異常 = 心の乱れ
 *   効果抜群 = 言葉が、よく届いた
 *   今ひとつ = 言葉は、少しだけずれた
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  playerMaxNoise: 36,   // L のノイズ耐性（＝HP）。0 になると敗北
  enemyMaxHeart: 40,    // 村長の閉じた心（＝敵HP）。0 になると勝利

  // タイプ相性の倍率
  multEffective: 1.5,   // よく届く（効果抜群）
  multNeutral: 1.0,     // 普通
  multResisted: 0.5,    // 少しずれる（今ひとつ）

  // 状態など
  keikaiTurns: 3,       // 村長の「警戒」：最初の3ターンだけ受ける効果量 -20%
  keikaiReduce: 0.2,    // 警戒：受ける効果量 -20%
  mayoiReduce: 0.3,     // 迷い：次に使う言葉技の効果量 -30%
  hokorobiBonus: 0.5,   // ほころび：次に受ける言葉の効果量 +50%
  guardReduce: 0.3,     // 「黙って見る」：次ターン 村長が受ける効果量 -30%
  weakenReduce: 0.5,    // 「まって」など：村長の次の行動を弱める（ノイズ半減）
  aimDownAmount: 20     // 「問いかける」：次の L の言葉技の命中 -20%
};

/* ───────────── 言葉タイプ（プレイヤーの技につく） ─────────────
 * key で参照し、label を画面に出す。今回のプロトでは全部を技にしないが、
 * タイプ相性表の土台として「8タイプ」をすべて定義しておく。
 */
var WORD_TYPES = {
  aisatsu:  { key: 'aisatsu',  label: 'あいさつ', hint: '関係の入口になる言葉（こんにちは、またね）' },
  anshin:   { key: 'anshin',   label: '安心',     hint: '相手を落ち着かせる言葉（だいじょうぶ、ここにいる）' },
  toi:      { key: 'toi',      label: '問い',     hint: '相手の本音を引き出す言葉（どうして？、ほんとう？）' },
  kansha:   { key: 'kansha',   label: '感謝',     hint: '関係を温める言葉（ありがとう）' },
  kyozetsu: { key: 'kyozetsu', label: '拒絶',     hint: '境界線を引く言葉（いやだ、それはちがう）' },
  chinmoku: { key: 'chinmoku', label: '沈黙',     hint: '言わない選択（沈黙する、まって）' },
  yakusoku: { key: 'yakusoku', label: '約束',     hint: '未来に言葉を置く（信じて、また会おう）' },
  namae:    { key: 'namae',    label: '名前',     hint: '存在に触れる言葉（なまえ、あなたはだれ）' }
};

/* ───────────── 感情タイプ（相手につく） ─────────────
 * 今回の村長戦で使うのは 疑い / 不安 / 沈黙 / 隠し事 の4つ。
 * 将来用に 怒り / 悲しみ / 罪悪感 / 期待 / 本音 も“器”だけ定義しておく。
 */
var EMOTION_TYPES = {
  utagai:     { key: 'utagai',     label: '疑い',   note: '相手を信用していない状態。', color: '#b08bd0' },
  fuan:       { key: 'fuan',       label: '不安',   note: '何かを怖がっている状態。',   color: '#7fb8d9' },
  chinmoku:   { key: 'chinmoku',   label: '沈黙',   note: '言葉を閉ざしている状態。',   color: '#9aa0ad' },
  kakushigoto:{ key: 'kakushigoto',label: '隠し事', note: '本音を隠している状態。',     color: '#d99a9a' },
  // ↓ 将来用（今回は未使用）
  ikari:    { key: 'ikari',    label: '怒り',   note: '将来用。', color: '#e08a7a' },
  kanashimi:{ key: 'kanashimi',label: '悲しみ', note: '将来用。', color: '#8a9bd0' },
  zaiakukan:{ key: 'zaiakukan',label: '罪悪感', note: '将来用。', color: '#c0a080' },
  kitai:    { key: 'kitai',    label: '期待',   note: '将来用。', color: '#e0c070' },
  honne:    { key: 'honne',    label: '本音',   note: '将来用。', color: '#8fd0a0' }
};

/* ───────────── タイプ相性表 ─────────────
 * 「相手の感情タイプ」ごとに、よく届く言葉タイプ(good)と 少しずれる言葉タイプ(bad) を並べる。
 * それ以外はすべて普通(1.0倍)。engine.js の typeMultiplier() がこの表を引く。
 *
 *   よく届く ：1.5倍（効果抜群＝「言葉が、よく届いた。」）
 *   普通     ：1.0倍
 *   少しずれる：0.5倍（今ひとつ＝「言葉は、少しだけずれた。」）
 */
var MATCHUP = {
  utagai:      { good: ['aisatsu', 'toi', 'chinmoku'], bad: ['kansha', 'yakusoku'] },
  fuan:        { good: ['anshin', 'chinmoku', 'yakusoku'], bad: ['kyozetsu', 'toi'] },
  chinmoku:    { good: ['chinmoku', 'toi', 'namae'], bad: ['kansha', 'yakusoku'] },
  kakushigoto: { good: ['toi', 'namae', 'chinmoku'], bad: ['aisatsu', 'kansha'] }
};

/* ───────────── 言葉技ライブラリ（＝Lが覚えうる語彙） ─────────────
 * effect は「データで書ける効果」をキーで表す。engine.js がこれを解釈する：
 *   damage: n          … 相手の「閉じた心」に基本効果量 n（相性・迷い・ほころび・警戒で増減）
 *   selfJuyou: n       … L に「受容」+n（そのターンのノイズを防ぐブロック）
 *   selfNoise: n       … L のノイズ耐性 +n（最大値を超えない）
 *   selfNoiseCost: n   … 使用後に L のノイズ耐性 -n
 *   mitigateNext: n    … 次に受ける村長のノイズを n 軽減
 *   weakenEnemy: true  … 村長の次の行動を弱める（ノイズ半減）
 *   bonusVs: [{emotions:[...], damage:n}] … 相手が特定の感情のとき 追加で閉じた心 -n
 *   changeEmotion: {chance, to} … 確率で相手の感情タイプを変える
 *   hokorobi: {chance}  … 確率で相手に「ほころび」を付与
 *   revealHonne: true   … 成功時、村長の本音らしきテキストを1つ表示
 *   chinmokuCount: true … 「沈黙する」を数えるための印（2回以上で相手が沈黙化）
 *
 * levels は将来のレベルアップ用の“器”（今回は空のまま）。
 *   例: こんにちは → また会えたね → あなたに会いにきた
 */
var MOVE_LIBRARY = {
  konnichiwa: {
    id: 'konnichiwa', name: 'こんにちは', wordType: 'aisatsu',
    power: 8, acc: 100, maxPp: 20,
    effect: { damage: 8 },
    desc: 'はじめて覚えた、世界に触れるための言葉。',
    levels: []
  },
  daijoubu: {
    id: 'daijoubu', name: 'だいじょうぶ', wordType: 'anshin',
    power: 0, acc: 100, maxPp: 15,
    // 自分に受容+8。相手が「不安」なら 追加で閉じた心 -5。
    effect: { selfJuyou: 8, bonusVs: [{ emotions: ['fuan'], damage: 5 }] },
    desc: '自分にも、相手にも使える短い支え。',
    levels: []
  },
  doushite: {
    id: 'doushite', name: 'どうして？', wordType: 'toi',
    power: 6, acc: 90, maxPp: 10,
    // 閉じた心 -6。30%で相手を「隠し事」に。低確率で「ほころび」付与。
    effect: {
      damage: 6,
      changeEmotion: { chance: 0.30, to: 'kakushigoto' },
      hokorobi: { chance: 0.15 }
    },
    desc: 'わからないことを、わからないままにしない言葉。',
    levels: []
  },
  chinmoku: {
    id: 'chinmoku', name: '沈黙する', wordType: 'chinmoku',
    power: 0, acc: 100, maxPp: 15,
    // 受容+5。次に受けるノイズ-3。相手が「沈黙」か「隠し事」なら 追加で閉じた心 -4。
    // 2回以上使うと相手が「沈黙」になる（chinmokuCount で数える）。
    effect: {
      selfJuyou: 5,
      mitigateNext: 3,
      bonusVs: [{ emotions: ['chinmoku', 'kakushigoto'], damage: 4 }],
      chinmokuCount: true
    },
    desc: '言葉がないことも、選択だった。',
    levels: []
  },

  /* ── 以下は今回 L が最初から覚えてはいない「追加技」 ──
   * 勝利後の報酬選択UIに並べる／将来の技習得・入れ替えで使う想定。
   * ライブラリに定義だけしておけば、STARTING_MOVES に id を足すだけで装備できる。 */
  arigatou: {
    id: 'arigatou', name: 'ありがとう', wordType: 'kansha',
    power: 7, acc: 100, maxPp: 15,
    effect: { damage: 7, selfNoise: 2 },
    desc: 'まだ意味はわからない。でも、あたたかい音がする。',
    levels: []
  },
  iyada: {
    id: 'iyada', name: 'いやだ', wordType: 'kyozetsu',
    power: 14, acc: 90, maxPp: 8,
    effect: { damage: 14, selfNoiseCost: 2 },
    desc: '必要な拒絶。でも、使い方はむずかしい。',
    levels: []
  },
  matte: {
    id: 'matte', name: 'まって', wordType: 'chinmoku',
    power: 4, acc: 100, maxPp: 20,
    effect: { damage: 4, weakenEnemy: true, bonusVs: [{ emotions: ['fuan', 'chinmoku'], damage: 4 }] },
    desc: '言葉を急がないための言葉。',
    levels: []
  },
  namae: {
    id: 'namae', name: 'なまえ', wordType: 'namae',
    power: 5, acc: 85, maxPp: 5,
    effect: { damage: 5, revealHonne: true, changeEmotion: { chance: 0.30, to: 'kakushigoto' } },
    desc: '名前を知ることは、逃げ道を奪うことでもある。',
    levels: []
  }
};

/* L が最初から覚えている4つの言葉技（同時に持てるのは4つまで＝ポケモン式） */
var STARTING_MOVES = ['konnichiwa', 'daijoubu', 'doushite', 'chinmoku'];

/* 勝利後の報酬選択UIに出す候補（今回は表示だけ。次戦には引き継がない） */
var REWARD_OPTIONS = ['arigatou', 'matte', 'namae'];

/* ───────────── 状態異常（心の乱れ）の定義（表示と説明） ─────────────
 * 実際の増減は engine.js が行う。ここは「名前・説明・どちら側に付くか」だけ。
 */
var STATUS_DEFS = {
  juyou:    { key: 'juyou',    name: '受容',   side: 'player', desc: 'そのターン、村長から受けるノイズを軽減する。村長の行動後に0へ戻る。' },
  mayoi:    { key: 'mayoi',    name: '迷い',   side: 'player', desc: '次に使う言葉技の効果量が -30%。' },
  aimdown:  { key: 'aimdown',  name: 'ぶれ',   side: 'player', desc: '次の言葉技の命中が -20%（村長の「問いかける」で発生）。' },
  shizuka:  { key: 'shizuka',  name: '静けさ', side: 'player', desc: '次に受ける村長のノイズを軽減する（沈黙するの余韻）。' },
  keikai:   { key: 'keikai',   name: '警戒',   side: 'enemy',  desc: '最初の3ターン、村長が受ける効果量 -20%。' },
  hokorobi: { key: 'hokorobi', name: 'ほころび', side: 'enemy', desc: '村長が次に受ける言葉の効果量 +50%。' },
  guard:    { key: 'guard',    name: '身がまえ', side: 'enemy', desc: '次ターン、村長が受ける効果量 -30%（黙って見る）。' }
};

/* ───────────── 相手：村長 ─────────────
 * 村長は悪者ではない。主人公を疑い、怖がり、でもどこか心配している存在。
 * moves は engine.js が毎ターン1つ選ぶ行動候補。
 *   noise        … L に与えるノイズ量
 *   apply        … L に付与する心の乱れ（{key, chance}）
 *   setEmotionTo … 使うと自分の感情タイプを変える
 *   guard        … true なら「次ターン受ける効果量-30%」を自分に付与
 *   condition    … 'lowHeart' なら 閉じた心が一定以下のときだけ候補に入る
 */
var ENEMIES = {
  sonchou: {
    id: 'sonchou',
    name: '村長',
    title: '主人公を 疑いながら、どこか心配している',
    maxHeart: BALANCE.enemyMaxHeart,
    startEmotion: 'utagai',          // 初期の感情タイプ
    lowHeartThreshold: 20,           // この値以下で「心配する」が出る／不安になりやすい
    firstLine: '村長「……おまえ、何者だ」',
    moves: [
      {
        id: 'utagau', name: '疑う', emotion: 'utagai', kind: 'attack',
        noise: 6, apply: { key: 'mayoi', chance: 0.30 },
        line: '村長「……おまえ、何者だ」', weight: 40
      },
      {
        id: 'toikakeru', name: '問いかける', emotion: 'utagai', kind: 'attack',
        noise: 4, apply: { key: 'aimdown', chance: 1.0 },
        line: '村長「おまえは、何をしに来た」', weight: 35
      },
      {
        id: 'damatte', name: '黙って見る', emotion: 'chinmoku', kind: 'guard',
        noise: 0, guard: true,
        line: '村長は、何かを言いかけてやめた。', weight: 22
      },
      {
        id: 'shinpai', name: '心配する', emotion: 'fuan', kind: 'attack',
        noise: 3, setEmotionTo: 'fuan', condition: 'lowHeart',
        line: '村長は、あなたを怖がっているのではない。心配している。', weight: 55
      }
    ]
  }
};

/* 村長の「本音らしきテキスト」（なまえ の revealHonne で1つ表示） */
var HONNE_LINES = [
  '村長「……その目。あの子と、同じだ」',
  '村長「わしは、この村を こわしたくないだけだ」',
  '村長「ほんとうは、ずっと だれかを 待っていた気がする」'
];

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'Pokémon参考：言葉タイプ相性バトル',
  mockTitleEn: 'Word Type Battle',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  premise: '敵を倒すのではなく、言葉で「閉じた心」をほどいていく。',
  intro: [
    '相手の感情タイプを見て、よく届く言葉を選んでください。',
    'Lはまだ、言葉を完全には知りません。',
    '覚えている4つの言葉を使って、村長の閉じた心をほどいていきます。'
  ],
  // 用語の言い換え（HUDのラベルに使う）
  termPlayerHp: 'ノイズ耐性',
  termEnemyHp: '閉じた心',
  termPp: '残響',
  termJuyou: '受容',
  playerName: 'L',
  playerTag: 'L — kotoba-android'
};

/* 相性メッセージ（ログに出す） */
var REL_MSG = {
  effective: '言葉が、よく届いた。',
  neutral: '言葉は、まっすぐ 届いた。',
  resisted: '言葉は、少しだけずれた。',
  miss: '言葉は、届く前にほどけた。'
};

/* 勝利時のメッセージ（村長の閉じた心が0になったら） */
var WIN_TEXT = [
  '村長の閉じた心が、少しだけほどけた。',
  '村長「……言葉はまだ少ないな。でも、逃げなかった」',
  '村長「学校へ行け。おまえに必要なのは、武器じゃない」',
  'Lは、新しい言葉を覚えられそうだ。',
  'でも、覚えられる言葉には限りがある。'
];

/* 敗北時のメッセージ（L のノイズ耐性が0になったら） */
var LOSE_TEXT = [
  'Lの中で、言葉がばらばらになった。',
  '「こんにちは」の意味を、一時的に忘れた。',
  '村長「……言葉は、数だけでは足りない」'
];

// JXA（Node非対応のヘッドレス検証）でも参照できるよう、明示的に公開しておく
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, WORD_TYPES: WORD_TYPES, EMOTION_TYPES: EMOTION_TYPES,
    MATCHUP: MATCHUP, MOVE_LIBRARY: MOVE_LIBRARY, STARTING_MOVES: STARTING_MOVES,
    REWARD_OPTIONS: REWARD_OPTIONS, STATUS_DEFS: STATUS_DEFS, ENEMIES: ENEMIES,
    HONNE_LINES: HONNE_LINES, LORE: LORE, REL_MSG: REL_MSG,
    WIN_TEXT: WIN_TEXT, LOSE_TEXT: LOSE_TEXT
  };
}
