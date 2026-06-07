/*
 * main.js — Battle 11 の配線。盤面クリックは view.mode で意味が変わる。
 */
var view = { mode:'idle', word:null };   // 'idle'|'move'|'pickword'|'word'|'mark'
var acted = false;   // 最初の1手を打ったか（おすすめハイライト消し用）

// 最初の操作で、おすすめハイライトを一度だけ消す
function firstAct(){ if(!acted){ acted=true; if(typeof Tutor!=='undefined') Tutor.clearHighlight(); } }

var Game = (function(){
  function beginMove(){ if(state.result) return; firstAct(); view.mode='move'; UI.render(); }
  function beginWord(){ if(state.result) return; firstAct(); view.mode='pickword'; UI.render(); }
  function beginMark(){ if(state.result) return; firstAct(); view.mode='mark'; UI.render(); }
  function pickWord(id){ view.mode='word'; view.word=id; UI.render(); }
  function cancel(){ view.mode='idle'; view.word=null; UI.render(); }

  function cellClick(x,y){
    if(view.mode==='move'){ moveL(x,y); }
    else if(view.mode==='word'){ placeWord(view.word,x,y); }
    else if(view.mode==='mark'){ placeMark(x,y); }
    view.mode='idle'; view.word=null;
    UI.render();
  }
  function listen(){ if(state.result) return; firstAct(); listen_(); view.mode='idle'; UI.render(); }
  function endTurn(){ if(state.result) return; firstAct(); endTurn_(); view.mode='idle'; UI.render(); }
  function restart(){ acted=false; view.mode='idle'; view.word=null; restart_(); UI.render(); recommend(); }

  return { beginMove:beginMove, beginWord:beginWord, beginMark:beginMark, pickWord:pickWord,
           cancel:cancel, cellClick:cellClick, listen:listen, endTurn:endTurn, restart:restart };
})();

// 1ターン目だけ「ことばを置く」をおすすめハイライト
function recommend(){ if(typeof Tutor!=='undefined' && !acted) Tutor.highlight('#act-word'); }

// engine の同名関数を別名で束ねる
function listen_(){ return listen(); }
function endTurn_(){ return endTurn(); }
function restart_(){ return restart(); }

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
  // 簡易BGM（Into the Breach参考：静かな戦術盤面の緊張）。最初はOFF、右下ボタンで再生。
  if(typeof BGM!=='undefined') BGM.setup('breach');
  // 初見向けチュートリアル（目標バー・あそびかた・ことばヘルプ）
  if(typeof Tutor!=='undefined') Tutor.init({
    objective:'目標：影を攻撃せず、言葉を置いてベンチまで導こう',
    terms:[
      {term:'L', desc:'あなた。盤面を歩いて、言葉を置きます。'},
      {term:'影', desc:'泣いている影。攻撃しません。ベンチまで導く相手です。'},
      {term:'ベンチ', desc:'目的地。影がここに着けば成功です。'},
      {term:'出口', desc:'公園の出口。影がここに着くと、逃げてしまい失敗です。'},
      {term:'危険マス(涙)', desc:'影が通ったあとに残る「涙」のマス。Lが踏むと こころ が減ります。'},
      {term:'言葉マス', desc:'あなたが置いた言葉。影が踏むと、立ち止まったり 向きを変えたりします。'},
      {term:'しるし', desc:'•のマス。影をそちらへ 引き寄せます。通り道を作るのに使います。'},
      {term:'ざわめき', desc:'影の落ち着かなさ。「だいじょうぶ」を踏むと和らぎます。'},
      {term:'こころ', desc:'Lの元気です。涙のマスを踏むと減り、0になると失敗です。'}
    ],
    steps:[
      {title:'影とベンチの位置を見る', body:'盤面で「影」と「ベンチ」の場所を見てください。目的は、影を攻撃することではなく、影をベンチまで 導くことです。'},
      {title:'影は逃げようとする', body:'影は次に、ベンチと反対へ 動きそうです。放っておくと、出口の方へ 逃げてしまいます。'},
      {title:'まずは「ことばを置く」', body:'「ことばを置く」を押して、影の通り道に 言葉を置きましょう。まずは「ここにいる」がおすすめです。', highlight:'#act-word'},
      {title:'踏むと立ち止まる', body:'影は「ここにいる」を踏むと、少し立ち止まります。次は、影が ベンチに近づくように 置いてみましょう。'}
    ]
  });
  recommend();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
