/*
 * data.js — 「Battle 15：ことば選択型・理解バトル」のデータ定義（中核）
 *
 * このバトルは “倒す” ためのものではない。相手を理解し、警戒させすぎずに、
 * 心の距離を少しずつ縮める——そのための「ことば選び」を検証するモック。
 *
 * 設計の柱：
 *   ・毎ターン 3つの「ことば／ふるまい」から1つを選ぶ（沈黙中だけ2つ）。
 *   ・3つは「安全・小／高リスク・大／状況しだい」の三角で出す（spec 8.1）。
 *   ・理解度／警戒度／余裕 を内部数値で持ち、画面には“ことば”で見せる（spec 10.2）。
 *   ・相手のタイプ（さびしがり・おこりっぽい・こわがり・つよがり）で相性が変わる。
 *   ・状態（安心・沈黙・強がり・動揺）で、同じ言葉でも効き方が変わる。
 *
 * このファイルだけを編集すれば、選択肢・相手・相性・バランスを増やせる。
 * engine.js（進行ルール）は DOM に一切触れないので、JXA / Node どちらでも点検できる。
 *
 * ── word + l = world（テーマ）──────────────────────────
 *   主人公 L は、言葉を覚えていない無機質なアンドロイド。
 *   ことばを ひとつ選ぶたび、L は ほんの少しだけ世界に近づく。
 *   （演出には薄く滲ませる程度。露骨には出さない。）
 */

/* ═══════════════ バランス定数（まずここを触って手応えを調整する） ═══════════════ */
var BALANCE = {
  alertCap: 100,        // 警戒度がこの値に達すると「拒絶」＝失敗
  composureMax: 100,    // 余裕の最大。0 になると“焦り”状態になり、選べる言葉の質が落ちる
  understandingMax: 100,

  // 相性倍率（選択肢カテゴリ × 相手タイプ）
  goodU: 1.4,   // よく届くとき：理解度の伸び ×1.4
  goodA: 0.45,  // よく届くとき：警戒の上がり ×0.45（上がりにくい）
  badU: 0.55,   // 苦手なとき：理解度の伸び ×0.55
  badA: 1.9,    // 苦手なとき：警戒の上がり ×1.9（強く身構える）

  // 状態による補正
  anshinAlertMult: 0.4, // 安心：警戒の上がりを ×0.4
  anshinKikuU: 1.3,     // 安心：聞く系の理解度 ×1.3
  chinmokuPushAlert: 16,// 沈黙中に「聞く／核心」を押すと 警戒 +16
  bluffEffU: 0.6,       // 強がり中：聞く／伝える の理解度 ×0.6（崩すまで効きにくい）
  doyoU: 1.6,           // 動揺：理解度 ×1.6（大チャンス）
  doyoAlertMult: 1.9,   // 動揺：警戒が上がる選択だと ×1.9（踏み込みすぎが致命的）

  // 状態遷移のしきい値
  anshinStreak: 2,      // 受け止める系が2回続けて成功 → 安心
  doyoCoreUnderstanding: 35, // 核心に触れる言葉は、理解度がこの値以上なら「動揺」を生みやすい

  // 余裕（コスト）の目安
  costLight: 6, costMedium: 12, costHeavy: 18, costObserve: 4,
  recoverDistance: 16,  // 距離を取ると余裕が回復する量
  panicAlert: 12,       // 焦り choice の基本警戒上昇

  // 勝利の質
  warmWinAlert: 40      // 勝利時、警戒がこの値未満なら「深く理解できた」良エンド
};

/* ═══════════════ 選択肢のカテゴリ（6種：spec 5）═══════════════
 * key で参照し、label/desc を画面に出す。color は左帯の色。
 */
var CATEGORIES = {
  kiku:      { key:'kiku',      label:'聞く',     color:'#d9b86a', desc:'相手から情報を引き出す。話したがっている時に強い。連発は警戒を生む。' },
  uketomeru: { key:'uketomeru', label:'受け止める', color:'#8fd0a0', desc:'相手を安心させる。不安・怒りに有効。理解度はあまり伸びない。' },
  tsutaeru:  { key:'tsutaeru',  label:'伝える',   color:'#efa6b6', desc:'こちらの考えを伝える。刺されば大きいが、外すと警戒が上がる。' },
  kansatsu:  { key:'kansatsu',  label:'観察する', color:'#79c7c0', desc:'よく見る。次の選択肢が良くなり、本音のヒントが出る。余裕の消費が小さい。' },
  kyori:     { key:'kyori',     label:'距離を取る', color:'#9aa0ad', desc:'踏み込みすぎない。警戒を下げ、余裕が回復する。理解度は上がりにくい。' },
  sashidasu: { key:'sashidasu', label:'差し出す', color:'#b79ad6', desc:'記憶・持ち物・言葉を差し出す。合えば大きく、合わないと大きく警戒。回数制限あり。' }
};

/* ═══════════════ 相手のタイプ（4種：spec 6）═══════════════
 * good … よく届くカテゴリ（理解度↑・警戒↓寄り）
 * bad  … 苦手なカテゴリ（警戒↑・理解度↓寄り）
 * 相手は複数タイプを持てる（例：門番＝つよがり＋さびしがり）。
 * 判定の優先順位は bad > good（どれか1タイプでも苦手なら身構える）。
 */
var ENEMY_TYPES = {
  sabishigari: {
    key:'sabishigari', label:'さびしがり', color:'#e7a6c4',
    note:'やさしい言葉に反応しやすい。放置されると不安になる。',
    good:['uketomeru','sashidasu','kiku'], bad:['kyori']
  },
  // ※ おこりっぽい は今の2エンカウンターでは未使用（伝える=苦手 が活きる相手として、
  //    今後のエンカウンター／ボス戦で使う想定の“器”。typeMatch はタイプ名でしか引かないので置いておいても無害）。
  okorippoi: {
    key:'okorippoi', label:'おこりっぽい', color:'#e08a7a',
    note:'最初から警戒が高い。正論に反発しやすい。本当は傷ついている。',
    good:['kyori','kansatsu','uketomeru'], bad:['tsutaeru']
  },
  kowagari: {
    key:'kowagari', label:'こわがり', color:'#9ab8e0',
    note:'小さな言葉でも警戒が上がる。安心すると一気に話す。急な展開に弱い。',
    good:['uketomeru','kansatsu','kyori'], bad:['kiku','tsutaeru']
  },
  tsuyogari: {
    key:'tsuyogari', label:'つよがり', color:'#c0a878',
    note:'本音を隠す。優しくされるとごまかす。観察によって本音が見えやすい。',
    good:['kansatsu','tsutaeru'], bad:['uketomeru']
  }
};

/* ═══════════════ 状態変化（4種：spec 7）═══════════════ */
var STATES = {
  anshin: { key:'anshin', label:'安心', color:'#8fd0a0',
    note:'警戒が上がりにくい。聞く系が通りやすい。', look:'肩の力が、すこし抜けている。' },
  chinmoku:{ key:'chinmoku', label:'沈黙', color:'#9aa0ad',
    note:'選べる言葉が減る。無理に聞くと警戒が大きく上がる。待つ・距離・差し出すで解ける。', look:'相手は、口をつぐんでいる。' },
  bluff:  { key:'bluff', label:'強がり', color:'#c0a878',
    note:'相手は本音と逆のことを言う。様子の文が、少し信用できない。観察や軽い言葉で崩れる。', look:'平気なふりをしている。でも、それは ふりだ。' },
  doyo:   { key:'doyo', label:'動揺', color:'#e0b070',
    note:'理解度の大チャンス。ただし選択を誤ると警戒も大きく上がる。', look:'相手の目が、すこし泳いだ。' }
};

/* ═══════════════ 理解度／警戒度／余裕 を“ことば”にする（spec 10.2）═══════════════
 * 数値は内部にだけ持ち、画面にはこの文を出す。
 */
var GAUGE_WORDS = {
  understanding: [
    { upTo: 12,  text:'まだ、何も分からない' },
    { upTo: 30,  text:'すこし、見えてきた' },
    { upTo: 52,  text:'分かってきた' },
    { upTo: 74,  text:'けっこう、分かってきた' },
    { upTo: 99,  text:'ほとんど、分かった' },
    { upTo: 1000,text:'この子のことが、分かった' }
  ],
  alert: [
    { upTo: 18,  text:'警戒していない' },
    { upTo: 40,  text:'すこし、身構えている' },
    { upTo: 64,  text:'かなり、警戒している' },
    { upTo: 86,  text:'強く、拒もうとしている' },
    { upTo: 1000,text:'もう、限界に近い' }
  ],
  composure: [
    { upTo: 24,  text:'ぎりぎり' },
    { upTo: 49,  text:'すくない' },
    { upTo: 74,  text:'ふつう' },
    { upTo: 1000,text:'たっぷり' }
  ]
};

/* ═══════════════ 反応テキスト（結果の良し悪しでログに出す共通文）═══════════════
 * engine.reactLine() は選択肢ごとの react を優先し、無ければ quality（good/neutral/bad）で
 * このバンクを引く。warm/spike/reveal は“将来用のことばパレット”で、現状 reactLine からは
 * 直接引かれない（選択肢の react でほぼ全ケース文が付いているため）。残しておくのは後で使うため。
 */
var REACT = {
  good:    ['——その言葉は、ちゃんと届いたようだ。'],
  warm:    ['相手の肩の力が、すこし抜けた。'],          // 予備：未使用
  neutral: ['相手は、こちらをじっと見ている。'],
  bad:     ['相手の表情が、すこし固くなった。'],
  spike:   ['しまった——踏み込みすぎたかもしれない。'],  // 予備：未使用
  reveal:  ['よく見ると、いままで見えなかったものが見えてきた。'] // 予備：未使用
};

/* ───────────── 焦り（余裕0）のときに出る、質の落ちた選択肢 ───────────── */
/* spec 16：余裕がなくなると、焦った言葉しか選べなくなる。 */
var PANIC_CHOICES = [
  { id:'panic_dakara', text:'「だから、何が言いたいの？」', category:'kiku',
    role:'risk', cost:0, understanding:2, alert:18,
    react:{ good:'', neutral:'相手は、すっと目をそらした。', bad:'相手は、すっと目をそらした。' } },
  { id:'panic_wakaranai', text:'「もう、分からないよ」', category:'tsutaeru',
    role:'risk', cost:0, understanding:1, alert:14,
    react:{ neutral:'こぼれた弱音は、相手をすこし戸惑わせた。' } },
  { id:'panic_iki', text:'ひとつ、息をつく。', category:'kyori',
    role:'safe', cost:0, understanding:0, alert:-4, recover:22,
    react:{ neutral:'L は、いちど 言葉を 手放した。すこしだけ、余裕が戻る。' } }
];

/* ═══════════════ 相手（エンカウンター）═══════════════
 * choicePool の各選択肢が取れるフィールド：
 *   id, text, category, role('safe'|'risk'|'situational'|'observe'|'distance'|'offer')
 *   cost          … 余裕の消費（距離・差し出す等は recover で回復も）
 *   recover       … 余裕の回復量（距離を取る）
 *   understanding … 基本の理解度変化
 *   alert         … 基本の警戒度変化
 *   core:true     … 核心に触れる言葉（動揺を生みうる／踏み込みすぎ判定の対象）
 *   gentle:true   … やわらかい言い方（動揺・こわがり・安心に噛み合う）
 *   risk:{cond,success:{understanding,alert},fail:{understanding,alert}}
 *                 … 高リスク選択。cond を満たせば success、外せば fail。
 *   requires:{flag,notFlag,state,notState,minTurn,minUnderstanding}
 *                 … 出現条件（満たすターンだけ候補に入る）
 *   reveal:'flagName'   … 観察などで真実フラグを立てる
 *   hint:'…'            … 観察で次に出すヒント（様子テキストに反映）
 *   setState/clearState … 使うと相手の状態を付与／解除
 *   limited:true        … 差し出す。残り回数 sashidasuUses を消費
 *   once:true           … 1戦に1回だけ出る（使うと以降は出ない）
 *   react:{good,neutral,bad} … 結果別の相手の反応（無ければ共通 REACT）
 *
 * look：ターン開始時の「相手の様子」。state/understanding に応じて engine が選ぶ。
 */
var ENCOUNTERS = {

  /* ───────────────────────────────────────────────────────────
   * Encounter 1（チュートリアル）：道端で泣いている小さなキャラクター
   *   目的：3択を選ぶことを覚える／聞きすぎると怖がると知る／待つ・受け止めるも有効と知る。
   *   タイプ：こわがり（チュートリアルは単タイプで分かりやすく）。やさしく、短く。
   * ─────────────────────────────────────────────────────────── */
  naku_ko: {
    id:'naku_ko',
    name:'泣いている子',
    title:'道の端で、ひとり うずくまっている',
    face:'child',
    types:['kowagari'],
    understandingGoal:55,
    alertStart:12,
    turnLimit:11,
    composureStart:60,
    sashidasuUses:1,
    startStates:[],
    firstLine:'……（小さく、鼻をすする音）',
    intro:[
      '小さな子が、道の端で うずくまっている。',
      '近づくと、ほんの少しだけ 肩が震えた。',
      'L は、この子に かける言葉を まだ ほとんど 知らない。'
    ],
    look:{
      default:'小さな子が、うずくまっている。こちらの足音に、肩が ぴくりと 動いた。',
      lowU:'子は 顔を上げない。でも、逃げては いかない。',
      midU:'子は、ちらりと こちらを 見た。すぐに うつむいたけれど。',
      highU:'子は、すこしだけ 顔を上げている。何か 言いたそうに 口を ひらきかけた。',
      byState:{
        anshin:'子の 呼吸が、すこし ゆっくりに なった。',
        chinmoku:'子は ぎゅっと 口を むすんでしまった。',
        doyo:'子の 目に、みるみる 涙が たまっていく。'
      }
    },
    choicePool:[
      /* ── チュートリアル1ターン目の三択（spec 11.1 をそのまま）── */
      { id:'c1_doushita', text:'「どうしたの？」', category:'kiku', role:'risk',
        cost:8, understanding:10, alert:7, requires:{ maxTurn:1 },
        react:{ good:'子は びくっと して、また うつむいた。', neutral:'子は びくっと して、また うつむいた。', bad:'子は びくっと して、肩を すぼめた。' } },
      { id:'c1_daijoubu', text:'「大丈夫？」', category:'uketomeru', role:'safe',
        cost:6, understanding:5, alert:-2, gentle:true, requires:{ maxTurn:1 },
        react:{ good:'子は 返事を しない。でも、逃げもしなかった。', neutral:'子は 返事を しない。でも、逃げもしなかった。' } },
      { id:'c1_shagamu', text:'すこし離れて、しゃがむ。', category:'kyori', role:'situational',
        cost:0, recover:8, understanding:3, alert:-9, reveal:'closer', gentle:true, requires:{ maxTurn:1 },
        hint:'子の そばに、ちいさな はなが 一輪 落ちている。',
        react:{ good:'同じ目線に なると、子の 震えが すこし おさまった。', neutral:'同じ目線に なると、子の 震えが すこし おさまった。' } },

      /* ── 2ターン目以降：聞く（やさしめ／核心）── */
      { id:'c1_doko', text:'「どこか、痛い？」', category:'kiku', role:'safe',
        cost:8, understanding:9, alert:6, gentle:true, requires:{ minTurn:2 },
        react:{ good:'子は ちいさく 首を ふった。痛いんじゃ、ないらしい。' } },
      { id:'c1_naze', text:'「どうして、泣いてるの？」', category:'kiku', role:'risk',
        cost:10, understanding:16, alert:14, core:true, requires:{ minTurn:2, notState:'chinmoku' },
        risk:{ cond:{ any:[{minUnderstanding:35},{state:'anshin'},{state:'doyo'}] }, success:{ understanding:20, alert:2 }, fail:{ understanding:6, alert:11 } },
        react:{ good:'「……ひとりに、なっちゃった」 子は そう つぶやいた。', bad:'子は 口を むすんで、首を ふった。' } },

      /* ── 受け止める ── */
      { id:'c1_muri', text:'「むりに 話さなくて いいよ」', category:'uketomeru', role:'safe',
        cost:6, understanding:5, alert:-10, gentle:true, requires:{ minTurn:2 },
        react:{ good:'子は、こくりと 小さく うなずいた。' } },
      { id:'c1_koko', text:'「ここに いても いいと 思う」', category:'uketomeru', role:'situational',
        cost:8, understanding:8, alert:-7, gentle:true, requires:{ minTurn:2 },
        react:{ good:'子は、すこしだけ こちらに 体を 向けた。' } },

      /* ── 観察 ── */
      { id:'c1_matsu', text:'何も言わず、表情の変化を待つ。', category:'kansatsu', role:'observe',
        cost:4, understanding:4, alert:-3, reveal:'tear', requires:{ minTurn:2 },
        hint:'子の 涙は、痛みの涙では なさそうだ。さびしさの 涙に 見える。',
        react:{ good:'待っていると、子は ちらりと こちらを うかがった。' } },
      { id:'c1_hana', text:'落ちている はなを、そっと 拾う。', category:'kansatsu', role:'observe',
        cost:4, understanding:6, alert:-2, reveal:'hana', requires:{ flag:'closer' },
        hint:'はなは まだ しおれていない。さっき まで 誰かが 持っていたのかもしれない。',
        react:{ good:'子は、L の 手の中の はなを じっと 見た。' } },

      /* ── 差し出す（1回）── */
      { id:'c1_hana_watasu', text:'拾った はなを、子に 渡す。', category:'sashidasu', role:'offer',
        cost:14, understanding:10, alert:0, limited:true, gentle:true, requires:{ flag:'hana' },
        risk:{ cond:{ any:[{minUnderstanding:30}] }, success:{ understanding:24, alert:-8, setState:'doyo' }, fail:{ understanding:8, alert:10 } },
        react:{ good:'子は はなを 受け取って、ぎゅっと 握った。「……これ、わたしの」', bad:'子は はなを 見つめたまま、動かなかった。' } },

      /* ── 距離を取る ── */
      { id:'c1_ippo', text:'一歩 下がって、空を 見る。', category:'kyori', role:'distance',
        cost:0, recover:12, understanding:1, alert:-8, gentle:true, requires:{ minTurn:2 },
        react:{ neutral:'急かさない時間が、ふたりの あいだに 流れた。' } }
    ],
    /* 勝利テキスト（理解度ゴール到達） */
    winText:[
      '子は、ようやく ちゃんと 顔を 上げた。',
      '「……いっしょに、さがして くれる？」',
      'うずくまっていた子は、L の 手を そっと 握った。',
      'L は、この子の さびしさを すこし 分かった気がした。'
    ],
    warmWinText:[
      '子の 涙は、もう 止まっていた。',
      '「ありがとう。……なまえ、なんていうの？」',
      'L は まだ 自分の 名前を うまく 言えない。でも、それでも よかった。',
      '——ことばを ひとつ、世界に 置けた 気がした。'
    ],
    loseReject:[
      '「……っ」 子は はじかれた ように 立ち上がり、走って いってしまった。',
      'L の 言葉は、すこし 強すぎたのかもしれない。',
      '小さな背中は、すぐに 見えなくなった。'
    ],
    loseSurface:[
      'しばらくして、子は ひとりで 歩いて いった。',
      'すこしは 話せた。でも、あの子が ほんとうに 言いたかったことは、分からないままだった。'
    ],
    rewards:['kotoba_soba','kotoba_kiku','kotoba_matsu']
  },

  /* ───────────────────────────────────────────────────────────
   * Encounter 2：つよがりな門番（spec 12 / 5節の本命例）
   *   本当は寂しい。でも弱さを見せたくない。優しくされるとごまかす。観察に弱い。
   *   タイプ：つよがり＋さびしがり。状態：最初から「強がり」。
   *   勝利：理解度80%以上。警戒が100%になる前に、門番が本音を話せる状態に。
   * ─────────────────────────────────────────────────────────── */
  gatekeeper: {
    id:'gatekeeper',
    name:'門番',
    title:'腕を組んで、誰も通そうとしない',
    face:'gate',
    types:['tsuyogari','sabishigari'],
    understandingGoal:80,
    alertStart:35,
    turnLimit:14,
    composureStart:70,
    sashidasuUses:2,
    startStates:['bluff'],
    firstLine:'門番「用が ないなら 帰れ」',
    intro:[
      '門番は 腕を 組んでいる。',
      '「用が ないなら 帰れ」と 言うが、足元には 誰かを 待っていた ような 跡がある。',
      'この門番は、つよがり だ。でも——つよがりは、たいてい さびしい。'
    ],
    look:{
      default:'門番は 腕を 組み、こちらを 見ようとしない。でも、視線の 端で L を 追っている。',
      lowU:'門番は「帰れ」と くり返す。その声は、思ったより 硬くない。',
      midU:'門番の 腕の 組み方が、すこし ゆるんでいる。',
      highU:'門番は もう、追い返そうとは しない。何かを 言いかけて、のみこんでいる。',
      byState:{
        bluff:'門番は 平気な 顔を している。けれど、足が しきりに 門の外を 気にしている。',
        anshin:'門番の 肩から、すこし 力が 抜けた。',
        chinmoku:'門番は 口を つぐみ、そっぽを 向いてしまった。',
        doyo:'「別に、待ってなんか ない」——そう 言いながら、門番は 門の外を 見た。'
      }
    },
    choicePool:[
      /* ── ターン1の三択（spec 12.1 をそのまま）── */
      { id:'g_matte_no', text:'「誰かを 待ってたの？」', category:'kiku', role:'risk',
        cost:12, understanding:18, alert:15, core:true, requires:{ maxTurn:2, notState:'chinmoku' },
        risk:{ cond:{ any:[{flag:'tracks'},{state:'doyo'}] }, success:{ understanding:24, alert:4 }, fail:{ understanding:6, alert:24 } },
        react:{ good:'門番は ぴたりと 動きを 止めた。「……誰が」', bad:'門番「は？ なんの 話だ」 腕に また 力が こもった。' } },
      { id:'g_jama', text:'「邪魔して ごめん。すこしだけ ここに いていい？」', category:'uketomeru', role:'safe',
        cost:8, understanding:6, alert:-9, gentle:true, requires:{ maxTurn:3 },
        react:{ good:'門番「……勝手に しろ」 でも、追い返しは しなかった。', neutral:'門番「……勝手に しろ」' } },
      { id:'g_ato', text:'足元の 跡を、じっと 見る。', category:'kansatsu', role:'observe',
        cost:4, understanding:5, alert:0, reveal:'tracks', clearState:'bluff', requires:{ maxTurn:3, notFlag:'tracks' },
        hint:'足元の 跡は、何度も 同じ場所を 行き来して できたものだ。ずっと、ここに いたんだ。',
        react:{ good:'門番は L の 視線に 気づいて、すこしだけ 顔を そらした。' } },

      /* ── ターン2以降：跡に触れる（観察後に開く）── */
      { id:'g_zutto', text:'「ずっと、ここに いたんだね」', category:'uketomeru', role:'situational',
        cost:10, understanding:16, alert:5, gentle:true, requires:{ flag:'tracks' },
        react:{ good:'門番は 何も 言わなかった。でも、否定も しなかった。' } },
      { id:'g_samui', text:'「寒くない？」', category:'uketomeru', role:'safe',
        cost:6, understanding:7, alert:-7, gentle:true, requires:{ minTurn:2 },
        react:{ good:'門番「……平気だ」 そう言って、すこし 肩を すくめた。' } },
      { id:'g_konai', text:'「待ってる人が、来ないの？」', category:'kiku', role:'risk',
        cost:12, understanding:17, alert:16, core:true, requires:{ flag:'tracks', notState:'chinmoku' },
        risk:{ cond:{ any:[{minUnderstanding:35},{state:'anshin'},{state:'doyo'}] }, success:{ understanding:22, alert:2, setState:'doyo' }, fail:{ understanding:8, alert:22 } },
        react:{ good:'門番の 喉が、こくりと 動いた。', bad:'門番「……うるさい」 声が、すこし 尖った。' } },

      /* ── 観察（つよがりは観察に弱い）── */
      { id:'g_kao', text:'門番の 表情の 変化を、待つ。', category:'kansatsu', role:'observe',
        cost:4, understanding:6, alert:-2, clearState:'bluff', reveal:'face', requires:{ minTurn:2 },
        hint:'平気そうな 顔の 奥で、門番は ときどき 門の外を うかがっている。',
        react:{ good:'待っていると、門番の 「平気な ふり」が、すこし はがれた。' } },

      /* ── 伝える（つよがりに効く：軽く、前置きして）── */
      { id:'g_gomen', text:'「間違ってたら ごめん。きみ、ほんとは 心配なんじゃ ない？」', category:'tsutaeru', role:'risk',
        cost:14, understanding:20, alert:12, core:true, gentle:true, requires:{ minTurn:3, notState:'chinmoku' },
        risk:{ cond:{ any:[{minUnderstanding:45},{state:'doyo'},{state:'anshin'}] }, success:{ understanding:26, alert:-4, setState:'doyo' }, fail:{ understanding:8, alert:20 } },
        react:{ good:'門番は 言い返そうとして、できなかった。', bad:'門番「……知った 風な 口を きくな」' } },
      { id:'g_semenai', text:'「責めに 来たわけじゃ ないよ」', category:'tsutaeru', role:'safe',
        cost:8, understanding:8, alert:-4, requires:{ minTurn:2 },
        react:{ good:'門番は すこし、警戒を ゆるめた。' } },

      /* ── 動揺中の三択（spec 12.1 ターン3）── */
      { id:'g_issho', text:'「そっか。じゃあ、すこし 一緒に 待っても いい？」', category:'uketomeru', role:'situational',
        cost:10, understanding:18, alert:-8, gentle:true, requires:{ state:'doyo' },
        react:{ good:'門番は ながく 黙って、それから 小さく うなずいた。「……好きに しろ」' } },
      { id:'g_uso', text:'「嘘 つかなくて いいよ」', category:'tsutaeru', role:'risk',
        cost:10, understanding:10, alert:16, requires:{ state:'doyo' },
        react:{ neutral:'門番は、ふっと 目を そらした。', bad:'門番「嘘なんか、ついて ない」 声が、また 硬くなった。' } },
      { id:'g_sabishii', text:'「ほんとは 寂しいんでしょ？」', category:'kiku', role:'risk',
        cost:12, understanding:12, alert:28, core:true, requires:{ state:'doyo' },
        react:{ neutral:'門番は 何も 言わず、門の外を 見つめた。', bad:'図星すぎる 言葉に、門番は ぱっと 壁を 作った。「——帰れ」' } },

      /* ── 差し出す（2回。自分の失敗談／古い写真）── */
      { id:'g_shippai', text:'自分の 失敗談を、ぽつりと 話す。', category:'sashidasu', role:'offer',
        cost:14, understanding:14, alert:2, limited:true, requires:{ minTurn:2 },
        risk:{ cond:{ any:[{minUnderstanding:30}] }, success:{ understanding:22, alert:-6, setState:'doyo' }, fail:{ understanding:6, alert:12 } },
        react:{ good:'門番は 鼻で 笑った。「……お前も、たいがいだな」 すこし、空気が ゆるんだ。', bad:'門番「だから 何だ」 興味なさそうに 言った。' } },
      { id:'g_shashin', text:'古い 写真を、そっと 見せる。', category:'sashidasu', role:'offer',
        cost:16, understanding:16, alert:4, limited:true, once:true, requires:{ minUnderstanding:40 },
        risk:{ cond:{ any:[{state:'doyo'},{state:'anshin'}] }, success:{ understanding:30, alert:-10, setState:'doyo' }, fail:{ understanding:8, alert:18 } },
        react:{ good:'門番は 写真を 見て、長い あいだ 何も 言わなかった。「……似てるな。おれの 待ってる やつに」', bad:'門番は 写真から 目を そらした。「……知らねえ」' } },

      /* ── 距離を取る ── */
      { id:'g_hiku', text:'一歩 下がって、門の外の 道を 一緒に 見る。', category:'kyori', role:'distance',
        cost:0, recover:12, understanding:3, alert:-10, gentle:true, requires:{ minTurn:2 },
        react:{ neutral:'門番は 何も 言わない。でも、隣に いることを 拒まなかった。' } },
      { id:'g_kyou', text:'「今日は、ここまでに しようか」', category:'kyori', role:'distance',
        cost:0, recover:14, understanding:1, alert:-12, gentle:true, requires:{ minTurn:4 },
        react:{ neutral:'門番は ちらりと L を 見た。「……また 来るのか」' } }
    ],
    winText:[
      '門番は ふっと 腕を ほどいた。',
      '門番「……ずっと、ここで 待ってる やつが いる。もう、来ないかも しれないのに」',
      '「ばかみたいだろ」 そう 言って、門番は はじめて 笑った。',
      '門は、まだ 開かない。でも、門番の 心は すこし 開いた。'
    ],
    warmWinText:[
      '門番は ふっと 腕を ほどいた。',
      '門番「……お前と 話してたら、待つのも わるく ないって 思えてきた」',
      '「なあ。お前の 名前、なんていうんだ？」',
      'L は うまく 答えられない。でも——ことばが ひとつ、世界に 増えた 気がした。'
    ],
    loseReject:[
      '門番「——もういい」',
      'それだけ 言って、門番は L に 背を 向けた。',
      '組まれた腕は、もう ほどけそうに なかった。'
    ],
    loseSurface:[
      '門番は 最後まで「帰れ」としか 言わなかった。',
      'すこしは 話せた。でも、門番が 誰を 待っているのかは、分からないままだった。'
    ],
    rewards:['kotoba_machigattara','kotoba_issho','kotoba_matsu']
  }
};

/* ═══════════════ 覚えられる ことば（報酬：spec 6 / 9）═══════════════
 * 勝利後の報酬選択UIに並べる（このモックでは“表示だけ”。次戦には引き継がない）。
 * 言葉は単なるスキルではなく、L が世界をどう見てきたかの記録でもある。
 */
var WORD_REWARDS = {
  kotoba_soba:      { id:'kotoba_soba',      name:'「そばに いる」', category:'uketomeru', desc:'何も できなくても、ここに いるよ、という言葉。' },
  kotoba_kiku:      { id:'kotoba_kiku',      name:'「きいても いい？」', category:'kiku', desc:'踏み込む前に、許しを もらう言葉。' },
  kotoba_matsu:     { id:'kotoba_matsu',     name:'「待ってる」', category:'kyori', desc:'急かさないと、約束する言葉。' },
  kotoba_machigattara:{ id:'kotoba_machigattara', name:'「間違ってたら ごめん」', category:'tsutaeru', desc:'断定を やわらげる、前置きの言葉。つよがりに よく効く。' },
  kotoba_issho:     { id:'kotoba_issho',     name:'「一緒に 待つ」', category:'uketomeru', desc:'相手の時間に、隣で つきあう言葉。' }
};

/* ═══════════════ 画面に出す世界観テキスト ═══════════════ */
var LORE = {
  labName:'バトルシステム試作場 / Battle Lab',
  mockTitle:'Battle 15：ことば選択型・理解バトル',
  mockTitleEn:'The Words We Choose',
  disclaimer:'これは完成版ではなく、バトルシステム検証用のモックです。',
  premise:'相手を倒すのではなく、理解し、警戒させすぎずに、心の距離を縮める。',
  playerName:'L',
  playerTag:'L — kotoba-android'
};

/* JXA / Node（ヘッドレス検証）からも参照できるよう公開（ブラウザでは無視される） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BALANCE: BALANCE, CATEGORIES: CATEGORIES, ENEMY_TYPES: ENEMY_TYPES,
    STATES: STATES, GAUGE_WORDS: GAUGE_WORDS, REACT: REACT,
    PANIC_CHOICES: PANIC_CHOICES, ENCOUNTERS: ENCOUNTERS,
    WORD_REWARDS: WORD_REWARDS, LORE: LORE
  };
}
