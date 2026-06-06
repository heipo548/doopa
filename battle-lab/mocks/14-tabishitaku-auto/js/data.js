/*
 * data.js — Battle 14「旅支度オートバトル」のデータ集約
 *
 * 遊びの核：戦闘前に カバン(3×3) へ 持ち物を配置する。
 *   配置とシナジーで戦い方が変わり、戦闘は半自動で進む。
 *   「どんな気持ちで旅に出たかが、戦い方になる」。準備が、すでに戦い。
 */

var PLAYER_INIT = { name:'L', kokoro:10, maxKokoro:10 };
// 村の洞窟の悪党。完全な悪ではなく、言葉を奪って洞窟に隠している存在。
var ENEMY_INIT  = { name:'洞窟の悪党', zawameki:6, maxZawameki:6 };
var ENEMY_ATK = 1;            // 毎ティック、こころへ（防御で軽減）

// 持ち物（9種＝カバン3×3にちょうど）。kind: word / thing / blank
//   dmg: 発動時に削る ざわめき。heal: こころ回復。
var ITEMS = [
  { id:'letter',   name:'手紙',     glyph:'✉', kind:'word',  dmg:3, heal:0, desc:'最後に発動。ありがとうと隣で 特別な言葉に。' },
  { id:'photo',    name:'写真',     glyph:'▣', kind:'word',  dmg:3, heal:0, desc:'手紙と隣で 敵の記憶を開示。' },
  { id:'arigatou', name:'ありがとう', glyph:'あ', kind:'word',  dmg:3, heal:0, desc:'まっすぐ届く言葉。' },
  { id:'daijoubu', name:'だいじょうぶ', glyph:'だ', kind:'word', dmg:0, heal:2, desc:'こころを回復。パンと隣で 回復アップ。' },
  { id:'stone',    name:'石',       glyph:'石', kind:'thing', dmg:2, heal:0, desc:'枝と隣で 防御アップ。' },
  { id:'branch',   name:'枝',       glyph:'枝', kind:'thing', dmg:2, heal:0, desc:'石と隣で 防御アップ。' },
  { id:'bell',     name:'小さな鈴', glyph:'鈴', kind:'thing', dmg:2, heal:0, desc:'空白と隣で 敵の初回行動を遅らせる。' },
  { id:'bread',    name:'パン',     glyph:'パ', kind:'thing', dmg:0, heal:3, desc:'こころを回復。だいじょうぶと隣で 回復アップ。' },
  { id:'blank',    name:'空白',     glyph:'　', kind:'blank', dmg:0, heal:0, desc:'何もない。けれど、一部の効果を強める。真ん中に置くと…?' }
];

var INTRO_TEXT = [
  '村の洞窟。言葉を奪って隠している、悪党が いる。',
  '完全な悪では ないのかもしれない。',
  '',
  'カバン(3×3)に 持ち物を 詰める。配置とシナジーで 戦い方が変わる。',
  '戦闘は半自動。見守るか、ひとつ使うか。準備が、すでに戦い。'
];
var OPENING_LOG = 'カバンの中身が、Lの 気持ちの かたちに なる。';

var WIN_TITLE = 'たびを おえた';
var WIN_TEXT = {
  persuade: ['言葉が、まっすぐ 悪党に届いた。','悪党は うつむき、奪った言葉を ぜんぶ 返した。','説得——倒さずに、言葉が もどってきた。'],
  punish:   ['持ち物が、悪党を 静かに 押し返した。','悪党は 逃げたが、隠していた言葉は もどってきた。','懲らしめ——けれど、誰も 傷つかなかった。'],
  letgo:    ['Lは、悪党を 追い詰めなかった。','一部の言葉は もどらない。けれど、別の記憶を ひとつ もらった。','見逃す——それも、ひとつの 旅。'],
  blank:    ['カバンの真ん中には、何もなかった。','だから、悪党は そこに 言葉を置いた。','','空白の ぶんだけ、世界に すきまが できた。']
};

var ENEMY_ACTS = [
  '悪党は、奪った言葉を かぞえている。',
  '悪党は、洞窟の奥へ 一歩 下がる。',
  '悪党は、Lの カバンを のぞきこむ。'
];
