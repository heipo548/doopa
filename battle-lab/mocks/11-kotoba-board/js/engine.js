/*
 * engine.js — Battle 11「ことばを置く盤面バトル」進行ルール（DOM非依存）
 *
 * 5×5の盤面。L が言葉／しるしを置き、影をベンチへ導く。
 * 影AIは乱数なし（決まった優先順位）なので、tools/headless-check.js で再現できる。
 *
 * 操作（1ターン2行動）：
 *   moveL(x,y) / placeWord(wordId,x,y) / placeMark(x,y) / listen() / endTurn()
 *   行動が尽きると 影 が動く（enemyPhase）。
 */

var state = null;
function logBlock(tone,lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone,lines:lines}); }
function key(x,y){ return x+','+y; }

function newBattle(){
  state={
    turn:0,
    actionsLeft:ACTIONS_PER_TURN,
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro,
             x:LAYOUT.lStart.x, y:LAYOUT.lStart.y },
    shadow:{ x:LAYOUT.shadow.x, y:LAYOUT.shadow.y,
             zawameki:SHADOW_INIT.zawameki, maxZawameki:SHADOW_INIT.maxZawameki,
             keikai:SHADOW_INIT.keikai, hereCount:0, skipNext:false },
    tiles:{},        // "x,y" -> {type:'word'|'mark', word?}
    danger:{},       // "x,y" -> true（涙のマス）
    memorySeen:false,
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['影は、ベンチから 遠ざかろうとしている。']);
  return state;
}

/* ── 盤面の問い合わせ ── */
function inBounds(x,y){ return x>=0 && y>=0 && x<GRID && y<GRID; }
function isTree(x,y){ for(var i=0;i<LAYOUT.trees.length;i++) if(LAYOUT.trees[i].x===x && LAYOUT.trees[i].y===y) return true; return false; }
function isBench(x,y){ return LAYOUT.bench.x===x && LAYOUT.bench.y===y; }
function isExit(x,y){ return LAYOUT.exit.x===x && LAYOUT.exit.y===y; }
function isPuddle(x,y){ return LAYOUT.puddle.x===x && LAYOUT.puddle.y===y; }
function manhattan(ax,ay,bx,by){ return Math.abs(ax-bx)+Math.abs(ay-by); }

// 言葉／しるしを置けるか（盤内・木でない・出口でない・空き・影の上でない）
function canPlace(x,y){
  if(!inBounds(x,y)) return false;
  if(isTree(x,y) || isExit(x,y)) return false;
  if(state.tiles[key(x,y)]) return false;
  if(state.shadow.x===x && state.shadow.y===y) return false;
  return true;
}
// L から chebyshev 距離1以内（自分のマス含む）に置ける
function nearL(x,y){ return Math.max(Math.abs(x-state.player.x), Math.abs(y-state.player.y))<=1; }

/* ── 行動を1つ消費し、尽きたら影の手番へ ── */
function spend(){ state.actionsLeft--; if(state.actionsLeft<=0 && !state.result) enemyPhase(); }

/* ───────── L の移動 ───────── */
function moveL(x,y){
  if(state.result || state.actionsLeft<=0) return false;
  if(manhattan(state.player.x,state.player.y,x,y)!==1) return false;  // 上下左右1マス
  if(!inBounds(x,y) || isTree(x,y) || isExit(x,y)) return false;
  if(state.shadow.x===x && state.shadow.y===y) return false;
  state.player.x=x; state.player.y=y;
  if(state.danger[key(x,y)]){ delete state.danger[key(x,y)]; state.player.kokoro=Math.max(0,state.player.kokoro-1);
    logBlock('fail',['Lは 涙のマスを 踏んだ。こころ −1']);
    // こころが尽きたら失敗（盤面の説明と一致させる）
    if(state.player.kokoro<=0){ state.result='lose'; state.endKind='kokoro'; logBlock('result',LOSE_TEXT.kokoro.slice()); return false; }
  }
  else logBlock('player',['Lは ('+x+','+y+') へ 動いた。']);
  spend(); return true;
}

/* ───────── 言葉を置く ───────── */
function placeWord(wordId, x, y){
  if(state.result || state.actionsLeft<=0) return false;
  if(!nearL(x,y) || !canPlace(x,y)) return false;
  var w=null; for(var i=0;i<WORDS.length;i++) if(WORDS[i].id===wordId) w=WORDS[i];
  if(!w) return false;
  state.tiles[key(x,y)]={ type:'word', word:wordId };
  if(wordId==='oboeteru' && isPuddle(x,y)){
    state.memorySeen=true;
    logBlock('hint',['水たまりに、誰かの顔が ゆれた。','「おぼえてる」を、世界に 置いた。']);
  } else {
    logBlock('player',['「'+w.name+'」を ('+x+','+y+') に 置いた。']);
  }
  spend(); return true;
}

/* ───────── しるしを置く（影を誘導）───────── */
function placeMark(x,y){
  if(state.result || state.actionsLeft<=0) return false;
  if(!nearL(x,y) || !canPlace(x,y)) return false;
  state.tiles[key(x,y)]={ type:'mark' };
  logBlock('player',['しるしを ('+x+','+y+') に 置いた。影は そちらへ 来る。']);
  spend(); return true;
}

/* ───────── きく（影の次の動きを読む）───────── */
function listen(){
  if(state.result || state.actionsLeft<=0) return false;
  var t=peekShadowMove();
  if(t) logBlock('hint',['（きく）影は つぎ ('+t.x+','+t.y+') へ 動きそう。']);
  else logBlock('hint',['（きく）影は つぎ 動けないみたい。']);
  spend(); return true;
}

/* ───────── まつ（ターン終了）───────── */
function endTurn(){
  if(state.result) return false;
  state.actionsLeft=0;
  logBlock('system',['Lは、まった。']);
  enemyPhase();
  return true;
}

/* ── 影の手番 ── */
function neighbors(x,y){
  // 上,左,右,下（この順が同点時の優先）
  var cand=[ {x:x,y:y-1,d:0}, {x:x-1,y:y,d:1}, {x:x+1,y:y,d:2}, {x:x,y:y+1,d:3} ];
  var out=[];
  for(var i=0;i<cand.length;i++){ var c=cand[i];
    if(!inBounds(c.x,c.y) || isTree(c.x,c.y)) continue;
    if(state.player.x===c.x && state.player.y===c.y) continue; // L の上には来ない
    out.push(c);
  }
  return out;
}
// 影を引き寄せるマス＝しるし＋「ここにいる」（ここにいる は避けずに踏む）
function attractorPositions(){ var a=[]; for(var k in state.tiles){ var t=state.tiles[k];
  if(t.type==='mark' || (t.type==='word' && t.word==='koko')){ var p=k.split(','); a.push({x:+p[0],y:+p[1]}); } } return a; }
function nearestMark(x,y){ var m=attractorPositions(); if(!m.length) return null; var best=m[0], bd=manhattan(x,y,m[0].x,m[0].y);
  for(var i=1;i<m.length;i++){ var d=manhattan(x,y,m[i].x,m[i].y); if(d<bd){ bd=d; best=m[i]; } } return best; }

// 影の次の移動先を選ぶ（引き寄せマスがあれば誘導、なければベンチから逃げて出口へ）
function chooseShadowMove(){
  var s=state.shadow;
  var ns=neighbors(s.x,s.y);
  if(!ns.length) return null;
  var mark=nearestMark(s.x,s.y);
  var bench=LAYOUT.bench, exit=LAYOUT.exit;
  ns.sort(function(a,b){
    if(mark){
      var da=manhattan(a.x,a.y,mark.x,mark.y), db=manhattan(b.x,b.y,mark.x,mark.y);
      if(da!==db) return da-db;               // しるしに近いほうへ
    } else {
      var ba=manhattan(a.x,a.y,bench.x,bench.y), bb=manhattan(b.x,b.y,bench.x,bench.y);
      if(ba!==bb) return bb-ba;               // ベンチから遠いほうへ（逃げる）
      var ea=manhattan(a.x,a.y,exit.x,exit.y), eb=manhattan(b.x,b.y,exit.x,exit.y);
      if(ea!==eb) return ea-eb;               // 出口に近いほうへ
    }
    return a.d-b.d;                            // 同点は 上左右下 の順
  });
  return ns[0];
}
function peekShadowMove(){ if(state.shadow.skipNext) return null; return chooseShadowMove(); }

function enemyPhase(){
  resolveShadow();
  if(state.result) return;
  state.turn++;
  state.actionsLeft=ACTIONS_PER_TURN;
  if(state.turn>=TURN_LIMIT){ state.result='lose'; state.endKind='timeout'; logBlock('result',LOSE_TEXT.timeout.slice()); }
}

function leaveDanger(x,y){
  if(isBench(x,y)||isExit(x,y)) return;
  if(state.tiles[key(x,y)]) return;
  state.danger[key(x,y)]=true;
}

function resolveShadow(){
  var s=state.shadow;
  if(s.skipNext){ s.skipNext=false; logBlock('enemy',['影は、その場で うずくまった。']); return; }
  var prev={x:s.x,y:s.y};
  var t=chooseShadowMove();
  if(!t){ logBlock('enemy',['影は、動けなかった。']); return; }
  s.x=t.x; s.y=t.y;

  // 目的地のタイルを処理
  var k=key(t.x,t.y); var tile=state.tiles[k];
  if(tile){
    if(tile.type==='mark'){ delete state.tiles[k]; logBlock('enemy',['影は、しるしのほうへ 来た。']); }
    else if(tile.word==='koko'){ s.hereCount++; s.skipNext=true; delete state.tiles[k];
      logBlock('enemy',['影は「ここにいる」を 踏んで、立ち止まった。（'+s.hereCount+'回目）']); }
    else if(tile.word==='matte'){ s.skipNext=true; delete state.tiles[k]; logBlock('enemy',['影は「まって」で 立ち止まった。']); }
    else if(tile.word==='daijoubu'){ s.zawameki=Math.max(0,s.zawameki-1); s.keikai=Math.max(0,s.keikai-1); delete state.tiles[k];
      logBlock('enemy',['影は「だいじょうぶ」を 踏んだ。ざわめきが 和らぐ。']); }
    else if(tile.word==='kowakunai'){ removeAdjacentDanger(t.x,t.y); delete state.tiles[k]; logBlock('enemy',['「こわくない」で、まわりの 涙が 消えた。']); }
    else { logBlock('enemy',['影は ('+t.x+','+t.y+') へ 動いた。']); }
  } else {
    logBlock('enemy',['影は ('+t.x+','+t.y+') へ 動いた。']);
  }

  leaveDanger(prev.x,prev.y);

  if(isBench(t.x,t.y)){
    state.result='win';
    state.endKind = state.memorySeen ? 'memory' : (s.hereCount>=2 ? 'gentle' : 'bench');
    logBlock('result', WIN_TEXT[state.endKind].slice());
  } else if(isExit(t.x,t.y)){
    state.result='lose'; state.endKind='escape'; logBlock('result',LOSE_TEXT.escape.slice());
  }
}

function removeAdjacentDanger(x,y){
  var ns=[{x:x,y:y},{x:x,y:y-1},{x:x-1,y:y},{x:x+1,y:y},{x:x,y:y+1}];
  for(var i=0;i<ns.length;i++){ var kk=key(ns[i].x,ns[i].y); if(state.danger[kk]) delete state.danger[kk]; }
}

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, moveL:moveL, placeWord:placeWord, placeMark:placeMark,
    listen:listen, endTurn:endTurn, peekShadowMove:peekShadowMove, canPlace:canPlace, nearL:nearL,
    inBounds:inBounds, isTree:isTree, isBench:isBench, isExit:isExit, isPuddle:isPuddle,
    restart:restart, get state(){return state;} };
}
