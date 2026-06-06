/*
 * headless-check.js — Battle 10「こころの部位バトル」コア回帰確認（JXA）
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
ok(state.parts.length===4, '初期: 部位は4つ');
ok(zawameki()===12 && maxZawameki()===12, '初期: ざわめき 12/12（全部閉じている）');
ok(stateName(partState('eye'))==='閉じている', '初期: 片目は 閉じている');
ok(state.result===null, '初期: 勝敗なし');

/* 2) 効くコマンドで1段ほどける（状態が進む）*/
newBattle();
selectPart('eye'); act('mitsumeru');
ok(stateName(partState('eye'))==='震えている', 'みつめる: 片目 閉→震');
selectPart('eye'); act('mitsumeru');
ok(stateName(partState('eye'))==='ほどけかけ', 'みつめる: 片目 震→ほどけかけ');
selectPart('eye'); act('mitsumeru');
ok(partState('eye').resolved && stateName(partState('eye'))==='ほどけた', 'みつめる×3で 片目 ほどけた');

/* 3) 効かないコマンドは進まない */
newBattle();
selectPart('eye'); act('tewonobasu');     // 腕用は片目に効かない
ok(stateName(partState('eye'))==='閉じている', '効かないコマンドでは部位は進まない');

/* 4) きく は本音を見せ、胸には ほどく力がある */
newBattle();
selectPart('arm'); act('kiku');
ok(stateName(partState('arm'))==='閉じている', 'きく(腕): 本音のみ・進まない');
ok(state.log[state.log.length-2].tone==='hint' || state.log.some(function(b){return b.tone==='hint';}), 'きく: 本音(hint)が出る');
selectPart('chest'); act('kiku');
ok(stateName(partState('chest'))==='震えている', 'きく(胸): 胸は きく で進む');

/* 5) 片目が見ている間に ふれる で他部位を傷つける */
newBattle();
ok(eyeActive()===true, '片目: 最初は見ている');
selectPart('arm'); act('fureru');
ok(partState('arm').hurt===true && partState('arm').resolved===true, 'ふれる(片目あり): 腕が 傷ついた');

/* 6) 片目をほどいた後は ふれる が安全に効く */
newBattle();
selectPart('eye'); act('mitsumeru'); selectPart('eye'); act('mitsumeru'); selectPart('eye'); act('mitsumeru');
ok(partState('eye').resolved, '前提: 片目をほどいた');
selectPart('arm'); act('fureru');
ok(partState('arm').hurt===false && stateName(partState('arm'))==='震えている', 'ふれる(片目なし): 腕が安全に進む');

/* 7) 封じる は即「傷ついた」 */
newBattle();
selectPart('tag'); act('fuujiru');
ok(partState('tag').resolved && partState('tag').hurt, '封じる: 名前タグが 傷ついた（resolved）');

/* 8) 優しい結末：全部 ほどく（傷つけない）*/
function solveGentle(){
  newBattle();
  function hit(id,cmd){ selectPart(id); act(cmd); }
  // 腕・胸を先に（chipを止める）→ 片目 → 名前タグ
  hit('arm','tewonobasu'); hit('arm','tewonobasu'); hit('arm','tewonobasu');
  hit('chest','kiku'); hit('chest','kiku'); hit('chest','kiku');
  hit('eye','mitsumeru'); hit('eye','mitsumeru'); hit('eye','mitsumeru');
  hit('tag','namaewoyobu'); hit('tag','omoidasu'); hit('tag','namaewoyobu');
  return { result:state.result, kind:state.endKind, remembered:state.tagRemembered, kokoro:state.player.kokoro };
}
var g=solveGentle();
ok(g.result==='win' && g.kind==='gentle', '優しい結末: 全部ほどくと gentle 勝利 (こころ残'+g.kokoro+')');
ok(g.remembered===true, '優しい結末: 名前タグをほどくと名前を思い出す');

/* 9) 強引な結末：1つでも封じると forced */
function solveForced(){
  newBattle();
  function hit(id,cmd){ selectPart(id); act(cmd); }
  hit('eye','mitsumeru'); hit('eye','mitsumeru'); hit('eye','mitsumeru');
  hit('arm','tewonobasu'); hit('arm','tewonobasu'); hit('arm','tewonobasu');
  hit('chest','arigatou'); hit('chest','arigatou'); hit('chest','arigatou');
  selectPart('tag'); act('fuujiru');   // 最後を封じる
  return { result:state.result, kind:state.endKind };
}
var f=solveForced();
ok(f.result==='win' && f.kind==='forced', '強引な結末: 封じを含むと forced 勝利');

/* 10) 敗北：効かない手ばかりで腕と胸に削られる */
function tryLose(){
  newBattle(); var gg=0;
  while(state.result===null && gg<40){ selectPart('eye'); act('kiku'); gg++; }  // 片目にきく＝進まない
  return { result:state.result, kind:state.endKind };
}
var l=tryLose();
ok(l.result==='lose' && l.kind==='kokoro', '敗北: ほどけないまま 腕と胸に こころを削られる');

/* 11) 決着後は受け付けない */
ok(act('kiku')===null, '決着後: act は無効');

/* 12) リスタート */
restart();
ok(zawameki()===12 && state.result===null && state.tagRemembered===false, 'リスタート: 初期状態へ');

var header='=== Battle 10 こころの部位バトル headless-check ===';
var footer=(failed===0)?('PASS — '+passed+'件すべてOK'):('FAIL — '+failed+'件失敗 / '+passed+'件成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
