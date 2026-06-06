/*
 * ui.js — 画面の描画だけを担当（状態 state を読んで DOM を組み立て直す）
 *
 * ロジックは持たない。クリックされたら main.js 経由の Game.* を呼ぶだけ。
 * テキストは自分たちのデータなので createElement + textContent で安全に組む
 * （HTML文字列を埋め込まない＝崩れ・差し込み事故を防ぐ）。
 */

var UI = (function () {

  // よく使う取得を短く
  function $(id) { return document.getElementById(id); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  // 1行を <p> にする。話者で色を分けられるよう、頭文字でクラスを付ける。
  function lineEl(text) {
    var p = document.createElement('p');
    p.className = 'ln';
    if (text === '') { p.className = 'ln blank'; p.innerHTML = '&nbsp;'; return p; }
    if (text.indexOf('L「') === 0) p.className = 'ln l';        // L（無機質）の発話
    else if (text.indexOf('村長「') === 0) p.className = 'ln sonchou'; // 村長の発話
    p.textContent = text;
    return p;
  }

  /* ───────── 上部ステータス（相手・閉じた心・ノイズ耐性）───────── */
  function renderStatus() {
    $('enemy-name').textContent = state.enemy.name;
    $('heart-bar').textContent = heartBar();
    $('heart-num').textContent = state.enemy.heart + ' / ' + state.enemy.maxHeart;
    $('noise-num').textContent = state.player.noise + ' / ' + state.player.maxNoise;
    // ノイズ耐性バーの塗り（割合）。0に近づくほど短くなる。
    var pct = Math.round((state.player.noise / state.player.maxNoise) * 100);
    $('noise-fill').style.width = pct + '%';
    $('noise-fill').className = 'bar-fill noise' + (state.player.noise <= 1 ? ' danger' : '');
  }

  /* ───────── 証言（発話ログ）と発言の選択 ───────── */
  function renderTestimony() {
    var st = currentStage();
    $('testimony-title').textContent = '証言：「' + st.title + '」';

    var box = $('statements');
    clear(box);
    var lines = visibleLines();
    for (var i = 0; i < lines.length; i++) {
      (function (ln, idx) {
        var b = document.createElement('button');
        b.className = 'stmt';
        if (state.selected === ln.id) b.className += ' sel';        // 選択中
        if (state.mode === 'present') b.className += ' target';     // 突きつけ先として強調
        b.disabled = !!state.result;

        var num = document.createElement('span');
        num.className = 'stmt-num';
        num.textContent = (idx + 1);
        var txt = document.createElement('span');
        txt.className = 'stmt-text';
        txt.textContent = ln.text;
        b.appendChild(num);
        b.appendChild(txt);

        b.onclick = function () { Game.selectLine(ln.id); };
        box.appendChild(b);
      })(lines[i], i);
    }

    // 「選択中の発言」表示
    var selBox = $('selected-line');
    if (state.selected) {
      var n = indexOfVisible(state.selected);
      var sel = findLine(state.selected);
      selBox.textContent = '選択中の発言：' + (n + 1) + '. ' + sel.text;
      selBox.classList.remove('empty');
    } else {
      selBox.textContent = '発言を1つ選んでください。';
      selBox.classList.add('empty');
    }
  }

  // 表示中リストでの並び順（番号表示用）
  function indexOfVisible(id) {
    var lines = visibleLines();
    for (var i = 0; i < lines.length; i++) if (lines[i].id === id) return i;
    return -1;
  }

  /* ───────── コマンド（たずねる / つきつける / 考える）───────── */
  function renderCommands() {
    var area = $('cmd-area');
    clear(area);
    var hasSel = !!state.selected && !state.result;

    if (state.mode === 'present') {
      // 突きつけ待ち：どの発言に突きつけるかを示すバナー＋やめる
      var banner = document.createElement('div');
      banner.className = 'present-banner';
      var sel = findLine(state.selected);
      banner.textContent = '「' + sel.text + '」に、何を突きつける？（下から選ぶ）';
      area.appendChild(banner);

      var cancel = document.createElement('button');
      cancel.className = 'cmd cancel';
      cancel.textContent = 'やめる';
      cancel.onclick = function () { Game.cancelPresent(); };
      area.appendChild(cancel);
      return;
    }

    // 通常：3つのコマンド
    area.appendChild(cmdBtn('たずねる', hasSel, function () { Game.ask(); }, 'たずねる：選んだ発言を、もう一歩聞く'));
    area.appendChild(cmdBtn('つきつける', hasSel, function () { Game.beginPresent(); }, 'つきつける：記憶のかけら／言葉を突きつける'));
    area.appendChild(cmdBtn('考える', !state.result, function () { Game.think(); }, '考える：いまの論点を整理する'));
  }

  function cmdBtn(label, enabled, fn, title) {
    var b = document.createElement('button');
    b.className = 'cmd';
    b.textContent = label;
    b.disabled = !enabled;
    b.title = title || '';
    if (enabled) b.onclick = fn;
    return b;
  }

  /* ───────── 記憶のかけら・言葉（突きつけ候補）───────── */
  function renderInventory() {
    renderItemList($('memories'), MEMORIES, 'memory');
    renderItemList($('words'), WORDS, 'word');
  }

  function renderItemList(box, items, kind) {
    clear(box);
    var armed = (state.mode === 'present' && !state.result); // 突きつけ可能な状態か
    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var card = document.createElement('button');
        card.className = 'item ' + kind + (armed ? ' armed' : '');
        card.disabled = !armed;

        var nm = document.createElement('div');
        nm.className = 'item-name';
        nm.textContent = it.name;
        var ds = document.createElement('div');
        ds.className = 'item-desc';
        ds.textContent = it.desc;
        card.appendChild(nm);
        card.appendChild(ds);

        if (armed) card.onclick = function () { Game.present(kind, it.id); };
        box.appendChild(card);
      })(items[i]);
    }
  }

  /* ───────── ログ ───────── */
  function renderLog() {
    var box = $('log');
    clear(box);
    for (var i = 0; i < state.log.length; i++) {
      var blk = state.log[i];
      var div = document.createElement('div');
      div.className = 'log-block ' + blk.tone;
      for (var j = 0; j < blk.lines.length; j++) div.appendChild(lineEl(blk.lines[j]));
      box.appendChild(div);
    }
    // つねに最新を見せる
    box.scrollTop = box.scrollHeight;
  }

  /* ───────── 勝敗オーバーレイ ───────── */
  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }
    var win = state.result === 'win';
    $('overlay-box').className = 'overlay-box ' + (win ? 'win' : 'lose');
    $('overlay-title').textContent = win ? WIN_TITLE : LOSE_TITLE;

    var body = $('overlay-text');
    clear(body);
    var text = win ? WIN_TEXT : LOSE_TEXT;
    for (var i = 0; i < text.length; i++) body.appendChild(lineEl(text[i]));
    ov.classList.add('show');
  }

  /* ───────── まとめて描画 ───────── */
  function render() {
    renderStatus();
    renderTestimony();
    renderCommands();
    renderInventory();
    renderLog();
    renderOverlay();
  }

  return { render: render };
})();
