/*
 * playthrough-check.js — “実際の操作経路（main の入口関数）”で 体験版を最後まで通す結合テスト（JXA）。
 *
 * ユーザーのクリック相当（activateById / advanceLook / advanceDialogue / onArgAction / onNameChoice）を叩き、
 * 村→けんか→もり→ぬし→村(うた)→ほこら→審判→なづけ→エンディング まで“詰まらず”進むかを確認する。
 *   ・matchMedia は reduced-motion=true（typewriter 同期）。setTimeout も同期実行で連鎖を即時消化。
 *   ・ナレーションは drainNarr() で送り切る（クリック連打の代わり）。
 *
 * 使い方： osascript -l JavaScript prototypes/06-kotoba-no-mura/tools/playthrough-check.js
 */
ObjC.import('Foundation');
function readFile(p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; }
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "meta.js", "audio.js", "words.js", "state.js", "save.js", "field.js", "argue.js", "ui.js", "main.js"];

var stub = [
  "var setTimeout=function(fn){ if(typeof fn==='function'){ try{fn();}catch(e){} } return 0; };",
  "var clearTimeout=function(){}; var setInterval=function(){return 0;}; var clearInterval=function(){};",
  "var requestAnimationFrame=function(){ return 1; }; var cancelAnimationFrame=function(){};",
  "var performance={ now:function(){return 0;} };",
  "function _AC(){ this.currentTime=0; this.destination={}; }",
  "_AC.prototype.createOscillator=function(){ return { type:'', frequency:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){}, start:function(){}, stop:function(){} }; };",
  "_AC.prototype.createGain=function(){ return { gain:{ value:0, setValueAtTime:function(){}, exponentialRampToValueAtTime:function(){} }, connect:function(){} }; };",
  "var localStorage=(function(){ var _m={}; return { get length(){return Object.keys(_m).length;}, key:function(i){return Object.keys(_m)[i];}, getItem:function(k){return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null;}, setItem:function(k,v){_m[k]=String(v);}, removeItem:function(k){delete _m[k];} }; })();",
  "function fakeCtx(){ return { fillStyle:'', strokeStyle:'', lineWidth:1, lineCap:'', font:'', textAlign:'', textBaseline:'', globalAlpha:1, globalCompositeOperation:'',",
  "  save:function(){}, restore:function(){}, translate:function(){}, scale:function(){}, clearRect:function(){}, fillRect:function(){},",
  "  beginPath:function(){}, moveTo:function(){}, lineTo:function(){}, arc:function(){}, arcTo:function(){}, ellipse:function(){}, quadraticCurveTo:function(){}, closePath:function(){}, fill:function(){}, stroke:function(){}, setLineDash:function(){}, fillText:function(){}, strokeText:function(){},",
  "  measureText:function(){ return { width: 12 }; }, createLinearGradient:function(){ return { addColorStop:function(){} }; }, createRadialGradient:function(){ return { addColorStop:function(){} }; } }; }",
  "function fakeEl(){ var e={ style:{}, dataset:{}, width:660, height:484, _ih:'', textContent:'', className:'',",
  "  classList:{ add:function(){}, remove:function(){}, contains:function(){return false;}, toggle:function(){} },",
  "  set innerHTML(v){ this._ih=v; }, get innerHTML(){ return this._ih; },",
  "  setAttribute:function(){}, getAttribute:function(){return null;}, hasAttribute:function(){return false;}, removeAttribute:function(){},",
  "  appendChild:function(){}, removeChild:function(){}, focus:function(){},",
  "  getContext:function(){ return fakeCtx(); }, getBoundingClientRect:function(){ return {width:660,height:484,left:0,top:0,right:660,bottom:484}; },",
  "  querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, addEventListener:function(){}, removeEventListener:function(){}, closest:function(){ return null; }, parentNode:null }; return e; }",
  "var _elCache={};",
  "var document={ readyState:'complete', hidden:false, body:{ setAttribute:function(){}, classList:{ add:function(){}, remove:function(){}, toggle:function(){} } }, getElementById:function(id){ if(!_elCache[id])_elCache[id]=fakeEl(); return _elCache[id]; }, querySelector:function(){ return fakeEl(); }, querySelectorAll:function(){ return []; }, createElement:function(){ return fakeEl(); }, addEventListener:function(){}, get activeElement(){ return null; } };",
  "var window={ matchMedia:function(){ return { matches:true }; }, AudioContext:_AC, webkitAudioContext:_AC, addEventListener:function(){}, requestAnimationFrame:requestAnimationFrame, cancelAnimationFrame:cancelAnimationFrame };",
  "var matchMedia=window.matchMedia; var AudioContext=_AC;",
].join("\n");

var src = stub + "\n" + files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o=[];",
  "function ok(c,m){ __o.push((c?'OK  ':'NG  ')+m); }",
  "function drainNarr(max){ var n=0; while(game._narr && n++<(max||80)){ narrAdvance(); } }",
  "function talk(id){ activateById(id); var g=0; while(app.screen==='dialogue' && g++<20){ advanceDialogue(); } }",

  // ── 村：もこ→こえ / とん→なまえ ──
  "startGame();",
  "ok(app.screen==='field' && curArea().id==='mura','開始：ことばの むら');",
  "talk('o_moko'); ok(isKnown('koe'),'村：もこ と話して こえ を覚える');",
  "talk('o_ton'); ok(isKnown('namae'),'村：とん と話して なまえ を覚える');",

  // ── 村のけんか（言い争い）：みみ→ごめん、みる、ごめんで warm ──
  "activateById('o_quarrel'); ok(app.screen==='argue','村：けんかに 介入＝言い争い開始');",
  "onArgAction('ob:kiku'); ok(isKnown('gomen'),'けんか：ごめん を覚える');",
  "onArgAction('ob:miru');",
  "onArgAction('say:gomen'); drainNarr();",
  "ok(hasFlag('quarrel_done') && app.screen==='field','けんか：ごめんで warm 解決→フィールド復帰');",
  "ok(isKnown('arigatou'),'けんか：warmで ありがとう を覚える');",

  // ── もりへ ──
  "activateById('o_exit_mori'); ok(curArea() && curArea().id==='mori','村→もり');",
  "activateById('o_pond'); advanceLook();",                  // step0
  "activateById('o_pond'); advanceLook(); advanceLook();",    // step1：みず習得→after→閉じる
  "ok(isKnown('mizu'),'もり：みずべで みず を覚える');",
  "activateById('o_flower'); advanceLook(); advanceLook();",
  "ok(isKnown('hana') && hasItem('hana_item'),'もり：はなで はな を覚え 1ぽん 持つ');",
  "activateById('o_tree'); advanceLook(); advanceLook();",
  "ok(isKnown('ki'),'もり：きで き を覚える');",
  "activateById('o_sky'); advanceLook(); advanceLook();",
  "ok(isKnown('sora'),'もり：そらで そら を覚える（き が前提）');",

  // ── もりの ぬし（言い争い）：きく→だいじょうぶ、みる→まもる、だいじょうぶで warm ──
  "activateById('o_nushi'); ok(app.screen==='argue','もり：ぬしと 言い争い開始');",
  "onArgAction('ob:kiku'); ok(isKnown('daijoubu'),'ぬし：きくで だいじょうぶ を覚える');",
  "onArgAction('ob:miru'); ok(isKnown('mamoru'),'ぬし：みるで まもる を覚える');",
  "onArgAction('say:daijoubu'); drainNarr();",
  "ok(hasFlag('mori_done') && app.screen==='field','ぬし：だいじょうぶで warm 解決（mori_done）');",
  "ok(isKnown('michi'),'ぬし：warmで みち を覚える');",

  // ── 村へ もどる → うた が現れ かず を教える ──
  "activateById('o_exit_mura'); ok(curArea() && curArea().id==='mura','もり→村');",
  "var __uta = areaObjects().some(function(o){return o.id==='o_uta';}); ok(__uta,'村：mori_done で うた が現れる');",
  "talk('o_uta'); ok(isKnown('kazu') && hasFlag('uta_done'),'村：うた と話して かず を覚える（uta_done で ほこら解錠）');",

  // ── ほこらへ（uta_done で解錠）──
  "activateById('o_exit_hokora'); ok(curArea() && curArea().id==='hokora','村→ほこら（uta_done で解錠）');",

  // ── かぞえうた＝審判 ──
  "activateById('o_watcher'); ok(app.screen==='argue','ほこら：かぞえうた と対面');",
  "drainNarr();",                                            // 導入→みてる習得→審判→なづけ提示
  "ok(isKnown('miteru'),'ほこら：みてる を覚える（不気味の鍵）');",
  "onNameChoice('n_tomo'); drainNarr();",                    // ともだち を選ぶ → エンディング
  "ok(isKnown('tomodachi'),'なづけ：ともだち を覚える（到達点）');",
  "ok(hasFlag('watcher_done'),'watcher_done が立つ');",
  "ok(app.screen==='ending','エンディングへ到達');",
  "ok(['light','dim','dark'].indexOf(game.ending)>=0,'エンディング種別が決まる（'+game.ending+'）');",

  // ── 主要語が揃うか ──
  "var __need=['koe','namae','gomen','arigatou','mizu','hana','ki','sora','daijoubu','mamoru','michi','kazu','miteru','tomodachi'];",
  "var __miss=__need.filter(function(id){return !isKnown(id);});",
  "ok(__miss.length===0,'到達時に主要14語が揃う'+(__miss.length?('（不足:'+__miss.join(',')+'）'):''));",
  "__o.push('—— 覚えた語数: '+vocabCount()+' / '+WORD_ORDER.length+' ／ tone='+game.tone+' ／ watch='+metaWatch());",

  "__o.join('\\n');"
].join("\n");

var output;
try { output = "=== ことばの むら / 通しプレイ結合テスト ===\n" + eval(src + "\n" + test); }
catch (e) { output = "PLAYTHROUGH ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
