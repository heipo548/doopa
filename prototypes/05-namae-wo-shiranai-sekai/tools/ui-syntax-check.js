/*
 * ui-syntax-check.js — DOM/canvas 込みの“読込〜描画〜通しプレイ”をヘッドレスで確認（Node不要・JXA）
 *
 * 最小スタブ（document/window/canvas 2D/localStorage/AudioContext/rAF/timer）で 全9ファイルを
 * 実際の順で eval し、以下を例外なく通すことを確認する：
 *   (1) 構文／未定義参照、(2) main() 起動（タイトル描画）、
 *   (3) フィールド入場・移動・canvas 描画、(4) 言葉システム（？？？→語の描き換え）、
 *   (5) 橋の遭遇（耳をすます×3で 待って/危ない/渡る、橋を見るで 橋、離れるで 成功）と 失敗ルート、
 *   (6) 子どもの遭遇（見る→泣く、耳をすます→お母さん/探す、自動で こわい、一緒に探す→成功）、
 *   (7) ラスト（友達）→ エンディング、(8) 全画面 render が無例外。
 *
 * matchMedia は reduced-motion=true 扱いにして typewriter を同期化（決定論的に歩ける）。
 *
 * 使い方： osascript -l JavaScript prototypes/05-namae-wo-shiranai-sekai/tools/ui-syntax-check.js
 */
ObjC.import('Foundation');
function readFile(p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; }
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "audio.js", "words.js", "state.js", "save.js", "field.js", "encounter.js", "ui.js", "main.js"];

var stub = [
  "var setTimeout=function(fn){ if(typeof fn==='function'){ try{fn();}catch(e){} } return 0; };",
  "var clearTimeout=function(){}; var setInterval=function(){return 0;}; var clearInterval=function(){};",
  "var requestAnimationFrame=function(){ return 1; }; var cancelAnimationFrame=function(){};",
  "var performance={ now:function(){return 0;} };",
  "function _AC(){ this.currentTime=0; this.destination={}; }",
  "_AC.prototype.createOscillator=function(){ return { type:'', frequency:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){}, start:function(){}, stop:function(){} }; };",
  "_AC.prototype.createGain=function(){ return { gain:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){} }; };",
  "var localStorage=(function(){ var _m={}; return { get length(){return Object.keys(_m).length;}, key:function(i){return Object.keys(_m)[i];}, getItem:function(k){return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null;}, setItem:function(k,v){_m[k]=String(v);}, removeItem:function(k){delete _m[k];} }; })();",
  // 偽 canvas 2D コンテキスト（使う API を一通り no-op で用意）
  "function fakeCtx(){ return { fillStyle:'', strokeStyle:'', lineWidth:1, lineCap:'', font:'', textAlign:'', textBaseline:'', globalAlpha:1, globalCompositeOperation:'',",
  "  save:function(){}, restore:function(){}, translate:function(){}, scale:function(){}, clearRect:function(){}, fillRect:function(){},",
  "  beginPath:function(){}, moveTo:function(){}, lineTo:function(){}, arc:function(){}, arcTo:function(){}, ellipse:function(){}, quadraticCurveTo:function(){}, closePath:function(){}, fill:function(){}, stroke:function(){}, setLineDash:function(){}, fillText:function(){},",
  "  measureText:function(){ return { width: 12 }; }, createLinearGradient:function(){ return { addColorStop:function(){} }; }, createRadialGradient:function(){ return { addColorStop:function(){} }; } }; }",
  "function fakeEl(){ var e={ style:{}, dataset:{}, width:660, height:484, _ih:'', textContent:'', className:'',",
  "  classList:{ add:function(){}, remove:function(){}, contains:function(){return false;}, toggle:function(){} },",
  "  set innerHTML(v){ this._ih=v; }, get innerHTML(){ return this._ih; },",
  "  setAttribute:function(){}, getAttribute:function(){return null;}, hasAttribute:function(){return false;}, removeAttribute:function(){},",
  "  appendChild:function(){}, removeChild:function(){}, focus:function(){},",
  "  getContext:function(){ return fakeCtx(); }, getBoundingClientRect:function(){ return {width:660,height:484,left:0,top:0,right:660,bottom:484}; },",
  "  querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, addEventListener:function(){}, removeEventListener:function(){}, closest:function(){ return null; }, parentNode:null }; return e; }",
  "var _elCache={};",
  "var document={ readyState:'complete', body:{ setAttribute:function(){}, classList:{ add:function(){}, remove:function(){}, toggle:function(){} } }, getElementById:function(id){ if(!_elCache[id])_elCache[id]=fakeEl(); return _elCache[id]; }, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, createElement:function(){ return fakeEl(); }, addEventListener:function(){}, get activeElement(){ return null; } };",
  "var window={ matchMedia:function(){ return { matches:true }; }, AudioContext:_AC, webkitAudioContext:_AC, addEventListener:function(){}, requestAnimationFrame:requestAnimationFrame, cancelAnimationFrame:cancelAnimationFrame };",
  "var matchMedia=window.matchMedia; var AudioContext=_AC;",
].join("\n");

var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o=[];",
  "function ok(c,m){ __o.push((c?'OK  ':'NG  ')+m); }",
  // main.js は読込時に main() を自動実行（title 描画まで）
  "ok(app.screen==='title','load + main() 起動（title 描画）');",

  // (2) フィールド入場・移動・描画
  "startGame();",
  "ok(curArea() && curArea().id==='mori','startGame → 森に入場');",
  "app.player.keys.right=true; fieldUpdate(0.1); fieldUpdate(0.1); app.player.keys.right=false;",
  "drawField();",
  "ok(true,'fieldUpdate×2 ＋ drawField 例外なし');",

  // (3) 言葉システム
  "ok(!isKnown('mizu'),'初期は 水 未習得');",
  "learnWord('mizu');",
  "ok(isKnown('mizu') && vocabCount()===1,'learnWord(水) → 習得＋カウント1');",
  "ok(renderText('{mizu} が ながれる').indexOf('水')>=0,'renderText が 水 を描く');",
  "ok(renderText('{hashi} が ある').indexOf('？？？')>=0,'未習得語は ？？？');",

  // (5) 橋の遭遇：成功ルート
  "newGame(); startEncounter('bridge');",
  "ok(typeof encMood()==='string','encMood 文章を返す');",
  "encChoose('mimi'); ok(isKnown('matte'),'耳をすます#1 → 待って');",
  "ok(encSpeechHtml().indexOf('待って')>=0,'相手セリフに 待って が出る（段階的に読める）');",
  "encChoose('mimi'); ok(isKnown('abunai'),'耳をすます#2 → 危ない');",
  "encChoose('mimi'); ok(isKnown('wataru'),'耳をすます#3 → 渡る');",
  "encChoose('miru'); ok(isKnown('hashi'),'橋を見る → 橋');",
  "var __acts=encActions().map(function(a){return a.id;}); ok(__acts.indexOf('hanareru')>=0,'危ない習得後に 離れる が出現');",
  "var __r=encChoose('hanareru'); ok(__r && __r.resolved==='success','離れる → 成功');",
  "var __rd=encResolve('success'); ok(hasFlag('bridge_done'),'成功で bridge_done');",

  // (5b) 橋の遭遇：失敗ルート（進みすぎ→緊張限界）
  "newGame(); startEncounter('bridge');",
  "var __f=null; for(var i=0;i<3;i++){ __f=encChoose('susumu'); } ok(__f && __f.resolved==='fail','進む×3 → 緊張限界で失敗');",
  "encResolve('fail'); ok(isKnown('abunai'),'失敗でも 危ない だけは身につく');",
  "ok(hasFlag('bridge_failed'),'softFlag bridge_failed');",

  // (6) 子どもの遭遇
  "newGame(); learnWord('kodomo'); startEncounter('child');",
  "encChoose('miru'); ok(isKnown('naku'),'見る → 泣く');",
  "encChoose('mimi'); ok(wordLevel('okaasan')>=1,'耳をすます#1 → お母さん（断片）');",
  "encChoose('mimi'); ok(isKnown('okaasan'),'耳をすます#2 → お母さん');",
  "var __c3=encChoose('mimi'); ok(isKnown('sagasu'),'耳をすます#3 → 探す');",
  "ok(isKnown('kowai'),'理解が進み 自動で こわい を覚える');",
  "var __ca=encActions().map(function(a){return a.id;}); ok(__ca.indexOf('issho')>=0,'お母さん習得＋理解で 一緒に探す が出現');",
  "var __cr=encChoose('issho'); ok(__cr && __cr.resolved==='success','一緒に探す → 成功');",
  "encResolve('success'); ok(hasFlag('child_solved') && isKnown('issho'),'成功で child_solved＋一緒');",

  // (7) ラスト → 友達 → エンディング
  "learnWord('tomodachi'); ok(isKnown('tomodachi'),'友達 を覚える（到達点）');",
  "renderEndingShell(); endingAddWord('mizu'); endingShowTitlecard(); ok(true,'エンディング描画 例外なし');",

  // (8) 全画面 render（無例外）
  "newGame(); startEncounter('bridge'); app.screen='encounter'; render();",
  "game.dialogue={npcId:'oldman',lines:['x'],idx:0}; app.screen='dialogue'; render();",
  "game.look={obj:null,step:null,phase:'plain'}; app.screen='look'; render();",
  "app.screen='pause'; render(); app.screen='vocab'; render(); app.screen='title'; render();",
  "enterArea('mura'); app.screen='field'; render(); drawField();",
  "ok(true,'全画面 render（title/field/encounter/dialogue/look/pause/vocab）＋村の描画 例外なし');",

  // (9) セーブ往復
  "saveGame(); ok(hasSave(),'saveGame → hasSave true');",
  "game.words={}; loadGame(); ok(true,'loadGame 例外なし');",

  "__o.join('\\n');"
].join("\n");

var output;
try { output = "=== 名前を知らない世界 / headless check ===\n" + eval(src + "\n" + test); }
catch (e) { output = "UI ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
