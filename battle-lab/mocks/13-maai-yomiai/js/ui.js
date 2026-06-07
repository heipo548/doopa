/*
 * ui.js — Battle 13 の描画。距離・読み合い・癖ヒントを見せる。
 */
var UI = (function(){
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('L「')===0||text.indexOf('Lが')===0||text.indexOf('Lは')===0) p.className='ln l';
    else if(text.indexOf('証人「')===0) p.className='ln witness';
    p.textContent=text; return p;
  }
  function pips(cur,max,ch,empty){ var s=''; for(var i=0;i<max;i++) s+=(i<cur?ch:empty); return s; }

  function renderDistance(){
    var box=$('dist-track'); clear(box);
    for(var d=1;d<=5;d++){
      var c=document.createElement('div'); c.className='dist-cell'+(state.distance===d?' here':'')+(d===DIST_OK?' ok':'');
      var n=document.createElement('div'); n.className='dist-n'; n.textContent=DIST_LABEL[d];
      c.appendChild(n); box.appendChild(c);
    }
    $('dist-label').textContent='距離：'+DIST_LABEL[state.distance]+'　ふつう維持 '+state.distStreak+'/'+DIST_STREAK_WIN;
  }

  function renderStatus(){
    $('enemy-name').textContent=state.enemy.name + (state.enemy.broken?'（ブレイク）':'');
    $('zawameki-fill').style.width=Math.round((state.enemy.zawameki/state.enemy.maxZawameki)*100)+'%';
    $('zawameki-num').textContent=state.enemy.zawameki+' / '+state.enemy.maxZawameki;
    $('keikai-pips').textContent=pips(state.enemy.keikai,state.enemy.maxKeikai,'▲','△');
    $('kokoro-fill').style.width=Math.round((state.player.kokoro/state.player.maxKokoro)*100)+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=2?' danger':'');
    $('kokoro-num').textContent=state.player.kokoro+' / '+state.player.maxKokoro;
    $('read-num').textContent='読み勝ち '+state.readWins+' / '+READ_WIN;
  }

  function renderReveal(){
    var box=$('last-reveal');
    if(state.enemy.lastAct){ box.textContent='前回 → 証人は「'+ENEMY_LABEL[state.enemy.lastAct]+'」だった。'; box.classList.remove('empty'); }
    else { box.textContent='証人は、まだ 何も見せていない。'; box.classList.add('empty'); }
  }
  function renderTells(){
    var box=$('tells'); clear(box);
    var keys=[]; for(var k in state.tells) keys.push(k);
    if(!keys.length){ var p=document.createElement('div'); p.className='tell empty'; p.textContent='（観察すると、証人の癖が 見えてくる）'; box.appendChild(p); return; }
    for(var i=0;i<keys.length;i++){ var d=document.createElement('div'); d.className='tell'; d.textContent='・'+state.tells[keys[i]]; box.appendChild(d); }
  }

  function renderActs(){
    var area=$('acts'); clear(area);
    for(var i=0;i<PLAYER_ACTS.length;i++){
      (function(a){
        var b=document.createElement('button'); b.className='act'; b.id='act-'+a.id;
        b.disabled=!!state.result;
        var nm=document.createElement('span'); nm.className='act-name'; nm.textContent=a.name;
        var h=document.createElement('div'); h.className='act-hint'; h.textContent=a.hint;
        b.appendChild(nm); b.appendChild(h);
        if(!state.result) b.onclick=function(){ Game.act(a.id); };
        area.appendChild(b);
      })(PLAYER_ACTS[i]);
    }
  }

  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){ var blk=state.log[i]; var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j])); box.appendChild(div); }
    box.scrollTop=box.scrollHeight;
  }
  function renderOverlay(){
    var ov=$('overlay'); if(!state.result){ ov.classList.remove('show'); return; }
    var win=state.result==='win'||state.result==='special';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    $('overlay-title').textContent = state.result==='special' ? '——' : (win?WIN_TITLE:LOSE_TITLE);
    var body=$('overlay-text'); clear(body);
    var text=(state.result==='lose')?LOSE_TEXT[state.endKind]:WIN_TEXT[state.endKind];
    for(var i=0;i<text.length;i++) body.appendChild(lineEl(text[i]));
    // やさしい解説（勝因/敗因）＋リトライ助言
    if(typeof ADVICE!=='undefined' && ADVICE[state.endKind]){
      var ad=document.createElement('p'); ad.className='overlay-advice'; ad.textContent=ADVICE[state.endKind]; body.appendChild(ad);
    }
    if(state.result==='lose' && typeof RETRY_HINT!=='undefined'){
      var h=document.createElement('p'); h.className='overlay-hint'; h.textContent=RETRY_HINT; body.appendChild(h);
    }
    ov.classList.add('show');
  }

  function render(){ renderDistance(); renderStatus(); renderReveal(); renderTells(); renderActs(); renderLog(); renderOverlay(); }
  return { render:render };
})();
