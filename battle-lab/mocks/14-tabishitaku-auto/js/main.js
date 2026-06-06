/*
 * main.js — Battle 14 の配線。準備の配置／半自動の進行＋介入。
 */
var view = { selectedItem:null, intervene:false };
var autoTimer = 0;

var Game = (function(){
  // ── 準備フェーズ ──
  function selectItem(id){ view.selectedItem = (view.selectedItem===id)?null:id; UI.render(); }
  function bagClick(cell){
    if(state.bag[cell]){ takeItem(cell); }            // 入っていれば 取り出す
    else if(view.selectedItem){ if(placeItem(view.selectedItem, cell)) view.selectedItem=null; }
    UI.render();
  }
  function start(){
    if(state.phase!=='prep') return;
    startBattle();
    UI.render();
    startAuto();
  }

  // ── 戦闘フェーズ（半自動）──
  function startAuto(){
    stopAuto();
    autoTimer=setInterval(function(){
      if(state.phase!=='battle' || view.intervene){ return; }
      step();
      UI.render();
      if(state.phase!=='battle') stopAuto();
    }, 950);
  }
  function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer=0; } }
  function watch(){ if(state.phase!=='battle' || view.intervene) return; step(); UI.render(); if(state.phase!=='battle') stopAuto(); }
  function toggleIntervene(){ view.intervene=!view.intervene; UI.render(); }
  function useCell(cell){ useItem(cell); view.intervene=false; UI.render(); if(state.phase!=='battle') stopAuto(); }

  function restart(){ stopAuto(); view.selectedItem=null; view.intervene=false; restart_(); UI.render(); }
  return { selectItem:selectItem, bagClick:bagClick, start:start, watch:watch,
           toggleIntervene:toggleIntervene, useCell:useCell, restart:restart };
})();
function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){
  fillIntro(); newBattle();
  document.getElementById('start-btn').onclick=function(){ Game.start(); };
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
