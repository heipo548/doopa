/*
 * main.js — Battle 10 の配線。ui のボタンは Game.* を呼ぶ。
 */
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）
var Game = (function(){
  // 最初の1手（＝部位を選ぶ）でおすすめハイライトを消す
  function select(id){
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
    selectPart(id); UI.render();
  }
  function actCmd(id){ act(id); UI.render(); }
  function restart(){ acted=false; restart_(); UI.render(); recommend(); }
  return { select:select, act:actCmd, restart:restart };
})();
function restart_(){ return restart(); }

// 1ターン目だけ「名前タグ（部位）」をおすすめハイライト
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#part-tag'); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){
  fillIntro(); newBattle();
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
  // 簡易BGM（モンハン参考：狩り場の低い緊張）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('monhan');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：ぬいぐるみの気になる場所を選び、傷つけずにほどこう',
    terms:[
      {term:'こころ', desc:'Lの元気です。0になると失敗です。'},
      {term:'ざわめき', desc:'ぬいぐるみの落ち着かなさ。全部の部位をほどくと0になり、成功です。'},
      {term:'気になる場所', desc:'部位のこと。片目・腕・胸・名前タグに、別々の気持ちが引っかかっています。'},
      {term:'状態', desc:'部位の進み具合。閉じている→震えている→ほどけかけ→ほどけた、と進みます。強引にやると「傷ついた」になります。'},
      {term:'きく', desc:'選んだ場所の本音を見る。何が引っかかっているか分かります。'},
      {term:'封じる', desc:'強引に止める方法。すぐ静まりますが、部位は「傷ついた」になり後味が変わります。'}
    ],
    steps:[
      {title:'このバトルは?', body:'ただ怒っているわけではありません。片目・腕・胸・名前タグに、別々の気持ちが引っかかっています。倒すのではなく、ひとつずつ ほどいていきます。'},
      {title:'まず名前タグを選ぼう', body:'下の「こころの部位」から、まず「名前タグ」を選んでみましょう。', highlight:'#part-tag'},
      {title:'本音をきく', body:'選んだ場所に「きく」を使うと、何が引っかかっているか見えます。見てから、その場所に効くことばを探しましょう。'},
      {title:'封じるは最後の手', body:'「封じる」はすぐ止められますが、部位が傷つきます。使いすぎると後味が変わるので、注意して使いましょう。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
