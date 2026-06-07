/*
 * headless-check.js — Battle 11「ことばを置く盤面バトル」コア回帰確認（JXA）
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
ok(state.player.x===3 && state.player.y===3, '初期: L は (3,3)');
ok(state.shadow.x===2 && state.shadow.y===1, '初期: 影は (2,1)');
ok(state.actionsLeft===2 && state.turn===0, '初期: 2行動・ターン0');
ok(state.result===null, '初期: 勝敗なし');

/* 2) 置く場所のルール */
newBattle();
ok(placeMark(9,9)===false, '置く: 盤外には置けない');
ok(placeMark(1,2)===false, '置く: 木(1,2)には置けない');
ok(placeMark(0,0)===false, '置く: L から遠い／出口には置けない');
ok(placeMark(2,2)===true,  '置く: L隣接の空きマス(2,2)には置ける');
ok(state.actionsLeft===1,  '置く: 行動を1消費');

/* 3) 移動のルール */
newBattle();
ok(moveL(3,3)===false, '移動: その場へは動けない');
ok(moveL(1,1)===false, '移動: 斜め/2マスは動けない');
ok(moveL(3,4)===true,  '移動: 上下左右1マスは動ける');

/* 4) しるしで影が誘導される（逃げ→誘導に変わる）*/
newBattle();
placeMark(2,2); endTurn();
ok(state.shadow.x===2 && state.shadow.y===2, 'しるし: 影は しるし(2,2)へ来た（逃げずに）');

/* 5) 何もしないと 影は出口へ逃げる（escape） */
newBattle();
endTurn(); endTurn(); endTurn();
ok(state.result==='lose' && state.endKind==='escape', '放置: 影は出口へ逃げて escape 敗北');

/* 6) 基本勝利：しるしの道で影をベンチへ（bench）*/
function tryBench(){
  newBattle();
  placeMark(2,2); endTurn();   // 影 (2,1)->(2,2)
  placeMark(2,3); endTurn();   // 影 (2,2)->(2,3)
  placeMark(2,4); endTurn();   // 影 (2,3)->ベンチ
  return { result:state.result, kind:state.endKind, here:state.shadow.hereCount };
}
var b=tryBench();
ok(b.result==='win' && b.kind==='bench', '基本勝利: しるしの道でベンチへ（bench）');
ok(b.here===0, '基本勝利: ここにいる は踏んでいない（hereCount 0）');

/* 7) 温かい結末：ここにいる を2回踏ませてベンチへ（gentle）*/
function tryGentle(){
  newBattle();
  placeWord('koko',2,2); placeWord('koko',2,3);   // 道に ここにいる を2つ
  // ↑2行動でenemyPhase: 影(2,1)->(2,2)koko[here1,skip]
  endTurn();   // 影 skip（うずくまる）… いや placeWord×2 で既にenemyPhase済み。ここは次ターン。
  placeWord('koko',2,4); endTurn();   // 影 skip解除待ち
  endTurn();   // 影(2,2)->(2,3)koko[here2,skip]
  endTurn();   // 影 skip
  endTurn();   // 影(2,3)->ベンチ(2,4)koko -> win
  return { result:state.result, kind:state.endKind, here:state.shadow.hereCount };
}
var g=tryGentle();
ok(g.result==='win' && g.kind==='gentle', '温かい結末: ここにいる2回でベンチへ（gentle）here='+g.here);
ok(g.here>=2, '温かい結末: hereCount>=2');

/* 8) 特殊終了：水たまりに おぼえてる → 記憶 → ベンチ（memory）*/
function tryMemory(){
  newBattle();
  placeWord('oboeteru',4,3);   // 水たまり(4,3)に記憶を置く → memorySeen
  placeMark(2,2);              // 2行動目 → enemyPhase: 影->(2,2)
  placeMark(2,3); endTurn();   // 影->(2,3)
  placeMark(2,4); endTurn();   // 影->ベンチ
  return { result:state.result, kind:state.endKind, mem:state.memorySeen };
}
var m=tryMemory();
ok(m.mem===true, '特殊: 水たまりに おぼえてる で memorySeen');
ok(m.result==='win' && m.kind==='memory', '特殊終了: 記憶を見てからベンチ（memory）');

/* 9) きく は影の次の動きを返す */
newBattle();
placeMark(2,2);  // しるしを置いて誘導先を作る
ok(listen()===true, 'きく: 実行できる');
ok(state.log.some(function(bl){ return bl.tone==='hint'; }), 'きく: ヒントが出る');

/* 9b) こころが尽きると失敗（涙のマスを踏み続ける）*/
newBattle();
state.player.kokoro=1;                 // あと1
state.danger['3,4']=true;              // L(3,3) の隣に涙マスを置く
ok(moveL(3,4)===false, 'こころ: 涙マスでこころ0なら moveL は false を返す');
ok(state.result==='lose' && state.endKind==='kokoro', 'こころ: 涙マスを踏んでこころ0 → kokoro 敗北');

/* 10) 決着後は受け付けない */
newBattle(); endTurn(); endTurn(); endTurn();  // escape
ok(moveL(3,4)===false && placeMark(2,2)===false, '決着後: 操作は無効');

/* 11) リスタート */
restart();
ok(state.shadow.x===2 && state.shadow.y===1 && state.result===null && state.memorySeen===false,
   'リスタート: 初期状態へ');

var header='=== Battle 11 ことばを置く盤面バトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
