/*
 * headless-check.js — DOM非依存コア(data/metrics/state/save/battle/cards)の回帰確認（Node不要）
 *
 * なぜ：このPCは Node 無しなので、JXA(osascript -l JavaScript)で“画面なし”の中核だけを
 *       読み込んで動かし、構文エラーや関数欠落・契約ズレ（思いやり=見えないゲージ／
 *       harsh勝ち=凶暴+／kind勝ち=優しさ+gift／カードLv3段／結末分岐／計測往復）を
 *       素早く検出する。02-saigo-no-tomodachi の headless-check.js の流儀を厳密に踏襲する：
 *         ・ObjC.import('Foundation') ＋ readFile
 *         ・cwd/js/ をコントラクトの読み込み順（DOM依存は除外）で読む
 *         ・全ファイル＋テストを“1つの文字列”にして一度に eval（const/let が同スコープで見える）
 *         ・最後の式（出力文字列）を osascript が表示する。先頭は "CORE OK"。
 *
 * 使い方： osascript -l JavaScript prototypes/03-word-to-world/tools/headless-check.js
 *         （カレントは prototype のルートを想定。js/ を相対で読む）
 */
ObjC.import('Foundation');

function readFile(p) {
  // Foundationでファイルを読む（4 = NSUTF8StringEncoding）
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

// カレントディレクトリ基準で js/ を読む（リポジトリのどこに置いても動くように）
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";

// コントラクトの読み込み順（data → audio → metrics → state → save → battle → cards → field → ui → main）
// から、DOM/AudioContext/rAF に依存する audio/field/ui/main を除いた“コアだけ”を読む。
// （ui/audio/main の構文・参照は ui-syntax-check.js が別途 DOMスタブで検証する）
var files = ["data.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js"];

// ── 最小スタブ（コアが触る非DOMの環境API）─────────────────
//   ・localStorage：save.js が往復に使う。JXA に無いので“メモリ上の連想配列”で代用する。
//     これで saveGame→loadGame が実機同様に動き、metrics スナップショットの往復まで検証できる。
//   ・performance：metrics.js は _now() で performance.now() を優先するが、無ければ Date に
//     フォールバックする実装なので、ここでは敢えて用意しない（フォールバック経路も確かめる）。
//   ※ window は敢えて定義しない：各ファイル末尾の `if (typeof window !== "undefined")` を
//     走らせないことで、game をこの eval スコープのローカル変数のまま一貫して参照できる
//     （save.js の loadGame 内 `window.game = game` も window 無しなら素通り＝ローカル game を見る）。
var stub = [
  "var localStorage = (function(){",
  "  var _m = {};",
  "  return {",
  "    get length(){ return Object.keys(_m).length; },",
  "    key: function(i){ return Object.keys(_m)[i]; },",
  "    getItem: function(k){ return Object.prototype.hasOwnProperty.call(_m,k) ? _m[k] : null; },",
  "    setItem: function(k,v){ _m[k] = String(v); },",
  "    removeItem: function(k){ delete _m[k]; }",
  "  };",
  "})();",
].join("\n");

// 6ファイル＋スタブ＋テストコードを“1つの文字列”にして一度に eval する。
// 理由：const/let は eval ブロック内スコープなので、テストも同じ eval 文字列の中に書くと
//       game / BALANCE / WORDS / 各関数を参照できる（別々に eval すると見えなくなる）。
var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o = [];",

  // ── newGame：初期状態（hp/手札/傾向）が契約どおりか ────────────────
  "newGame();",
  "__o.push('newGame: hp=' + game.player.hp + '/' + game.player.maxHp + ' cards=' + JSON.stringify(ownedCards()) + ' kyoubou=' + game.player.tendency.kyoubou + ' yasashisa=' + game.player.tendency.yasashisa);",
  "__o.push('startCards lv1 OK? ' + (cardLevel('baka') === 1 && cardLevel('arigatou') === 1));",

  // ── harsh 連打で精神HP0＝言い負かし勝ち（凶暴+・harshWins++・lastWinKind=false）──
  //   baka L1=12 を kojika mindHpMax=18 に2発＝0以下。kojika atk=1 なので途中ゲームオーバーしない。
  "newGame(); startBattle('kojika');",
  "var __ky0 = game.player.tendency.kyoubou;",
  "var __mh0 = game.battle.enemy.mindHp;",
  "playerCard('baka');",                           // 1発目（敵ターンも回る）
  "var __mh1 = game.battle.enemy.mindHp;",
  "playerCard('baka');",                           // 2発目で mindHp<=0 → 勝利処理（offerCards へ）
  "__o.push('HARSH: mindHp ' + __mh0 + ' -> ' + __mh1 + ' -> 0以下=' + (game.battle.enemy.mindHp <= 0));",
  "__o.push('HARSH win? lastWinKind=' + game.lastWinKind + ' (期待 false) / harshWins=' + game.counters.harshWins + ' (期待1)');",
  "__o.push('HARSH 凶暴+ ? ' + (game.player.tendency.kyoubou > __ky0) + ' (' + __ky0 + ' -> ' + game.player.tendency.kyoubou + ' / winHarsh=' + BALANCE.winHarsh + ' useHarsh=' + BALANCE.useHarsh + ')');",
  "__o.push('HARSH 勝利後 screen=' + app.screen + ' (offerCards で cards 想定) pending=' + (game.pendingCards ? game.pendingCards.length : 0));",

  // ── kind 連打で 思いやり満タン＝寄り添い勝ち（優しさ+・kindWins++・gift習得）──
  //   kojika omoiyariNeed=18 / arigatou L1=7 → 3発（7*3=21>=18）。思いやりは“見えないゲージ”なので
  //   fx には数値が積まれない＝そこも確認（kind 行動の fx に omoiyari 数値が無いこと）。
  "newGame(); startBattle('kojika');",
  "var __ya0 = game.player.tendency.yasashisa;",
  "var __giftKnewBefore = knowsCard('daijoubu');",  // kojika.gift = daijoubu（寄り添うと教わる）
  "game.fx = [];",
  "playerCard('arigatou');",
  "var __kindFxHasNumber = (game.fx || []).some(function(ev){ return ('omoiyari' in ev) || ('need' in ev); });",
  "playerCard('arigatou');",
  "playerCard('arigatou');",                          // 3発で omoiyari>=need → 寄り添い勝ち
  "__o.push('KIND: omoiyari満タン勝ち? lastWinKind=' + game.lastWinKind + ' (期待 true) / kindWins=' + game.counters.kindWins + ' (期待1)');",
  "__o.push('KIND 優しさ+ ? ' + (game.player.tendency.yasashisa > __ya0) + ' (' + __ya0 + ' -> ' + game.player.tendency.yasashisa + ' / winKind=' + BALANCE.winKind + ' useKind=' + BALANCE.useKind + ')');",
  "__o.push('KIND gift習得 daijoubu? before=' + __giftKnewBefore + ' after=' + knowsCard('daijoubu') + ' lv=' + cardLevel('daijoubu') + ' (寄り添いで覚える)');",
  "__o.push('KIND 思いやりは見えないゲージ：fxに数値なし? ' + (__kindFxHasNumber === false));",

  // ── addCard：lv1 → lv2 → lv3 → 最大3で打ち止め（3段階成長と上限）──
  "newGame();",
  "var __r0 = (knowsCard('kiero') ? 'known' : addCard('kiero'));",  // 未習得 kiero を新規習得
  "var __l1 = cardLevel('kiero');",
  "var __r1 = addCard('kiero'); var __l2 = cardLevel('kiero');",     // leveled → 2
  "var __r2 = addCard('kiero'); var __l3 = cardLevel('kiero');",     // leveled → 3
  "var __r3 = addCard('kiero'); var __l4 = cardLevel('kiero');",     // max（3で打ち止め）
  "__o.push('addCard: ' + __r0 + '(lv' + __l1 + ') -> ' + __r1 + '(lv' + __l2 + ') -> ' + __r2 + '(lv' + __l3 + ') -> ' + __r3 + '(lv' + __l4 + ')');",
  "__o.push('addCard 段階 OK? ' + (__l1 === 1 && __l2 === 2 && __l3 === 3 && __l4 === 3 && __r3 === 'max'));",
  "__o.push('cardPower Lv連動 OK? lv3 power=' + cardPower('kiero') + ' (WORDS.kiero.power[2]=' + WORDS.kiero.power[2] + ')');",

  // ── determineEnding：優しさ率 0.1 / 0.5 / 0.9 で 3 系統へ振り分く（cruel/gray/warm）──
  //   determineEnding は引数を取らず game.player.tendency を読む実装なので、率を作って tendency をセットする。
  "function __endingForRate(r){ newGame(); game.player.tendency.yasashisa = Math.round(r*100); game.player.tendency.kyoubou = Math.round((1-r)*100); return determineEnding().id; }",
  "__o.push('ending(0.1)=' + __endingForRate(0.1) + ' (cruel想定)');",
  "__o.push('ending(0.5)=' + __endingForRate(0.5) + ' (gray想定)');",
  "__o.push('ending(0.9)=' + __endingForRate(0.9) + ' (warm想定)');",
  "__o.push('darkLevel しきい値: k=' + JSON.stringify(BALANCE.darkenAt) + ' / k=0->' + (function(){newGame();return darkLevel();})() + ' k=' + (BALANCE.darkenAt[2]+1) + '->' + (function(){newGame();game.player.tendency.kyoubou=BALANCE.darkenAt[2]+1;return darkLevel();})());",

  // ── metrics：textShown / textAdvanced → skipRatio / readRatio の集計（0除算ガード込み）──
  //   3ブロック提示し、1つだけ skip。skipRatio=1/3、readRatio=2/3 を期待。
  "startMetrics();",
  "textShown(10); textAdvanced({ skipped: false });",
  "textShown(20); textAdvanced({ skipped: true });",
  "textShown(15); textAdvanced({ skipped: false });",
  "var __sum = metricsSummary();",
  "__o.push('metrics: blocksShown=' + __sum.blocksShown + ' blocksSkipped=' + __sum.blocksSkipped + ' skips=' + __sum.skips);",
  "__o.push('metrics skipRatio=' + __sum.skipRatio.toFixed(3) + ' readRatio=' + __sum.readRatio.toFixed(3) + ' OK? ' + (Math.abs(__sum.skipRatio - 1/3) < 1e-6 && Math.abs(__sum.readRatio - 2/3) < 1e-6));",
  "__o.push('metrics 0除算ガード: startMetrics直後 summary skipRatio=' + (function(){startMetrics();return metricsSummary().skipRatio;})() + ' (期待0)');",

  // ── saveGame → loadGame：player(cards/tendency/hp) も metrics も往復するか ──
  //   セーブ前に“癖”と傾向を作り込み、loadGame で別人にならない（途中ロードでメタ演出が途切れない）ことを確かめる。
  "newGame(); enterAreaStub('dokutsu');",          // currentArea を保存対象にするため簡易にセット（下で定義）
  "addCard('kiero'); addCard('kiero');",            // cards: kiero lv2
  "addKyoubou(7); addYasashisa(3);",               // tendency を動かす
  "game.player.hp = 17;",                           // hp も欠けないか
  "startMetrics(); metrics.clicks = 42; metrics.cursorDist = 123.4; textShown(8); textAdvanced({ skipped: true });",
  "var __preClicks = metrics.clicks, __preSkips = metrics.skips, __preDist = metrics.cursorDist;",
  "var __preCardsLv = cardLevel('kiero'), __preKy = game.player.tendency.kyoubou, __preYa = game.player.tendency.yasashisa, __preHp = game.player.hp, __preArea = game.currentArea;",
  "var __saved = saveGame(0);",
  // セーブ後にゲームと計測をリセット（=やり直し相当）→ loadGame で完全復元されるか。
  "newGame(); startMetrics();",
  "var __loaded = loadGame(0);",
  "__o.push('SAVE/LOAD: saved=' + __saved + ' loaded=' + __loaded);",
  "__o.push('SAVE/LOAD player往復 OK? cards lv ' + cardLevel('kiero') + '==' + __preCardsLv + ' / kyoubou ' + game.player.tendency.kyoubou + '==' + __preKy + ' / yasashisa ' + game.player.tendency.yasashisa + '==' + __preYa + ' / hp ' + game.player.hp + '==' + __preHp + ' / area ' + game.currentArea + '==' + __preArea + ' => ' + (cardLevel('kiero') === __preCardsLv && game.player.tendency.kyoubou === __preKy && game.player.tendency.yasashisa === __preYa && game.player.hp === __preHp && game.currentArea === __preArea));",
  "__o.push('SAVE/LOAD metrics往復 OK? clicks ' + metrics.clicks + '==' + __preClicks + ' / skips ' + metrics.skips + '==' + __preSkips + ' / cursorDist ' + metrics.cursorDist + '==' + __preDist + ' => ' + (metrics.clicks === __preClicks && metrics.skips === __preSkips && Math.abs(metrics.cursorDist - __preDist) < 1e-9));",

  "__o.join('\\n');"
].join("\n");

// startBattle 等が currentArea を参照するが、field.js は読まないので enterArea が無い。
// save の往復で currentArea を検証したいので、最小の“エリア設定だけ”の補助を test の前に注入する。
var helper = "function enterAreaStub(id){ if (game) game.currentArea = id; }";

var output;
try {
  output = "CORE OK\n" + eval(src + "\n" + helper + "\n" + test);
} catch (e) {
  output = "CORE ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output; // osascript が最後の式を出力する
