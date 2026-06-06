/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性24 / 閉じた心30 / 欠片3 / 次の感情あり）
 *   ・各 言葉装置 の条件判定と効果（こんにちは/だいじょうぶ/どうして？/まって/沈黙する
 *     ＋ありがとう/いやだ/ほんとう？）
 *   ・白い欠片（ワイルドカード＋受容ボーナス）／かすれ（音1固定）／次ターン欠片＋
 *   ・受容によるノイズ軽減、次ノイズ軽減（まって）、溜め（黙って見る）
 *   ・勝敗判定（閉じた心0→win / ノイズ耐性0→lose）と勝利/敗北メッセージ
 *   ・ランダムを含む“1戦まるごと”を最後まで回してもエラーが出ないこと
 *
 * 使い方（モックのフォルダで実行）：
 *   osascript -l JavaScript tools/headless-check.js
 * もしくは絶対パスで：
 *   MOCKDIR="/abs/.../04-dicey-dungeons-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

// 読み込み元フォルダ：環境変数 MOCKDIR 優先、無ければカレント
var env = $.NSProcessInfo.processInfo.environment.js;
var base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
if (base.charAt(base.length - 1) !== '/') base += '/';
var jsdir = base + 'js/';

// data.js → engine.js の順で結合して評価（素のグローバル方式なのでそのまま使える）
var src = readFile(jsdir + 'data.js') + '\n' + readFile(jsdir + 'engine.js');
eval(src);

/* ───────── 簡易アサート ───────── */
var passed = 0, failed = 0, lines = [];
function ok(cond, label) {
  if (cond) { passed++; lines.push('  ✅ ' + label); }
  else { failed++; lines.push('  ❌ ' + label); }
}

// テスト用に「音の決まった欠片」をプールへ足して id を返す
var _t = 0;
function putKakera(value, opts) {
  opts = opts || {};
  var k = { id: 't' + (++_t), value: value, white: !!opts.white, kasure: !!opts.kasure };
  state.pool.push(k);
  return k.id;
}

/* ───────── 1) 初期化 ───────── */
newBattle('sonchou');
ok(state.player.noise === 24 && state.player.maxNoise === 24, '初期: ノイズ耐性 24/24');
ok(state.enemy.heart === 30 && state.enemy.maxHeart === 30, '初期: 閉じた心 30/30');
ok(state.pool.length === 3, '初期: ことばの欠片 3つ');
ok(state.pool.every(function (k) { return k.value >= 1 && k.value <= 6; }), '初期: 欠片の音は1〜6');
ok(!!state.enemy.intent, '初期: 次の感情（行動予告）がある');
ok(state.phase === 'player', '初期: プレイヤーの番');
ok(state.devices.length === 8, '初期: 言葉装置 8個（必須5＋任意3）');

/* ───────── 2) 必須の言葉装置 ───────── */
// こんにちは：閉じた心 −欠片の音
newBattle('sonchou'); var h0 = state.enemy.heart;
loadKakera(putKakera(4), 'konnichiwa');
ok(state.enemy.heart === h0 - 4, 'こんにちは: [4] で 閉じた心 −4');

// だいじょうぶ：受容 ＋欠片の音
newBattle('sonchou'); state.player.juyou = 0;
loadKakera(putKakera(5), 'daijoubu');
ok(state.player.juyou === 5, 'だいじょうぶ: [5] で 受容 +5');

// どうして？：奇数のみ。閉じた心 −2／次ターン欠片＋1
newBattle('sonchou'); var h1 = state.enemy.heart;
var rDo = loadKakera(putKakera(3), 'doushite');
ok(rDo.ok && state.enemy.heart === h1 - 2, 'どうして？: [3] で 閉じた心 −2');
ok(state.nextBonusKakera === 1, 'どうして？: 次ターン 欠片＋1');
var rDoEven = loadKakera(putKakera(2), 'doushite');
ok(rDoEven.ok === false, 'どうして？: 偶数[2]は 入らない（弾かれる）');

// まって：偶数のみ。次に受けるノイズ −3
newBattle('sonchou'); state.enemy.nextNoiseDown = 0;
var rMa = loadKakera(putKakera(2), 'matte');
ok(rMa.ok && state.enemy.nextNoiseDown === 3, 'まって: [2] で 次ノイズ −3');
ok(loadKakera(putKakera(5), 'matte').ok === false, 'まって: 奇数[5]は 入らない（弾かれる）');

// 沈黙する：受容+2、捨てた音が1なら +5
newBattle('sonchou'); state.player.juyou = 0;
loadKakera(putKakera(4), 'chinmoku');
ok(state.player.juyou === 2, '沈黙する: [4]を捨てて 受容 +2');
newBattle('sonchou'); state.player.juyou = 0;
loadKakera(putKakera(1), 'chinmoku');
ok(state.player.juyou === 5, '沈黙する: [1]を捨てると 受容 +5（追加+3）');

/* ───────── 3) 任意の言葉装置（全部入り） ───────── */
// ありがとう：4以下のみ。受容＋音／次ノイズ−1
newBattle('sonchou'); state.player.juyou = 0; state.enemy.nextNoiseDown = 0;
var rAr = loadKakera(putKakera(4), 'arigatou');
ok(rAr.ok && state.player.juyou === 4 && state.enemy.nextNoiseDown === 1, 'ありがとう: [4] で 受容+4／次ノイズ−1');
ok(loadKakera(putKakera(5), 'arigatou').ok === false, 'ありがとう: [5]（5以上）は 入らない');

// いやだ：4以上のみ。閉じた心−8／自分にノイズ+2
newBattle('sonchou'); var h2 = state.enemy.heart; var n2 = state.player.noise;
var rIy = loadKakera(putKakera(5), 'iyada');
ok(rIy.ok && state.enemy.heart === h2 - 8, 'いやだ: [5] で 閉じた心 −8');
ok(state.player.noise === n2 - 2, 'いやだ: 反動で 自分のノイズ耐性 −2');
ok(loadKakera(putKakera(3), 'iyada').ok === false, 'いやだ: [3]（4未満）は 入らない');

// ほんとう？：同じ音の欠片2つで 閉じた心−10
newBattle('sonchou'); var h3 = state.enemy.heart;
var a3 = putKakera(3), b3 = putKakera(3);
var rH1 = loadKakera(a3, 'honto');
ok(rH1.ok && findDevice('honto').loaded.length === 1 && state.enemy.heart === h3, 'ほんとう？: 1つ目[3]は 装填して待機（まだ発動しない）');
var rH2 = loadKakera(b3, 'honto');
ok(rH2.ok && state.enemy.heart === h3 - 10, 'ほんとう？: 2つ目[3]で 発動 閉じた心 −10');
ok(findDevice('honto').loaded.length === 0, 'ほんとう？: 発動後は 装填がクリアされる');
// 違う音は2つ目に入らない
newBattle('sonchou');
loadKakera(putKakera(3), 'honto');
ok(loadKakera(putKakera(4), 'honto').ok === false, 'ほんとう？: 違う音[4]は 2つ目に 入らない');
ok(findDevice('honto').loaded.length === 1, 'ほんとう？: 弾かれても 1つ目は 装填されたまま');
ok(unloadDevice('honto') === true && findDevice('honto').loaded.length === 0, 'ほんとう？: もどす で 装填を解除できる');

/* ───────── 4) 白い欠片 / かすれ / 次ターン欠片＋ ───────── */
// 白い欠片：どの条件にも合う（偶数専用の まって に 白[3] が入る）＋受容ボーナス
newBattle('sonchou'); state.player.juyou = 0; state.enemy.nextNoiseDown = 0;
var rW = loadKakera(putKakera(3, { white: true }), 'matte');
ok(rW.ok, '白い欠片: 偶数専用の まって にも 入る（ワイルドカード）');
ok(state.player.juyou === BALANCE.whiteBonusBlock, '白い欠片: 使うと 受容 +' + BALANCE.whiteBonusBlock + '（ボーナス）');

// かすれ：次ターンの欠片1つが「音1」に固定される
newBattle('sonchou'); state.pendingKasure = 1; rollKakera();
ok(state.pool[0].value === 1 && state.pool[0].kasure === true, 'かすれ: 次ターンの欠片1つが 音1に固定');
ok(state.pendingKasure === 0, 'かすれ: 反映後は 予兆がリセットされる');

// 次ターン欠片＋1
newBattle('sonchou'); state.nextBonusKakera = 1; rollKakera();
ok(state.pool.length === BALANCE.kakeraPerTurn + 1, '欠片＋: 次ターンだけ 欠片が1つ多い');

/* ───────── 5) 受容・次ノイズ軽減・溜め ───────── */
// 受容でノイズ軽減：受容5でノイズ6 → 1だけ通る
newBattle('sonchou'); state.player.juyou = 5; state.player.noise = 24;
damageToPlayer(6, 'テスト');
ok(state.player.noise === 23, '受容: ノイズ6を 受容5で軽減 → 通過1で 耐性 24→23');
ok(state.player.juyou === 0, '受容: 使った分は消える');

// intentNoise：軽減と溜めを正直に反映
newBattle('sonchou');
state.enemy.charged = false; state.enemy.nextNoiseDown = 0;
ok(intentNoise({ noise: 6 }) === 6, '予告: ノイズ6 はそのまま6');
state.enemy.nextNoiseDown = 3;
ok(intentNoise({ noise: 6 }) === 3, '予告: 次ノイズ軽減3 で 6→3');
state.enemy.nextNoiseDown = 0; state.enemy.charged = true;
ok(intentNoise({ noise: 6 }) === 6 + BALANCE.chargeBonus, '予告: 溜め中は +' + BALANCE.chargeBonus);
ok(intentNoise({ noise: 0 }) === 0, '予告: 黙って見る（ノイズ0）は 0 のまま');

/* ───────── 6) 勝敗判定とメッセージ ───────── */
// 勝ち：閉じた心を0に
newBattle('sonchou'); state.enemy.heart = 4; dealToEnemy(6); checkResult();
ok(state.result === 'win' && state.enemy.heart === 0, '勝敗: 閉じた心0 → win（0で止まる）');
ok(WIN_TEXT.length === 5 && WIN_TEXT[0].indexOf('欠片のように') >= 0 && WIN_TEXT[2].indexOf('学校へ行け') >= 0,
  '勝利メッセージ: 5行・「欠片のように」「学校へ行け」を含む');

// 負け：ノイズ耐性を0に＝言葉がばらばら
newBattle('sonchou'); state.player.noise = 3; state.player.juyou = 0; damageToPlayer(6, '疑う'); checkResult();
ok(state.result === 'lose' && state.player.noise === 0, '勝敗: ノイズ耐性0 → lose（0で止まる）');
ok(LOSE_TEXT.length === 3 && LOSE_TEXT[0].indexOf('ばらばら') >= 0 && LOSE_TEXT[2].indexOf('ただの数字') >= 0,
  '敗北メッセージ: 3行・「ばらばら」「ただの数字」を含む');

/* ───────── 7) 1戦まるごと（ランダム込み）を最後まで回す ───────── */
// 出た欠片を全部「こんにちは」に入れて伝え続ける、現実的なオートプレイ。
// どんな出目でも 80ターン以内に勝敗が付き、例外が出ないことを確認する。
function autoPlayOnce() {
  newBattle('sonchou');
  var guard = 0;
  while (!state.result && guard < 80) {
    guard++;
    var safety = 0;
    while (state.phase === 'player' && !state.result && state.pool.length > 0 && safety < 20) {
      safety++;
      var id = state.pool[0].id;
      var r = loadKakera(id, 'konnichiwa'); // 任意条件なので必ず通る
      if (!r.ok) break;
    }
    if (state.result) break;
    endTurn();
    enemyTurn();
  }
  return { result: state.result, turns: state.turn, guard: guard };
}

var sawWin = false, sawLose = false, ranOk = true, anyResult = true;
for (var run = 0; run < 40; run++) {
  var r;
  try { r = autoPlayOnce(); }
  catch (e) { ranOk = false; lines.push('  ❌ オートプレイ例外: ' + e); break; }
  if (!r.result) { anyResult = false; lines.push('  ❌ 80ターンで決着せず（guard=' + r.guard + '）'); break; }
  if (r.result === 'win') sawWin = true;
  if (r.result === 'lose') sawLose = true;
}
ok(ranOk, 'オートプレイ: 40戦して例外なし');
ok(anyResult, 'オートプレイ: 毎回ちゃんと決着する');
ok(sawWin, 'オートプレイ: 勝てる試合がある（勝ち筋が存在）');
lines.push('  ' + (sawLose ? 'ℹ️ 敗北も観測（負け筋もある）' : 'ℹ️ 今回の40戦では敗北は出ず（伝え型は勝ちやすい）'));

/* ───────── レポート ───────── */
var header = '=== 言葉サイコロ装填バトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
