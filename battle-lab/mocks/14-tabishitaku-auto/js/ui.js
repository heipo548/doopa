/*
 * ui.js — Battle 14 の描画。prep（配置）と battle（半自動）で見せ方を変える。
 */
var UI = (function(){
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('Lは')===0||text.indexOf('L「')===0) p.className='ln l';
    p.textContent=text; return p;
  }

  function renderBag(){
    var box=$('bag'); clear(box);
    for(var i=0;i<9;i++){
      (function(cell){
        var b=document.createElement('button'); var cls='cell';
        if(cell===4) cls+=' center';
        var id=state.bag[cell];
        if(state.phase!=='prep'){
          if(state.fired.indexOf(cell)>=0) cls+=' fired';
          else if(state.queue[0]===cell) cls+=' next';
        }
        b.className=cls;
        if(id){ var it=itemDef(id); var g=document.createElement('span'); g.className='glyph '+it.kind; g.textContent=it.glyph;
          var nm=document.createElement('span'); nm.className='cellname'; nm.textContent=it.name; b.appendChild(g); b.appendChild(nm); }
        else { var e=document.createElement('span'); e.className='empty'; e.textContent=(cell===4?'中央':'＋'); b.appendChild(e); }
        // クリック挙動
        var clickable=false;
        if(state.phase==='prep'){ clickable=true; b.onclick=function(){ Game.bagClick(cell); }; }
        else if(state.phase==='battle' && view.intervene && id && state.queue.indexOf(cell)>=0){ clickable=true; b.onclick=function(){ Game.useCell(cell); }; cls+=' usable'; b.className=cls; }
        if(!clickable && state.phase!=='prep') b.disabled=true;
        box.appendChild(b);
      })(i);
    }
  }

  function renderPrep(){
    $('prep-area').style.display = (state.phase==='prep') ? '' : 'none';
    if(state.phase!=='prep') return;
    var tray=$('tray'); clear(tray);
    var av=available();
    for(var i=0;i<av.length;i++){
      (function(it){
        var b=document.createElement('button'); b.className='trayitem '+it.kind+(view.selectedItem===it.id?' sel':'');
        var g=document.createElement('span'); g.className='ti-glyph'; g.textContent=it.glyph;
        var nm=document.createElement('span'); nm.className='ti-name'; nm.textContent=it.name;
        var ds=document.createElement('span'); ds.className='ti-desc'; ds.textContent=it.desc;
        b.appendChild(g); b.appendChild(nm); b.appendChild(ds);
        b.onclick=function(){ Game.selectItem(it.id); };
        tray.appendChild(b);
      })(av[i]);
    }
    // シナジー・プレビュー（配置中でも確認できる）
    var sp=$('syn-preview'); clear(sp);
    var pairs=[['letter','photo','手紙＋写真：記憶開示'],['arigatou','letter','ありがとう＋手紙：最後の特別な言葉'],
      ['bread','daijoubu','パン＋だいじょうぶ：回復アップ'],['stone','branch','石＋枝：防御アップ'],['bell','blank','鈴＋空白：初回遅延']];
    var found=[];
    for(var j=0;j<pairs.length;j++) if(hasPair(pairs[j][0],pairs[j][1])) found.push(pairs[j][2]);
    if(state.bag[4]==='blank') found.push('空白を中央に：…空白エンド?');
    if(found.length){ var t=document.createElement('div'); t.className='syn-on'; t.textContent='いまのシナジー：'+found.join(' / '); sp.appendChild(t); }
    else { var t2=document.createElement('div'); t2.className='syn-off'; t2.textContent='（隣どうしの組み合わせで シナジーが出る）'; sp.appendChild(t2); }
    // 空のカバンでは「旅に出る」を押せないようにする
    var placed=0; for(var k=0;k<9;k++) if(state.bag[k]!==null) placed++;
    var sb=$('start-btn'); if(sb){ sb.disabled=(placed===0); sb.textContent = placed===0 ? 'カバンに 何か 詰めてね' : 'この支度で 旅に出る ▶'; }
  }

  function renderBattle(){
    var on=(state.phase==='battle'||state.phase==='done');
    $('battle-area').style.display = on ? '' : 'none';
    if(!on) return;
    $('zawameki-fill').style.width=Math.round((state.enemy.zawameki/state.enemy.maxZawameki)*100)+'%';
    $('zawameki-num').textContent=state.enemy.zawameki+' / '+state.enemy.maxZawameki;
    $('kokoro-fill').style.width=Math.round((state.player.kokoro/state.player.maxKokoro)*100)+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=2?' danger':'');
    $('kokoro-num').textContent=state.player.kokoro+' / '+state.player.maxKokoro;
    var ctrl=$('battle-controls'); clear(ctrl);
    if(state.phase==='battle'){
      var w=ctrlBtn('見守る（1つ進める）', function(){ Game.watch(); });
      if(view.intervene) w.disabled=true;   // 介入中は自動発動させない
      ctrl.appendChild(w);
      ctrl.appendChild(ctrlBtn(view.intervene?'…どれを使う?（カバンで選ぶ）':'ひとつ使う', function(){ Game.toggleIntervene(); }, view.intervene));
    }
  }
  function ctrlBtn(label,fn,active){ var b=document.createElement('button'); b.className='act'+(active?' active':''); b.textContent=label; b.onclick=fn; return b; }

  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){ var blk=state.log[i]; var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j])); box.appendChild(div); }
    box.scrollTop=box.scrollHeight;
  }
  function renderOverlay(){
    var ov=$('overlay'); if(state.phase!=='done'){ ov.classList.remove('show'); return; }
    var win=state.result==='win'||state.result==='special';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    $('overlay-title').textContent = state.result==='special' ? '——' : WIN_TITLE;
    var body=$('overlay-text'); clear(body);
    var text=WIN_TEXT[state.endKind]||[];
    for(var i=0;i<text.length;i++) body.appendChild(lineEl(text[i]));
    ov.classList.add('show');
  }

  function render(){ renderBag(); renderPrep(); renderBattle(); renderLog(); renderOverlay(); }
  return { render:render };
})();
