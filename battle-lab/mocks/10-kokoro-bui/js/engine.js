/*
 * engine.js — Battle 10「こころの部位バトル」進行ルール（DOM非依存）
 *
 * 部位は idx(0..2)＝閉/震/ほどけかけ と進み、3で「ほどけた」。
 * 「封じる」は即「傷ついた」。すべての部位が片付いたら終了。
 * 片目が動いている間に「ふれる」を他部位に使うと手元が狂い、傷つける（部位の相互作用）。
 *
 * 操作：selectPart(id) → act(cmdId)
 */

var state = null;
function logBlock(tone,lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone,lines:lines}); }

function newBattle(){
  state={
    turn:0,
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro },
    enemy:{ name:ENEMY_INIT.name },
    parts: PARTS.map(function(p){ return { id:p.id, name:p.name, idx:0, resolved:false, hurt:false }; }),
    selected:null,
    tagRemembered:false,
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['部位を1つ選び、ことばで ほどいていく。']);
  return state;
}

function partDef(id){ for(var i=0;i<PARTS.length;i++) if(PARTS[i].id===id) return PARTS[i]; return null; }
function partState(id){ for(var i=0;i<state.parts.length;i++) if(state.parts[i].id===id) return state.parts[i]; return null; }

// 部位の状態名
function stateName(p){
  if(p.hurt) return STATE_HURT;
  if(p.resolved) return STATE_UNDONE;
  return STATE_NAMES[p.idx];
}
// ざわめき（全部位の残り段数の合計＝0で全部ほどけた）
function zawameki(){ var s=0; for(var i=0;i<state.parts.length;i++){ var p=state.parts[i]; s+=(p.resolved?0:(3-p.idx)); } return s; }
function maxZawameki(){ return state.parts.length*3; }
function eyeActive(){ var e=partState('eye'); return e && !e.resolved; }

function selectPart(id){
  if(state.result) return false;
  if(!partState(id)) return false;
  state.selected=id;
  return true;
}

// 部位を1段ほどく
function advance(p){
  p.idx++;
  if(p.idx>=3){ p.resolved=true; }
  var def=partDef(p.id);
  if(p.resolved){
    logBlock('success',['['+p.name+'] が ほどけた。']);
    if(p.id==='tag' && !p.hurt){ state.tagRemembered=true; logBlock('hint',['にじんだ名前が、すこし読めた気がした。']); }
  } else {
    logBlock('player',['['+p.name+'] が '+stateName(p)+'。']);
  }
}

/* ───────── コマンド実行 ───────── */
function act(cmdId){
  if(state.result) return null;
  if(!state.selected){ logBlock('system',['部位を選んでください。']); return { ok:false, reason:'noselect' }; }
  var p = partState(state.selected);
  var def = partDef(p.id);

  if(p.resolved){ logBlock('system',['['+p.name+'] は もう '+stateName(p)+'。']); return { ok:false, reason:'resolved' }; }

  if(cmdId==='fuujiru'){
    p.resolved=true; p.hurt=true;
    logBlock('fail',['Lは、['+p.name+'] を 強引に封じた。','部位は '+STATE_HURT+'。']);
    partsAct(); checkEnd(); state.turn++;
    return { ok:true, hurt:true };
  }

  if(cmdId==='kiku'){
    logBlock('hint',['（本音）'+def.honne]);
    if(def.unlockBy.indexOf('kiku')>=0) advance(p);   // 胸は「きく」で進む
    partsAct(); checkEnd(); state.turn++;
    return { ok:true };
  }

  // ふれる：片目が見ている間は、他部位に触れると手元が狂って傷つける
  if(cmdId==='fureru' && eyeActive() && p.id!=='eye'){
    p.resolved=true; p.hurt=true;
    logBlock('fail',['片目に見られたまま手をのばし、手元が狂った。','['+p.name+'] を '+STATE_HURT+' にしてしまった。']);
    partsAct(); checkEnd(); state.turn++;
    return { ok:true, hurt:true };
  }

  // 効くコマンドなら1段ほどく
  if(def.unlockBy.indexOf(cmdId)>=0){
    if(cmdId==='arigatou') state.player.kokoro=Math.min(state.player.maxKokoro,state.player.kokoro+1);
    advance(p);
  } else {
    logBlock('system',['Lは、まだ そのやり方が ['+p.name+'] に届かない。']);
  }
  partsAct(); checkEnd(); state.turn++;
  return { ok:true };
}

// まだほどけていない部位が動く（こころを削る／ざわつく）
function partsAct(){
  if(state.result) return;
  for(var i=0;i<state.parts.length;i++){
    var p=state.parts[i]; if(p.resolved) continue;
    var def=partDef(p.id);
    if(def.chip){ state.player.kokoro=Math.max(0,state.player.kokoro-def.chip); logBlock('enemy',[def.act]); }
  }
}

function checkEnd(){
  if(state.result) return;
  if(state.player.kokoro<=0){ state.result='lose'; state.endKind='kokoro'; logBlock('result',LOSE_TEXT.kokoro.slice()); return; }
  var allResolved=true, anyHurt=false;
  for(var i=0;i<state.parts.length;i++){ if(!state.parts[i].resolved) allResolved=false; if(state.parts[i].hurt) anyHurt=true; }
  if(allResolved){
    state.result='win';
    state.endKind = anyHurt ? 'forced' : 'gentle';
    logBlock('result', WIN_TEXT[state.endKind].slice());
  }
}

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, selectPart:selectPart, act:act, stateName:stateName,
    zawameki:zawameki, maxZawameki:maxZawameki, eyeActive:eyeActive, partState:partState, partDef:partDef,
    restart:restart, get state(){return state;} };
}
