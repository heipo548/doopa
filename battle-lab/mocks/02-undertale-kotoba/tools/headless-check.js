/*
 * headless-check.js — DOM非依存コア(data/engine/bullet)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、バトルの「進行ルール」と「弾よけの当たり判定」を点検する。
 *   ・初期化（ノイズ耐性20 / 理解度0 / 警戒度0 / 次の感情あり / commandフェーズ）
 *   ・各コマンドの効果値（理解度・警戒度・回復・解禁・次フェーズ修飾）
 *   ・クランプ（理解度0〜100 / 警戒度0〜100 / 耐性は最大20）
 *   ・心配している は『まねる』後だけ使える
 *   ・ほどく：理解度80未満は失敗 / 80以上は勝利
 *   ・resolveDodge：被ダメ反映・沈黙による軽減・記憶のかけらで理解度上昇
 *   ・bullet：フィールド生成 / 当たり判定（弾＝ダメージ・無敵 / かけら＝理解度）
 *   ・心配する感情は理解度60以上でだけ抽選候補に入る
 *   ・勝ち筋・負け筋がロジック上 到達できること（ランダム込みのオートランで例外なし）
 *
 * 使い方（このモックのフォルダで実行）：
 *   osascript -l JavaScript tools/headless-check.js
 *   もしくは：MOCKDIR="/abs/.../02-undertale-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var env = $.NSProcessInfo.processInfo.environment.js;
var base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
if (base.charAt(base.length - 1) !== '/') base += '/';
var jsdir = base + 'js/';

// data.js → engine.js → bullet.js の順で結合して評価（素のグローバル方式）
var src = readFile(jsdir + 'data.js') + '\n'
        + readFile(jsdir + 'engine.js') + '\n'
        + readFile(jsdir + 'bullet.js');
eval(src);

/* ───────── 簡易アサート ───────── */
var passed = 0, failed = 0, lines = [];
function ok(cond, label) {
  if (cond) { passed++; lines.push('  ✅ ' + label); }
  else { failed++; lines.push('  ❌ ' + label); }
}

/* ───────── 1) 初期化 ───────── */
newBattle();
ok(state.player.noise === 20 && state.player.maxNoise === 20, '初期: ノイズ耐性 20/20');
ok(state.enemy.understanding === 0, '初期: 理解度 0');
ok(state.enemy.wariness === 0, '初期: 警戒度 0');
ok(!!state.enemy.emotion, '初期: 次の感情がある');
ok(state.phase === 'command', '初期: コマンドフェーズ');
ok(closedHeartText(0) === 'まだ固い' && closedHeartText(50) === '少しゆるんだ' && closedHeartText(80) === 'ほどけそう',
   '閉じた心テキスト: 0=まだ固い / 50=少しゆるんだ / 80=ほどけそう');

/* ───────── 2) コマンド効果値 ───────── */
// つたえる
newBattle(); applyCommand('konnichiwa');
ok(state.enemy.understanding === 8 && state.enemy.wariness === 3, 'こんにちは: 理解+8 / 警戒+3');
ok(state.phase === 'dodge', 'コマンド後は dodge フェーズへ');

newBattle(); applyCommand('iyada');
ok(state.enemy.understanding === 12 && state.enemy.wariness === 10, 'いやだ: 理解+12 / 警戒+10');

newBattle(); state.enemy.wariness = 2; applyCommand('arigatou');
ok(state.enemy.understanding === 6 && state.enemy.wariness === 0, 'ありがとう: 理解+6 / 警戒-5（0でクランプ）');

// たずねる
newBattle(); applyCommand('miru');
ok(state.enemy.understanding === 5 && state.enemy.wariness === 0, 'みる: 理解+5 / 警戒-3（0でクランプ）');
newBattle(); state.enemy.wariness = 20; applyCommand('kiku');
ok(state.enemy.understanding === 8 && state.enemy.wariness === 12, 'きく: 理解+8 / 警戒-8');
newBattle(); applyCommand('doushite');
ok(state.enemy.understanding === 10 && state.enemy.wariness === 2, 'どうして？: 理解+10 / 警戒+2');
newBattle(); state.enemy.wariness = 20; applyCommand('matte');
ok(state.enemy.understanding === 4 && state.enemy.wariness === 10 && state.flags.slowNext === true,
   'まって: 理解+4 / 警戒-10 / 次フェーズ slowNext');

// おぼえる → 心配している
newBattle();
ok(isOptionVisible(findOption('shinpai').opt) === false, '心配している: まねる前は出ない（非表示）');
applyCommand('shinpai'); // まだ使えない → 効果なし
ok(state.enemy.understanding === 0, '心配している: まねる前は効果なし');
applyCommand('maneru');
ok(state.enemy.understanding === 5 && state.flags.shinpaiUnlocked === true, 'まねる: 理解+5 / 心配している を解禁');
resolveDodge({ damage: 0, shards: 0 }); // dodge を消化して command へ戻す
ok(isOptionVisible(findOption('shinpai').opt) === true, '心配している: まねる後は出る（表示）');
applyCommand('shinpai');
ok(state.enemy.understanding === 25, '心配している: 理解+20（5→25）');

// しずまる
newBattle(); state.enemy.wariness = 10; applyCommand('chinmoku');
ok(state.enemy.wariness === 5 && state.flags.guardNext === true, '沈黙する: 警戒-5 / 次フェーズ guardNext');
newBattle(); state.player.noise = 19; applyCommand('shinkokyuu');
ok(state.player.noise === 20, '深呼吸する: 耐性+3（19→20、最大20でクランプ）');
newBattle(); state.player.noise = 10; applyCommand('shinkokyuu');
ok(state.player.noise === 13, '深呼吸する: 耐性+3（10→13）');

// 理解度の上限クランプ
newBattle(); state.enemy.understanding = 95; applyCommand('iyada');
ok(state.enemy.understanding === 100, '理解度: 上限100でクランプ');

/* ───────── 3) ほどく（勝利コマンド）の成否 ───────── */
newBattle(); state.enemy.understanding = 50;
var rFail = applyCommand('hodoku');
ok(rFail.kind === 'fail' && state.result === null && state.phase === 'command',
   'ほどく: 理解50では失敗（コマンドに留まる）');
newBattle(); state.enemy.understanding = 80;
var rWin = applyCommand('hodoku');
ok(rWin.kind === 'win' && state.result === 'win', 'ほどく: 理解80で勝利');
ok(WIN_TEXT.length === 3 && WIN_TEXT[2].indexOf('学校へ行け') >= 0, '勝利メッセージ: 3行・「学校へ行け」を含む');

/* ───────── 4) resolveDodge（被ダメ・軽減・かけら） ───────── */
// 被ダメをそのまま反映
newBattle(); applyCommand('miru'); resolveDodge({ damage: 4, shards: 0 });
ok(state.player.noise === 16, 'resolveDodge: ノイズ4で 耐性 20→16');
ok(state.phase === 'command' && state.turn === 2, 'resolveDodge: 次ターン（command / turn2）へ');
// 沈黙する（guardNext）で被ダメ半減（floor）
newBattle(); state.flags.guardNext = true; state.phase = 'dodge';
resolveDodge({ damage: 5, shards: 0 });
ok(state.player.noise === 18, '沈黙: ノイズ5 → floor(2.5)=2 軽減 → 20-2=18');
ok(state.flags.guardNext === false, '沈黙: guardNext は1回で消費');
// 記憶のかけらで理解度上昇（1個=+3）
newBattle(); applyCommand('miru'); var u0 = state.enemy.understanding;
resolveDodge({ damage: 0, shards: 2 });
ok(state.enemy.understanding === u0 + 6, '記憶のかけら: 2個で 理解度+6');
// 敗北：耐性0
newBattle(); state.player.noise = 3; state.phase = 'dodge';
resolveDodge({ damage: 8, shards: 0 });
ok(state.result === 'lose' && state.player.noise === 0, '敗北: 耐性0 → lose（0で止まる）');
ok(LOSE_TEXT.length === 2 && LOSE_TEXT[0].indexOf('ばらばら') >= 0, '敗北メッセージ: 2行・「ばらばら」を含む');

/* ───────── 5) 感情の抽選ゲート ───────── */
newBattle();
var sawShinpaiLow = false;
for (var i = 0; i < 80; i++) { state.enemy.understanding = 0; chooseEmotion(); if (state.enemy.emotion.id === 'shinpai') sawShinpaiLow = true; }
ok(sawShinpaiLow === false, '心配する: 理解60未満では選ばれない');
var sawShinpaiHigh = false;
for (var j = 0; j < 200; j++) { state.enemy.understanding = 70; state.enemy.emotion = EMOTIONS.utagau; chooseEmotion(); if (state.enemy.emotion.id === 'shinpai') sawShinpaiHigh = true; }
ok(sawShinpaiHigh === true, '心配する: 理解60以上では選ばれうる');

/* ───────── 6) bullet：フィールドと当たり判定 ───────── */
// 出現を止めた“静かな”フィールドを作って、当たり判定だけを確かめる
var quietEmotion = { id: 'q', name: 'q', line: '', spawn: { doubt: 0, anger: 0, shard: 0 } };
var f = makeDodgeField({ emotion: quietEmotion, wariness: 0, w: 460, h: 240 });
ok(f.player.x === 230 && f.player.y === 120, 'bullet: プレイヤーは中央スタート');
ok(f.duration >= 5 && f.duration <= 6, 'bullet: 回避フェーズは5〜6秒');
// 弾をプレイヤー上に置く → tick で被弾
f.bullets.push({ x: f.player.x, y: f.player.y, vx: 0, vy: 0, r: 11, damage: 2, glyph: '！', cls: 'n-anger' });
tickDodge(f, 1 / 60);
ok(f.damageTaken === 2, 'bullet: 重なった弾で damage 2');
ok(f.invuln > 0, 'bullet: 被弾後は無敵時間が入る');
// 無敵中はもう一度重ねてもダメージが増えない
f.bullets.push({ x: f.player.x, y: f.player.y, vx: 0, vy: 0, r: 11, damage: 2, glyph: '！', cls: 'n-anger' });
tickDodge(f, 1 / 60);
ok(f.damageTaken === 2, 'bullet: 無敵中は連続被弾しない');
// 記憶のかけらに触れる → カウント＋（無敵でも拾える）
f.shards.push({ x: f.player.x, y: f.player.y, vx: 0, vy: 0, r: 12, heal: 3, glyph: 'こ', cls: 'n-shard' });
tickDodge(f, 1 / 60);
ok(f.shardsCollected === 1, 'bullet: かけらに触れて shardsCollected 1');
// 警戒度で激しさが上がる（intensity）／まってで遅くなる（slowFactor）
var fHi = makeDodgeField({ emotion: quietEmotion, wariness: 100, w: 460, h: 240 });
ok(fHi.intensity > 1.5, 'bullet: 警戒度100で intensity が上がる');
var fSlow = makeDodgeField({ emotion: quietEmotion, wariness: 0, slow: true, w: 460, h: 240 });
ok(fSlow.slowFactor < 1, 'bullet: まって で slowFactor が下がる');
// 何もしないと duration で終わる
var fEnd = makeDodgeField({ emotion: quietEmotion, wariness: 0, w: 300, h: 180 });
var steps = 0; while (!fEnd.done && steps < 2000) { tickDodge(fEnd, 1 / 60); steps++; }
ok(fEnd.done === true, 'bullet: 時間で必ず終了する');

/* ───────── 7) 勝ち筋・負け筋がロジック上 到達できる ───────── */
// 勝ち：完璧に避けた前提（damage0）で理解度を上げ続ければ ほどける
(function () {
  newBattle();
  var guard = 0;
  while (!state.result && guard < 50) {
    guard++;
    if (state.enemy.understanding >= BALANCE.winThreshold) { applyCommand('hodoku'); break; }
    applyCommand('konnichiwa');       // 理解+8
    resolveDodge({ damage: 0, shards: 0 });
  }
  ok(state.result === 'win', 'オートラン(完璧回避): ほどく まで到達できる');
})();
// 負け：被弾し続ければ ノイズ耐性が尽きる
(function () {
  newBattle();
  var guard = 0;
  while (!state.result && guard < 50) {
    guard++;
    applyCommand('miru');
    resolveDodge({ damage: 5, shards: 0 });
  }
  ok(state.result === 'lose', 'オートラン(被弾し続け): 敗北まで到達できる');
})();

/* ───────── 8) ランダム込みの弾よけ込みオートラン（例外なし・必ず決着） ───────── */
function simulateDodge() {
  var fld = makeDodgeField({
    emotion: state.enemy.emotion, wariness: state.enemy.wariness,
    slow: state.flags.slowNext, guard: state.flags.guardNext, w: 460, h: 240
  });
  var st = 0;
  while (!fld.done && st < 2000) { tickDodge(fld, 1 / 60); st++; } // 入力なし＝棒立ち
  resolveDodge(dodgeSummary(fld));
}
function autoRun() {
  newBattle();
  var guard = 0;
  while (!state.result && guard < 300) {
    guard++;
    if (state.phase !== 'command') break;
    if (state.enemy.understanding >= BALANCE.winThreshold) { applyCommand('hodoku'); break; }
    // 警戒を下げつつ理解を上げる無難な手。低耐性なら深呼吸
    if (state.player.noise <= 5) applyCommand('shinkokyuu');
    else applyCommand('kiku');
    if (state.phase === 'dodge') simulateDodge();
  }
  return { result: state.result, guard: guard };
}
var ranOk = true, allResolved = true;
for (var run = 0; run < 20; run++) {
  var r;
  try { r = autoRun(); }
  catch (e) { ranOk = false; lines.push('  ❌ オートラン例外: ' + e); break; }
  if (!r.result) { allResolved = false; lines.push('  ❌ 300手で決着せず（guard=' + r.guard + '）'); break; }
}
ok(ranOk, 'オートラン: 20戦して例外なし');
ok(allResolved, 'オートラン: 毎回ちゃんと決着する');

/* ───────── レポート ───────── */
var header = '=== 言葉アクション対話バトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
