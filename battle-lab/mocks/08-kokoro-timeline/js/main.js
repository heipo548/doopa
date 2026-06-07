/*
 * main.js — engine（ルール）と ui（描画）の配線。
 * ui のボタンは Game.* を呼ぶので、ここで Game を定義して公開する。
 */
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）
var Game = (function(){
  function choose(id){
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
    chooseCommand(id);
    UI.render();
  }
  function restart(){ acted=false; restart_(); UI.render(); recommend(); }
  return { choose: choose, restart: restart };
})();

// 1ターン目だけ「きく」をおすすめハイライト
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#cmd-kiku'); }

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
  // 簡易BGM（FFX参考：時計・秒針・静かな緊張）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('ffx');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：村長の気持ちが爆発する前に、言葉を間に合わせよう',
    terms:[
      {term:'こころ', desc:'Lの元気です。0になると失敗です。'},
      {term:'ことば', desc:'言葉を選ぶのに使う力。時間が進むと少しずつ戻ります。'},
      {term:'おちつき', desc:'たまっていると、近すぎる親切のダメージを肩代わりします。'},
      {term:'ざわめき', desc:'村長の落ち着かなさ。0にできると成功です。'},
      {term:'爆発', desc:'村長の気持ちの高ぶり。満タンになると話を聞いてもらえず失敗です。'},
      {term:'タイムライン', desc:'下の線。誰が次に動くかを表します。左に近いほど、すぐ起こります。'}
    ],
    steps:[
      {title:'このバトルは?', body:'相手を倒すのではなく、村長の気持ちが爆発する前に、Lの言葉を間に合わせるゲームです。'},
      {title:'時間の線を見る', body:'下の「タイムライン」を見てください。左に近い行動ほど先に起こります。村長の「大きな拍手」が近づく前に、言葉を選びましょう。'},
      {title:'まずは「きく」', body:'最初は「きく」を押してみましょう。相手が次に何をしようとしているか、少し分かります。', highlight:'#cmd-kiku'},
      {title:'早い言葉・おそい言葉', body:'「こえをかける」は早く届きます。「なまえをよぶ」は強いですが、届くまで時間がかかり、間に合わないこともあります。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
