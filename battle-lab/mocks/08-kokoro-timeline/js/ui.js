/*
 * ui.js — Battle 08 の描画だけ（state を読んで DOM を組み直す）
 * ロジックは持たない。クリックされたら Game.* を呼ぶだけ。
 */
var UI = (function () {
  function $(id){ return document.getElementById(id); }
  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  // 1行を <p> に。L の発話は等幅で無機質に。
  function lineEl(text){
    var p=document.createElement('p'); p.className='ln';
    if(text===''){ p.className='ln blank'; p.innerHTML='&nbsp;'; return p; }
    if(text.indexOf('L「')===0) p.className='ln l';
    else if(text.indexOf('村長「')===0) p.className='ln sonchou';
    p.textContent=text; return p;
  }

  // バー塗り（割合）
  function setBar(fillId, numId, cur, max, dangerLow){
    var pct=Math.max(0,Math.round((cur/max)*100));
    $(fillId).style.width=pct+'%';
    if(dangerLow!=null) $(fillId).className=$(fillId).className.replace(/ danger/,'')+(cur<=dangerLow?' danger':'');
    if(numId) $(numId).textContent=cur+' / '+max;
  }
  // ●○ のピップ表示
  function pips(cur,max){ var s=''; for(var i=0;i<max;i++) s+=(i<cur?'●':'○'); return s; }

  /* 上部ステータス */
  function renderStatus(){
    $('enemy-name').textContent=state.enemy.name;
    setBar('zawameki-fill','zawameki-num',state.enemy.zawameki,state.enemy.maxZawameki);
    // 爆発ゲージ：満ちるほど危険
    var bpct=Math.round((state.enemy.bakuhatsu/state.enemy.maxBakuhatsu)*100);
    $('bakuhatsu-fill').style.width=bpct+'%';
    $('bakuhatsu-fill').className='bar-fill bakuhatsu'+(state.enemy.bakuhatsu>=state.enemy.maxBakuhatsu-2?' danger':'');
    $('bakuhatsu-num').textContent=bakuhatsuBar();
    setBar('kokoro-fill','kokoro-num',state.player.kokoro,state.player.maxKokoro,3);
    $('kotoba-pips').textContent=pips(state.player.kotoba,state.player.maxKotoba);
    $('ochitsuki-pips').textContent=pips(state.player.ochitsuki,state.player.maxOchitsuki);
  }

  /* タイムライン：現在 → 未来（村長の予定行動を先読み表示）*/
  function forecast(n){
    var out=[]; var idx=state.enemy.planIndex; var at=state.enemy.timer;
    for(var i=0;i<n;i++){
      var act=ENEMY_PLAN[idx];
      out.push({ name:act.name, at:at, id:act.id });
      idx=(idx+1)%ENEMY_PLAN.length;
      at+=ENEMY_PLAN[idx].interval;
    }
    return out;
  }
  function renderTimeline(){
    var box=$('timeline'); clear(box);
    var now=document.createElement('div'); now.className='tl-now';
    now.textContent='現在 t='+state.now; box.appendChild(now);
    var arrow=document.createElement('div'); arrow.className='tl-arrow'; arrow.textContent='→ 未来'; box.appendChild(arrow);
    var fc=forecast(4);
    for(var i=0;i<fc.length;i++){
      var d=document.createElement('div');
      d.className='tl-ev'+(fc[i].id==='hakushu'||fc[i].id==='secret'?' danger':'')+(i===0?' soon':'');
      var nm=document.createElement('span'); nm.className='tl-name'; nm.textContent='村長：'+fc[i].name;
      var at=document.createElement('span'); at.className='tl-at'; at.textContent='あと '+fc[i].at;
      d.appendChild(nm); d.appendChild(at); box.appendChild(d);
    }
  }

  /* コマンド */
  function renderCommands(){
    var area=$('cmd-area'); clear(area);
    for(var i=0;i<COMMANDS.length;i++){
      (function(c){
        var b=document.createElement('button'); b.className='cmd';
        var enabled = !state.result && state.player.kotoba>=c.cost;
        b.disabled=!enabled;
        var top=document.createElement('div'); top.className='cmd-top';
        var nm=document.createElement('span'); nm.className='cmd-name'; nm.textContent=c.name;
        var meta=document.createElement('span'); meta.className='cmd-meta';
        meta.textContent=(c.cast>1?('遅 cast'+c.cast):'早 cast'+c.cast)+' / ことば'+c.cost;
        top.appendChild(nm); top.appendChild(meta);
        var hint=document.createElement('div'); hint.className='cmd-hint'; hint.textContent=c.hint;
        b.appendChild(top); b.appendChild(hint);
        if(enabled) b.onclick=function(){ Game.choose(c.id); };
        area.appendChild(b);
      })(COMMANDS[i]);
    }
  }

  /* ログ */
  function renderLog(){
    var box=$('log'); clear(box);
    for(var i=0;i<state.log.length;i++){
      var blk=state.log[i];
      var div=document.createElement('div'); div.className='log-block '+blk.tone;
      for(var j=0;j<blk.lines.length;j++) div.appendChild(lineEl(blk.lines[j]));
      box.appendChild(div);
    }
    box.scrollTop=box.scrollHeight;
  }

  /* 勝敗オーバーレイ */
  function renderOverlay(){
    var ov=$('overlay');
    if(!state.result){ ov.classList.remove('show'); return; }
    var win = state.result==='win' || state.result==='special';
    $('overlay-box').className='overlay-box '+(win?'win':'lose');
    var title = state.result==='special' ? '——' : (win?WIN_TITLE:LOSE_TITLE);
    $('overlay-title').textContent=title;
    var body=$('overlay-text'); clear(body);
    var text = (state.result==='lose') ? LOSE_TEXT[state.endKind] : WIN_TEXT[state.endKind];
    for(var i=0;i<text.length;i++) body.appendChild(lineEl(text[i]));
    ov.classList.add('show');
  }

  function render(){ renderStatus(); renderTimeline(); renderCommands(); renderLog(); renderOverlay(); }
  return { render: render };
})();
