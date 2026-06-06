/*
 * ui-syntax-check.js — DOM依存(audio/ui/main)込みの読込・描画通し確認（Node不要）
 *
 * 最小 DOM/window/AudioContext/rAF/timer スタブで全10ファイルを実際の順で eval し、
 * (1)構文/未定義参照、(2)main()起動、(3)全画面(title/field/dialogue/cards/shop/battle/result/meta/gameover/pause)の
 * render が例外なく回ること、(4)神様メタの全フェーズ(open/skip/click/鏡/reveal/close/encore)が描画できることを検出する。
 * matchMedia は reduced-motion=true 扱いにして typewriter を同期化し、メタ進行を決定論的に歩ける。
 *
 * 使い方： osascript -l JavaScript prototypes/04-kotoba-no-android/tools/ui-syntax-check.js
 */
ObjC.import('Foundation');
function readFile(p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; }
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "audio.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js", "field.js", "ui.js", "main.js"];

var stub = [
  "var setTimeout=function(fn){return 0;}; var clearTimeout=function(){};",
  "var setInterval=function(){return 0;}; var clearInterval=function(){};",
  "var requestAnimationFrame=function(){return 1;}; var cancelAnimationFrame=function(){};",
  "var performance={ now:function(){return 0;} };",
  "function _AC(){ this.currentTime=0; this.destination={}; }",
  "_AC.prototype.createOscillator=function(){ return { type:'', frequency:{ setValueAtTime:function(){} }, connect:function(){}, start:function(){}, stop:function(){} }; };",
  "_AC.prototype.createGain=function(){ return { gain:{ setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){} }; };",
  "var localStorage=(function(){ var _m={}; return { get length(){return Object.keys(_m).length;}, key:function(i){return Object.keys(_m)[i];}, getItem:function(k){return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null;}, setItem:function(k,v){_m[k]=String(v);}, removeItem:function(k){delete _m[k];} }; })();",
  "function fakeEl(){ return { style:{}, dataset:{}, _ih:'', classList:{ add:function(){}, remove:function(){}, contains:function(){return false;}, toggle:function(){} }, set innerHTML(v){ this._ih=v; }, get innerHTML(){ return this._ih; }, textContent:'', setAttribute:function(){}, getAttribute:function(){return null;}, appendChild:function(){}, removeChild:function(){}, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, addEventListener:function(){}, removeEventListener:function(){}, getBoundingClientRect:function(){ return {width:300,height:225,left:0,top:0,right:300,bottom:225}; }, focus:function(){}, closest:function(){ return null; }, parentNode:null }; }",
  "var _elCache={};",
  "var document={ readyState:'complete', body:fakeEl(), getElementById:function(id){ if(!_elCache[id])_elCache[id]=fakeEl(); return _elCache[id]; }, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, createElement:function(){ return fakeEl(); }, addEventListener:function(){}, get activeElement(){ return null; } };",
  "var window={ matchMedia:function(){ return { matches:true }; }, AudioContext:_AC, webkitAudioContext:_AC, addEventListener:function(){}, requestAnimationFrame:requestAnimationFrame, cancelAnimationFrame:cancelAnimationFrame };",
  "var matchMedia=window.matchMedia; var AudioContext=_AC;",
].join("\n");

var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o=[];",
  "__o.push('load + main() OK（title 描画まで例外なし）');",
  "newGame(); app.player={x:0.5,y:0.86,tx:0.5,ty:0.86,pendingNode:null};",
  "function R(s){ app.screen=s; render(); __o.push('render('+s+') OK'); }",
  "enterArea('mura'); R('field');",
  "startDialogue('npc_kona'); __o.push('startDialogue OK screen='+app.screen);",
  "offerCards('npc_kona'); R('cards');",
  "offerShop(); __o.push('openShop OK screen='+app.screen+' stock='+(game.pendingShop?game.pendingShop.length:0));",
  "startBattle('kadokko'); R('battle');",
  "playerCard('urusai'); playerCard('urusai'); __o.push('playerCard×2(urusai) OK mindHp='+(game.battle?game.battle.mindHp:'(決着)')+'(34->14期待) screen='+app.screen);",
  // ボス戦も描画
  "newGame(); app.player={x:.5,y:.5}; startBattle('kuchinashi'); R('battle'); __o.push('boss render OK mindHp='+game.battle.mindHp);",
  // 結果→神様メタの全フェーズを歩く
  "newGame(); game.player.tendency.yasashisa=30; game.player.tendency.kyoubou=10; setFlag('boss_done'); determineEnding(); R('result');",
  "startMetrics(); textShown(10); textAdvanced({skipped:true}); textShown(10); textAdvanced({skipped:false});", // 計測の鏡に値を入れる
  "toMeta(); __o.push('toMeta OK screen='+app.screen+' seq='+app.meta.seq.length);",
  "var __steps=0; for(var i=0;i<app.meta.seq.length+3;i++){ advanceMeta(); __steps++; } __o.push('advanceMeta 全フェーズ歩行 OK steps='+__steps+' idx='+app.meta.idx);",
  // ── 回帰：戦闘コマンドが“次も”選べるか（busy→render→busy解除の順序バグ検出）──
  "newGame(); startBattle('kadokko'); app.battleBusy=false;",
  "onCard('urusai');", // 一手目：busy=true で render（コマンドは敵ターン待ちで無効化されるのが正）
  "var __cb1=document.getElementById('command-bar').innerHTML;",
  "__o.push('一手目後: busy='+app.battleBusy+' / コマンド無効(敵待ち)='+(__cb1.indexOf('disabled')>=0)+'（true期待）');",
  "resolveEnemyTurn();", // 敵ターン解決：ここで busy を解除してから再描画＝コマンドが有効に戻るべき
  "var __cb2=document.getElementById('command-bar').innerHTML;",
  "__o.push('敵ターン後: busy='+app.battleBusy+' / コマンド有効='+(__cb2.indexOf('disabled')<0)+'（true期待＝次が押せる）');",
  "var __busyBefore2=app.battleBusy; onCard('urusai'); __o.push('二手目 受理='+(app.battleBusy===true && __busyBefore2===false)+'（true期待＝連続選択OK）');",
  // 残り画面
  "R('gameover'); R('pause'); R('title');",
  "__o.push('全画面 render OK（shop/meta 含む）');",
  "__o.join('\\n');"
].join("\n");

var output;
try { output = "UI OK\n" + eval(src + "\n" + test); }
catch (e) { output = "UI ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
