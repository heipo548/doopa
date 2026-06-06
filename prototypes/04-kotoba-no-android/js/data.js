/*
 * data.js — プロト#04「ルゥと せかいの あいだ」の全データ（正典）
 *
 * このゲームの“数字とことば”はすべてここに集約する（データ駆動）。
 * バランスやセリフを変えたいときは、原則このファイルだけをいじる。
 *
 * ※ ビルドなし・依存ゼロで file:// から動かすため ES Modules は使わない。
 *   普通の <script> として読み込み、window 直書きの const 群で共有する。
 *   そのため index.html では data.js を一番最初に読み込む。
 *
 * ── 署名メカニクス（このデータが守るべき核）──
 *   1. 口喧嘩バトルは相手の二つのゲージを攻める：
 *      ・精神HP（見える / mindHp）……harsh（とげの ことば）で削る。0で「言い負かした」＝凶暴+。
 *      ・思いやり（見えない / omoiyari）…kind（やわらかい ことば）で満たす。満タンで「寄り添った」＝優しさ+。
 *      思いやりは UI に一切出さない。急ぐ人ほど無意識に harsh＝凶暴へ流れる設計。
 *   2. harsh＝速い（3〜5手で勝てる）が凶暴。kind＝遅い（小刻みに積む・4〜8手＝敵の言葉を多く浴びる）が優しい。
 *   3. 必然性：手を出せない村＝叩けない。争いは “ことば” でしか決着できない（言い負かす or 寄り添う）。
 *   4. 正体＝型番「L」：村人が型番「L」をうまく読めず「ルゥ」と呼んだ。終盤、word + l = world を回収する
 *      （操作計測の神様メタ → 「ことばに ひとつ(=L=きみ) 足すと、せかいに なる」）。
 *
 * ★ #03「WO_RD → WORLD」と同じコンセプトの“上位版”だが、テキスト・数値・演出は #04 独自（丸写ししない）。
 *   house 様式（モジュール構成・data.js 駆動・window export）は踏襲する。
 */

// ──────────────────────────────────────────
// PLAYER_INIT（主人公の初期値）
//   name は隠し本名「L」（胸に かすれて のこる 型番）。終盤メタで回収する。
//   displayName「ルゥ」は村人が型番 L を発音できず付けた“あだ名”。画面にはこれが出る。
//   startCards は開幕手札：harsh と kind を1枚ずつ＝最初から二択（速い/遅い）を体験できる核。
// ──────────────────────────────────────────
const PLAYER_INIT = {
  name: "L",                 // 隠し本名（=word に足すと world になる ひと文字）
  displayName: "ルゥ",        // 型番 L の聞き間違い＝あだ名
  hp: 28,
  maxHp: 28,
  startCards: ["urusai", "kiite"], // harsh:うるさい / kind:きいてるよ
  sprite: "ruu",             // SPRITES のキー（フィールド/バトルの見た目）
};

// ──────────────────────────────────────────
// WORDS（ことばカード）＝バトルの手札
//   kind:"harsh" … 相手の精神HP(mindHp)を power 削る。速い＝凶暴ルート。
//   kind:"kind"  … 相手の思いやり(omoiyari)を power 満たす。遅い＝優しさルート。
//   levels[3]/power[3] … 3段階成長（同じことばが“強い/深い言い方”へ育つ）。
//   side … kind の一部：healSelf(自分hp+3) / lowerAtk(敵atk-1)。kind＝遅いぶん“耐える”手段。
// ──────────────────────────────────────────
const WORDS = {
  // ── harsh（精神HPを削る・速い・凶暴+）──
  urusai: {
    id: "urusai", kind: "harsh",
    levels: ["うるさい", "うるさいなあ", "うるっさい！"],
    power: [10, 13, 16], side: "",
    flavor: "口の先で とがる、小さな針。早い。言ったあと、すこし 金くさい味がする。",
  },
  kankeinai: {
    id: "kankeinai", kind: "harsh",
    levels: ["きみに かんけいない", "もう かんけいないだろ", "ぜんぶ かんけいない！"],
    power: [12, 16, 20], side: "",
    flavor: "線を ひいて、相手を 外に 出す。押し返すのに よく効く。気づくと、まわりに だれも いなくなる。",
  },
  "dokka-e": {
    id: "dokka-e", kind: "harsh",
    levels: ["どっか いけ", "どっか いってよ", "どっか いっちまえ！！"],
    power: [15, 19, 24], side: "",
    flavor: "会話を ぶつ切りにする はさみ。早く 終わらせたい人ほど、これを にぎる。",
  },
  // kieyo：学校で“預かる”最も鋭い harsh。引けたら凶暴ルートが一気に速くなる。
  kieyo: {
    id: "kieyo", kind: "harsh",
    levels: ["きえてよ", "きえてくれ", "きえちまえ！！"],
    power: [18, 23, 28], side: "",
    flavor: "言ってはいけない 形の ことば。よく切れる。切ったあとに のこるのは、しずけさ だけ。",
  },

  // ── kind（思いやりを満たす・遅い・優しさ+）──
  kiite: {
    id: "kiite", kind: "kind",
    levels: ["きいてるよ", "ちゃんと きいてる", "ずっと きいてるよ"],
    power: [6, 8, 10], side: "",
    flavor: "おそい。ぜんぜん 効いてないように 見える。でも、見えないところで 効いている。",
  },
  ganbatta: {
    id: "ganbatta", kind: "kind",
    levels: ["がんばったね", "よく がんばったね", "ほんとに よく がんばった"],
    power: [6, 8, 10], side: "healSelf",
    flavor: "相手を なだめながら、自分の 息も ととのう ことば。長い けんかの 燃料になる。",
  },
  tonari: {
    id: "tonari", kind: "kind",
    levels: ["となりに いるよ", "ずっと となりに いる", "どこにでも となりに いるよ"],
    power: [5, 7, 9], side: "lowerAtk",
    flavor: "となりに いてくれる人には、牙を 向けられない。重ねるほど 相手の とげが しぼむ。",
  },
  namae: {
    id: "namae", kind: "kind",
    levels: ["なまえ よんでいい?", "きみの なまえ、すき", "なんども なまえ よぶよ"],
    power: [8, 10, 12], side: "",
    flavor: "強い kind。でも これで 勝っても、勝った気は しない。たぶん、それでいい。",
  },
  // matteru：学校で“預かる”最もあたたかい kind＋自分回復。寄り添いルートの主力にも、くちなしの gift にも。
  matteru: {
    id: "matteru", kind: "kind",
    levels: ["まってるよ", "ずっと まってる", "なんねん でも まってる"],
    power: [10, 12, 14], side: "healSelf",
    flavor: "急がない ことば。相手の そばに 居つづけると 約束する。言うほど、自分も 落ちつく。",
  },
};

// ──────────────────────────────────────────
// ENEMIES（口喧嘩の相手）
//   mindHpMax/omoiyariNeed/atk/gift（kind勝ちで授かる語）/attackLines/isBoss。
//   isBoss=true は最後の関門（勝利で結末→神様メタへ）。それ以外は撃破で村へ戻り、次が現れる。
//
//   バランス目安（戦間はセーブで全回復＝各戦 hp28 スタート）：
//     かどっこ：harsh 3〜4手 / kind 6手前後・被弾 atk3×5＝15、hp28で生存。
//     くちなし(ボス)：harsh 3〜5手 / kind 4〜8手・回復/atk下げ札で生存。手数増で“手強さ”を出す（atk据置3で理不尽回避）。
// ──────────────────────────────────────────
const ENEMIES = {
  kadokko: {
    id: "kadokko", name: "かどっこ", shape: "kid", color: "#d98aa6", sprite: "kadokko",
    mindHpMax: 34, omoiyariNeed: 36, atk: 3, gift: "tonari", isBoss: false,
    attackLines: [
      "「どこから 来たの?って きいてるの。なんで 答えないの。」",
      "「ことばも 持ってないくせに、なんで この村に いるの。」",
      "「だまってると、こっちが ぜんぶ わるいみたいじゃん。」",
      "「……べつに。きみが きらいなわけじゃ、ないけど。」",
      "「なんで そんな目で 見るの。やめてよ、こわい。」",
    ],
  },
  // くちなし＝村いちばんの言い負かし上手。村の出口に立つ最後の関門。
  //   とげの裏に「だれにも なまえを 呼ばれたことがない さみしさ」が透ける（ただの悪役にしない）。
  kuchinashi: {
    id: "kuchinashi", name: "くちなし", shape: "boss", color: "#7c6fb0", sprite: "kuchinashi",
    mindHpMax: 48, omoiyariNeed: 40, atk: 3, gift: "matteru", isBoss: true,
    attackLines: [
      "「ことばも なかった くせに。ひろった ことばで、わたしに 勝つ つもり?」",
      "「なまえ? ……そんなの、呼ばれたこと ないやつには 関係ない。」",
      "「やわらかい ことばなんて、おそいだけ。刺せば 終わる。早く しなよ。」",
      "「きみ、だんだん わたしに 似てきたね。……それ、ほめてないよ。」",
      "「だまるな。だまられると、こっちが ひとりみたいじゃ ないか。」",
    ],
  },
};

// ──────────────────────────────────────────
// NPCS（村の住人）
//   gives が配列なら会話末に「3択カード」を提示（人格を傾ける最初の選択）。null はフレーバーのみ。
// ──────────────────────────────────────────
const NPCS = {
  npc_kona: {
    id: "npc_kona", name: "こな", role: "パン屋の子", shape: "girl", color: "#f0b56a", sprite: "kona",
    lines: [
      "あ、起きた! きみ、村はずれで ずっと しゃがんでたよね。",
      "だいじょうぶ? ……って きいても、なんにも 言わないのね。",
      "ことば、ひとつも 持ってないの? ……ここ、それ けっこう こまるよ。",
      "この村ね、手を出すの 禁止なの。むかし なんかあって、そういう 決まり。",
      "だから みんな、ことばで けんかするの。なぐれないから、ことばが ぜんぶなの。",
      "きみの 胸の それ、かすれてて 読めないね。……『ルゥ』って 呼んで いい?",
      "牙の ない子は、すぐ 言い負かされちゃう。だから ひとつ あげる。",
    ],
    offerPrompt: "ねえ。きみは いま、どんな ことばを いちばん 知りたい?",
    gives: ["kankeinai", "ganbatta", "namae"], // harsh強 / kind(回復) / kind強 のトレードオフ3択
  },
  npc_ido: {
    id: "npc_ido", name: "いどばた ばあ", role: "井戸ばたの老婆", shape: "oba", color: "#a9b0d0", sprite: "baa",
    lines: [
      "ほう。ことばを 持たん子が、また 来たかい。",
      "この村でな、手を あげられんのは のろいでも 罰でもない。守るための 決まりさ。",
      "じゃが ことばは のこった。にぎれば 武器、ひらけば 手当て。おなじ口から 出るのにな。",
      "きつい ことばは よう 効く。早う 勝てる。じゃが あとに のこるぞ、自分の中に。",
      "村の おくに『くちなし』が おる。いちばん 言い負かしの 上手な子さ。……かわいそうな子でな。",
      "おまえさんの 目つきが、ひろう ことばで かわる。……井戸の そこの だれかが、見とるよ。",
    ],
    offerPrompt: null,
    gives: null,
  },
};

// ──────────────────────────────────────────
// SHOP（学校＝ことばショップ）
//   「ことばは 買うんじゃ ない、預かるんだ」。stock から1枚だけ受け取る＝ここでも“色の選択”＝人格が少し傾く。
//   cost は MVP では 0（任意の寄り道）。買わなくてもアークは進む。
// ──────────────────────────────────────────
const SHOP = {
  id: "school", name: "がっこう（ことばを あずかる 小屋）",
  intro: "くろ板に、つよい ことばが ふたつ かいてある。先生いわく『ことばは 買うんじゃ ない、預かるんだ。返し方は きみが きめな』。ひとつだけ、もって いっていい。",
  stock: ["kieyo", "matteru"], // 鋭い harsh / あたたかい kind ＝最後の“色の選択”
  cost: 0,
};

// ──────────────────────────────────────────
// AREA（なぐれない むら・単一エリア。ノードの appearWhen で“広がり”を出す）
//   appearWhen フラグが立つまでノードは出ない。exit は requires が立つまで locked。
//   進行：入村→こな会話(3択)→学校(任意)→かどっこ→(撃破)→くちなし出現→ボス戦→結末→神様メタ。
// ──────────────────────────────────────────
const AREA = {
  id: "mura", name: "なぐれない むら", hint: "村の子に はなしかけて、ことばを ひろおう。",
  nodes: [
    { id: "n_kona",  type: "npc",   ref: "npc_kona", x: 0.26, y: 0.42, label: "こな", appearWhen: "" },
    { id: "n_ido",   type: "npc",   ref: "npc_ido",  x: 0.78, y: 0.30, label: "いどばた ばあ", appearWhen: "" },
    { id: "n_sign",  type: "sign",  x: 0.50, y: 0.54, label: "立て札", appearWhen: "",
      text: "『この村では 手を あげては いけません。ことばだけで、はなしましょう。』" },
    { id: "n_save",  type: "save",  x: 0.16, y: 0.74, label: "ことばの泉（セーブ）", appearWhen: "" },
    { id: "n_school",type: "shop",  ref: "school",   x: 0.40, y: 0.20, label: "がっこう", appearWhen: "got_card" },
    { id: "n_enemy", type: "enemy", ref: "kadokko",  x: 0.72, y: 0.70, label: "かどっこ", appearWhen: "talked_npc_kona" },
    { id: "n_boss",  type: "enemy", ref: "kuchinashi", x: 0.50, y: 0.85, label: "くちなし", appearWhen: "kado_done" },
    { id: "n_exit",  type: "exit",  x: 0.50, y: 0.10, label: "村の そとへ", appearWhen: "", requires: "boss_done" },
  ],
};

// ──────────────────────────────────────────
// BALANCE（傾向の重みとダーク化しきい値）
//   winHarsh=winKind（対称）＝勝ち方そのものが結末を決める。useHarsh>useKind＝速い＝凶暴に倒れやすい。
//   pickHarsh/pickKind … 3択・学校で「どの色を選んだか」も人格を少し傾ける。
//   darkenAt … kyoubou がこの値を超えるごとに翳り段 +1（0..3）。2戦 harsh 通しで dark-3 へ。kind 通しは 0。
// ──────────────────────────────────────────
const BALANCE = {
  winHarsh: 10, winKind: 10, useHarsh: 3, useKind: 2, pickHarsh: 2, pickKind: 2,
  darkenAt: [8, 16, 30],
};

// ──────────────────────────────────────────
// ENDINGS（簡易エンド＝優しさ率で文面が変わる1画面。勝ち方が滲む3トーン）
//   優しさ率 = yasashisa / (yasashisa + kyoubou)。高い順（min 降順）で満たす最初を返す。
//   結末→神様メタ(META)→周回示唆→タイトル へ続く。
// ──────────────────────────────────────────
const ENDINGS = [
  {
    id: "yawaragi", min: 0.60, tone: "yasashii", title: "ことばに、足された朝",
    text: "だれも 削れないまま、けんかは ほどけた。くちなしは『……なまえ、はじめて 呼ばれた』と、ちいさく わらった。きみは 勝っていない。でも、村は さっきより ずっと あかるい。井戸を のぞくと、水に うつる きみの目は、まだ きみの色のまま。胸の かすれた 型番が、なぜだか きょうは、すこし 読みやすく 見えた。きみは ことばを ひとつも 失わずに、村を 出る。",
  },
  {
    id: "yuragi", min: 0.34, tone: "chukan", title: "半分だけ、せかいになった朝",
    text: "きみは 押し返したり、ことばを かけたり しながら、なんとか 場を 終わらせた。くちなしは だまって 道を あけたが、目は あわせなかった。勝ちとも 負けとも つかない。きみの中で、とがった声と やわらかい声が、まだ どっちつかずで ゆれている。井戸の 水は すこし 翳り、すこし あたたかい。きみが どんな子に なるのか――それは、まだ 決まっていない。きょうは、それで いい。",
  },
  {
    id: "togari", min: 0.0, tone: "kyoubou", title: "しずまりかえった、ことばだけの朝",
    text: "くちなしは、もう なにも 言えなくなった。きみの ことばが ぜんぶ 串ざしにした。勝った。村は しずかだ。……すこし、しずかすぎる。だれも、もう きみに 話しかけない。井戸を のぞくと、水に うつる きみの目だけが、知らない色に なっていた。ことばを たくさん おぼえたはずなのに、もう、やさしく かける あいてが いない。胸の 型番は、いつのまにか、もっと かすれて 読めなく なっていた。",
  },
];

// ──────────────────────────────────────────
// META（神様＝井戸の こえ の見透かし。操作計測を“鏡”として実値で提示し、最後に word→world / L を回収）
//   openLines → skip出し分け → click出し分け → 鏡(metricsSummary) → reveal(綴り) → close → 周回示唆。
//   skip/click は skipRatio / clicks のしきい値で high/mid/low を出し分ける（採点でなく“鏡”）。
// ──────────────────────────────────────────
const META = {
  godName: "井戸の こえ",
  openLines: [
    "……やっと、ここまで 来たね。村の 出口は、もう すぐ そこ。",
    "わたしはね、この村の 井戸の そこに ずっと いた。なまえは――ないよ。きみと、おなじ。",
    "ねえ。きみが この村で 言った ことば、ぜんぶ、水に うつって 見えていたよ。",
  ],
  skipLines: {
    high: [
      "きみは、ことばを ずいぶん 急いで 送っていたね。読むより さきに、つぎへ、つぎへ。",
      "『ことばが すべて』の 村で、きみは ことばを あまり 読まなかった。……せめてないよ。ただ、見えていた。",
    ],
    mid: [
      "きみは、聞いた ところと、とばした ところが あったね。どっちつかずで いい。それも きみだ。",
    ],
    low: [
      "きみは、ことばを ひとつずつ、ちゃんと 受けとっていたね。",
      "この村で それを する子は、めずらしい。だから、よく おぼえてる。",
    ],
  },
  clickLines: {
    high: [
      "それに、ずいぶん せっかちに 押したね。手が さきに 動く子だ。",
      "急いでいたね。なぐれない村では、急ぐ気もちが ぜんぶ、とがった ことばに 化けるんだよ。",
    ],
    mid: [
      "きみの 手は、ふつうの はやさ。せかいの まんなか あたり。",
    ],
    low: [
      "きみの 手は、しずかだった。あまり 押さずに、見ていたね。",
    ],
  },
  // 鏡（metricsSummary を実値で見せる一幕）の前置き・後置き。
  mirrorIntro: "これが、きみの “いそぎ” の かたち。せめる ためじゃ ない。ただ、うつして みせるだけ。",
  mirrorOutro: "数字は、きみを きめない。きめるのは、つぎに きみが ひろう ことばだ。",
  // reveal：word + l = world / ことば → せかい の回収（最後の一刺し）。
  reveal: [
    "ところで。きみは、自分の なまえ、まだ 知らないよね。村の みんなは『ルゥ』って 呼んだ。",
    "でも あれね、聞き間違いなんだ。きみの 胸に かすれて のこってた 型番――『L』。だれかが うまく 読めなかっただけ。",
    "おしえてあげる。きみが ひろってきた『WORD（ことば）』。それに『L』を ひとつ 足すと、どうなると 思う?",
    "……『WORLD（せかい）』に なるんだよ。足りなかった ひと文字は、ずっと、きみ だった。",
  ],
  closeLines: [
    "なまえを 取りもどした きみは、もう『ルゥ』だけの子じゃ ない。きみは、L。せかいの ひと文字。",
    "いま きみが あるいた道は、ひとつの かたち。やわらかい道も、とがった道も、その あいだも、まだ 井戸の そこで ねむってる。",
  ],
  encore: "またね、L。……つぎは、どの ことばを ひろう? それを きめるのは、いつだって きみだよ。",
  // しきい値の目安（MVP・村1周）。
  skipHigh: 0.45, skipLow: 0.10, clickHigh: 60, clickLow: 20,
};

// 結果画面の“軽い1行メタ”（神様メタを最後まで見ない人向けの最小フォールバック）。
const META_LINES = {
  hiSkip: "きみが ことばを 送る速さ、ぜんぶ 見えていたよ。いそいで 飛ばした ことばは、きみの 牙のほうに なったね。",
  midSkip: "きみの 読む速さ、ちょっとだけ 見ていた。急いだ ところと、立ち止まった ところが あったね。",
  loSkip: "きみは ことばを、最後まで ちゃんと 聞いていたね。……それ、けっこう めずらしいんだよ。",
};

// dark 段ごとの主人公ルゥのバトル中プロンプト（段が上がるほど不穏に。世界は可愛いまま）。
const DARK_LINES = [
  "ことばを、ひとつ えらぶ。どう 勝つかが、きみに なる。",
  "はやく 終わらせたい。とがった ほうが、はやい。",
  "……刺すと、すっとする。なんで だろう。",
  "もう、やわらかい 言い方、わすれちゃった みたい。",
];

// 傾向ラベル（結果画面で内部の傾きを“ことば”にして見せる）。
const TENDENCY_LABELS = { kyoubou: "にぎる手（とがり）", yasashisa: "ひらく手（やわらぎ）" };

// ──────────────────────────────────────────
// TITLE（タイトル画面の文言）
//   コンセプト（word→world／言葉を世界に）を堂々と掲げる。プロローグに名前の謎の“気配”を薄く仕込む。
// ──────────────────────────────────────────
const TITLE = {
  title: "ルゥと せかいの あいだ",
  subtitle: "ことばに ひとつ 足すと、せかいに なる。足りなかったのは、きみだ。",
  prologue:
    "ここは、手を あげることが 禁じられた村。\n" +
    "こぶしの かわりに、みんな ことばを にぎっている。\n" +
    "ある朝、ことばを ひとつも 持たない子が、村はずれで 目を さました。\n" +
    "胸には かすれた 型番が ひとつ。村人は それを うまく 読めなくて、ただ『ルゥ』と 呼んだ。\n" +
    "井戸の そこから、だれかが その子を 見あげている 気が する――でも、のぞくと だれも いない。\n" +
    "ひろう ことばが やわらかいか、とがっているかで、道は ふたつに わかれる。\n" +
    "さあ。きみは、どんな ことばを ひろう?",
  estPlay: "プレイ時間 約8分",
};

// ──────────────────────────────────────────
// SPRITES（キャラのインラインSVG＝アート。CSS/SVG のみ・外部素材なし）
//   art-production-director / art-integration が制作、pixel-art-qa が点検（GO_WITH_FIXES→反映済み）。
//   共通：viewBox 0 0 100 100・サイズはCSS任せ・統一輪郭線 #6a5fae・頬の淡ピンク・aria-label付き。
//   ruu のみ .ru-eye/.ru-core を持ち、dark段で目/胸L が #8a4dff に冷たく光る（CSSで切替＝主人公だけ翳る）。
//   kuchinashi の顔fill は a11y 修正で #b3a8dc→#c9c0ea（輪郭とのコントラスト確保）。
// ──────────────────────────────────────────
const SPRITES = {
  ruu: `<svg viewBox="0 0 100 100" role="img" aria-label="ルゥ：無機質アンドロイドの子。胸にかすれたL" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="#6a5fae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="50" y1="10" x2="50" y2="18"/><circle cx="50" cy="8.5" r="2.6" fill="#8b91e8"/><path d="M30 30 Q50 16 70 30 Q73 40 70 50 Q50 60 30 50 Q27 40 30 30 Z" fill="#eef1ff"/><circle class="ru-eye" cx="42" cy="39" r="3.6" fill="#5b63d6" stroke="none"/><circle class="ru-eye" cx="58" cy="39" r="3.6" fill="#5b63d6" stroke="none"/><circle cx="35" cy="45" r="2.6" fill="#f6c6d8" stroke="none"/><circle cx="65" cy="45" r="2.6" fill="#f6c6d8" stroke="none"/><path d="M34 64 Q34 58 40 58 L60 58 Q66 58 66 64 L66 84 Q66 90 60 90 L40 90 Q34 90 34 84 Z" fill="#dfe6ff"/><path class="ru-core" d="M46 68 L46 78 L54 78" stroke="#8b91e8" stroke-width="2.6" opacity="0.85"/><line x1="30" y1="70" x2="24" y2="78"/><line x1="70" y1="70" x2="76" y2="78"/></g></svg>`,
  kona: `<svg viewBox="0 0 100 100" role="img" aria-label="こな：パン屋の子。やさしい少女" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="#6a5fae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 30 Q26 16 50 14 Q74 16 72 30 Q70 36 64 35 L36 35 Q30 36 28 30 Z" fill="#f0b56a"/><circle cx="50" cy="42" r="24" fill="#ffe6c8"/><path d="M30 40 Q26 22 50 20 Q74 22 70 40 Q60 33 50 33 Q40 33 30 40 Z" fill="#caa15a"/><circle cx="41" cy="43" r="3.2" fill="#5a4633" stroke="none"/><circle cx="59" cy="43" r="3.2" fill="#5a4633" stroke="none"/><circle cx="34" cy="49" r="3" fill="#f6a6bf" stroke="none"/><circle cx="66" cy="49" r="3" fill="#f6a6bf" stroke="none"/><path d="M44 51 Q50 56 56 51"/><path d="M30 70 Q30 62 40 62 L60 62 Q70 62 70 70 L70 90 L30 90 Z" fill="#fff3e0"/><path d="M40 62 Q50 72 60 62"/></g></svg>`,
  baa: `<svg viewBox="0 0 100 100" role="img" aria-label="いどばた ばあ：井戸ばたの老婆。あたたかい賢者" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="#6a5fae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 36 Q26 18 50 16 Q74 18 72 36 Q72 44 64 44 L36 44 Q28 44 28 36 Z" fill="#cfd3ec"/><circle cx="50" cy="46" r="23" fill="#f2ddc7"/><path d="M30 44 Q28 26 50 24 Q72 26 70 44 Q60 38 50 38 Q40 38 30 44 Z" fill="#e7e9f6"/><path d="M37 47 Q41 44 45 47"/><path d="M55 47 Q59 44 63 47"/><circle cx="41" cy="49" r="2.4" fill="#5a4633" stroke="none"/><circle cx="59" cy="49" r="2.4" fill="#5a4633" stroke="none"/><circle cx="33" cy="54" r="3" fill="#f2b8b0" stroke="none"/><circle cx="67" cy="54" r="3" fill="#f2b8b0" stroke="none"/><path d="M44 58 Q50 62 56 58"/><path d="M30 72 Q30 64 42 64 L58 64 Q70 64 70 72 L70 90 L30 90 Z" fill="#bcc2e0"/></g></svg>`,
  kadokko: `<svg viewBox="0 0 100 100" role="img" aria-label="かどっこ：とげっ子の中ボス。とげと弱さ" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="#6a5fae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8 L57 24 L72 18 L66 33 L82 36 L68 45 L78 58 L62 56 L60 72 L50 60 L40 72 L38 56 L22 58 L32 45 L18 36 L34 33 L28 18 L43 24 Z" fill="#d98aa6"/><circle cx="50" cy="44" r="19" fill="#f0b6c8"/><path d="M40 40 L46 43"/><path d="M60 40 L54 43"/><circle cx="43" cy="45" r="3" fill="#5a2f3f" stroke="none"/><circle cx="57" cy="45" r="3" fill="#5a2f3f" stroke="none"/><circle cx="36" cy="50" r="2.6" fill="#e88aa0" stroke="none"/><circle cx="64" cy="50" r="2.6" fill="#e88aa0" stroke="none"/><path d="M44 54 Q50 50 56 54"/><path d="M40 78 Q50 84 60 78" opacity="0.6"/></g></svg>`,
  kuchinashi: `<svg viewBox="0 0 100 100" role="img" aria-label="くちなし：言い負かし上手のボス。とげの裏のさみしさ。口元は描かない" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="#6a5fae" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M50 6 L58 22 L74 14 L70 31 L88 32 L73 43 L86 56 L69 55 L70 73 L57 62 L50 78 L43 62 L30 73 L31 55 L14 56 L27 43 L12 32 L30 31 L26 14 L42 22 Z" fill="#7c6fb0"/><circle cx="50" cy="42" r="21" fill="#c9c0ea"/><path d="M38 36 L47 40"/><path d="M62 36 L53 40"/><path d="M40 45 Q43 42 46 45"/><path d="M54 45 Q57 42 60 45"/><circle cx="35" cy="50" r="2.6" fill="#9a8fce" stroke="none"/><circle cx="65" cy="50" r="2.6" fill="#9a8fce" stroke="none"/><path d="M44 56 Q47 58 47 60" opacity="0.5"/></g></svg>`,
};

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
if (typeof window !== "undefined") {
  window.PLAYER_INIT = PLAYER_INIT;
  window.SPRITES = SPRITES;
  window.WORDS = WORDS;
  window.ENEMIES = ENEMIES;
  window.NPCS = NPCS;
  window.SHOP = SHOP;
  window.AREA = AREA;
  window.BALANCE = BALANCE;
  window.ENDINGS = ENDINGS;
  window.META = META;
  window.META_LINES = META_LINES;
  window.DARK_LINES = DARK_LINES;
  window.TENDENCY_LABELS = TENDENCY_LABELS;
  window.TITLE = TITLE;
}
