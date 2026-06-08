/*
 * data.js — 「名前を知らない世界」の全コンテンツ（言葉・マップ・NPC・遭遇・文章）
 *
 * このゲームの“成長”は、敵を倒すことではなく「言葉を覚えて世界の意味が増える」こと。
 * だからコンテンツの中心は WORDS（覚えられる言葉）と、その言葉が埋め込まれた文章（テンプレ）。
 *
 * 文章の書き方 — 覚える対象の語は `{wordId}` で埋め込む（例: "その {hashi} は あぶない"）。
 *   ・未習得  → 画面では「？？？」(にじんだチップ)で表示
 *   ・断片習得 → words.frag（例「ま…て…」）で表示
 *   ・習得済み → words.disp（例「橋」）で表示
 *   words.js の renderText() が、現在の習得状況を見て毎回 描き換える。
 *   ＝ 新しい言葉を覚えると、過去に見た文も遡って読めるようになる（本作いちばんの快感）。
 *
 * ※ ビルドなし・依存ゼロ・file:// で動かすため ES Modules は使わない。
 *   通常の <script>（data→audio→words→state→save→field→encounter→ui→main）で読み、
 *   末尾で window へ明示エクスポートする。
 */

// ──────────────────────────────────────────
// WORDS — 覚えられる言葉（合計15語＋補助2語）
//   kind  : 名詞/動詞/感情/関係 等（覚えた言葉一覧での分類表示に使う）
//   disp  : 習得後に表示される語
//   frag  : 「耳をすます」等で得る“断片”（任意。無ければ ？？？→disp の2段階）
//   learn : 習得ポップアップ文（無ければ "「◯◯」を おぼえた" を自動生成）
// ──────────────────────────────────────────
const WORDS = {
  mizu:      { disp: "水",     kind: "名詞" },
  hana:      { disp: "花",     kind: "名詞" },
  hito:      { disp: "人",     kind: "名詞" },
  mura:      { disp: "村",     kind: "名詞" },
  hashi:     { disp: "橋",     kind: "名詞" },
  matte:     { disp: "待って", kind: "呼びかけ", frag: "ま…て…" },
  abunai:    { disp: "危ない", kind: "状態",     frag: "あ…ぶ…" },
  wataru:    { disp: "渡る",   kind: "動詞" },
  kodomo:    { disp: "子ども", kind: "名詞" },
  naku:      { disp: "泣く",   kind: "動詞" },
  kowai:     { disp: "こわい", kind: "感情",     frag: "こ…わ…" },
  sagasu:    { disp: "探す",   kind: "動詞" },
  okaasan:   { disp: "お母さん", kind: "関係",   frag: "お…か…" },
  issho:     { disp: "一緒",   kind: "関係" },
  arigatou:  { disp: "ありがとう", kind: "挨拶" },
  tomodachi: { disp: "友達",   kind: "関係" }, // ← 体験版の到達点
};

// 言葉を覚える正規の順番（覚えた言葉一覧の“例”表示や進行ヒントの基準）。
const WORD_ORDER = [
  "mizu", "hana", "hito", "mura", "hashi", "matte", "abunai", "wataru",
  "kodomo", "naku", "kowai", "sagasu", "okaasan", "issho", "arigatou", "tomodachi",
];

// ──────────────────────────────────────────
// プレイヤー初期状態 — 何も言葉を知らないところから始まる。
// ──────────────────────────────────────────
const PLAYER_INIT = {
  startWords: [],          // 最初はゼロ語（世界がほとんど ？？？）
  spawnArea: "mori",
};

// ──────────────────────────────────────────
// タイトル／プロローグ
// ──────────────────────────────────────────
const TITLE = {
  name: "名前を知らない世界",
  sub: "体験版",
  tagline: "ことばを 覚えるたびに、せかいに 意味が 増えていく。",
  prologue: [
    "ここが どこなのか、わからない。",
    "じぶんが だれなのかも、わからない。",
    "まわりには ？？？ ばかり。",
    "でも——なにかが、はじまろうとしている。",
  ],
};

// ──────────────────────────────────────────
// マップ（エリア）
//   grid : タイル地形のみ（'.'草 / 'T'木 / '='道 / ' 'は外＝壁）。
//          見た目の水辺・花・家などの“調べられるもの”は objects 側に置く（地形と分離）。
//   spawn: 入場時のプレイヤー位置（タイル座標）と向き。
//   objects: 調べられる/触れられる対象。
//     kind  : 'look'(調べる) / 'encounter'(遭遇) / 'npc'(会話) / 'exit'(エリア移動) / 'sign'(立て札)
//     art   : canvas で描く見た目（pond/flower/rock/tree/signpost/gate/villager/child/mother/oldman/dog/well/bridge）
//     label : 頭上に出す“名札”の語id（未習得＝？？？／習得後＝語）。null なら名札なし。
//     solid : true ならそのタイルは通れない（隣から調べる）。
//     reach : 反応する距離（タイル単位・既定1.2）。
//     look  : 調べたときの段階文（steps）。各 step に say(文配列)・learn(覚える語)・frag(断片) 等。
//     ref   : encounter/npc のid、exit の行き先エリアid。
//     appearWhen/hideWhen : フラグで出現/退場（村の段階変化に使う）。
//     requires : exit のロック解除フラグ（未達なら lockMsg を出して通さない）。
// ──────────────────────────────────────────
const AREAS = {

  // ===== エリア1：目覚めの森 =====
  mori: {
    id: "mori",
    name: "目覚めの森",
    theme: "forest",
    hint: "あたりを 歩いて、気になるものを しらべてみよう（クリック / 矢印キー）。",
    cols: 15, rows: 11,
    spawn: { tx: 7, ty: 5, dir: "down" },
    grid: [
      "TTTTTTTTTTTTTTT",
      "T.............T",
      "T.....T....T..T",
      "T..........T..T",
      "T....T........T",
      "T.............T",
      "T......T......T",
      "T.............T",
      "T.....T.......T",
      "T.....==......T",
      "TTTTTT==TTTTTTT",
    ],
    objects: [
      // 水辺（左上の池）— 2回調べると「水」を覚える。
      { id: "o_pond", kind: "look", art: "pond", tx: 3, ty: 3, solid: true, label: "mizu",
        look: { steps: [
          { say: ["？？？ が ながれている。", "つめたい。"] },
          { say: ["？？？ を 手で すくった。", "のどが すこし 楽になった。"], learn: "mizu",
            after: ["{mizu} が ながれている。"] },
          { say: ["{mizu} は しずかに ながれていく。"] },
        ] } },

      // 花 — 水を覚えたあと調べると「花」を覚える。
      { id: "o_flower", kind: "look", art: "flower", tx: 10, ty: 7, solid: false, label: "hana",
        look: { steps: [
          { say: ["小さな ？？？ が 咲いている。"] },
          { say: ["小さな ？？？ が 咲いている。", "{mizu} を あげると、少し ゆれた。"],
            need: "mizu", learn: "hana", after: ["小さな {hana} が 咲いている。"] },
          { say: ["{hana} は きみのほうへ 顔を むけている。", "……持っていけそうだ。"], need: "hana",
            give: "hana_item" }, // 花を1本持つ（子どもの遭遇で使える）
        ] } },

      // 石 — 言葉は覚えない“余白”。観察の手触りを足すフレーバー。
      { id: "o_rock", kind: "look", art: "rock", tx: 5, ty: 8, solid: true, label: null,
        look: { steps: [
          { say: ["ごつごつした ？？？ がある。", "名前は まだ わからない。"] },
          { say: ["ただ、しずかに そこにある。"] },
        ] } },

      // 木立 — フレーバー＋森から先へ進む示唆。
      { id: "o_tree", kind: "look", art: "tree", tx: 11, ty: 2, solid: true, label: null,
        look: { steps: [
          { say: ["大きな ？？？ が 風に ゆれている。"] },
          { say: ["葉の すきまから、道が つづいているのが 見える。", "下の ほうへ——。"] },
        ] } },

      // 出口（森の南）→ 壊れた橋へ。水を覚えるまでは そっと引きとめる（チュートリアル成立のため）。
      { id: "o_exit_mori", kind: "exit", art: "gate", tx: 6, ty: 10, solid: false, label: null,
        ref: "hashi", requires: "learned_mizu",
        lockMsg: ["まだ、この森の ことばを 知らない。", "（水辺を しらべてみよう）"],
        sign: ["細い道が、下のほうへ つづいている。"] },
    ],
  },

  // ===== エリア2：壊れた橋 =====
  //   川(~)が手前の岸(rows1-4)と向こう岸(rows7-9)を分ける。プレイヤーは手前岸だけを歩く。
  //   壊れた橋(B)に近づくと遭遇が始まる。向こう岸の村人は“絵”として見える（直接は届かない＝だから言葉で）。
  hashi: {
    id: "hashi",
    name: "壊れた橋",
    theme: "bridge",
    hint: "川の むこうで、だれかが 何かを 叫んでいる。橋に 近づいてみよう。",
    cols: 15, rows: 11,
    spawn: { tx: 1, ty: 2, dir: "right" },
    grid: [
      "TTTTTTTTTTTTTTT",
      "=.............T",  // 西の入口（手前岸）
      "T.............T",
      "T.............=",  // 東の出口（手前岸・村へ。bridge_done で開く）
      "T......B......T",  // 壊れた橋・手前の板（B＝歩ける／遭遇の起点）
      "~~~~~~~~~~~~~~~",  // 川（solid）
      "~~~~~~~~~~~~~~~",  // 川（solid）
      "T......B......T",  // 壊れた橋・向こうの板（風景）
      "T.............T",
      "T.............T",
      "TTTTTTTTTTTTTTT",
    ],
    objects: [
      // 壊れた橋＝遭遇の起点。近づくと（auto）村人との遭遇が始まる。bridge_done 後は ただの風景。
      { id: "o_bridge", kind: "encounter", art: "bridge", tx: 7, ty: 4, solid: false,
        label: "hashi", ref: "bridge", auto: true, doneFlag: "bridge_done",
        doneLook: ["もう、この {hashi} は 渡らない。", "向こうの道を、ゆっくり 行こう。"] },

      // 向こう岸の村人（風景）。遭遇前から“だれかが手をふっている”気配を見せる。
      { id: "o_villager", kind: "scenic", art: "villager", tx: 8, ty: 8, solid: true, label: "hito" },

      // 出口（手前岸の東）→ 村へ。遭遇を“解いて”からでないと進めない。
      { id: "o_exit_hashi", kind: "exit", art: "gate", tx: 14, ty: 3, solid: false, label: null,
        ref: "mura", requires: "bridge_done",
        lockMsg: ["向こうの ？？？ が、何かを 伝えようとしている。", "（先に はなしを つけよう）"],
        sign: ["道は、橋を 渡らず 岸づたいに つづいている。"] },
    ],
  },

  // ===== エリア3：小さな村 =====
  mura: {
    id: "mura",
    name: "小さな村",
    theme: "village",
    hint: "ことばを 覚えたぶんだけ、村が 少し 読めるようになっている。",
    cols: 17, rows: 12,
    spawn: { tx: 1, ty: 6, dir: "right" },
    grid: [
      "TTTTTTTTTTTTTTTTT",
      "T...............T",
      "T...............T",
      "T...............T",
      "T...............T",
      "=...............T",
      "=...............T",
      "T...............T",
      "T...............T",
      "T...............T",
      "T...............T",
      "TTTTTTTTTTTTTTTTT",
    ],
    objects: [
      // 家ならび（solid）。「人」を覚えていれば、調べた時に「村」を覚える（人の くらす 場所＝村）。
      { id: "o_house1", kind: "look", art: "house", tx: 3, ty: 2, solid: true, label: "mura",
        look: { steps: [
          // need:hito 未達のうちは この段で足踏み（？？？のまま）。人を覚えてから調べると 村 を習得。
          { say: ["？？？ が いくつも ならんでいる。", "{hito} の くらす ところ だろうか。"],
            need: "hito", learn: "mura",
            after: ["{mura} に 家が ならび、けむりが のぼっている。", "ここは——{mura}。"] },
          { say: ["{mura}。しずかな 家々。窓に あかりが ともっている。"], need: "hito" },
        ] } },
      { id: "o_house2", kind: "look", art: "house", tx: 12, ty: 2, solid: true, label: null,
        look: { steps: [
          { say: ["しずかな 家。窓に あかりが ともっている。"] },
        ] } },

      // 花を持つ老人 — 「人」を覚える会話。村のはじまりの導き手。
      { id: "o_oldman", kind: "npc", art: "oldman", tx: 5, ty: 8, solid: true, label: "hito", ref: "oldman" },

      // 無口な犬 — フレーバー。耳をすますと少しだけ通じる。
      { id: "o_dog", kind: "npc", art: "dog", tx: 8, ty: 9, solid: true, label: null, ref: "dog" },

      // 泣いている子ども（村のはずれ）— メイン遭遇。解決すると“あなたと一緒”になり、ここからは消える。
      { id: "o_child", kind: "encounter", art: "child", tx: 13, ty: 7, solid: true, label: "kodomo",
        ref: "child", doneFlag: "child_solved", hideWhen: "child_solved" },

      // 母親 — 子どもを連れてくると ラストイベント（「友達」）。
      { id: "o_mother", kind: "npc", art: "mother", tx: 10, ty: 4, solid: true, label: null, ref: "mother" },

      // 橋の村人（村に戻っている）— 遭遇後の後日談。お礼。
      { id: "o_villager2", kind: "npc", art: "villager", tx: 4, ty: 4, solid: true, label: "hito",
        ref: "villager2", appearWhen: "bridge_done" },
    ],
  },
};

const AREA_ORDER = ["mori", "hashi", "mura"];

// ──────────────────────────────────────────
// NPC会話（村）。lines は {wordId} を含むテンプレ。
//   覚えている語が増えるほど、同じセリフが読めるようになる。
// ──────────────────────────────────────────
const NPCS = {
  // 花を持つ老人：プレイヤーに「人」という語を渡す（自分＝人 と気づく）。
  oldman: {
    name: "？？？",
    learnsLabelTo: "hito", // 会話後、頭上の名札が ？？？→人 になる
    lines: [
      "「おや。見ない 顔の ？？？ だね。」",
      "「わたしも、おまえも、おなじ ？？？ だ。」",
      "「ほら——『ひと』。おまえも わたしも、それだ。」",
    ],
    learn: "hito",
    after: [
      "老人は やわらかく わらった。",
      "「{mura} には、いろんな {hito} が いる。ゆっくり おぼえて いきなさい。」",
    ],
  },
  // 無口な犬：言葉では通じないが、耳をすますと“気配”が伝わるフレーバー。
  dog: {
    name: "？？？",
    lines: [
      "？？？ が こちらを 見ている。",
      "しっぽを ふって、村の おくの ほうを 気にしている。",
      "（何かを 知っているのかも しれない。）",
    ],
  },
  // 母親（子ども再会前）：何かを 探している様子。会話で「子ども」を覚える（村の探索の起点）。
  //   ※ child_solved 後に話しかけると、main がラストイベント(FINALE)へ分岐する（ここの会話には来ない）。
  mother: {
    name: "？？？",
    lines: [
      "女の人が、あたりを きょろきょろ している。",
      "「……ねえ。この あたりで、小さな ？？？ を 見なかった？」",
      "「わたしの 子。あの子、また ひとりで どこかへ——。」",
    ],
    learn: "kodomo",
    after: [
      "「{kodomo}。あの子の ことも、どうか おぼえて。」",
      "「村の はずれで、よく ひとりに なるの。さがして……。」",
    ],
  },
  // 橋の村人（村で再会）：お礼で「ありがとう」を教える＝橋を“ことばで解いた”関係の報酬。
  villager2: {
    name: "{hito}",
    lines: [
      "「さっきは——{hashi} を 渡らないでくれて、たすかったよ。」",
      "「きみは、わたしの 声を 聞こうと して くれた。」",
      "「……こういう とき、なんて 言うか 知ってるかい？」",
      "「『{arigatou}』。きみに、いちばん 言いたかった ことばだ。」",
    ],
    learn: "arigatou",
    after: [
      "「あの {hashi} は もう {abunai}。落ちたら、{mizu} は つめたいからね。」",
      "「{mura} へ ようこそ。{arigatou}。」",
    ],
  },
};

// ──────────────────────────────────────────
// 遭遇（ENCOUNTER）
//   通常戦闘の代わり。相手を“倒す”のではなく、言葉と様子を読み取り、適切な間合いと行動を選ぶ。
//   内部に 3 つの値： understand(理解度) / wary(警戒度) / tension(緊張度)。
//   ※ 数値は画面に出さない。moods のしきい値で“文章”として状態を伝える（読解体験を優先）。
//
//   actions（選択肢）の主なフィールド：
//     id,label,icon : ボタン
//     eff:{u,w,t}   : 各ゲージの増減
//     say:[...]     : 選んだ直後に流す文（{wordId} 可）
//     ladder:[...]  : 使うたびに1段ずつ進む（耳をすます等）。各段 {learn|frag, say:[...]}
//     learn / frag  : 語を覚える / 断片を得る
//     once:true     : 一度きり（使うと隠れる）
//     enableWhen    : 出現/有効化の条件（{knows,notKnows,minU,maxW,has,flag,used,notUsed}）
//     route:'success'|'fail' : 選ぶと決着
//     hint          : ボタン下の小さな補足
//   resolve：
//     success/fail それぞれ text（文配列）・words（その場で覚える語）・flag（立てるフラグ）。
//     tensionMax 到達でも fail。fail でもゲームオーバーにはしない（“すれ違い”として処理）。
// ──────────────────────────────────────────
const ENCOUNTERS = {

  // ===== 遭遇A：壊れた橋（本作いちばんの勝負どころ） =====
  bridge: {
    id: "bridge",
    title: "壊れた橋",
    who: "villager",
    coreWord: "abunai",
    tensionMax: 3,
    // 導入（最初の見え方）。相手は怒っているように“見える”。
    open: [
      "むこう岸の ？？？ が、こちらに 手を ふっている。",
      "けわしい 顔で、何かを 叫んでいる。",
    ],
    // 相手のセリフ。毎ターン上に出し、覚えた語ぶんだけ読めるようになる。
    speech: "{matte}！ その {hashi}、{abunai}！ {wataru}な！",
    speakerLabel: "hito",
    // moods：相手の様子を“文章”で表す。understand/wary を見て選ぶ。
    moods: [
      { maxU: 0, maxW: 99, text: "？？？ は 何かを 必死に 伝えようとしている。意味は、まだ わからない。" },
      { minU: 1, maxW: 1, text: "声の調子は、怒りというより——焦りに 近い 気がする。" },
      { minU: 3, text: "{hito} は あなたを 止めようとしている。危険を 知らせているのだ。" },
      { minW: 2, text: "{hito} は こまった顔で 後ずさりした。これ以上 近づくと、伝わらなくなる。" },
    ],
    actions: [
      // 進む — 板がきしむ。くり返すほど緊張が上がり、限界で“落ちる”(fail)。
      { id: "susumu", label: "進む", icon: "→", eff: { u: 0, w: 1, t: 1 },
        say: ["足元の板が ぎし、と きしんだ。", "？？？ が さらに 大きな声を 出した。"],
        repeatSay: ["板が 大きく しなった。", "？？？ の声が、ひきつっている。"] },

      // 止まる — 相手が安心する。理解が少し進む。
      { id: "tomaru", label: "止まる", icon: "■", eff: { u: 1, w: -1, t: -1 },
        say: ["あなたが 足を 止めると、？？？ は 少し ほっとしたように 見えた。"],
        repeatSay: ["あなたは その場に とどまった。相手の 息が、少し ゆるむ。"] },

      // 耳をすます — 本作の基本行動。使うたびに 待って→危ない→渡る と読めていく。
      { id: "mimi", label: "耳をすます", icon: "🜂", eff: { u: 2, w: 0, t: 0 },
        ladder: [
          { learn: "matte", frag: "matte",
            say: ["声の中に、何度も 同じ 音が ある。", "「ま……て……」"] },
          { learn: "abunai", frag: "abunai",
            say: ["その声は、怒りでは なく 焦りに 近い。", "「あ……ぶ……ない！」 あなたを 止めようとしている。"] },
          { learn: "wataru",
            say: ["ようやく、ことばの かたちが そろった。", "『その {hashi}、{abunai}。{wataru}な』——そう 言っていたのだ。"] },
        ],
        exhaustedSay: ["もう、相手の ことばは ほとんど わかる。"] },

      // 橋を調べる — 「橋」を覚える（耳をすますの内容と噛み合う）。
      { id: "miru", label: "橋を見る", icon: "👁", once: true,
        eff: { u: 1, w: 0, t: 0 }, learn: "hashi",
        say: ["足元の ？？？ を よく 見る。", "板が 割れ、半分 川に 落ちている。", "これは——{hashi} だ。"] },

      // 手をふる — 軽いすれ違い。理解が少しだけ進む。
      { id: "furu", label: "手をふる", icon: "✋", eff: { u: 1, w: 0, t: 0 },
        say: ["あなたが 手を ふると、？？？ は 首を 横に ふった。", "遊んでいる わけでは なさそうだ。"] },

      // 橋から離れる — 危ないを理解していれば“成功”。していなければ ただ離れるだけ。
      { id: "hanareru", label: "橋から離れる", icon: "←",
        eff: { u: 0, w: -1, t: -2 },
        enableWhen: { knows: "abunai" }, route: "success",
        hint: "（危ないと わかったうえで）" },
    ],
    // 緊張限界（進みすぎ）での失敗。
    onTensionMax: { route: "fail" },
    success: {
      text: [
        "—— ことばが 届いた。",
        "あなたは {hashi} から 離れた。",
        "{hito} は 安心したように、ふうっと 息を ついた。",
        "そして、川ぞいの 別の道を、ゆびさして 見せた。",
      ],
      words: ["matte", "hashi", "abunai", "wataru"], // 取りこぼしの保険（既習はスキップ）
      flag: "bridge_done",
    },
    fail: {
      text: [
        "{hashi} の板が、ばきっと 折れた。",
        "あなたは 浅い 川に 落ちた。つめたい。",
        "？？？ が 走ってきて、手を のばした。",
        "まだ、ことばは よく わからない。",
        "でも、怒っていた わけでは なかった——それだけは、わかった。",
      ],
      words: ["abunai"],   // 失敗でも、せめて“危ない”だけは 身体で覚える
      flag: "bridge_done", // 先へは進める（関係値=村人2のお礼は出るが少しそっけない）
      softFlag: "bridge_failed",
    },
  },

  // ===== 遭遇B：泣いている子ども（村のメイン遭遇） =====
  child: {
    id: "child",
    title: "泣いている子ども",
    who: "child",
    coreWord: "sagasu",
    waryMax: 4,
    open: [
      "村の はずれで、小さな ？？？ が うずくまっている。",
      "肩が、小さく ふるえている。",
    ],
    speech: "「？？……？？…… どこ……？」",
    speakerLabel: "kodomo",
    moods: [
      { maxU: 0, text: "？？？ が、何かを くりかえし つぶやいている。よく 聞きとれない。" },
      { minU: 2, maxW: 2, text: "{kodomo} は うつむいたまま。近づくと、びくっと 体を こわばらせる。" },
      { minU: 3, text: "{kodomo} は こわがっている。だれかを ずっと 呼んでいるのだ。" },
      { minU: 5, text: "{kodomo} は あなたを ちらりと 見た。ほんの 少しだけ、顔を あげて。" },
    ],
    actions: [
      // 見る — 子どもの状態を観察。「泣く」を覚える。
      { id: "miru", label: "見る", icon: "👁", once: true, eff: { u: 1, w: 0, t: 0 },
        learn: "naku",
        say: ["？？？ の 顔が、ぬれている。", "声が ふるえている。", "この子は——{naku} いている。"] },

      // 耳をすます — お母さん(断片→語)→探す と読めていく。
      { id: "mimi", label: "耳をすます", icon: "🜂", eff: { u: 2, w: 0, t: 0 },
        ladder: [
          { frag: "okaasan",
            say: ["子どもは、何度も 同じ ことばを 呼んでいる。", "「お……か……」"] },
          { learn: "okaasan",
            say: ["はっきり 聞こえた。", "「{okaasan}……どこ……？」 だれかを 呼んでいる。"] },
          { learn: "sagasu",
            say: ["「……{sagasu}……て……」", "この子は、{okaasan} を {sagasu} しているのだ。"] },
        ],
        exhaustedSay: ["子どもの ことばは、もう ほとんど わかる。"] },

      // 待つ — 動かずにいると、子どもが少し顔を上げる（警戒↓・理解↑）。
      { id: "matsu", label: "待つ", icon: "…", eff: { u: 1, w: -1, t: 0 },
        say: ["あなたが 動かずに いると、{kodomo} は 少しだけ 顔を あげた。"],
        repeatSay: ["あなたは そっと、待った。", "{kodomo} の 息が、少し おちつく。"] },

      // 近づく — 急ぐと こわがらせる（警戒↑）。waryMax で失敗（逃げる）。
      { id: "chikazuku", label: "近づく", icon: "→", eff: { u: 0, w: 2, t: 0 },
        say: ["あなたが 近づくと、{kodomo} は びくっとして 後ろに さがった。"],
        repeatSay: ["また 近づく。{kodomo} は こわばって、目を そらした。"] },

      // 花を見せる — 森で花を持っていれば、子どもが落ち着く（警戒↓）。
      { id: "hana", label: "花を見せる", icon: "✿", once: true,
        eff: { u: 1, w: -2, t: 0 },
        enableWhen: { has: "hana_item" },
        say: ["あなたは、森で つんだ {hana} を そっと 見せた。", "{kodomo} は {hana} を 見て、少しだけ 泣きやんだ。"] },

      // ── 決断（理解が進み、お母さんを覚えてから 出現）──
      { id: "issho", label: "一緒に探す", icon: "🤝",
        enableWhen: { knows: "okaasan", minU: 4 }, route: "success",
        hint: "（{okaasan} を いっしょに）" },
      { id: "yobu", label: "村人を呼ぶ", icon: "📣",
        enableWhen: { knows: "okaasan", minU: 4 }, route: "success",
        success: "yobu",
        hint: "（だれか 大人を）" },
    ],
    // 一定理解で自動的に「こわい」を覚える（泣くを知ったうえで）。
    autoLearn: [
      { when: { minU: 3, knows: "naku", notKnows: "kowai" }, learn: "kowai",
        say: ["{kodomo} は、ただ {naku} いているのでは ない。", "ずっと、こわかったのだ——{kowai}。"] },
    ],
    onWaryMax: { route: "fail" },
    success: {
      // 「一緒に探す」ルート
      text: [
        "—— すれ違いが ほどけた。",
        "{kodomo} は 小さく うなずいた。",
        "そして、あなたの 服の すそを、きゅっと つかんだ。",
        "「いっしょに……？」 ——うん、{issho} に。",
      ],
      words: ["naku", "kowai", "sagasu", "okaasan", "issho"],
      flag: "child_solved",
    },
    successAlt: {
      // 「村人を呼ぶ」ルート（こちらも成功。少しだけ結びが違う）
      key: "yobu",
      text: [
        "—— 声が 届いた。",
        "あなたは {mura} のほうへ かけ、{hito} を 呼んだ。",
        "ふりむいた {kodomo} の 手を、あなたは そっと 取った。",
        "もう、ひとりじゃ ない。{issho} に 行こう。",
      ],
      words: ["naku", "kowai", "sagasu", "okaasan", "issho"],
      flag: "child_solved",
    },
    fail: {
      text: [
        "{kodomo} は、ぱっと 立ち上がると、",
        "村の おくへ 走って いってしまった。",
        "ことばは、届かなかった。",
        "でも——泣いていた 理由は、少しだけ わかった。",
      ],
      words: ["naku"],
      flag: "child_solved",
      softFlag: "child_failed",
    },
  },
};

// ──────────────────────────────────────────
// ラストイベント：母親に子どもを返す → 「友達」を覚える
//   遭遇の gauge は使わず、決め打ちのシーン＋最後の3択。
// ──────────────────────────────────────────
const FINALE = {
  // 子どもを連れて 母親に話しかけたとき。
  open: [
    "女の人が、はじかれたように ふりむいた。",
    "そして、{kodomo} を ぎゅっと 抱きしめた。",
  ],
  motherLine: "「ありがとう。あなたは、この子の ？？？ ね。」", // 最後の語だけ わからない
  motherLearnLabel: "tomodachi", // tomodachi 習得後、？？？→友達 に置き換わる
  childLine: "{kodomo} が、あなたの ほうを 見て——", // 手を差し出す
  childWhisper: "「また…… いっしょ……」",
  prompt: "子どもが、あなたに 手を さしだしている。どうする？",
  choices: [
    { id: "take",  label: "手を取る",   learn: "tomodachi",
      say: ["あなたは、その 小さな手を、そっと 取った。", "あたたかい。"] },
    { id: "look",  label: "見つめる",   learn: "tomodachi",
      say: ["あなたは、その子の 目を、まっすぐ 見つめた。", "その子も、笑った。"] },
    { id: "leave", label: "離れる",     learn: null,
      say: ["あなたは、一歩 下がった。", "……でも、その子は 手を 引っこめなかった。",
            "もう一度、こちらへ 手を のばす。"], retry: true },
  ],
  // 「友達」を覚えたあと、母のセリフが更新される。
  motherAfter: "「ありがとう。あなたは、この子の {tomodachi} ね。」",
  afterLearn: [
    "{tomodachi}。",
    "——せかいに、また ひとつ、名前が 増えた。",
  ],
  toEndingFlag: "finale_done",
};

// ──────────────────────────────────────────
// エンディング（体験版の締め）。覚えた言葉が ひとつずつ ともる演出に使う。
// ──────────────────────────────────────────
const ENDING = {
  lines: [
    "せかいに、またひとつ 名前が 増えた。",
  ],
  // モンタージュで ともす語（覚えていれば順に光る）。
  montage: ["mizu", "hana", "hito", "hashi", "abunai", "kowai", "sagasu", "issho", "tomodachi"],
  closing: [
    "まだ、分からない言葉は たくさん ある。",
    "でも、もう——ひとりでは ない。",
  ],
  titleCard: { name: "名前を知らない世界", sub: "体験版 終了" },
};

// ──────────────────────────────────────────
// 進行ヒント（画面上部の“つぎ：…”）。フラグで現在の目的地を出し分ける。
// ──────────────────────────────────────────
const OBJECTIVES = {
  mori:  { learned_mizu: "つぎ：花を しらべて、森の そとへ。", _default: "水辺を しらべてみよう。" },
  hashi: { bridge_done: "右の 岸づたいに、村へ いける。", _default: "むこう岸の 人に、耳をすませてみよう。" },
  mura:  {
    _order: [
      { flag: "finale_done",  text: "出会いの つづきを、見とどけよう。" },
      { flag: "child_solved", text: "つぎ：その子を、お母さん（村の おく）の ところへ。" },
      { flag: "learned_kodomo", text: "つぎ：村の はずれで 泣いている子に、むきあおう。" },
      { _default: "村の 人（花を持つ 老人）に 話しかけてみよう。" },
    ],
  },
};

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.WORDS = WORDS;
  window.WORD_ORDER = WORD_ORDER;
  window.PLAYER_INIT = PLAYER_INIT;
  window.TITLE = TITLE;
  window.AREAS = AREAS;
  window.AREA_ORDER = AREA_ORDER;
  window.NPCS = NPCS;
  window.ENCOUNTERS = ENCOUNTERS;
  window.FINALE = FINALE;
  window.ENDING = ENDING;
  window.OBJECTIVES = OBJECTIVES;
}
