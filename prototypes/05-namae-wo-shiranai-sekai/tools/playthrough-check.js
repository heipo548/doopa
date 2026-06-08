/*
 * playthrough-check.js — “実際の操作経路（main の入口関数）”で 体験版を最後まで通す結合テスト（JXA）
 *
 * ui-syntax-check.js が 構文＋低レベルAPI＋全画面render を見るのに対し、こちらは
 * main.js の公開フロー（activateById / advanceLook / advanceDialogue / onEncAction / onFinChoice）を
 * ユーザーのクリック相当で叩き、森→橋→村→子ども→母→ラスト→エンディング まで“詰まらず”進むかを確認する。
 *
 *   ・matchMedia は reduced-motion=true（typewriter 同期）。setTimeout も同期実行で連鎖を即時消化。
 *   ・ナレーション/会話は「進める」関数をループで叩いて先へ送る（クリック連打の代わり）。
 *
 * 使い方： osascript -l JavaScript prototypes/05-namae-wo-shiranai-sekai/tools/playthrough-check.js
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
  // ナレーション/会話/調べ を“クリック連打”相当で前へ送るヘルパ
  "function pump(fn,max){ var n=0; while(n++<(max||40)){ var before=app.screen; fn(); if(!game._narr && app.screen===before && !twActive()) { /* 進まなくなったら抜ける */ if(n>1) break; } } }",
  "function drainNarr(max){ var n=0; while(game._narr && n++<(max||60)){ narrAdvance(); } }",

  // ── 森：水を覚える（2回調べる）→ 花 → 花を1本 ──
  "startGame();",
  "activateById('o_pond'); advanceLook();",                 // 1回目（学習なし→閉じる）
  "activateById('o_pond'); advanceLook(); advanceLook();",   // 2回目（水習得→after→閉じる）
  "ok(isKnown('mizu'),'森：水辺を調べて 水 を覚える');",
  "activateById('o_flower'); advanceLook();",               // 花 step0
  "activateById('o_flower'); advanceLook(); advanceLook();", // 花 step1（水必要→花習得）
  "ok(isKnown('hana'),'森：花を調べて 花 を覚える（水が前提）');",
  "activateById('o_flower'); advanceLook();",               // 花 step2（1本もらう）
  "ok(hasItem('hana_item'),'森：花を1本 持つ（子ども遭遇で使える）');",

  // ── 森の出口 → 橋へ（水を覚えたので開く）──
  "activateById('o_exit_mori');",
  "ok(curArea() && curArea().id==='hashi','森の出口 → 壊れた橋へ（learned_mizu で解錠）');",

  // ── 橋の遭遇：耳をすます×3＋橋を見る→離れる で成功 ──
  "activateById('o_bridge');",
  "ok(app.screen==='encounter','橋に触れて 遭遇 開始');",
  "onEncAction('mimi'); onEncAction('mimi'); onEncAction('mimi');",
  "ok(isKnown('matte')&&isKnown('abunai')&&isKnown('wataru'),'橋：耳をすます×3 で 待って/危ない/渡る');",
  "onEncAction('miru'); ok(isKnown('hashi'),'橋：橋を見る で 橋');",
  "onEncAction('hanareru');",                                // 成功 → 結果ナレーション
  "drainNarr();",                                            // 結果文を送り切る → 決着処理
  "ok(hasFlag('bridge_done') && app.screen==='field','橋：離れる→成功→フィールド復帰（bridge_done）');",

  // ── 橋の出口 → 村へ ──
  "activateById('o_exit_hashi');",
  "ok(curArea() && curArea().id==='mura','橋の出口 → 村へ');",

  // ── 村：老人と話して 人 / 母と話して 子ども ──
  "activateById('o_oldman'); var __g=0; while(app.screen==='dialogue' && __g++<12){ advanceDialogue(); }",
  "ok(isKnown('hito'),'村：老人と話して 人 を覚える');",
  "activateById('o_house1'); advanceLook(); advanceLook();", // 人を覚えた後に家を調べる→村（after まで送って閉じる）",
  "ok(isKnown('mura'),'村：人を覚えたあと 家を調べて 村');",
  "activateById('o_mother'); var __g3=0; while(app.screen==='dialogue' && __g3++<12){ advanceDialogue(); }",
  "ok(isKnown('kodomo'),'村：母と話して 子ども を覚える');",
  "activateById('o_villager2'); var __g4=0; while(app.screen==='dialogue' && __g4++<14){ advanceDialogue(); }",
  "ok(isKnown('arigatou'),'村：橋の村人と再会して ありがとう を覚える');",

  // ── 子どもの遭遇：見る→泣く、耳すます×3、一緒に探す→成功 ──
  "activateById('o_child');",
  "ok(app.screen==='encounter','村：泣いている子に 遭遇 開始');",
  "onEncAction('miru'); ok(isKnown('naku'),'子ども：見る で 泣く');",
  "onEncAction('mimi'); onEncAction('mimi'); onEncAction('mimi');",
  "ok(isKnown('okaasan')&&isKnown('sagasu')&&isKnown('kowai'),'子ども：耳をすます で お母さん/探す＋自動で こわい');",
  "onEncAction('issho'); drainNarr();",
  "ok(hasFlag('child_solved') && app.screen==='field','子ども：一緒に探す→成功→復帰（child_solved）');",

  // ── 母に再会 → ラスト（友達）→ エンディング ──
  "activateById('o_mother');",
  "ok(app.screen==='finale','母に話しかけ → ラストイベントへ分岐');",
  "drainNarr();",                                            // 導入→母→子の seq を送る → 選択肢提示
  "onFinChoice('take'); drainNarr();",                       // 手を取る → 友達 → afterLearn → エンディング
  "ok(isKnown('tomodachi'),'ラスト：友達 を覚える（体験版の到達点）');",
  "ok(hasFlag('finale_done'),'finale_done が立つ');",
  "ok(app.screen==='ending','エンディングへ到達');",

  // ── 覚えた言葉の総数（到達時に主要語が揃っているか）──
  "var __need=['mizu','hana','hito','mura','hashi','matte','abunai','wataru','kodomo','naku','kowai','sagasu','okaasan','issho','tomodachi'];",
  "var __miss=__need.filter(function(id){return !isKnown(id);});",
  "ok(__miss.length===0,'到達時に主要15語が揃う'+(__miss.length?('（不足:'+__miss.join(',')+'）'):''));",
  "__o.push('—— 覚えた語数: '+vocabCount()+' / '+WORD_ORDER.length);",

  "__o.join('\\n');"
].join("\n");

var output;
try { output = "=== 名前を知らない世界 / 通しプレイ結合テスト ===\n" + eval(src + "\n" + test); }
catch (e) { output = "PLAYTHROUGH ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
