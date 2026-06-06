/*
 * headless-check.js — DOM非依存コア(data/metrics/state/save/battle/cards/field)の回帰確認（Node不要）
 *
 * なぜ：このPCは Node 無しなので、JXA(osascript -l JavaScript)で“画面なし”の中核だけを読み込み、
 *       構文エラー・関数欠落・契約ズレ（思いやり=見えないゲージ／harsh勝ち=凶暴+／kind勝ち=優しさ+gift／
 *       両ルート勝利／非パーマデス生存／カードLv3段／結末分岐／3択／フィールド/出口ロック／計測往復／
 *       セーブ往復）を素早く検出する。03/02 の headless-check.js の流儀を踏襲する：
 *         ・ObjC.import('Foundation') ＋ readFile
 *         ・cwd/js/ を読み込み順（DOM依存の audio/ui/main は除外）で読む
 *         ・全ファイル＋テストを“1つの文字列”にして一度に eval（const/let が同スコープで見える）
 *         ・最後の式（出力文字列）を osascript が表示する。先頭は "CORE OK"。
 *
 * 使い方： osascript -l JavaScript prototypes/04-kotoba-no-android/tools/headless-check.js
 *         （カレントは prototype のルートを想定。js/ を相対で読む）
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; // 4 = NSUTF8StringEncoding
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";

// DOM/AudioContext/rAF に依存する audio/ui/main を除いた“コアだけ”を読む。
var files = ["data.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js", "field.js"];

// localStorage は JXA に無いので“メモリ上の連想配列”で代用（save 往復を実機同様に検証）。
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

// window は敢えて定義しない：各ファイル末尾の export guard を走らせず、game をこの eval スコープの
// ローカル変数のまま一貫して参照する（save.js の window.game = game も window 無しなら素通り）。
var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o = [];",

  // ── newGame：初期状態 ──
  "newGame();",
  "__o.push('newGame: hp=' + game.player.hp + '/' + game.player.maxHp + ' cards=' + JSON.stringify(ownedCards()) + ' ky=' + game.player.tendency.kyoubou + ' ya=' + game.player.tendency.yasashisa);",
  "__o.push('startCards lv1 OK? ' + (cardLevel('urusai')===1 && cardLevel('kiite')===1) + ' name=' + game.player.displayName);",

  // ── HARSH 連打で精神HP0＝言い負かし勝ち（凶暴+・harshWins++・lastWinKind=false・screen=result）──
  "newGame(); startBattle('kadokko');",
  "var __ky0 = game.player.tendency.kyoubou; var __mh0 = game.battle.mindHp;",
  "playerCard('urusai'); var __mh1 = game.battle.mindHp;",
  "playerCard('urusai'); playerCard('urusai'); playerCard('urusai');", // 計4手で 34→0
  "__o.push('HARSH: mindHp ' + __mh0 + ' -> ' + __mh1 + ' -> 決着後 battle=' + (game.battle ? game.battle.mindHp : 'null'));",
  "__o.push('HARSH win? lastWinKind=' + game.lastWinKind + ' (期待 false) / harshWins=' + game.counters.harshWins + ' (期待1) / screen=' + app.screen + ' (期待 result)');",
  "__o.push('HARSH 凶暴+ ? ' + (game.player.tendency.kyoubou > __ky0) + ' (' + __ky0 + ' -> ' + game.player.tendency.kyoubou + ') / battle_done=' + hasFlag('battle_done'));",
  "__o.push('HARSH player生存 hp=' + game.player.hp + ' (>0期待) / ending=' + (game.ending ? game.ending.id : 'null') + ' (togari期待)');",

  // ── KIND 連打で 思いやり満タン＝寄り添い勝ち（優しさ+・kindWins++・gift習得・生存・数値fx無し）──
  "newGame(); startBattle('kadokko');",
  "var __ya0 = game.player.tendency.yasashisa; var __giftBefore = knowsCard('tonari');",
  "game.fx = [];",
  "playerCard('kiite');", // 1手目
  "var __kindFxHasNum = (game.fx||[]).some(function(ev){ return ev.type==='kindUse' && ('n' in ev); });",
  "var __kindFxHasOmoiyari = (game.fx||[]).some(function(ev){ return ('omoiyari' in ev) || ('need' in ev); });",
  "playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite');", // 計6手で 36 充填
  "__o.push('KIND win? lastWinKind=' + game.lastWinKind + ' (期待 true) / kindWins=' + game.counters.kindWins + ' (期待1) / screen=' + app.screen + ' (期待 result)');",
  "__o.push('KIND 優しさ+ ? ' + (game.player.tendency.yasashisa > __ya0) + ' (' + __ya0 + ' -> ' + game.player.tendency.yasashisa + ') / 凶暴=' + game.player.tendency.kyoubou + ' (0期待=翳らない)');",
  "__o.push('KIND gift習得 tonari? before=' + __giftBefore + ' after=' + knowsCard('tonari') + ' (寄り添いで覚える)');",
  "__o.push('KIND player生存 hp=' + game.player.hp + ' (>0期待・非パーマデス) / ending=' + (game.ending ? game.ending.id : 'null') + ' (yawaragi期待)');",
  "__o.push('KIND 思いやりは見えないゲージ：fxに数値なし? ' + (__kindFxHasNum===false && __kindFxHasOmoiyari===false));",

  // ── side 効果：ganbatta=healSelf / tonari=lowerAtk ──
  "newGame(); game.player.cards['ganbatta']=1; game.player.cards['tonari']=1; startBattle('kadokko');",
  "game.player.hp = 10; playerCard('ganbatta');", // healSelf +3 → ただし敵ターンで-3 → 10
  "__o.push('SIDE healSelf 効いた? hp=' + game.player.hp + ' (回復が無ければ7、回復ありで10前後)');",
  "var __atkBefore = game.battle.atk; playerCard('tonari');",
  "__o.push('SIDE lowerAtk 効いた? atk ' + __atkBefore + ' -> ' + game.battle.atk + ' (下がる期待)');",

  // ── addCard：lv1→lv2→lv3→max ──
  "newGame();",
  "var __r0=(knowsCard('dokka-e')?'known':addCard('dokka-e')); var __l1=cardLevel('dokka-e');",
  "var __r1=addCard('dokka-e'); var __l2=cardLevel('dokka-e');",
  "var __r2=addCard('dokka-e'); var __l3=cardLevel('dokka-e');",
  "var __r3=addCard('dokka-e'); var __l4=cardLevel('dokka-e');",
  "__o.push('addCard: ' + __r0 + '(lv'+__l1+') -> ' + __r1 + '(lv'+__l2+') -> ' + __r2 + '(lv'+__l3+') -> ' + __r3 + '(lv'+__l4+')');",
  "__o.push('addCard 段階 OK? ' + (__l1===1 && __l2===2 && __l3===3 && __l4===3 && __r3==='max') + ' / cardPower lv3=' + cardPower('dokka-e') + ' (WORDS.dokka-e.power[2]=' + WORDS['dokka-e'].power[2] + ')');",

  // ── 3択：offerCards → chooseCard（got_card・入手で人格が傾く）──
  "newGame(); offerCards('npc_kona');",
  "__o.push('3択 提示数=' + (game.pendingCards ? game.pendingCards.length : 0) + ' (3期待) screen=' + app.screen);",
  "var __kyPick0 = game.player.tendency.kyoubou; var __pick = chooseCard('kankeinai');",
  "__o.push('chooseCard: ' + __pick + ' / got_card=' + hasFlag('got_card') + ' / pending=' + game.pendingCards + ' / harsh選択で凶暴+? ' + (game.player.tendency.kyoubou > __kyPick0));",

  // ── フィールド：enterArea / areaNodes / 出口ロック（battle_done で解放）/ nearestNode ──
  "newGame(); enterArea('mura');",
  "var __nodes = areaNodes();",
  "var __exit = __nodes.filter(function(n){return n.type==='exit';})[0];",
  "__o.push('FIELD enterArea OK? currentArea=' + game.currentArea + ' nodes=' + __nodes.length + ' screen=' + app.screen);",
  "__o.push('FIELD 出口は最初ロック? ' + (__exit && __exit.locked===true) + ' / interact=' + JSON.stringify(interact(__exit)).slice(0,40));",
  "setFlag('battle_done'); var __exit2 = areaNodes().filter(function(n){return n.type==='exit';})[0];",
  "__o.push('FIELD battle_done後 出口解放? ' + (__exit2 && __exit2.locked===false) + ' / canAdvance=' + canAdvance());",
  "var __near = nearestNode(0.26, 0.42, 0.13);",
  "__o.push('FIELD nearestNode(こな付近)=' + (__near ? __near.id : 'null') + ' (n_kona期待)');",

  // ── determineEnding：率 0.1/0.5/0.9 → togari/yuragi/yawaragi ──
  "function __endRate(r){ newGame(); game.player.tendency.yasashisa=Math.round(r*100); game.player.tendency.kyoubou=Math.round((1-r)*100); return determineEnding().id; }",
  "__o.push('ending(0.1)=' + __endRate(0.1) + ' / ending(0.5)=' + __endRate(0.5) + ' / ending(0.9)=' + __endRate(0.9) + ' (togari/yuragi/yawaragi期待)');",
  "__o.push('darkLevel: k=' + JSON.stringify(BALANCE.darkenAt) + ' / k0->' + (function(){newGame();return darkLevel();})() + ' k=' + (BALANCE.darkenAt[1]) + '->' + (function(){newGame();game.player.tendency.kyoubou=BALANCE.darkenAt[1];return darkLevel();})());",

  // ── metrics：skipRatio / 0除算ガード ──
  "startMetrics(); textShown(10); textAdvanced({skipped:false}); textShown(20); textAdvanced({skipped:true}); textShown(15); textAdvanced({skipped:false});",
  "var __sum = metricsSummary();",
  "__o.push('metrics: shown=' + __sum.blocksShown + ' skipped=' + __sum.blocksSkipped + ' skipRatio=' + __sum.skipRatio.toFixed(3) + ' (0.333期待) OK? ' + (Math.abs(__sum.skipRatio-1/3)<1e-6));",
  "__o.push('metrics 0除算ガード: ' + (function(){startMetrics();return metricsSummary().skipRatio;})() + ' (0期待) / metaLine=' + (typeof metaLineForMetrics==='function'));",

  // ── save→load：player(cards/tendency/hp) も metrics も往復するか ──
  "newGame(); enterArea('mura'); addCard('dokka-e'); addCard('dokka-e'); addKyoubou(7); addYasashisa(3); game.player.hp=17; setFlag('got_card');",
  "startMetrics(); metrics.clicks=42; metrics.cursorDist=123.4; textShown(8); textAdvanced({skipped:true});",
  "var __preClicks=metrics.clicks, __preSkips=metrics.skips, __preDist=metrics.cursorDist;",
  "var __preLv=cardLevel('dokka-e'), __preKy=game.player.tendency.kyoubou, __preYa=game.player.tendency.yasashisa, __preHp=game.player.hp, __preArea=game.currentArea, __preFlag=hasFlag('got_card');",
  "var __saved = saveGame();",
  "newGame(); startMetrics();", // やり直し相当
  "var __loaded = loadGame();",
  "__o.push('SAVE/LOAD: saved=' + __saved + ' loaded=' + __loaded + ' key=' + SAVE_KEY);",
  "__o.push('SAVE/LOAD player往復 OK? lv ' + cardLevel('dokka-e') + '==' + __preLv + ' / ky ' + game.player.tendency.kyoubou + '==' + __preKy + ' / ya ' + game.player.tendency.yasashisa + '==' + __preYa + ' / hp ' + game.player.hp + '==' + __preHp + ' / area ' + game.currentArea + '==' + __preArea + ' / got_card ' + hasFlag('got_card') + '==' + __preFlag + ' => ' + (cardLevel('dokka-e')===__preLv && game.player.tendency.kyoubou===__preKy && game.player.tendency.yasashisa===__preYa && game.player.hp===__preHp && game.currentArea===__preArea && hasFlag('got_card')===__preFlag));",
  "__o.push('SAVE/LOAD metrics往復 OK? clicks ' + metrics.clicks + '==' + __preClicks + ' / skips ' + metrics.skips + '==' + __preSkips + ' / dist ' + metrics.cursorDist + '==' + __preDist + ' => ' + (metrics.clicks===__preClicks && metrics.skips===__preSkips && Math.abs(metrics.cursorDist-__preDist)<1e-9));",
  "__o.push('SAVE/LOAD 壊れ/空印で false? ' + (function(){clearSave(); return loadGame()===false;})() + ' / hasSave後=' + hasSave());",

  "__o.join('\\n');"
].join("\n");

var output;
try {
  output = "CORE OK\n" + eval(src + "\n" + test);
} catch (e) {
  output = "CORE ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output;
