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
    { id: 'cabinet', kind: 'cabinet', char: null,     tx: 11, ty: 11, room: 'crystal', label: '資料棚（集めた書類）' },
    { id: 'board',   kind: 'board',   char: null,     tx: 12, ty: 6,  room: null,      label: 'ニュース掲示板' },
  ],
};

/* ── 可視状態（3つ）：段階名と顔・色。数値は出さず、これだけ見せる ── */
DATA.states = {
  mayoi:  {
    label: '勇者の迷い', cls: 's-mayoi', icon: '🗡',
    // 段階が上がるほど勇者は揺らぐ。最初は「迷いゼロ＝まっすぐ討伐に来る」状態。
    stages: ['迷いゼロ', '違和感', '迷いはじめ', '葛藤', '剣を置きそう'],
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
   施策（Ver.3.0：結果分岐つき）。1ターンに1つだけ。同じ手は二度打てない。
   - aim/preview: 狙い・効きそう・危なそう（数値は出さない）
   - confirm: 実行前に担当NPCが言う「最後の一言」（§14）
   - evaluate(): success / fail / setup / mixed のどれになるかを現在地・王国警戒・
     フラグで判定（無ければ success）
   - outcomes[res]: apply()で状態を動かし、scene/cap=ドット演出、talk=水晶会話、
     notify=状態変化通知、news=掲示板カード
   ═════════════════════════════════════════════════════════════════════ */
DATA.policies = [
  {
    id: 'white_company', dept: '広報室', aim: 'seken',
    title: '魔王軍ホワイト企業宣言',
    desc: '有給取得率・残業削減・福利厚生を公表。世間に「意外とまとも」を刷り込む。',
    risk: '勇者に「印象操作では？」と警戒されるかも',
    stamp: '開示承認',  // §2：承認印の文言
    when: { good: '善行の実績がある時／戦士が待遇に揺れている時', bad: '王国の警戒が高い時（“煙幕”扱いされる）' }, // §3
    fear: { who: 'pazuzu', text: '善行は、黙っていても伝わりません。でも、喋りすぎると“やらせ”になります。' }, // §3
    preview: { aim: '世間を味方につける', effective: '世間、戦士', risky: '王国警戒が高いと“やらせ”扱い' },
    confirm: [
      { who: 'pazuzu', text: '善行は黙っていても伝わりません。でも、喋りすぎると怪しまれます。' },
      { who: 'pazuzu', text: '……出します？　いきますか。' },
    ],
    evaluate() { return State.get('kingdomAlert') >= 3 ? 'mixed' : 'success'; },
    outcomes: {
      success: {
        apply() { State.add('seken', 18); State.add('mayoi', 4); },
        scene: 'poster', cap: '村の掲示板に「魔王軍ホワイト企業宣言」のポスターが貼られた。',
        talk: [
          { who: 'garud', text: '魔王軍、家賃補助あるらしいぞ。' },
          { who: 'leon', text: '見るな。' },
          { who: 'garud', text: '見るだろ、家賃補助だぞ。' },
        ],
        notify: '戦士は、待遇の話に耳を傾けている',
        news: { label: '冒険者界隈', head: '魔王軍の福利厚生が話題', body: '“ホワイト企業”自称に、待遇欄だけ妙に読まれている。' },
      },
      mixed: {
        apply() { State.add('seken', 8); State.bump('kingdomAlert', 1); },
        scene: 'poster', cap: '宣言は出た。だが王国は「都合のいい数字だ」と冷ややかだ。',
        talk: [
          { who: 'leon', text: '魔王軍が、やけに良いことばかり言っている。' },
          { who: 'noel', text: '……逆に怪しい、ってこと？' },
        ],
        notify: '世間は半信半疑。王国の警戒が少し上がった',
        news: { label: '王国発表', head: '「魔王軍の自己宣伝に注意」', body: '王国、善行アピールを“侵略の煙幕”と論評。' },
      },
    },
  },
  {
    id: 'warrior_ad', dept: '人事室', aim: 'nakama',
    title: '戦士向け転職広告',
    desc: '戦士ガルドへ、魔王軍警備部の求人をぶつける。月給制・社宅あり・プロテイン支給。',
    risk: '団結している相手に出すと、ただの引き抜き宣戦布告',
    stamp: '採用強化承認',
    when: { good: '戦士が待遇に不満を漏らした後（街道以降）', bad: '団結している序盤（ただの引き抜きに見える）' },
    fear: { who: 'ririmu', text: '不満がある人には、救い。不満がない人には、ただの攻撃よ。' },
    preview: { aim: '仲間から崩す', effective: '戦士ガルド', risky: '勇者に引き抜きと見られる' },
    confirm: [
      { who: 'ririmu', text: '団結している相手に出せば、敵対行為です。' },
      { who: 'ririmu', text: '不満が出ている相手に出せば——救いの手。さあ、どちらに見えるかしら。' },
    ],
    // §1/§6：最後のひと手——「どう届けるか」。やさしく届けるか、したたかに届けるか。
    touch: {
      prompt: [
        { who: 'ririmu', text: '森の街道。戦士ガルドが、疲れて座り込んでいます。' },
        { who: 'ririmu', text: 'この求人チラシ——どう、届けましょうか。' },
      ],
      scene: 'flyer',
      choices: [
        { id: 'roadside', label: '道端に自然に落とす', hint: '拾いやすい・勇者にバレにくい・効果は中',
          apply() { State.add('nakama', 2); State.setFlag('warriorKeptFlyer', true); },
          note: '戦士は、自分の足で拾った',
          talk: [{ who: 'garud', text: '（誰も見てないよな……）' }] },
        { id: 'innboard', label: '宿屋の掲示板に貼る', hint: '冒険者界隈に広がる・王国に“分断工作”と見られる',
          apply() { State.add('nakama', 4); State.add('seken', 2); State.bump('kingdomAlert', 1); },
          note: '求人は街道じゅうに広まった（王国は“分断工作”と）',
          talk: [{ who: 'noel', text: '宿屋に魔王軍の求人……堂々としすぎでしょ。' }] },
        { id: 'inbag', label: '荷物にこっそり入れる', hint: '確実に届く・バレると勇者の警戒が大きく上がる',
          apply() { State.add('nakama', 6); State.setFlag('warriorKeptFlyer', true); State.setFlag('recruitSneaked', true); if (State.flag('heroWaryOfArmy')) { State.add('mayoi', -2); State.bump('kingdomAlert', 1); } },
          note: '戦士の荷物に、求人が滑り込んだ（バレたら、ただでは済まない）',
          talk: [{ who: 'garud', text: '……荷物に、見覚えのない紙が入ってる。' }, { who: 'garud', text: '（読むだけ。読むだけだぞ。）' }] },
      ],
    },
    // 旅が進む（街道以降）か、戦士の不満を掴んでいれば刺さる。序盤の団結相手には早い。
    evaluate() {
      if (State.flag('recon_warrior') || State.flag('warriorComplainedAboutPay') || State.turn >= 3) return 'success';
      return State.stage('nakama') === 0 ? 'fail' : 'success';
    },
    outcomes: {
      success: {
        apply() { const b = State.flag('recon_warrior') ? 8 : 0; State.add('nakama', 20 + b); State.setFlag('warriorKeptFlyer', true); State.setFlag('warriorSawRecruit', true); },
        doc: 'recruit_flyer',
        scene: 'flyer', cap: '街道に落ちた求人チラシを、戦士ガルドが拾った。そして——捨てなかった。',
        talk: [
          { who: 'garud', text: '月給制、社宅あり、プロテイン支給……' },
          { who: 'leon', text: '何を読んでいる。' },
          { who: 'garud', text: '罠だ。罠の内容を確認してから捨てる。' },
        ],
        notify: '戦士は、求人広告を捨てなかった',
        news: { label: '冒険者界隈', head: '戦士ガルド、求人票を所持か', body: '“見るだけ”との本人談。だが、あれは半分応募である。' },
      },
      fail: {
        apply() { State.add('nakama', 4); State.setFlag('warriorSawRecruit', true); State.setFlag('heroWaryOfArmy', true); },
        scene: 'flyer_fail', cap: 'チラシを、勇者が先に拾ってしまった。',
        talk: [
          { who: 'leon', text: '魔王軍警備部、採用強化中……？　魔王軍は、仲間を引き抜くつもりだ。' },
          { who: 'garud', text: 'いや、まあ、待遇欄だけなら——' },
          { who: 'leon', text: '読むな。' },
        ],
        notify: '勇者は、魔王軍への警戒を強めた',
        news: { label: '冒険者界隈', head: '勇者一行、魔王軍の接触を警戒', body: '「仲間を狙われている」との声。団結はむしろ強まった。' },
      },
    },
  },
  {
    id: 'clinic', dept: '福祉室', aim: 'seken',
    title: '村に魔王軍クリニック開設',
    desc: '魔族医師による無料診療所を村に開く。世間の評判と、勇者の迷いに効く。',
    risk: '王国の警戒が高いと「前線基地」と誤解される',
    stamp: '救済承認',
    when: { good: '村にいる序盤（村人に直接届く）', bad: '王国の警戒が高い／誤解報道の後（前線基地にされる）' },
    fear: { who: 'ork', text: '助けることは、できます。問題は——どう、見られるか、です。' },
    preview: { aim: '世間を味方につける', effective: '村人、僧侶', risky: '王国に拠点扱いされる' },
    confirm: [
      { who: 'ork', text: '村人は、怖がるでしょう。' },
      { who: 'ork', text: 'それでも、病人は出ます。扉を開けておく意味は、あります。' },
    ],
    // §1：最後のひと手——夜、診療所の前で立ち止まる母親を、どう迎えるか。
    touch: {
      prompt: [
        { who: 'ork', text: '夜です。子どもを抱えた母親が、診療所の前まで来ました。' },
        { who: 'ork', text: 'ですが——魔王軍の旗を見て、立ち止まっています。どう、迎えますか。' },
      ],
      scene: 'clinic',
      choices: [
        { id: 'flag_up', label: '旗を出したまま迎える', hint: '助けたのは魔王軍だと伝わる・怖がられ拠点扱いされやすい',
          apply() { State.add('seken', 4); State.bump('kingdomAlert', 1); State.setFlag('clinicFlagUp', true); },
          cap: '魔王軍の旗の下、扉が開く。母親は一瞬ためらい——それでも、子どもを抱いて入った。',
          note: '魔王軍が助けたと、はっきり伝わった（王国の警戒は少し上がった）',
          talk: [{ who: 'leon', text: '魔王軍の旗の、診療所か。……堂々と、しすぎてる。' }] },
        { id: 'flag_down', label: '旗を下げて迎える', hint: '母親は入りやすい・あとで“正体を隠した”と言われるリスク',
          apply() { State.add('mayoi', 4); State.bump('kingdomAlert', -1); State.setFlag('clinicFlagDown', true); },
          cap: '旗を下ろした診療所に、母親はためらわず入っていった。',
          note: '母親は、迷わず中へ入った（旗を隠したことは、いつか話に出るかもしれない）',
          talk: [{ who: 'miria', text: '旗のない診療所……でも、中にいたのは、魔族の医師でした。' }] },
        { id: 'light_only', label: '入口の明かりだけつけて待つ', hint: '押しつけがましくない・僧侶に刺さる・広がりは遅い',
          apply() { State.add('mayoi', 6); State.setFlag('clinicLightOnly', true); State.setFlag('priestDoubtsChurch', true); },
          cap: '看板も旗もない。ただ、入口の明かりだけが、ぽつんと灯っていた。',
          note: '押しつけない灯りに、僧侶ミリアが足を止めた',
          talk: [{ who: 'miria', text: 'あの灯りは……誰かを、待っているんでしょうか。' }] },
      ],
    },
    // 王国警戒が高い／既に誤解報道済みだと、善行が“前線基地”に切り取られる。
    evaluate() { return (State.get('kingdomAlert') >= 3 || State.flag('kingdomMisreported')) ? 'fail' : 'success'; },
    outcomes: {
      success: {
        apply() { State.add('seken', 16); State.add('mayoi', 12); State.setFlag('clinicBuilt', true); State.setFlag('priestSawClinic', true); State.setFlag('heroTouchedByClinic', true); State.bump('kingdomAlert', 1); },
        doc: ['clinic_record', 'villager_voice'],
        scene: 'clinic', cap: '最初は誰も近づかない。だが夜、子どもを抱えた母親が診療所へ入っていった。',
        talk: [
          { who: 'miria', text: '魔族の医師が、人間の子どもを助けていました。' },
          { who: 'leon', text: '罠じゃないのか？' },
          { who: 'miria', text: '罠だとしても……あの子の熱は、下がりました。' },
        ],
        notify: '僧侶は、魔族への見方を少し変えた',
        news: { label: '村人の声', head: '魔族の医師に助けられた子どもが回復', body: '「礼は小さな会釈だけ。それで十分だと言われた」' },
      },
      fail: {
        apply() { State.add('seken', 2); State.bump('kingdomAlert', 2); State.setFlag('clinicMisreported', true); State.setFlag('kingdomMisreported', true); },
        doc: 'kingdom_news',
        scene: 'clinic_fail', cap: '完成した診療所の前に、王国兵が立った。「村内拠点として、報告する」',
        talk: [
          { who: 'leon', text: 'また魔王軍の施設が増えたらしい。' },
          { who: 'miria', text: 'でも……診療所だと、聞きました。' },
          { who: 'garud', text: '診療所なのか基地なのか、どっちなんだ。' },
        ],
        notify: '王国の警戒が高まった（善行が“前線基地”にされた）',
        news: { label: '王国発表', head: '魔王軍が村に新拠点を設置', body: '王国は侵略準備の可能性を指摘。前線基地化への懸念を表明。' },
      },
    },
  },
  {
    id: 'recon_past', dept: '諜報室', aim: 'recon',
    title: '勇者の過去を調査',
    desc: '勇者がなぜ討伐にこだわるのかを探る。直接は効かないが、最後に効く。',
    risk: 'バレると警戒される',
    stamp: '内偵承認',
    when: { good: '謝罪会見・最終面談の“前”に仕込む', bad: '今すぐ大きな成果は出ない（音がするのは最後）' },
    fear: { who: 'shadow', text: '……今は、静かだ。音がするのは、最後だ。' },
    preview: { aim: '下準備（仕込み）', effective: '最終面談・謝罪会見が強化', risky: 'バレると警戒' },
    confirm: [
      { who: 'shadow', text: '……表に出る数字は、動かない。' },
      { who: 'shadow', text: 'だが、人の内側は動く。……行くか。' },
    ],
    outcomes: {
      setup: {
        apply() { State.setFlag('recon_father', true); State.setFlag('heroPastKnown', true); State.add('mayoi', 4); },
        doc: 'hero_past',
        scene: 'spy', cap: '勇者の故郷。壁に古い木剣。村人いわく——「レオンは、父に認められたくて剣を取ったんだ」',
        talk: [
          { who: 'leon', text: '父さんなら、迷わず進めと言うだろうな。' },
          { who: 'miria', text: 'レオン様“ご自身”は、どう思っているのですか？' },
          { who: 'leon', text: '……さあな。' },
        ],
        notify: '最終面談で使える情報を得た（勇者は父の背中を見ている）',
        news: { label: '魔王軍内部', head: '諜報室、勇者の身辺を静かに調査', body: '「剣より遅い。だが、剣が届く前に心へ届くこともある」' },
      },
    },
    tag: '仕込み：謝罪会見が成功し、最終面談で「父の話」が解放',
  },
  {
    id: 'apology', dept: '広報室', aim: 'yuusha',
    title: '魔王、公開謝罪会見',
    desc: '先代魔王時代の侵略について、魔王自ら謝罪会見を行う。勇者本人の迷いに効く。',
    risk: '過去を掘り返されると、しどろもどろで炎上する',
    stamp: '謝罪承認',
    when: { good: '善行の実績がある時／勇者の過去を調べた後', bad: '行動の前に、初手で謝る時（口だけに見える）' },
    fear: { who: 'pazuzu', text: '謝罪は、強いです。ですが、行動の前に謝ると——だいたい、燃えます。' },
    preview: { aim: '勇者本人を揺らす', effective: '勇者、世間', risky: '過去の悪行を掘り返される' },
    confirm: [
      { who: 'pazuzu', text: '謝るなら、逃げ道は作らない方がいいです。' },
      { who: 'pazuzu', text: '魔王様、“えー”は少なめでお願いします。……いきますか。' },
    ],
    // §1：最後のひと手——会見の締めを、どう言うか。
    touch: {
      prompt: [
        { who: 'pazuzu', text: '会見台です。最後に——どう、締めますか。' },
      ],
      scene: 'press',
      choices: [
        { id: 'past', label: '先代の罪を、現魔王として謝る', hint: '勇者本人に刺さる・記者に責任を追及されやすい',
          apply() { State.add('mayoi', 6); State.add('seken', -2); State.setFlag('apologyOwned', true); },
          note: '勇者レオンに、まっすぐ届いた（記者の追及も、まっすぐ来た）',
          talk: [{ who: 'leon', text: '先代の罪を、自分の罪として……謝るのか。' }] },
        { id: 'reform', label: '今の魔王軍の改革を説明する', hint: '世間に伝わる・言い訳っぽく見えるリスク',
          apply() { State.add('seken', 6); },
          note: '世間には伝わった（少し言い訳がましく聞こえた者もいた）',
          talk: [{ who: 'noel', text: '“改革”って言葉、便利すぎて、逆に信じにくい。' }] },
        { id: 'compensate', label: '被害者への補償を約束する', hint: '誠実に見える・魔王軍の予算が苦しくなる',
          apply() { State.add('mayoi', 4); State.add('seken', 4); State.bump('budget', -1); },
          note: '誠実さは伝わった（ベルゼが予算表を見て、静かに青ざめた）',
          talk: [{ who: 'miria', text: '謝るだけでなく、返すと言いました。……できるのでしょうか。' }] },
      ],
    },
    // 勇者の過去を調べ“覚悟の上”で謝れば刺さる。準備なしだと記者に詰められ炎上。
    evaluate() { return State.flag('recon_father') ? 'success' : 'fail'; },
    outcomes: {
      success: {
        apply() { State.add('mayoi', 30); State.add('seken', -2); State.setFlag('heroSawApology', true); State.setFlag('heroRespectsMaou', true); State.setFlag('apologyAired', true); },
        doc: 'apology_script',
        scene: 'press', cap: '魔王が会見台に立つ。「先代が傷つけた人々に、現魔王として詫びる。過去は消せない。だから今で返す」',
        talk: [
          { who: 'leon', text: '魔王が……謝っている？' },
          { who: 'garud', text: '謝れる上司、貴重だぞ。' },
          { who: 'leon', text: '上司として見るな。……でも、言葉は逃げていなかった。' },
        ],
        notify: '勇者は、魔王を少しだけ見直した',
        news: { label: '村人の声', head: '「謝れる魔王」という見出しが独り歩き', body: 'こちらが用意したものではない。向こうから出た言葉である。' },
      },
      fail: {
        apply() { State.add('mayoi', 8); State.add('seken', -6); State.setFlag('heroSawApology', true); State.setFlag('apologyFlopped', true); State.bump('kingdomAlert', 1); },
        doc: 'apology_script',
        scene: 'press_fail', cap: '記者「責任転嫁ですか？」　魔王「違う、そうではなく——」　フラッシュが、容赦なく光る。',
        talk: [
          { who: 'garud', text: 'ひどい会見だったな。しどろもどろで。' },
          { who: 'leon', text: 'ああ。……でも、逃げずに最後まで立っていた。' },
          { who: 'miria', text: 'レオン様、最後まで……ご覧になっていましたね。' },
        ],
        notify: '勇者は、会見を最後まで見ていた（少しだけ残った）',
        news: { label: '王国発表', head: '「魔王、謝罪会見でしどろもどろ」', body: '“魔王、責任転嫁”との見出し。広報室は頭を抱えている。' },
      },
    },
  },
  {
    id: 'safety', dept: '福祉室', aim: 'seken',
    title: 'ダンジョン安全基準の導入',
    desc: 'ダンジョンの罠に注意看板を立て、安全基準を整える。世間の評判に効く。',
    risk: '勇者一行が、ダンジョンを楽に越えてしまう',
    stamp: '安全第一',
    when: { good: 'ダンジョン入口まで勇者が来た頃（現場を見せられる）', bad: '評判は上がるが、勇者の足も軽くなる' },
    fear: { who: 'ork', text: '親切は、効きます。ただ——勇者の、足も軽くなります。' },
    preview: { aim: '世間を味方につける', effective: '世間、勇者', risky: '勇者の道中が楽になる' },
    confirm: [
      { who: 'ork', text: '落とし穴には、柵です。' },
      { who: 'ork', text: '……魔王城の発言とは思えませんが。やりますか。' },
    ],
    outcomes: {
      success: {
        apply() { State.add('seken', 14); State.add('mayoi', 6); State.bump('dungeon_safe', 1); State.setFlag('safetyDone', true); },
        doc: 'safety_standard',
        scene: 'sign', cap: 'ゴブリン作業員が落とし穴に柵をつけ、スライムが「この先、落とし穴」の看板を運ぶ。',
        talk: [
          { who: 'leon', text: '罠に……注意書きがある。' },
          { who: 'garud', text: '親切だな。' },
          { who: 'leon', text: '親切な魔王城って何だよ。' },
        ],
        notify: '世間の評判は上がった。だが、勇者の到着が少し近づいた',
        news: { label: '村人の声', head: '魔王軍、ダンジョンに安全看板を設置', body: '「あの落とし穴、ずっと危なかったんだ」と冒険者にも好評。' },
      },
    },
  },
  {
    id: 'rebut', dept: '広報室', aim: 'seken',
    title: '王国の発表に反論する',
    desc: '「診療所は侵略拠点」という王国発表に、診療記録と村人の証言で反論する。',
    risk: '証拠が足りないと、ただ世間を混乱させるだけ',
    requires: 'misreport',
    stamp: '事実確認済',
    when: { good: '資料棚に〈診療記録＋村人の証言〉か〈王国の不正資料〉がある時', bad: '証拠が手元にない時（感情だけでは混乱を呼ぶ）' },
    fear: { who: 'pazuzu', text: '証拠があれば、勝てます。なければ——ただ、世間を混乱させるだけ。' },
    preview: { aim: '世間を味方につける（誤解を解く）', effective: '世間、王国警戒↓', risky: '証拠不足だと逆効果' },
    confirm: [
      { who: 'pazuzu', text: '証拠で殴ります。合法的に。' },
      { who: 'pazuzu', text: '……ちゃんと、材料ありますよね？　いきますよ。' },
    ],
    // §8：資料棚に証拠が揃っていれば“証拠で殴れる”。王国の不正資料、または診療記録＋村人証言。
    // 不正資料が無くても評判が十分高ければ押し切れる。手札ゼロだと証拠不足で混乱（fail）。
    evaluate() {
      const evidence = State.hasDoc('kingdom_dossier') || (State.hasDoc('clinic_record') && State.hasDoc('villager_voice'));
      return (evidence || State.flag('recon_kingdom') || State.stage('seken') >= 3) ? 'success' : 'fail';
    },
    outcomes: {
      success: {
        apply() { State.add('seken', 18); State.add('mayoi', 5); State.setFlag('rebuttalSucceeded', true); State.setFlag('heroDoubtsKingdom', true); State.bump('kingdomAlert', -2); },
        scene: 'rebut', cap: '王国ポスターの横に、診療記録と村人証言が並ぶ。「患者数23名、うち子ども8名」',
        talk: [
          { who: 'miria', text: '診療記録と、村人の証言が出ています。' },
          { who: 'leon', text: '……王国の発表と、違うな。' },
          { who: 'garud', text: 'どっちかが嘘ついてるってことか？' },
        ],
        notify: '王国の発表に疑いが生まれた（王国の警戒が下がった）',
        news: { label: '村人の声', head: '「うちの子、あそこで助かったんだ」', body: '掲示を読み比べた村人から、王国発表への疑問の声。' },
      },
      fail: {
        apply() { State.add('seken', -6); State.bump('kingdomAlert', 1); },
        scene: 'rebut_fail', cap: '反論は始めた。だが証拠が足りない。王国は追加ポスターで応じた——「魔王軍、証拠なき反論」',
        talk: [
          { who: 'leon', text: '魔王軍も王国も、言っていることが違う。' },
          { who: 'miria', text: '何を……信じればいいのでしょう。' },
        ],
        notify: '世間はさらに混乱した（証拠が足りなかった）',
        news: { label: '王国発表', head: '「魔王軍、証拠なき反論」', body: '王国は強気の追加声明。世間はどちらも信じきれずにいる。' },
      },
    },
  },
  {
    id: 'orphan', dept: '福祉室', aim: 'nakama',
    title: '僧侶に孤児院見学を招待',
    desc: '魔族の孤児院に、僧侶ミリアを招く。仲間（僧侶）と勇者の迷いに効く。',
    risk: '教会の反発を招く',
    stamp: '招待承認',
    when: { good: '勇者一行が教会都市にいる頃（僧侶に届きやすい）', bad: '教会の目が強い（“危険な思想施設”と批判される）' },
    fear: { who: 'ork', text: '届くなら、深い。ですが教会は——黙って、いません。' },
    preview: { aim: '仲間から崩す（僧侶）', effective: '僧侶ミリア、勇者', risky: '教会が“洗脳施設”と批判' },
    confirm: [
      { who: 'ork', text: '僧侶様には、届くかもしれません。' },
      { who: 'ork', text: 'ですが教会からは、強く反発されるでしょう。……お招きしますか。' },
    ],
    // §6：やさしい招き方／したたかな招き方。
    touch: {
      prompt: [
        { who: 'ork', text: 'ミリア様の、お招きの仕方ですが。' },
      ],
      scene: 'orphan',
      choices: [
        { id: 'honest', label: '本人に「見学しませんか」と伝える', hint: '信頼が残る・断られる可能性（やさしい）',
          apply() { State.add('mayoi', 2); State.setFlag('orphanHonest', true); },
          note: '正面から招いた。ミリアは、少し迷ってから頷いた',
          talk: [{ who: 'miria', text: '招かれて、行きました。……自分の意思で。' }] },
        { id: 'coincidence', label: '偶然通りかかったように見せる', hint: '強く心が動く・演出と気づくと反発（したたか）',
          apply() { State.add('nakama', 4); State.setFlag('orphanStaged', true); },
          note: '“偶然”を、ミリアはまだ知らない',
          talk: [{ who: 'miria', text: 'たまたま通りかかって……でも、あの子たちの笑顔は、本物でした。' }] },
      ],
    },
    outcomes: {
      success: {
        apply() { State.add('nakama', 14); State.add('mayoi', 12); State.setFlag('priest_shaken', true); State.setFlag('priestVisitedOrphanage', true); State.setFlag('priestDoubtsChurch', true); State.bump('church_backlash', 8); },
        doc: 'church_statement',
        scene: 'orphan', cap: '魔族の子どもたちが、僧侶ミリアに花を渡した。ミリアは、目を合わせていた。',
        talk: [
          { who: 'miria', text: '魔族の子どもたちも、私たちと同じように笑うんですね。' },
          { who: 'leon', text: '……当たり前だろ。' },
          { who: 'miria', text: 'その当たり前を、私は忘れていました。' },
        ],
        notify: '僧侶は、討伐の意味を疑い始めた',
        news: { label: '教会声明', head: '教会、魔族孤児院を“危険な思想施設”と批判', body: 'だが見学した僧侶ミリアは、教会都市で足を止めたという。' },
      },
    },
  },
  {
    id: 'research', dept: '人事室', aim: 'nakama',
    title: '魔法使いに研究資料を送る',
    desc: '魔王軍研究所の魔導理論資料を、魔法使いノエルに届ける。仲間（魔法使い）に効く。',
    risk: '機密漏洩のリスク。怪しすぎると勇者に警戒される',
    stamp: '提供承認',
    when: { good: '勇者がまだ魔王軍を強く警戒していない時', bad: '勇者の警戒が高い時（“資料攻勢”と見られる）' },
    fear: { who: 'ririmu', text: '研究環境が上、というのは事実。でも、早すぎる接触は——ただ、怪しいだけ。' },
    preview: { aim: '仲間から崩す（魔法使い）', effective: '魔法使いノエル', risky: '勇者に接触を警戒される' },
    confirm: [
      { who: 'ririmu', text: '研究環境だけで言えば、魔王軍の方が上。それは、事実なの。' },
      { who: 'ririmu', text: '……届けます？　あの子、たぶん抗えないわよ。' },
    ],
    evaluate() { return State.flag('heroWaryOfArmy') ? 'mixed' : 'success'; },
    outcomes: {
      success: {
        apply() { const b = State.flag('recon_warrior') ? 4 : 0; State.add('nakama', 18 + b); State.setFlag('mageReceivedResearch', true); State.setFlag('mageInterestedInResearch', true); },
        scene: 'research', cap: '魔法使いノエルが、宿屋で資料を読みふけっている。止まらない。',
        talk: [
          { who: 'noel', text: 'この理論……王国アカデミーより、進んでる。' },
          { who: 'leon', text: 'ノエル。それ、たぶん機密だぞ。' },
          { who: 'noel', text: '無理。もう読んだ。研究環境だけで言えば、魔王軍の方が上。' },
        ],
        notify: '魔法使いは、旅より研究に心が傾いている',
        news: { label: '冒険者界隈', head: '魔法使いノエル、夜通し何かを読み込む', body: '「敵かどうかと、美しいかどうかは別」とは本人の弁。' },
      },
      mixed: {
        apply() { State.add('nakama', 8); State.setFlag('mageReceivedResearch', true); },
        scene: 'research', cap: '資料は届いた。だが勇者が、横から覗き込んだ。',
        talk: [
          { who: 'leon', text: '魔王軍から資料が届くなんて、怪しすぎる。' },
          { who: 'noel', text: '怪しいけど、内容は本物。' },
          { who: 'leon', text: 'そこが一番怪しい。' },
        ],
        notify: '魔法使いは惹かれたが、勇者は接触を警戒した',
        news: { label: '冒険者界隈', head: '勇者一行に、魔王軍“接触”の噂', body: '「資料攻勢では」との見方。だが中身は本物だという。' },
      },
    },
  },
];

/* 諜報室の追加施策（過去調査の後に出す“情報”系。仕込み＝最後に効く） */
DATA.reconExtra = [
  {
    id: 'recon_warrior', dept: '諜報室', aim: 'recon',
    title: '戦士の不満を探る',
    desc: '戦士ガルドが何に不満なのかを掴む。人事室の施策が強くなる。',
    risk: 'バレると警戒される',
    stamp: '内偵承認',
    when: { good: '人事室の手を打つ“前”に仕込む', bad: 'これ単体では仲間は崩れない（仕込み）' },
    fear: { who: 'shadow', text: '……掴めば、人事の手が、鋭くなる。' },
    preview: { aim: '下準備（仕込み）', effective: '人事室の施策が強化', risky: 'バレると警戒' },
    confirm: [{ who: 'shadow', text: '……戦士の本音。掴んでくる。' }],
    outcomes: {
      setup: {
        apply() { State.setFlag('recon_warrior', true); State.setFlag('warriorComplainedAboutPay', true); State.add('nakama', 4); },
        scene: 'spy', cap: '酒場の隅。戦士は給料と、誰にも褒められないことに、静かに不満を溜めていた。',
        talk: [
          { who: 'garud', text: '……別に。文句なんてねえよ。' },
          { who: 'noel', text: '（さっきから求人チラシ、握りしめてるけど。）' },
        ],
        notify: '人事室の施策が、戦士に深く刺さるようになった',
        news: { label: '魔王軍内部', head: '人事室、警備部の受け入れ枠を確保', body: '「待遇は、剣より鋭い」とは人事リリムの弁。' },
      },
    },
    tag: '強化：人事室の施策（転職広告ほか）',
  },
  {
    id: 'recon_kingdom', dept: '諜報室', aim: 'recon',
    title: '王国の不正資料を入手',
    desc: '王国広報の裏側を掴む。反論が“証拠で殴れる”ようになり、最終面談でも効く。',
    risk: 'きわどい橋。露見すれば評判が揺れる',
    stamp: '内偵承認',
    when: { good: '反論や最終面談の“前”に仕込む（最後に効く）', bad: 'きわどい橋。露見すれば評判が揺れる' },
    fear: { who: 'shadow', text: '……きわどい橋だ。渡れば、最後に効く。' },
    preview: { aim: '下準備（仕込み）', effective: '反論成功・最終面談', risky: 'きわどい橋' },
    confirm: [{ who: 'shadow', text: '……王国は、嘘をつく時だけ書類が丁寧だ。取ってくる。' }],
    outcomes: {
      setup: {
        apply() { State.setFlag('recon_kingdom', true); State.add('seken', 6); },
        doc: 'kingdom_dossier',
        scene: 'spy', cap: '一枚の書類。王国は、診療所が無害だと“知った上で”侵略拠点と発表していた。',
        talk: [
          { who: 'shadow', text: '……書類一枚。だが、これで充分だ。' },
          { who: 'shadow', text: '見られていた、とは。王国も、思っていまい。' },
        ],
        notify: '反論が“証拠で殴れる”ようになった（最終面談でも使える）',
        news: { label: '魔王軍内部', head: '広報室、王国報道への反論資料を準備中', body: '福祉室は診療記録の公開を提案。手札が、揃いつつある。' },
      },
    },
    tag: '解放：反論の成功・最終面談で「王国の嘘」を突ける',
  },
];

/* ═════════════════════════════════════════════════════════════════════
   イベント（仕様書 §17）。毎ターン終わりに条件を見て1回だけ発火。
   ═════════════════════════════════════════════════════════════════════ */
DATA.events = [
  {
    id: 'misreport', once: true,
    // §17-1／§12：評判が「意外とまとも」以上＋第3週以降に、王国が反応する（“善行は誤解される”の学習フェーズに寄せる）
    cond: () => State.stage('seken') >= 2 && State.turn >= 3,
    run() {
      State.add('seken', -10);
      State.setFlag('misreport', true); // 反論施策が解放される
      State.setFlag('kingdomMisreported', true);
      State.bump('kingdomAlert', 2); // 王国の警戒が一段上がる
      State.addDoc('kingdom_news'); // §8：王国新聞の切り抜きが資料棚に入る（反論の材料になる）
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
    run() { State.setFlag('mayoi_open', true); State.add('mayoi', 8); }, // 以後、迷いが進みやすい
    scene: 'monologue',
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
    scene: 'flyer_keep',
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

/* ── 勇者の現在地（週で進行）と、王国の警戒（裏ステート） ── */
DATA.locations = {
  startVillage:     { name: '始まりの村',     belze: ['勇者たちはまだ村の近くです。村人の反応を直接見せる施策なら、届きやすいでしょう。', 'ただ、仲間割れを狙うには少し早い。まだ“勇者一行”としてまとまっています。'] },
  forestRoad:       { name: '森の街道',       belze: ['勇者たちは街道に入りました。旅の疲れが、出る頃です。', 'こういう時、人は理念より生活の話をします。待遇や将来不安が、刺さるかも。'] },
  churchCity:       { name: '教会都市',       belze: ['勇者たちは教会都市に到着。僧侶ミリアには、届きやすい場所です。', 'ですが教会の目もあります。福祉施策は効きますが、反発も大きいでしょう。'] },
  dungeonGate:      { name: 'ダンジョン入口', belze: ['勇者たちはダンジョン入口まで。ここからは、魔王軍の現場を直接見られます。', '安全基準や魔族の暮らしを見せれば、勇者の思い込みに傷をつけられるかも。'] },
  demonCastleFront: { name: '魔王城前',       belze: ['勇者はもう城の前です。新しい善行を積む時間は、ありません。', 'これまで集めた材料で、勇者本人と向き合うしかありません。'] },
};
DATA.locationOrder = ['startVillage', 'forestRoad', 'churchCity', 'dungeonGate', 'demonCastleFront'];
DATA.kingdomAlert = {
  names: ['静観', '疑い', '警戒', '反撃', '非常事態'],
  belze: [
    '王国はまだ大きく動いていません。支援活動を見せるなら、今のうちです。',
    '王国がこちらを疑い始めています。施策そのものより、“見せ方”が重要になります。',
    '王国は、善行を“侵略準備”として扱うつもりです。新しい施設は、都合よく切り取られます。',
    '王国が反撃に出ました。善行だけでは足りません。誤解を解く“証拠”が要ります。',
    '王国は勇者を急がせています。雑な広報より、勇者本人に届く言葉を。',
  ],
};

/* ── ベルゼの週開始セリフ（§5：現在地・王国警戒・前週結果・終盤で変化。答えは言いすぎない） ── */
DATA.belzeHint = function () {
  const lines = [];
  const loc = State.location(), al = State.alert();
  lines.push({ who: 'belze', text: `第${State.turn}週。勇者は——${DATA.locations[loc].name}。城まで、あと ${State.distance}。` });
  // §11：今週の空気（週ごとに変わる）。週題が現在地名と同じ週は、地名の二度言いを避けてタイトルを省く
  const mood = DATA.mood(State.turn);
  if (mood) {
    const sameName = mood.title === DATA.locations[loc].name;
    lines.push({ who: 'belze', text: sameName ? `今週は——${mood.air}` : `今週は——「${mood.title}」。${mood.air}` });
  }
  // 前週の結果コメント（§5-3）
  const rc = {
    success: '前週の施策は、効いています。勇者たちの会話にも、確かな変化が。',
    mixed:   '成果は出ました。しかし、火種も残りました。王国は“意図”ではなく“見出し”で動きます。',
    fail:    '魔王様……王国に、利用されました。善行でも、順番を間違えると悪事に見せられます。',
    setup:   '今週は大きな変化に見えないかもしれません。ですが、その情報は——最後に効きます。',
  }[State.lastResult];
  if (rc) lines.push({ who: 'belze', text: rc });
  // 王国警戒（§5-2）
  lines.push({ who: 'belze', text: `王国の警戒は「${DATA.kingdomAlert.names[al]}」。${DATA.kingdomAlert.belze[al]}` });
  // 現在地ヒント（§5-1。1行に絞る）
  lines.push({ who: 'belze', text: DATA.locations[loc].belze[0] });
  // §12：3段階の学び（週帯で変わる一言。答えは言いすぎない）
  lines.push({ who: 'belze', text: DATA.learnHint(State.turn) });
  // 終盤の空気
  if (State.turn >= 9) lines.push({ who: 'belze', text: '勇者は、もう目の前。新しい手を打つより、これまでの材料で向き合う時です。' });
  return lines;
};

/* ── 水晶での「次の一手ヒント」（現在地ベース。答えは断定しない／§7-1） ── */
DATA.crystalHint = function () {
  const loc = State.location();
  const m = State.stage('mayoi'), n = State.stage('nakama'), s = State.stage('seken');
  // いちばん動いている軸＋現在地で、ふわっと示す
  const top = [['mayoi', m], ['nakama', n], ['seken', s]].sort((a, b) => b[1] - a[1])[0][0];
  const byTop = {
    mayoi:  '勇者本人が、揺れている。会見や善行の“現場”が、いま効きそうだ。',
    nakama: '仲間に、隙がある。待遇や研究——“生活”の話が刺さるかもしれない。',
    seken:  '世間が、傾きかけている。あと一押し、福祉か広報で押し切れそうだ。',
  };
  const byLoc = {
    startVillage: '（村にいる今なら、村人に直接届く施策が通りやすい。）',
    forestRoad:   '（旅の疲れが出る街道。戦士の本音が、漏れ始めている。）',
    churchCity:   '（教会都市。僧侶に届くが、教会の反発も覚悟がいる。）',
    dungeonGate:  '（ダンジョン前。魔王軍の“現場”を見せる好機だ。）',
    demonCastleFront: '（もう城の前。勇者本人に届く言葉だけが、残っている。）',
  };
  return [{ who: 'narr', text: byTop[top] }, { who: 'narr', text: byLoc[loc] }];
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
  F: {
    badge: 'TRUE? END', good: true, scene: 'end_hire',
    title: '勇者、転職',
    body:
      '魔王は、討伐に来た勇者に——内定を出した。\n\n' +
      '勇者「いや、俺は魔王を倒しに……」\n' +
      '魔王「初年度は研修期間だ。剣は、支給する」\n' +
      '戦士「レオン、ここ家賃補助あるぞ」\n' +
      '魔法使い「研究環境、王国アカデミーより上」\n' +
      '僧侶「……みんな、もう決めているのですね」\n\n' +
      '——後日。魔王軍に、新部署「対人間 渉外課」が発足。\n課長：元勇者レオン。\n初仕事は、次に来る勇者の、面談だという。',
  },
};

/* ── 最終面談（§19）。それまでの選択・集めた情報・キャラの状態で、選べる言葉が変わる。
   need() を満たした選択肢だけが解放され、選ぶと ending へ。bracelet は常時（＝弱いが基本D）、
   sword は常時（＝討伐続行E）。 ── */
DATA.meetingOptions = [
  {
    id: 'father', ending: 'A', label: '「お前は——誰に、認められたかった？」', hint: '勇者の過去を調べてあると刺さる',
    need: () => State.flag('recon_father') || State.hasDoc('hero_past'),
    win: [
      { who: 'leon', text: '……父さんは、関係ない。これは、俺が……俺が、決めることだ。' },
      { who: 'leon', text: '（剣を握る手が、ゆっくりと、ほどけていく。）' },
    ],
  },
  {
    id: 'clinic_memory', ending: 'A', label: '「あの村で助かった子どもの話を、覚えているか？」', hint: '診療記録（資料棚）があると話せる',
    need: () => State.hasDoc('clinic_record'),
    win: [
      { who: 'maou', text: 'お前が斬ろうとしている診療所で、ひと冬に23人が助かった。うち、子どもが8人だ。' },
      { who: 'leon', text: '……その子たちは、今も、そこにいるのか。' },
      { who: 'maou', text: 'いる。お前が来なければ、明日も開いている。' },
      { who: 'leon', text: '（剣を持つ手から、力が、抜けていく。）……少し、考えさせてくれ。' },
    ],
  },
  {
    id: 'party', ending: 'B', label: '「お前の仲間は、まだ戦いたがっているのか？」', hint: '仲間が離れていると刺さる',
    need: () => State.score('nakama') >= 46 && (State.flag('warriorKeptFlyer') || State.flag('mageReceivedResearch') || State.flag('priestDoubtsChurch')),
    win: [
      { who: 'garud', text: '……レオン。俺たちはもう、戦いたくねえんだ。' },
      { who: 'leon', text: '……そう、か。' },
    ],
  },
  {
    id: 'evidence', ending: 'C', label: '「王国の発表と、村人の証言。どちらを、見る？」', hint: '王国の誤解を解いてあると刺さる',
    need: () => State.flag('rebuttalSucceeded') || State.flag('recon_kingdom') || State.hasDoc('kingdom_dossier'),
    win: [
      { who: 'leon', text: '王国が……知っていて、嘘を。……確かめさせてくれ。それまで、剣は抜かない。' },
    ],
  },
  {
    id: 'hire', ending: 'F', label: '「——お前を、雇いたい」', hint: '勇者が揺れ・評判が高く・仲間も傾いていると', special: true,
    need: () => State.score('mayoi') >= 46 && State.score('seken') >= 46 && (State.flag('warriorKeptFlyer') || State.flag('mageReceivedResearch')),
    win: [
      { who: 'maou', text: '勇者よ。……退職後の、身の振り方は決めているか。' },
      { who: 'leon', text: 'は？' },
      { who: 'maou', text: '魔王軍は、人手が足りん。福利厚生は——見ての通りだ。' },
    ],
  },
  {
    id: 'bracelet', label: '「私は、お前を攻撃できない」', hint: 'いつでも言える。だが、それだけでは弱い',
    need: () => true,
    // bracelet 単体：何かしら積み上げがあれば D、まったく無ければ §19-4 の失敗→E
    resolve: () => State.engaged() ? 'D' : 'E',
    win: [
      { who: 'maou', text: 'この腕輪がある限り、私はお前を傷つけられない。だから——話すしかない。' },
      { who: 'leon', text: '……一度、ちゃんと、話を聞かせてくれ。' },
    ],
  },
  { id: 'sword', ending: 'E', label: '「とにかく、かかってこい」', hint: '……魔王なのに？', bad: true },
];

/* ═════════════════════════════════════════════════════════════════════
   §8：資料棚にたまる書類。施策の結果として手に入り、反論・最終面談で効く。
   card：UI が1枚のカードとして表示する（横長テキストにしない）。
   ═════════════════════════════════════════════════════════════════════ */
DATA.documents = {
  clinic_record:    { label: '診療記録', icon: '🩺', card: { stat: '患者数 23名 ／ うち子ども 8名 ／ 夜間診療あり', note: 'オーク看護長のメモ：「名前は伏せる。助かった事実だけ、残す」' } },
  villager_voice:   { label: '村人の証言', icon: '🏘', card: { stat: '「うちの子、あそこで助かったんだ」', note: '「礼は、小さな会釈だけでよかった、と言われた」' } },
  kingdom_news:     { label: '王国新聞の切り抜き', icon: '📰', card: { stat: '見出し：「魔王軍、村に新拠点」', note: '付箋：「“拠点”の正体は診療所。写真は、載せていない」' } },
  recruit_flyer:    { label: '求人票', icon: '📋', card: { stat: '魔王軍 警備部・採用強化中', note: '月給制／社宅あり／プロテイン支給。戦士の手に渡った一枚。' } },
  hero_past:        { label: '勇者の過去調査報告', icon: '🗡', card: { stat: '故郷の壁に、古い木剣。', note: '村人いわく——「レオンは、父に認められたくて剣を取った」' } },
  apology_script:   { label: '謝罪会見原稿', icon: '🎤', card: { stat: '「過去は消せない。だから、今で返す」', note: 'パズズの赤入れ：「“えー”は全部、消しました」' } },
  safety_standard:  { label: 'ダンジョン安全基準書', icon: '🚧', card: { stat: '第3層・落とし穴：柵 設置済／点検：週次', note: 'オークのメモ：「設置より、点検。事故ゼロ、更新中」' } },
  church_statement: { label: '教会声明', icon: '✝', card: { stat: '「魔族孤児院を“危険な思想施設”と断ず」', note: '裏に小さく：「見学した僧侶は、足を止めた」' } },
  kingdom_dossier:  { label: '王国の不正資料', icon: '📂', card: { stat: '王国は、診療所が無害だと“知った上で”侵略拠点と発表していた。', note: 'シャドウ：「嘘をつく時だけ、書類が丁寧だ」' } },
};
// 所持している資料を、定義順でカード配列にして返す（資料棚の表示用）
DATA.docCards = function () {
  return Object.keys(DATA.documents).filter(id => State.hasDoc(id))
    .map(id => ({ id, label: DATA.documents[id].label, icon: DATA.documents[id].icon, card: DATA.documents[id].card }));
};

/* ═════════════════════════════════════════════════════════════════════
   §9/§10：城の小物（調べると一言）。
   ・無条件のもの（マグカップ・コピー機・標語）＝寄り道の楽しみ／週で中身が変わる
   ・cond つきのもの＝施策の結果で“部屋に残る変化”（環境で語る）
   look() は調べたときに流す会話 [{who,text}, ...] を返す。
   ═════════════════════════════════════════════════════════════════════ */
DATA.props = [
  // ── 無条件の小物（§10） ──
  { id: 'mug', tx: 6, ty: 2, room: 'throne', label: '魔王のマグカップ', icon: 'mug',
    look() {
      const t = State.turn;
      if (State.alert() >= 3) return [{ who: 'narr', text: '魔王のマグカップ。中身は、すっかり冷めている。' }];
      if (t >= 10) return [{ who: 'narr', text: '魔王のマグカップ。空っぽだ。今日は、飲む暇もなかったらしい。' }];
      if (t >= 5)  return [{ who: 'narr', text: '魔王のマグカップ。コーヒーに、胃薬が溶かしてある。' }, { who: 'belze', text: '……魔王様。それ、本日3杯目です。' }];
      if (t >= 3)  return [{ who: 'narr', text: '魔王のマグカップ。濃いめのブラックコーヒー。' }];
      return [{ who: 'narr', text: '魔王のマグカップ。淹れたてのブラックコーヒー。湯気が、立っている。' }];
    } },
  { id: 'copier', tx: 13, ty: 2, room: 'hr', label: 'スライムコピー機', icon: 'copier',
    look() {
      if (State.turn % 3 === 0) return [{ who: 'ririmu', text: 'また詰まりました。待遇欄だけ、大量に刷られています。' }];
      return [{ who: 'narr', text: 'スライム製のコピー機。求人票を、ぺっ、ぺっ、と吐き出している。' }];
    } },
  { id: 'safety_poster', tx: 6, ty: 10, room: 'welfare', label: 'ダンジョン安全ポスター', icon: 'poster',
    look() {
      const s = ['落とし穴、落ちる前に、柵。', 'トゲ床は、設置より点検。', '勇者も、通る道です。', 'その魔法陣、本当に必要ですか。'];
      return [{ who: 'narr', text: '今週のダンジョン安全標語：「' + s[State.turn % s.length] + '」' }];
    } },
  { id: 'slogan_board', tx: 6, ty: 7, room: null, label: '今日の魔王軍標語', icon: 'slogan',
    look() {
      const s = ['力で勝てぬなら、制度で勝つ。', '誤解は、放置すると育つ。', '優しさにも、添付資料を。', '退職は、敗北ではない。', '残業より、結界。'];
      return [{ who: 'narr', text: '廊下の掲示板。今日の魔王軍標語：「' + s[State.turn % s.length] + '」' }];
    } },
  // ── 施策の結果で“部屋に残る変化”（§9）。cond が true の週だけ現れる ──
  { id: 'welfare_flowers', tx: 2, ty: 12, room: 'welfare', label: '机の上の花', icon: 'flower', cond: () => State.flag('clinicBuilt'),
    look() { return [{ who: 'narr', text: 'オーク看護長の机に、小さな花が置かれている。添えられた、紙きれ——' }, { who: 'narr', text: '「名前は、書けません。でも、昨日は、ありがとうございました」' }]; } },
  { id: 'pr_storyboard', tx: 8, ty: 2, room: 'pr', label: '散らばった会見原稿', icon: 'papers', cond: () => State.flag('apologyFlopped'),
    look() { return [{ who: 'narr', text: '広報室の床に、会見の原稿が散らばっている。パズズが、机に突っ伏している。' }, { who: 'narr', text: '壁の殴り書き——「次は、想定問答を作る」' }]; } },
  { id: 'pr_clip', tx: 11, ty: 2, room: 'pr', label: '壁の切り抜き', icon: 'clip', cond: () => State.flag('apologyAired'),
    look() { return [{ who: 'narr', text: '広報室の壁に、新聞の切り抜きが貼ってある。' }, { who: 'pazuzu', text: '「謝れる魔王」。……この見出し、向こうから出たんですよ。額に、入れたいくらい。' }]; } },
  { id: 'hr_apps', tx: 17, ty: 2, room: 'hr', label: '積まれた応募書類', icon: 'papers', cond: () => State.flag('warriorKeptFlyer'),
    look() { return [{ who: 'narr', text: '人事室に、応募書類が積み上がっている。プロテインの箱も、いくつか。' }, { who: 'ririmu', text: '求人票の「社宅あり」だけ、赤丸で囲まれて返ってきたわ。脈は、あるわね。' }]; } },
  { id: 'recon_map', tx: 13, ty: 10, room: 'recon', label: '壁の地図', icon: 'map', cond: () => State.flag('recon_father'),
    look() { return [{ who: 'narr', text: '諜報室の壁に、勇者の故郷の地図。横に、古い木剣のスケッチ。' }, { who: 'shadow', text: '……「父」の字だけ、丸で囲んである。私が、囲んだ。' }]; } },
];

/* ═════════════════════════════════════════════════════════════════════
   §4：怒りの誘惑。玉座でいつでも選べる。攻撃系を選ぶと腕輪が止め、「魔王は我慢した」。
   ＝「攻撃できない」設定を、説明ではなくプレイヤーの感情にする。
   ═════════════════════════════════════════════════════════════════════ */
DATA.anger = {
  intro: { who: 'maou', text: '（王国のことを考えていると、つい——手が出そうになる。）' },
  options: [
    { id: 'burn', label: '🔥 勇者を焼き払う', sfx: 'bracelet', lines: [
      { who: 'maou', text: 'もう、勇者を焼き払えば早いのでは？' },
      { who: 'narr', text: '——魔王の腕で、和平の腕輪が、燃えるように光った。' },
      { who: 'belze', text: '魔王様。' },
      { who: 'maou', text: '……言ってみただけだ。' },
      { who: 'belze', text: '言うだけでも、村の結界が、揺れています。' },
    ] },
    { id: 'thunder', label: '⚡ 王国に雷を落とす', sfx: 'thunder', lines: [
      { who: 'maou', text: '王国の広報官に、雷を落とす。' },
      { who: 'narr', text: '——腕輪が、光る。' },
      { who: 'pazuzu', text: 'お気持ちは、わかります。' },
      { who: 'pazuzu', text: 'でも、見出しが最悪になります。「魔王、雷を落とす」。' },
      { who: 'maou', text: '……そのまま、だな。' },
    ] },
    { id: 'frog', label: '🐸 広報官をカエルにする', sfx: 'frog', lines: [
      { who: 'maou', text: 'いっそ、王国の広報官を、カエルにするか。' },
      { who: 'narr', text: '——腕輪が、光る。' },
      { who: 'pazuzu', text: '魔王様、それ、なぜか私がやられる側に見えています。' },
      { who: 'maou', text: 'お前ではない。' },
      { who: 'pazuzu', text: '……念のため、確認でした。' },
    ] },
    { id: 'endure', label: '…… 我慢する', endure: true },
  ],
  // 我慢した回数でベルゼの締めが変わる（押しすぎると、村の話になる）
  belzeAfter(count) {
    if (count >= 3) return [
      { who: 'belze', text: '魔王様。怒りは、理解します。' },
      { who: 'belze', text: 'ですが、我々が守っているのは——面子では、なく、村です。' },
    ];
    if (count === 2) return [{ who: 'belze', text: '……今のは、聞かなかったことに、します。' }];
    return [{ who: 'belze', text: '殴らずに、いきましょう。魔王様。' }];
  },
};

/* ═════════════════════════════════════════════════════════════════════
   §11：週ごとの「今週の空気」。週頭に提示し、毎週が同じに見えないようにする。
   index は週番号（1〜10）。
   ═════════════════════════════════════════════════════════════════════ */
DATA.weekMood = [
  null,
  { title: '勇者任命直後',   air: '勇者一行は団結している。王国の発表を、まだ信じている。', lean: '村人に届く支援活動が向いている。' },
  { title: '始まりの村',     air: '村人は魔王軍を怖がっている。でも、困っている人もいる。', lean: 'クリニックなど、村に直接届く手が効く。' },
  { title: '森の街道',       air: '旅の疲れが出始める。仲間の本音が、漏れやすい。',       lean: '戦士の待遇——人事の手が、刺さりやすい。' },
  { title: '王国報道',       air: '王国が、魔王軍の支援を“侵略準備”と報じ始める。',       lean: '反論と、証拠集めの時。資料棚を見直せ。' },
  { title: '教会都市',       air: '僧侶の価値観が揺れやすい。ただし、教会の反発も強い。',   lean: '孤児院・クリニックの証言が、届く。' },
  { title: 'ダンジョン入口', air: '魔王軍の現場を、勇者が直接見る頃。',                   lean: '安全基準や、魔族の暮らしを見せる好機。' },
  { title: '勇者の迷い',     air: '勇者本人に、問いが届き始める。',                       lean: '謝罪会見・過去調査が、本人に効く。' },
  { title: '王国の焦り',     air: '王国が、勇者を急がせている。',                         lean: '王国の不正・誤解の反論で、足場を崩す。' },
  { title: '魔王城前',       air: 'もう、新しい善行を積む時間はない。',                   lean: 'これまでの材料で、最終面談に備える。' },
  { title: '最終面談',       air: '言葉で、戦う。',                                       lean: '集めた資料と、揺らした心が、ものを言う。' },
];
DATA.mood = function (turn) { return DATA.weekMood[Math.max(1, Math.min(10, turn))]; };

/* ═════════════════════════════════════════════════════════════════════
   §7：キャラの“残留変化”。一度起きた変化を、以降の観察に小さな癖として残す。
   フラグが立っていれば、観察フェーズの地の文に混ぜる（毎回ではなく、たまに）。
   ═════════════════════════════════════════════════════════════════════ */
DATA.residual = function () {
  const out = [];
  if (State.flag('warriorKeptFlyer')) out.push([
    { who: 'garud', text: '（ポケットの求人票を、こっそり開いて、また閉じる。）' },
    { who: 'leon', text: '……それ、まだ持ってたのか。' },
    { who: 'garud', text: '見てない。確認してるだけだ。' },
    { who: 'leon', text: 'それを、見てるって言うんだ。' },
  ]);
  if (State.flag('priestDoubtsChurch') || State.flag('priestVisitedOrphanage')) out.push([
    { who: 'miria', text: '……こんにちは。' },
    { who: 'leon', text: '誰に挨拶した？' },
    { who: 'miria', text: 'わかりません。すれ違った、魔族の子に。自然に。' },
  ]);
  if (State.flag('mageReceivedResearch')) out.push([
    { who: 'noel', text: '（歩きながら、魔王軍の資料を読んでいる。）' },
    { who: 'leon', text: '敵の資料を読むのは、危険だぞ。' },
    { who: 'noel', text: '危険だからこそ、読むの。' },
  ]);
  if (State.flag('heroSawApology')) out.push([
    { who: 'garud', text: 'レオン。それ、魔王の会見記事か？' },
    { who: 'leon', text: '……違う。' },
    { who: 'garud', text: 'じゃあ、何だよ。' },
    { who: 'leon', text: '資料だ。' },
  ]);
  return out;
};

/* §12：3段階で“自然に学ばせる”ためのベルゼの一言（週帯で変える）。 */
DATA.learnHint = function (turn) {
  if (turn <= 1) return '善い行いは、まっすぐ届きます。まずは、人を助けることです。';
  if (turn <= 3) return '良いことでも、見せ方を間違えると、誤解されます。';
  if (turn <= 5) return '誤解を解くには、感情だけでなく——“証拠”が要ります。資料棚を、ためてください。';
  return '最後は、世間ではなく、勇者本人に向き合うことになります。';
};
