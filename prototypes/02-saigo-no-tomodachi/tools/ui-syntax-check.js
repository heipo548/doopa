/*
 * ui-syntax-check.js — DOM依存（ui/audio/main）の構文＆参照チェック（Node不要・JXA）
 *
 * なぜ：ui.js / audio.js / main.js は document/window/AudioContext に依存するため、
 *   headless-check.js（コアのみ）では読めない。ここでは最小の DOM スタブを用意して
 *   全ファイルを読み込み、各画面の描画関数・演出を実際に呼び、ReferenceError や
 *   関数の打ち間違い（wordById / catClass / learnedKindWords 等）を検出する。
 *   ※見た目の正しさは検証しない（それは実機）。あくまで「JSが落ちない」ことの確認。
 *
 * 使い方： osascript -l JavaScript prototypes/02-saigo-no-tomodachi/tools/ui-syntax-check.js
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
// index.html と同じ読み込み順（field.js は cards→ui の間）
var files = ["data.js", "audio.js", "state.js", "battle.js", "cards.js", "field.js", "ui.js", "main.js"];
var src = files.map(function (f) { return readFile(base + f); }).join("\n");

// ── 最小 DOM/Window スタブ ─────────────────────────────
var stub = [
  "function __el(){ var e={_h:'',_t:'',style:{},dataset:{},",
  "  classList:{add:function(){},remove:function(){},contains:function(){return false;},toggle:function(){}},",
  "  setAttribute:function(){},getAttribute:function(){return null;},",
  "  addEventListener:function(){},removeEventListener:function(){},",
  "  appendChild:function(c){return c;},removeChild:function(){},remove:function(){},",
  "  querySelector:function(){return __el();},querySelectorAll:function(){return [];},",
  "  getBoundingClientRect:function(){return {left:0,top:0,width:10,height:10,right:10,bottom:10};},",
  "  focus:function(){},scrollTop:0,scrollHeight:0};",
  "  Object.defineProperty(e,'innerHTML',{get:function(){return e._h;},set:function(v){e._h=v;}});",
  "  Object.defineProperty(e,'textContent',{get:function(){return e._t;},set:function(v){e._t=v;}});",
  "  return e; }",
  "var document={getElementById:function(){return __el();},createElement:function(){return __el();},",
  "  querySelector:function(){return __el();},querySelectorAll:function(){return [];},",
  "  body:__el(),addEventListener:function(){}};",
  "var window={addEventListener:function(){},AudioContext:undefined,webkitAudioContext:undefined};",
  // setTimeout はコールバックを“その場で”実行＝遅延演出(playFxのstagger等)の参照エラーも検出する",
  "function setTimeout(fn){ if(typeof fn==='function'){ fn(); } return 0; } function clearTimeout(){} function setInterval(){return 0;} function clearInterval(){}",
].join("\n");

// ── 各画面・演出を実際に呼んで、落ちないか確認する ──
var drive = [
  "var __o=[];",
  "startRun(); render(); __o.push('render PLAYER_TURN ok');",
  // ぶつける（単体ことば）を最後まで：cmdFight→render→playFx（speak/kyoki/hit/wordBubble/meterFloat）
  "selectWeapon('namida'); onEnemyClick(game.enemies[0].uid); __o.push('ぶつける ok (kyoki=' + game.player.kyoki + ')');",
  // きいてみる：相手選択→ことば選択（actOptionsFor/wordById/catClass）→cmdAct
  // v0.6：きいてみる は みんなに話す（対象選択なし）。onCommand('act')→候補→selectAct→全体に効く
  "render(); onCommand('act'); __o.push('act mode=' + ui.mode + ' list=' + JSON.stringify(ui.pendingActList));",
  "var __wallsBefore = game.enemies.map(function(e){return e.wall;}).join(',');",
  "if (ui.pendingActList && ui.pendingActList.length) { selectAct(ui.pendingActList[0]); }",
  "__o.push('きいてみる(全体) ok 壁 ' + __wallsBefore + ' -> ' + game.enemies.map(function(e){return e.wall;}).join(',') + ' / nukumori=' + game.player.nukumori);",
  // v0.6 サクサク：idle で敵を直接クリック＝主力の単体ことばで攻撃（1タップ）
  "newGame(); startWave(); ui.mode='idle'; var __hp0=game.enemies[0].hp; onEnemyClick(game.enemies[0].uid); var __after=(livingEnemies()[0]?livingEnemies()[0].hp:'(退けた)'); __o.push('クイック攻撃 ok (敵HP ' + __hp0 + ' -> ' + __after + ')');",
  // 学んだ汎用語が きいてみる に出る経路：手をのばす→gift学習→再度 actOptions
  "newGame(); startWave(); game.enemies[0].wall=0; onCommand('save'); __o.push('手をのばす(1体→自動むかえる) ok (save=' + game.counters.save + ', words=' + JSON.stringify(game.player.words) + ')');",
  // ── v0.7：ことばの“重み”（こころコスト）／対象1体は選択省略／毎ターン回復 ──
  "newGame(); startWave(); game.player.kokoro=0; var __cf=cmdFight('namida', game.enemies[0].uid); __o.push('こころ0で ぶつける 弾かれる ok (' + (__cf===false) + ')');",
  "newGame(); startWave(); game.player.weapons.push('kiero'); var __k0=game.player.kokoro; cmdFight('kiero', game.enemies[0].uid); __o.push('重いことば→こころ純減 ok (' + __k0 + ' -> ' + game.player.kokoro + ' / kiero cost=' + WEAPONS.kiero.cost + ' > 回復' + BALANCE.kokoroRegenPerTurn + ')');",
  "newGame(); startWave(); var __lv=livingEnemies(); __lv.slice(1).forEach(function(e){e.dead=true;}); ui.mode='idle'; selectWeapon(primarySingleWeapon()); __o.push('単体1体は選択省略→即発射 ok (mode=' + ui.mode + ', 残り=' + livingEnemies().length + ')');",
  "newGame(); startWave(); game.player.kokoro=3; var __kb=game.player.kokoro; cmdDefend(); __o.push('こらえる→こころ回復 ok (' + __kb + ' -> ' + game.player.kokoro + ')');",
  // 直接 playFx を多種イベントで叩く（吹き出し・メーター・回復・被弾）
  "newGame(); startWave(); game.fx=[{t:'speak',text:'草ァ！',cat:'toge',meme:'kusa'},{t:'kyoki',amount:1},{t:'nukumori',amount:1,bonus:{hpUp:2,healed:2}},{t:'pheal',amount:2},{t:'kspend',amount:2},{t:'kregen',amount:2},{t:'hit',uid:game.enemies[0].uid,dmg:3,dead:false},{t:'calm',uid:game.enemies[0].uid},{t:'evoice',uid:game.enemies[0].uid,text:'……きいて くれるの？'},{t:'save',uid:game.enemies[0].uid},{t:'noeffect',all:true},{t:'pdmg',dmg:4}]; playFx(); __o.push('playFx 全イベント(ミーム/敵の返事/こころ増減/全体ノーエフェクト含む) ok');",
  // レベルアップ画面
  "game.pendingCards = drawCards(); game.pendingLevelUps = 1; game.state = STATES.LEVEL_UP; render(); __o.push('showLevelUp ok (cards=' + game.pendingCards.length + ')');",
  // 結末画面（dawn）＋ RUN OVER 画面
  "newGame(); startWave(); game.lastWord='いっしょに かえろう'; game.newWords=['arigatou']; game.ending=ENDINGS[0]; game.state=STATES.DAWN; render(); __o.push('showResult(dawn) ok');",
  "game.state=STATES.RUN_OVER; render(); __o.push('showResult(over) ok');",
  // 全shapeのピクセルスプライトが壊れず生成されるか（rect数で簡易検証）",
  "['circle','ghost','bunny','spider','boss'].forEach(function(sh){ ['neutral','happy','sad'].forEach(function(ex){ var s=creatureSVG('#8f9ee0',sh,ex); if(!/^<svg/.test(s)||(s.match(/<rect/g)||[]).length<18) throw 'sprite broken: '+sh+'/'+ex; }); });",
  "__o.push('sprites: 全shape×表情 生成OK');",

  // ── v0.4 メタループ：街 → 夜のフィールド → 戦闘 → 夜明けで街へ → マクロ結末 が落ちないか ──",
  "initMeta(); enterTown(); render(); __o.push('town render ok (night=' + meta.night + ', screen=' + app.screen + ')');",
  "goToField(); render(); __o.push('field build ok (goal=' + field.goal + ', nodes=' + field.nodes.length + ', 2D y=' + field.y + ')');",
  // 2D マウス追従で道のおわりまで歩く：時刻を注入して fieldStepToward を回す（rAFの代わり）。
  //   未doneの友/ことばの y へ targetY を寄せて確実に踏む（検証の縦ズレ詰み回避）。友に出会えば むかえる。
  "fieldSetTarget(1, 0.5); var __t=0, __g=0;",
  "while(!field.reachedBattle && __g++ < 1500){",
  "  if(field.activeFriend){ fieldGreet(); continue; }",
  "  var __n=null; for(var __i=0;__i<field.nodes.length;__i++){ var __d=field.nodes[__i]; if(!__d.done && __d.type!=='battle'){ __n=__d; break; } }",
  "  field.targetX = field.goal; field.targetY = __n ? __n.y : 0;",
  "  fieldStepToward(__t += 16.7);",
  "}",
  "__o.push('2D field walk ok (x=' + (Math.round(field.x*10)/10) + '/' + field.goal + ', reachedBattle=' + field.reachedBattle + ', picked=' + JSON.stringify(field.picked) + ', townFriends=' + meta.friends.length + ', dusk=' + Math.round(field.dusk) + ')');",
  // y クランプ確認（fieldSetTarget(_, 5) でも targetY<=1）
  "fieldSetTarget(1, 5); __o.push('y clamp ok (targetY=' + field.targetY + ' <=1 ? ' + (field.targetY<=1) + ')');",
  // 道のおわりで戦闘へ：newGame が meta.learnedWords を語彙に種まきしているか
  "startNightBattle(); render(); __o.push('night battle start ok (state=' + game.state + ', wordsCarried=' + JSON.stringify(game.player.words) + ')');",
  // ── よふけメーター → 戦闘の入り（battle.js無改変・field側の橋渡し）──
  "initMeta(); goToField(); field.dusk=10; startNightBattle(); __o.push('nightfall RUSH ok (dusk10 → nukumori=' + game.player.nukumori + '>=' + NIGHTFALL.rushNukumori + ' ' + (game.player.nukumori>=NIGHTFALL.rushNukumori) + ' / weaponLv不変 ' + (game.player.weaponLv.namida===1) + ')');",
  "initMeta(); goToField(); field.dusk=70; startNightBattle(); __o.push('nightfall LATE ok (dusk70 → kyoki=' + game.player.kyoki + '>=' + NIGHTFALL.lateKyoki + ' ' + (game.player.kyoki>=NIGHTFALL.lateKyoki) + ')');",
  // 第一夜チュートリアル：1体ウェーブを むかえて→夜明け（結末グリッドを出さない最小表示）→街へ
  "initMeta(); goToField(); startNightBattle(); game.enemies[0].wall=0; onCommand('save'); __o.push('tutorial: 1体むかえる ok (save=' + game.counters.save + ', tutorial=' + game.tutorial + ', state=' + game.state + ')');",
  "render(); __o.push('tutorial dawn 最小表示 ok (screen=' + app.screen + ')');",
  // 夜明け→街へかえる（returnToTown）：戦果がメタに積まれ 夜が進むか
  "initMeta(); game.counters.kill=2; game.counters.save=3; game.ending=ENDINGS[0]; game.state=STATES.DAWN; meta.nightStartFriends=0; returnToTown(); render(); __o.push('returnToTown ok (night=' + meta.night + ', totalSave=' + meta.totalSave + ', screen=' + app.screen + ')');",
  // さいごの夜を越える → マクロ結末（総和で結末確定・画面遷移）
  "meta.night = meta.maxNights; goToField(); startNightBattle(); game.counters.kill=1; game.counters.save=5; game.ending=ENDINGS[0]; game.state=STATES.DAWN; returnToTown(); render();",
  "__o.push('macro ending ok (screen=' + app.screen + ', macro=' + (field.macro?field.macro.ending.id:'none') + ', friendBonus=' + (field.macro?field.macro.friendBonus:'NA') + ')');",

  "return __o.join('\\n');"
].join("\n");

// すべて IIFE の中で eval する。理由：ui.js は `function $(id){…}` を宣言するが、
//   JXA のグローバル `$`（Objective-C ブリッジ）は再定義できない。関数スコープに包めば
//   ゲーム側の `$` はローカルになり衝突しない（ブラウザ実機の挙動とも一致）。
var program = "(function(){\n" + stub + "\n" + src + "\n" + drive + "\n})()";

var output;
try {
  output = "UI/AUDIO/MAIN OK\n" + eval(program);
} catch (e) {
  output = "UI CHECK ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output;
