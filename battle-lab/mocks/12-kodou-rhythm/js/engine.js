/*
 * engine.js — Battle 12「鼓動リズムバトル」進行ルール（DOM非依存）
 *
 * 実際の拍合わせ（鼓動アニメ）は ui/main が担当。engine は判定結果 hit を受け取るだけ。
 *   resolveBeat(cmdId, hit)  hit ∈ 'good'（合った）/ 'miss'（外れた）/ 'wait'（無音を待った）
 * これでブラウザなしでも、リズムの“意味”を headless で点検できる。
 */

var state = null;
function logBlock(tone,lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone,lines:lines}); }

function newBattle(){
  state={
    round:0,
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro },
    enemy:{ name:ENEMY_INIT.name, zawameki:ENEMY_INIT.zawameki, maxZawameki:ENEMY_INIT.maxZawameki },
    sync:0, drown:0,
    silenceMastered:false,
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['最初のリズム：'+PATTERN_LABEL[patternFor(0)]]);
  return state;
}

function cmdById(id){ for(var i=0;i<COMMANDS.length;i++) if(COMMANDS[i].id===id) return COMMANDS[i]; return null; }
function currentPattern(){ return patternFor(state.round); }

/* ───────── 1拍ぶんの判定 ───────── */
function resolveBeat(cmdId, hit){
  if(state.result) return null;
  if(!cmdById(cmdId)) return null;
  var pattern = currentPattern();
  applyBeat(pattern, cmdId, hit);
  if(!state.result) checkEnd();
  state.round++;
  if(!state.result) logBlock('system',['つぎのリズム：'+PATTERN_LABEL[currentPattern()]]);
  return { pattern:pattern };
}

function applyBeat(pattern, cmd, hit){
  /* ── 無音 ── */
  if(pattern==='silence'){
    if(cmd==='damaru' && hit==='wait'){
      state.sync = Math.min(MAX_SYNC, state.sync+2);
      state.enemy.zawameki = Math.max(0, state.enemy.zawameki-1);
      state.silenceMastered = true;
      logBlock('success',['無音に、Lは だまっていた。','呼吸が ひとつに 重なる。（同調 +2）']);
      if(state.sync>=SYNC_SPECIAL){ state.result='special'; state.endKind='lighthouse'; logBlock('result',WIN_TEXT.lighthouse.slice()); }
      return;
    }
    var d = (hit==='miss') ? 2 : 1;
    state.drown = Math.min(MAX_DROWN, state.drown+d);
    logBlock('fail',['無音に、音を立ててしまった。（飲まれ +'+d+'）']);
    return;
  }

  /* ── 安定 / 乱れ ── */
  // 非無音で「だまる」を選んでも、沈黙はリズム判定の対象外＝無害な空振り（誤ペナルティ防止）
  if(cmd==='damaru'){ logBlock('system',['いまは 無音ではない。だまっても、何も起きない。']); return; }
  var missPenalty = (pattern==='unstable') ? 2 : 1;
  if(hit==='miss'){
    state.drown = Math.min(MAX_DROWN, state.drown+missPenalty);
    var kl='';
    if(pattern==='unstable'){ state.player.kokoro = Math.max(0, state.player.kokoro-1); kl='・こころ −1'; }
    logBlock('fail',['リズムが 外れた。（飲まれ +'+missPenalty+kl+'）']);
    return;
  }
  // hit === 'good'
  if(cmd==='hanasu'){ state.enemy.zawameki=Math.max(0,state.enemy.zawameki-2); logBlock('player',['拍に合わせて、はなす。','（ざわめき −2）']); }
  else if(cmd==='kiku'){ state.enemy.zawameki=Math.max(0,state.enemy.zawameki-1); logBlock('hint',['鼓動に合わせて きく。','（本音）灯台は、ただ 海を照らしたいだけ。（ざわめき −1）']); }
  else if(cmd==='ikiwoawaseru'){ state.sync=Math.min(MAX_SYNC,state.sync+2); state.drown=Math.min(MAX_DROWN,state.drown+1); logBlock('player',['息を 合わせる。（同調 +2／飲まれ +1）']); }
  else if(cmd==='ikiwozurasu'){ state.drown=Math.max(0,state.drown-2); logBlock('player',['息を ずらす。（飲まれ −2）']); }
  else if(cmd==='damaru'){ logBlock('system',['いまは 無音ではない。だまっても、何も起きない。']); }
}

function checkEnd(){
  if(state.result) return;
  if(state.drown>=MAX_DROWN){ state.result='lose'; state.endKind='drown'; logBlock('result',LOSE_TEXT.drown.slice()); return; }
  if(state.player.kokoro<=0){ state.result='lose'; state.endKind='kokoro'; logBlock('result',LOSE_TEXT.kokoro.slice()); return; }
  if(state.enemy.zawameki<=0){ state.result='win'; state.endKind='zawameki'; logBlock('result',WIN_TEXT.zawameki.slice()); return; }
}

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, resolveBeat:resolveBeat, currentPattern:currentPattern,
    patternFor:patternFor, cmdById:cmdById, restart:restart, get state(){return state;} };
}
