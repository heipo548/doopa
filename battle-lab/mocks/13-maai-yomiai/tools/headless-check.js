/*
 * headless-check.js — Battle 13「間合いと言葉の読み合いバトル」コア回帰確認（JXA）
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
ok(state.distance===3 && state.enemy.zawameki===8 && state.enemy.keikai===4, '初期: 距離ふつう・ざわめき8・警戒4');
ok(state.readWins===0 && state.result===null, '初期: 読み勝ち0・勝敗なし');

/* 2) 証人AIの癖（決定的） */
newBattle();
ok(chooseEnemyAction()==='damaru', 'AI: ふつう(tick0)では 黙る');
newBattle(); state.distance=4;
ok(chooseEnemyAction()==='kyozetsu', 'AI: 近い距離では 拒絶');
newBattle(); state.distance=2;
ok(chooseEnemyAction()==='nigeru', 'AI: 遠い距離では 逃げる');
newBattle(); state.enemy.lastPlayer='kiku';
ok(chooseEnemyAction()==='tamesu', 'AI: きかれた次は 試す');
newBattle(); state.enemy.silenceStreak=2;
ok(chooseEnemyAction()==='sakebu', 'AI: 2回黙った後は 叫ぶ');

/* 3) 相性：だまる×叫ぶ＝読み勝ち（警戒↓）*/
newBattle(); state.enemy.silenceStreak=2;   // 次は叫ぶ
var k=state.enemy.keikai;
resolveTurn('damaru');
ok(state.enemy.lastAct==='sakebu', '相性: 証人は 叫んだ');
ok(state.readWins===1 && state.enemy.keikai===k-1, 'だまる×叫ぶ: 読み勝ち（警戒 −1）');

/* 4) 相性：近づく×拒絶＝失敗（こころ −1）*/
newBattle(); state.distance=4;     // 拒絶を誘発
var ko=state.player.kokoro;
resolveTurn('chikaduku');
ok(state.enemy.lastAct==='kyozetsu' && state.player.kokoro===ko-1, '近づく×拒絶: 失敗（こころ −1）');

/* 5) 相性：てをのばす×近づく＝大成功（ざわめき −3）*/
newBattle(); state.distance=3; state.enemy.tick=1;  // tick奇数 → 近づく
var z=state.enemy.zawameki;
resolveTurn('tewonobasu');
ok(state.enemy.lastAct==='chikaduku' && state.enemy.zawameki===z-3, 'てをのばす×近づく: 大成功（ざわめき −3）');

/* 6) きく は読み勝ちでなくても警戒を下げる */
newBattle(); state.distance=2;   // nigeru を誘発（kikuの読み相手ではない）
var k2=state.enemy.keikai;
resolveTurn('kiku');
ok(state.enemy.keikai===k2-1, 'きく: 読み勝ちでなくても 警戒 −1');

/* 7) 読み勝ち勝利：黙る→きく / 試す→うなずく を重ねる */
function tryRead(){
  newBattle();
  resolveTurn('kiku');     // damaru を読む（read1）
  resolveTurn('unazuku');  // tamesu を読む（read2）
  resolveTurn('kiku');     // damaru を読む（read3）→ 勝利
  return { result:state.result, kind:state.endKind, reads:state.readWins };
}
var r=tryRead();
ok(r.result==='win' && r.kind==='read', '読み勝ち勝利: 3回読み勝つ（read）reads='+r.reads);

/* 8) 間合い維持勝利：ふつうを3ターン維持（maai）。
 *    L が動かず黙ると、証人は 黙る→黙る→叫ぶ（いずれも移動なし）で距離3が保たれる。 */
function tryMaai(){
  newBattle();
  resolveTurn('damaru');    // 敵 黙る（移動なし）→ 距離3維持
  resolveTurn('damaru');    // 敵 黙る（移動なし）→ 距離3維持
  resolveTurn('damaru');    // 敵 叫ぶ（移動なし）→ 距離3維持3ターン目
  return { result:state.result, kind:state.endKind, streak:state.distStreak };
}
var mm=tryMaai();
ok(mm.result==='win' && mm.kind==='maai', '間合い維持勝利: ふつうを3ターン（maai）');

/* 8b) だまる×叫ぶ が到達可能（叫ぶが死に状態でないこと）*/
function reachSakebu(){
  newBattle(); var g=0; var saw=false;
  while(state.result===null && g<20){ resolveTurn('damaru'); if(state.enemy.lastAct==='sakebu') saw=true; g++; }
  return saw;
}
ok(reachSakebu()===true, '相性: 叫ぶ が到達可能（2回黙ったあと叫ぶ）');

/* 9) 特殊終了：警戒を0に（ブレイク）→ うなずく */
function trySpecial(){
  newBattle();
  resolveTurn('hanareru');  // 距離2へ（distStreakを切る）
  resolveTurn('kiku'); resolveTurn('kiku'); resolveTurn('kiku'); resolveTurn('kiku'); // 警戒を削ってブレイク
  var broken=state.enemy.broken;
  var rr=resolveTurn('unazuku');  // ブレイク中の決め手
  return { broken:broken, result:state.result, kind:state.endKind };
}
var sp=trySpecial();
ok(sp.broken===true, '特殊: 警戒0で ブレイク');
ok(sp.result==='special' && sp.kind==='stepdown', '特殊終了: ブレイク中うなずくで 証言台を一歩降りる（stepdown）');

/* 10) ざわめき0勝利（条件の結線確認）*/
newBattle(); state.distance=2; state.enemy.zawameki=2;
resolveTurn('namaewoyobu');   // nigeru を読む → ざわめき −2 → 0
ok(state.result==='win' && state.endKind==='zawameki', 'ざわめき0: なまえをよぶ×逃げる でざわめき0（zawameki）');

/* 11) 敗北（こころ）：拒絶へ踏み込み続ける */
function tryLose(){
  newBattle(); state.distance=5; var g=0;
  while(state.result===null && g<20){ resolveTurn('chikaduku'); g++; }  // 近すぎる→拒絶に踏み込み
  return { result:state.result, kind:state.endKind };
}
var l=tryLose();
ok(l.result==='lose' && l.kind==='kokoro', '敗北: 拒絶へ踏み込み続けて こころが尽きる');

/* 12) 決着後・リスタート */
ok(resolveTurn('kiku')===null, '決着後: resolveTurn は無効');
restart();
ok(state.distance===3 && state.readWins===0 && state.result===null, 'リスタート: 初期状態へ');

var header='=== Battle 13 間合いと言葉の読み合いバトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
