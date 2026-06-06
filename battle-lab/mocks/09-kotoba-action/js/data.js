/*
 * data.js — Battle 09「ことばアクションコマンドバトル」のデータ集約
 *
 * 遊びの核：コマンドを選んだあとに“タイミング入力”がある。
 *   同じ言葉でも、届け方（タイミング）で効果が変わる。
 *   早すぎると急かし、遅すぎると届かない。だまる＝何もしないのが正解の時もある。
 *
 * 入力とルールは engine.js が判定。ここには数値と文章だけ。
 */

var PLAYER_INIT = { name:'L', kokoro:10, maxKokoro:10 };

// 言葉を売っている学校の先生。やさしいが、言葉を“商品”として扱うこわさがある。
var ENEMY_INIT = { name:'先生', zawameki:10, maxZawameki:10, keikai:2, maxKeikai:5 };

// 連続で正しく届けると勝てる（しきい値）
var STREAK_WIN = 3;

// 判定 → 効果の倍率。deep が最高、rush/miss は 0。
var JUDGE_FACTOR = { deep:1.5, good:1.0, slight:0.5, miss:0, rush:0, backfire:0, silence:0 };

// 判定の表示名
var JUDGE_LABEL = {
  deep:'ふかく届いた', good:'届いた', slight:'少し届いた',
  miss:'届かなかった', rush:'急かしてしまった', backfire:'軽すぎた', silence:'だまった'
};

// L のコマンド
//   type: 'timing'（ゲージ判定）/ 'silence'（待つのが正解）/ 'backfire'（この相手には逆効果）
//   tight:true は判定窓が狭い（むずかしい）
//   base: ざわめき等への基礎効果
var COMMANDS = [
  { id:'kiku',     name:'きく',           type:'timing', base:1, tight:false,
    hint:'成功で先生の本音が見え、警戒が下がる。' },
  { id:'hanasu',   name:'はなす',         type:'timing', base:3, tight:false,
    hint:'成功でざわめきを下げる。' },
  { id:'damaru',   name:'だまる',         type:'silence', base:0, tight:false,
    hint:'何もしないのが正解。待ちきると警戒が下がる。' },
  { id:'fureru',   name:'ふれる',         type:'timing', base:5, tight:false,
    hint:'成功で大きく下げる。失敗すると警戒が上がる。' },
  { id:'arigatou', name:'ありがとう',      type:'timing', base:3, tight:false,
    hint:'言葉Lv1。標準的な鎮静。成功でこころも少し回復。' },
  { id:'honto',    name:'本当にありがとう', type:'timing', base:5, tight:true,
    hint:'言葉Lv2。効果は高いがタイミングが狭い。' },
  { id:'meccha',   name:'めっちゃありがとう', type:'backfire', base:0, tight:false,
    hint:'言葉Lv3。ポップだが、この先生には軽すぎて逆効果。' }
];

// 先生の行動（一定の循環・乱数なし）
var ENEMY_PLAN = [
  { id:'hatsuon',  name:'発音を直す',        keikai:1,
    log:['先生「そこは もっと はっきり」','警戒が、少し上がる。'] },
  { id:'tadashii', name:'正しい言葉を求める', kokoroIfPoor:2,
    log:['先生「正しい言葉で、お願いします」'] },
  { id:'homesugi', name:'ほめすぎる',        keikai:1,
    log:['先生「えらい！ すごい！ 完璧！」','ほめられすぎて、なぜか身がまえる。'] },
  { id:'kokuban',  name:'黒板に知らない単語を書く', kokoro:1,
    log:['先生は黒板に、知らない単語を書いた。','読めない。こころが、少し冷える。'] },
  { id:'kau',      name:'「言葉は買うものです」', keikai:1,
    log:['先生「言葉は、買うものですよ」','警戒が、上がる。'] }
];

var INTRO_TEXT = [
  '学校では、今日も言葉が売られている。',
  '先生は、やさしく言葉を教えてくれる。どこか、商品をならべるように。',
  '',
  'コマンドを選んだら、タイミングを合わせて言葉を“届ける”。',
  '早すぎると急かし、遅すぎると届かない。だまるのが正解のときもある。'
];
var OPENING_LOG = 'Lは、まだ言葉をうまく持てない。けれど、届けようとする。';

var WIN_TITLE = '届いた';
var WIN_TEXT = {
  zawameki: ['先生のざわめきが、すっと静まった。','先生「……Lの言葉は、買ったものでは ないね」','少しだけ、世界が近くなった。'],
  todoke:   ['三度つづけて、言葉がまっすぐ届いた。','先生「……ちゃんと、伝わっています」','言葉は、売り物ではなかった。'],
  silence:  ['Lは、ただ だまっていた。','先生は、チョークを置いた。授業が、止まる。','','黒板の world から、l だけが消えた。']
};
var LOSE_TITLE = '届かなかった';
var LOSE_TEXT = {
  kokoro: ['こころが、もう動かない。','読めない単語ばかりが、増えていく。','Lは、また言葉を忘れた場所へ戻る。']
};
