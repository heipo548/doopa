/* =========================================================================
   data.js — 全コンテンツ（キャラ・マップ・施策・イベント・エンディング・会話）
   ここを読めば「何が起きるゲームか」がだいたい分かる、を目指す。
   施策の effect() は実行時に呼ばれるので、その中で global の State を参照してOK
   （読み込み順は data → ... → state なので、定義時ではなく呼び出し時に解決される）。
   ========================================================================= */
const DATA = {};

/* ── キャラクター定義（sprites.js が顔・ドット絵を描くのに使う） ── */
DATA.chars = {
  maou:    { name: '魔王',         skin: '#7a5699', hair: '#221634', eye: '#ffd76a', horns: true,  cape: '#3a1a4a' },
  belze:   { name: 'ベルゼ',       skin: '#8a76a8', hair: '#15101f', eye: '#9ad4ff', glasses: true, cape: '#241a38' },
  pazuzu:  { name: 'パズズ',       skin: '#cf8f4a', hair: '#5a2f18', eye: '#ffffff', cape: '#b8472f' },
  ririmu:  { name: 'リリム',       skin: '#d3a4c8', hair: '#7a2f5a', eye: '#ff88bb', cape: '#5a2348' },
  ork:     { name: 'オーク看護長', skin: '#82a86a', hair: '#33421f', eye: '#ffffff', cape: '#cfe6d0' },
  shadow:  { name: 'シャドウ',     skin: '#403a58', hair: '#0f0e18', eye: '#6db5ff', cape: '#11101a', ninja: true },
  leon:    { name: '勇者レオン',   skin: '#e6b88e', hair: '#cca33a', eye: '#6db5ff', cape: '#3a6db5', hero: true },
  garud:   { name: '戦士ガルド',   skin: '#cea27c', hair: '#7a3a1a', eye: '#2a1a10', cape: '#8a5a2a', big: true },
  miria:   { name: '僧侶ミリア',   skin: '#f2d2ab', hair: '#caa6c8', eye: '#9ad4ff', cape: '#eef0f5' },
  noel:    { name: 'ノエル',       skin: '#ead0b6', hair: '#5a6aa8', eye: '#aa77ff', cape: '#39306a' },
  soldier: { name: '王国兵',       skin: '#dab48a', hair: '#aab', eye: '#222', cape: '#bcb6c8' },
  villager:{ name: '村人',         skin: '#e2bb95', hair: '#6a4a2a', eye: '#333', cape: '#7a8a5a' },
  child:   { name: '子ども',       skin: '#f0c69a', hair: '#3a2a1a', eye: '#333', cape: '#d98a6a' },
  narr:    { name: '', narr: true },
};

/* ── マップ：魔王城・1フロア。20x15タイル（16px）＝320x240 ──
   field.js が壁を敷き、部屋の内側と廊下・扉を彫る。座標はタイル単位。 */
DATA.map = {
  cols: 20, rows: 15, tile: 16,
  // 部屋（rx,ry=内側の左上タイル / rw,rh=内側サイズ）
  rooms: [
    { id: 'throne',  name: '玉座の間',   rx: 2,  ry: 2,  rw: 5, rh: 3, door: [4, 5],  floor: '#3a2a52' },
    { id: 'pr',      name: '広報室',     rx: 8,  ry: 2,  rw: 4, rh: 3, door: [9, 5],  floor: '#4a2f2f' },
    { id: 'hr',      name: '人事室',     rx: 13, ry: 2,  rw: 5, rh: 3, door: [15, 5], floor: '#4a3a26' },
    { id: 'welfare', name: '福祉室',     rx: 2,  ry: 10, rw: 5, rh: 3, door: [4, 9],  floor: '#284a2e' },
    { id: 'crystal', name: '水晶部屋',   rx: 8,  ry: 10, rw: 4, rh: 3, door: [9, 9],  floor: '#243a52' },
    { id: 'recon',   name: '諜報室',     rx: 13, ry: 10, rw: 5, rh: 3, door: [15, 9], floor: '#2a2740' },
  ],
  // 中央プラザ：横廊下 rows 6-8（cols 1-18）／縦廊下 cols 9-10（rows 5-9）
  corridorH: { x0: 1, x1: 18, y0: 6, y1: 8 },
  corridorV: { x0: 9, x1: 10, y0: 5, y1: 9 },
  start: [9, 7], // 魔王のスタート位置（中央プラザ）
  // 調べられるもの（NPC・水晶・掲示板）。tx,ty はタイル座標で、ここは通行不可になる。
  things: [
    { id: 'belze',   kind: 'npc',     char: 'belze',  tx: 4,  ty: 3,  room: 'throne',  label: 'ベルゼ（軍師）' },
    { id: 'pazuzu',  kind: 'dept',    char: 'pazuzu', tx: 9,  ty: 3,  room: 'pr',      dept: '広報室',  label: 'パズズ（広報）' },
    { id: 'ririmu',  kind: 'dept',    char: 'ririmu', tx: 15, ty: 3,  room: 'hr',      dept: '人事室',  label: 'リリム（人事）' },
    { id: 'ork',     kind: 'dept',    char: 'ork',    tx: 4,  ty: 11, room: 'welfare', dept: '福祉室',  label: 'オーク看護長（福祉）' },
    { id: 'shadow',  kind: 'dept',    char: 'shadow', tx: 15, ty: 11, room: 'recon',   dept: '諜報室',  label: 'シャドウ（諜報）' },
    { id: 'crystal', kind: 'crystal', char: null,     tx: 9,  ty: 11, room: 'crystal', label: '水晶玉（勇者を見る）' },
    { id: 'board',   kind: 'board',   char: null,     tx: 12, ty: 6,  room: null,      label: 'ニュース掲示板' },
  ],
};

/* ── 可視状態（3つ）：段階名と顔・色。数値は出さず、これだけ見せる ── */
DATA.states = {
  mayoi:  {
    label: '勇者の迷い', cls: 's-mayoi', icon: '🗡',
    stages: ['討伐一直線', '違和感', '迷い', '葛藤', '剣を置きそう'],
    faces:  ['angry', 'neutral', 'think', 'sad', 'falter'],
  },
  nakama: {
    label: '仲間の不満', cls: 's-nakama', icon: '🍻',
    stages: ['団結', '小さな不満', '温度差', '口論寸前', '解散寸前'],
    faces:  ['happy', 'neutral', 'cold', 'mad', 'split'],
  },
  seken:  {
    label: '世間の評判', cls: 's-seken', icon: '🏘',
    stages: ['極悪魔王軍', '警戒', '意外とまとも', '好意的', '支持拡大'],
    faces:  ['scared', 'wary', 'neutral', 'happy', 'cheer'],
  },
};

/* 段階の計算：0-100 のスコアを 5 段階へ。80 以上で「最大（＝勝利）」 */
DATA.stageOf = function (score) {
  if (score >= 80) return 4;       // 段階5（index 4）
  if (score >= 58) return 3;
  if (score >= 38) return 2;
  if (score >= 18) return 1;
  return 0;
};

/* ═════════════════════════════════════════════════════════════════════
   施策（9つ）。1ターンに1つだけ実行できる。
   - aim: 主な狙い（yuusha=迷い / nakama=不満 / seken=評判 / recon=下準備）
   - effect(): 可視メーターを動かし、隠しフラグを立てる（呼び出し時に State を参照）
   - result: 実行直後のドット演出（sprites.js の scene キー）と一言
   - talk: 水晶玉ごしの勇者パーティー会話（仕様書の「勇者側会話」を核に）
   - news: 掲示板の更新（任意）
   ═════════════════════════════════════════════════════════════════════ */
DATA.policies = [
  {
    id: 'white_company', dept: '広報室', aim: 'seken',
    title: '魔王軍ホワイト企業宣言',
    desc: '有給取得率・残業削減・福利厚生を公表。世間に「意外とまとも」を刷り込む。',
    risk: '勇者に「印象操作では？」と警戒されるかも',
    effect() {
      State.add('seken', 16);
      State.add('mayoi', 4);
      State.bump('kingdom_pr_risk', 6);
    },
    result: { scene: 'poster', cap: '村の掲示板に「魔王軍ホワイト企業宣言」のポスターが貼られた。' },
    talk: [
      { who: 'garud', text: '魔王軍、家賃補助あるらしいぞ。' },
      { who: 'leon',  text: '見るな。' },
      { who: 'garud', text: '見るだろ、家賃補助だぞ。' },
    ],
    news: '「魔王軍、福利厚生を公表。“ホワイト企業”を自称」',
  },
  {
    id: 'warrior_ad', dept: '人事室', aim: 'nakama',
    title: '戦士向け転職広告',
    desc: '戦士ガルドへ、魔王軍警備部の求人をぶつける。月給制・社宅あり・プロテイン支給。',
    risk: '勇者に警戒される',
    effect() {
      const boost = State.flag('recon_warrior') ? 8 : 0; // 諜報で不満を掴んでいれば強化
      State.add('nakama', 18 + boost);
      State.bump('warrior_pull', 1);
    },
    result: { scene: 'flyer', cap: '街道に落ちた求人チラシを、戦士ガルドが拾った。' },
    talk: [
      { who: 'garud', text: '月給制、社宅あり、プロテイン支給……' },
      { who: 'leon',  text: '捨てろ。' },
      { who: 'garud', text: 'せめて最後まで読ませろ。' },
    ],
    news: null,
  },
  {
    id: 'clinic', dept: '福祉室', aim: 'seken',
    title: '村に魔王軍クリニック開設',
    desc: '魔族医師による無料診療所を村に開く。世間の評判と、勇者の迷いに効く。',
    risk: '王国に「前線基地」と誤解される',
    effect() {
      State.add('seken', 14);
      State.add('mayoi', 10);
      State.bump('village_support', 12);
      State.bump('misunderstood', 1); // 王国の誤解報道イベントの呼び水
    },
    result: { scene: 'clinic', cap: '最初は誰も近づかない。だが夜、子どもを抱えた母親が診療所へ入っていった。' },
    talk: [
      { who: 'miria', text: '魔族の医師が、人間の子どもを助けていました。' },
      { who: 'leon',  text: '罠じゃないのか？' },
      { who: 'miria', text: '罠だとしても……あの子の熱は、下がりました。' },
    ],
    news: '王国、「魔王軍が村に新拠点を設置」と発表',
  },
  {
    id: 'recon_past', dept: '諜報室', aim: 'recon',
    title: '勇者の過去を調査',
    desc: '勇者がなぜ討伐にこだわるのかを探る。直接は効かないが、以後の勇者向け施策が強くなる。',
    risk: 'バレると警戒される',
    effect() {
      State.setFlag('recon_father', true);  // 謝罪会見・夜の独白・最終面談が解放/強化
      State.add('mayoi', 3);
    },
    result: { scene: 'spy', cap: '諜報員が勇者の故郷を訪れた。——勇者は「父に認められたい」という思いで旅を続けている。' },
    talk: [
      { who: 'leon',  text: '父さんなら、迷わず進めと言うだろうな。' },
      { who: 'miria', text: 'レオン様“ご自身”は、どう思っているのですか？' },
      { who: 'leon',  text: '……さあな。' },
    ],
    tag: '解放：謝罪会見・最終面談で「父の話」が使えるように',
    news: null,
  },
  {
    id: 'apology', dept: '広報室', aim: 'yuusha',
    title: '魔王、公開謝罪会見',
    desc: '先代魔王時代の侵略について、魔王自ら謝罪会見を行う。勇者本人の迷いに効く。',
    risk: '世間の評判は少し下がるかも',
    effect() {
      const boost = State.flag('recon_father') ? 14 : 0; // 過去を知った上での会見は刺さる
      State.add('mayoi', 16 + boost);
      State.add('seken', -4);
      State.bump('maou_rapport', 1);
    },
    result: { scene: 'press', cap: '魔王が会見台に立つ。記者のフラッシュが光る。「——先代の行いを、私は詫びる」' },
    talk: [
      { who: 'leon',  text: '魔王が……謝っている？' },
      { who: 'garud', text: '謝れる上司、貴重だぞ。' },
      { who: 'leon',  text: '上司として見るな。' },
    ],
    news: '「魔王、公開謝罪会見。先代の侵略行為を謝罪」',
  },
  {
    id: 'safety', dept: '福祉室', aim: 'seken',
    title: 'ダンジョン安全基準の導入',
    desc: 'ダンジョンの罠に注意看板を立て、安全基準を整える。世間の評判に効く。',
    risk: '勇者一行が、ダンジョンを楽に越えてしまう',
    effect() {
      State.add('seken', 12);
      State.add('mayoi', 4);
      State.bump('dungeon_safe', 1);
    },
    result: { scene: 'sign', cap: '落とし穴の前に「この先、落とし穴」の看板が立った。' },
    talk: [
      { who: 'leon',  text: '罠に……注意書きがある。' },
      { who: 'garud', text: '親切だな。' },
      { who: 'leon',  text: '親切な魔王城って何だよ。' },
    ],
    news: '「魔王軍、ダンジョンに安全看板を設置」',
  },
  {
    id: 'rebut', dept: '広報室', aim: 'seken',
    title: '王国の発表に反論する',
    desc: '「診療所は侵略拠点」という王国発表に、診療記録と村人の証言で反論する。',
    risk: '王国との対立が強まる',
    requires: 'misreport', // 王国の誤解報道イベント後に解放
    effect() {
      State.add('seken', 16);
      State.add('mayoi', 5);
      State.bump('kingdom_conflict', 1);
    },
    result: { scene: 'rebut', cap: '広報室が資料を掲示する。村人が掲示板の前で足を止めた。' },
    talk: [
      { who: 'miria', text: '診療所で治療を受けた村人の証言が、出ています。' },
      { who: 'leon',  text: '……王国の発表と、違うな。' },
      { who: 'garud', text: 'どっちかが嘘ついてるってことか？' },
    ],
    news: '「魔王軍、診療記録を公開。王国発表に真っ向反論」',
  },
  {
    id: 'orphan', dept: '福祉室', aim: 'nakama',
    title: '僧侶に孤児院見学を招待',
    desc: '魔族の孤児院に、僧侶ミリアを招く。仲間（僧侶）と勇者の迷いに効く。',
    risk: '教会の反発を招く',
    effect() {
      State.add('nakama', 12);
      State.add('mayoi', 9);
      State.setFlag('priest_shaken', true);
      State.bump('church_backlash', 8);
    },
    result: { scene: 'orphan', cap: '魔族の子どもたちが、僧侶ミリアに花を渡した。' },
    talk: [
      { who: 'miria', text: '魔族の子どもたちも、私たちと同じように笑うんですね。' },
      { who: 'leon',  text: '……当たり前だろ。' },
      { who: 'miria', text: 'その当たり前を、私は忘れていました。' },
    ],
    news: null,
  },
  {
    id: 'research', dept: '人事室', aim: 'nakama',
    title: '魔法使いに研究資料を送る',
    desc: '魔王軍研究所の魔導理論資料を、魔法使いノエルに届ける。仲間（魔法使い）に効く。',
    risk: '機密漏洩のリスク',
    effect() {
      const boost = State.flag('recon_warrior') ? 4 : 0;
      State.add('nakama', 16 + boost);
      State.setFlag('mage_hooked', true);
    },
    result: { scene: 'research', cap: '魔法使いノエルが、宿屋で資料を読みふけっている。' },
    talk: [
      { who: 'noel', text: 'この理論……王国アカデミーより、進んでる。' },
      { who: 'leon', text: 'ノエル。それ、たぶん機密だぞ。' },
      { who: 'noel', text: '無理。もう読んだ。' },
    ],
    news: null,
  },
];

/* 諜報室の追加施策（過去調査の後に出す“情報”系。recon フラグを足す） */
DATA.reconExtra = [
  {
    id: 'recon_warrior', dept: '諜報室', aim: 'recon',
    title: '戦士の不満を探る',
    desc: '戦士ガルドが何に不満なのかを掴む。人事室の施策が強くなる。',
    risk: 'バレると警戒される',
    effect() { State.setFlag('recon_warrior', true); State.add('nakama', 4); },
    result: { scene: 'spy', cap: '酒場の隅。戦士は給料と、誰にも褒められないことに、静かに不満を溜めていた。' },
    talk: [
      { who: 'garud', text: '……別に。文句なんてねえよ。' },
      { who: 'noel',  text: '（さっきから求人チラシ、握りしめてるけど。）' },
    ],
    tag: '強化：人事室の施策（転職広告ほか）',
    news: null,
  },
  {
    id: 'recon_kingdom', dept: '諜報室', aim: 'recon',
    title: '王国の不正資料を入手',
    desc: '王国広報の裏側を掴む。最終面談で「王国の嘘」を突けるようになる。',
    risk: 'きわどい橋。露見すれば評判が揺れる',
    effect() { State.setFlag('recon_kingdom', true); State.add('seken', 6); },
    result: { scene: 'spy', cap: '一枚の書類。王国は、診療所が無害だと“知った上で”侵略拠点と発表していた。' },
    talk: [
      { who: 'shadow', text: '……書類一枚。だが、これで充分だ。' },
      { who: 'shadow', text: '見られていた、とは。王国も、思っていまい。' },
    ],
    tag: '解放：最終面談で「王国の嘘」を突ける',
    news: null,
  },
];

/* ═════════════════════════════════════════════════════════════════════
   イベント（仕様書 §17）。毎ターン終わりに条件を見て1回だけ発火。
   ═════════════════════════════════════════════════════════════════════ */
DATA.events = [
  {
    id: 'misreport', once: true,
    // 仕様 §17-1：世間の評判が「意外とまとも」以上になると、王国が反応する
    cond: () => State.stage('seken') >= 2,
    run() {
      State.add('seken', -10);
      State.setFlag('misreport', true); // 反論施策が解放される
      State.bump('kingdom_conflict', 1);
    },
    scene: 'kingdom_poster',
    lines: [
      { who: 'narr',    text: '——王国が、声明を出した。' },
      { who: 'soldier', text: '「魔王軍は人間の村に施設を増やしている」' },
      { who: 'soldier', text: '「これは将来の侵攻拠点である可能性が高い」' },
      { who: 'narr',    text: '王国兵が、村の掲示板に反魔王軍ポスターを貼っていく。' },
      { who: 'belze',   text: '魔王様。善行が、また“侵略準備”と報じられました。' },
      { who: 'belze',   text: 'ですが——広報室に、反論の手が増えました。' },
    ],
    toast: '広報室に「王国の発表に反論する」が解放された',
  },
  {
    id: 'monologue', once: true,
    cond: () => State.stage('mayoi') >= 2,
    run() { State.setFlag('mayoi_open', true); State.add('mayoi', 6); }, // 以後、迷いが進みやすい
    scene: 'campfire',
    lines: [
      { who: 'narr', text: '夜。焚き火のそばで、勇者がひとり、口をひらいた。' },
      { who: 'leon', text: '俺は、魔王を倒せば何者かになれると思っていた。' },
      { who: 'leon', text: 'でも……本当に倒すべきものは、何なんだ？' },
      { who: 'narr', text: '炎が、勇者の横顔を揺らしている。' },
    ],
    toast: '勇者の迷いが、進みやすくなった',
  },
  {
    id: 'flyer_keep', once: true,
    cond: () => State.stage('nakama') >= 2,
    run() { State.setFlag('warrior_flyer', true); State.add('nakama', 6); }, // 人事施策が強化
    scene: 'campfire',
    lines: [
      { who: 'narr',  text: '戦士ガルドが、魔王軍の求人広告を——捨てずに、持っていた。' },
      { who: 'garud', text: 'いや、見るだけだ。見るだけなら、裏切りじゃない。' },
      { who: 'noel',  text: '（見るだけ、ね。）' },
    ],
    toast: '人事室の施策が強化された',
  },
];

/* ═════════════════════════════════════════════════════════════════════
   水晶玉ごしの“ふだんの”会話（直近に施策が無い時／観察フェーズの地の会話）。
   3つの可視状態の段階に応じて、空気が変わる。
   ═════════════════════════════════════════════════════════════════════ */
DATA.ambient = {
  mayoi: [
    [{ who: 'leon', text: '魔王城は、もうすぐだ。気を抜くな。' }],
    [{ who: 'leon', text: '……魔王軍ってのは、思っていたのと、少し違うのか？' }],
    [{ who: 'leon', text: '俺は、何のために剣を握ったんだったか。' }],
    [{ who: 'leon', text: '（剣の柄に手をかけ——止まる。）……いや。' }],
    [{ who: 'leon', text: 'この剣を、本当に振るっていいのか、俺は。' }],
  ],
  nakama: [
    [{ who: 'garud', text: '（4人、肩を並べて歩いている。）' }],
    [{ who: 'garud', text: '……なあ、休憩、まだか。' }, { who: 'noel', text: 'さっきしたでしょ。' }],
    [{ who: 'miria', text: '（僧侶と魔法使いが、勇者と少し離れて歩いている。）' }],
    [{ who: 'noel',  text: 'もう、勝手にすれば。' }, { who: 'garud', text: 'それはこっちの台詞だ。' }],
    [{ who: 'narr',  text: '隊列が、ばらばらになっている。誰も、口をきかない。' }],
  ],
  seken: [
    [{ who: 'villager', text: '（村人が、魔王軍のポスターを破り捨てた。）' }],
    [{ who: 'villager', text: '（魔族を見かけると、村人はそっと家へ逃げ込む。）' }],
    [{ who: 'villager', text: '（村人が、魔族の店主と短く言葉を交わしていた。）' }],
    [{ who: 'villager', text: '（村に、魔王軍の旗が一本、立っている。）' }],
    [{ who: 'soldier',  text: '（王国兵が、困った顔で掲示板を見ている。）' }],
  ],
};

/* ── ベルゼの状況ヒント（玉座で聞ける。可視状態を“言葉で”要約） ── */
DATA.belzeHint = function () {
  const lines = [];
  const m = State.stage('mayoi'), n = State.stage('nakama'), s = State.stage('seken');
  lines.push({ who: 'belze', text: `第${State.turn}週です。勇者まで、あと ${State.distance}。` });
  lines.push({ who: 'belze', text: `勇者の迷いは「${DATA.states.mayoi.stages[m]}」、仲間の不満は「${DATA.states.nakama.stages[n]}」、世間の評判は「${DATA.states.seken.stages[s]}」かと。` });
  // いちばん進んでいる軸を勧める
  const top = [['mayoi', m], ['nakama', n], ['seken', s]].sort((a, b) => b[1] - a[1])[0][0];
  const advice = {
    mayoi:  '勇者本人が揺れています。広報室の会見や、福祉の善行が刺さるでしょう。',
    nakama: '仲間に隙ができています。人事室で、待遇の差を突くのが効きます。',
    seken:  '世間が傾きかけています。福祉と広報で、評判を押し切れます。',
  }[top];
  lines.push({ who: 'belze', text: advice });
  return lines;
};

/* ═════════════════════════════════════════════════════════════════════
   エンディング（仕様書 §18）。A/B/C は可視状態が最大で即時、D/E は最終面談の結果。
   ═════════════════════════════════════════════════════════════════════ */
DATA.endings = {
  A: {
    badge: 'ENDING A', good: true, scene: 'end_retire',
    title: '勇者、退職',
    body:
      '勇者レオンは、魔王城の前で剣を置いた。\n\n' +
      '「俺は、魔王を倒したかったんじゃない。\n　誰かに認められたかっただけ、なのかもしれない」\n\n' +
      '魔王は言った。\n「なら、まず休め」\n\n' +
      '——後日。元勇者レオン、地元でパン屋を開業。\n魔王軍から、開店祝いの花輪が届いた。',
  },
  B: {
    badge: 'ENDING B', good: true, scene: 'end_disband',
    title: 'パーティー解散',
    body:
      '勇者パーティーは、魔王城に着く前に解散した。\n\n' +
      '・戦士ガルドは、魔王軍警備部へ転職。\n' +
      '・僧侶ミリアは、魔族医療支援団体へ。\n' +
      '・魔法使いノエルは、魔王軍研究所へ。\n' +
      '・勇者は、ひとりで旅を続ける。\n　——だが、魔王城へは、向かわなかった。\n\n' +
      '後日。人事室リリムのメモ：\n「優秀な3名、無事ご採用。\n　勇者は……ご縁がなかったということで」',
  },
  C: {
    badge: 'ENDING C', good: true, scene: 'end_treaty',
    title: '共存条約',
    body:
      '王国が、討伐命令を撤回した。\n\n' +
      'ニュース：\n「魔王軍の支援活動、侵略ではなく地域協力と判明」\n「王国、勇者派遣の見直しを発表」\n\n' +
      '——玉座にて。\nベルゼ「魔王様。討伐命令が、撤回されました」\n魔王「そうか。……で、次の議題は」\nベルゼ「診療所の、回復魔力の補充です」\n\n' +
      '魔族の村を守る結界は、今日も静かに灯っている。',
  },
  D: {
    badge: 'ENDING D', good: true, scene: 'end_meeting',
    title: '最終面談 成功',
    body:
      '勇者は、ゆっくりと剣を鞘に納めた。\n\n' +
      '「……一度、ちゃんと、話を聞かせてくれ」\n\n' +
      '魔王「ああ。長くなるぞ。茶でも出させよう」\nベルゼ「会議室、押さえてあります」\n\n' +
      '——倒すのではなく、話す。\nそれが、この魔王の戦い方だった。',
  },
  E: {
    badge: 'BAD END', good: false, scene: 'end_fight',
    title: '討伐続行',
    body:
      '勇者が剣を抜いた。魔王の和平の腕輪が、光る。\n\n' +
      'ベルゼ「魔王様、反撃はできません」\n魔王「知っている」\n' +
      'ベルゼ「では——法務部を呼びます」\n\n' +
      'ナレ：勇者レオン、和解協議のため出頭。担当——魔王軍法務部。\n\n' +
      '（画面暗転。やがて、大量の書類を捲る音だけが、延々と響いている。）',
  },
};

/* ── 最終面談（D/E分岐）の説得選択肢。フラグが立っていると“刺さる”。 ── */
DATA.meetingOptions = [
  { id: 'father', label: '「お前は、父のために剣を握ったのか？」', hint: '勇者の過去を調べてあると刺さる',
    needFlag: 'recon_father', why: '父コンプを突く' },
  { id: 'kingdom', label: '「王国は、診療所が無害だと知っていた」', hint: '王国の不正資料があると刺さる',
    needFlag: 'recon_kingdom', why: '王国の嘘を突く' },
  { id: 'witness', label: '「村人の証言を、聞いてくれ」', hint: '世間の評判が高いと刺さる',
    needScore: ['seken', 50], why: '世論を背に説得' },
  { id: 'party', label: '「お前の仲間は、もう戦いたくないそうだ」', hint: '仲間の不満が高いと刺さる',
    needScore: ['nakama', 50], why: '仲間の離反を突く' },
  { id: 'sword', label: '「とにかく、かかってこい」', hint: '……魔王なのに？', bad: true, why: '腕輪が光る' },
];
