/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性40 / 閉じた心42 / 手札5 / こころ3）
 *   ・効果の数値（伝える6・受容5・ほころび×1.5・迷い-2）
 *   ・受容によるノイズ軽減
 *   ・勝敗判定（閉じた心0→win / ノイズ耐性0→lose）と勝利/敗北メッセージ
 *   ・ランダムを含む“1戦まるごと”を最後まで回してもエラーが出ないこと
 *
 * 使い方（モックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 * もしくは絶対パスで：
 *   MOCKDIR="/abs/.../01-slay-the-spire-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

// 読み込み元フォルダを決める：環境変数 MOCKDIR 優先、無ければカレント
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

/* ───────── 1) 初期化 ───────── */
newBattle('sonchou');
ok(state.player.noise === 40 && state.player.maxNoise === 40, '初期: ノイズ耐性 40/40');
ok(state.enemy.heart === 42 && state.enemy.maxHeart === 42, '初期: 閉じた心 42/42');
ok(state.hand.length === 5, '初期: 手札5枚（今いえる言葉）');
ok(state.drawPile.length === 5, '初期: 山札5枚（10-5）');
ok(state.energy === 3, '初期: こころ3');
ok(!!state.enemy.intent, '初期: 次の感情（行動予告）がある');
ok(state.phase === 'player', '初期: プレイヤーの番');

/* ───────── 2) 効果の数値（低レベル関数を直接たたく＝決定的） ───────── */
// 受容（だいじょうぶ）：block 5
newBattle('sonchou');
state.player.juyou = 0;
applyEffect(CARD_LIBRARY.daijoubu);
ok(state.player.juyou === 5, '効果: だいじょうぶ で 受容 +5');

// 伝える（こんにちは）：6
newBattle('sonchou');
var h0 = state.enemy.heart;
dealToEnemy(6, true);
ok(state.enemy.heart === h0 - 6, '効果: こんにちは で 閉じた心 -6');

// ほころび：次の伝える ×1.5（6→9）。1スタック消費
newBattle('sonchou');
state.enemy.hokorobi = 1;
var h1 = state.enemy.heart;
dealToEnemy(6, true);
ok(state.enemy.heart === h1 - 9, 'ほころび: 6 → 9（×1.5）');
ok(state.enemy.hokorobi === 0, 'ほころび: 使ったら消費される');

// 迷い：次の伝える -2（6→4）。1スタック消費
newBattle('sonchou');
state.player.mayoi = 1;
var h2 = state.enemy.heart;
dealToEnemy(6, true);
ok(state.enemy.heart === h2 - 4, '迷い: 6 → 4（-2）');
ok(state.player.mayoi === 0, '迷い: 使ったら消費される');

// 受容によるノイズ軽減：受容5でノイズ8 → 3だけ通る
newBattle('sonchou');
state.player.juyou = 5;
state.player.noise = 40;
damageToPlayer(8, 'テスト');
ok(state.player.noise === 37, '受容: ノイズ8を受容5で軽減 → 通過3で 耐性 40→37');
ok(state.player.juyou === 0, '受容: 使った分は消える');

// どうして？：1枚引く＋相手にほころび1
newBattle('sonchou');
var hand0 = state.hand.length;
applyEffect(CARD_LIBRARY.doushite);
ok(state.enemy.hokorobi === 1, 'どうして？: 相手にほころび+1');
ok(state.hand.length === hand0 + 1, 'どうして？: 言葉を1枚引く');

/* ───────── 3) 勝敗判定とメッセージ ───────── */
// 勝ち：閉じた心を0以下に
newBattle('sonchou');
state.enemy.heart = 5;
dealToEnemy(6, true);
checkResult();
ok(state.result === 'win' && state.enemy.heart === 0, '勝敗: 閉じた心0 → win（0で止まる）');
ok(WIN_TEXT.length === 3 && WIN_TEXT[2].indexOf('学校へ行け') >= 0, '勝利メッセージ: 3行・「学校へ行け」を含む');

// 負け：ノイズ耐性を0に
newBattle('sonchou');
state.player.noise = 3;
state.player.juyou = 0;
damageToPlayer(8, '疑う');
checkResult();
ok(state.result === 'lose' && state.player.noise === 0, '勝敗: ノイズ耐性0 → lose（0で止まる）');
ok(LOSE_TEXT.length === 2 && LOSE_TEXT[0].indexOf('ばらばら') >= 0, '敗北メッセージ: 2行・「ばらばら」を含む');

/* ───────── 4) 1戦まるごと（ランダム込み）を最後まで回す ───────── */
// 攻めつつ余ったこころで受けとめる、現実的なオートプレイ。
// どんな引きでも 60ターン以内に勝敗が付き、例外が出ないことを確認する。
function autoPlayOnce() {
  newBattle('sonchou');
  var guard = 0;
  while (!state.result && guard < 60) {
    guard++;
    // 手札を、伝える/たずねる優先 → 残りエナジーで受けとめる、の順で使う
    var safety = 0;
    while (state.phase === 'player' && !state.result && safety < 30) {
      safety++;
      var played = false;
      // まず damage/draw 系
      for (var i = 0; i < state.hand.length; i++) {
        var d = CARD_LIBRARY[state.hand[i].defId];
        if (d.cost <= state.energy && (d.effect.damage || d.effect.draw)) {
          if (playCard(state.hand[i].uid)) { played = true; break; }
        }
      }
      if (played) continue;
      // 次に block 系（沈黙する含む）
      for (var j = 0; j < state.hand.length; j++) {
        var d2 = CARD_LIBRARY[state.hand[j].defId];
        if (d2.cost <= state.energy && d2.effect.block) {
          if (playCard(state.hand[j].uid)) { played = true; break; }
        }
      }
      if (!played) break; // もう打てる手がない
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
  if (!r.result) { anyResult = false; lines.push('  ❌ 60ターンで決着せず（guard=' + r.guard + '）'); break; }
  if (r.result === 'win') sawWin = true;
  if (r.result === 'lose') sawLose = true;
}
ok(ranOk, 'オートプレイ: 40戦して例外なし');
ok(anyResult, 'オートプレイ: 毎回ちゃんと決着する');
ok(sawWin, 'オートプレイ: 勝てる試合がある（勝ち筋が存在）');
// 負け筋は引き次第なので必須にはしないが、観測できたら表示する
lines.push('  ' + (sawLose ? 'ℹ️ 敗北も観測（負け筋もある）' : 'ℹ️ 今回の40戦では敗北は出ず（攻め型は勝ちやすい）'));

/* ───────── レポート ───────── */
var header = '=== 言葉デッキバトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
