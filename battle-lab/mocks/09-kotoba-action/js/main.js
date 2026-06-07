/*
 * main.js — Battle 09 の配線＋アニメ駆動。
 *
 * UIの局面 view（select/timing/silence）と、タイミングのアニメをここで動かす。
 * engine は pos(0..100) や waited(bool) を受け取るだけ。
 */

// UIの局面（ui.js から参照される）
var view = { phase:'select', cmd:null, meter:50, dir:1, silence:0 };
var rafId = 0, silenceTimer = 0;
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）

var Game = (function(){

  function selectCommand(id){
    if(state.result) return;
    // 最初のコマンド選択でおすすめハイライトを消す
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
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

  function restart(){ acted=false; stopMeter(); clearSilence(); view.phase='select'; view.cmd=null; view.meter=50; view.silence=0; restart_(); UI.render(); recommend(); }

  return { selectCommand:selectCommand, lockTiming:lockTiming, cancelAction:cancelAction,
           startSilence:startSilence, breakSilence:breakSilence, restart:restart };
})();

// engine の restart と名前が衝突しないよう別名で束ねる
function restart_(){ return restart(); }

// 1ターン目だけ「はなす」をおすすめハイライト（最初の1手を打つまで）
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#cmd-hanasu'); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){
    var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i];
    box.appendChild(p);
  }
}
function boot(){
  fillIntro();
  newBattle();
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
  // 簡易BGM（マリオRPG参考：ポップで明るい授業。最初はOFF、右下ボタンで再生）
  if(typeof BGM!=='undefined') BGM.setup('mario');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：タイミングよく言葉を届けて、先生のざわめきを静めよう（3回つづけて届けてもOK）',
    terms:[
      {term:'こころ', desc:'Lの元気です。0になると失敗です。'},
      {term:'先生のざわめき', desc:'先生の落ち着かなさ。0にできると成功です。'},
      {term:'警戒', desc:'先生の身がまえ。急かすと上がります。「きく」「だまる」で下げられます。'},
      {term:'タイミング', desc:'動く印がまんなか（50）に来たときに押すと、いちばんよく届きます。'},
      {term:'れんぞく', desc:'まんなかで言葉を“届ける”のが続いた回数。3回つづけば成功です。'}
    ],
    steps:[
      {title:'このバトルは?', body:'学校の先生は言葉を教えてくれる。でも選ぶだけでは届かない。ちょうどいいタイミングで渡すゲームです。'},
      {title:'まず「はなす」', body:'まず『はなす』を選び、動く印が真ん中に来たら押しましょう。', highlight:'#cmd-hanasu'},
      {title:'まんなかがいちばん', body:'真ん中ほどきれいに届く。早すぎると急かす、遅すぎると届きません。'},
      {title:'だまるのも正解', body:'『だまる』は何も押さないのが正解の時もあります。先生が落ち着くのを、待ってみましょう。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
