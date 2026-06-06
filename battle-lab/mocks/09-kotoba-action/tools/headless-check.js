/*
 * headless-check.js — Battle 09「ことばアクションコマンドバトル」コア回帰確認（JXA）
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 */
ObjC.import('Foundation');
function readFile(p){ return $.NSString.stringWithContentsOfFileEncodingError(p,4,null).js; }
var env=$.NSProcessInfo.processInfo.environment.js;
var base=(env['MOCKDIR']?env['MOCKDIR'].js:$.NSFileManager.defaultManager.currentDirectoryPath.js);
if(base.charAt(base.length-1)!=='/') base+='/';
eval(readFile(base+'js/data.js')+'\n'+readFile(base+'js/engine.js'));

var passed=0, failed=0, lines=[];
function ok(c,l){ if(c){passed++; lines.push('  ✅ '+l);} else {failed++; lines.push('  ❌ '+l);} }

/* 1) 初期化 */
newBattle();
ok(state.player.kokoro===10, '初期: こころ 10');
ok(state.enemy.zawameki===10 && state.enemy.keikai===2, '初期: ざわめき10・警戒2');
ok(state.streak===0 && state.result===null, '初期: 連続0・勝敗なし');

/* 2) タイミング判定 */
ok(judgePos(50,false)==='deep', '判定: 中央(50)は ふかく届いた');
ok(judgePos(60,false)==='good', '判定: 60 は 届いた');
ok(judgePos(75,false)==='slight', '判定: 75 は 少し届いた');
ok(judgePos(95,false)==='miss', '判定: 95(遅い) は 届かなかった');
ok(judgePos(5,false)==='rush', '判定: 5(早い) は 急かしてしまった');
ok(judgePos(65,true)==='slight' && judgePos(65,false)==='good', '判定: Lv2は窓が狭い（65は通常good/Lv2でslight）');

/* 3) はなす deep でざわめきが下がる */
newBattle();
resolveCommand('hanasu',50);
ok(state.enemy.zawameki < 10, 'はなす(deep): ざわめきが下がる');
ok(state.lastJudge==='deep', 'はなす(deep): 判定が deep');

/* 4) きく(deep) は はなすより警戒を下げる（きくは警戒を下げる）*/
newBattle(); resolveCommand('kiku',50);   var kk=state.enemy.keikai;
newBattle(); resolveCommand('hanasu',50); var kh=state.enemy.keikai;
ok(kk < kh, 'きく(deep): はなすより警戒が下がる（同じ敵手番でも きく は警戒 −1）');

/* 5) ふれる失敗(急かす)で警戒が上がる */
newBattle();
var k2=state.enemy.keikai;
resolveCommand('fureru',2);   // rush
ok(state.enemy.keikai >= k2+1, 'ふれる(急かす): 警戒が上がる');

/* 6) めっちゃありがとう は逆効果（ざわめき＋警戒が上がる）*/
newBattle();
resolveCommand('hanasu',50);                       // まずざわめきを上限未満へ
var z=state.enemy.zawameki, k3=state.enemy.keikai;
resolveCommand('meccha',50);
ok(state.enemy.zawameki>z && state.enemy.keikai>k3, 'Lv3: めっちゃありがとうは逆効果（ざわめき・警戒が戻る）');
ok(state.lastJudge==='backfire', 'Lv3: 判定は backfire');

/* 7) 勝利（ざわめき）：deep を重ねて0に */
function tryZawameki(){
  newBattle(); var g=0;
  while(!state.result && g<40){
    if(state.enemy.keikai>=2) resolveCommand('kiku',50);     // 警戒を抑える
    else resolveCommand('fureru',50);                        // 大きく削る
    g++;
  }
  return { result:state.result, kind:state.endKind };
}
var a=tryZawameki();
ok(a.result==='win', '勝利: 警戒を抑えつつ ざわめきを0にできる ('+a.kind+')');

/* 8) 連続成功(todoke)勝利：はなす deep を3連続 */
newBattle();
resolveCommand('hanasu',50); resolveCommand('hanasu',50); resolveCommand('hanasu',50);
ok(state.result==='win' && (state.endKind==='todoke'||state.endKind==='zawameki'),
   '連続: 正しく3連続で勝てる ('+state.endKind+')');

/* 9) 連続は失敗でリセット */
newBattle();
resolveCommand('hanasu',50);            // streak1
resolveCommand('hanasu',5);             // rush → reset
ok(state.streak===0, '連続: 失敗で streak リセット');

/* 10) 特殊終了：警戒を0にして だまる → 授業が止まる */
function trySilence(){
  newBattle(); var g=0;
  while(state.result===null && g<30){
    var r = chooseSilence(true);
    if(r && r.special) break;
    g++;
  }
  return { result:state.result, kind:state.endKind };
}
var s=trySilence();
ok(s.result==='special' && s.kind==='silence', '特殊終了: だまるで授業が止まる（black board の l が消える）');

/* 11) 敗北（こころ）：急かし続けると こころが尽きる */
function tryLose(){
  newBattle(); var g=0;
  while(state.result===null && g<60){ resolveCommand('hanasu',2); g++; }  // 常に急かす＝届かない
  return { result:state.result, kind:state.endKind };
}
var l=tryLose();
ok(l.result==='lose' && l.kind==='kokoro', '敗北: 届かない言葉ばかりで こころが尽きる');

/* 12) 決着後は受け付けない */
newBattle(); while(state.result===null) resolveCommand('hanasu',50);
var t=state.turn; var rr=resolveCommand('hanasu',50);
ok(rr===null && state.turn===t, '決着後: それ以上は進まない');

/* 13) リスタート */
restart();
ok(state.enemy.zawameki===10 && state.streak===0 && state.result===null, 'リスタート: 初期状態へ');

var header='=== Battle 09 ことばアクションコマンドバトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
