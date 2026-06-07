/*
 * data.js — Battle 12「鼓動リズムバトル」のデータ集約
 *
 * 遊びの核：相手の鼓動・呼吸のリズムを聞き、合わせたり、あえて外したりする。
 *   ずっと合わせるだけでは“飲まれる”。無音のタイミングでは、だまるのが正解。
 *   静かで、少し不安で、呼吸を合わせるようなバトル。
 */

var PLAYER_INIT = { name:'L', kokoro:6, maxKokoro:6 };
// 無人島の灯台の影。遠くから一定のリズムで光るが、近づくとリズムが乱れる。
var ENEMY_INIT  = { name:'灯台の影', zawameki:8, maxZawameki:8 };

var MAX_SYNC = 6;        // 同調ゲージ
var MAX_DROWN = 6;       // 飲まれゲージ（満ちると飲まれて敗北）
var SYNC_SPECIAL = 5;    // 無音で だまる したとき、この同調以上で特殊終了

// ラウンドごとのリズム（乱数なし＝聞いて読める）
//   stable=安定 / unstable=乱れ / silence=無音
var PATTERN_SEQ = ['stable','stable','unstable','silence'];
function patternFor(round){ return PATTERN_SEQ[round % PATTERN_SEQ.length]; }

var PATTERN_LABEL = { stable:'安定（ドン……ドン……）', unstable:'乱れ（ドン…ドドン…）', silence:'無音（……）' };

// 鼓動ドット（UI用）。true がビート。
var BEAT_DOTS = {
  stable:   [true,false,false,false,true,false,false,false],
  unstable: [true,false,false,true,true,false,false,false],
  silence:  [false,false,false,false,false,false,false,false]
};

var COMMANDS = [
  { id:'kiku',          name:'きく',          hint:'鼓動に合わせて押すと、本音が見える。' },
  { id:'hanasu',        name:'はなす',        hint:'拍に合わせて押すと、ざわめきを下げる。' },
  { id:'ikiwoawaseru',  name:'いきをあわせる', hint:'同調を上げる。上げすぎると飲まれる。' },
  { id:'ikiwozurasu',   name:'いきをずらす',   hint:'飲まれを下げる。タイミングが難しい。' },
  { id:'damaru',        name:'だまる',        hint:'無音のタイミングで選ぶと、大成功。' }
];

var INTRO_TEXT = [
  '無人島の夜。灯台の影が、一定のリズムで 光っている。',
  '近づくと、リズムが 乱れる。',
  '',
  '鼓動を聞いて、合わせる。あえて ずらす。無音では、だまる。',
  'ずっと合わせるだけでは、こちらが 飲まれてしまう。'
];
var OPENING_LOG = 'ドン……ドン……。遠くで、何かが 呼吸している。';

var WIN_TITLE = 'しずまった';
var WIN_TEXT = {
  zawameki:   ['灯台の影の ざわめきが、しずまった。','光は、もう こちらを 探さない。','少しだけ、世界が 近くなった。'],
  lighthouse: ['無音に、Lは だまっていた。','呼吸が、ひとつに 重なる。','','灯台は、こちらではなく 海を照らした。']
};
var LOSE_TITLE = 'のまれた';
var LOSE_TEXT = {
  drown:  ['合わせすぎて、Lは リズムに 飲まれた。','どちらの鼓動か、もう わからない。'],
  kokoro: ['乱れた拍に、こころが 削られた。','Lは、暗い波打ち際に ひとり 残された。']
};

// 勝因/敗因の「やさしい解説」（endKind をキー。勝ち＝何がうまくいったか／負け＝なぜ失敗したか＋次どうすれば）
var ADVICE = {
  zawameki:  '光った瞬間に合わせて「はなす」「きく」を届け、灯台のざわめき（落ち着かなさ）を しずめられました。リズムをよく聞けていました。',
  lighthouse:'無音のあいだ、何も押さずに だまって待てました。呼吸がひとつに重なる、いちばん静かな勝ち方でした。',
  drown:     '「いきをあわせる」で同調を上げすぎて、リズムに飲まれてしまいました。飲まれ（▼）が増えてきたら「いきをずらす」で下げ、合わせるのは ほどほどにしましょう。',
  kokoro:    '乱れたリズムで拍を外し、こころが削られました。光（●）が来た瞬間だけ押すように、よく見て合わせましょう。あせって外すより、待つほうが安全です。'
};
// リトライ時の短い助言
var RETRY_HINT = 'ヒント：●が光った瞬間に押す。無音（…だけ）のときは何も押さず「だまる」。合わせるばかりだと飲まれます。';
