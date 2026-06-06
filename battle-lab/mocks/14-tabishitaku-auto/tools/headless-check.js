/*
 * headless-check.js — Battle 14「旅支度オートバトル」コア回帰確認（JXA）
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 */
ObjC.import('Foundation');
function readFile(p){ return $.NSString.stringWithContentsOfFileEncodingError(p,4,null).js; }
var env=$.NSProcessInfo.processInfo.environment.js;
var base=(env['MOCKDIR']?env['MOCKDIR'].js:$.NSFileManager.defaultManager.currentDirectoryPath.js);
if(base.charAt(base.length-1)!=='/') base+='/';
eval(readFile(base+'js/data.js')+'\n'+readFile(base+'js/engine.js'));

var passed=0,failed=0,lines=[];
function ok(c,l){ if(c){passed++;lines.push('  ✅ '+l);} else {failed++;lines.push('  ❌ '+l);} }
function runToEnd(){ var g=0; while(state.phase==='battle' && g<30){ step(); g++; } }

/* 1) 初期化・準備 */
newBattle();
ok(state.phase==='prep' && state.bag.length===9, '初期: prep フェーズ・カバン9マス');
ok(available().length===9, '初期: 持ち物は9種');
ok(placeItem('letter',0)===true, '配置: 手紙を(0)へ');
ok(state.bag[0]==='letter' && available().length===8, '配置: 反映され 残り8種');
ok(placeItem('letter',1)===false, '配置: 同じ持ち物は二度置けない');
ok(placeItem('photo',0)===false, '配置: 埋まったマスには置けない');
ok(takeItem(0)===true && state.bag[0]===null, '取り出し: 手紙を戻せる');

/* 1b) 空のカバンでは旅に出られない（準備＝戦いの核を守る）*/
newBattle();
ok(startBattle()===false && state.phase==='prep', '空カバン: 戦闘開始できない（prepのまま）');

/* 2) 手紙は最後に発動する */
newBattle();
placeItem('letter',0); placeItem('arigatou',1); placeItem('photo',2);
startBattle();
ok(state.phase==='battle', 'startBattle: battle フェーズへ');
ok(state.queue[state.queue.length-1]===0, '発動順: 手紙(セル0)は最後');

/* 3) シナジー判定 */
newBattle();
placeItem('letter',0); placeItem('photo',1);   // 隣接
startBattle();
ok(state.syn.memory===true, 'シナジー: 手紙＋写真＝記憶開示');
newBattle();
placeItem('stone',0); placeItem('branch',1);
startBattle();
ok(state.syn.defenseUp===true && state.defense===1, 'シナジー: 石＋枝＝防御アップ');
newBattle();
placeItem('bell',0); placeItem('blank',1);
startBattle();
ok(state.syn.bellDelay===true && state.enemyFirstSkip===true, 'シナジー: 鈴＋空白＝初回行動遅延');

/* 4) 説得（言葉中心で ざわめき0）*/
function tryPersuade(){
  newBattle();
  placeItem('photo',0); placeItem('arigatou',1); placeItem('letter',3);  // 言葉中心（写真と手紙は非隣接でもOK）
  startBattle(); runToEnd();
  return { result:state.result, kind:state.endKind, word:state.wordDmg, thing:state.thingDmg };
}
var p=tryPersuade();
ok(p.result==='win' && p.kind==='persuade', '説得: 言葉中心で ざわめき0 → persuade (word'+p.word+'/thing'+p.thing+')');

/* 5) 懲らしめ（物中心で ざわめき0）*/
function tryPunish(){
  newBattle();
  placeItem('stone',0); placeItem('bell',2); placeItem('branch',6);  // 物中心（石＋枝は非隣接にして防御切り離し）
  startBattle(); runToEnd();
  return { result:state.result, kind:state.endKind, word:state.wordDmg, thing:state.thingDmg };
}
var pu=tryPunish();
ok(pu.result==='win' && pu.kind==='punish', '懲らしめ: 物中心で ざわめき0 → punish (word'+pu.word+'/thing'+pu.thing+')');

/* 6) 見逃す（削りきれず生き残る）*/
function tryLetgo(){
  newBattle();
  placeItem('bread',0); placeItem('daijoubu',2);  // ダメージ0の回復のみ → ざわめき残る
  startBattle(); runToEnd();
  return { result:state.result, kind:state.endKind, zawameki:state.enemy.zawameki };
}
var lg=tryLetgo();
ok(lg.result==='win' && lg.kind==='letgo' && lg.zawameki>0, '見逃す: 削りきれず → letgo (ざわめき残'+lg.zawameki+')');

/* 7) 空白エンド（空白を中心セル4へ）*/
function tryBlank(){
  newBattle();
  placeItem('blank',4);                 // 真ん中
  placeItem('photo',0); placeItem('arigatou',1);
  startBattle(); runToEnd();
  return { result:state.result, kind:state.endKind };
}
var bl=tryBlank();
ok(bl.result==='special' && bl.kind==='blank', '空白エンド: 中心に空白 → 特殊終了 blank');

/* 8) 介入：ひとつ使う で任意の持ち物を先に発動 */
newBattle();
placeItem('photo',0); placeItem('arigatou',1); placeItem('stone',2);
startBattle();
var before=state.enemy.zawameki;
ok(useItem(2)===true, '介入: useItem(2) 実行');
ok(state.enemy.zawameki < before, '介入: 指定の持ち物が すぐ発動');

/* 9) パン＋だいじょうぶ で回復が強まる */
newBattle();
state.player.kokoro = 4;                  // 回復が見えるよう減らしておく
placeItem('bread',0); placeItem('daijoubu',1);  // 隣接
startBattle();
var k0=state.player.kokoro;
step();  // パン発動（回復 3+2=5）
ok(state.player.kokoro >= k0+1, 'パン＋だいじょうぶ: 回復が強まる');

/* 10) 決着後・リスタート */
newBattle(); placeItem('photo',0); placeItem('arigatou',1); startBattle(); runToEnd();
ok(step()===false, '決着後: step は無効');
restart();
ok(state.phase==='prep' && state.enemy.zawameki===6 && state.result===null, 'リスタート: 初期状態へ');

var header='=== Battle 14 旅支度オートバトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
