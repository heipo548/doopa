/*
 * main.js — Battle 10 の配線。ui のボタンは Game.* を呼ぶ。
 */
var Game = (function(){
  function select(id){ selectPart(id); UI.render(); }
  function actCmd(id){ act(id); UI.render(); }
  function restart(){ restart_(); UI.render(); }
  return { select:select, act:actCmd, restart:restart };
})();
function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){ fillIntro(); newBattle(); document.getElementById('restart-btn').onclick=function(){ Game.restart(); }; UI.render(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
