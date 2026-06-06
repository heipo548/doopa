/*
 * dom-smoke.js — UI配線の煙テスト（JXA・Node/ブラウザ不要）
 *
 * headless-check は engine（ルール）だけを見る。こちらは ui.js / main.js を
 * “最小の擬似DOM”の上で実際に動かし、「起動 → クリック → 再描画」の配線が
 * 例外なく通るかを確認する。getElementById は未知IDも自動生成するので、
 * どのモックでも使い回せる作り。
 *
 * 使い方（このモックのフォルダで）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/dom-smoke.js
 */
ObjC.import('Foundation');
function read(p){ return $.NSString.stringWithContentsOfFileEncodingError(p,4,null).js; }
var env=$.NSProcessInfo.processInfo.environment.js;
var base=(env['MOCKDIR']?env['MOCKDIR'].js:$.NSFileManager.defaultManager.currentDirectoryPath.js);
if(base.charAt(base.length-1)!=='/') base+='/';
var jsdir=base+'js/';

/* ── 最小の擬似DOM（ui.js が使う機能だけ。未知IDは自動生成）── */
function makeEl(tag){
  var el={ tagName:tag, children:[], parent:null, _text:'', innerHTML:'', style:{},
    disabled:false, title:'', onclick:null, scrollTop:0, scrollHeight:0, value:'' };
  el.appendChild=function(c){ this.children.push(c); c.parent=this; return c; };
  el.removeChild=function(c){ var i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; };
  el.setAttribute=function(){}; el.getAttribute=function(){ return null; };
  el.addEventListener=function(ev,fn){ if(ev==='click') this.onclick=fn; };
  Object.defineProperty(el,'firstChild',{ get:function(){ return this.children[0]||null; } });
  Object.defineProperty(el,'textContent',{
    get:function(){ if(this.children.length) return this.children.map(function(c){return c.textContent;}).join(''); return this._text; },
    set:function(v){ this._text=(v==null?'':String(v)); this.children=[]; } });
  el.className='';
  el.classList={ _el:el,
    _list:function(){ return this._el.className.split(/\s+/).filter(Boolean); },
    add:function(c){ var a=this._list(); if(a.indexOf(c)<0){ a.push(c); this._el.className=a.join(' '); } },
    remove:function(c){ this._el.className=this._list().filter(function(x){return x!==c;}).join(' '); },
    contains:function(c){ return this._list().indexOf(c)>=0; },
    toggle:function(c,on){ if(on) this.add(c); else this.remove(c); } };
  return el;
}
var registry={};
var document={ readyState:'complete',
  getElementById:function(id){ if(!registry[id]) registry[id]=makeEl('div'); return registry[id]; },
  createElement:function(tag){ return makeEl(tag); },
  addEventListener:function(){}, querySelector:function(){ return null; },
  querySelectorAll:function(){ return []; }, body:makeEl('body') };
var window={ requestAnimationFrame:function(){ return 0; }, cancelAnimationFrame:function(){},
  setTimeout:function(){ return 0; }, clearTimeout:function(){}, setInterval:function(){ return 0; }, clearInterval:function(){} };
function requestAnimationFrame(){ return 0; } function cancelAnimationFrame(){}
function setTimeout(){ return 0; } function clearTimeout(){}
function setInterval(){ return 0; } function clearInterval(){}

var passed=0, failed=0, lines=[];
function ok(c,l){ if(c){passed++; lines.push('  ✅ '+l);} else {failed++; lines.push('  ❌ '+l);} }

try{
  eval(read(jsdir+'data.js'));
  eval(read(jsdir+'engine.js'));
  eval(read(jsdir+'ui.js'));
  eval(read(jsdir+'main.js'));   // boot() がここで走る
  ok(true,'起動: 例外なく boot() まで通った');
}catch(e){ ok(false,'起動で例外: '+e); }

ok(registry['mock-intro'] && registry['mock-intro'].children.length>0, '描画: 説明文が流し込まれている');
ok(typeof UI!=='undefined' && typeof UI.render==='function', 'UI.render が存在する');

// 全登録要素の子孫から onclick を持つボタンを集める
function collectClickables(){
  var found=[];
  function walk(el){ if(!el) return; if(typeof el.onclick==='function') found.push(el);
    for(var i=0;i<el.children.length;i++) walk(el.children[i]); }
  for(var id in registry) walk(registry[id]);
  return found;
}
var clicks=collectClickables();
ok(clicks.length>0, '配線: クリック可能な要素が存在する');

// 何度かクリック→再描画して例外が出ないかを見る（決着しても安全に止まる想定）
var crashed=false;
try{
  for(var i=0;i<14;i++){
    var c=collectClickables();
    if(!c.length) break;
    c[i % c.length].onclick();
    if(typeof UI.render==='function') UI.render();
  }
}catch(e){ crashed=true; lines.push('  ❌ クリック巡回で例外: '+e); failed++; }
ok(!crashed, '配線: クリック→再描画を繰り返しても例外なし');

// リスタート配線（あれば）
try{ if(typeof registry['restart-btn'].onclick==='function'){ registry['restart-btn'].onclick(); ok(true,'配線: リスタートが例外なく動く'); } }
catch(e){ ok(false,'リスタートで例外: '+e); }

var header='=== Battle 11 dom-smoke（UI配線）===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
