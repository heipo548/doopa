/*
 * ui.js — Battle 11 の描画（盤面＋操作）。ロジックは持たない。
 * view.mode で「いま どのマスが押せるか」を切り替える。
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

  function renderStatus(){
    var z=state.shadow.zawameki, m=state.shadow.maxZawameki;
    $('zawameki-fill').style.width=Math.round((z/m)*100)+'%';
    $('zawameki-num').textContent='ざわめき '+z+'/'+m;
    var kpct=Math.round((state.player.kokoro/state.player.maxKokoro)*100);
    $('kokoro-fill').style.width=kpct+'%';
    $('kokoro-fill').className='bar-fill kokoro'+(state.player.kokoro<=2?' danger':'');
    $('kokoro-num').textContent='こころ '+state.player.kokoro+'/'+state.player.maxKokoro;
    $('turn-num').textContent='ターン '+state.turn+'/'+TURN_LIMIT+'　のこり行動 '+state.actionsLeft;
  }

  // 現在モードで (x,y) が押せる対象か
  function validTarget(x,y){
    if(state.result) return false;
    if(view.mode==='move') return Math.abs(x-state.player.x)+Math.abs(y-state.player.y)===1 && inBounds(x,y) && !isTree(x,y) && !isExit(x,y) && !(state.shadow.x===x&&state.shadow.y===y);
    if(view.mode==='word'||view.mode==='mark') return nearL(x,y) && canPlace(x,y);
    return false;
  }

  function renderBoard(){
    var box=$('board'); clear(box);
    for(var y=0;y<GRID;y++){
      for(var x=0;x<GRID;x++){
        (function(cx,cy){
          var cell=document.createElement('button');
          var cls='cell';
          if(isTree(cx,cy)) cls+=' tree';
          if(isBench(cx,cy)) cls+=' bench';
          if(isExit(cx,cy)) cls+=' exit';
          if(isPuddle(cx,cy)) cls+=' puddle';
          if(state.danger[cx+','+cy]) cls+=' danger';
          var tgt=validTarget(cx,cy);
          if(tgt) cls+=' target';
          cell.className=cls;
          cell.disabled=!tgt;

          // 角の地形ラベル
          var feat='';
          if(isBench(cx,cy)) feat='ベンチ'; else if(isExit(cx,cy)) feat='出口';
          else if(isPuddle(cx,cy)) feat='水'; else if(isTree(cx,cy)) feat='木';
          if(feat){ var fl=document.createElement('span'); fl.className='feat'; fl.textContent=feat; cell.appendChild(fl); }

          // 中央：影 / L / タイル
          var glyph='', gcls='glyph';
          if(state.shadow.x===cx && state.shadow.y===cy){ glyph='影'; gcls+=' shadow'+(state.shadow.skipNext?' stop':''); }
          else if(state.player.x===cx && state.player.y===cy){ glyph='L'; gcls+=' lchar'; }
          else { var t=state.tiles[cx+','+cy];
            if(t){ if(t.type==='mark'){ glyph='•'; gcls+=' mark'; } else { var w=null; for(var i=0;i<WORDS.length;i++) if(WORDS[i].id===t.word) w=WORDS[i]; glyph=w?w.glyph:'?'; gcls+=' word'; } } }
          if(glyph){ var g=document.createElement('span'); g.className=gcls; g.textContent=glyph; cell.appendChild(g); }

          if(tgt) cell.onclick=function(){ Game.cellClick(cx,cy); };
          box.appendChild(cell);
        })(x,y);
      }
    }
  }

  function renderActions(){
    var area=$('actions'); clear(area);
    if(state.result) return;
    // モード中のバナー
    if(view.mode!=='idle'){
      var banner=document.createElement('div'); banner.className='mode-banner';
      banner.textContent = view.mode==='move' ? 'どこへ動く?（光ったマス）'
        : view.mode==='word' ? '「'+wordName(view.word)+'」をどこに置く?'
        : view.mode==='mark' ? 'しるしをどこに置く?' : '言葉を選んでください';
      area.appendChild(banner);
      if(view.mode==='pickword'){
        var wg=document.createElement('div'); wg.className='word-grid';
        for(var i=0;i<WORDS.length;i++){ (function(w){
          var b=document.createElement('button'); b.className='wordbtn';
          var nm=document.createElement('div'); nm.className='wb-name'; nm.textContent=w.glyph+'　'+w.name;
          var ds=document.createElement('div'); ds.className='wb-desc'; ds.textContent=w.desc;
          b.appendChild(nm); b.appendChild(ds); b.onclick=function(){ Game.pickWord(w.id); }; wg.appendChild(b);
        })(WORDS[i]); }
        area.appendChild(wg);
      }
      var cancel=document.createElement('button'); cancel.className='act cancel'; cancel.textContent='やめる';
      cancel.onclick=function(){ Game.cancel(); }; area.appendChild(cancel);
      return;
    }
    // 通常：行動メニュー（各ボタンに id を付与＝おすすめ手のハイライト用）
    var row=document.createElement('div'); row.className='act-row';
    row.appendChild(actBtn('移動', function(){ Game.beginMove(); }, 'act-move'));
    row.appendChild(actBtn('ことばを置く', function(){ Game.beginWord(); }, 'act-word'));
    row.appendChild(actBtn('しるしを置く', function(){ Game.beginMark(); }, 'act-mark'));
    row.appendChild(actBtn('きく', function(){ Game.listen(); }, 'act-listen'));
    row.appendChild(actBtn('まつ（ターン終了）', function(){ Game.endTurn(); }, 'act-wait'));
    area.appendChild(row);
  }
  function actBtn(label,fn,id){ var b=document.createElement('button'); b.className='act'; if(id) b.id=id; b.textContent=label; b.disabled=!!state.result; if(!state.result) b.onclick=fn; return b; }
  function wordName(id){ for(var i=0;i<WORDS.length;i++) if(WORDS[i].id===id) return WORDS[i].name; return ''; }

  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){ var blk=state.log[i]; var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j])); box.appendChild(div); }
    box.scrollTop=box.scrollHeight;
  }
  function renderOverlay(){
    var ov=$('overlay'); if(!state.result){ ov.classList.remove('show'); return; }
    var win=state.result==='win';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    $('overlay-title').textContent = state.endKind==='memory' ? '——' : (win?WIN_TITLE:LOSE_TITLE);
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

  function render(){ renderStatus(); renderBoard(); renderActions(); renderLog(); renderOverlay(); }
  return { render:render };
})();
