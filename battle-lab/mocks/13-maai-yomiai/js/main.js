/*
 * main.js — Battle 13 の配線。プレイヤー行動 → engine.resolveTurn → 再描画。
 */
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）
var Game = (function(){
  function act(id){
    // 最初の行動でおすすめハイライトを消す（チュートリアル：1ターン目だけ案内）
    if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); }
    resolveTurn(id);
    UI.render();
  }
  function restart(){ acted=false; restart_(); UI.render(); recommend(); }
  return { act:act, restart:restart };
})();
function restart_(){ return restart(); }

// 1ターン目だけ「きく」をおすすめハイライト（近づけば勝ち、ではないので まず観察）
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#act-kiku'); }

function fillIntro(){
  var box=document.getElementById('mock-intro'); if(!box) return;
  for(var i=0;i<INTRO_TEXT.length;i++){ var p=document.createElement('p');
    if(INTRO_TEXT[i]===''){ p.className='blank'; p.innerHTML='&nbsp;'; } else p.textContent=INTRO_TEXT[i]; box.appendChild(p); }
}
function boot(){
  fillIntro(); newBattle();
  document.getElementById('restart-btn').onclick=function(){ Game.restart(); };
  UI.render();
  // 簡易BGM（スマブラ参考：対戦的で少しスピード感のある拍）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('smash');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：証人との距離を読み、近すぎず遠すぎない場所で言葉を選ぼう',
    terms:[
      {term:'距離', desc:'証人とLの あいだ。5段階（遠い〜近すぎる）。近づきすぎても 遠すぎても うまくいきません。'},
      {term:'こころ', desc:'Lの元気です。踏み込みすぎると 削れて、0になると 失敗です。'},
      {term:'ざわめき', desc:'証人の 落ち着かなさ。読み勝つと 減り、0にできると 成功です。'},
      {term:'警戒', desc:'証人の かまえ。下げきると「ブレイク」して、決め手が 通ります。'},
      {term:'証人のくせ', desc:'証人が つい やってしまう型。観察すると「近い距離では拒絶しやすい」などが 見えてきます。'},
      {term:'読み勝ち', desc:'証人の手に ちょうど合う言葉を 返せたこと。3回で 成功です。'}
    ],
    steps:[
      {title:'このバトルは?', body:'証人は 何か 知っています。でも 近づきすぎると拒絶し、遠すぎると逃げます。距離を見て「聞く／黙る／近づく／離れる」を選ぶゲームです。'},
      {title:'いまの距離', body:'いまは「ふつう」の距離。ここなら「きく」が いちばん 届きやすいです。距離トラックの色が変わっている所が、ちょうどいい距離です。'},
      {title:'まずは「きく」', body:'最初は「きく」を押して、証人の くせを 見ましょう。警戒も 少し ほどけます。', highlight:'#act-kiku'},
      {title:'同時に動く', body:'Lと証人は 同時に動きます。相手が 次に 何を しそうか（くせ）を 考えてから 選びましょう。'},
      {title:'ちょうどいい距離', body:'近づけば勝ち、ではありません。ふつうの距離を 保ちつづけるのも、立派な 勝ち方です。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
