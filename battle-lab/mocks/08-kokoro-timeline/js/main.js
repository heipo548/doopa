/*
 * main.js — engine（ルール）と ui（描画）の配線。
 * ui のボタンは Game.* を呼ぶので、ここで Game を定義して公開する。
 */
var Game = (function(){
  function choose(id){ chooseCommand(id); UI.render(); }
  function restart(){ restart_(); UI.render(); }
  return { choose: choose, restart: restart };
})();

// engine の restart と名前が衝突しないよう別名で束ねる
function restart_(){ return restart(); }

// 開幕説明（data.js の INTRO_TEXT）を上部に流し込む
function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){
    var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; }
    else p.textContent=INTRO_TEXT[i];
    box.appendChild(p);
  }
}

function boot(){
  fillIntro();
  newBattle();
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
