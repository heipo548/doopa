/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、尋問バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性5 / 閉じた心3 / 第1証言4行 / 選択なし）
 *   ・たずねる/考える/言葉の突きつけ では ノイズが減らない
 *   ・間違った記憶の突きつけ で ノイズ -1（欠けた名札も含む）
 *   ・正しい発言×正しい記憶 で 閉じた心 -1 → 次の証言へ
 *   ・第2証言は b3 をたずねると b5「学校の鍵は…」が出現し、そこが正解になる
 *   ・3つの矛盾を解くと勝利（本音のページ）／ノイズ0で敗北
 *   ・特別サブ反応（第3証言3番に「だいじょうぶ」）が出る
 *
 * 使い方（このモックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 * もしくは絶対パスで：
 *   MOCKDIR="/abs/.../07-gyakuten-saiban-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
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
// ログ末尾ブロックの tone を見るヘルパ
function lastTone() { return state.log[state.log.length - 1].tone; }
function logText() { // 直近ブロックの全行を連結
  var b = state.log[state.log.length - 1];
  return b.lines.join('\n');
}

/* ───────── 1) 初期化 ───────── */
newBattle();
ok(state.player.noise === 5 && state.player.maxNoise === 5, '初期: ノイズ耐性 5/5');
ok(state.enemy.heart === 3 && state.enemy.maxHeart === 3, '初期: 閉じた心 3/3');
ok(state.stageIndex === 0, '初期: 第1証言から始まる');
ok(visibleLines().length === 4, '初期: 第1証言は4行');
ok(state.selected === null, '初期: 発言は未選択');
ok(state.result === null, '初期: 勝敗はまだ付いていない');
ok(heartBar() === '■■■', '初期: 閉じた心の表示 ■■■');

/* ───────── 2) 選択のルール ───────── */
newBattle();
ok(selectLine('a1') === true, '選択: 表示中の発言は選べる（a1）');
ok(selectLine('zzz') === false, '選択: 存在しない行は選べない');
ok(selectLine('b5') === false, '選択: 隠れている行(b5)は選べない');

/* ───────── 3) たずねる/考える/言葉 ではノイズが減らない ───────── */
newBattle();
selectLine('a1'); var n0 = state.player.noise; var len0 = state.log.length;
ask();
ok(state.player.noise === n0, 'たずねる: ノイズは減らない');
ok(state.log.length > len0, 'たずねる: ログが増える');
ok(state.log[state.log.length - 1].tone === 'hint', 'たずねる(a1): 最後にヒントが出る');

newBattle();
selectLine('a2'); think();
ok(state.player.noise === 5, '考える: ノイズは減らない');
ok(lastTone() === 'think' && logText().indexOf('論点') >= 0, '考える: 論点が表示される');

newBattle();
selectLine('a1'); present('word', 'konnichiwa');
ok(state.player.noise === 5, '言葉(こんにちは): ノイズは減らない');
ok(lastTone() === 'sub', '言葉: サブ反応として表示');
ok(state.enemy.heart === 3 && state.stageIndex === 0, '言葉: 進行しない（正解にならない）');

// 防御：'memory'/'word' 以外の種別は安全に無視（正解なら本来 a1×techou だが種別違いで誤進行しない）
newBattle();
selectLine('a1'); var bogus = present('bogus', 'techou');
ok(bogus === null && state.enemy.heart === 3 && state.player.noise === 5,
   '防御: 未知の種別は無視（進行も減点もしない）');

/* ───────── 4) 間違った記憶 → ノイズ -1 ───────── */
newBattle();
selectLine('a1'); present('memory', 'kagi'); // a1 の正解は手帳。鍵は誤り
ok(state.player.noise === 4, '間違い: a1 に学校の鍵 → ノイズ 5→4');
ok(lastTone() === 'fail', '間違い: 失敗ログ（fail）が出る');
ok(state.enemy.heart === 3 && state.stageIndex === 0, '間違い: 進行しない');

newBattle();
selectLine('a1'); present('memory', 'nafuda'); // 欠けた名札も今回は誤り
ok(state.player.noise === 4, '間違い: 欠けた名札 → ノイズ 5→4');
ok(logText().indexOf('まだ早い') >= 0, '間違い: 名札は専用の意味深反応が出る');

newBattle();
selectLine('a2'); present('memory', 'techou'); // 手帳は正解だが対象がa2で誤り
ok(state.player.noise === 4, '間違い: 正しい記憶でも対象がずれると ノイズ -1');

/* ───────── 5) 正解 → 閉じた心 -1 → 次の証言へ ───────── */
newBattle();
selectLine('a1'); var r1 = present('memory', 'techou');
ok(r1 && r1.type === 'success' && r1.advanced === true, '正解(第1): success かつ次へ');
ok(state.enemy.heart === 2 && heartBar() === '■■□', '正解(第1): 閉じた心 3→2（■■□）');
ok(state.stageIndex === 1, '正解(第1): 第2証言へ');
ok(state.selected === null, '正解後: 選択がリセットされる');
ok(state.player.noise === 5, '正解(第1): ノイズは減っていない');

/* ───────── 6) 第2証言：b3 をたずねると b5 が出現 → そこが正解 ───────── */
// （第1証言を解いた続きの state を使う）
ok(visibleLines().length === 4, '第2証言: 最初は4行（b5は隠れている）');
ok(selectLine('b5') === false, '第2証言: b5 は出現前は選べない');
selectLine('b3'); ask();
ok(visibleLines().length === 5, '第2証言: b3 をたずねると b5 が出現（5行に）');
selectLine('b5'); var r2 = present('memory', 'kagi');
ok(r2 && r2.type === 'success', '正解(第2): b5 に学校の鍵 → success');
ok(state.enemy.heart === 1 && state.stageIndex === 2, '正解(第2): 閉じた心 2→1・第3証言へ');

/* ───────── 7) 第3証言：特別サブ反応 → 正解 → 勝利 ───────── */
selectLine('c3'); present('word', 'daijoubu');
ok(logText().indexOf('わしが言うべき言葉だ') >= 0, '第3証言: c3 に「だいじょうぶ」で特別サブ反応');
ok(state.player.noise === 5, 'サブ反応: ノイズは減らない');

selectLine('c4'); var r3 = present('memory', 'rakugaki');
ok(r3 && r3.win === true, '正解(第3): 子どもの落書き → 勝利');
ok(state.enemy.heart === 0 && heartBar() === '□□□', '勝利: 閉じた心 0（□□□）');
ok(state.result === 'win', '勝利: result = win');
ok(WIN_TEXT.length > 0 && WIN_TEXT.join('\n').indexOf('本音のページ') >= 0, '勝利: 本音のページが用意されている');
// 決着後は操作を受け付けない
var afterWin = state.player.noise;
selectLine('c1'); present('memory', 'kagi');
ok(state.player.noise === afterWin && state.result === 'win', '決着後: それ以上は進まない');

/* ───────── 8) 敗北：ノイズ0 ───────── */
newBattle();
selectLine('a1');
for (var i = 0; i < 5; i++) present('memory', 'kagi'); // 間違いを5回
ok(state.player.noise === 0 && state.result === 'lose', '敗北: 間違い5回でノイズ0 → lose');
ok(LOSE_TEXT.join('\n').indexOf('ほんとう') >= 0, '敗北: 「ほんとう」と「うそ」の演出が用意されている');

/* ───────── 9) リスタート ───────── */
restart();
ok(state.player.noise === 5 && state.enemy.heart === 3 && state.stageIndex === 0 && state.result === null,
   'リスタート: すべて初期状態に戻る');

/* ───────── 10) 正攻法フルクリア（無駄ミスなし）───────── */
function solveAll() {
  newBattle();
  selectLine('a1'); present('memory', 'techou');   // 第1
  selectLine('b3'); ask();                          // b5 を出す
  selectLine('b5'); present('memory', 'kagi');       // 第2
  selectLine('c4'); present('memory', 'rakugaki');    // 第3
  return { result: state.result, noise: state.player.noise };
}
var f = solveAll();
ok(f.result === 'win' && f.noise === 5, 'フルクリア: 正解だけ選べばノイズ満タンのまま勝利');

/* ───────── 11) 言葉はどこに突きつけてもノイズを減らさない ───────── */
newBattle();
var safeNoise = true;
var wordIds = ['konnichiwa', 'doushite', 'daijoubu', 'chinmoku'];
var lineIds = ['a1', 'a2', 'a3', 'a4'];
for (var w = 0; w < wordIds.length; w++) {
  for (var l = 0; l < lineIds.length; l++) {
    selectLine(lineIds[l]);
    present('word', wordIds[w]);
    if (state.player.noise !== 5) safeNoise = false;
  }
}
ok(safeNoise && state.stageIndex === 0, '言葉: どの組合せでもノイズ5のまま・進行もしない');

/* ───────── レポート ───────── */
var header = '=== 言葉の矛盾を突く尋問バトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
