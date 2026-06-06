/*
 * ui.js — Battle 10 の描画（state を読んで DOM を組む）。ロジックは持たない。
 */
var UI = (function(){
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('L「')===0) p.className='ln l';
    p.textContent=text; return p;
  }
  // 状態 → CSSクラス
  function stClass(p){ if(p.hurt) return 'hurt'; if(p.resolved) return 'undone'; return ['closed','shaking','loosening'][p.idx]; }

  function renderStatus(){
    $('enemy-name').textContent=state.enemy.name;
    var z=zawameki(), m=maxZawameki();
    $('zawameki-fill').style.width=Math.round((z/m)*100)+'%';
    $('zawameki-num').textContent=z+' / '+m;
    var kpct=Math.round((state.player.kokoro/state.player.maxKokoro)*100);
    $('kokoro-fill').style.width=kpct+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=3?' danger':'');
    $('kokoro-num').textContent=state.player.kokoro+' / '+state.player.maxKokoro;
  }

  function renderParts(){
    var box=$('parts'); clear(box);
    for(var i=0;i<state.parts.length;i++){
      (function(p){
        var def=partDef(p.id);
        var b=document.createElement('button');
        b.className='part '+stClass(p)+(state.selected===p.id?' sel':'');
        b.disabled=!!state.result;
        var nm=document.createElement('div'); nm.className='part-name'; nm.textContent=p.name;
        var stt=document.createElement('div'); stt.className='part-state'; stt.textContent='【'+stateName(p)+'】';
        var ds=document.createElement('div'); ds.className='part-desc'; ds.textContent=def.desc;
        b.appendChild(nm); b.appendChild(stt); b.appendChild(ds);
        if(!state.result) b.onclick=function(){ Game.select(p.id); };
        box.appendChild(b);
      })(state.parts[i]);
    }
  }

  function renderCommands(){
    var area=$('cmd-area'); clear(area);
    var sel = state.selected ? partState(state.selected) : null;
    var canAct = !state.result && sel && !sel.resolved;
    var hdr=document.createElement('div'); hdr.className='cmd-hdr';
    hdr.textContent = sel ? ('選択中：'+sel.name+'（'+stateName(sel)+'）') : '部位を1つ選んでください。';
    area.appendChild(hdr);
    var grid=document.createElement('div'); grid.className='cmd-grid';
    for(var i=0;i<COMMANDS.length;i++){
      (function(c){
        var b=document.createElement('button'); b.className='cmd'+(c.id==='fuujiru'?' seal':'');
        b.disabled=!canAct;
        var nm=document.createElement('span'); nm.className='cmd-name'; nm.textContent=c.name;
        var hint=document.createElement('div'); hint.className='cmd-hint'; hint.textContent=c.hint;
        b.appendChild(nm); b.appendChild(hint);
        if(canAct) b.onclick=function(){ Game.act(c.id); };
        grid.appendChild(b);
      })(COMMANDS[i]);
    }
    area.appendChild(grid);
  }

  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){ var blk=state.log[i]; var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j])); box.appendChild(div); }
    box.scrollTop=box.scrollHeight;
  }

  function renderOverlay(){
    var ov=$('overlay');
    if(!state.result){ ov.classList.remove('show'); return; }
    var win=state.result==='win';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    $('overlay-title').textContent = win?WIN_TITLE:LOSE_TITLE;
    var body=$('overlay-text'); clear(body);
    var text=(state.result==='lose')?LOSE_TEXT[state.endKind]:WIN_TEXT[state.endKind];
    for(var i=0;i<text.length;i++) body.appendChild(lineEl(text[i]));
    ov.classList.add('show');
  }

  function render(){ renderStatus(); renderParts(); renderCommands(); renderLog(); renderOverlay(); }
  return { render:render };
})();
