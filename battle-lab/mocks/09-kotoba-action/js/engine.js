/*
 * engine.js — Battle 09「ことばアクションコマンドバトル」進行ルール（DOM非依存）
 *
 * 入力（タイミング）は ui.js がゲージから pos(0..100) を作って渡す。
 * engine は pos を判定し、効果を反映するだけ。これでブラウザなしでも
 * tools/headless-check.js から「届き方」を点検できる。
 *
 * 主な関数：
 *   resolveCommand(id, pos) … タイミング系コマンドを解決（pos=0..100, 中央50が最良）
 *   chooseSilence(waited)   … 「だまる」を解決（waited=true なら待ちきった）
 */

var state = null;

function logBlock(tone, lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone, lines:lines}); }

function newBattle(){
  state = {
    turn:0,
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro },
    enemy:{ name:ENEMY_INIT.name, zawameki:ENEMY_INIT.zawameki, maxZawameki:ENEMY_INIT.maxZawameki,
            keikai:ENEMY_INIT.keikai, maxKeikai:ENEMY_INIT.maxKeikai, planIndex:0 },
    streak:0,            // 連続で“正しく届けた”回数
    lastJudge:null,      // 直近の判定
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['先生「では、はじめましょう」']);
  return state;
}

function cmdById(id){ for(var i=0;i<COMMANDS.length;i++) if(COMMANDS[i].id===id) return COMMANDS[i]; return null; }

/* タイミング判定：中央(50)に近いほど良い。早い(左)＝急かす、遅い(右)＝届かない。*/
function judgePos(pos, tight){
  var d = pos - 50;
  var ad = Math.abs(d);
  var deepW = tight?5:8, goodW = tight?12:18, slightW = tight?22:32;
  if(ad<=deepW) return 'deep';
  if(ad<=goodW) return 'good';
  if(ad<=slightW) return 'slight';
  return d<0 ? 'rush' : 'miss';
}

// 警戒が高いほど、ざわめきを下げる効果が鈍る（抵抗）
function resist(){ return Math.max(0.3, 1 - state.enemy.keikai*0.15); }

/* ───────── タイミング系コマンドの解決 ───────── */
function resolveCommand(id, pos){
  if(state.result) return null;
  var cmd = cmdById(id);
  if(!cmd) return null;
  if(cmd.type==='silence') return chooseSilence(pos===true);

  if(cmd.type==='backfire'){
    // めっちゃありがとう：この先生には軽すぎて逆効果
    var zBefore=state.enemy.zawameki;
    state.enemy.zawameki = Math.min(state.enemy.maxZawameki, state.enemy.zawameki+1);
    state.enemy.keikai   = Math.min(state.enemy.maxKeikai, state.enemy.keikai+1);
    state.streak = 0; state.lastJudge = 'backfire';
    var tail = (state.enemy.zawameki>zBefore) ? 'ざわめきが、少し戻った。' : '警戒だけが、また 強くなった。';
    logBlock('fail',['L「めっちゃ ありがとう！」','先生「……その言葉は、まだ 軽いです」', tail]);
  } else {
    var judge = judgePos(pos, cmd.tight);
    state.lastJudge = judge;
    applyTimingEffect(cmd, judge);
  }

  if(!state.result) checkEnd();        // プレイヤーの一手で勝てたか
  if(!state.result){ enemyTurn(); checkEnd(); }
  state.turn++;
  return { judge: state.lastJudge };
}

function applyTimingEffect(cmd, judge){
  var f = JUDGE_FACTOR[judge];
  var good = (judge==='deep' || judge==='good');
  // 「正しく3連続で届ける」は“届ける言葉”だけで数える。きくは観察なので連続に影響しない。
  var isDelivery = (cmd.id==='hanasu'||cmd.id==='fureru'||cmd.id==='arigatou'||cmd.id==='honto');
  if(isDelivery) state.streak = good ? state.streak+1 : 0;
  var jl = JUDGE_LABEL[judge];

  if(cmd.id==='kiku'){
    if(good){
      state.enemy.keikai = Math.max(0, state.enemy.keikai-1);
      logBlock('player',['L「……いまの、ほんとう?」','先生の本音が、少し見えた。（警戒 −1）','['+jl+']']);
    } else {
      logBlock('player',['L「……」','うまく聞けなかった。['+jl+']']);
    }
  } else if(cmd.id==='hanasu'){
    var dz = Math.round(cmd.base*f*resist());
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki-dz);
    logBlock(dz>0?'player':'fail',['L「……はなす」', dz>0 ? ('ざわめき −'+dz+'　['+jl+']') : ('言葉は 届かなかった　['+jl+']')]);
  } else if(cmd.id==='fureru'){
    if(good){
      var dz2 = Math.round(cmd.base*f*resist());
      state.enemy.zawameki = Math.max(0, state.enemy.zawameki-dz2);
      logBlock('player',['Lは、そっと ふれた。','ざわめき −'+dz2+'　['+jl+']']);
    } else {
      state.enemy.keikai = Math.min(state.enemy.maxKeikai, state.enemy.keikai+1);
      logBlock('fail',['手が、早すぎた／遅すぎた。','先生の警戒が上がる。['+jl+']']);
    }
  } else if(cmd.id==='arigatou'){
    var dz3 = Math.round(cmd.base*f*resist());
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki-dz3);
    if(good) state.player.kokoro = Math.min(state.player.maxKokoro, state.player.kokoro+1);
    logBlock(dz3>0?'player':'fail',['L「ありがとう」', dz3>0 ? ('ざわめき −'+dz3+(good?'・こころ +1':'')+'　['+jl+']') : ('軽く 流されてしまった　['+jl+']')]);
  } else if(cmd.id==='honto'){
    var dz4 = Math.round(cmd.base*f*resist());
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki-dz4);
    logBlock(dz4>0?'player':'fail',['L「本当に ありがとう」', dz4>0 ? ('ざわめき −'+dz4+'　['+jl+']') : ('言葉が 上滑りした　['+jl+']')]);
  }

  // 急かすと、先生の警戒が上がる
  if(judge==='rush') state.enemy.keikai = Math.min(state.enemy.maxKeikai, state.enemy.keikai+1);
}

/* ───────── だまる（待つのが正解）───────── */
function chooseSilence(waited){
  if(state.result) return null;
  if(waited){
    // すでに静けさが満ちている（警戒0）ところで さらに だまる → 授業が止まる＝特殊終了
    if(state.enemy.keikai===0){
      state.result='special'; state.endKind='silence';
      logBlock('player',['Lは、ただ だまっていた。']);
      logBlock('result', WIN_TEXT.silence.slice());
      state.turn++;
      return { special:true };
    }
    state.enemy.keikai = Math.max(0, state.enemy.keikai-2);
    state.lastJudge='silence';
    logBlock('player',['Lは、何も言わなかった。','先生の警戒が、下がる。（−2）']);
  } else {
    // 待てずに口をひらいた＝急かしたのと同じ
    state.enemy.keikai = Math.min(state.enemy.maxKeikai, state.enemy.keikai+1);
    state.streak=0; state.lastJudge='rush';
    logBlock('fail',['Lは、つい口をひらいた。','先生「……まだ、ですよ」（警戒 +1）']);
  }
  if(!state.result){ enemyTurn(); checkEnd(); }
  state.turn++;
  return { waited:waited };
}

/* ───────── 先生の手番（循環・乱数なし）───────── */
function enemyTurn(){
  if(state.result) return;
  var act = ENEMY_PLAN[state.enemy.planIndex];
  var lines = act.log.slice();
  if(act.keikai) state.enemy.keikai = Math.min(state.enemy.maxKeikai, state.enemy.keikai+act.keikai);
  if(act.kokoro) state.player.kokoro = Math.max(0, state.player.kokoro-act.kokoro);
  if(act.kokoroIfPoor){
    var poor = (state.lastJudge==='miss'||state.lastJudge==='rush'||state.lastJudge==='slight'||state.lastJudge==='backfire');
    if(poor){ state.player.kokoro = Math.max(0, state.player.kokoro-act.kokoroIfPoor); lines.push('届かない言葉に、こころが −'+act.kokoroIfPoor); }
  }
  logBlock('enemy', lines);
  state.enemy.planIndex = (state.enemy.planIndex+1) % ENEMY_PLAN.length;
}

/* ───────── 終了判定 ───────── */
function checkEnd(){
  if(state.result) return;
  if(state.enemy.zawameki<=0){ state.result='win'; state.endKind='zawameki'; logBlock('result',WIN_TEXT.zawameki.slice()); return; }
  if(state.streak>=STREAK_WIN){ state.result='win'; state.endKind='todoke'; logBlock('result',WIN_TEXT.todoke.slice()); return; }
  if(state.player.kokoro<=0){ state.result='lose'; state.endKind='kokoro'; logBlock('result',LOSE_TEXT.kokoro.slice()); return; }
}

function keikaiBar(){ var s=''; for(var i=0;i<state.enemy.maxKeikai;i++) s+=(i<state.enemy.keikai?'▲':'△'); return s; }

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, resolveCommand:resolveCommand, chooseSilence:chooseSilence,
    judgePos:judgePos, keikaiBar:keikaiBar, cmdById:cmdById, restart:restart, get state(){return state;} };
}
