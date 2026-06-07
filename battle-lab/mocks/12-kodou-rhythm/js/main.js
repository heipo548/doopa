/*
 * main.js — Battle 12 の配線＋鼓動アニメ。
 * 鼓動ドットを setInterval で巡らせ、押した瞬間のドットで hit を決める。
 */
var view = { beatIndex:0 };
var beatTimer = 0;
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）

var Game = (function(){
  function beat(cmdId){
    if(state.result) return;
    // 最初の1手で、おすすめハイライトを消す
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
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
  function restart(){ acted=false; view.beatIndex=0; restart_(); startBeat(); UI.render(); recommend(); }
  return { beat:beat, startBeat:startBeat, restart:restart };
})();
function restart_(){ return restart(); }

// 1ターン目だけ「きく」をおすすめハイライト
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#cmd-kiku'); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){
  fillIntro();
  newBattle();
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
  Game.startBeat();
  // 簡易BGM（Patapon参考：鼓動・太鼓の静かな脈打ち）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('patapon');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：光に合わせて同調を上げ、飲まれすぎないようにしよう',
    terms:[
      {term:'こころ', desc:'Lの元気です。0になると失敗です。'},
      {term:'ざわめき', desc:'灯台の影の落ち着かなさ。0にできると成功です。'},
      {term:'同調', desc:'相手のリズムにどれだけ重なれたか。光に合わせると上がります。'},
      {term:'飲まれ', desc:'相手のリズムに飲み込まれかけている度合い。満タンになると失敗です。合わせすぎると増えます。'},
      {term:'光（●）', desc:'押すタイミングです。●が光った瞬間に合わせて押すと「合った」になります。'},
      {term:'無音（…）', desc:'光がぜんぶ消えている時間。何も押さず「だまる」で待つのが正解です。'}
    ],
    steps:[
      {title:'このバトルは?', body:'灯台の影は、光と鼓動で話します。光るタイミングに合わせると、気持ちが分かります。でも合わせすぎると、こちらが飲み込まれます。'},
      {title:'光った瞬間に押す', body:'光（●）が強くなった瞬間に押します。まずは「きく」で、光ったタイミングに合わせて押してみましょう。', highlight:'#cmd-kiku'},
      {title:'リズムが合うと', body:'タイミングが合うと、同調（◆）が上がります。よく聞いて、光に合わせましょう。'},
      {title:'飲まれに注意', body:'近づきすぎ＝飲まれ（▼）が上がります。あぶないと感じたら「いきをずらす」で飲まれを下げましょう。'},
      {title:'無音は待つ', body:'光が消えている無音（…）のときは、何も押さずに「だまる」で待つのが正解です。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
