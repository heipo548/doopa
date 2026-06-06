/*
 * engine.js — Battle 14「旅支度オートバトル」進行ルール（DOM非依存）
 *
 * 2フェーズ：prep（カバンに配置）→ battle（半自動で発動）→ done（結末）。
 *   placeItem(itemId,cell) / takeItem(cell) … 準備
 *   startBattle() … シナジー計算・発動順を作る（手紙は最後）
 *   step() … 次の持ち物を発動＋悪党の手番（オートの1コマ）
 *   useItem(cell) … 任意の持ち物を“いま”発動（介入）
 */

var state = null;
function logBlock(tone,lines){ if(typeof lines==='string') lines=[lines]; state.log.push({tone:tone,lines:lines}); }
function itemDef(id){ for(var i=0;i<ITEMS.length;i++) if(ITEMS[i].id===id) return ITEMS[i]; return null; }

// 3×3 の隣接（上下左右）
var ADJ = {0:[1,3],1:[0,2,4],2:[1,5],3:[0,4,6],4:[1,3,5,7],5:[2,4,8],6:[3,7],7:[4,6,8],8:[5,7]};

function newBattle(){
  state={
    phase:'prep',
    bag:[null,null,null,null,null,null,null,null,null],
    placed:{},                 // itemId -> true（配置済み）
    player:{ name:PLAYER_INIT.name, kokoro:PLAYER_INIT.kokoro, maxKokoro:PLAYER_INIT.maxKokoro },
    enemy:{ name:ENEMY_INIT.name, zawameki:ENEMY_INIT.zawameki, maxZawameki:ENEMY_INIT.maxZawameki },
    queue:[],                  // 発動待ちセルの順番
    fired:[],                  // 発動済みセル
    syn:{}, defense:0, enemyFirstSkip:false, enemyTick:0,
    wordDmg:0, thingDmg:0,
    result:null, endKind:null,
    log:[]
  };
  logBlock('open',[OPENING_LOG]);
  logBlock('system',['カバンに 持ち物を 詰めて、戦闘開始。']);
  return state;
}

// 配置可能な持ち物（未配置のもの）
function available(){ var a=[]; for(var i=0;i<ITEMS.length;i++) if(!state.placed[ITEMS[i].id]) a.push(ITEMS[i]); return a; }

function placeItem(itemId, cell){
  if(state.phase!=='prep') return false;
  if(cell<0||cell>8||state.bag[cell]!==null) return false;
  if(state.placed[itemId] || !itemDef(itemId)) return false;
  state.bag[cell]=itemId; state.placed[itemId]=true;
  return true;
}
function takeItem(cell){
  if(state.phase!=='prep') return false;
  if(cell<0||cell>8||state.bag[cell]===null) return false;
  state.placed[state.bag[cell]]=false; delete state.placed[state.bag[cell]];
  state.bag[cell]=null;
  return true;
}

// 隣接に A と B のペアがあるか
function hasPair(A,B){
  for(var i=0;i<9;i++){ if(state.bag[i]!==A) continue; var ns=ADJ[i];
    for(var j=0;j<ns.length;j++) if(state.bag[ns[j]]===B) return true; }
  return false;
}

function startBattle(){
  if(state.phase!=='prep') return false;
  // 空のカバンでは旅に出られない（「準備＝戦い」の核を守る）
  var placedCount=0; for(var i=0;i<9;i++) if(state.bag[i]!==null) placedCount++;
  if(placedCount===0){ logBlock('system',['カバンが 空っぽだ。何か ひとつでも 詰めてから 旅に出よう。']); return false; }
  // シナジー
  state.syn={
    memory:        hasPair('letter','photo'),
    gratitudeLetter:hasPair('arigatou','letter'),
    breadBoost:    hasPair('bread','daijoubu'),
    defenseUp:     hasPair('stone','branch'),
    bellDelay:     hasPair('bell','blank')
  };
  state.defense = state.syn.defenseUp ? 1 : 0;
  state.enemyFirstSkip = state.syn.bellDelay;
  // 発動順（読み順）。ただし手紙は最後に回す（「最後に手紙が発動する」）。
  var order=[], letterCell=-1;
  for(var i=0;i<9;i++){ if(state.bag[i]===null) continue; if(state.bag[i]==='letter'){ letterCell=i; continue; } order.push(i); }
  if(letterCell>=0) order.push(letterCell);
  state.queue=order;
  state.phase='battle';
  logBlock('system',['旅支度、完了。'+(state.queue.length)+'個の持ち物が、順に 発動する。']);
  if(state.syn.memory) logBlock('hint',['（シナジー）手紙＋写真：悪党の記憶が ひらく。']);
  if(state.syn.gratitudeLetter) logBlock('hint',['（シナジー）ありがとう＋手紙：最後に 特別な言葉が 届く。']);
  if(state.syn.breadBoost) logBlock('hint',['（シナジー）パン＋だいじょうぶ：回復が 強まる。']);
  if(state.syn.defenseUp) logBlock('hint',['（シナジー）石＋枝：防御が 上がる。']);
  if(state.syn.bellDelay) logBlock('hint',['（シナジー）鈴＋空白：悪党の初回行動が 遅れる。']);
  if(state.queue.length===0) endBattle();
  return true;
}

// 1つの持ち物を発動
function fireCell(cell){
  var id=state.bag[cell]; var it=itemDef(id);
  state.fired.push(cell);
  var dmg=it.dmg, heal=it.heal, lines=[];
  if(id==='photo' && state.syn.memory){ dmg+=1; lines.push('写真がひらく。悪党の記憶が、にじむ。'); }
  if(id==='letter' && state.syn.gratitudeLetter){ dmg+=2; lines.push('手紙の最後に、「ありがとう」が 書き足されていた。'); }
  if(id==='bread' && state.syn.breadBoost){ heal+=2; }
  if(dmg>0){ state.enemy.zawameki=Math.max(0,state.enemy.zawameki-dmg);
    if(it.kind==='word') state.wordDmg+=dmg; else if(it.kind==='thing') state.thingDmg+=dmg; }
  if(heal>0) state.player.kokoro=Math.min(state.player.maxKokoro,state.player.kokoro+heal);
  // ログ
  var head='「'+it.name+'」が 発動した。';
  if(dmg>0) lines.push(head+'（ざわめき −'+dmg+'）');
  else if(heal>0) lines.push(head+'（こころ +'+heal+'）');
  else if(id==='blank') lines.push('空白が、しずかに ひらいた。');
  else lines.push(head);
  logBlock(it.kind==='word'?'word':(it.kind==='thing'?'thing':'blank'), lines);
}

// 悪党の手番
function enemyTurn(){
  if(state.enemyFirstSkip){ state.enemyFirstSkip=false; logBlock('enemy',['鈴の音で、悪党は ひるんだ。（行動 遅延）']); return; }
  var dmg=Math.max(0, ENEMY_ATK - state.defense);
  logBlock('enemy',[ENEMY_ACTS[state.enemyTick % ENEMY_ACTS.length] + (dmg>0?'（こころ −'+dmg+'）':'（防御で 防いだ）')]);
  if(dmg>0) state.player.kokoro=Math.max(0,state.player.kokoro-dmg);
  state.enemyTick++;
}

// オートの1コマ（見守る）：次の持ち物を発動 → 悪党の手番
function step(){
  if(state.phase!=='battle') return false;
  if(!state.queue.length){ endBattle(); return false; }
  var cell=state.queue.shift();
  fireCell(cell);
  if(state.enemy.zawameki<=0){ endBattle(); return true; }
  enemyTurn();
  if(!state.queue.length) endBattle();
  return true;
}

// 介入：任意の持ち物を“いま”発動
function useItem(cell){
  if(state.phase!=='battle') return false;
  var idx=state.queue.indexOf(cell);
  if(idx<0) return false;
  state.queue.splice(idx,1);
  logBlock('system',['Lは、自分で 「'+itemDef(state.bag[cell]).name+'」を 取り出した。']);
  fireCell(cell);
  if(state.enemy.zawameki<=0){ endBattle(); return true; }
  enemyTurn();
  if(!state.queue.length) endBattle();
  return true;
}

function endBattle(){
  if(state.phase==='done') return;
  state.phase='done';
  // 空白を真ん中(セル4)に置いていたら 空白エンド（最優先の特殊終了）
  if(state.bag[4]==='blank'){ state.result='special'; state.endKind='blank'; logBlock('result',WIN_TEXT.blank.slice()); return; }
  if(state.enemy.zawameki<=0){
    state.endKind = (state.wordDmg>=state.thingDmg) ? 'persuade' : 'punish';
    state.result='win';
    logBlock('result',WIN_TEXT[state.endKind].slice());
    return;
  }
  // 倒しきらず（持ち物が尽きた）→ 見逃す
  state.result='win'; state.endKind='letgo';
  logBlock('result',WIN_TEXT.letgo.slice());
}

function restart(){ return newBattle(); }

if(typeof module!=='undefined' && module.exports){
  module.exports={ newBattle:newBattle, placeItem:placeItem, takeItem:takeItem, available:available,
    startBattle:startBattle, step:step, useItem:useItem, hasPair:hasPair, itemDef:itemDef,
    restart:restart, get state(){return state;} };
}
