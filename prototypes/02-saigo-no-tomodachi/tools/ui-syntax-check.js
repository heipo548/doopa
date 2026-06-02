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
// index.html と同じ読み込み順
var files = ["data.js", "audio.js", "state.js", "battle.js", "cards.js", "ui.js", "main.js"];
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
  "render(); onCommand('act'); onEnemyClick(game.enemies[0].uid); __o.push('act mode list=' + JSON.stringify(ui.pendingActList));",
  "if (ui.pendingActList && ui.pendingActList.length) { selectAct(ui.pendingActList[0]); } __o.push('きいてみる ok (nukumori=' + game.player.nukumori + ')');",
  // 学んだ汎用語が きいてみる に出る経路：手をのばす→gift学習→再度 actOptions
  "newGame(); startWave(); game.enemies[0].wall=0; onCommand('save'); onEnemyClick(game.enemies[0].uid); __o.push('手をのばす ok (save=' + game.counters.save + ', words=' + JSON.stringify(game.player.words) + ')');",
  // 直接 playFx を多種イベントで叩く（吹き出し・メーター・回復・被弾）
  "newGame(); startWave(); game.fx=[{t:'speak',text:'バカ',cat:'toge'},{t:'kyoki',amount:1},{t:'nukumori',amount:1,bonus:{hpUp:2,healed:2}},{t:'pheal',amount:2},{t:'hit',uid:game.enemies[0].uid,dmg:3,dead:false},{t:'calm',uid:game.enemies[0].uid},{t:'save',uid:game.enemies[0].uid},{t:'pdmg',dmg:4}]; playFx(); __o.push('playFx 全イベント ok');",
  // レベルアップ画面
  "game.pendingCards = drawCards(); game.pendingLevelUps = 1; game.state = STATES.LEVEL_UP; render(); __o.push('showLevelUp ok (cards=' + game.pendingCards.length + ')');",
  // 結末画面（dawn）＋ RUN OVER 画面
  "newGame(); startWave(); game.lastWord='いっしょに かえろう'; game.newWords=['arigatou']; game.ending=ENDINGS[0]; game.state=STATES.DAWN; render(); __o.push('showResult(dawn) ok');",
  "game.state=STATES.RUN_OVER; render(); __o.push('showResult(over) ok');",
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
