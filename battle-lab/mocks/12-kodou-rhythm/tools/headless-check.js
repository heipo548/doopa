/*
 * headless-check.js — Battle 12「鼓動リズムバトル」コア回帰確認（JXA）
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

/* 1) 初期化 */
newBattle();
ok(state.enemy.zawameki===8 && state.sync===0 && state.drown===0, '初期: ざわめき8・同調0・飲まれ0');
ok(currentPattern()==='stable', '初期: 最初は 安定パターン');
ok(state.result===null, '初期: 勝敗なし');

/* 2) パターンの循環 */
ok(patternFor(0)==='stable' && patternFor(2)==='unstable' && patternFor(3)==='silence',
   'リズム: stable,stable,unstable,silence で循環');

/* 3) はなす good でざわめきが下がる */
newBattle();
resolveBeat('hanasu','good');
ok(state.enemy.zawameki===6, 'はなす good: ざわめき −2');

/* 4) miss で飲まれが上がる（乱れはこころも削る）*/
newBattle();
resolveBeat('hanasu','miss');                      // round0 stable
ok(state.drown===1, 'miss(安定): 飲まれ +1');
// round2 が乱れ。round1 を good で流して round2 を miss
newBattle();
resolveBeat('kiku','good');                         // round0
resolveBeat('kiku','good');                         // round1
ok(currentPattern()==='unstable', '前提: round2 は 乱れ');
var k0=state.player.kokoro;
resolveBeat('hanasu','miss');                       // round2 unstable miss
ok(state.drown===2 && state.player.kokoro===k0-1, 'miss(乱れ): 飲まれ +2・こころ −1');

/* 5) いきをあわせる は 同調+2・飲まれ+1 */
newBattle();
resolveBeat('ikiwoawaseru','good');
ok(state.sync===2 && state.drown===1, 'いきをあわせる good: 同調+2・飲まれ+1');

/* 6) いきをずらす で 飲まれが下がる */
newBattle();
resolveBeat('ikiwoawaseru','good'); resolveBeat('ikiwoawaseru','good'); // drown 2
resolveBeat('ikiwozurasu','good');  // unstable round2 でも good 扱い
ok(state.drown===0, 'いきをずらす good: 飲まれ −2');

/* 7) 無音で だまる(wait) は大成功（同調+2・ざわめき-1）*/
newBattle();
resolveBeat('kiku','good'); resolveBeat('kiku','good'); resolveBeat('kiku','good'); // round0,1,2 → round3=silence
ok(currentPattern()==='silence', '前提: round3 は 無音');
var z=state.enemy.zawameki, sy=state.sync;
resolveBeat('damaru','wait');
ok(state.sync===Math.min(MAX_SYNC,sy+2) && state.enemy.zawameki===z-1 && state.silenceMastered, '無音 だまる: 同調+2・ざわめき-1・silenceMastered');

/* 8) 無音で音を立てると飲まれる */
newBattle();
resolveBeat('kiku','good'); resolveBeat('kiku','good'); resolveBeat('kiku','good'); // → silence
resolveBeat('hanasu','good');  // 無音で はなす
ok(state.drown>=1, '無音で音: 飲まれが上がる');

/* 8b) 非無音で だまる はノーペナルティ（誤判定で飲まれ/こころが減らない）*/
newBattle();   // round0 = stable
var d0=state.drown, ko0=state.player.kokoro, z0=state.enemy.zawameki;
resolveBeat('damaru','miss');
ok(state.drown===d0 && state.player.kokoro===ko0 && state.enemy.zawameki===z0, '非無音 だまる: ペナルティなし(no-op)');

/* 9) 勝利（ざわめき）：はなす good を重ねる */
function tryZawameki(){
  newBattle(); var g=0;
  while(state.result===null && g<30){ resolveBeat('hanasu','good'); g++; }
  return { result:state.result, kind:state.endKind };
}
var a=tryZawameki();
ok(a.result==='win' && a.kind==='zawameki', '勝利: はなす good で ざわめき0（zawameki）');

/* 10) 特殊終了：同調を上げて 無音で だまる → 灯台は海を照らす */
function trySpecial(){
  newBattle();
  resolveBeat('ikiwoawaseru','good');  // r0 sync2 drown1
  resolveBeat('ikiwoawaseru','good');  // r1 sync4 drown2
  resolveBeat('ikiwozurasu','good');   // r2(unstable) drown0
  resolveBeat('damaru','wait');        // r3 silence → sync6>=5 → 特殊
  return { result:state.result, kind:state.endKind, sync:state.sync };
}
var s=trySpecial();
ok(s.result==='special' && s.kind==='lighthouse', '特殊終了: 高同調＋無音だまるで 灯台は海を照らす（sync='+s.sync+'）');

/* 11) 敗北（飲まれ）：合わせすぎると飲まれる */
function tryDrown(){
  newBattle(); var g=0;
  while(state.result===null && g<30){ resolveBeat('ikiwoawaseru','good'); g++; }
  return { result:state.result, kind:state.endKind };
}
var l=tryDrown();
ok(l.result==='lose' && l.kind==='drown', '敗北: 合わせすぎて 飲まれる（drown）');

/* 12) 決着後は受け付けない */
ok(resolveBeat('hanasu','good')===null, '決着後: resolveBeat は無効');

/* 13) リスタート */
restart();
ok(state.enemy.zawameki===8 && state.sync===0 && state.drown===0 && state.result===null, 'リスタート: 初期状態へ');

var header='=== Battle 12 鼓動リズムバトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
