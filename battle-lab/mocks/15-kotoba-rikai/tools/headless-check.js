/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認
 *
 * このモックの check は JXA と Node の両対応にしてある（理由：Windows 等
 * osascript の無い環境でも、Node があれば進行ルールを点検できるように）。
 *
 * 使い方：
 *   ・JXA（macOS）：MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 *   ・Node         ：node tools/headless-check.js        （__dirname から親フォルダを解決）
 *
 * 点検内容：
 *   1) 初期化（理解度0 / 警戒=開始値 / 余裕100 / 3択 / 1ターン目の三択が仕様どおり）
 *   2) 相性判定（こわがり×聞く=苦手 / 受け止める=得意、門番×観察=得意 …）
 *   3) 効果量（相性・状態・動揺の倍率、警戒スパイク、安心の軽減）
 *   4) 状態遷移（観察で強がり解除、受け止め2連で安心、沈黙の解除、動揺の付与）
 *   5) 余裕（消費・距離で回復・0で焦りの選択肢）
 *   6) 3択生成（沈黙中は2択、差し出すは回数制限、観察ヒントが様子に出る）
 *   7) 勝敗（理解度ゴール→win / 低警戒→warmwin / 警戒上限→reject / ターン切れ→surface）
 *   8) 最適ラインで両エンカウンターが勝てる（勝ち筋の存在）
 *   9) ランダム自動プレイを多数回しても例外なく必ず決着する
 */

/* ───────── 環境判定とファイル読み込み（JXA / Node 両対応）───────── */
var isNode = (typeof process !== 'undefined' && process.versions && process.versions.node);
var readFile, jsdir;

if (isNode) {
  var fs = require('fs'), path = require('path');
  var base = process.env.MOCKDIR || path.resolve(__dirname, '..');
  jsdir = path.join(base, 'js') + path.sep;
  readFile = function (p) { return fs.readFileSync(p, 'utf8'); };
} else {
  ObjC.import('Foundation');
  var env = $.NSProcessInfo.processInfo.environment.js;
  var b = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
  if (b.charAt(b.length - 1) !== '/') b += '/';
  jsdir = b + 'js/';
  readFile = function (p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; };
}

// data.js → engine.js の順で結合して評価（素のグローバル方式なのでそのまま使える）
var src = readFile(jsdir + 'data.js') + '\n' + readFile(jsdir + 'engine.js');
eval(src);

/* ───────── 簡易アサート ───────── */
var passed = 0, failed = 0, lines = [];
function ok(cond, label) {
  if (cond) { passed++; lines.push('  PASS ' + label); }
  else { failed++; lines.push('  FAIL ' + label); }
}
var _origRandom = Math.random;
function stubRandom(v) { Math.random = function () { return v; }; }
function restoreRandom() { Math.random = _origRandom; }

// テスト都合で、特定の選択肢だけを盤面に差し込んで選ばせる（生成器を介さず resolution を直接検証）
function play(id) {
  var pool = ENCOUNTERS[state.encounterId].choicePool.concat(PANIC_CHOICES);
  var c = null;
  for (var i = 0; i < pool.length; i++) if (pool[i].id === id) c = pool[i];
  if (!c) throw new Error('no choice: ' + id);
  state.choices = [c];
  return choose(id);
}
function ids(arr) { return arr.map(function (c) { return c.id; }); }

/* ═════════ 1) 初期化 ═════════ */
newBattle('naku_ko');
ok(state.understanding === 0, '初期: 理解度 0');
ok(state.alert === 12, '初期: 警戒 = 開始値12');
ok(state.composure === 60, '初期: 余裕 60');
ok(state.phase === 'player' && state.result === null, '初期: Lの番・未決着');
ok(state.choices.length === 3, '初期: 3択');
var t1 = ids(state.choices).sort().join(',');
ok(t1 === 'c1_daijoubu,c1_doushita,c1_shagamu', '初期(子): 1ターン目の三択が仕様どおり (' + t1 + ')');

newBattle('gatekeeper');
ok(state.alert === 35, '初期(門番): 警戒 35');
ok(hasState('bluff'), '初期(門番): 強がり 状態');
ok(state.sashidasuUses === 2, '初期(門番): 差し出す 2回');
var g1 = ids(state.choices).sort().join(',');
ok(g1 === 'g_ato,g_jama,g_matte_no', '初期(門番): 1ターン目の三択が仕様どおり (' + g1 + ')');

/* ═════════ 2) 相性判定 ═════════ */
newBattle('naku_ko'); // こわがり
ok(typeMatch('kiku') === 'bad', '相性(子): 聞く=苦手（聞きすぎると怖がる）');
ok(typeMatch('uketomeru') === 'good', '相性(子): 受け止める=得意');
ok(typeMatch('kansatsu') === 'good', '相性(子): 観察=得意');
ok(typeMatch('tsutaeru') === 'bad', '相性(子): 伝える=苦手（断定）');

newBattle('gatekeeper'); // つよがり＋さびしがり
ok(typeMatch('kansatsu') === 'good', '相性(門番): 観察=得意（つよがりは観察に弱い）');
ok(typeMatch('uketomeru') === 'bad', '相性(門番): 受け止める=苦手（優しくされるとごまかす）');
ok(typeMatch('tsutaeru') === 'good', '相性(門番): 伝える=得意（軽い前置き）');
ok(typeMatch('kyori') === 'bad', '相性(門番): 距離=苦手（さびしがりは放置に弱い）');

/* ═════════ 3) 効果量・倍率 ═════════ */
// 受け止める（得意）：安心系で 警戒が下がる
newBattle('naku_ko');
var a0 = state.alert;
play('c1_daijoubu'); // u5 a-2 gentle good
ok(state.alert < a0, '効果(子): 受け止めるで 警戒が下がる');

// 聞く（苦手）：警戒が上がる、理解は伸びにくい
newBattle('naku_ko');
var a1 = state.alert, u1 = state.understanding;
play('c1_doushita'); // u12 a8 → bad: u*0.55, a*1.9
ok(state.alert > a1, '効果(子): 聞く（苦手）で 警戒が上がる');
ok((state.understanding - u1) < 10, '効果(子): 聞く（苦手）の理解は伸びにくい');

// 動揺中：理解度が大きく伸びる（子＝こわがりに 受け止める＝得意 で、動揺の×1.6 が乗る）
newBattle('naku_ko');
addState('doyo');
state.understanding = 30;
var uD = state.understanding;
state.choices = [{ id:'tmp_gentle', text:'…', category:'uketomeru', understanding:10, alert:-6, gentle:true }];
choose('tmp_gentle');
ok(state.understanding - uD > 10, '効果: 動揺中の やわらかい手は 理解度が大きく伸びる');

// 動揺中の踏み込みすぎは 警戒が大きく上がる（差し出す＝相性中立で、動揺の×1.9 だけを見る）
newBattle('naku_ko');
addState('doyo');
state.alert = 40;
var aD = state.alert;
state.choices = [{ id:'tmp_harsh', text:'…', category:'sashidasu', understanding:2, alert:20, core:true }];
choose('tmp_harsh');
ok(state.alert - aD > 20, '効果: 動揺中の踏み込みすぎは 警戒が大きく上がる');

/* ═════════ 4) 状態遷移 ═════════ */
// 観察で「強がり」が解ける（門番 g_ato）
newBattle('gatekeeper');
ok(hasState('bluff'), '前提: 門番は強がり');
play('g_ato');
ok(!hasState('bluff'), '状態: 観察（足元の跡）で 強がりが解ける');
ok(state.flags['tracks'] === true, '状態: 足元の跡フラグが立つ');

// 受け止める2連続成功 → 安心
newBattle('naku_ko');
state.alert = 30;
state.choices = [{ id:'u1', text:'…', category:'uketomeru', understanding:5, alert:-6, gentle:true }];
choose('u1');
ok(!hasState('anshin'), '状態: 受け止める1回では まだ安心しない');
state.choices = [{ id:'u2', text:'…', category:'uketomeru', understanding:5, alert:-6, gentle:true }];
choose('u2');
ok(hasState('anshin'), '状態: 受け止める2連続で 安心になる');

// 沈黙は 距離/観察/差し出す/受け止める で解ける
newBattle('naku_ko');
addState('chinmoku');
state.choices = [{ id:'d1', text:'…', category:'kyori', understanding:1, alert:-5, recover:10 }];
choose('d1');
ok(!hasState('chinmoku'), '状態: 距離を取ると 沈黙が解ける');

// 無理に踏み込んで 警戒が大きく跳ねると 沈黙する
newBattle('naku_ko');
state.alert = 30;
state.choices = [{ id:'push', text:'…', category:'kiku', understanding:0, alert:25, core:true }];
choose('push'); // kiku は こわがりに 苦手 → 警戒が大きく跳ねる
ok(hasState('chinmoku'), '状態: 踏み込みすぎで 警戒が跳ねると 沈黙する');

// 観察ヒントは“直後の1ターンだけ”様子に出る（その後は消える）
newBattle('gatekeeper');
play('g_ato');
ok(lookText().indexOf('行き来') >= 0, 'ヒント: 観察した直後は 様子に出る');
play('g_zutto'); // 次の手を打つと freshHint は消える
ok(lookText().indexOf('行き来') < 0, 'ヒント: 次のターンには 様子から消える（出しっぱなしにしない）');

// 同じカテゴリの連発は効きが鈍る（read-the-room を促す）
newBattle('naku_ko');
state.choices = [{ id:'m1', text:'…', category:'kansatsu', understanding:10, alert:0 }];
choose('m1'); var dM1 = state.understanding;
state.choices = [{ id:'m2', text:'…', category:'kansatsu', understanding:10, alert:0 }];
choose('m2'); var dM2 = state.understanding - dM1;
ok(dM2 < dM1, '連発: 同じカテゴリ2連続は 理解の伸びが鈍る (' + dM1 + ' → ' + dM2 + ')');

// 強がり(bluff)を崩す前は「動揺」しない（先に観察が要る）
newBattle('gatekeeper'); // 開始時 bluff
state.understanding = 60;
state.choices = [{ id:'tb', text:'…', category:'tsutaeru', understanding:10, alert:0, core:true, gentle:true,
  risk:{ cond:{ any:[{minUnderstanding:45}] }, success:{ understanding:20, alert:-4, setState:'doyo' }, fail:{ understanding:5, alert:10 } } }];
choose('tb');
ok(!hasState('doyo') && hasState('bluff'), '強がり: 崩す前は 動揺しない（観察で崩してから）');

// 受動的な警戒上昇は 勝敗判定の後。理解度ゴール到達ターンを 拒絶に化けさせない
newBattle('gatekeeper');
state.understanding = 78; state.alert = 96; state.disengageStreak = 1;
state.choices = [{ id:'go', text:'…', category:'kansatsu', understanding:5, alert:-2 }];
choose('go'); // 理解度ゴール到達が、放置ペナルティ(+6)より優先される
ok(state.result === 'win' || state.result === 'warmwin', '順序: ゴール到達ターンは 受動ペナルティで拒絶に化けない (' + state.result + ' A=' + state.alert + ')');

/* ═════════ 5) 余裕 ═════════ */
// 消費と回復（開始値に依存しないよう 100 にそろえて検証）
newBattle('naku_ko');
state.composure = 100;
state.choices = [{ id:'cost1', text:'…', category:'kiku', understanding:0, alert:0, cost:12 }];
choose('cost1');
ok(state.composure === 88, '余裕: 12消費で 100→88');
state.choices = [{ id:'rec1', text:'…', category:'kyori', understanding:0, alert:0, cost:0, recover:16 }];
choose('rec1');
ok(state.composure === 100, '余裕: 距離で回復（上限100で頭打ち）');

// 余裕0 → 焦りの選択肢（PANIC）
newBattle('naku_ko');
state.composure = 4;
state.choices = [{ id:'drain', text:'…', category:'tsutaeru', understanding:0, alert:0, cost:10 }];
choose('drain'); // 余裕0へ → buildChoices が PANIC を出す
ok(state.composure === 0, '余裕: 0 まで枯れる');
ok(ids(state.choices).join(',').indexOf('panic_') >= 0, '余裕: 0で 焦りの選択肢になる');

/* ═════════ 6) 3択生成 ═════════ */
// 沈黙中は2択
newBattle('gatekeeper');
removeState('bluff'); addState('chinmoku');
buildChoices();
ok(state.choices.length === 2, '生成: 沈黙中は 2択になる');

// 差し出すは 回数を使い切ると出ない
newBattle('gatekeeper');
state.sashidasuUses = 0;
buildChoices();
var hasOffer = state.choices.some(function (c) { return c.category === 'sashidasu'; });
ok(!hasOffer, '生成: 差し出すは 残り回数0なら出ない');

// 観察ヒントが 様子テキストに出る
newBattle('gatekeeper');
play('g_ato'); // reveal tracks + hint
ok(lookText().indexOf('行き来') >= 0, '生成: 観察ヒントが 次の様子に反映される');

/* ═════════ 7) 勝敗 ═════════ */
// win：理解度ゴール到達（警戒は高め）
newBattle('naku_ko');
state.understanding = 50; state.alert = 70;
state.choices = [{ id:'wkiku', text:'…', category:'uketomeru', understanding:10, alert:0 }];
choose('wkiku');
ok(state.result === 'win', '勝敗: 理解度ゴールで win');

// warmwin：低い警戒でゴール
newBattle('naku_ko');
state.understanding = 50; state.alert = 10;
state.choices = [{ id:'wwarm', text:'…', category:'uketomeru', understanding:10, alert:0 }];
choose('wwarm');
ok(state.result === 'warmwin', '勝敗: 低い警戒でゴール → warmwin（良エンド）');

// reject：警戒が上限
newBattle('naku_ko');
state.alert = 92;
state.choices = [{ id:'rj', text:'…', category:'kiku', understanding:0, alert:20 }];
choose('rj');
ok(state.result === 'reject', '勝敗: 警戒が上限 → reject');

// surface：ターン切れで理解度不足
newBattle('naku_ko');
state.turn = state.enemy.turnLimit;
state.understanding = 20; state.alert = 20;
state.choices = [{ id:'sf', text:'…', category:'kansatsu', understanding:2, alert:-1 }];
choose('sf');
ok(state.result === 'surface', '勝敗: ターン切れ＆理解不足 → surface');

/* ═════════ 8) 最適ラインで勝てる（勝ち筋の存在）═════════ */
// 子：観察→受け止め→花を渡す のような やさしいライン
function winLineChild() {
  newBattle('naku_ko');
  play('c1_shagamu');   // closer + 警戒↓
  play('c1_daijoubu');  // ※turn1限定なので minTurn 無視で直接 play できる
  play('c1_muri');      // 受け止め
  play('c1_koko');      // 受け止め（→安心へ）
  play('c1_hana');      // 観察→hana
  play('c1_doko');      // やさしい聞く
  play('c1_hana_watasu');// 差し出す（理解大）
  if (!state.result) play('c1_naze'); // 仕上げの核心
  return state.result;
}
var rc = winLineChild();
ok(rc === 'win' || rc === 'warmwin', '勝ち筋(子): 最適ラインで勝てる (' + rc + ' / U=' + state.understanding + ' A=' + state.alert + ')');

// 門番：観察→跡に触れる→失敗談→写真→動揺で一緒に待つ
function winLineGate() {
  newBattle('gatekeeper');
  play('g_ato');        // 強がり解除 + tracks
  play('g_zutto');      // 受け止め寄り（tracks）
  play('g_kao');        // 観察
  play('g_shippai');    // 差し出す（理解）
  play('g_gomen');      // 伝える核心（→動揺）
  play('g_shashin');    // 写真（理解大）
  if (!state.result) play('g_issho'); // 動揺：一緒に待つ
  if (!state.result) play('g_konai');
  return state.result;
}
var rg = winLineGate();
ok(rg === 'win' || rg === 'warmwin', '勝ち筋(門番): 最適ラインで勝てる (' + rg + ' / U=' + state.understanding + ' A=' + state.alert + ')');

/* ═════════ 9) ランダム自動プレイ（生成器ごと）が必ず決着する ═════════ */
function autoOnce(encId, seedShift) {
  newBattle(encId);
  var guard = 0;
  while (!state.result && guard < 200) {
    guard++;
    // 生成された3択から、ランダムで1つ選ぶ（生成器の健全性も同時に確認）
    var cs = state.choices;
    if (!cs.length) break;
    var pickIdx = Math.floor(Math.random() * cs.length);
    choose(cs[pickIdx].id);
  }
  return { result: state.result, guard: guard, turn: state.turn };
}
var ranOk = true, allResolved = true, sawWinC = false, sawWinG = false, sawReject = false;
for (var run = 0; run < 120; run++) {
  var enc = (run % 2 === 0) ? 'naku_ko' : 'gatekeeper';
  var r;
  try { r = autoOnce(enc, run); }
  catch (e) { ranOk = false; lines.push('  FAIL 自動プレイ例外: ' + e); break; }
  if (!r.result) { allResolved = false; lines.push('  FAIL 決着せず enc=' + enc + ' guard=' + r.guard); break; }
  if (r.result === 'win' || r.result === 'warmwin') { if (enc === 'naku_ko') sawWinC = true; else sawWinG = true; }
  if (r.result === 'reject') sawReject = true;
}
ok(ranOk, '自動プレイ: 120戦して 例外なし');
ok(allResolved, '自動プレイ: 毎回 必ず決着する');
ok(sawWinC, '自動プレイ: 子に勝てる試合がある');
ok(sawWinG, '自動プレイ: 門番に勝てる試合がある');
lines.push('  INFO 自動プレイで reject も観測: ' + sawReject);

/* ───────── レポート ───────── */
var header = '=== Battle 15 ことば選択型・理解バトル headless-check ===';
var footer = (failed === 0) ? ('PASS — ' + passed + '件すべてOK')
                            : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
var report = [header].concat(lines).concat([footer]).join('\n');
if (typeof console !== 'undefined' && console.log) console.log(report);
else $.NSFileHandle.fileHandleWithStandardOutput.writeData($.NSString.alloc.initWithString(report + '\n').dataUsingEncoding(4));
