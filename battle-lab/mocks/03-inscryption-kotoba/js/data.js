/*
 * data.js — 「言葉を捧げる盤面バトル」（Inscryption 参考）のデータ定義（中核）
 *
 * このファイルだけ編集すれば、言葉札・村長・性質・バランスを増やせる作りにしている。
 * なぜデータとロジックを分けるか：今後カードや敵、別エリアを足すとき、
 * engine.js（進行ルール）を触らずに済むようにするため。
 *
 * 読み込みは <script src> の素のグローバル方式（依存ゼロ）。
 * DOM に一切触れないので、JXA（osascript）でのヘッドレス検証にもそのまま使える。
 *
 * ── 用語の言い換え（普通のカードゲーム → この世界観）──
 *   カード=言葉札 / 場のカード=言霊 / デッキ=語彙束 / 手札=手元の言葉
 *   レーン=声の道 / 攻撃力=届く力 / 体力=こわれにくさ / 敵HP=閉じた心
 *   プレイヤーHP=ノイズ耐性 / 生贄=供え言葉 / 骨=残響 / 特殊能力=言葉の性質
 */

/* ───────────── バランス定数（まずここを触って手応えを調整する） ───────────── */
var BALANCE = {
  lanes: 4,                 // 「声の道」の数（盤面のレーン）
  playerMaxNoise: 10,       // L の「ノイズ耐性」。0 になると敗北
  enemyMaxHeart: 10,        // 村長の「閉じた心」。0 にすると勝利
  handStart: 4,             // 開始時に引く「手元の言葉」の枚数
  drawPerTurn: 1,           // 毎ターン引く枚数
  handLimit: 8,             // 手札上限（あふれた言葉は引かない）
  echoStart: 0,             // 開始時の「残響」
  massuguBonus: 1,          // 性質「まっすぐ」：正面が空のとき 届く力 +この値
  mamoruReduce: 1,          // 性質「守る」：ぶつかりで受ける こわれにくさ を この値ぶん軽減
  omoiOfferPlus: 1,         // 性質「重い」（問い）：場にある間、供え言葉コストが +この値
  hodokeruTurns: 3,         // 性質「ほどける」（心配）：壊さず残ったターン数で ほどける
  hodokeruHeal: 2,          // ほどけたとき、閉じた心が減る量
  enemyIntentInitial: 2,    // 開始時に見せる村長の予告 枚数（盤面イメージは2枚）
  enemyIntentPerTurn: 2,    // 以降、毎ターン予告する最大枚数（空き声の道の数で頭打ち）
  speakEveryTurns: 2        // 「喋る言葉札」を出す最短間隔（ターン）
};

/* ───────────── 言葉の性質（＝特殊能力）の表示と説明 ─────────────
 * 効果の実体は engine.js が解釈する。ここは「名前・説明・どちら向きの性質か」だけ。
 */
var NATURE_DEFS = {
  mamoru:   { key: 'mamoru',   name: '守る',     desc: '正面の相手の言葉から受けるダメージ（こわれにくさ）を1減らす。' },
  nozoku:   { key: 'nozoku',   name: 'のぞく',   desc: '場に出たとき、村長の さらに先の予告（気配）を1枚 のぞき見る。' },
  kabe:     { key: 'kabe',     name: '壁',       desc: '相手の言葉を止めるが、閉じた心／ノイズ耐性には届かない。' },
  massugu:  { key: 'massugu',  name: 'まっすぐ', desc: '正面が空いているとき、強く届く（届く力 +' + BALANCE.massuguBonus + '）。' },
  omoi:     { key: 'omoi',     name: '重い',     desc: '場に残っている間、こちらの供え言葉コストが +' + BALANCE.omoiOfferPlus + '。' },
  hodokeru: { key: 'hodokeru', name: 'ほどける', desc: '壊さずに数ターン残すと、村長の閉じた心が少しほどける。' }
};

/* ───────────── 言葉札ライブラリ（＝語彙の図鑑） ─────────────
 *   kind:'word'  … 盤面（声の道）に置く言霊。reach=届く力 / dur=こわれにくさ / offer=供え言葉コスト
 *   kind:'echo'  … 盤面に置かない「残響」を使う特別な言葉（echoCost を払って即発動）
 *   nature       … 言葉の性質キー（NATURE_DEFS）。null なら性質なし
 *   levels       … 将来のレベルアップ用の“器”（今回は未使用）
 *                  例: ありがとう → 本当にありがとう → ありがとう、いてくれて
 */
var CARD_LIBRARY = {
  konnichiwa: {
    id: 'konnichiwa', name: 'こんにちは', kind: 'word',
    offer: 0, reach: 1, dur: 2, nature: null,
    text: 'はじめて覚えた、世界に触れるための言葉。',
    levels: []
  },
  daijoubu: {
    id: 'daijoubu', name: 'だいじょうぶ', kind: 'word',
    offer: 0, reach: 0, dur: 3, nature: 'mamoru',
    text: '自分にも、相手にも使える短い支え。',
    levels: []
  },
  doushite: {
    id: 'doushite', name: 'どうして？', kind: 'word',
    offer: 1, reach: 1, dur: 1, nature: 'nozoku',
    text: 'わからないことを、わからないままにしない言葉。',
    levels: []
  },
  chinmoku: {
    id: 'chinmoku', name: '沈黙する', kind: 'word',
    offer: 0, reach: 0, dur: 4, nature: 'kabe',
    text: '言葉がないことも、選択だった。',
    levels: []
  },
  shinjite: {
    id: 'shinjite', name: '信じて', kind: 'word',
    offer: 2, reach: 3, dur: 2, nature: 'massugu',
    text: 'まだ根拠はない。でも、届いてほしい言葉。',
    levels: []
  },
  // ── 残響（サブ資源）を使う特別な言葉。盤面には置かない ──
  // 「言葉を失ったあとにだけ使える言葉」という設計の最初の一枚。
  mouichido: {
    id: 'mouichido', name: 'もう一度', kind: 'echo',
    echoCost: 2, effect: 'recoverRandom',
    text: '失くした言葉を、もう一度だけ。捨て札からランダムに1枚、手元へ戻す。',
    levels: []
  }
};

/* ───────────── 初期語彙束（＝主人公 L が今もっている言葉） ─────────────
 * {id, count} の並びで持つので、枚数調整やカード追加が一目で分かる。
 */
var STARTING_DECK = [
  { id: 'konnichiwa', count: 4 },
  { id: 'daijoubu',   count: 3 },
  { id: 'doushite',   count: 2 },
  { id: 'chinmoku',   count: 1 },
  { id: 'shinjite',   count: 1 },
  { id: 'mouichido',  count: 1 } // 残響2で捨て札から1枚回収（実際に試せる）
];

/* ───────────── 村長の言葉（＝相手側の言霊） ─────────────
 * 予告として1ターン前に見え、翌ターン 声の道に出てくる。
 *   reach=届く力 / dur=こわれにくさ / nature=性質 / weight=予告抽選の重み
 */
var ENEMY_WORDS = {
  utagai: {
    id: 'utagai', name: '疑い', reach: 1, dur: 2, nature: null, weight: 50,
    text: '村長の目が、L の言葉を測っている。'
  },
  toi: {
    id: 'toi', name: '問い', reach: 0, dur: 3, nature: 'omoi', weight: 20,
    text: '「おまえは、何をしに来た」'
  },
  chinmoku_e: {
    id: 'chinmoku_e', name: '沈黙', reach: 0, dur: 4, nature: 'kabe', weight: 15,
    text: '言葉がない場所に、言葉は届きにくい。'
  },
  shinpai: {
    id: 'shinpai', name: '心配', reach: 0, dur: 2, nature: 'hodokeru', weight: 15,
    text: '敵意ではない。まだ名前のない感情。'
  }
};

/* ───────────── 敵（相手）の定義 ─────────────
 * 村長は悪者ではない。主人公を疑い、怖がり、でもどこか心配している存在。
 */
var ENEMIES = {
  sonchou: {
    id: 'sonchou',
    name: '村長',
    title: '主人公を 疑いながら、どこか 心配している',
    maxHeart: BALANCE.enemyMaxHeart, // 閉じた心
    wordPool: ['utagai', 'toi', 'chinmoku_e', 'shinpai'] // 予告で出してくる言葉
  }
};

/* ───────────── 喋る言葉札（不穏ギミック①）のセリフ ─────────────
 * 数ターンに一度、手元や場の言葉が短いひとことを漏らす。
 */
var SPEAK_LINES = {
  konnichiwa: ['「また、ぼくを 出すの？」', '「……だれに、言うの？」'],
  daijoubu:   ['「だいじょうぶ、って だれに？」', '「ほんとうに？」'],
  doushite:   ['「……どうして、なにも おしえてくれないの？」'],
  chinmoku:   ['「……」', '「………」'],
  shinjite:   ['「根拠は？」', '「それでも、いいの？」'],
  mouichido:  ['「もう一度、って 何度目だろう」']
};

/* ───────────── 供えた言葉を覚えている（不穏ギミック②） ─────────────
 * 同じ言葉を2回以上 供えると、短いメッセージが出る。
 * key が無い言葉は GENERIC を使う（{name} を差し替える）。
 */
var MEMORY_LINES = {
  konnichiwa: 'また「こんにちは」を供えた。L は、あいさつを 軽く扱うことを 覚えた。',
  daijoubu:   'また「だいじょうぶ」を供えた。だいじょうぶ じゃない、と どこかで 思いはじめている。',
  GENERIC:    'また「{name}」を供えた。L は、それを 手放すことに 慣れていく。'
};

/* ───────────── 供えるときの ひとこと（少し不穏に・軽め） ───────────── */
var OFFER_LINES = {
  konnichiwa: '「こんにちは」は、まだ 何かを言いたそうだった。',
  daijoubu:   '「だいじょうぶ」は、最後まで 笑っていた。',
  doushite:   '「どうして？」は、答えを 聞けずに 消えた。',
  chinmoku:   '「沈黙する」は、はじめから 何も 言わなかった。',
  shinjite:   '「信じて」は、ふりむかなかった。',
  GENERIC:    '「{name}」を 供えた。'
};

/* ───────────── 画面に出す世界観テキスト ───────────── */
var LORE = {
  labName: 'バトルシステム試作場 / Battle Lab',
  mockTitle: 'Inscryption参考：言葉を捧げる盤面バトル',
  mockTitleEn: 'Word Offering Board Battle',
  disclaimer: 'これは完成版ではなく、バトルシステム検証用のモックです。',
  // 開始画面・上部に出す説明文（仕様の指定文）
  intro: [
    '言葉を場に置き、時には言葉を供えながら、相手の「閉じた心」に届かせてください。',
    '敵を倒すのではなく、言葉で「閉じた心」をほどいていきます。',
    'でも、強い言葉を出すには、別の言葉を手放さなければならないこともあります。'
  ],
  premise: '敵を倒すのではなく、言葉で「閉じた心」をほどいていく。',
  // 用語ラベル（HUD で使う）
  termHand: '手元の言葉',
  termDeck: '語彙束',
  termDraw: '山札',
  termDiscard: '捨て札',
  termLane: '声の道',
  termReach: '届く力',
  termDur: 'こわれにくさ',
  termPlayerHp: 'ノイズ耐性',
  termEnemyHp: '閉じた心',
  termOffer: '供え言葉',
  termEcho: '残響',
  termIntent: '村長の予告'
};

// 勝利時メッセージ（村長の「閉じた心」が0になったら）— 倒した感ではなく「届いた」感
var WIN_TEXT = [
  '村長の閉じた心に、最後の言葉が届いた。',
  '村長「……言葉はまだ少ないな。でも、逃げなかった」',
  '村長「学校へ行け。おまえに必要なのは、武器じゃない」',
  '供えられた言葉たちは、少し遅れて 静かになった。'
];

// 敗北時メッセージ（L のノイズ耐性が0になったら）
var LOSE_TEXT = [
  'L の中で、言葉が ばらばらに なった。',
  '「こんにちは」の意味を、一時的に 忘れた。',
  '村長「……まだ早かったか」',
  '机の上の言葉札が、ひとりでに 裏返った。'
];

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, NATURE_DEFS: NATURE_DEFS, CARD_LIBRARY: CARD_LIBRARY,
    STARTING_DECK: STARTING_DECK, ENEMY_WORDS: ENEMY_WORDS, ENEMIES: ENEMIES,
    SPEAK_LINES: SPEAK_LINES, MEMORY_LINES: MEMORY_LINES, OFFER_LINES: OFFER_LINES,
    LORE: LORE, WIN_TEXT: WIN_TEXT, LOSE_TEXT: LOSE_TEXT
  };
}
