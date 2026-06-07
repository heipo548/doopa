/*
 * main.js — Battle 14 の配線。準備の配置／半自動の進行＋介入。
 */
var view = { selectedItem:null, intervene:false };
var autoTimer = 0;
var acted = false;   // 最初の1手（持ち物を選ぶ）を打ったか。おすすめハイライト消し用。

var Game = (function(){
  // ── 準備フェーズ ──
  function selectItem(id){
    // 最初に持ち物を選んだら、おすすめハイライトを消す
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
    view.selectedItem = (view.selectedItem===id)?null:id; UI.render();
  }
  function bagClick(cell){
    if(state.bag[cell]){ takeItem(cell); }            // 入っていれば 取り出す
    else if(view.selectedItem){ if(placeItem(view.selectedItem, cell)) view.selectedItem=null; }
    UI.render();
  }
  function start(){
    if(state.phase!=='prep') return;
    startBattle();
    // 戦闘に入ったら、目標を「見守る」フェーズの言葉に切り替える
    if(state.phase==='battle' && typeof Tutor!=='undefined'){
      if(typeof Tutor!=='undefined') Tutor.clearHighlight();
      Tutor.setObjective('目標：カバンの中身がどう働くか見守ろう。必要なら一度だけ介入できます。');
    }
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

  function restart(){
    stopAuto(); view.selectedItem=null; view.intervene=false; acted=false;
    restart_(); UI.render();
    // 準備フェーズに戻るので、目標とおすすめも準備中のものへ戻す
    if(typeof Tutor!=='undefined') Tutor.setObjective(OBJECTIVE_PREP);
    recommend();
  }
  return { selectItem:selectItem, bagClick:bagClick, start:start, watch:watch,
           toggleIntervene:toggleIntervene, useCell:useCell, restart:restart };
})();
function restart_(){ return restart(); }

// 準備フェーズの目標（boot と restart で共有）
var OBJECTIVE_PREP = '目標：カバンに持ち物を並べよう。となり合う組み合わせが大切です。';
// 準備中だけ「手紙を置く」(#tray-letter)をおすすめハイライト
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#tray-letter'); }

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
  // 簡易BGM（Loop Hero参考：旅・焚き火・静かなループ）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('loophero');
  // 初見向けチュートリアル（目標バー・あそびかた・用語ヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective: OBJECTIVE_PREP,
    terms:[
      {term:'カバン', desc:'3×3のマス。ここに持ち物を詰めて、旅に出ます。'},
      {term:'持ち物', desc:'手紙や石など。戦闘中、置いた順に ひとつずつ 働きます。'},
      {term:'となり合う持ち物', desc:'上下左右にくっつけて置くと、力が合わさることがあります（シナジー）。'},
      {term:'シナジー', desc:'相性の良い持ち物を となりに置くと出る、特別な効果のことです。'},
      {term:'空白', desc:'何も置かないマス。じつは 一部の効果を強めたり、特別な結末を呼びます。'},
      {term:'ざわめき', desc:'悪党の落ち着かなさ。0にできると、旅がうまく終わります。'},
      {term:'こころ', desc:'Lの元気です。戦闘中に少し減ることがあります。'},
      {term:'戦闘ログ', desc:'下の文章。持ち物や悪党が 何をしたかを 順に教えてくれます。'}
    ],
    steps:[
      {title:'まず やること', body:'戦う前に カバンへ 持ち物を 詰めます。中身は 戦闘中に 順番に 働きます。'},
      {title:'手紙を 真ん中に', body:'まず「手紙」を 真ん中に 置こう。手紙は 最後に 言葉を届ける 助けになります。', highlight:'#tray-letter'},
      {title:'となりに 並べる', body:'「写真」を 手紙の となりに 置くと、一緒に 効果が出ます（これがシナジー）。'},
      {title:'空白にも 意味がある', body:'何も置かない マス（空白）にも 意味があります。色々な 置き方を ためしてみましょう。'},
      {title:'旅に出る', body:'準備ができたら 戦闘開始。中身が 自動で 働きます。困ったら 一度だけ 持ち物を使えます。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
