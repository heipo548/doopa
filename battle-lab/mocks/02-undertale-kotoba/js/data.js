/*
 * data.js — 「言葉アクション対話バトル」のデータ定義（中核）
 *
 * UNDERTALE “参考” のモック。倒すのではなく、言葉で相手の「閉じた心」をほどく。
 * このファイルだけを編集すれば、コマンド・効果・相手の感情・ノイズ（弾）・バランスを
 * 増やせる作りにしている（ロジック engine.js / bullet.js とは分離）。
 *
 * なぜデータとロジックを分けるか：
 *  ・今後「相手ごとの専用セリフ」「複数の勝利ルート」「言葉のレベルアップ」などを足すとき、
 *    進行ルール（engine.js）を触らずに済むようにするため。
 *  ・DOM に一切触れないので、JXA（osascript）でのヘッドレス検証にもそのまま使える。
 *
 * 読み込みは <script src> の素のグローバル方式（依存ゼロ・ビルドなし）。
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  playerMaxNoise: 20,    // プレイヤーHP＝「ノイズ耐性」。0 になると敗北
  winThreshold: 80,      // 「理解度」がこれ以上なら『ほどく』が成功（＝勝利）
  worryUnlock: 60,       // 「理解度」がこれ以上だと、村長が『心配する』感情を取りうる
  understandingMax: 100, // 理解度の上限
  warinessMax: 100,      // 警戒度の上限
  breathHeal: 3,         // 『深呼吸する』で回復するノイズ耐性

  // 感情回避フェーズ（弾よけ）の基本設定
  dodgeSeconds: 5.5,     // 1回の回避フェーズの長さ（秒）。仕様の「5〜6秒」
  invulnSeconds: 0.7,    // 被弾後の無敵時間（耐性20なので、連続被弾で即死させない配慮）
  guardReduce: 0.5,      // 『沈黙する』後：その回避フェーズの被ダメを半減
  slowFactor: 0.72,      // 『まって』後：その回避フェーズの弾速・出現を少し遅く
  // 警戒度→激しさ。wariness 0→×1.0, 100→×1.0+waryScale
  waryScale: 0.9
};

/* ───────────── コマンド（言葉）の木構造 ─────────────
 * 4つの親コマンド（つたえる/たずねる/おぼえる/しずまる）の下に、小さな選択肢を持つ。
 * effect は「データで書ける効果」をキーで表す。engine.js がこれを解釈する：
 *   und: n        … 理解度 +n（マイナスもOK）
 *   war: n        … 警戒度 +n（マイナスもOK）
 *   heal: n       … ノイズ耐性 +n（最大値を超えない）
 *   unlock: 'id'  … その言葉（コマンド option）を解禁する
 *   slowNext: true… 次の回避フェーズのノイズを少し遅く・少なくする（まって）
 *   guardNext:true… 次の回避フェーズで受けるダメージを軽減する（沈黙する）
 *   win: true     … 『ほどく』。理解度が winThreshold 以上なら勝利、未満なら失敗テキスト
 * lines  … 実行時に会話欄へ出すセリフ（配列。複数行OK）
 * requires … 使用可能条件のキー（engine.js が解釈）：
 *   'shinpaiUnlocked' … 『まねる』済みのときだけ選べる
 *   'understand80'    … 理解度80以上のときだけ“成功”する（ボタン自体は常に出す）
 * lockedHint … 条件未達のときにボタン下へ出す小さな注記
 */
var COMMAND_TREE = [
  {
    id: 'tsutaeru', label: 'つたえる', hint: '自分の言葉を相手に伝える（理解度を上げる行動）',
    options: [
      { id: 'konnichiwa', name: 'こんにちは', effect: { und: 8, war: 3 },
        lines: ['L「こんにちは」', '村長「……あいさつは、知っているのか」'] },
      { id: 'iyada', name: 'いやだ', effect: { und: 12, war: 10 },
        lines: ['L「いやだ」', '村長「言葉は強い。使い方を間違えるな」'] },
      { id: 'arigatou', name: 'ありがとう', effect: { und: 6, war: -5 },
        lines: ['L「ありがとう」', '村長「……礼を言われるようなことはしていない」'] },
      // 『まねる』後にだけ現れる、覚えたての言葉。理解度を大きく上げる切り札。
      { id: 'shinpai', name: '心配している', effect: { und: 20, war: -15 },
        requires: 'shinpaiUnlocked', lockedHint: '『おぼえる→まねる』で覚える',
        lines: ['L「心配している」', '村長「……そうだ。怖いんじゃない。心配なんだ」'] }
    ]
  },
  {
    id: 'tazuneru', label: 'たずねる', hint: '相手を観察したり、質問したりする（このモックの中心）',
    options: [
      { id: 'miru', name: 'みる', effect: { und: 5, war: -3 },
        lines: ['村長をみた。', '小さな手帳を握っている。', 'あなたを怖がっているようだ。'] },
      { id: 'kiku', name: 'きく', effect: { und: 8, war: -8 },
        lines: ['Lは、村長の言葉を最後まで聞いた。', '村長の声が少しだけやわらいだ。'] },
      { id: 'doushite', name: 'どうして？', effect: { und: 10, war: 2 },
        lines: ['L「どうして？」', '村長「……おまえには、まだ言えない」'] },
      // まって：次フェーズのノイズを少し遅くする（避けやすくなる立て直しの一手）
      { id: 'matte', name: 'まって', effect: { und: 4, war: -10, slowNext: true },
        lines: ['L「まって」', '村長は、言葉を選び直している。'] }
    ]
  },
  {
    id: 'oboeru', label: 'おぼえる', hint: '相手の言葉をまねて、一時的に新しい言葉を覚える',
    options: [
      // まねる：つたえるに『心配している』を追加する（unlock）
      { id: 'maneru', name: 'まねる', effect: { und: 5, unlock: 'shinpai' },
        lines: ['Lは、村長の口ぐせをまねた。', '一時的に「心配している」を覚えた。',
                '（つたえる に「心配している」が増えた）'] }
    ]
  },
  {
    id: 'shizumaru', label: 'しずまる', hint: '自分の中のノイズを整える（回復・防御・勝利）',
    options: [
      { id: 'chinmoku', name: '沈黙する', effect: { war: -5, guardNext: true },
        lines: ['Lは、何も言わなかった。', 'でも、逃げなかった。'] },
      { id: 'shinkokyuu', name: '深呼吸する', effect: { heal: 3 },
        lines: ['Lは、呼吸のまねをした。', 'ノイズが少しだけ整った。'] },
      // ほどく：理解度80以上なら勝利。未満ならボタンは出すが“失敗テキスト”を返す。
      { id: 'hodoku', name: 'ほどく', effect: { win: true },
        requires: 'understand80', lockedHint: '理解度80以上で ほどける',
        lines: [],
        winLines: ['Lは、言葉をほどいた。', '村長の閉じた心が、少しだけひらいた。'],
        failLines: ['まだ、ほどけない。', '村長の心には、言葉が足りない。'] }
    ]
  }
];

/* ───────────── ノイズ（弾）の種類 ─────────────
 * bullet.js がこの定義を見て、見た目・速さ・ダメージを決める。
 *   kind:'aim'  … 出現時のプレイヤー位置へ向かって飛ぶ
 *   kind:'fall' … 上からゆっくり落ちる
 *   speed       … 基本速度(px/秒)。警戒度や『まって』で増減する
 *   damage      … 当たると減るノイズ耐性
 *   heal        … 触れると増える理解度（記憶のかけら用。避ける弾は heal なし）
 */
var NOISE_TYPES = {
  // 疑いノイズ：？マーク・ゆっくり飛ぶ・1ダメージ
  doubt: { id: 'doubt', glyph: '？', kind: 'aim', speed: 70, jitter: 0.5,
           radius: 11, damage: 1, cls: 'n-doubt' },
  // 怒りノイズ：！マーク・直線的に速く・2ダメージ
  anger: { id: 'anger', glyph: '！', kind: 'aim', speed: 185, jitter: 0.0,
           radius: 11, damage: 2, cls: 'n-anger' },
  // 記憶のかけら：光る文字片・ゆっくり落ちる・触れると理解度+3（“避けるだけじゃない”体験）
  shard: { id: 'shard', glyph: '◇', kind: 'fall', speed: 55, jitter: 0.3,
           radius: 12, damage: 0, heal: 3, cls: 'n-shard',
           // 文字片はランダムにこの中から選ぶ（欠けた言葉＝世界観）
           glyphs: ['こ', 'と', 'ば', 'あ', 'り', 'が', 'う', 'ね', 'だ', 'い'] }
};

/* ───────────── 村長の「感情」パターン ─────────────
 * 1ターンごとに1つ選ばれ、回避フェーズの弾幕傾向を決める。
 * line      … 回避フェーズに入るときに会話欄へ出す“感情”のセリフ（\n で改行）
 * spawn     … 各ノイズの出やすさ（相対倍率）。bullet.js が基本レートに掛ける
 * weight    … 抽選の重み（chooseEmotion）
 * requiresUnderstanding … 理解度がこの値以上のときだけ抽選候補に入る
 */
var EMOTIONS = {
  utagau: {
    id: 'utagau', name: '疑う',
    line: '村長は、あなたを疑っている。',
    spawn: { doubt: 1.0, anger: 0.15, shard: 0.12 }, weight: 40
  },
  toitsumeru: {
    id: 'toitsumeru', name: '問い詰める',
    line: '村長「おまえは、何をしに来た」',
    spawn: { doubt: 0.5, anger: 1.0, shard: 0.05 }, weight: 30
  },
  damatte: {
    id: 'damatte', name: '黙って見る',
    line: '村長は、何かを言いかけてやめた。',
    spawn: { doubt: 0.4, anger: 0.08, shard: 0.35 }, weight: 28
  },
  // 心配する：理解度60以上で出現。ノイズ少なめ＋記憶のかけら多め（やさしい弾幕）
  shinpai: {
    id: 'shinpai', name: '心配する',
    line: '村長は、あなたを怖がっているのではない。\n心配している。',
    spawn: { doubt: 0.18, anger: 0.04, shard: 0.7 }, weight: 60,
    requiresUnderstanding: 60
  }
};

/* ───────────── 「閉じた心」のテキスト表現 ─────────────
 * 理解度から「まだ固い / 少しゆるんだ / ほどけそう」を返すためのしきい値。
 * “ほどけそう”は勝利条件(80)に重ねて、ほどける合図になるようにしている。
 */
function closedHeartText(understanding) {
  if (understanding >= BALANCE.winThreshold) return 'ほどけそう';
  if (understanding >= 40) return '少しゆるんだ';
  return 'まだ固い';
}

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'UNDERTALE参考：言葉アクション対話バトル',
  mockTitleEn: 'Word Action Dialogue Battle',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  // ページ上部に出す、操作の方針（仕様で指定された説明文）
  howto: [
    'これは完成版ではなく、バトルシステム検証用のモックです。',
    '敵を倒すのではなく、言葉で「閉じた心」をほどいていきます。',
    '相手を観察し、言葉を選び、飛んでくる感情を避けながら、理解度を上げてください。'
  ],
  playerName: 'L',
  enemyName: '村長',
  enemyTitle: '悪者ではない。あなたを 疑い、怖がり、でも どこか 心配している',
  termNoise: 'ノイズ耐性',
  termUnderstanding: '理解度',
  termWariness: '警戒度',
  termClosedHeart: '閉じた心',
  // 回避フェーズの操作説明
  dodgeHelp: '矢印キー / WASD で「こころ」を動かす（スマホは指でドラッグ）。？！を避け、◇に触れると理解度+3。'
};

// 勝利時のメッセージ（理解度80以上で『ほどく』に成功）
var WIN_TEXT = [
  '村長の閉じた心が、少しだけほどけた。',
  '村長「……言葉はまだ少ないな。でも、逃げなかった」',
  '村長「学校へ行け。おまえに必要なのは、武器じゃない」'
];

// 敗北時のメッセージ（ノイズ耐性が0）
var LOSE_TEXT = [
  'Lの中で、言葉がばらばらになった。',
  '「こんにちは」の意味を、一時的に忘れた。'
];

// JXA（Node非対応のヘッドレス検証）でも参照できるよう、明示的に公開しておく
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, COMMAND_TREE: COMMAND_TREE, NOISE_TYPES: NOISE_TYPES,
    EMOTIONS: EMOTIONS, closedHeartText: closedHeartText, LORE: LORE,
    WIN_TEXT: WIN_TEXT, LOSE_TEXT: LOSE_TEXT
  };
}
