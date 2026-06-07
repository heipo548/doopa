/*
 * ui.js — Battle 12 の描画。鼓動ドットの“いま”は main の view.beatIndex を読む。
 */
var UI = (function(){
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('L「')===0||text.indexOf('Lは')===0) p.className='ln l';
    p.textContent=text; return p;
  }
  function pips(cur,max,ch,empty){ var s=''; for(var i=0;i<max;i++) s+=(i<cur?ch:empty); return s; }

  function renderStatus(){
    $('enemy-name').textContent=state.enemy.name;
    $('zawameki-fill').style.width=Math.round((state.enemy.zawameki/state.enemy.maxZawameki)*100)+'%';
    $('zawameki-num').textContent=state.enemy.zawameki+' / '+state.enemy.maxZawameki;
    $('kokoro-fill').style.width=Math.round((state.player.kokoro/state.player.maxKokoro)*100)+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=2?' danger':'');
    $('kokoro-num').textContent=state.player.kokoro+' / '+state.player.maxKokoro;
    $('sync-pips').textContent=pips(state.sync,MAX_SYNC,'◆','◇');
    $('drown-pips').textContent=pips(state.drown,MAX_DROWN,'▼','▽');
    $('drown-pips').className='pip drown'+(state.drown>=MAX_DROWN-1?' danger':'');
  }

  function renderBeatRow(){
    var box=$('beat-row'); if(!box) return; clear(box);
    var pattern=currentPattern();
    var dots=BEAT_DOTS[pattern];
    for(var i=0;i<dots.length;i++){
      var d=document.createElement('span');
      d.className='beat'+(dots[i]?' on':'')+(view.beatIndex===i?' now':'');
      d.textContent = dots[i] ? '●' : '·';
      box.appendChild(d);
    }
  }
  function renderPattern(){ $('pattern-label').textContent='いまのリズム：'+PATTERN_LABEL[currentPattern()]; }

  function renderCommands(){
    var area=$('cmd-area'); clear(area);
    for(var i=0;i<COMMANDS.length;i++){
      (function(c){
        var b=document.createElement('button'); b.className='cmd'+(c.id==='damaru'?' silence':''); b.id='cmd-'+c.id;
        b.disabled=!!state.result;
        var nm=document.createElement('span'); nm.className='cmd-name'; nm.textContent=c.name;
        var hint=document.createElement('div'); hint.className='cmd-hint'; hint.textContent=c.hint;
        b.appendChild(nm); b.appendChild(hint);
        if(!state.result) b.onclick=function(){ Game.beat(c.id); };
        area.appendChild(b);
      })(COMMANDS[i]);
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

  function render(){ renderStatus(); renderPattern(); renderBeatRow(); renderCommands(); renderLog(); renderOverlay(); }
  function tickBeat(){ renderBeatRow(); }
  return { render:render, tickBeat:tickBeat };
})();
