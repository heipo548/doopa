/*
 * tutor.js — 初見プレイヤー向けの共通チュートリアルUI（依存ゼロ）
 *
 * 提供するもの：
 *  ・常時表示の「目標」バー（main の先頭に差し込む）＋「あそびかた」「ことば(用語)」ボタン
 *  ・初回だけ出るステップ式チュートリアル（次へ / はじめる）。ハイライト連動可
 *  ・用語ヘルプ（クリックで開く一覧パネル）
 *  ・おすすめ行動ハイライト（Tutor.highlight(selector) / clearHighlight()）
 *
 * 使い方（main.js から1回）：
 *  Tutor.init({ objective:'目標：…', terms:[{term,desc}…], steps:[{title,body,highlight}…] });
 *  ゲーム中に Tutor.setObjective('目標：…') で目標を更新。
 *  おすすめ手は Tutor.highlight('セレクタ')、消すときは Tutor.clearHighlight()。
 */
var Tutor = (function () {
  var cfg = null, idx = 0;
  function $(id){ return document.getElementById(id); }
  function el(tag, cls){ var e=document.createElement(tag); if(cls) e.className=cls; return e; }
  function mainEl(){ return document.querySelector('main') || document.body; }

  function init(config) {
    cfg = config || {};
    buildBar();
    setObjective(cfg.objective || '');
    if (cfg.steps && cfg.steps.length) openSteps();
  }

  function buildBar() {
    if ($('tutor-bar')) return;
    var bar = el('div','tutor-bar'); bar.id='tutor-bar';
    var obj = el('div','tutor-objective'); obj.id='tutor-objective';
    var btns = el('div','tutor-bar-btns');
    var howto = el('button','tutor-mini'); howto.textContent='？あそびかた'; howto.onclick=openSteps;
    var words = el('button','tutor-mini'); words.textContent='？ことば'; words.onclick=openTerms;
    btns.appendChild(howto); btns.appendChild(words);
    bar.appendChild(obj); bar.appendChild(btns);
    var m = mainEl(); m.insertBefore(bar, m.firstChild);
  }

  function setObjective(text) {
    cfg && (cfg.objective = text);
    var o = $('tutor-objective'); if (o) o.textContent = text || '';
  }

  function openSteps() { if (!cfg.steps || !cfg.steps.length) return; idx = 0; showStep(); }
  function showStep() {
    var s = cfg.steps[idx];
    var ov = $('tutor-overlay') || (function(){ var o=el('div','tutor-overlay'); o.id='tutor-overlay'; document.body.appendChild(o); return o; })();
    ov.innerHTML = '';
    var card = el('div','tutor-card');
    var n = el('div','tutor-step-n'); n.textContent='あそびかた '+(idx+1)+' / '+cfg.steps.length;
    var t = el('h3','tutor-step-title'); t.textContent = s.title || '';
    var b = el('p','tutor-step-body'); b.textContent = s.body || '';
    var row = el('div','tutor-step-row');
    var skip = el('button','tutor-skip'); skip.textContent='とじる'; skip.onclick=closeSteps;
    var next = el('button','tutor-next'); next.textContent=(idx>=cfg.steps.length-1)?'はじめる':'次へ'; next.onclick=nextStep;
    row.appendChild(skip); row.appendChild(next);
    card.appendChild(n); card.appendChild(t); card.appendChild(b); card.appendChild(row);
    ov.appendChild(card); ov.classList.add('show');
    clearHighlight(); if (s.highlight) highlight(s.highlight);
  }
  function nextStep() { if (idx >= cfg.steps.length - 1) { closeSteps(); return; } idx++; showStep(); }
  function closeSteps() {
    var ov = $('tutor-overlay'); if (ov) ov.classList.remove('show');
    clearHighlight();
    if (typeof recommend === 'function') { try { recommend(); } catch (e) {} }
  }

  function openTerms() {
    if (!cfg.terms || !cfg.terms.length) return;
    var ov = $('tutor-terms') || (function(){ var o=el('div','tutor-overlay'); o.id='tutor-terms'; document.body.appendChild(o); return o; })();
    ov.innerHTML = '';
    var card = el('div','tutor-card');
    var t = el('h3','tutor-step-title'); t.textContent='ことばの いみ';
    card.appendChild(t);
    var list = el('div','tutor-terms-list');
    for (var i=0;i<cfg.terms.length;i++){
      var it = el('div','tutor-term');
      var nm = el('span','tutor-term-name'); nm.textContent = cfg.terms[i].term;
      var ds = el('span','tutor-term-desc'); ds.textContent = cfg.terms[i].desc;
      it.appendChild(nm); it.appendChild(ds); list.appendChild(it);
    }
    card.appendChild(list);
    var row = el('div','tutor-step-row');
    var close = el('button','tutor-next'); close.textContent='とじる'; close.onclick=function(){ ov.classList.remove('show'); };
    row.appendChild(close); card.appendChild(row);
    ov.appendChild(card); ov.classList.add('show');
  }

  function highlight(selector) {
    try { var nodes = document.querySelectorAll(selector); for (var i=0;i<nodes.length;i++) nodes[i].classList.add('tutor-hi'); } catch (e) {}
  }
  function clearHighlight() {
    try { var nodes = document.querySelectorAll('.tutor-hi'); for (var i=0;i<nodes.length;i++) nodes[i].classList.remove('tutor-hi'); } catch (e) {}
  }

  return { init:init, setObjective:setObjective, openSteps:openSteps, openTerms:openTerms,
           highlight:highlight, clearHighlight:clearHighlight };
})();
