/*
 * main.js — Battle 09 の配線＋アニメ駆動。
 *
 * UIの局面 view（select/timing/silence）と、タイミングのアニメをここで動かす。
 * engine は pos(0..100) や waited(bool) を受け取るだけ。
 */

// UIの局面（ui.js から参照される）
var view = { phase:'select', cmd:null, meter:50, dir:1, silence:0 };
var rafId = 0, silenceTimer = 0;

var Game = (function(){

  function selectCommand(id){
    if(state.result) return;
    var cmd = cmdById(id);
    if(cmd.type==='backfire'){ resolveCommand(id, 50); UI.render(); return; }   // Lv3 はタイミング無関係
    if(cmd.type==='silence'){ startSilence(); return; }
    // タイミング系：メーターを動かす
    view.phase='timing'; view.cmd=id; view.meter=8; view.dir=1;
    UI.render();
    startMeter();
  }

  function startMeter(){
    stopMeter();
    function step(){
      // 0..100 を往復（ping-pong）。中央50が最良。
      view.meter += view.dir * 1.7;
      if(view.meter>=100){ view.meter=100; view.dir=-1; }
      if(view.meter<=0){ view.meter=0; view.dir=1; }
      UI.tickMeter();
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
  }
  function stopMeter(){ if(rafId){ cancelAnimationFrame(rafId); rafId=0; } }

  function lockTiming(){
    if(view.phase!=='timing') return;
    stopMeter();
    var pos = Math.round(view.meter);
    var cmd = view.cmd;
    view.phase='select'; view.cmd=null;
    resolveCommand(cmd, pos);
    UI.render();
  }

  function cancelAction(){ stopMeter(); clearSilence(); view.phase='select'; view.cmd=null; UI.render(); }

  function startSilence(){
    view.phase='silence'; view.silence=0;
    UI.render();
    clearSilence();
    // 一定時間“待ちきる”と成功。途中で話すと失敗。
    var startedAt = 0;
    var dur = 100; // 100ステップで満ちる
    silenceTimer = setInterval(function(){
      view.silence += 4;
      UI.tickSilence();
      if(view.silence>=100){
        clearSilence();
        view.phase='select';
        chooseSilence(true);
        UI.render();
      }
    }, 80);
  }
  function breakSilence(){
    if(view.phase!=='silence') return;
    clearSilence(); view.phase='select';
    chooseSilence(false);
    UI.render();
  }
  function clearSilence(){ if(silenceTimer){ clearInterval(silenceTimer); silenceTimer=0; } }

  function restart(){ stopMeter(); clearSilence(); view.phase='select'; view.cmd=null; view.meter=50; view.silence=0; restart_(); UI.render(); }

  return { selectCommand:selectCommand, lockTiming:lockTiming, cancelAction:cancelAction,
           startSilence:startSilence, breakSilence:breakSilence, restart:restart };
})();

function restart_(){ return restart(); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){
    var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i];
    box.appendChild(p);
  }
}
function boot(){ fillIntro(); newBattle(); document.getElementById('restart-btn').onclick=function(){ Game.restart(); }; UI.render(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
