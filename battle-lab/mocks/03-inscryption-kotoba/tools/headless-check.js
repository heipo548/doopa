/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、盤面バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性10 / 閉じた心10 / 手札4 / 山札8 / 残響0 / 予告あり）
 *   ・供え言葉コスト（問い=重い で +1）
 *   ・言葉を置く／供えて置く（残響が増える）
 *   ・レーン処理（ぶつかる／届く／壁／まっすぐ／守る／こわれて残響）
 *   ・ほどける（心配を数ターン残すと 閉じた心が減る）
 *   ・もう一度（残響2で 捨て札から1枚 手元へ）
 *   ・勝敗判定（閉じた心0→win / ノイズ耐性0→lose）と 勝利/敗北メッセージ
 *   ・ランダムを含む“1戦まるごと”を最後まで回してもエラーが出ないこと
 *
 * 使い方（モックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
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

// テスト用：空きレーンに 指定IDの言葉を“供えなし”で直に置く（手札に無ければ作って差し込む）
function forceHand(defId) {
  var inst = { uid: 90000 + Math.floor(Math.random() * 100000), defId: defId };
  state.hand.push(inst);
  return inst.uid;
}

/* ───────── 1) 初期化 ───────── */
newBattle('sonchou');
ok(state.player.noise === 10 && state.player.maxNoise === 10, '初期: ノイズ耐性 10/10');
ok(state.enemy.heart === 10 && state.enemy.maxHeart === 10, '初期: 閉じた心 10/10');
ok(state.hand.length === 4, '初期: 手元の言葉 4枚');
ok(state.drawPile.length === 8, '初期: 山札 8枚（12-4）');
ok(state.echo === 0, '初期: 残響 0');
var intentCount = state.intent.filter(function (x) { return !!x; }).length;
ok(intentCount >= 1, '初期: 村長の予告がある（' + intentCount + '枚）');
ok(state.phase === 'player', '初期: プレイヤーの番');

/* ───────── 2) 供え言葉コスト（問い=重い で +1） ───────── */
newBattle('sonchou');
ok(effectiveOffer(CARD_LIBRARY.shinjite) === 2, '供え: 信じて は基本 2');
state.eBoard[0] = { uid: 1, defId: 'toi', dur: 3, age: 0 }; // 問い(重い)を場に
ok(effectiveOffer(CARD_LIBRARY.shinjite) === 3, '供え: 場に「問い(重い)」で +1 → 3');
ok(effectiveOffer(CARD_LIBRARY.konnichiwa) === 1, '供え: 供え0の言葉も 問いで +1 → 1');

/* ───────── 3) 置く／供えて置く ───────── */
// 供えなしで こんにちは を置く
newBattle('sonchou');
var u1 = forceHand('konnichiwa');
ok(doPlaceWord(u1, 0, []) === true, '設置: 供えなしで こんにちは を声の道1へ');
ok(state.pBoard[0] && state.pBoard[0].defId === 'konnichiwa' && state.pBoard[0].dur === 2, '設置: 盤面に置かれ こわれにくさ2');

// 2つ供えて 信じて を置く（残響 +2）
newBattle('sonchou');
var a = forceHand('konnichiwa'); doPlaceWord(a, 0, []);
var b = forceHand('konnichiwa'); doPlaceWord(b, 1, []);
var echoBefore = state.echo;
var ush = forceHand('shinjite');
var offs = [state.pBoard[0].uid, state.pBoard[1].uid];
ok(doPlaceWord(ush, 2, offs) === true, '供え設置: 信じて を 2つ供えて 置く');
ok(state.echo === echoBefore + 2, '供え設置: 残響が +2 された');
ok(state.pBoard[2] && state.pBoard[2].defId === 'shinjite', '供え設置: 信じて が盤面に');
ok(!state.pBoard[0] && !state.pBoard[1], '供え設置: 供えた2つは 盤面から消えた');
// 供えが足りなければ置けない
newBattle('sonchou');
var ush2 = forceHand('shinjite');
ok(doPlaceWord(ush2, 0, []) === false, '供え不足: 供えなしで 信じて は置けない');

/* ───────── 4) レーン処理 ───────── */
// ぶつかる：こんにちは(届く1) vs 疑い(届く1) → 互いに こわれにくさ -1
newBattle('sonchou');
state.pBoard[0] = { uid: 11, defId: 'konnichiwa', dur: 2, age: 0 };
state.eBoard[0] = { uid: 12, defId: 'utagai', dur: 2, age: 0 };
state.eBoard[1] = null; state.eBoard[2] = null; state.eBoard[3] = null;
resolveLanes();
ok(state.pBoard[0] && state.pBoard[0].dur === 1, 'ぶつかる: こんにちは のこわれにくさ 2→1');
ok(state.eBoard[0] && state.eBoard[0].dur === 1, 'ぶつかる: 疑い のこわれにくさ 2→1');

// 届く（まっすぐ）：正面が空の 信じて は 届く力3+1=4
newBattle('sonchou');
for (var i = 0; i < 4; i++) state.eBoard[i] = null;
state.pBoard[0] = { uid: 21, defId: 'shinjite', dur: 2, age: 0 };
var hb = state.enemy.heart;
resolveLanes();
ok(state.enemy.heart === hb - 4, 'まっすぐ: 正面が空の信じて → 閉じた心 -4');

// 壁：沈黙する は 閉じた心に届かない
newBattle('sonchou');
for (var j = 0; j < 4; j++) state.eBoard[j] = null;
state.pBoard[0] = { uid: 31, defId: 'chinmoku', dur: 4, age: 0 };
var hb2 = state.enemy.heart;
resolveLanes();
ok(state.enemy.heart === hb2, '壁: 沈黙する は 閉じた心に届かない');

// 守る：だいじょうぶ(届く0/守る) vs 疑い(届く1) → だいじょうぶ は -0（守るで軽減）
newBattle('sonchou');
state.pBoard[0] = { uid: 41, defId: 'daijoubu', dur: 3, age: 0 };
state.eBoard[0] = { uid: 42, defId: 'utagai', dur: 2, age: 0 };
for (var k = 1; k < 4; k++) state.eBoard[k] = null;
resolveLanes();
ok(state.pBoard[0] && state.pBoard[0].dur === 3, '守る: だいじょうぶ は こわれにくさを 減らさない');

// こわれて 残響：こんにちは(残1) が 疑い(届く1) に当たって 0 → 捨て札＋残響+1
newBattle('sonchou');
state.pBoard[0] = { uid: 51, defId: 'konnichiwa', dur: 1, age: 0 };
state.eBoard[0] = { uid: 52, defId: 'utagai', dur: 5, age: 0 };
for (var m = 1; m < 4; m++) state.eBoard[m] = null;
var echo0 = state.echo, disc0 = state.discard.length;
resolveLanes();
ok(!state.pBoard[0], 'こわれる: こんにちは が 場から消えた');
ok(state.echo === echo0 + 1, 'こわれる: 残響 +1');
ok(state.discard.length === disc0 + 1, 'こわれる: 捨て札へ移動');

/* ───────── 5) ほどける（心配） ───────── */
newBattle('sonchou');
for (var n = 0; n < 4; n++) state.eBoard[n] = null;
state.eBoard[0] = { uid: 61, defId: 'shinpai', dur: 2, age: 0 };
state.enemy.heart = 10;
agingAndHodokeru(); // age 1
agingAndHodokeru(); // age 2
ok(state.eBoard[0] && state.enemy.heart === 10, 'ほどける: 2ターンでは まだ ほどけない');
agingAndHodokeru(); // age 3 → ほどける
ok(!state.eBoard[0] && state.enemy.heart === 8, 'ほどける: 3ターン残すと 閉じた心 -2');

/* ───────── 6) もう一度（残響2で 捨て札から1枚） ───────── */
newBattle('sonchou');
state.discard.push({ uid: 71, defId: 'konnichiwa' });
state.echo = 2;
var um = forceHand('mouichido');
var handLenBefore = state.hand.length; // forceHand 後の枚数
ok(doEchoCard(um) === true, 'もう一度: 残響2で 発動できる');
ok(state.echo === 0, 'もう一度: 残響を 2 消費');
// 「もう一度」自身は捨て札へ・代わりに1枚戻る → 手札枚数は ±0（-1使用 +1回収）
ok(state.hand.length === handLenBefore, 'もう一度: 捨て札から 1枚 手元へ戻る');
// 残響不足なら 不発
newBattle('sonchou');
state.discard.push({ uid: 72, defId: 'konnichiwa' });
state.echo = 1;
var um2 = forceHand('mouichido');
ok(doEchoCard(um2) === false, 'もう一度: 残響不足では 使えない');

/* ───────── 7) 勝敗判定とメッセージ ───────── */
// 勝ち：正面が空の信じて で 閉じた心を 0 に
newBattle('sonchou');
for (var p2 = 0; p2 < 4; p2++) state.eBoard[p2] = null;
state.enemy.heart = 3;
state.pBoard[0] = { uid: 81, defId: 'shinjite', dur: 2, age: 0 };
resolveLanes(); checkResult();
ok(state.result === 'win' && state.enemy.heart === 0, '勝敗: 閉じた心0 → win（0で止まる）');
ok(WIN_TEXT.length >= 3 && WIN_TEXT.join('').indexOf('学校へ行け') >= 0, '勝利メッセージ: 「学校へ行け」を含む');

// 負け：村長の疑いが 空きレーンの L に届いて ノイズ耐性0
newBattle('sonchou');
for (var q = 0; q < 4; q++) { state.pBoard[q] = null; state.eBoard[q] = null; }
state.player.noise = 1;
state.eBoard[0] = { uid: 91, defId: 'utagai', dur: 2, age: 0 };
resolveLanes(); checkResult();
ok(state.result === 'lose' && state.player.noise === 0, '勝敗: ノイズ耐性0 → lose（0で止まる）');
ok(LOSE_TEXT.join('').indexOf('ばらばら') >= 0, '敗北メッセージ: 「ばらばら」を含む');

/* ───────── 8) 1戦まるごと（ランダム込み）を最後まで回す ───────── */
// 攻め重視のオートプレイ：空きレーンに 攻撃言葉を置き、可能なら供えて信じて。
function firstEmptyLane() {
  for (var i = 0; i < state.lanes; i++) if (!state.pBoard[i]) return i;
  return -1;
}
function firstHandOfId(defId) {
  for (var i = 0; i < state.hand.length; i++) if (state.hand[i].defId === defId) return state.hand[i];
  return null;
}
function pickOwnOfferings(need) {
  var out = [];
  for (var i = 0; i < state.pBoard.length && out.length < need; i++) {
    if (state.pBoard[i]) out.push(state.pBoard[i].uid);
  }
  return out;
}
function placeBest() {
  var lane = firstEmptyLane();
  if (lane < 0) return false;
  // 残響が貯まっていれば もう一度 で言葉を回収
  var mh = firstHandOfId('mouichido');
  if (mh && state.echo >= CARD_LIBRARY.mouichido.echoCost && state.discard.length > 0) {
    if (doEchoCard(mh.uid)) return true;
  }
  // 信じて（供えが足りるとき）
  var sh = firstHandOfId('shinjite');
  if (sh) {
    var need = effectiveOffer(CARD_LIBRARY.shinjite);
    if (ownBoardCount() >= need) {
      if (doPlaceWord(sh.uid, lane, pickOwnOfferings(need))) return true;
    }
  }
  // 供え0で出せる言葉（攻撃 → 壁 の順）
  var order = ['konnichiwa', 'doushite', 'daijoubu', 'chinmoku'];
  for (var o = 0; o < order.length; o++) {
    var h = firstHandOfId(order[o]);
    if (!h) continue;
    var nd = effectiveOffer(CARD_LIBRARY[order[o]]);
    if (ownBoardCount() < nd) continue;
    if (doPlaceWord(h.uid, lane, pickOwnOfferings(nd))) return true;
  }
  return false;
}
function autoPlayOnce() {
  newBattle('sonchou');
  var guard = 0;
  while (!state.result && guard < 80) {
    guard++;
    var safety = 0;
    while (state.phase === 'player' && !state.result && safety < 40) {
      safety++;
      if (!placeBest()) break;
    }
    if (state.result) break;
    endTurn();
    resolveTurn();
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
ok(ranOk, 'オートプレイ: 40戦して 例外なし');
ok(anyResult, 'オートプレイ: 毎回ちゃんと決着する');
ok(sawWin, 'オートプレイ: 勝てる試合がある（勝ち筋が存在）');
lines.push('  ' + (sawLose ? 'ℹ️ 敗北も観測（負け筋もある）' : 'ℹ️ 今回の40戦では敗北は出ず（盤を埋める攻め型は勝ちやすい）'));

/* ───────── レポート ───────── */
var header = '=== 言葉を捧げる盤面バトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
