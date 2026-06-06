/*
 * dom-smoke.js — UI配線の煙テスト（Node/ブラウザ不要・JXAで動く）
 *
 * 目的：headless-check は engine（ルール）だけを見る。こちらは ui.js / main.js を
 *   “最小の擬似DOM”の上で実際に動かし、「クリック → engine → 描き直し」の配線が
 *   壊れていないかを確認する。ブラウザGUIを自動操作せずに実描画経路を通せる。
 *
 * 使い方（このモックのフォルダで実行）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/dom-smoke.js
 */
ObjC.import('Foundation');
function read(p){ return $.NSString.stringWithContentsOfFileEncodingError(p,4,null).js; }

var env = $.NSProcessInfo.processInfo.environment.js;
var base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
if (base.charAt(base.length-1) !== '/') base += '/';
var jsdir = base + 'js/';

/* ───────── 最小の擬似DOM ─────────
 * ui.js が使う機能だけを用意する：getElementById / createElement / appendChild /
 * removeChild / firstChild / className / classList / textContent / innerHTML /
 * style / disabled / title / onclick / scrollTop / scrollHeight
 */
function makeEl(tag){
  var el = {
    tagName: tag, children: [], parent: null,
    _text: '', innerHTML: '', style: {}, disabled: false, title: '', onclick: null,
    scrollTop: 0, scrollHeight: 0
  };
  el.appendChild = function(c){ this.children.push(c); c.parent = this; return c; };
  el.removeChild = function(c){ var i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; };
  Object.defineProperty(el, 'firstChild', { get: function(){ return this.children[0] || null; } });
  Object.defineProperty(el, 'textContent', {
    get: function(){ if(this.children.length){ return this.children.map(function(c){return c.textContent;}).join(''); } return this._text; },
    set: function(v){ this._text = (v==null?'':String(v)); this.children = []; }
  });
  // classList は className 文字列を土台に最小実装
  el.className = '';
  el.classList = {
    _el: el,
    _list: function(){ return this._el.className.split(/\s+/).filter(Boolean); },
    add: function(c){ var a=this._list(); if(a.indexOf(c)<0){ a.push(c); this._el.className=a.join(' '); } },
    remove: function(c){ var a=this._list().filter(function(x){return x!==c;}); this._el.className=a.join(' '); },
    contains: function(c){ return this._list().indexOf(c)>=0; }
  };
  return el;
}

// HTMLの骨組みで定義済みのidを先に用意する（getElementByIdが返す相手）
var IDS = ['mock-intro','enemy-name','heart-bar','heart-num','noise-num','noise-fill',
  'testimony-title','statements','selected-line','cmd-area','memories','words','log',
  'overlay','overlay-box','overlay-title','overlay-text','restart-btn'];
var registry = {};
IDS.forEach(function(id){ registry[id] = makeEl('div'); });

var document = {
  readyState: 'complete', // これで main.js は boot() を即実行する
  getElementById: function(id){ return registry[id] || null; },
  createElement: function(tag){ return makeEl(tag); },
  addEventListener: function(){ /* readyState=complete なので呼ばれない想定 */ }
};

/* ───────── 読み込み（data → engine → ui → main の順）───────── */
var passed=0, failed=0, lines=[];
function ok(c,l){ if(c){passed++; lines.push('  ✅ '+l);} else {failed++; lines.push('  ❌ '+l);} }

try {
  eval(read(jsdir+'data.js'));
  eval(read(jsdir+'engine.js'));
  eval(read(jsdir+'ui.js'));
  eval(read(jsdir+'main.js')); // ここで boot() が走る（fillIntro → newBattle → render）
  ok(true, '読み込み＆起動: 例外なく boot() まで通った');
} catch(e){
  ok(false, '読み込み＆起動で例外: '+e);
}

// ヘルパ：cmd-area から指定ラベルのボタンを探す
function findCmd(label){
  var a = registry['cmd-area'].children;
  for (var i=0;i<a.length;i++) if (a[i].textContent === label) return a[i];
  return null;
}

/* ───────── 起動直後の描画 ───────── */
ok(registry['mock-intro'].children.length > 0, '描画: 説明文(INTRO_TEXT)が流し込まれている');
ok(registry['statements'].children.length === 4, '描画: 第1証言の発言が4つ並ぶ');
ok(registry['memories'].children.length === 4, '描画: 記憶のかけらが4つ並ぶ');
ok(registry['words'].children.length === 4, '描画: 言葉が4つ並ぶ');
ok(findCmd('たずねる') && findCmd('つきつける') && findCmd('考える'), '描画: 3コマンドが出る');
ok(findCmd('たずねる').disabled === true, '描画: 未選択だと「たずねる」は押せない');
ok(registry['heart-bar'].textContent === '■■■', '描画: 閉じた心 ■■■');

/* ───────── クリック配線：発言を選ぶ ───────── */
registry['statements'].children[0].onclick();      // 1番(a1)を選ぶ
ok(state.selected === 'a1', '配線: 発言クリックで a1 を選択');
ok(registry['selected-line'].textContent.indexOf('選択中の発言') >= 0, '配線: 「選択中の発言」が更新される');
ok(findCmd('たずねる').disabled === false, '配線: 選択後は「たずねる」が押せる');

/* ───────── クリック配線：つきつける → 記憶を選ぶ（正解）───────── */
findCmd('つきつける').onclick();                    // 突きつけモードへ
ok(state.mode === 'present', '配線: つきつけるで present モード');
// present モードでは記憶カードに onclick が付く（armed）
var techouCard = registry['memories'].children[0];  // MEMORIES[0] = 村長の手帳
ok(typeof techouCard.onclick === 'function', '配線: present 中は記憶カードが押せる');
techouCard.onclick();                               // 村長の手帳を突きつける（a1の正解）
ok(state.enemy.heart === 2 && state.stageIndex === 1, '配線: 正解で 閉じた心 3→2・第2証言へ');
ok(registry['testimony-title'].textContent.indexOf('学校に連れていった理由') >= 0, '配線: 証言タイトルが第2証言に切替');
ok(registry['statements'].children.length === 4, '配線: 第2証言は4行（b5はまだ隠れている）');

/* ───────── クリック配線：たずねるで隠し行を出す ───────── */
// b3（3番）を選んで「たずねる」→ b5 が出現して5行になる
registry['statements'].children[2].onclick();       // b3 を選択
findCmd('たずねる').onclick();
ok(registry['statements'].children.length === 5, '配線: b3 をたずねると b5 が出現（5行）');

/* ───────── 最後まで：勝利オーバーレイ ───────── */
registry['statements'].children[4].onclick();       // b5 を選択
findCmd('つきつける').onclick();
// 学校の鍵 = MEMORIES[1]
registry['memories'].children[1].onclick();         // 第2証言クリア（心 2→1・第3証言へ）
registry['statements'].children[3].onclick();       // c4 を選択
findCmd('つきつける').onclick();
registry['memories'].children[2].onclick();         // 子どもの落書き = MEMORIES[2] → 勝利
ok(state.result === 'win', '配線: 3つ解いて勝利');
ok(registry['overlay'].classList.contains('show'), '配線: 勝利でオーバーレイが表示される');
ok(registry['overlay-text'].children.length > 0, '配線: 本音のページ本文が描画される');

/* ───────── リスタート配線 ───────── */
registry['restart-btn'].onclick();
ok(state.result === null && state.stageIndex === 0 && state.player.noise === 5, '配線: リスタートで初期化');
ok(!registry['overlay'].classList.contains('show'), '配線: リスタートでオーバーレイが消える');

/* ───────── レポート ───────── */
var header='=== 尋問バトル dom-smoke（UI配線）===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件 失敗 / '+passed+'件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
