/*
 * ui-syntax-check.js — 構文＋低レベルAPI＋全画面render＋データ整合を JXA でヘッドレス検証。
 *
 * 見るもの：
 *   ・全 js が構文OKで読め、main() が落ちずに起動するか。
 *   ・AREAS の grid が cols×rows ぴったりで、spawn/出口/オブジェクトが範囲内か。
 *   ・各画面（title/field/look/dialogue/argue/vocab/pause/ending）の render が落ちないか。
 *   ・言葉システム（renderText の {{id}} 置換）・言い争い（argueFrame/argueChoose）・審判（metaVerdict）が動くか。
 *
 * 使い方： osascript -l JavaScript prototypes/06-kotoba-no-mura/tools/ui-syntax-check.js
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

  // ── 起動（main() は読み込みで自動実行済み）──
  "ok(typeof game==='object','起動：game が存在');",
  "ok(app.screen==='title','起動：タイトル画面');",
  "ok(typeof WORDS==='object' && WORD_ORDER.length===20,'データ：言葉20語');",

  // ── grid 整合（cols×rows、spawn/出口/オブジェクトが範囲内）──
  "var __gridok=true, __why='';",
  "Object.keys(AREAS).forEach(function(k){ var a=AREAS[k];",
  "  if(a.grid.length!==a.rows){__gridok=false;__why=k+' rows';}",
  "  a.grid.forEach(function(row,y){ if(row.length!==a.cols){__gridok=false;__why=k+' row'+y+'='+row.length;} });",
  "  if(a.spawn.tx<0||a.spawn.tx>=a.cols||a.spawn.ty<0||a.spawn.ty>=a.rows){__gridok=false;__why=k+' spawn';}",
  "  (a.objects||[]).forEach(function(o){ if(o.tx<0||o.tx>=a.cols||o.ty<0||o.ty>=a.rows){__gridok=false;__why=k+' obj '+o.id;} });",
  "});",
  "ok(__gridok,'マップ：全グリッドが cols×rows で、spawn/オブジェクトが範囲内'+(__gridok?'':'（'+__why+'）'));",

  // ── spawn と 全 walkable 出口が歩けるか（地形ベース）──
  "function solidCh(ch){ return ch==='T'||ch==='H'||ch==='~'||ch==='o'||ch===' '; }",
  "var __spawnok=true;",
  "Object.keys(AREAS).forEach(function(k){ var a=AREAS[k]; var ch=(a.grid[a.spawn.ty]||'')[a.spawn.tx]||' '; if(solidCh(ch)) {__spawnok=false;} });",
  "ok(__spawnok,'マップ：各エリアの spawn が歩けるタイル');",

  // ── 言葉システム ──
  "newGame();",
  "ok(renderText('みず={{mizu}}').indexOf('？？？')>=0,'words：未習得は ？？？ 表示');",
  "learnWord('mizu');",
  "ok(isKnown('mizu') && renderText('{{mizu}}').indexOf('みず')>=0,'words：習得すると 語が出る');",
  "ok(toneOfWord('urusai')==='toge' && toneOfWord('arigatou')==='yawa','words：トーン分類');",

  // ── トーン（やわらか語で明、とげ語で暗）──
  "var __t0=game.tone; learnWord('arigatou'); ok(game.tone>__t0,'tone：やわらか語で明るくなる');",

  // ── 各画面 render が落ちない ──
  "var __rok=true; ['title'].forEach(function(s){ app.screen=s; try{render();}catch(e){__rok=false;} });",
  "ok(__rok,'render：title 落ちない');",
  "newGame(); enterArea('mura'); var __r2=true; ['field'].forEach(function(s){ app.screen=s; try{render();drawField();refreshFieldHud();}catch(e){__r2=false; __o.push('  '+e);} });",
  "ok(__r2,'render：field(村)＋drawField 落ちない');",
  "enterArea('mori'); try{drawField();}catch(e){__r2=false;} enterArea('hokora'); try{drawField();}catch(e){__r2=false;}",
  "ok(__r2,'render：もり/ほこら drawField 落ちない');",

  // ── 言い争い（quarrel）の論理 ──
  "newGame(); enterArea('mura'); startArgue('quarrel',{doneFlag:'quarrel_done'});",
  "ok(app.screen==='argue' && argueFrame()!==null,'argue：開始＆フレーム取得');",
  "var rk=argueChoose('ob:kiku'); ok(isKnown('gomen')&&isKnown('urusai')&&isKnown('dame'),'argue：みみをすますで ごめん＋とげ語(うるさい/だめ)を覚える');",
  "argueChoose('ob:miru'); var rs=argueChoose('say:gomen'); ok(rs && rs.resolved==='warm','argue：つうじが満ちて ごめん で warm 解決');",
  "var rr=argueResolve('warm'); ok(isKnown('arigatou') && hasFlag('quarrel_done'),'argue：warm解決で ありがとう習得＋doneFlag');",

  // ── 言い争い（harsh＝とげ連打で黙らせる）も成立し、世界が暗くなるか ──
  "newGame(); enterArea('mura'); startArgue('quarrel',{doneFlag:'quarrel_done'});",
  "argueChoose('ob:kiku');",
  "var h1=argueChoose('say:urusai'); var h2=argueChoose('say:urusai');",
  "ok((h1&&h1.resolved==='harsh')||(h2&&h2.resolved==='harsh'),'argue：とげ連打で harsh 解決に到達');",
  "argueResolve('harsh'); ok(isKnown('acchi'),'argue：harshで あっち を覚える');",
  "ok(game.tone<0,'tone：とげ選択で世界が暗くなる（dark分岐の素地）');",

  // ── 審判（メタ）──
  "ok(typeof metaWatch()==='number','meta：watch スコアが数値');",
  "var vd=metaVerdict(); ok(Array.isArray(vd) && vd.length>=3,'meta：審判テキストが3行以上 生成される');",
  "ok(typeof metaSummary().clicks==='number','meta：サマリが取れる');",

  // ── セーブ往復（軽い難読化）──
  "newGame(); learnWord('koe'); learnWord('hana'); game.currentArea='mura'; saveGame();",
  "newGame(); var lo=loadGame(); ok(lo && isKnown('koe') && isKnown('hana'),'save：難読化セーブ→ロードで言葉が復元');",

  "__o.push('—— 言葉数: '+WORD_ORDER.length+' / エリア: '+Object.keys(AREAS).length+' / 言い争い: '+Object.keys(ARGUES).length);",
  "__o.join('\\n');"
].join("\n");

var output;
try { output = "=== ことばの むら / 構文・整合チェック ===\n" + eval(src + "\n" + test); }
catch (e) { output = "SYNTAX/RUNTIME ERROR: " + e + (e.line ? (" (line " + e.line + ")") : ""); }
output;
