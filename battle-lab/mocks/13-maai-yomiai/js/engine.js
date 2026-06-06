/*
 * engine.js — Battle 13「間合いと言葉の読み合いバトル」進行ルール（DOM非依存）
 *
 * 毎ターン、プレイヤーと証人が“同時”に行動する。証人AIは乱数なし＝癖を読める。
 *   resolveTurn(playerActId) … 証人の手を決め、相性で解決する
 */

var state = null;
function logBlock(tone,lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone,lines:lines}); }

function newBattle(){
  state={
    turn:0,
    distance:DIST_START,
    distStreak:0,        // ふつう(3)を連続維持した数
    readWins:0,          // 読み勝ち回数
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro },
    enemy:{ name:ENEMY_INIT.name, zawameki:ENEMY_INIT.zawameki, maxZawameki:ENEMY_INIT.maxZawameki,
            keikai:ENEMY_INIT.keikai, maxKeikai:ENEMY_INIT.maxKeikai,
            silenceStreak:0, tick:0, lastPlayer:null, broken:false, lastAct:null },
    tells:{},            // 観察で分かった癖
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['距離：'+DIST_LABEL[state.distance]+'　証人は、まだ 何も言わない。']);
  return state;
}

/* ───────── 証人AI（決定的）───────── */
function chooseEnemyAction(){
  var e=state.enemy, d=state.distance;
  if(e.broken) return 'omoidasu';                 // ブレイク中は 思い出しやすい
  if(e.lastPlayer==='kiku') return 'tamesu';      // きかれた次は 試す
  if(e.silenceStreak>=2) return 'sakebu';         // 2回黙った後は 叫ぶ
  if(d>=4) return 'kyozetsu';                      // 近い距離では 拒絶
  if(d<=2) return 'nigeru';                        // 遠い距離では 逃げる
  // ふつう：黙る を2回まで続けられる（2回黙ると次に叫ぶ＝上の silenceStreak 判定へ）。
  // 黙りが続いていない時だけ 黙る/近づく を交互にして、単調さも避ける。
  if(e.lastAct==='damaru' && e.silenceStreak<2) return 'damaru';
  return (e.tick % 2===0) ? 'damaru' : 'chikaduku';
}

/* ───────── 1ターン解決 ───────── */
function resolveTurn(playerAct){
  if(state.result) return null;
  if(!playerActDef(playerAct)) return null;

  // ブレイク中の決め手（同時選択の前に確定）
  if(state.enemy.broken && (playerAct==='unazuku' || playerAct==='namaewoyobu')){
    state.result='special'; state.endKind='stepdown';
    logBlock('success',['（ブレイク）証人の警戒が、ほどけている。']);
    logBlock('result', WIN_TEXT.stepdown.slice());
    state.turn++;
    return { special:true };
  }

  var enemyAct = chooseEnemyAction();
  state.enemy.lastAct = enemyAct;

  // 距離の変化（両者の動きを反映）
  if(playerAct==='chikaduku') state.distance++;
  if(playerAct==='hanareru')  state.distance--;
  if(enemyAct==='chikaduku')  state.distance++;
  if(enemyAct==='nigeru')     state.distance--;
  state.distance = Math.max(1, Math.min(5, state.distance));

  // 相性の判定
  var outcome = judge(playerAct, enemyAct);
  applyOutcome(outcome, playerAct, enemyAct);

  // 証人の状態更新
  state.enemy.silenceStreak = (enemyAct==='damaru') ? state.enemy.silenceStreak+1 : 0;
  state.enemy.lastPlayer = playerAct;
  state.enemy.tick++;
  if(state.enemy.keikai<=0) state.enemy.broken = true;

  // 適切な距離の維持
  state.distStreak = (state.distance===DIST_OK) ? state.distStreak+1 : 0;

  state.turn++;
  checkEnd();
  if(!state.result) logBlock('system',['距離：'+DIST_LABEL[state.distance]+(state.enemy.broken?'　／証人はブレイク中':'')]);
  return { enemyAct:enemyAct, outcome:outcome.kind };
}

function playerActDef(id){ for(var i=0;i<PLAYER_ACTS.length;i++) if(PLAYER_ACTS[i].id===id) return PLAYER_ACTS[i]; return null; }

// 相性：読み勝ち / 失敗 / それ以外
function judge(p, e){
  if(GOOD_COUNTER[e]===p) return { kind:'read' };
  // 踏み込みすぎ／叫びへの言葉＝失敗（こころダメージ）
  if((e==='kyozetsu' && p==='chikaduku') ||
     (e==='sakebu' && (p==='hanasu'||p==='chikaduku'||p==='tewonobasu')))
    return { kind:'bad' };
  // はなす が 黙り/思い出し/試す に届く（読み勝ちではないが ざわめき）
  if(p==='hanasu' && (e==='damaru'||e==='omoidasu'||e==='tamesu'))
    return { kind:'talk' };
  return { kind:'neutral' };
}

function applyOutcome(o, p, e){
  if(o.kind==='read'){
    state.readWins++;
    state.enemy.keikai = Math.max(0, state.enemy.keikai-1);
    var dz = 1;
    if(e==='chikaduku') dz=3;        // てをのばす×近づく＝大成功
    else if(e==='nigeru') dz=2;      // なまえをよぶ×逃げる
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki-dz);
    logBlock('success', [readFlavor(p,e), '読み勝ち！（ざわめき −'+dz+'・警戒 −1）']);
    // 癖の開示
    learnTell(e);
  } else if(o.kind==='bad'){
    state.player.kokoro = Math.max(0, state.player.kokoro-1);
    state.enemy.keikai = Math.min(state.enemy.maxKeikai, state.enemy.keikai+1);
    logBlock('fail', [badFlavor(p,e), '失敗。こころ −1・警戒 +1']);
  } else if(o.kind==='talk'){
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki-2);
    logBlock('player', ['L「……はなす」', 'ことばが 少し届いた。（ざわめき −2）']);
  } else { // neutral
    if(p==='kiku'){
      // きく は読み勝ちでなくても、相手を観察して 警戒を少し ほどく
      state.enemy.keikai = Math.max(0, state.enemy.keikai-1);
      logBlock('hint', ['Lは きいた。証人の様子を、少し 読めた。（警戒 −1）']);
    } else {
      logBlock('player', ['Lは '+playerActDef(p).name+'。', '証人は '+ENEMY_LABEL[e]+'。空ぶり。']);
    }
  }
}

function readFlavor(p,e){
  if(e==='kyozetsu') return 'Lが離れると、証人の拒絶は 空を切った。';
  if(e==='nigeru')   return 'Lが名前をよぶと、証人の足が 止まった。';
  if(e==='sakebu')   return 'Lがだまると、叫びは 空回りした。';
  if(e==='damaru')   return 'Lがきくと、黙った理由が 見えた。';
  if(e==='tamesu')   return 'Lがうなずくと、証人の試しに 応えられた。';
  if(e==='chikaduku')return 'Lが手をのばすと、近づいた証人に 届いた。';
  if(e==='omoidasu') return 'Lが名前をよぶと、証人は 何かを 思い出した。';
  return 'Lの読みが、当たった。';
}
function badFlavor(p,e){
  if(e==='kyozetsu') return '踏み込んだLを、証人は つよく 拒んだ。';
  if(e==='sakebu')   return '叫ぶ証人に踏み込んで、声に のまれた。';
  return '言葉が、届かなかった。';
}
function learnTell(e){
  if(e==='kyozetsu') state.tells['kyozetsu']=TELLS[0];
  if(e==='nigeru')   state.tells['nigeru']=TELLS[1];
  if(e==='sakebu')   state.tells['sakebu']=TELLS[2];
  if(e==='damaru')   state.tells['damaru']=TELLS[3];
}

function checkEnd(){
  if(state.result) return;
  if(state.enemy.zawameki<=0){ state.result='win'; state.endKind='zawameki'; logBlock('result',WIN_TEXT.zawameki.slice()); return; }
  if(state.readWins>=READ_WIN){ state.result='win'; state.endKind='read'; logBlock('result',WIN_TEXT.read.slice()); return; }
  if(state.distStreak>=DIST_STREAK_WIN){ state.result='win'; state.endKind='maai'; logBlock('result',WIN_TEXT.maai.slice()); return; }
  if(state.player.kokoro<=0){ state.result='lose'; state.endKind='kokoro'; logBlock('result',LOSE_TEXT.kokoro.slice()); return; }
  if(state.turn>=TURN_LIMIT){ state.result='lose'; state.endKind='timeout'; logBlock('result',LOSE_TEXT.timeout.slice()); return; }
}

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, resolveTurn:resolveTurn, chooseEnemyAction:chooseEnemyAction,
    judge:judge, playerActDef:playerActDef, restart:restart, get state(){return state;} };
}
