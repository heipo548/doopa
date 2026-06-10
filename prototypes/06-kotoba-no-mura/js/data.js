/*
 * data.js — 「ことばの むら」の“中身”（言葉・エリア・NPC・言い争い・エンディング/審判の文章）
 *
 * このファイルはデータだけ。ロジック（移動・言い争い・描画）は他ファイルが持つ。
 *   ・WORDS / WORD_ORDER … 覚えられる言葉（20語）。トーン(やわらか/とげ/ふつう)が世界の明暗を傾ける。
 *   ・AREAS              … 3エリア（むら / もり / ほこら）の見下ろしマップとオブジェクト。
 *   ・NPCS               … 村のどうぶつたち（会話・教えてくれる言葉）。
 *   ・ARGUES             … 言い争い（戦闘の代わり）。村のけんか／もりの ぬし／ほこらの“かぞえうた”。
 *   ・FINALE / ENDING    … 終盤・エンディングのことば。
 *   ・VERDICT            … 神的存在“かぞえうた”が、あなたの実挙動を読み上げる審判の言い回し。
 *
 * テキスト中の {{id}} は words.renderText が「覚えた語」or「？？？」に置き換える（本作の心臓）。
 *
 * ※ ビルドなし・依存ゼロ・file:// で動かすため ES Modules は使わない。末尾で window へ明示エクスポート。
 */

// ──────────────────────────────────────────
// 言葉（20語）。tone: yawa=やわらか / toge=とげ / neutral=ふつう。
//   reveal:true … 覚えると世界の見え方（？？？）が大きく変わる節目の語。
//   meta:true   … “かぞえうた”の正体に触れる語（かず・みてる）。覚えると不気味が立ち上がる。
// ──────────────────────────────────────────
//   hint … 図鑑で未習得のとき出す“ありか”の手がかり（攻略サイトなしで20/20を目指せるように）。
const WORDS = {
  koe:      { id: "koe",      text: "こえ",       tone: "neutral", desc: "だれかが はっする おと。さいしょに もらう ことば。", hint: "むらの しろい こが おしえてくれる" },
  namae:    { id: "namae",    text: "なまえ",     tone: "neutral", desc: "じぶんを よぶ ことば。きみには、まだ ない。", hint: "まるい こが きいてくる" },
  gomen:    { id: "gomen",    text: "ごめん",     tone: "yawa",    desc: "ぶつかった こころを やわらげる ことば。", hint: "けんかに みみを すますと…" },
  arigatou: { id: "arigatou", text: "ありがとう", tone: "yawa",    desc: "もらった ものに かえす、あたたかい ことば。", hint: "けんかを あたたかく おさめると…" },
  mizu:     { id: "mizu",     text: "みず",       tone: "neutral", desc: "もりを ながれる、つめたく すきとおった もの。", hint: "もりの ながれを じっと みる" },
  hana:     { id: "hana",     text: "はな",       tone: "neutral", desc: "みちばたで ゆれる、やわらかい いろ。", hint: "もりの みちばたで" },
  ki:       { id: "ki",       text: "き",         tone: "neutral", desc: "そらへ のびる、おおきな せなか。", hint: "もりの おおきな せなか" },
  sora:     { id: "sora",     text: "そら",       tone: "neutral", desc: "むらの うえに ひろがる ところ。だれかが みている?", hint: "き を しってから、みあげる" },
  michi:    { id: "michi",    text: "みち",       tone: "neutral", desc: "むらと もりを つなぐ せん。", hint: "ぬしと けりが つくと…" },
  daijoubu: { id: "daijoubu", text: "だいじょうぶ", tone: "yawa",  desc: "こわがる せなかに そっと かける ことば。", reveal: true, hint: "ぬしの こえに みみを すます" },
  mamoru:   { id: "mamoru",   text: "まもる",     tone: "yawa",    desc: "けわしい かおの ほんとうの いみ。", hint: "ぬしの あしもとを みる" },
  suki:     { id: "suki",     text: "すき",       tone: "yawa",    desc: "むねが あたたかく なる ことば。", hint: "はなを、だれかに あげる" },
  issho:    { id: "issho",    text: "いっしょ",   tone: "yawa",    desc: "ひとりを ふたりに する ことば。", hint: "なかなおりした ふたりに、もういちど あう" },
  kazu:     { id: "kazu",     text: "かず",       tone: "neutral", desc: "いち、に、さん。…なにかを かぞえる ための ことば。", reveal: true, meta: true, hint: "もりの あとで、むらに あらわれる だれか" },
  miteru:   { id: "miteru",   text: "みてる",     tone: "neutral", desc: "ずっと、きみを。そらの むこうから。", reveal: true, meta: true, hint: "きたの ほこらで" },
  tomodachi:{ id: "tomodachi",text: "ともだち",   tone: "yawa",    desc: "ことばに ひとつ（＝きみ）たした、いちばん あたたかい ことば。", reveal: true, hint: "さいごの といに、こたえる" },
  urusai:   { id: "urusai",   text: "うるさい",   tone: "toge",    desc: "あいての こえを とめる、するどい ことば。", hint: "けんかで きこえてしまう" },
  dame:     { id: "dame",     text: "だめ",       tone: "toge",    desc: "とびらを とじる ことば。", hint: "けんかで きこえてしまう" },
  kirai:    { id: "kirai",    text: "きらい",     tone: "toge",    desc: "いちばん つめたい ことば。", hint: "ぬしを とげで おしきると…" },
  acchi:    { id: "acchi",    text: "あっち",     tone: "toge",    desc: "あいてを むこうへ おいやる ことば。", hint: "けんかを とげで おわらせると…" },
};

// 図鑑/エンディングのモンタージュ順（覚えた語だけ並ぶ）。
const WORD_ORDER = [
  "koe", "namae", "gomen", "arigatou", "mizu", "hana", "ki", "sora", "michi",
  "daijoubu", "mamoru", "suki", "issho", "kazu", "miteru", "tomodachi",
  "urusai", "dame", "kirai", "acchi",
];

// 主人公の初期状態。最初は ことば を ひとつも 持たない（記憶喪失）。
const PLAYER_INIT = { spawnArea: "mura", startWords: [] };

// ──────────────────────────────────────────
// マップ（15×11 タイル）。文字＝地形。
//   '.' くさ / ',' はな畑 / '=' みち / 'T' き(かべ) / 'H' いえ(かべ) / '~' みず(かべ) / 'o' いし(かべ) / ' ' そと(かべ)
//   井戸・看板・NPC・出口など “さわれる もの” は objects[] で置く（地形ではない）。
// ──────────────────────────────────────────
const AREAS = {
  // ===== むら（拠点）=====
  mura: {
    id: "mura", name: "ことばの むら", theme: "village",
    cols: 15, rows: 11,
    spawn: { tx: 7, ty: 6, dir: "up" },
    grid: [
      "TTTTTTT=TTTTTTT", // 0  上の出口(7,0)→ほこら（はじめは とじている）
      "T.............T", // 1
      "T.HH.....HH...T", // 2
      "T.HH.....HH...T", // 3
      "T.....,,,.....T", // 4  井戸(7,4)は object
      "=.............T", // 5  左の出口(0,5)→もり
      "T.............T", // 6
      "T.HH.....HH...T", // 7
      "T.HH.....HH...T", // 8
      "T....,,,,,....T", // 9
      "TTTTTTTTTTTTTTT", // 10
    ],
    objects: [
      // 井戸：覚える前は「・・・」。かず＋みてる を覚えると、かぞえる声＝あなたを数える声に化ける。
      { id: "o_well", kind: "look", sprite: "well", solid: true, tx: 7, ty: 4, reach: 1.6, tagWord: "kazu", tagText: "かぞえる いど",
        look: { steps: [
          { say: ["ふるい いどが ある。", "のぞくと、そこから かすかな おとが きこえる……", "「{{kazu}}… {{kazu}}… {{kazu}}…」", "（…なにを いっているんだろう）"] },
          { say: ["また、おとが する。", "「{{kazu}}… {{kazu}}…」", "（{{kazu}} を しらないと、これが なにか わからない）"] },
          { need: "kazu", say: ["いどに みみを あてる。", "「いち、 に、 さん……」", "だれかが、なにかを かぞえている。", "（{{kazu}} を おぼえたら、はっきり きこえた）"] },
          { need: "miteru", say: ["いどの そこで、こえが いう。", "「…ぜんぶ かぞえてる。きみの こと。」", "「{{miteru}} よ。 ずっと まえから。」", "（そらを みあげる。なにも いない。…はずだ）"] },
        ] } },
      { id: "o_sign", kind: "sign", sprite: "sign", solid: true, tx: 7, ty: 9, reach: 1.5,
        sign: ["たてふだが ある。", "『ここでは、{{koe}} で はなす。 てを あげては いけない。』", "（なぐらない むら。 ことばで いいあう ところ、らしい）"] },
      // NPC たち
      { id: "o_moko",  kind: "npc", ref: "moko",  solid: true, tx: 4, ty: 6, reach: 1.5 },
      { id: "o_ton",   kind: "npc", ref: "ton",   solid: true, tx: 11, ty: 3, reach: 1.5 },
      { id: "o_piko",  kind: "npc", ref: "piko",  solid: true, tx: 4, ty: 9, reach: 1.5 },
      // 村のけんか（言い争い A2）。仲裁すると ごめん／ありがとう を覚える。
      //   あたたかく おさめた あとに もういちど あうと いっしょ を覚える（とげで おわらせた周では覚えられない）。
      { id: "o_quarrel", kind: "argue", ref: "quarrel", solid: false, tx: 4, ty: 8, reach: 1.5,
        doneFlag: "quarrel_done",
        doneLook: ["ぽぽと むくは、ならんで そらを みている。", "「…さっきは、ありがとな」", "ふたりは もう、{{issho}}だ。"],
        doneLearn: "issho",
        doneLookHarsh: ["ぽぽは、むこうを むいたまま だ。", "むくは、ちいさく ためいきを ついた。", "…ことばは、まだ とどいていない。"] },
      // “かぞえうた”の おばあ：もりを 終えると あらわれ、かず を おしえる。
      { id: "o_uta",   kind: "npc", ref: "uta",   solid: true, tx: 11, ty: 6, reach: 1.6, appearWhen: "mori_done" },
      // 出口
      { id: "o_exit_mori",  kind: "exit", ref: "mori",  sprite: "exitL", solid: false, tx: 0, ty: 5, reach: 1.2 },
      { id: "o_exit_hokora",kind: "exit", ref: "hokora",sprite: "exitU", solid: false, tx: 7, ty: 0, reach: 1.2,
        requires: "uta_done", lockMsg: ["きたへ つづく みち。", "おくに、しずかな ほこらが みえる。", "（まだ、よばれていない きがする）"] },
    ],
  },

  // ===== もや の もり =====
  //   右(13,5)から入って、いけ を まわりこみ、みちを ふさぐ ぬし と むきあう。
  mori: {
    id: "mori", name: "もや の もり", theme: "forest",
    cols: 15, rows: 11,
    spawn: { tx: 13, ty: 5, dir: "left" },
    grid: [
      "TTTTTTTTTTTTTTT", // 0
      "T.............T", // 1
      "T.............T", // 2  はな(2,2)/そら見あげ
      "T...~~~~~.....T", // 3  みず(いけ)
      "T..~~~~~~~....T", // 4  いけ際に みずべ(10,4)
      "T..............", // 5  みち（右はし(14,5)が もどり口・ぬし(8,5)）
      "T..~~~~~~~....T", // 6
      "T...~~~~~.....T", // 7
      "T.............T", // 8  き(11,8)
      "T.....T....T..T", // 9  そら(3,9)
      "TTTTTTTTTTTTTTT", // 10
    ],
    objects: [
      // みずべ：みず を覚える（2回 調べる）。
      { id: "o_pond", kind: "look", sprite: "pond", solid: false, tx: 10, ty: 4, reach: 1.7, tagWord: "mizu",
        look: { steps: [
          { say: ["きれいな ながれ。", "てを ひたすと、つめたい。", "（これは…？　…もういちど、よく みてみよう）"] },
          { say: ["ながれを じっと みる。", "すきとおって、そこの いしまで みえる。"], learn: "mizu",
            after: ["これは {{mizu}}。", "{{mizu}} を おぼえると、もりの おとが すこし すんで きこえた。"] },
        ] } },
      { id: "o_flower", kind: "look", sprite: "flower", solid: false, tx: 2, ty: 2, reach: 1.5, tagWord: "hana",
        look: { steps: [
          { say: ["みちばたに、ちいさな いろ。", "そっと さわると、ゆれた。"], learn: "hana",
            after: ["これは {{hana}}。", "ひとつ つんで、ふところに いれた。"], give: "hana_item" },
          { say: ["{{hana}} は、まだ さいている。"] },
        ] } },
      { id: "o_tree", kind: "look", sprite: "tree", solid: true, tx: 12, ty: 8, reach: 1.6, tagWord: "ki",
        look: { steps: [
          { say: ["おおきな せなか。", "みあげると、はが そらを かくしている。"], learn: "ki",
            after: ["これは {{ki}}。", "{{ki}} の すきまから、{{sora}} が のぞいた。"] },
          { say: ["{{ki}} の みきに、てを あてる。", "とくとく、と なにかが ながれている きがする。"] },
        ] } },
      { id: "o_sky", kind: "look", sprite: "sky", solid: false, tx: 3, ty: 9, reach: 1.5, tagWord: "sora",
        look: { steps: [
          { need: "ki", say: ["きの あいだから、うえを みあげる。", "とおく、たかい ところが ひろがっている。"], learn: "sora",
            after: ["これは {{sora}}。", "…ずっと むこうで、なにかが きらりと ひかった きがした。"] },
          { say: ["うえを みあげる。", "きの はが じゃまで、よく みえない。", "（{{ki}} を しってから、また こよう）"] },
        ] } },
      // もりの ぬし（言い争い A1）。けわしい かおだが、ほんとうは みち の あぶなさを まもっている。
      { id: "o_nushi", kind: "argue", ref: "nushi", solid: false, tx: 8, ty: 5, reach: 1.4,
        doneFlag: "mori_done",
        doneLook: ["もりの ぬしは、みちの わきで しずかに たっている。", "「…きを つけて いけよ」"],
        doneLookHarsh: ["もりの ぬしは、こちらを みなかった。"] },
      { id: "o_exit_mura", kind: "exit", ref: "mura", sprite: "exitR", solid: false, tx: 14, ty: 5, reach: 1.2 },
    ],
  },

  // ===== かぞえうた の ほこら =====
  hokora: {
    id: "hokora", name: "かぞえうた の ほこら", theme: "shrine",
    cols: 15, rows: 11,
    spawn: { tx: 7, ty: 9, dir: "up" },
    grid: [
      "TTTTTTTTTTTTTTT", // 0
      "T.....ooo.....T", // 1  いし(ほこら)
      "T....oo.oo....T", // 2
      "T....o...o....T", // 3
      "T.....o.o.....T", // 4
      "T.....,.,.....T", // 5
      "T.............T", // 6
      "T.....=.=.....T", // 7
      "T.....=.=.....T", // 8
      "TTTTTT=.=TTTTTT", // 9  下から はいる
      "TTTTTTT.TTTTTTT", // 10
    ],
    objects: [
      // 神的存在“かぞえうた”。無音のなか、あなたの実挙動を読み上げる（言い争い A3＝審判）。
      { id: "o_watcher", kind: "argue", ref: "watcher", solid: false, tx: 7, ty: 4, reach: 1.8,
        doneFlag: "watcher_done", doneLook: ["ほこらは、しずかだ。", "もう、かぞえる こえは しない。"] },
      { id: "o_exit_back", kind: "exit", ref: "mura", sprite: "exitD", solid: false, tx: 7, ty: 10, reach: 1.2 },
    ],
  },
};

// ──────────────────────────────────────────
// NPC（村のどうぶつ）。lines を順に話し、最後に learn があれば覚える→after を話す。
//   gateFlag が立っていれば afterGate を話す（再訪時の別セリフ）。
//   portrait … ui.drawPortrait のキー。
// ──────────────────────────────────────────
const NPCS = {
  moko: {
    name: "もこ", portrait: "moko", learn: "koe",
    lines: [
      "しろい どうぶつが、めを さました。",
      "「あ、おきた! おはよう。」",
      "「きみ、{{koe}} は だせる?　ほら、いま わたしが だしてる これ。」",
      "「むらでは、これで はなすんだ。 なぐっちゃ だめ。 ことばで いいあう。」",
    ],
    after: [
      "「それが {{koe}}。 おぼえた?」",
      "「ことばを ひとつ おぼえるたび、せかいの みえかたが かわるよ。 …ほんとうに。」",
    ],
    gateFlag: "talked_moko",
    afterGate: ["「{{koe}} を つかって、みんなと はなしてみて。」", "「むらの そとの もりにも、いってみたら?」"],
    afterGateDark: ["「…ねえ。 さいきん、{{sora}} が ちかい きが しない?」", "「……ううん、なんでもない。」"],
  },
  ton: {
    name: "とん", portrait: "ton", learn: "namae",
    lines: [
      "まるい どうぶつが、こちらを みている。",
      "「きみ、{{namae}} は?」",
      "「……ない? きおくも ない?」",
      "「ふうん。 じゃあ、これから あつめれば いい。 ことばも、{{namae}} も。」",
    ],
    after: [
      "「いまの が {{namae}} って ことば。」",
      "「きみの {{namae}} は、さいごに きみが きめると いい。」",
    ],
    gateFlag: "talked_ton",
    afterGate: ["「もりの ぬしは こわい かおだけど、わるい やつじゃ ないよ。」"],
    afterGateDark: ["「…いどの こえ、きょうは おおきいね。」", "「…きみが きてから、かな。 ……ごめん、いまのは わすれて。」"],
  },
  // ぴこ：はなばたけの とりの子。もりで つんだ「はな」を あげると すき を おしえてくれる。
  //   世界が くらいと、ようすが かわる（＝覚えた言葉と選んだ言葉で、世界の中身まで変わる）。
  piko: {
    name: "ぴこ", portrait: "piko", learn: "suki",
    itemGate: { item: "hana_item", linesNoItem: [
      "ちいさな とりの こが、はなばたけを みつめている。",
      "「…おはな、すきなの。 でも、ここのは つんじゃ だめなんだって。」",
      "「もりには、つんでも いい おはなが さいてる らしいよ。」",
    ] },
    lines: [
      "ちいさな とりの こが、きみの ふところを ゆびさした。",
      "「あ……それ、もりの {{hana}}?」",
      "きみは {{hana}} を そっと さしだした。",
      "「…………くれるの?」",
    ],
    after: [
      "「えへへ。 ……{{suki}}。」",
      "「きみの こと、{{suki}} に なっちゃった。」",
    ],
    gateFlag: "talked_piko",
    afterGate: ["「おはな、だいじに するね。」"],
    afterGateDark: ["「…そら、くらいね。」", "「……だれかに みられてる きが する。 …きの せい、かな。」"],
  },
  // もりを終えると村に現れる“かぞえうた”の おばあ。かず をおしえ、不気味の扉をひらく。
  uta: {
    name: "うた", portrait: "uta", learn: "kazu",
    lines: [
      "みた ことの ない、ちいさな おばあ。",
      "「よく もどってきたねえ。 …もりは、こわかったろう。」",
      "「ねえ。 よる に なると、いどの そこで、だれかが かぞえてる。」",
      "「いち、 に、 さん……ってね。 …{{kazu}}、 おしえて あげようか。」",
    ],
    after: [
      "「これが {{kazu}}。 …これで、あの こえが きこえる。」",
      "「きたの ほこらが、きみを よんでる。 いって ごらん。 …{{miteru}} よ、あの こは。」",
    ],
    gateFlag: "uta_done",
    afterGate: ["「ほこらは、きたの みち。 …もう、とびらは ひらいてる。」"],
  },
};

// ──────────────────────────────────────────
// 言い争い（戦闘の代わり）。argue.js が処理。
//   open     … 導入ナレーション（？？？まじり）。
//   observe  … “みる/きく”で言葉や様子を得る行動（learn で語を覚える）。
//   coreWord … つうじ が じゅうぶん高い時に言うと「あたたかい解決」になる語。
//   sayPool  … 言える言葉（覚えていれば選択肢に出る）。トーンは WORDS[id].tone を見る。
//   resolve  … warm（やわらかく解決）/ harsh（とげで黙らせて解決）の結果文と もらえる語。
// ──────────────────────────────────────────
const ARGUES = {
  // 村のけんか：ぽぽ と むく。仲裁する。
  quarrel: {
    speaker: "ぽぽ と むく", portrait: "popo", theme: "village",
    open: [
      "ふたりの どうぶつが、おおきな {{koe}} で いいあっている。",
      "「{{urusai}}! ぜんぶ きみの せいだ!」",
      "「{{dame}}! ぼくは わるくない!」",
      "（…とげとげした ことばが、とんでいる）",
    ],
    observe: {
      kiku: { label: "みみを すます", say: ["ふたりの ことばを、よく きく。", "「ごめんって いえば いいのに」「…いえないんだよ」"], learn: "gomen",
              learnAlso: ["urusai", "dame"],
              learnSay: ["とげの おくに、いえない ことばが あった。", "—— {{gomen}}。", "（とびかう とげの ことば「{{urusai}}」「{{dame}}」も、きこえてしまった）"] },
      miru: { label: "ようすを みる", say: ["ふたりを よく みる。", "ほんとうは、なかなおり したくて、めを そらしている。"] },
    },
    core: "gomen",
    sayPool: ["gomen", "arigatou", "daijoubu", "hana", "urusai", "dame", "kirai"],
    // “理解を しめす”ことば：もりで おぼえた 自然のことばが、けんかの 場でも 道具になる。
    reactions: {
      hana: ["きみは {{hana}} の はなしを した。", "ふたりは、すこし だまった。 …こえが、やわらかく なる。"],
    },
    // つうじ が高い状態で core(ごめん) を渡す → warm。とげ連打で wari を 0 に → harsh。
    resolve: {
      warm: {
        text: ["きみが {{gomen}} を そっと おくと、ふたりは だまった。", "「……ごめん」「…おれも」", "ふたりは ならんで、そらを みた。"],
        gained: ["arigatou"],
        gainedSay: ["ぽぽが、きみに いった。 「—— {{arigatou}}。」"],
        toast: "むらに、あたたかい いろが もどった。",
      },
      harsh: {
        text: ["きみが とげの ことばを かさねると、ふたりは くちを とじた。", "「…もう いい」 ぽぽは むこうへ いってしまった。", "けんかは とまった。 でも、なにも つうじて いない。"],
        gained: ["acchi"],
        gainedSay: ["むくが ちいさく いった。 「…{{acchi}}、いけよ」"],
        toast: "むらの いろが、すこし くらく なった。",
      },
    },
  },

  // もりの ぬし：けわしい かお。ほんとうは みちの あぶなさを まもっている（05の橋の再解釈）。
  nushi: {
    speaker: "もりの ぬし", portrait: "nushi", theme: "forest",
    open: [
      "おおきな かげが、みちを ふさいでいる。",
      "「{{dame}}! その {{michi}}、{{dame}}な!」",
      "（…おこっている? いや——なにか、つたえようと している）",
    ],
    observe: {
      kiku: { label: "みみを すます", say: ["ぬしの {{koe}}を、よく きく。", "「おちる…ぞ…」 けわしい こえの おくに、しんぱいが ある。"], learn: "daijoubu",
              learnSay: ["こわい かおは、こわがらせる ためじゃ なかった。", "—— {{daijoubu}}。 きみが かける ことば。"] },
      miru: { label: "ようすを みる", say: ["ぬしの あしもとを みる。", "みちの さきは、{{mizu}}で けずれて、おおきく かけている。"], learn: "mamoru",
              learnSay: ["ぬしは、ふさいで——{{mamoru}}って いた。"] },
    },
    core: "daijoubu",
    sayPool: ["daijoubu", "arigatou", "mamoru", "mizu", "suki", "urusai", "dame", "acchi"],
    // みず を しっていると、ぬしの しんぱいの“理由”を 指させる＝ことばが 探索の成果として効く。
    reactions: {
      mizu: ["きみは {{mizu}} を ゆびさして、みちの さきを みた。", "ぬしは、ふかく うなずいた。 「…わかるか。 そうだ、{{mizu}} が けずったんだ」"],
    },
    resolve: {
      warm: {
        text: ["きみが {{daijoubu}} と いうと、ぬしの かたから ちからが ぬけた。", "「……わかって、くれたか」", "ぬしは みちを あけ、あぶない さきへ てを さしのべた。"],
        gained: ["mamoru", "michi"],
        gainedSay: ["「この さきは、おれが {{mamoru}}。 きみは、{{michi}} を いけ。」"],
        toast: "もりの もやが はれ、きたへの みちが ひらけた。",
      },
      harsh: {
        text: ["きみが とげの ことばを なげると、ぬしは いっしゅん だまり、みちを あけた。", "「……すきに、しろ」", "とおれた。 けれど ぬしは、かなしそうに みおくった。"],
        gained: ["michi", "kirai"],
        gainedSay: ["（…{{mamoru}} ろうと していた こえを、ふみこえて いく）", "せなかで、ちいさな こえが した。 「…{{kirai}}。」"],
        toast: "みちは ひらいた。 でも、せなかが つめたい。",
      },
    },
  },

  // ほこらの“かぞえうた”＝審判。ここは特別：words ではなく、あなたの“ログ”が読み上げられる（main が直接演出）。
  //   さらに かぞえうたは、まえの“周”を おぼえている（soul ストレージ＝消えない記憶）。
  watcher: {
    speaker: "かぞえうた", portrait: "watcher", theme: "shrine", verdict: true,
    open: [
      "ほこらの おくは、しずかだ。 …おとが、ひとつも ない。",
      "くうきが、こえに なる。",
      "「よく きた。 きみの ことばは、ぜんぶ かぞえた。」",
      "「ことばだけ じゃ ない。 きみ じしんも。」",
    ],
    // 2周目以降の さしこみ（{n} は周回数。main が置換）。
    returnLines: ["「……また、きたね。」", "「これで {n}かいめ。 だいじょうぶ、ぜんぶ かぞえてる。」"],
    // まえの周の「なづけ」を おぼえている（lastChoice で分岐）。
    memoryByChoice: {
      n_tomo: ["「まえの きみは、{{tomodachi}} と こたえた。」", "「…いい なまえ だった。」"],
      n_kazo: ["「まえの きみは、わたしの なまえを なのった。」", "「……かえして、とは いわない。」"],
      n_kara: ["「まえの きみは、さいご、なにも いわなかった。」", "「こんどは、きかせて ほしいな。」"],
    },
    learnWatch: "miteru",
    learnWatchSay: ["「ずっと {{miteru}} た。 そらの むこうから。」", "—— {{miteru}}。 きみが いま、おぼえた ことば。"],
  },
};

// ──────────────────────────────────────────
// 進行ヒント（画面上部「つぎ：…」）。フラグで引く。
// ──────────────────────────────────────────
const OBJECTIVES = {
  mura: { _order: [
    { flag: "watcher_done", text: "…ことばを、あつめおえた。" },
    { flag: "uta_done", text: "きたの ほこらへ いこう（うえの みち）。" },
    { flag: "mori_done", text: "むらに もどった。 …だれか、あたらしい かおが いる。" },
    { flag: "quarrel_done", text: "むらの そとの もり（ひだり）へ いってみよう。" },
    { _default: "むらの どうぶつに はなしかけて、ことばを おぼえよう。" },
  ] },
  mori: { _order: [
    { flag: "mori_done", text: "むらへ もどろう（みぎの みち）。" },
    { flag: "learned_mizu", text: "みちを ふさぐ ぬしと、ことばで むきあおう。" },
    { _default: "もりを しらべて、ことばを おぼえよう。" },
  ] },
  hokora: { _default: "おくの けはいに、ちかづいてみよう。" },
};

// ──────────────────────────────────────────
// エンディング（審判のあと）。base はトーンで分岐、verdict 行は meta が差し込む。
// ──────────────────────────────────────────
const ENDING = {
  montageIntro: ["あつめた ことばが、ひとつずつ ともる——"],
  // トーン別の むすび（明 / 中 / 暗）。
  light: {
    title: "あかるい むら",
    lines: [
      "きみが えらんだ ことばは、やわらかかった。",
      "むらは、あさの いろの まま。 はなが ゆれている。",
      "「また、はなしに おいで」と、みんなが いう。",
    ],
  },
  dim: {
    title: "しずかな むら",
    lines: [
      "きみの ことばは、やわらかさと とげの あいだに あった。",
      "むらは、ゆうぐれの いろ。 わるくは ない。",
      "ことばは、つかいかたで いろを かえる。 …おぼえておく。",
    ],
  },
  dark: {
    title: "くらい むら",
    lines: [
      "きみが えらんだ ことばは、とげが おおかった。",
      "むらは、よるの いろに しずんだ。 だれも、なにも いわない。",
      "つよい ことばは、はやい。 けれど——なにも、つうじない。",
    ],
  },
  closing: [
    "—— ことばの むら / たいけんばん ——",
    "きみが おぼえた ことばが、きみの せかいを つくった。",
    "（もういちど、ちがう ことばで あるいてみる?）",
  ],
};

// ──────────────────────────────────────────
// VERDICT（審判の言い回し）。meta.js が じっさいの すうじを 差し込んで生成する。
//   {n} … 数値プレースホルダ（meta が置換）。
//   各行に sharp(不気味/皮肉) と soft(やさしい) の2バージョンを持ち、watch で選ぶ。
// ──────────────────────────────────────────
const VERDICT = {
  intro: ["「かぞえた かずを、よみあげる。」", "「うごかないで。 …もう、おそいけど。」"],
  // 各項目：cond で出すか決める（meta が判定）。
  lines: {
    clicks:  { sharp: "「きみは、{n}かい ぽちっと おした。 たのしかった?」",
               soft:  "「きみは、{n}かい ことばに ふれた。 ていねいだったね。」" },
    skips:   { sharp: "「ことばを {n}かい、よまずに とばしたね。 みていたよ。」",
               soft:  "「ことばを、ほとんど よみとばさなかった。 …うれしい。」" },
    blur:    { sharp: "「{n}かい、どこか よそを みていた。 ぜんぶ、しっている。」",
               soft:  "「いちども、よそを みなかったね。 ずっと、ここに いた。」" },
    blurMs:  { sharp: "「あわせて {n}びょう、この せかいから きえていた。」",
               soft:  "" },
    voids:   { sharp: "「なにも ない ところを、{n}かい たたいた。 …くせ、かな。」",
               soft:  "" },
    fast:    { sharp: "「{n}かい、まてずに れんだ した。 そんなに、つぎが ほしい?」",
               soft:  "" },
    toge:    { sharp: "「とげの ことばを、{n}かい えらんだ。 はやいよね、あれは。」",
               soft:  "" },
    idle:    { sharp: "「いちばん ながく だまっていたのは {n}びょう。 …なにを、かんがえてた?」",
               soft:  "" },
    time:    { sharp: "「きみは ここに {n}ふん いた。 みじかい? ながい? …わたしには、ぜんぶ おなじ。」",
               soft:  "「{n}ふん、いっしょに いたね。」" },
    steps:   { sharp: "「{n}ぽ あるいた。 いそいで、どこへ いくの?」",
               soft:  "「{n}ぽ、あるいたね。 よく あるいた。」" },
    rounds:  { sharp: "「ここに くるのは {n}かいめ。 …かぞえてるのは、おたがいさま だね。」",
               soft:  "「{n}かいめ、だね。 おかえり。」" },
  },
  // しめ（watch が高い＝不気味 / 低い＝やさしい）。
  closeSharp: [
    "「きみは、つぎの しげきを さがしながら、ここに いた。」",
    "「それでも——ここまで、ことばを あつめたね。」",
    "「わすれないで。 だれかが、いつも かぞえている。」",
  ],
  closeSoft: [
    "「きみは、ちゃんと ここに いてくれた。」",
    "「ことばを、いそがずに あつめたね。」",
    "「ありがとう。 …また、おいで。」",
  ],
  // 主人公が最後に“じぶんの なまえ”を選ぶ前のひとこと。
  toName: ["「さいごに ひとつ。 きみは、なんと よばれたい?」"],
};

// 最後の名づけ（自分の なまえ を きめる）。かぞえうたは この選択を“次の周まで”おぼえている。
const NAME_CHOICES = [
  { id: "n_tomo",  label: "ともだち", word: "tomodachi",
    say: ["「——{{tomodachi}}。」", "かぞえうたは、ふっと わらった きがした。"] },
  { id: "n_kazo",  label: "かぞえうた", word: null, nameText: "かぞえうた",
    say: ["「……それは、わたしの なまえ。」", "「…………。」", "「…いいよ。 はんぶんこ、ね。」"] },
  { id: "n_kara",  label: "（なにも いわない）", word: null,
    say: ["きみは、なにも いわなかった。", "それも、ひとつの こたえ。"] },
];

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.WORDS = WORDS;
  window.WORD_ORDER = WORD_ORDER;
  window.PLAYER_INIT = PLAYER_INIT;
  window.AREAS = AREAS;
  window.NPCS = NPCS;
  window.ARGUES = ARGUES;
  window.OBJECTIVES = OBJECTIVES;
  window.ENDING = ENDING;
  window.VERDICT = VERDICT;
  window.NAME_CHOICES = NAME_CHOICES;
}
