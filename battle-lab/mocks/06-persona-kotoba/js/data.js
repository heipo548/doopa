/*
 * data.js — 「ペルソナ参考：心象弱点・総鳴りバトル」のデータ定義（中核）
 *
 * このファイルだけを編集すれば、仮面・弱点/耐性・言葉技・村長の行動・対話を増やせる作り。
 * なぜデータとロジックを分けるか：今後 仮面や影（敵）を増やすとき、engine.js（進行ルール）を
 * 触らずに済むようにするため。将来「心象の切り替え」「複数の影」も、ここを足すだけで広げられる。
 *
 * 読み込みは <script src> の素のグローバル方式（依存ゼロ）。
 * DOM に一切触れないので、JXA（osascript）でのヘッドレス検証にもそのまま使える。
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  playerMaxNoise: 42,   // L のHP＝「ノイズ耐性」。0 になると敗北
  playerMaxKokoro: 18,  // L のSP＝「こころ」。言葉技を使うリソース
  kokoroRegen: 2,       // ターン開始時に回復する「こころ」（最大18まで）
  weakMult: 1.5,        // ほころび（弱点）を突いたときの効果量倍率
  resistMult: 0.5,      // こわばり（耐性）に当たったときの効果量倍率
  mayoiPenalty: 0.7,    // 「迷い」：次の言葉技の効果量 ×0.7（=-30%）
  meichuPenalty: 20,    // 「命中低下」：次の言葉技の命中 -20
  guardReduce: 0.8,     // 村長の「黙って見る」後：村長が受ける効果量 ×0.8（=-20%）
  enemyMaxHeart: 50,    // 村長の影のHP＝「閉じた心」
  honneThreshold: 10,   // 閉じた心が これ以下になると 仮面が「本音」に変わる
  shinpaiThreshold: 25, // 閉じた心が これ以下で 村長が「心配する」を使えるようになる
  sounariDamage: 18,    // ことばの総鳴り：閉じた心 -18（固定の大技）
  uketomeBlock: 6,      // 受けとめる：受容 +6
  uketomeKokoro: 2      // 受けとめる：こころ +2 回復
};

/* ───────────── 言葉タイプ（id → 表示名） ─────────────
 * 仮面の弱点/耐性も、言葉技も、この id で型を持つ。
 */
var WORD_TYPES = {
  aisatsu:  'あいさつ',
  anshin:   '安心',
  toi:      '問い',
  kansha:   '感謝',
  kyozetsu: '拒絶',
  chinmoku: '沈黙',
  yakusoku: '約束',
  namae:    '名前'
};

/* ───────────── 仮面（＝相手の心象）の定義 ─────────────
 * weak   … ほころび（弱点）になる言葉タイプ。突くと「心崩れ」＋「もう一言」。
 * resist … こわばり（耐性）になる言葉タイプ。効果量が半減し、心崩れは起きない。
 * それ以外のタイプは「通常」（等倍）。
 * appearLog … その仮面になったときに ログへ出す一文。
 * honne:true … 本音の仮面。弱点/耐性は無く、対話で勝てる特殊な状態。
 */
var MASKS = {
  utagai: {
    id: 'utagai', name: '疑い', state: '警戒',
    weak:   ['toi', 'chinmoku'],
    resist: ['kansha', 'yakusoku'],
    appearLog: '村長は、疑いの仮面をかぶっている。'
  },
  huan: {
    id: 'huan', name: '不安', state: '動揺',
    weak:   ['anshin', 'chinmoku', 'yakusoku'],
    resist: ['kyozetsu', 'toi'],
    appearLog: '村長の仮面が、不安に変わった。'
  },
  chinmoku: {
    id: 'chinmoku', name: '沈黙', state: '沈黙',
    weak:   ['chinmoku', 'namae'],
    resist: ['kansha', 'aisatsu'],
    appearLog: '村長は、言葉を閉ざしている。'
  },
  kakushigoto: {
    id: 'kakushigoto', name: '隠し事', state: '秘匿',
    weak:   ['toi', 'namae', 'chinmoku'],
    resist: ['aisatsu', 'kansha'],
    appearLog: '村長は、まだ何かを隠している。'
  },
  honne: {
    id: 'honne', name: '本音', state: '開放',
    weak: [], resist: [], honne: true,
    appearLog: '仮面の奥に、本音が見えた。'
  }
};

/* ───────────── L の言葉技（＝今もっている語彙） ─────────────
 * types  … 言葉タイプ（複数可。どれか1つでも弱点なら「ほころび」扱い）
 * cost   … 消費「こころ」
 * power  … 効果量（閉じた心へのダメージの基礎値。0なら攻撃ではない）
 * hit    … 命中（100で必中）
 * block  … 受容（そのターンのブロック）を得る
 * selfHeal/selfNoise … L のノイズ耐性を増減（ありがとう/いやだ）
 * weakenNext … 村長の次の行動の効果倍率を下げる（小さいほど大きく弱める）
 * damageOnlyOnWeak … 弱点を突いたときだけ閉じた心に効く（沈黙する）
 * condDmg … 特定の仮面のとき 追加ダメージ（だいじょうぶ：不安なら -6）
 * changeMask … 確率で仮面を変える（どうして？/なまえ → 隠し事）
 * countsAsSilence … 「沈黙する」を数える（2回で 沈黙の仮面へ）
 * hintHonne … 本音のヒントを表示（なまえ）
 */
var SKILLS = {
  konnichiwa: {
    id: 'konnichiwa', name: 'こんにちは', types: ['aisatsu'],
    cost: 2, power: 8, hit: 100,
    text: 'はじめて覚えた、世界に触れるための言葉。'
  },
  daijoubu: {
    id: 'daijoubu', name: 'だいじょうぶ', types: ['anshin'],
    cost: 3, power: 0, hit: 100,
    block: 8, condDmg: { mask: 'huan', amount: 6 },
    text: '自分にも、相手にも使える短い支え。'
  },
  doushite: {
    id: 'doushite', name: 'どうして？', types: ['toi'],
    cost: 3, power: 9, hit: 95,
    changeMask: { to: 'kakushigoto', p: 0.3 },
    text: 'わからないことを、わからないままにしない言葉。'
  },
  chinmokuSuru: {
    id: 'chinmokuSuru', name: '沈黙する', types: ['chinmoku'],
    cost: 1, power: 5, hit: 100,
    block: 5, weakenNext: 0.5, damageOnlyOnWeak: true, countsAsSilence: true,
    text: '言葉がないことも、選択だった。'
  },
  arigatou: {
    id: 'arigatou', name: 'ありがとう', types: ['kansha'],
    cost: 2, power: 7, hit: 100,
    selfHeal: 2,
    text: 'まだ意味はわからない。でも、あたたかい音がする。'
  },
  iyada: {
    id: 'iyada', name: 'いやだ', types: ['kyozetsu'],
    cost: 4, power: 15, hit: 90,
    selfNoise: 2,
    text: '必要な拒絶。でも、使い方はむずかしい。'
  },
  // ── オプション技（型の網羅と「本音への近道」を増やす） ──
  namae: {
    id: 'namae', name: 'なまえ', types: ['namae'],
    cost: 5, power: 6, hit: 85,
    changeMask: { to: 'kakushigoto', p: 0.3 }, hintHonne: true,
    text: '名前を知ることは、逃げ道を奪うことでもある。'
  },
  matte: {
    id: 'matte', name: 'まって', types: ['yakusoku', 'chinmoku'],
    cost: 3, power: 5, hit: 100,
    weakenNext: 0.2,
    text: '言葉を急がないための言葉。'
  }
};

// 画面に並べる順番（データの定義順に依存しないよう明示しておく）
var SKILL_ORDER = [
  'konnichiwa', 'daijoubu', 'doushite', 'chinmokuSuru',
  'arigatou', 'iyada', 'namae', 'matte'
];

/* ───────────── 村長の影（＝相手）の定義 ───────────── */
var ENEMY = {
  name: '村長の影',
  title: '村長が隠した 疑い・不安・沈黙・隠し事の かたち',
  maxHeart: 50,
  initialMask: 'utagai'
};

/* ───────────── 村長の行動 ─────────────
 * noise      … L に与えるノイズ（受容で軽減できる）
 * applyPlayer … L に状態異常（mayoi=迷い / meichuDown=命中低下）。chance があれば確率発動
 * guardNext  … 次に村長が受ける効果量を下げる（黙って見る）
 * healEnemy  … 閉じた心を回復（隠す）
 * changeMask … 行動後に仮面を変える（心配する → 不安）
 * condHeartLE … 閉じた心が この値以下のときだけ使える
 * condMask   … この仮面のときだけ使える
 * weight     … 抽選の重み
 */
var ENEMY_MOVES = {
  utagau: {
    id: 'utagau', name: '疑う', noise: 6,
    applyPlayer: { mayoi: 1, chance: 0.3 },
    line: '村長「……おまえ、何者だ」',
    weight: 40
  },
  toitsumeru: {
    id: 'toitsumeru', name: '問い詰める', noise: 8,
    applyPlayer: { meichuDown: 1 },
    line: '村長「おまえは、何をしに来た」',
    weight: 35
  },
  damatte: {
    id: 'damatte', name: '黙って見る', noise: 0,
    guardNext: true,
    line: '村長は、何かを言いかけてやめた。',
    weight: 20
  },
  shinpai: {
    id: 'shinpai', name: '心配する', noise: 4,
    condHeartLE: 25, changeMask: 'huan',
    line: '村長は、あなたを怖がっているのではない。心配している。',
    weight: 45
  },
  kakusu: {
    id: 'kakusu', name: '隠す', noise: 0,
    condMask: 'kakushigoto', healEnemy: 5,
    line: '村長「……まだ言えない」',
    weight: 40
  }
};

/* ───────────── 対話（たずねる）の選択肢 ─────────────
 * kuzure … 心崩れ中の対話。honne … 本音の仮面のときの対話。
 * correct=true が正解。win=true なら その対話で勝利。
 * heartDown … 閉じた心を減らす量。changeMask … 成功時に仮面を変える。
 */
var DIALOGUES = {
  kuzure: {
    prompt: '心崩れ中。今なら、本音に近づける。',
    choices: [
      {
        text: 'こわいの？', correct: true,
        log: ['L「こわいの？」', '村長「……怖い。おまえが、ではない」', '村長「おまえを作ったものが、怖い」'],
        heartDown: 10, changeMask: 'kakushigoto'
      },
      {
        text: 'ぼくは敵？', correct: false,
        log: ['L「ぼくは敵？」', '村長「……わからん。それが、こわい」'],
        heartDown: 3
      },
      {
        text: 'だいじょうぶ', correct: false,
        log: ['L「だいじょうぶ」', '村長「軽々しく、言うな」'],
        heartDown: 3
      }
    ]
  },
  honne: {
    prompt: '仮面の奥に、本音が見えた。最後の言葉を選べる。',
    choices: [
      {
        text: 'ぼくは、なに？', correct: false,
        log: ['L「ぼくは、なに？」', '村長「それは……わしにも、わからん」'],
        heartDown: 3
      },
      {
        text: '村は、なぜぼくを知っている？', correct: false,
        log: ['L「村は、なぜぼくを知っている？」', '村長「……まだ、その時ではない」'],
        heartDown: 3
      },
      {
        text: '言葉を教えて', correct: true,
        log: ['L「言葉を教えて」', '村長「……それが、わしらにできる最後の抵抗だ」'],
        win: true
      }
    ]
  }
};

/* ───────────── ことばの総鳴り の演出ログ ─────────────
 * 空文字は ログ上の「すこしの間（あき）」として表示する。
 */
var SOUNARI_LOG = [
  'Lの中で、覚えた言葉が一斉に鳴った。',
  '',
  'こんにちは。',
  'どうして？',
  'だいじょうぶ。',
  '沈黙。',
  '',
  '言葉たちは、ひとつの音になって村長へ届いた。'
];

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'ペルソナ参考：心象弱点・総鳴りバトル',
  mockTitleEn: 'Psyche Weakness Battle',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  intro: [
    '相手の仮面に隠れたほころびを見つけ、言葉で閉じた心をほどいてください。',
    '弱点を突くと、相手の心が崩れます。その瞬間だけ、Lはもう一言だけ言えます。'
  ],
  playerName: 'L',
  playerTag: 'L — kotoba-android',
  imageName: '空白の心象'
};

// 勝利メッセージ（村長の本音にたどり着いた／閉じた心が0になった）
var WIN_TEXT = [
  '村長の仮面が、音もなく外れた。',
  '',
  '村長「……Lが来ることは、知っていた」',
  '村長「だが、何のために来るのかは知らされていなかった」',
  '',
  '村長「おまえは、世界を終わらせる鍵かもしれない」',
  '村長「それでも、わしらはおまえに言葉を教えることにした」',
  '',
  '村長「言葉を持たないままなら、おまえは命令に従うだけだ」',
  '村長「だが、言葉を持てば……選べるかもしれない」',
  '',
  'Lは、まだ「選ぶ」の意味を知らない。'
];

// 勝利時の報酬（新しい心象）
var WIN_REWARD = {
  title: '新しい心象を得た：村長の心象',
  desc: '村長の言葉の型。疑うことで、守ろうとしていた心象。'
};

// 敗北メッセージ（L のノイズ耐性が0になった）
var LOSE_TEXT = [
  'Lの中で、言葉がばらばらになった。',
  '「こんにちは」の意味を、一時的に忘れた。',
  '',
  '仮面の奥にあった本音は、また見えなくなった。'
];

// JXA（Node非対応のヘッドレス検証）/ Node 双方から参照できるよう公開
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, WORD_TYPES: WORD_TYPES, MASKS: MASKS,
    SKILLS: SKILLS, SKILL_ORDER: SKILL_ORDER, ENEMY: ENEMY,
    ENEMY_MOVES: ENEMY_MOVES, DIALOGUES: DIALOGUES, SOUNARI_LOG: SOUNARI_LOG,
    LORE: LORE, WIN_TEXT: WIN_TEXT, WIN_REWARD: WIN_REWARD, LOSE_TEXT: LOSE_TEXT
  };
}
