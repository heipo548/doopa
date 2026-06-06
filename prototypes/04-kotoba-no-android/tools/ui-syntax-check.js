/*
 * ui-syntax-check.js — DOM依存ファイル(audio/ui/main)まで含めた読込・描画の通し確認（Node不要）
 *
 * なぜ：headless-check.js はコア(DOM非依存)だけを見る。こちらは DOM/window/AudioContext/rAF/
 *       setInterval を“最小スタブ”で用意し、全10ファイル＋audio を実際の読み込み順で eval して、
 *       (1) 構文エラー/未定義参照、(2) main() 起動、(3) 各画面 render() が例外なく回ることを検出する。
 *       JXA(JavaScriptCore) には setTimeout/rAF/AudioContext が無いのでスタブで補う。
 *
 * 使い方： osascript -l JavaScript prototypes/04-kotoba-no-android/tools/ui-syntax-check.js
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "audio.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js", "field.js", "ui.js", "main.js"];

// ── 最小 DOM/環境スタブ（eval スコープ先頭に注入する文字列）──
var stub = [
  // タイマー/rAF（JXA に無い）。即時/no-op で返す。
  "var setTimeout = function(fn){ return 0; };",
  "var clearTimeout = function(){};",
  "var setInterval = function(){ return 0; };",
  "var clearInterval = function(){};",
  "var requestAnimationFrame = function(){ return 1; };",
  "var cancelAnimationFrame = function(){};",
  "var performance = { now: function(){ return 0; } };",
  // AudioContext スタブ（鳴らさない）
  "function _AC(){ this.currentTime=0; this.destination={}; }",
  "_AC.prototype.createOscillator=function(){ return { type:'', frequency:{ setValueAtTime:function(){} }, connect:function(){}, start:function(){}, stop:function(){} }; };",
  "_AC.prototype.createGain=function(){ return { gain:{ setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){} }; };",
  // localStorage（メモリ）
  "var localStorage = (function(){ var _m={}; return { get length(){return Object.keys(_m).length;}, key:function(i){return Object.keys(_m)[i];}, getItem:function(k){return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null;}, setItem:function(k,v){_m[k]=String(v);}, removeItem:function(k){delete _m[k];} }; })();",
  // fakeEl：あらゆる DOM 呼び出しを飲み込む（querySelector は自身を返してチェーン可）
  "function fakeEl(){ return { style:{}, dataset:{}, _ih:'', classList:{ add:function(){}, remove:function(){}, contains:function(){return false;}, toggle:function(){} }, set innerHTML(v){ this._ih=v; }, get innerHTML(){ return this._ih; }, textContent:'', setAttribute:function(){}, getAttribute:function(){return null;}, appendChild:function(){}, removeChild:function(){}, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, addEventListener:function(){}, removeEventListener:function(){}, getBoundingClientRect:function(){ return {width:300,height:225,left:0,top:0,right:300,bottom:225}; }, focus:function(){}, closest:function(){ return null; }, parentNode:null }; }",
  "var _elCache = {};",
  "var document = { readyState:'complete', body: fakeEl(), getElementById:function(id){ if(!_elCache[id]) _elCache[id]=fakeEl(); return _elCache[id]; }, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, createElement:function(){ return fakeEl(); }, addEventListener:function(){}, get activeElement(){ return null; } };",
  "var window = { matchMedia:function(){ return { matches:false }; }, AudioContext:_AC, webkitAudioContext:_AC, addEventListener:function(){}, requestAnimationFrame:requestAnimationFrame, cancelAnimationFrame:cancelAnimationFrame };",
  "var matchMedia = window.matchMedia;",
  "var AudioContext = _AC;",
].join("\n");

var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

// 各画面を render して例外が出ないか（main() は eval 中に既に1回起動＝title 描画済み）。
var test = [
  "var __o = [];",
  "__o.push('load + main() OK（title 描画まで例外なし）');",
  // 明示的に各画面を組み立てて render（window 経由：export guard が走っているので window.render 等が存在）",
  "newGame();",
  "function R(s){ app.screen=s; render(); __o.push('render(' + s + ') OK'); }",
  "enterArea('mura'); R('field');",
  "startDialogue('npc_kona'); __o.push('startDialogue OK screen=' + app.screen);",
  "offerCards('npc_kona'); R('cards');",
  "startBattle('kadokko'); R('battle');",
  "playerCard('urusai'); playerCard('urusai'); __o.push('playerCard×2(urusai=手札) OK mindHp=' + (game.battle?game.battle.mindHp:'(決着)') + ' (34->14期待) screen=' + app.screen);",
  "determineEnding(); R('result');",
  "R('gameover'); R('pause'); R('title');",
  "__o.push('全画面 render OK');",
  "__o.join('\\n');"
].join("\n");

var output;
try {
  output = "UI OK\n" + eval(src + "\n" + test);
} catch (e) {
  output = "UI ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output;
