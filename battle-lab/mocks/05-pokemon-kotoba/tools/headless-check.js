/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、ポケモン型バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性36 / 閉じた心40 / 4技の残響 / 感情=疑い）
 *   ・タイプ相性（疑い×あいさつ=1.5 / 疑い×感謝=0.5 / 不安×安心=1.5 …）
 *   ・効果量計算（こんにちは 8×1.5=12 / 警戒-20% / 迷い-30% / ほころび+50%）
 *   ・受容と「しずけさ」によるノイズ軽減
 *   ・命中判定（外れても残響は減る／問いかけ後は-20%）
 *   ・感情タイプの変化（どうして？で隠し事 / 沈黙する2回で沈黙）
 *   ・勝敗判定（閉じた心0→win / ノイズ耐性0→lose）とメッセージ
 *   ・ランダムを含む“1戦まるごと”を最後まで回してもエラーが出ないこと
 *
 * 使い方（モックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 * もしくは絶対パスで：
 *   MOCKDIR="/abs/.../05-pokemon-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
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

// Math.random を一時的に固定値に差し替えるヘルパー（命中・確率を決定的にする）
var _origRandom = Math.random;
function stubRandom(v) { Math.random = function () { return v; }; }
function restoreRandom() { Math.random = _origRandom; }

/* ───────── 1) 初期化 ───────── */
newBattle('sonchou');
ok(state.player.noise === 36 && state.player.maxNoise === 36, '初期: ノイズ耐性 36/36');
ok(state.enemy.heart === 40 && state.enemy.maxHeart === 40, '初期: 閉じた心 40/40');
ok(state.moves.length === 4, '初期: 言葉技4つ');
ok(state.moves[0].id === 'konnichiwa' && state.moves[0].pp === 20, '初期: こんにちは 残響20');
ok(state.moves[2].id === 'doushite' && state.moves[2].pp === 10, '初期: どうして？ 残響10');
ok(state.enemy.emotion === 'utagai', '初期: 村長の感情タイプ＝疑い');
ok(state.enemy.keikai === true && keikaiActive() === true, '初期: 村長は警戒（1ターン目は有効）');
ok(state.phase === 'player', '初期: Lの番');

/* ───────── 2) タイプ相性（決定的な純関数） ───────── */
ok(typeMultiplier('aisatsu', 'utagai') === 1.5, '相性: 疑い×あいさつ = 1.5（よく届く）');
ok(typeMultiplier('toi', 'utagai') === 1.5, '相性: 疑い×問い = 1.5');
ok(typeMultiplier('kansha', 'utagai') === 0.5, '相性: 疑い×感謝 = 0.5（少しずれる）');
ok(typeMultiplier('anshin', 'utagai') === 1.0, '相性: 疑い×安心 = 1.0（普通）');
ok(typeMultiplier('anshin', 'fuan') === 1.5, '相性: 不安×安心 = 1.5');
ok(typeMultiplier('toi', 'fuan') === 0.5, '相性: 不安×問い = 0.5');
ok(typeMultiplier('toi', 'kakushigoto') === 1.5, '相性: 隠し事×問い = 1.5');
ok(typeMultiplier('aisatsu', 'kakushigoto') === 0.5, '相性: 隠し事×あいさつ = 0.5');
ok(relKey(1.5) === 'effective' && relKey(0.5) === 'resisted' && relKey(1.0) === 'neutral', '相性: ログ用キーの対応');

/* ───────── 3) 効果量計算（applyHeart を直接たたく＝決定的） ───────── */
// 基本：こんにちは 8 × 相性1.5 = 12（警戒を外して純粋に確認）
newBattle('sonchou');
state.enemy.keikai = false;
var h0 = state.enemy.heart;
applyHeart(8 * typeMultiplier('aisatsu', 'utagai'), { primary: true });
ok(state.enemy.heart === h0 - 12, '効果: こんにちは 8×1.5 = 12（閉じた心 -12）');

// 警戒：12 × 0.8 = 9.6 → 四捨五入 10
newBattle('sonchou'); // 1ターン目＝警戒中
var h1 = state.enemy.heart;
applyHeart(12, { primary: true });
ok(state.enemy.heart === h1 - 10, '警戒: 12 × 0.8 = 10（最初の3ターンは -20%）');

// 迷い：12 × 0.7 = 8.4 → 8（消費される）
newBattle('sonchou');
state.enemy.keikai = false;
state.player.mayoi = 1;
var h2 = state.enemy.heart;
applyHeart(12, { primary: true });
ok(state.enemy.heart === h2 - 8, '迷い: 12 × 0.7 = 8（次の言葉技 -30%）');
ok(state.player.mayoi === 0, '迷い: 使ったら消費される');

// ほころび：12 × 1.5 = 18（消費される）
newBattle('sonchou');
state.enemy.keikai = false;
state.enemy.hokorobi = 1;
var h3 = state.enemy.heart;
applyHeart(12, { primary: true });
ok(state.enemy.heart === h3 - 18, 'ほころび: 12 × 1.5 = 18（次に受ける +50%）');
ok(state.enemy.hokorobi === 0, 'ほころび: 使ったら消費される');

/* ───────── 4) 受容 / しずけさ によるノイズ軽減 ───────── */
// 受容5でノイズ8 → 3だけ通る
newBattle('sonchou');
state.player.juyou = 5;
state.player.noise = 36;
damageToPlayer(8, 'テスト');
ok(state.player.noise === 33, '受容: ノイズ8を受容5で軽減 → 通過3で 耐性 36→33');
ok(state.player.juyou === 0, '受容: 使った分は消える');

// しずけさ(沈黙する)で 次のノイズ -3：ノイズ6 → 3通過
newBattle('sonchou');
state.player.mitigateNext = 3;
state.player.juyou = 0;
state.player.noise = 36;
damageToPlayer(6, 'テスト');
ok(state.player.noise === 33, 'しずけさ: ノイズ6を -3軽減 → 通過3で 耐性 36→33');
ok(state.player.mitigateNext === 0, 'しずけさ: 使ったら消える');

/* ───────── 5) 残響(PP) と 命中判定 ───────── */
// こんにちは（命中100）を使うと 残響が1減る
newBattle('sonchou');
stubRandom(0.0); // すべて成功側に倒す
useMove('konnichiwa');
restoreRandom();
ok(state.moves[0].pp === 19, '残響: こんにちは 使用で 20→19');

// 残響0なら使えない（false が返る／盤面は進まない）
newBattle('sonchou');
state.moves[0].pp = 0;
var usedEmpty = useMove('konnichiwa');
ok(usedEmpty === false && state.phase === 'player', '残響0: 「もう残っていない」で手番は消費されない');

// 命中失敗でも残響は1減る（どうして？ 命中90 を必ず外す）
newBattle('sonchou');
stubRandom(0.95); // 0.95 < 0.9 は false ＝ 外れる
var ppBefore = state.moves[2].pp;
useMove('doushite');
restoreRandom();
ok(state.moves[2].pp === ppBefore - 1, '命中失敗: 外しても残響は1減る');
ok(state.phase === 'enemy', '命中失敗: それでも手番は村長へ移る');

/* ───────── 6) 感情タイプの変化 ───────── */
// どうして？成功（random=0で全確率を通す）→ 隠し事 ＆ ほころび付与
newBattle('sonchou');
stubRandom(0.0);
useMove('doushite');
restoreRandom();
ok(state.enemy.emotion === 'kakushigoto', 'どうして？: 30%成功で 感情→隠し事');
ok(state.enemy.hokorobi === 1, 'どうして？: 低確率で ほころび付与');

// 沈黙する 2回で 感情→沈黙
newBattle('sonchou');
useMove('chinmoku');
state.phase = 'player'; // テスト都合で手番を戻す
useMove('chinmoku');
ok(state.player.chinmokuCount === 2 && state.enemy.emotion === 'chinmoku', '沈黙する: 2回で 感情→沈黙');

// だいじょうぶ：受容+8、相手が不安なら追加で閉じた心 -5
newBattle('sonchou');
state.enemy.keikai = false;
state.enemy.emotion = 'fuan';
var hf = state.enemy.heart;
useMove('daijoubu');
ok(state.player.juyou === 8, 'だいじょうぶ: 受容 +8');
ok(state.enemy.heart === hf - 5, 'だいじょうぶ: 不安の相手に 追加で 閉じた心 -5');

/* ───────── 7) 勝敗判定とメッセージ ───────── */
// 勝ち：閉じた心を残りわずかにして こんにちは
newBattle('sonchou');
stubRandom(0.0);
state.enemy.heart = 5;
useMove('konnichiwa'); // 警戒中でも 10 入るので 0 以下
restoreRandom();
ok(state.result === 'win' && state.enemy.heart === 0, '勝敗: 閉じた心0 → win（0で止まる）');
ok(WIN_TEXT.length === 5 && WIN_TEXT[2].indexOf('学校へ行け') >= 0, '勝利メッセージ: 「学校へ行け」を含む');

// 負け：ノイズ耐性0
newBattle('sonchou');
state.player.noise = 3; state.player.juyou = 0; state.player.mitigateNext = 0;
damageToPlayer(8, '疑う');
checkResult();
ok(state.result === 'lose' && state.player.noise === 0, '勝敗: ノイズ耐性0 → lose（0で止まる）');
ok(LOSE_TEXT.length === 3 && LOSE_TEXT[0].indexOf('ばらばら') >= 0, '敗北メッセージ: 「ばらばら」を含む');

/* ───────── 8) 1戦まるごと（ランダム込み）を最後まで回す ───────── */
// 攻め手（damage>0）を優先し、無ければ支え技を使う、現実的なオートプレイ。
function autoPlayOnce() {
  newBattle('sonchou');
  var guard = 0;
  while (!state.result && guard < 300) {
    guard++;
    if (state.phase === 'player') {
      // 残響のある「攻め技」を優先、無ければ残響のある任意の技
      var pick = null;
      for (var i = 0; i < state.moves.length; i++) {
        var d = MOVE_LIBRARY[state.moves[i].id];
        if (state.moves[i].pp > 0 && d.effect.damage) { pick = state.moves[i].id; break; }
      }
      if (!pick) {
        for (var j = 0; j < state.moves.length; j++) {
          if (state.moves[j].pp > 0) { pick = state.moves[j].id; break; }
        }
      }
      if (!pick) break; // 打てる言葉がもう無い（通常は決着が先）
      useMove(pick);
    } else if (state.phase === 'enemy') {
      enemyTurn();
    }
  }
  return { result: state.result, turns: state.turn, guard: guard };
}

var sawWin = false, sawLose = false, ranOk = true, anyResult = true;
for (var run = 0; run < 40; run++) {
  var r;
  try { r = autoPlayOnce(); }
  catch (e) { ranOk = false; lines.push('  ❌ オートプレイ例外: ' + e); break; }
  if (!r.result) { anyResult = false; lines.push('  ❌ 決着せず（guard=' + r.guard + '）'); break; }
  if (r.result === 'win') sawWin = true;
  if (r.result === 'lose') sawLose = true;
}
ok(ranOk, 'オートプレイ: 40戦して例外なし');
ok(anyResult, 'オートプレイ: 毎回ちゃんと決着する');
ok(sawWin, 'オートプレイ: 勝てる試合がある（勝ち筋が存在）');
lines.push('  ' + (sawLose ? 'ℹ️ 敗北も観測（負け筋もある）' : 'ℹ️ 今回の40戦では敗北は出ず（攻め型は勝ちやすい）'));

/* ───────── レポート ───────── */
var header = '=== 言葉タイプ相性バトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
