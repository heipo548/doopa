/*
 * headless-check.js — DOM非依存コア(data/engine)の回帰確認（Node不要・JXAで動く）
 *
 * 目的：ブラウザを開かずに、ペルソナ型バトルの「進行ルール」だけを点検する。
 *   ・初期化（ノイズ耐性42 / こころ18 / 閉じた心50 / 仮面=疑い）
 *   ・仮面ごとの 弱点(ほころび)・耐性(こわばり) 判定
 *   ・効果の数値（弱点×1.5・耐性×0.5・迷い×0.7・命中低下・反動・受容）
 *   ・ほころび→心崩れ→もう一言（1ターン1回）の流れ
 *   ・ことばの総鳴り(-18)・対話(心崩れ/本音)・仮面変化・本音遷移
 *   ・勝敗（閉じた心0→win / 本音の対話→win / ノイズ耐性0→lose）
 *   ・ランダムを含む“1戦まるごと”を最後まで回してもエラーが出ないこと
 *
 * 使い方（モックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 * もしくは絶対パスで：
 *   MOCKDIR="/abs/.../06-persona-kotoba" osascript -l JavaScript "$MOCKDIR/tools/headless-check.js"
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

/* ───────── 乱数の固定（決定的テスト用） ───────── */
var REAL_RANDOM = Math.random;
function setRng(v) { Math.random = function () { return v; }; }
function restoreRng() { Math.random = REAL_RANDOM; }

/* ───────── 簡易アサート ───────── */
var passed = 0, failed = 0, lines = [];
function ok(cond, label) {
  if (cond) { passed++; lines.push('  ✅ ' + label); }
  else { failed++; lines.push('  ❌ ' + label); }
}
function logHas(sub) {
  for (var i = 0; i < state.log.length; i++) if (state.log[i].indexOf(sub) >= 0) return true;
  return false;
}

/* ───────── 1) 初期化 ───────── */
newBattle();
ok(state.player.noise === 42 && state.player.maxNoise === 42, '初期: ノイズ耐性 42/42');
ok(state.player.kokoro === 18 && state.player.maxKokoro === 18, '初期: こころ 18/18');
ok(state.enemy.heart === 50 && state.enemy.maxHeart === 50, '初期: 閉じた心 50/50');
ok(state.enemy.maskId === 'utagai', '初期: 仮面=疑い');
ok(state.player.imageName === '空白の心象', '初期: 心象=空白の心象');
ok(state.phase === 'player' && !state.result, '初期: プレイヤーの番');

/* ───────── 2) 仮面ごとの 弱点/耐性 判定 ───────── */
newBattle();
ok(typeCategory('toi') === 'weak' && typeCategory('chinmoku') === 'weak', '疑い: 問い・沈黙 が ほころび');
ok(typeCategory('kansha') === 'resist' && typeCategory('yakusoku') === 'resist', '疑い: 感謝・約束 が こわばり');
ok(typeCategory('aisatsu') === 'normal', '疑い: あいさつ は 通常');
setMask('huan');
ok(typeCategory('anshin') === 'weak' && typeCategory('yakusoku') === 'weak', '不安: 安心・約束 が ほころび');
ok(typeCategory('toi') === 'resist', '不安: 問い が こわばり');
ok(categoryFor(SKILLS.matte) === 'weak', '不安: 「まって」(約束/沈黙)は ほころび扱い');
setMask('chinmoku');
ok(typeCategory('namae') === 'weak', '沈黙: 名前 が ほころび');
setMask('kakushigoto');
ok(typeCategory('toi') === 'weak' && typeCategory('namae') === 'weak', '隠し事: 問い・名前 が ほころび');
setMask('honne');
ok(typeCategory('toi') === 'normal' && typeCategory('chinmoku') === 'normal', '本音: 弱点も耐性も無い');

/* ───────── 3) 効果の数値（乱数固定で決定的に） ───────── */
setRng(0.5); // 全技が命中し、確率発動(30%)は起きない値

// 弱点 ×1.5：どうして？(問い=弱点) 9 → 14、心崩れ＋もう一言
newBattle();
playSkill('doushite');
ok(state.enemy.heart === 50 - 14, '弱点: どうして？ 9×1.5=14（閉じた心 50→36）');
ok(state.enemy.kuzure === true, '弱点: 心崩れ になる');
ok(state.phase === 'oneMore' && state.oneMoreUsed === true, '弱点: もう一言（phase=oneMore）');
ok(state.enemy.revealed.toi === 'weak', '弱点: 問い が開示される');
ok(logHas('ほころびに届いた') && logHas('もう一言'), 'ログ: ほころび／もう一言 が出る');

// 通常 ×1.0：こんにちは(あいさつ=通常) 8、心崩れ起きない → 相手の番へ
newBattle();
playSkill('konnichiwa');
ok(state.enemy.heart === 50 - 8, '通常: こんにちは 8（閉じた心 50→42）');
ok(state.enemy.kuzure === false && state.phase === 'enemy', '通常: 心崩れ無し → 相手の番へ');

// 耐性 ×0.5：ありがとう(感謝=耐性) 7→4
newBattle();
playSkill('arigatou');
ok(state.enemy.heart === 50 - 4, '耐性: ありがとう 7×0.5=4（閉じた心 50→46）');
ok(state.enemy.revealed.kansha === 'resist', '耐性: 感謝 が こわばり開示');
ok(logHas('仮面の上をすべった'), 'ログ: こわばりは「仮面の上をすべった」');

// だいじょうぶ：不安なら 弱点(安心)＋追加6 → (0+6)×1.5=9、受容+8
newBattle();
setMask('huan');
playSkill('daijoubu');
ok(state.enemy.heart === 50 - 9, 'だいじょうぶ: 不安で (0+6)×1.5=9（閉じた心 50→41）');
ok(state.player.juyou === 8, 'だいじょうぶ: 受容 +8');
ok(state.enemy.kuzure === true, 'だいじょうぶ: 安心は不安の弱点 → 心崩れ');

// 沈黙する：弱点なら 5×1.5=8、受容+5、相手弱体
newBattle();
playSkill('chinmokuSuru');
ok(state.enemy.heart === 50 - 8, '沈黙する: 弱点で 5×1.5=8');
ok(state.player.juyou === 5 && state.enemy.weakenNext === 0.5, '沈黙する: 受容+5・相手の次を弱める');

// 沈黙する：弱点でない仮面(本音)では 閉じた心に効かない（受容だけ）
newBattle();
setMask('honne');
var hHonne = state.enemy.heart;
playSkill('chinmokuSuru');
ok(state.enemy.heart === hHonne, '沈黙する: 弱点でなければ 閉じた心に効かない');
ok(state.player.juyou === 5, '沈黙する: それでも 受容+5 は入る');

// 迷い：効果量 -30%。こんにちは 8×0.7=5.6→6
newBattle();
state.player.mayoi = 1;
playSkill('konnichiwa');
ok(state.enemy.heart === 50 - 6, '迷い: こんにちは 8×0.7=5.6→6');
ok(state.player.mayoi === 0, '迷い: 攻撃で1つ消費される');

// ありがとう：ノイズ耐性 +2（ただし最大42は超えない）
newBattle();
state.player.noise = 40;
playSkill('arigatou');
ok(state.player.noise === 42, 'ありがとう: ノイズ耐性 40→42（回復）');
newBattle();
playSkill('arigatou');
ok(state.player.noise === 42, 'ありがとう: 最大42を超えない');

// いやだ：15、反動でノイズ耐性 -2
newBattle();
playSkill('iyada');
ok(state.enemy.heart === 50 - 15, 'いやだ: 閉じた心 -15');
ok(state.player.noise === 40, 'いやだ: 反動で ノイズ耐性 42→40');

// 命中しない：こころは消費、効果なし
newBattle();
setRng(0.95); // いやだ(命中90)は外れる
var kBefore = state.player.kokoro, hBefore = state.enemy.heart;
playSkill('iyada');
ok(state.enemy.heart === hBefore && state.player.kokoro === kBefore - 4, '命中外し: 閉じた心そのまま・こころは4消費');
ok(logHas('届く前にほどけた'), 'ログ: 「届く前にほどけた」');
setRng(0.5);

// 受けとめる：受容+6・こころ+2
newBattle();
state.player.kokoro = 10;
uketomeru();
ok(state.player.juyou === 6 && state.player.kokoro === 12, '受けとめる: 受容+6・こころ+2');

/* ───────── 4) もう一言は1ターン1回まで ───────── */
newBattle();
playSkill('doushite');                 // 弱点 → もう一言（oneMore）
ok(state.phase === 'oneMore', 'もう一言: 1回目の弱点で発生');
playSkill('chinmokuSuru');             // もう一言中に また弱点
ok(state.phase === 'enemy' && state.oneMoreUsed === true, 'もう一言: 2回目の弱点では追加発生せず 相手の番へ');

/* ───────── 5) ことばの総鳴り（-18・心崩れ解除） ───────── */
newBattle();
state.enemy.kuzure = true;
sounari();
ok(state.enemy.heart === 50 - 18, '総鳴り: 閉じた心 -18');
ok(state.enemy.kuzure === false && state.phase === 'enemy', '総鳴り: 心崩れ解除 → 相手の番へ');
ok(logHas('一斉に鳴った') && logHas('ひとつの音'), '総鳴り: 演出ログが出る');
// 心崩れ中でないと撃てない
newBattle();
ok(sounari() === false, '総鳴り: 心崩れでなければ撃てない');

/* ───────── 6) 対話（心崩れ中・本音） ───────── */
// 心崩れ中の正解「こわいの？」→ 閉じた心-10・仮面を隠し事へ
newBattle();
state.enemy.kuzure = true;
ok(openDialogue() === true && state.dialogue === 'kuzure', '対話: 心崩れ中に開ける');
chooseDialogue(0);
ok(state.enemy.heart === 50 - 10 && state.enemy.maskId === 'kakushigoto', '対話(正解): 閉じた心-10・仮面→隠し事');
ok(state.enemy.kuzure === false && state.phase === 'enemy', '対話: 心崩れ解除 → 相手の番へ');
// 不正解は 閉じた心-3、仮面は変えない
newBattle();
state.enemy.kuzure = true;
openDialogue();
chooseDialogue(1);
ok(state.enemy.heart === 50 - 3 && state.enemy.maskId === 'utagai', '対話(不正解): 閉じた心-3・仮面そのまま');

/* ───────── 7) 仮面の変化・本音遷移 ───────── */
// 沈黙する 2回で 沈黙の仮面
newBattle();
playSkill('chinmokuSuru');             // 1回目（弱点→oneMore）
playSkill('chinmokuSuru');             // 2回目（oneMore中）→ 沈黙へ
ok(state.enemy.maskId === 'chinmoku', '仮面変化: 沈黙する2回で 沈黙の仮面');
// 閉じた心 ≤10 で 本音へ
newBattle();
state.enemy.heart = 9;
checkHonne();
ok(state.enemy.maskId === 'honne', '本音遷移: 閉じた心≤10 で 本音の仮面');
// どうして？ の30%で 隠し事（rng=0で必ず発動）
newBattle();
setRng(0.0);
playSkill('doushite');
ok(state.enemy.maskId === 'kakushigoto', 'どうして？: 確率成功で 仮面→隠し事');
setRng(0.5);

/* ───────── 8) 勝敗 ───────── */
// 閉じた心0 → win
newBattle();
state.enemy.heart = 5;
playSkill('konnichiwa'); // 通常8 → 0で止まる
ok(state.result === 'win' && state.enemy.heart === 0, '勝敗: 閉じた心0 → win（0で止まる）');
// 本音の対話「言葉を教えて」→ win
newBattle();
setMask('honne');
openDialogue();
chooseDialogue(2);
ok(state.result === 'win', '勝敗: 本音の対話「言葉を教えて」→ win');
// ノイズ耐性0 → lose
newBattle();
state.player.noise = 3; state.player.juyou = 0; state.phase = 'enemy';
setRng(0.0); // 疑う(noise6)が選ばれ、mayoiも付くが、まず耐性が0に
damageToPlayer(6);
checkResult();
ok(state.result === 'lose' && state.player.noise === 0, '勝敗: ノイズ耐性0 → lose（0で止まる）');
setRng(0.5);
// 勝利/敗北メッセージ
ok(WIN_TEXT.length >= 10 && WIN_TEXT.join('').indexOf('世界を終わらせる鍵') >= 0, '勝利メッセージ: 「世界を終わらせる鍵」を含む');
ok(WIN_REWARD.title.indexOf('村長の心象') >= 0, '報酬: 「村長の心象」を得る');
ok(LOSE_TEXT.join('').indexOf('ばらばら') >= 0, '敗北メッセージ: 「ばらばら」を含む');

/* ───────── 9) 村長の行動（条件つき） ───────── */
// 心配する：閉じた心≤25 のときだけ／使うと 不安の仮面へ
newBattle();
state.enemy.heart = 20; state.phase = 'enemy';
setRng(0.9); // 重み抽選で「心配する」が選ばれる値
enemyTurn();
ok(state.enemy.maskId === 'huan', '村長: 心配する(閉じた心≤25) → 仮面を不安へ');
// 隠す：仮面が隠し事のとき 閉じた心+5
newBattle();
setMask('kakushigoto');
state.enemy.heart = 40; state.phase = 'enemy';
setRng(0.9); // 「隠す」が選ばれる値
enemyTurn();
ok(state.enemy.heart === 45, '村長: 隠す(隠し事のとき) → 閉じた心 +5');
restoreRng();

/* ───────── 10) 1戦まるごと（ランダム込み）を最後まで回す ─────────
 * 弱点を探して突き、心崩れたら 総鳴り or 本音なら対話で締める、現実的なオートプレイ。
 * どんな乱数でも 80ターン以内に勝敗が付き、例外が出ないことを確認する。
 */
function pickAffordableWeak() {
  for (var i = 0; i < SKILL_ORDER.length; i++) {
    var s = SKILLS[SKILL_ORDER[i]];
    if (s.cost <= state.player.kokoro && categoryFor(s) === 'weak') return s.id;
  }
  return null;
}
function pickAffordableDamage() {
  for (var i = 0; i < SKILL_ORDER.length; i++) {
    var s = SKILLS[SKILL_ORDER[i]];
    if (s.cost <= state.player.kokoro && (s.power > 0)) return s.id;
  }
  return null;
}
function autoAction() {
  // 本音なら 対話で勝ちに行く
  if (currentMask().honne && canTalk()) { openDialogue(); chooseDialogue(2); return; }
  // 心崩れ中は 総鳴り（大技）で締める
  if (state.enemy.kuzure) { if (sounari()) return; }
  // 弱点 → 攻撃 → それも無ければ 受けとめる
  var id = pickAffordableWeak() || pickAffordableDamage();
  if (id) { playSkill(id); return; }
  uketomeru();
}
function autoPlayOnce() {
  newBattle();
  var guard = 0;
  while (!state.result && guard < 200) {
    guard++;
    if (state.phase === 'player' || state.phase === 'oneMore') {
      autoAction();
    } else if (state.phase === 'enemy') {
      enemyTurn();
    } else {
      break;
    }
  }
  return { result: state.result, turns: state.turn, guard: guard };
}

var sawWin = false, sawLose = false, ranOk = true, anyResult = true;
for (var run = 0; run < 60; run++) {
  var r;
  try { r = autoPlayOnce(); }
  catch (e) { ranOk = false; lines.push('  ❌ オートプレイ例外: ' + e); break; }
  if (!r.result) { anyResult = false; lines.push('  ❌ 200手で決着せず（guard=' + r.guard + '）'); break; }
  if (r.result === 'win') sawWin = true;
  if (r.result === 'lose') sawLose = true;
}
ok(ranOk, 'オートプレイ: 60戦して例外なし');
ok(anyResult, 'オートプレイ: 毎回ちゃんと決着する');
ok(sawWin, 'オートプレイ: 勝てる試合がある（弱点→心崩れ→決着の勝ち筋が成立）');
lines.push('  ' + (sawLose ? 'ℹ️ 敗北も観測（負け筋もある）' : 'ℹ️ 今回の60戦では敗北は出ず'));

/* ───────── レポート ───────── */
var header = '=== ペルソナ参考：心象弱点・総鳴りバトル headless-check ===';
var footer = (failed === 0)
  ? ('PASS — ' + passed + '件すべてOK')
  : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
