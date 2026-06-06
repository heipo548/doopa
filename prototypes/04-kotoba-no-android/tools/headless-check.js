/*
 * headless-check.js — DOM非依存コア(data/metrics/state/save/battle/cards/field)の回帰確認（Node不要）
 *
 * 上位版(2戦アーク＋学校ショップ＋段階出現＋ボス＋word→world回収データ)の契約を JXA で検証する：
 *   ・かどっこ撃破→村へ戻る(screen=field)・kado_done・戦間全回復・両ルート勝利
 *   ・くちなし(ボス isBoss)撃破→結末(screen=result)・boss_done・両ルート勝利・kind生存
 *   ・思いやり=見えないゲージ(kind fxに数値なし)／勝ち方→傾向／darkLevel／3エンド分岐
 *   ・学校ショップ offerShop/buyWord(shopped・色選択で傾向)／ノード段階出現(appearWhen)／出口ロック
 *   ・metrics skipRatio往復／save-load(player+flags+metrics)往復／壊れセーブfallback
 *
 * 使い方： osascript -l JavaScript prototypes/04-kotoba-no-android/tools/headless-check.js
 */
ObjC.import('Foundation');
function readFile(p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; }
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js", "field.js"];
var stub = [
  "var localStorage = (function(){ var _m={}; return {",
  "  get length(){ return Object.keys(_m).length; }, key:function(i){ return Object.keys(_m)[i]; },",
  "  getItem:function(k){ return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null; },",
  "  setItem:function(k,v){ _m[k]=String(v); }, removeItem:function(k){ delete _m[k]; } }; })();",
].join("\n");
var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o = [];",

  // ── newGame ──
  "newGame();",
  "__o.push('newGame: hp=' + game.player.hp + '/' + game.player.maxHp + ' cards=' + JSON.stringify(ownedCards()) + ' name(hidden)=' + game.player.name + ' display=' + game.player.displayName);",

  // ── 戦1 かどっこ harsh：撃破→村へ戻る(screen=field)・kado_done・戦間全回復・hp削れて回復 ──
  "newGame(); startBattle('kadokko');",
  "playerCard('urusai'); playerCard('urusai'); playerCard('urusai'); playerCard('urusai');", // 10×4=40>=34
  "__o.push('FIGHT1 harsh: screen=' + app.screen + ' (field期待) kado_done=' + hasFlag('kado_done') + ' boss_done=' + hasFlag('boss_done') + '(false期待) battle=' + (game.battle?'有':'null'));",
  "__o.push('FIGHT1 harsh: lastWinKind=' + game.lastWinKind + '(false期待) harshWins=' + game.counters.harshWins + ' 戦間全回復 hp=' + game.player.hp + '/' + game.player.maxHp + ' ky=' + game.player.tendency.kyoubou);",

  // ── 続けて 戦2 くちなし(ボス) harsh：撃破→結末(screen=result)・boss_done・生存 ──
  "startBattle('kuchinashi');",
  "__o.push('BOSS init: mindHp=' + game.battle.mindHp + '/' + game.battle.mindHpMax + ' isBoss=' + ENEMIES['kuchinashi'].isBoss);",
  "playerCard('urusai'); playerCard('urusai'); playerCard('urusai'); playerCard('urusai'); playerCard('urusai');", // 10×5=50>=48
  "__o.push('BOSS harsh: screen=' + app.screen + '(result期待) boss_done=' + hasFlag('boss_done') + ' ending=' + (game.ending?game.ending.id:'null') + '(togari期待) hp=' + game.player.hp + '(>0期待) 凶暴=' + game.player.tendency.kyoubou);",

  // ── 戦1 かどっこ kind：寄り添い→gift tonari・field・生存 ──
  "newGame(); startBattle('kadokko'); game.fx=[];",
  "playerCard('kiite');",
  "var __kindNum = (game.fx||[]).some(function(ev){ return ev.type==='kindUse' && ('n' in ev); }) || (game.fx||[]).some(function(ev){ return ('omoiyari' in ev); });",
  "playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite');", // 6×6=36>=36
  "__o.push('FIGHT1 kind: screen=' + app.screen + '(field期待) lastWinKind=' + game.lastWinKind + '(true期待) gift tonari? ' + knowsCard('tonari') + ' hp=' + game.player.hp + ' 思いやり数値fxなし? ' + (__kindNum===false));",

  // ── 戦2 くちなし kind：寄り添い→結末・gift matteru・生存(kiite×7) ──
  "startBattle('kuchinashi');",
  "playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite'); playerCard('kiite');", // 6×7=42>=40
  "__o.push('BOSS kind: screen=' + app.screen + '(result期待) boss_done=' + hasFlag('boss_done') + ' gift matteru? ' + knowsCard('matteru') + ' hp=' + game.player.hp + '(>0期待) ya=' + game.player.tendency.yasashisa + ' ending=' + (game.ending?game.ending.id:'null') + '(yawaragi期待)');",

  // ── side：matteru=healSelf / tonari=lowerAtk（ボスでも効く）──
  "newGame(); game.player.cards['matteru']=1; game.player.cards['tonari']=1; startBattle('kuchinashi');",
  "game.player.hp=12; playerCard('matteru');",
  "__o.push('SIDE matteru healSelf: hp=' + game.player.hp + ' (回復なし=9, 回復ありで12前後)');",
  "var __atk0=game.battle.atk; playerCard('tonari');",
  "__o.push('SIDE tonari lowerAtk: atk ' + __atk0 + '->' + game.battle.atk + ' (下がる期待)');",

  // ── 学校ショップ：offerShop→pending2 / buyWord→shopped・色選択で傾向 ──
  "newGame(); offerShop();",
  "__o.push('SHOP offer: screen=' + app.screen + '(shop期待) stock=' + (game.pendingShop?game.pendingShop.length:0) + '(2期待) =' + JSON.stringify(game.pendingShop));",
  "var __ky0=game.player.tendency.kyoubou; var __b=buyWord('kieyo');",
  "__o.push('SHOP buy kieyo: ' + __b + ' shopped=' + hasFlag('shopped') + ' 手札kieyo=' + knowsCard('kieyo') + ' harsh選択で凶暴+? ' + (game.player.tendency.kyoubou>__ky0));",

  // ── ノード段階出現(appearWhen)＋出口ロック ──
  "newGame(); enterArea('mura');",
  "function __ids(){ return areaNodes().map(function(n){return n.id;}); }",
  "__o.push('NODES 入村直後: ' + __ids().join(',') + ' (n_enemy/n_school/n_boss は出ない期待)');",
  "setFlag('talked_npc_kona'); __o.push('NODES こな会話後 n_enemy出現? ' + (__ids().indexOf('n_enemy')>=0));",
  "setFlag('got_card'); __o.push('NODES 入手後 n_school出現? ' + (__ids().indexOf('n_school')>=0));",
  "setFlag('kado_done'); __o.push('NODES かどっこ撃破後 n_boss出現? ' + (__ids().indexOf('n_boss')>=0));",
  "var __exit=areaNodes().filter(function(n){return n.type==='exit';})[0]; __o.push('EXIT boss_done前 locked? ' + (__exit&&__exit.locked===true));",
  "setFlag('boss_done'); var __exit2=areaNodes().filter(function(n){return n.type==='exit';})[0]; __o.push('EXIT boss_done後 解放? ' + (__exit2&&__exit2.locked===false) + ' canAdvance=' + canAdvance());",

  // ── addCard 3段 / determineEnding 3分岐 / darkLevel ──
  "newGame(); var a=addCard('kieyo'); var b=addCard('kieyo'); var c=addCard('kieyo'); var d=addCard('kieyo');",
  "__o.push('addCard: ' + a + '->' + b + '->' + c + '->' + d + ' lv=' + cardLevel('kieyo') + ' (3で打ち止め期待) power=' + cardPower('kieyo'));",
  "function __end(r){ newGame(); game.player.tendency.yasashisa=Math.round(r*100); game.player.tendency.kyoubou=Math.round((1-r)*100); return determineEnding().id; }",
  "__o.push('ending 0.1/0.5/0.9 = ' + __end(0.1) + '/' + __end(0.5) + '/' + __end(0.9) + ' (togari/yuragi/yawaragi期待)');",
  "__o.push('dark: darkenAt=' + JSON.stringify(BALANCE.darkenAt) + ' k0->' + (function(){newGame();return darkLevel();})() + ' k40->' + (function(){newGame();game.player.tendency.kyoubou=40;return darkLevel();})() + '(3期待)');",
  "__o.push('META存在? godName=' + (typeof META!=='undefined' && META.godName) + ' reveal行=' + (META.reveal?META.reveal.length:0) + ' DARK_LINES=' + (typeof DARK_LINES!=='undefined' && DARK_LINES.length));",

  // ── metrics ──
  "startMetrics(); textShown(10); textAdvanced({skipped:false}); textShown(20); textAdvanced({skipped:true}); textShown(15); textAdvanced({skipped:false});",
  "var __sum=metricsSummary(); __o.push('metrics skipRatio=' + __sum.skipRatio.toFixed(3) + '(0.333期待) OK? ' + (Math.abs(__sum.skipRatio-1/3)<1e-6));",

  // ── save/load 往復（flags含む）＋ 壊れfallback ──
  "newGame(); enterArea('mura'); addCard('kieyo'); addKyoubou(7); addYasashisa(3); game.player.hp=17; setFlag('kado_done'); setFlag('shopped');",
  "startMetrics(); metrics.clicks=42; textShown(8); textAdvanced({skipped:true});",
  "var P={lv:cardLevel('kieyo'),ky:game.player.tendency.kyoubou,ya:game.player.tendency.yasashisa,hp:game.player.hp,area:game.currentArea,kado:hasFlag('kado_done'),shop:hasFlag('shopped'),clicks:metrics.clicks,skips:metrics.skips};",
  "var __sv=saveGame(); newGame(); startMetrics(); var __ld=loadGame();",
  "__o.push('SAVE/LOAD saved=' + __sv + ' loaded=' + __ld + ' key=' + SAVE_KEY);",
  "__o.push('SAVE/LOAD 往復 OK? ' + (cardLevel('kieyo')===P.lv && game.player.tendency.kyoubou===P.ky && game.player.tendency.yasashisa===P.ya && game.player.hp===P.hp && game.currentArea===P.area && hasFlag('kado_done')===P.kado && hasFlag('shopped')===P.shop && metrics.clicks===P.clicks && metrics.skips===P.skips));",
  "__o.push('SAVE/LOAD 壊れ/空印 fallback? ' + (function(){clearSave(); return loadGame()===false && hasSave()===false;})());",

  "__o.join('\\n');"
].join("\n");

var output;
try { output = "CORE OK\n" + eval(src + "\n" + test); }
catch (e) { output = "CORE ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
