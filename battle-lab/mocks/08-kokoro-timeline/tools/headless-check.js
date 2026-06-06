/*
 * headless-check.js — Battle 08「こころの時間差バトル」コア回帰確認（JXA・Node不要）
 *
 * 使い方（このモックのフォルダで）：
 *   MOCKDIR="$PWD" osascript -l JavaScript tools/headless-check.js
 */
ObjC.import('Foundation');
function readFile(p){ return $.NSString.stringWithContentsOfFileEncodingError(p,4,null).js; }
var env = $.NSProcessInfo.processInfo.environment.js;
var base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
if (base.charAt(base.length-1) !== '/') base += '/';
var jsdir = base + 'js/';
eval(readFile(jsdir+'data.js') + '\n' + readFile(jsdir+'engine.js'));

var passed=0, failed=0, lines=[];
function ok(c,l){ if(c){passed++; lines.push('  ✅ '+l);} else {failed++; lines.push('  ❌ '+l);} }

/* 1) 初期化 */
newBattle();
ok(state.player.kokoro===12 && state.player.maxKokoro===12, '初期: こころ 12/12');
ok(state.enemy.zawameki===10 && state.enemy.bakuhatsu===0, '初期: ざわめき10・爆発0');
ok(state.now===0 && state.turn===0, '初期: 時刻0・ターン0');
ok(state.enemy.nextId==='nikoniko', '初期: 村長の次は にこにこ');
ok(state.result===null, '初期: 勝敗なし');

/* 2) cast で時間が進み、ことばが自然回復する */
newBattle();
var k0=state.player.kotoba;
chooseCommand('tewonobasu');        // cost2 cast3
ok(state.now===3, 'てをのばす: 時間が3進む');
ok(state.enemy.zawameki===5, 'てをのばす: ざわめき 10→5');
ok(state.player.kotoba === k0-2+3 || state.player.kotoba===state.player.maxKotoba,
   'てをのばす: ことばは消費2・回復3（上限あり）');

/* 3) きく は早く、爆発ゲージを下げ、ターンとnowを1進める */
newBattle();
// まず爆発を少し溜める：にこにこが発火するまで進める
chooseCommand('damaru'); // cast1 → now1
chooseCommand('damaru'); // cast1 → now2 で にこにこ発火 bakuhatsu1
ok(state.enemy.bakuhatsu>=1, 'にこにこ発火で 爆発ゲージが上がる');
var b=state.enemy.bakuhatsu;
chooseCommand('kiku');   // bakuhatsu -1
ok(state.enemy.bakuhatsu === Math.max(0,b-1), 'きく: 爆発ゲージ -1');

/* 4) だまる で おちつき が増え、近すぎる親切を肩代わりする */
newBattle();
chooseCommand('damaru');
ok(state.player.ochitsuki===2, 'だまる: おちつき +2');

/* 5) 勝利（ざわめき）：強い言葉でざわめきを0に */
function tryWin(){
  newBattle();
  var g=0;
  while(!state.result && g<60){
    if(state.enemy.bakuhatsu >= state.enemy.maxBakuhatsu-2) chooseCommand('koewokakeru');
    else if(state.player.kotoba>=2) chooseCommand('tewonobasu');
    else chooseCommand('kiku');
    g++;
  }
  return { result: state.result, kind: state.endKind };
}
var w=tryWin();
ok(w.result==='win', '勝利: 爆発を抑えつつ ざわめきを0にできる ('+w.kind+')');

/* 6) 耐久勝利：きく中心で耐えると一定ターンで勝てる */
function tryEndure(){
  newBattle();
  var g=0;
  while(!state.result && g<80){ chooseCommand('kiku'); g++; }
  return { result: state.result, kind: state.endKind };
}
var e=tryEndure();
ok(e.result==='win' && (e.kind==='endure'||e.kind==='zawameki'),
   '耐久: きく中心で爆発させず勝ちにいける ('+e.kind+')');

/* 7) 敗北（爆発）：だまる連打＝爆発ゲージを放置すると満ちて負ける */
function tryLose(){
  newBattle();
  var g=0;
  while(!state.result && g<80){ chooseCommand('damaru'); g++; }
  return { result: state.result, kind: state.endKind };
}
var l=tryLose();
ok(l.result==='lose' && l.kind==='explode', '敗北: 爆発ゲージ放置で 満ちて負ける ('+l.kind+')');

/* 8) 特殊終了：秘密を言いかけたら なまえをよぶ→きく */
function trySpecial(){
  newBattle();
  var g=0;
  // 村長の次が「秘密」になるまで、きく で時間を刻む
  while(state.enemy.nextId!=='secret' && !state.result && g<60){ chooseCommand('kiku'); g++; }
  if(state.enemy.nextId!=='secret') return { result:state.result, reached:false };
  chooseCommand('namewoyobu');   // 秘密を止める
  var delayed = state.secretDelayed;
  chooseCommand('kiku');         // 特殊終了
  return { result:state.result, kind:state.endKind, delayed:delayed, reached:true };
}
var s=trySpecial();
ok(s.reached, '特殊: 村長の次が「秘密」になる状況へ到達できる');
ok(s.delayed===true, '特殊: なまえをよぶ で 秘密を止められる');
ok(s.result==='special' && s.kind==='secret', '特殊終了: 「村長は、笑うのをやめた。」へ');

/* 8b) 秘密が発火して予兆が消えた後は、きく で矛盾した特殊終了を出さない */
newBattle();
state.secretDelayed = true;
state.enemy.nextId = 'nikoniko';   // 秘密はもう過ぎた状況（予兆は別の行動）
chooseCommand('kiku');
ok(state.result!=='special' && state.endKind!=='secret', '秘密発火後: きくで矛盾する特殊終了を出さない');

/* 9) 決着後は操作を受け付けない */
newBattle();
while(!state.result) chooseCommand('damaru');
var afterTurn = state.turn;
var r = chooseCommand('kiku');
ok(r.ok===false && state.turn===afterTurn, '決着後: それ以上は進まない');

/* 10) リスタート */
restart();
ok(state.player.kokoro===12 && state.enemy.zawameki===10 && state.now===0 && state.result===null,
   'リスタート: すべて初期状態へ');

var header='=== Battle 08 こころの時間差バトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
