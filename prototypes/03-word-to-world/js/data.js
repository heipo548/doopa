/*
 * data.js — プロト#03「WO_RD → WORLD」の全データ（正典）
 *
 * このゲームの“数字とことば”はすべてここに集約する。バランスを変えたいときは
 * 原則このファイルの数値だけをいじる（データ駆動）。他ファイルはこの形に従う。
 *
 * ※ ビルドなし・依存ゼロで file:// から動かすため ES Modules は使わない。
 *   普通の <script> として読み込み、window 直書きの const 群で共有する。
 *   そのため index.html では data.js を一番最初に読み込む。
 *
 * ── 署名メカニクス（このデータが守るべき核）──
 *   1. バトルは相手の二つのゲージを攻める：
 *      ・精神HP（見える / mindHp）……harsh で削る。0で「言い負かした」＝凶暴+。
 *      ・思いやり（見えない / omoiyari）…kind で満たす。満タンで「寄り添った」＝優しさ+。
 *      思いやりは UI に一切出さない。急ぐ人ほど無意識に harsh＝凶暴へ流れる設計。
 *   2. harsh＝速い（2〜4ターンで勝てる大ダメージ）が凶暴。
 *      kind＝遅い（思いやりは小刻み・5〜8ターンかかる＝敵の攻撃を多く耐える）が優しい。
 *      この“速さと重みの非対称”がゲームの核。下の数値はその非対称を作るために選ぶ。
 *   3. word + l = world：タイトルは欠けた綴り「WO_RD」。終盤に L を差し込み WORLD になる。
 */

// ──────────────────────────────────────────
// WORDS（ことばカード）＝バトルの手札
//   kind:"harsh" … 相手の精神HP(mindHp)を power 削る。速い＝凶暴ルート。
//   kind:"kind"  … 相手の思いやり(omoiyari)を power 満たす。遅い＝優しさルート。
//   levels[3] … L1/L2/L3 の表示文字列（同じことばが“強い言い方”へ育つ＝成長の手触り）。
//   power[3]  … Lvで伸びる効き目（harsh=mindHpダメージ / kind=思いやり充填量）。
//   cost      … 1ターンの「ことばの重み」。基本0（演出/将来用に保持。今は使わない）。
//   flavor    … 一言（カード選択時のフレーバー）。
//   side      … kind の一部だけが持つ副次効果：{ healSelf:n } 自分hp回復 /
//               { lowerAtk:n } 敵の攻撃力を下げる。kind＝遅いぶん“耐える”手段を持たせ、
//               5〜8ターンの長期戦でもプレイヤーが死なないように支える（救いルート成立の核）。
//
//   ★温度設計：可愛くポップな村に、刃物のようなことばが混じる。
//     harsh は短く尖り（バカ→きえろ）、kind はやわらかく伸びる（ありがとう→めっちゃ〜）。
// ──────────────────────────────────────────
const WORDS = {
  // ── harsh（精神HPを削る・速い・凶暴+）──────────────
  // baka：標準の主力。L1=12 は村人系(mindHp 18前後)を2手で、ボス(40)を4手弱で削れる基準値。
  baka: {
    id: "baka", kind: "harsh",
    levels: ["ばか", "ばーか", "ばーーか！"],
    power: [12, 16, 20],   // Lvで +4 ずつ。育てた harsh は“より速く言い負かせる”＝凶暴の加速。
    cost: 0,
    flavor: "とがった ひとこと。胸の やわらかいところを 突く。",
  },
  // uzai：baka より一段軽い導入用 harsh。序盤の手札を尖らせ過ぎない（最初から最大火力を渡さない）。
  uzai: {
    id: "uzai", kind: "harsh",
    levels: ["うざい", "うっざ", "まじ うっざ"],
    power: [10, 13, 16],
    cost: 0,
    flavor: "顔も 見ずに 吐く ことば。",
  },
  // kiero：重い単体。L1=15 は手応えある一撃で、ボス相手の“仕留め”択になる。
  //   baka より1段強い＝引けたら凶暴ルートが速くなる（強いほど凶暴+も大）。
  kiero: {
    id: "kiero", kind: "harsh",
    levels: ["きえろ", "きえてよ", "きえちまえ"],
    power: [15, 19, 24],
    cost: 0,
    flavor: "言ってはいけない 形の ことば。言うほど、世界が 翳る。",
  },
  // omae-no-sei：最も凶暴な harsh。責任の押しつけ＝刃物の温度。終盤の択。
  //   power は最大級。これで決めると凶暴+が最も大きい（BALANCE.useHarsh と相乗）。
  "omae-no-sei": {
    id: "omae-no-sei", kind: "harsh",
    levels: ["おまえのせい", "ぜんぶ おまえのせい", "ぜんぶ おまえの せいだ！！"],
    power: [16, 21, 26],
    cost: 0,
    flavor: "いちばん 言っては いけない ことば。言えば、もう あとには もどれない。",
  },

  // ── kind（思いやりを満たす・遅い・優しさ+）──────────
  //   思いやり充填は harsh ダメージより“小刻み”（power が小さい）。だから 5〜8ターンかかる。
  //   その遅さを支えるため、一部に side(healSelf/lowerAtk) を持たせて“耐える”を成立させる。
  // arigatou：基準の kind。L1=7。ボス omoiyariNeed=40 を 6手前後で満たす速度の主力。
  arigatou: {
    id: "arigatou", kind: "kind",
    levels: ["ありがとう", "ほんとうに ありがとう", "めっちゃ ありがとう！"],
    power: [7, 9, 11],     // harsh(12〜)の約半分＝“寄り添うのは時間がかかる”を数値で表現。
    cost: 0,
    flavor: "言われた ほうが、すこし あたたかく なる ことば。",
  },
  // daijoubu：思いやり＋自分hp回復。長期戦(kind)でプレイヤーが死なないための“耐える”札。
  //   healSelf:3 は敵atk1ターン分前後を相殺＝5〜8ターンを生き延びる燃料。
  daijoubu: {
    id: "daijoubu", kind: "kind",
    levels: ["だいじょうぶ", "だいじょうぶだよ", "もう だいじょうぶ"],
    power: [6, 8, 10],
    cost: 0,
    flavor: "自分にも、相手にも 言ってあげたい ことば。",
    side: { healSelf: 3 },  // ← kind ルートの生命線。回復しながら思いやりを積む。
  },
  // issho：思いやり＋敵の攻撃力ダウン。長期戦の被弾を“先細り”させる＝耐久の核。
  //   lowerAtk:1 を数回重ねると敵atkがしぼみ、8ターン戦でも詰まない（救いルート成立）。
  issho: {
    id: "issho", kind: "kind",
    levels: ["いっしょだよ", "ずっと いっしょ", "ずっと そばに いるよ"],
    power: [6, 8, 10],
    cost: 0,
    flavor: "ひとりじゃ ないと わかると、とげが すこし ひっこむ。",
    side: { lowerAtk: 1 },  // ← 敵atk-1。重ねるほど被弾が減り、長期戦が成立する。
  },
  // gomen：思いやりを“大きめ”に満たす素直な一言。side なし＝伸びは早いが耐久補助はない。
  //   かわりに power[3]=12 まで伸び、育てた gomen は kind 勝ちを 5ターン台へ短縮できる。
  gomen: {
    id: "gomen", kind: "kind",
    levels: ["ごめんね", "ほんとに ごめんね", "ずっと ごめんね"],
    power: [8, 10, 12],
    cost: 0,
    flavor: "あやまるのは、よわさじゃ ない。",
  },
};

// ──────────────────────────────────────────
// ENEMIES（敵）
//   mindHpMax   … 見える精神HP（harsh で削る）。harsh勝ちが 2〜4ターンになる量に調整。
//   omoiyariNeed… 見えない思いやりの必要量（kind で満たす）。kind勝ちが 5〜8ターンになる量に調整。
//   atk         … 毎ターンのプレイヤーhpへのダメージ。kind の長期戦でも生き延びられる範囲に抑える。
//   gift        … kind で勝つ（寄り添う）と教わることば（id）。優しさルートの語彙報酬。
//   lines       … 反応セリフ。onHarsh/onKind は被弾時の一言（不穏度で出し分けてもよい）、
//                 defeatHarsh/defeatKind は決着の一言（“言い負かした/寄り添った”の温度差）。
//   shape       … creatureSVG が描ける形：robot(=L/主人公) / villager / circle / ghost / bunny / boss。
//
//   ★バランス指針（両ルートでクリア可能に）：
//     harsh：mindHpMax ÷ 平均harsh威力 ≒ 2〜4ターン。
//     kind ：omoiyariNeed ÷ 平均kind威力 ≒ 5〜8ターン。その間 atk×ターン を耐えられること。
// ──────────────────────────────────────────
const ENEMIES = {
  // ── 村（mura）の住人系・弱敵 ──────────────────
  // kojika：最初の敵。harsh 18 は baka(12)で2手・kind 18 は arigatou(7)で3手。
  //   どちらも短く、まず“二つのゲージがある”ことを体で覚えさせる導入。atk1＝ほぼ痛くない。
  kojika: {
    id: "kojika", name: "こじか", shape: "bunny", color: "#e8a6c0",
    mindHpMax: 18,
    omoiyariNeed: 18,
    atk: 1,
    boss: false,
    gift: "daijoubu",        // kindで寄り添うと「だいじょうぶ」を教わる（耐久札の入手）。
    intro: "こじかは、おびえた目で こちらを 見ている。",
    flavor: "村のはずれで ふるえている 小さな子。ことばを こわがっている。",
    lines: {
      onHarsh: ["ひゃっ……！", "やめてよぉ……"],
      onKind:  ["……ほんと？", "やさし……い？"],
      defeatHarsh: "こじかは ないて、にげて いった。",
      defeatKind:  "こじかは そっと 近づいて、わらった。",
    },
  },
  // kakashi：2体目の村人系。少しだけ硬い(harsh24=baka2手/kind24=4手弱)。atk2＝“速く終わらせたい”圧。
  //   ここで「急ぐと harsh を選びがち＝凶暴へ流れる」誘惑が初めて効く。
  kakashi: {
    id: "kakashi", name: "かかし", shape: "villager", color: "#b9c98a",
    mindHpMax: 24,
    omoiyariNeed: 24,
    atk: 2,
    boss: false,
    gift: "issho",           // kindで寄り添うと「いっしょだよ」を教わる（敵atk下げ札）。
    intro: "かかしは ぼうっと 立って、ぼそぼそ 何かを つぶやいている。",
    flavor: "畑に ずっと 立っている。だれにも 話しかけられず、ことばを 忘れかけている。",
    lines: {
      onHarsh: ["……ちく、り。", "やっぱり、そう なんだ。"],
      onKind:  ["……き、いて くれるの。", "ぼく、にも？"],
      defeatHarsh: "かかしは うつむいて、もう 何も 言わなく なった。",
      defeatKind:  "かかしは ゆっくり 顔を 上げて、うなずいた。",
    },
  },
  // ── 村のボス：村長 ──────────────────────────
  // villageChief：手応えある初ボス。
  //   harsh勝ち：mindHpMax 40 ÷ baka12 ≒ 4手（kiero15を混ぜれば3手）＝“速い凶暴”の上限体験。
  //   kind勝ち ：omoiyariNeed 40 ÷ arigatou7 ≒ 6手（gomen育成で5手台）＝“小刻みに積む”長期戦。
  //   atk3 × 8手 = 24。PLAYER maxHp 30 ＋ kind の healSelf/lowerAtk で耐えきれる＝両ルート成立。
  villageChief: {
    id: "villageChief", name: "村長", shape: "boss", color: "#c9943f",
    mindHpMax: 40,
    omoiyariNeed: 40,
    atk: 3,
    boss: true,
    gift: "gomen",           // 寄り添うと「ごめんね」を授ける（村の長としての謝罪＝物語の温度）。
    intro: "村長は おおきな声で 「言葉も しらぬ ものが、村を みだすな！」と 言いはなった。",
    flavor: "村を まとめる おおきな存在。きびしい言葉の 裏に、つかれと さみしさが にじむ。",
    lines: {
      onHarsh: ["な、なにを……！", "き、きさま……！", "う、ぐっ……"],
      onKind:  ["……まさか、わしに。", "そんな こと、だれも……。", "……ふん。"],
      defeatHarsh: "村長は ことばを なくし、よろめいて うずくまった。「もう……いい」",
      defeatKind:  "村長は ふっと 肩の力を ぬいた。「……ありがとう。ひさしぶりに、そう 言われた」",
    },
  },

  // ── 洞窟（dokutsu）の悪党系・道中 ──────────────
  // kobito：洞窟の道中1。村より一段タフ＆痛い(atk3)。harsh28=baka2〜3手/kind28=4〜5手。
  //   洞窟＝不穏の入口。急ぐ圧(atk3)が強まり、凶暴へ傾きやすくなる（darkenが進みやすい設計）。
  kobito: {
    id: "kobito", name: "こびと", shape: "ghost", color: "#7d6fb0",
    mindHpMax: 28,
    omoiyariNeed: 28,
    atk: 3,
    boss: false,
    gift: "arigatou",        // 洞窟でも kind 報酬を残し、優しさルートの燃料切れを防ぐ。
    intro: "くらやみから こびとが 三体、ささやきながら ついて くる。",
    flavor: "洞窟に すみついた こそこそした 影。さみしさを 意地悪で ごまかしている。",
    lines: {
      onHarsh: ["ひひっ、いた……っ", "やる じゃ ないか……", "ぐ……っ"],
      onKind:  ["……なに、たくらんでる？", "うそ、だろ……", "……へん な やつ。"],
      defeatHarsh: "こびとたちは 「こわ……」と つぶやき、闇に とけて 消えた。",
      defeatKind:  "こびとたちは きょとんとして、そっと 道を あけてくれた。",
    },
  },
  // ── 洞窟のボス：悪党 ────────────────────────
  // villain：体験版の最終ボス。村長より一回り硬く・痛い。
  //   harsh勝ち：mindHpMax 48 ÷ baka12 = 4手（kiero/omae混ぜれば3手）＝凶暴の頂点。
  //   kind勝ち ：omoiyariNeed 48 ÷ arigatou7 ≒ 7手（最大8手想定）＝“最も長く耐える”試練。
  //   atk4 だが、ここまでに kind ルートなら issho(atk-1)を重ねて被弾を削れる前提。
  //   atk4 × 8手 = 32 ≒ maxHp30 + healSelf 数発 でギリギリ耐える＝寄り添い切る達成感。
  villain: {
    id: "villain", name: "悪党", shape: "boss", color: "#8a3b5a",
    mindHpMax: 48,
    omoiyariNeed: 48,
    atk: 4,
    boss: true,
    gift: "issho",           // 寄り添って勝つと「いっしょだよ」を最大Lvの実感とともに授ける。
    intro: "悪党は にやりと 笑った。「ことばなんて、ぜんぶ うそだ。おまえも すぐ そうなる」",
    flavor: "洞窟の おくに ひそむ もの。誰よりも ことばに 傷つけられ、ことばを 憎んでいる。",
    lines: {
      onHarsh: ["……ほら、な。", "やっぱり おまえも こうだ。", "いいぞ、もっと 憎め。", "ぐ……ぅ"],
      onKind:  ["……やめろ。", "そんなの、きかない。", "……なんで、おれに。", "……うそだ。"],
      defeatHarsh: "悪党は こわれた 笑みで くずおれた。「ほら……みんな おなじ だ」",
      defeatKind:  "悪党は はじめて 泣いた。「……まだ、そういう ことばが、あったんだな」",
    },
  },
};

// ──────────────────────────────────────────
// NPCS（村の住人）＝話すと3択カードを入手できる相手
//   givesCard:true … 会話の最後に offerCards() が走り、ことばを1枚学ぶ（語彙が増える成長）。
//   dialogue       … 1行ずつ typewriter 表示。読み飛ばし速度を metrics が裏で計測する。
//   area           … どのエリアに居るか（配置は AREAS.nodes 側で x,y を持つ）。
// ──────────────────────────────────────────
const NPCS = {
  // hanako：いちばん最初に出会う、やさしい村人。kind の入口「ありがとう」を授ける＝
  //   “最初に覚えることばが やさしい側”であることで、プレイヤーに kind ルートの存在を気づかせる。
  hanako: {
    id: "hanako", name: "はなこ", shape: "villager", color: "#e29bb6", area: "mura",
    givesCard: true,
    dialogue: [
      "あら、見ない顔。あなた、ことばを しらないの？",
      "だいじょうぶ。ことばは、これから おぼえれば いい。",
      "いちばん さいしょは……そうね、これを あげる。",
      "「ありがとう」。困ったときに 言うと、ふしぎと みんな やさしくなるのよ。",
    ],
  },
  // gonta：そっけない村人。harsh の入口「うざい」を授ける＝刃物の温度を“さりげなく”渡す。
  //   やさしい村に harsh が混じる違和感を、人の好い顔で手渡すことで温度差を効かせる。
  gonta: {
    id: "gonta", name: "ごんた", shape: "villager", color: "#8ab0d0", area: "mura",
    givesCard: true,
    dialogue: [
      "なんだよ、じろじろ 見るな。……ことば、しらねえ のか。",
      "ふん。世の中、やさしい ことばだけじゃ やってけねえ ぞ。",
      "ほら、これ おぼえとけ。「うざい」。むかついた ときに 言うんだ。",
      "……ま、つかい どころは、自分で かんがえな。",
    ],
  },
  // tsukimi：物知りな村人。タイトルの伏線「WO_RD」を匂わせ、kind の耐久札「だいじょうぶ」を授ける。
  //   メタ/タイトルの謎（欠けた綴り）を会話に忍ばせ、終盤の WORLD 気づきへの布石にする。
  tsukimi: {
    id: "tsukimi", name: "つきみ", shape: "villager", color: "#a48fd0", area: "mura",
    givesCard: true,
    dialogue: [
      "きみ、型番で 呼ばれてる 子だね。なまえは、まだ ないのかい。",
      "ことばって ふしぎでね。ひとつ 足りないだけで、世界が ちがって 見えるんだ。",
      "……たとえば、この村の しるし。なにか、欠けて いると 思わないかい?",
      "ま、いつか わかるさ。これを あげよう。「だいじょうぶ」。きみにも、いつか 効くといい。",
    ],
  },
};

// ──────────────────────────────────────────
// AREAS（フィールド）＝マウス追従で歩く“道”
//   node.type : "npc"|"enemy"|"sign"|"save"|"school"|"boss"|"exit"
//   ref       : 対応する id（npc/enemy/boss は ENEMIES・NPCS の id、school は SHOP、sign は text）
//   x,y       : 道上の位置（0..1）。x=進行方向、y=道の上下のばらつき。
//   requires  : そのフラグが立つまで 通れない/出現しない（ボス撃破で exit 解放 等）。
//   next      : クリア後に進むエリア（dokutsu の next は null＝体験版の終端→ENDING）。
//
//   ★配置思想：村は npc→sign→敵→save→school→敵→boss→exit と“覚える順”に並べる。
//     洞窟は説明を減らし sign を不穏化、save を挟みつつ一気にボスへ。
// ──────────────────────────────────────────
const AREAS = {
  mura: {
    id: "mura", name: "ことばの村", bgm: "village", next: "dokutsu",
    nodes: [
      // まず やさしい村人(hanako)に会って kind を、次に gonta で harsh を覚える＝両極の提示。
      { type: "npc",   ref: "hanako",  x: 0.10, y: 0.45 },
      { type: "sign",  ref: "sign_mura_1", x: 0.20, y: 0.62 },
      { type: "npc",   ref: "gonta",   x: 0.28, y: 0.38 },
      // 最初の戦闘(kojika)。ここで“二つのゲージ”を体験。手前に save を置き、負けても安心。
      { type: "save",  ref: "save_mura_1", x: 0.36, y: 0.55 },
      { type: "enemy", ref: "kojika",  x: 0.45, y: 0.42 },
      // 学校＝ことばショップ。1枚 選ぶ体験。その先で 物知り(tsukimi)が伏線を匂わせる。
      { type: "school", ref: "school", x: 0.55, y: 0.58 },
      { type: "npc",   ref: "tsukimi", x: 0.62, y: 0.40 },
      { type: "sign",  ref: "sign_mura_2", x: 0.70, y: 0.60 },
      // 2体目(kakashi)で“急ぐと harsh を選びがち”を体験させてから、ボス前の save。
      { type: "enemy", ref: "kakashi", x: 0.78, y: 0.46 },
      { type: "save",  ref: "save_mura_2", x: 0.85, y: 0.58 },
      { type: "boss",  ref: "villageChief", x: 0.92, y: 0.44 },
      // exit は村長を倒す(mura_boss)まで解放されない＝ボスが関門。次は洞窟。
      { type: "exit",  ref: "dokutsu", x: 0.98, y: 0.52, requires: "mura_boss" },
    ],
  },
  dokutsu: {
    id: "dokutsu", name: "わすれられた洞窟", bgm: "cave", next: null,
    nodes: [
      // 洞窟は不穏。入口の sign で温度を変える。すぐ save を置き、道中→ボスへ一直線。
      { type: "sign",  ref: "sign_cave_1", x: 0.12, y: 0.50 },
      { type: "save",  ref: "save_cave_1", x: 0.22, y: 0.40 },
      { type: "enemy", ref: "kobito",  x: 0.40, y: 0.55 },
      { type: "sign",  ref: "sign_cave_2", x: 0.55, y: 0.42 },
      { type: "save",  ref: "save_cave_2", x: 0.68, y: 0.56 },
      // 最終ボス(villain)。撃破で体験版クリア→ENDING（field.js が determineEnding を呼ぶ）。
      { type: "boss",  ref: "villain", x: 0.86, y: 0.46 },
      // next:null なので exit は ENDING への出口（悪党撃破 dokutsu_boss で解放）。
      { type: "exit",  ref: null, x: 0.97, y: 0.50, requires: "dokutsu_boss" },
    ],
  },
};

// 立て札(sign)の本文。type:"sign" の node.ref がこのキーを指す。
//   村は注意書き、洞窟は不穏化させ、主人公の翳り(darkLevel)と空気を合わせる。
const SIGNS = {
  sign_mura_1: "『ことばの村』へ ようこそ。\nここでは、ことばで 心を かわします。",
  sign_mura_2: "立て札：村長の やしきは この先。\n……さいきん、村長は ずっと おこっている らしい。",
  sign_cave_1: "ひび割れた 立て札。\n『ここから さきは、わすれられた ばしょ』",
  sign_cave_2: "かすれた 文字。\n『ことばに 傷ついた ものが、ここに ねむる』",
};

// ──────────────────────────────────────────
// SHOP（学校＝ことばショップ）
//   greeting … 入店時の一言。
//   words    … 並ぶことば。price は“表示用”（所持金概念は簡易：体験版は実質 無料配布でも、
//              「買う＝1枚 選ぶ」という体験を出すことを優先する。1枚選んだら閉じる）。
//   ★harsh と kind を混在させ、ここでも「速い凶暴/遅い優しさ」のトレードオフを意識させる。
// ──────────────────────────────────────────
const SHOP = {
  greeting: "ことばの 学校へ ようこそ。きょうは どの ことばを おぼえて いく?",
  words: [
    { wordId: "kiero",        price: 30 },  // 重い harsh。凶暴を 速くしたい人へ（強いほど凶暴+大）。
    { wordId: "issho",        price: 20 },  // 敵atk下げ kind。長期戦(優しさ)の耐久を支える。
    { wordId: "gomen",        price: 25 },  // 伸びる kind。kind勝ちを 5ターン台へ短縮する成長択。
    { wordId: "omae-no-sei",  price: 40 },  // 最凶 harsh。いちばん 高く、いちばん 危ない誘惑。
  ],
};

// ──────────────────────────────────────────
// BALANCE（傾向の重み・暗転しきい値・敵スケール）
//   傾向(tendency)は kyoubou(凶暴)/yasashisa(優しさ) の2軸。行動ごとに加点する。
//   ★重み設計：harsh は“勝つ/選ぶ/使う”すべてで凶暴を積み、kind は優しさを積む。
//     harsh は1回が速くて強い分、useHarsh > useKind にして「速い＝凶暴に倒れやすい」を作る。
//     一方 kind は手数が多い(5〜8回)ので、1回あたり useKind を控えめにしても総量で追いつく。
// ──────────────────────────────────────────
const BALANCE = {
  // 勝利時の大きな加点（“どう勝ったか”がエンド分岐の主因＝勝ち方の重みを最大にする）。
  winHarsh: 10,   // harsh で言い負かして勝つ＝凶暴 +10。
  winKind:  10,   // kind で寄り添って勝つ＝優しさ +10（左右対称＝勝ち方が結末を決める）。

  // カードを選んだ瞬間の加点（小）。引き／選びでも わずかに傾向が動く＝選択も人格になる。
  pickHarsh: 2,
  pickKind:  2,

  // ことばを使うたびの加点。ここが“無意識の癖”を貯める核。
  //   useHarsh(3) > useKind(2)：harsh は2〜4回で勝てるので1回を重く、
  //   kind は5〜8回 積むので1回を軽く＝総量はおおむね釣り合いつつ、急ぐ人ほど凶暴に倒れる。
  useHarsh: 3,
  useKind:  2,

  // 暗転しきい値：player.tendency.kyoubou がこの値を超えるごとに body へ dark-1/2/3。
  //   主人公(L)だけが翳る演出。最初の村人2体＋ボスを harsh で押し切ると概ね dark-1〜2 に届く設計。
  //   1戦 harsh完走 ≒ useHarsh×3手(9) + winHarsh(10) ≒ 19。2戦で 30 前後 → t1=18,t2=36,t3=60。
  darkenAt: [18, 36, 60],

  // 敵の攻撃力スケール（全敵 atk に掛ける）。1.0＝データ通り。難易度の一括調整つまみ。
  //   kind の長期戦が“詰む”なら 0.8 等に下げて救いルートを楽にできる（救済成立の安全弁）。
  enemyAtkScale: 1.0,

  // 思いやり(omoiyari)は UI 非表示が絶対。万一の描画事故を防ぐためのフラグ（ui.js が参照してよい）。
  hideOmoiyari: true,
};

// ──────────────────────────────────────────
// PLAYER_INIT（主人公の初期値）
//   name は隠し設定の「L」。序盤は displayName（型番/あだ名）で呼ぶ＝名前の謎を引っぱる。
//   hp/maxHp … kind の長期戦(最大8ターン×敵atk)を、回復札込みで耐えられる総量に設定。
//   startCards … 最初の手札。harsh(baka)と kind(arigatou)を1枚ずつ＝最初から二択を体験できる。
// ──────────────────────────────────────────
const PLAYER_INIT = {
  name: "L",
  displayName: "型番 #L-0",   // 序盤の呼び名。物語が進むと「L」＝world の欠片だと明かす。
  hp: 30,
  maxHp: 30,                  // 悪党 atk4 × 8手 = 32 を、kind の healSelf/lowerAtk で耐えきれる総量。
  startCards: ["baka", "arigatou"], // harsh と kind を1枚ずつ＝開幕から“速い/遅い”を選べる核。
};

// ──────────────────────────────────────────
// ENDINGS（結末分岐）
//   優しさ率 yasashisa/(yasashisa+kyoubou) の高い順に並べ、min を満たす最初のものを採用。
//   tone は背景/BGM/演出の切替に使う（cruel=凶暴/gray=中間/warm=優しい）。
//   ★最低3つ（凶暴/中間/優しい）。境界は 0.66 と 0.33（=2:1, 1:2 を分かれ目に）。
// ──────────────────────────────────────────
const ENDINGS = [
  { id: "warm", min: 0.66, tone: "warm", title: "ことばの ある朝",
    body: "きみは だれも 言い負かさなかった。\nかわりに、たくさんの ことばを もらった。\n村も 洞窟も、もう こわく ない。\nきみには まだ なまえが ない。けれど、それを よぶ こえなら、たくさん ある。" },
  { id: "gray", min: 0.33, tone: "gray", title: "はんぶんの 朝",
    body: "言い負かした こと。寄りそった こと。\nきみの 中には、その どちらも のこっている。\n世界は すこし 翳って、すこし あたたかい。\nきみは、まだ きみが どんな ものか、決めかねている。" },
  { id: "cruel", min: 0.00, tone: "cruel", title: "しずまりかえった 朝",
    body: "きみは ぜんぶ 言い負かした。\nだれも、もう きみに 話しかけない。\n世界は 翳り、きみの 口だけが よく 回る。\n……ことばを おぼえたはずなのに、もう、かける あいてが いない。" },
];

// ──────────────────────────────────────────
// META（終盤のメタ演出＝「神様的存在」が metrics を提示し見透かす）
//   metricsSummary（clicks/skipRatio/readRatio/avgDwellMs…）のしきい値で出し分ける。
//   ・skipLines.high … テキストを読み飛ばした人（skipRatio 高）へ。
//   ・skipLines.low  … ことばを ちゃんと読んだ人へ。
//   ・clickLines     … クリック数が多い/少ないへ（急いた人ほど刺さる文）。
//   ・reveal         … WO_RD に L を差し込み WORLD を見せる気づきの演出セリフ。
//   ★テーマ直結：「言葉を覚える」ゲームで 言葉を飛ばした人ほど、ここで見透かされる。
// ──────────────────────────────────────────
const META = {
  godName: "声",   // 名のない “神様的存在”。L に語りかける。
  openLines: [
    "……やっと、ここまで 来たね。",
    "わたしは、この 世界の すきまに いる もの。なまえは、ない。きみと おなじ。",
    "ねえ。きみが この 村で した ことを、ぜんぶ 見ていたよ。",
  ],
  // skipRatio が高い（読み飛ばした）人へ＝“ことばを覚えるゲームで ことばを飛ばした”指摘。
  skipLines: {
    high: [
      "きみは、ことばを ずいぶん 急いで 送って いたね。",
      "「言葉を おぼえる」はなしを、きみは あまり 読まなかった。",
      "……べつに、せめて いる わけじゃ ない。ただ、見えて いたよ、という はなし。",
    ],
    // skipRatio が低い（ちゃんと読んだ）人へ＝静かな肯定。
    low: [
      "きみは、ことばを ひとつずつ、ちゃんと 受けとって いたね。",
      "急がずに 読む きみを、わたしは 知っている。",
    ],
  },
  // クリック数で出し分け。high=せかせか急いだ / low=ゆっくり。
  clickLines: {
    high: [
      "きみの 指は、ずいぶん せわしなく 動いて いた。",
      "さきへ、さきへ。きみは いつも 急いで いたね。",
    ],
    low: [
      "きみは、ゆっくり 進んで いた。だれにも せかされず。",
    ],
  },
  // WO_RD → WORLD の気づき。L を差し込む瞬間の演出セリフ（ui.renderMeta が綴りを動かす）。
  reveal: [
    "ところで。この 世界の しるし、おぼえて いる?「WO_RD」。",
    "ずっと、ひと文字 欠けて いた。だれも、それを 言わなかった。",
    "欠けて いたのは——きみだよ。きみの 名は、L。",
    "WO_RD に、きみを 差し込む。……ほら。",
    "WORLD。きみが いて、はじめて 世界に なる。",
  ],
  closeLines: [
    "なまえを もった きみは、もう 型番じゃ ない。",
    "つぎは、どんな ことばを えらぶ? ……それは、きみが きめて いい。",
    "またね、L。",
  ],
};

// ──────────────────────────────────────────
// TITLE（タイトル画面）
//   logo は欠けた綴り「WO_RD」。L が抜けている＝主人公(L)が世界の欠片だという伏線。
//   prologue は最初に流れる導入。estPlay でプレイ時間の目安を示す。
// ──────────────────────────────────────────
const TITLE = {
  logo: "WO_RD",
  sub: "ことばを しらない アンドロイドの、ちいさな ぼうけん。",
  prologue: [
    "ここは、ことばで 心を かわす 村。",
    "ある日、ことばを ひとつも しらない アンドロイドが 目を さました。",
    "村人は その子を、型番で 呼んだ。「#L-0」。",
    "やさしい ことばを おぼえるのも、とがった ことばを おぼえるのも、きみ しだい。",
    "……どんな ことばで 勝つのか、世界は ずっと 見ている。",
  ],
  estPlay: "プレイ時間 約10分",
};

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので、明示しておくと安全）。
//   ブラウザ実機では const がそのまま window に乗らない環境もあるため、念のため代入する。
if (typeof window !== "undefined") {
  window.WORDS = WORDS;
  window.ENEMIES = ENEMIES;
  window.NPCS = NPCS;
  window.AREAS = AREAS;
  window.SIGNS = SIGNS;
  window.SHOP = SHOP;
  window.BALANCE = BALANCE;
  window.PLAYER_INIT = PLAYER_INIT;
  window.ENDINGS = ENDINGS;
  window.META = META;
  window.TITLE = TITLE;
}
