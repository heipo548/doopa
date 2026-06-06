/*
 * main.js — Battle 12 の配線＋鼓動アニメ。
 * 鼓動ドットを setInterval で巡らせ、押した瞬間のドットで hit を決める。
 */
var view = { beatIndex:0 };
var beatTimer = 0;

var Game = (function(){
  function beat(cmdId){
    if(state.result) return;
    var pattern = currentPattern();
    var hit;
    if(pattern==='silence'){ hit = (cmdId==='damaru') ? 'wait' : 'miss'; }
    else { hit = BEAT_DOTS[pattern][view.beatIndex] ? 'good' : 'miss'; }
    resolveBeat(cmdId, hit);
    if(state.result) stopBeat();
    UI.render();
  }
  function startBeat(){
    stopBeat();
    beatTimer = setInterval(function(){
      view.beatIndex = (view.beatIndex+1) % 8;
      UI.tickBeat();
    }, 240);
  }
  function stopBeat(){ if(beatTimer){ clearInterval(beatTimer); beatTimer=0; } }
  function restart(){ view.beatIndex=0; restart_(); startBeat(); UI.render(); }
  return { beat:beat, startBeat:startBeat, restart:restart };
})();
function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){ fillIntro(); newBattle(); document.getElementById('restart-btn').onclick=function(){ Game.restart(); }; UI.render(); Game.startBeat(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
