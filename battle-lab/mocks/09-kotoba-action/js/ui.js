/*
 * ui.js — Battle 09 の描画（state と、UIの局面 view を読んで DOM を組む）
 * タイミングのアニメ自体は main.js が動かす。ui は「いまの局面」を描くだけ。
 */
var UI = (function(){
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('L「')===0) p.className='ln l';
    else if(text.indexOf('先生「')===0) p.className='ln sensei';
    p.textContent=text; return p;
  }

  function renderStatus(){
    $('enemy-name').textContent=state.enemy.name;
    var zpct=Math.round((state.enemy.zawameki/state.enemy.maxZawameki)*100);
    $('zawameki-fill').style.width=zpct+'%';
    $('zawameki-num').textContent=state.enemy.zawameki+' / '+state.enemy.maxZawameki;
    $('keikai-pips').textContent=keikaiBar();
    var kpct=Math.round((state.player.kokoro/state.player.maxKokoro)*100);
    $('kokoro-fill').style.width=kpct+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=3?' danger':'');
    $('kokoro-num').textContent=state.player.kokoro+' / '+state.player.maxKokoro;
    $('streak-num').textContent='れんぞく ' + state.streak + ' / ' + STREAK_WIN;
  }

  // 局面に応じて操作エリアを描く（コマンド一覧／タイミング／だまる）
  function renderAction(){
    var area=$('action-area'); clear(area);
    if(state.result){ return; }

    if(view.phase==='timing'){
      var cmd=cmdById(view.cmd);
      var label=document.createElement('div'); label.className='timing-label';
      label.textContent='「'+cmd.name+'」を、いつ届ける？'; area.appendChild(label);

      var track=document.createElement('div'); track.className='track'+(cmd.tight?' tight':'');
      var zone=document.createElement('div'); zone.className='track-center'; track.appendChild(zone);
      var cursor=document.createElement('div'); cursor.className='track-cursor'; cursor.id='meter-cursor';
      cursor.style.left=(view.meter)+'%'; track.appendChild(cursor);
      area.appendChild(track);

      var btns=document.createElement('div'); btns.className='timing-btns';
      var now=document.createElement('button'); now.className='cmd big'; now.textContent='いま！';
      now.onclick=function(){ Game.lockTiming(); };
      var cancel=document.createElement('button'); cancel.className='cmd cancel'; cancel.textContent='やめる';
      cancel.onclick=function(){ Game.cancelAction(); };
      btns.appendChild(now); btns.appendChild(cancel); area.appendChild(btns);
      return;
    }

    if(view.phase==='silence'){
      var sl=document.createElement('div'); sl.className='timing-label'; sl.textContent='……いまは、何も言わない'; area.appendChild(sl);
      var sbar=document.createElement('div'); sbar.className='silence-bar';
      var sfill=document.createElement('div'); sfill.className='silence-fill'; sfill.id='silence-fill';
      sfill.style.width=(view.silence)+'%'; sbar.appendChild(sfill); area.appendChild(sbar);
      var hint=document.createElement('div'); hint.className='cmd-hint'; hint.textContent='待ちきれば成功。途中で話すと急かしてしまう。'; area.appendChild(hint);
      var talk=document.createElement('button'); talk.className='cmd cancel'; talk.textContent='やっぱり話す';
      talk.onclick=function(){ Game.breakSilence(); }; area.appendChild(talk);
      return;
    }

    // phase 'select'：コマンド一覧
    var grid=document.createElement('div'); grid.className='cmd-grid';
    for(var i=0;i<COMMANDS.length;i++){
      (function(c){
        var b=document.createElement('button'); b.className='cmd'+(c.type==='backfire'?' lv3':'');
        b.disabled=!!state.result;
        var top=document.createElement('div'); top.className='cmd-top';
        var nm=document.createElement('span'); nm.className='cmd-name'; nm.textContent=c.name;
        var meta=document.createElement('span'); meta.className='cmd-meta';
        meta.textContent = c.type==='timing' ? (c.tight?'Lv2 むずかしい':'タイミング') : (c.type==='silence'?'待つ':'Lv3');
        top.appendChild(nm); top.appendChild(meta);
        var hint=document.createElement('div'); hint.className='cmd-hint'; hint.textContent=c.hint;
        b.appendChild(top); b.appendChild(hint);
        if(!state.result) b.onclick=function(){ Game.selectCommand(c.id); };
        grid.appendChild(b);
      })(COMMANDS[i]);
    }
    area.appendChild(grid);
  }

  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){
      var blk=state.log[i]; var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j]));
      box.appendChild(div);
    }
    box.scrollTop=box.scrollHeight;
  }

  function renderOverlay(){
    var ov=$('overlay');
    if(!state.result){ ov.classList.remove('show'); return; }
    var win = state.result==='win'||state.result==='special';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    $('overlay-title').textContent = state.result==='special' ? '——' : (win?WIN_TITLE:LOSE_TITLE);
    var body=$('overlay-text'); clear(body);
    var text=(state.result==='lose')?LOSE_TEXT[state.endKind]:WIN_TEXT[state.endKind];
    for(var i=0;i<text.length;i++) body.appendChild(lineEl(text[i]));
    ov.classList.add('show');
  }

  function render(){ renderStatus(); renderAction(); renderLog(); renderOverlay(); }
  // アニメ中だけカーソル/バーを軽く動かす（全再描画しない）
  function tickMeter(){ var c=$('meter-cursor'); if(c) c.style.left=view.meter+'%'; }
  function tickSilence(){ var f=$('silence-fill'); if(f) f.style.width=view.silence+'%'; }

  return { render:render, tickMeter:tickMeter, tickSilence:tickSilence };
})();
