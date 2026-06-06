/*
 * main.js — Battle 13 の配線。プレイヤー行動 → engine.resolveTurn → 再描画。
 */
var Game = (function(){
  function act(id){ resolveTurn(id); UI.render(); }
  function restart(){ restart_(); UI.render(); }
  return { act:act, restart:restart };
})();
function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){ fillIntro(); newBattle(); document.getElementById('restart-btn').onclick=function(){ Game.restart(); }; UI.render(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
