/*
 * main.js — Battle 11 の配線。盤面クリックは view.mode で意味が変わる。
 */
var view = { mode:'idle', word:null };   // 'idle'|'move'|'pickword'|'word'|'mark'

var Game = (function(){
  function beginMove(){ if(state.result) return; view.mode='move'; UI.render(); }
  function beginWord(){ if(state.result) return; view.mode='pickword'; UI.render(); }
  function beginMark(){ if(state.result) return; view.mode='mark'; UI.render(); }
  function pickWord(id){ view.mode='word'; view.word=id; UI.render(); }
  function cancel(){ view.mode='idle'; view.word=null; UI.render(); }

  function cellClick(x,y){
    if(view.mode==='move'){ moveL(x,y); }
    else if(view.mode==='word'){ placeWord(view.word,x,y); }
    else if(view.mode==='mark'){ placeMark(x,y); }
    view.mode='idle'; view.word=null;
    UI.render();
  }
  function listen(){ if(state.result) return; listen_(); view.mode='idle'; UI.render(); }
  function endTurn(){ if(state.result) return; endTurn_(); view.mode='idle'; UI.render(); }
  function restart(){ view.mode='idle'; view.word=null; restart_(); UI.render(); }

  return { beginMove:beginMove, beginWord:beginWord, beginMark:beginMark, pickWord:pickWord,
           cancel:cancel, cellClick:cellClick, listen:listen, endTurn:endTurn, restart:restart };
})();

// engine の同名関数を別名で束ねる
function listen_(){ return listen(); }
function endTurn_(){ return endTurn(); }
function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){ fillIntro(); newBattle(); document.getElementById('restart-btn').onclick=function(){ Game.restart(); }; UI.render(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
