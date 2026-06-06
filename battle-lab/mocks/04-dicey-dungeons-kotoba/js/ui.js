/*
 * ui.js — 画面描画（DOMはここだけが触る）
 *
 * engine.js の `state` を読んで HTML に反映するだけ。ロジックは持たない。
 * 欠片や装置のクリックは main.js の Game.* を呼ぶ（配線は main.js）。
 * 「いま選んでいる欠片」は Game.getSelected() から読む（選択状態は main.js が持つ）。
 */

var UI = (function () {

  function $(id) { return document.getElementById(id); }

  // バー(残量)を % で表す。0除算を避ける
  function pct(cur, max) {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  /* ───────── 相手（村長） ───────── */
  function renderEnemy() {
    var en = state.enemy;
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';
    $('enemy-heart-num').textContent = en.heart + ' / ' + en.maxHeart;
    $('enemy-heart-fill').style.width = pct(en.heart, en.maxHeart) + '%';

    // 次の感情（行動予告）
    var move = en.intent;
    var label = $('intent-label');
    var detail = $('intent-detail');
    if (move) {
      if (move.charge) {
        label.textContent = move.name + '（ためている）';
        label.className = 'intent-name intent-charge';
      } else {
        var n = intentNoise(move);
        var extras = [];
        if (move.kasureNext) extras.push('かすれ');
        if (move.whiteNext) extras.push('白い欠片');
        label.textContent = move.name + '　' + n + 'ノイズ' + (extras.length ? '＋' + extras.join('＋') : '');
        label.className = 'intent-name intent-attack' + (n === 0 ? ' intent-soft' : '');
      }
      // \n を改行として出す
      detail.innerHTML = '';
      var parts = (move.line || '').split('\n');
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) detail.appendChild(document.createElement('br'));
        detail.appendChild(document.createTextNode(parts[i]));
      }
    }

    // 相手の状態（溜め）
    var box = $('enemy-status');
    box.innerHTML = '';
    if (en.charged) box.appendChild(chip('ためている', 'chip-charge', '次の ひと言が 強くなっている'));
  }

  /* ───────── プレイヤー（無機質な L） ───────── */
  function renderPlayer() {
    var p = state.player;
    $('player-noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('player-noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';
    $('block-num').textContent = p.juyou;

    // 乱れ／予兆チップ（次ターンに効くもの）
    var box = $('player-status');
    box.innerHTML = '';
    if (state.enemy.nextNoiseDown > 0) {
      box.appendChild(chip('やわらげ −' + state.enemy.nextNoiseDown, 'chip-soft', '次に受けるノイズが やわらぐ'));
    }
    if (state.nextBonusKakera > 0) {
      box.appendChild(chip('次ターン 欠片＋' + state.nextBonusKakera, 'chip-bonus', DISTURB_DEFS.bonus.desc));
    }
  }

  // 小さなチップ要素
  function chip(textStr, cls, title) {
    var el = document.createElement('span');
    el.className = 'chip ' + (cls || '');
    el.textContent = textStr;
    if (title) el.title = title;
    return el;
  }

  /* ───────── ことばの欠片（プール） ───────── */
  function renderKakera() {
    var box = $('kakera');
    box.innerHTML = '';
    var selected = Game.getSelected();
    var canPlay = (state.phase === 'player' && !state.result);

    for (var i = 0; i < state.pool.length; i++) {
      var k = state.pool[i];
      var el = document.createElement('button');
      el.className = 'kakera'
        + (k.white ? ' kakera-white' : '')
        + (k.kasure ? ' kakera-kasure' : '')
        + (selected === k.id ? ' selected' : '');
      el.disabled = !canPlay;

      var val = document.createElement('span');
      val.className = 'k-val';
      val.textContent = k.value;
      el.appendChild(val);

      var tag = document.createElement('span');
      tag.className = 'k-tag';
      tag.textContent = k.white ? '白' : (k.kasure ? 'かすれ' : '音');
      el.appendChild(tag);

      if (canPlay) {
        (function (id) { el.onclick = function () { Game.selectKakera(id); }; })(k.id);
      }
      box.appendChild(el);
    }

    if (state.pool.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'kakera-empty';
      empty.textContent = '（ことばの欠片は もう ない。ターンを 終えよう）';
      box.appendChild(empty);
    }
  }

  /* ───────── 言葉装置 ───────── */
  function renderDevices() {
    var box = $('devices');
    box.innerHTML = '';
    var selected = Game.getSelected();
    var selKakera = findPoolKakera(selected);
    var inPlayer = (state.phase === 'player' && !state.result);

    for (var i = 0; i < state.devices.length; i++) {
      var dev = state.devices[i];
      var def = DEVICE_BY_ID[dev.id];

      // いま選んでいる欠片を、この装置に入れられるか
      var fits = inPlayer && selKakera ? kakeraFits(selKakera, def, dev.loaded) : false;

      var card = document.createElement('div');
      card.className = 'device'
        + (def.optional ? ' device-opt' : '')
        + (fits ? ' fit' : '')
        + (selKakera && !fits ? ' nofit' : '')
        + (dev.loaded.length > 0 ? ' loading' : '');

      var name = document.createElement('div');
      name.className = 'd-name';
      name.textContent = def.name;
      if (def.capacity > 1) {
        var cap = document.createElement('span');
        cap.className = 'd-cap';
        cap.textContent = '×' + def.capacity;
        name.appendChild(cap);
      }
      card.appendChild(name);

      card.appendChild(line('d-cond', '条件：' + def.cond));
      card.appendChild(line('d-eff', '効果：' + def.eff));
      card.appendChild(line('d-note', def.text));

      // 装填中（ほんとう？ の途中）の表示
      if (dev.loaded.length > 0) {
        var slot = document.createElement('div');
        slot.className = 'd-slot';
        for (var s = 0; s < dev.loaded.length; s++) {
          var mini = document.createElement('span');
          mini.className = 'd-slot-k';
          mini.textContent = dev.loaded[s].white ? '白' : dev.loaded[s].value;
          slot.appendChild(mini);
        }
        var need = def.capacity - dev.loaded.length;
        if (need > 0) {
          var hint = document.createElement('span');
          hint.className = 'd-slot-hint';
          hint.textContent = 'あと' + need + 'つ（同じ音）';
          slot.appendChild(hint);
          var undo = document.createElement('button');
          undo.className = 'd-undo';
          undo.textContent = 'もどす';
          (function (id) { undo.onclick = function (ev) { ev.stopPropagation(); Game.unload(id); }; })(dev.id);
          slot.appendChild(undo);
        }
        card.appendChild(slot);
      }

      if (inPlayer) {
        (function (id) { card.onclick = function () { Game.loadInto(id); }; })(dev.id);
      }
      box.appendChild(card);
    }
  }

  function line(cls, str) {
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = str;
    return el;
  }

  function findPoolKakera(id) {
    if (!id) return null;
    for (var i = 0; i < state.pool.length; i++) {
      if (state.pool[i].id === id) return state.pool[i];
    }
    return null;
  }

  /* ───────── そのほか ───────── */
  function renderField() {
    $('turn-num').textContent = state.turn;
    // 一言メッセージ（入れられなかった等）。なければ操作ヒント
    var hint = $('hint');
    if (state.lastError) {
      hint.textContent = '⚠ ' + state.lastError;
      hint.className = 'hint warn';
    } else {
      hint.textContent = LORE.opHint;
      hint.className = 'hint';
    }
  }

  function renderLog() {
    var log = $('log');
    log.innerHTML = '';
    for (var i = 0; i < state.log.length; i++) {
      var l = document.createElement('div');
      l.className = 'log-line';
      l.textContent = state.log[i];
      log.appendChild(l);
    }
    log.scrollTop = log.scrollHeight;
  }

  function renderControls() {
    var btn = $('end-turn-btn');
    var inPlayer = (state.phase === 'player' && !state.result);
    btn.disabled = !inPlayer;
    btn.textContent = inPlayer ? 'ターン終了' : '相手の番…';
  }

  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }
    var lines = (state.result === 'win') ? WIN_TEXT : LOSE_TEXT;
    var title = $('overlay-title');
    title.textContent = (state.result === 'win') ? 'ほどけた' : 'ばらばらに なった';
    title.className = 'overlay-title ' + state.result;
    var body = $('overlay-text');
    body.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement('p');
      p.textContent = lines[i];
      body.appendChild(p);
    }
    ov.classList.add('show');
  }

  function render() {
    renderEnemy();
    renderPlayer();
    renderKakera();
    renderDevices();
    renderField();
    renderLog();
    renderControls();
    renderOverlay();
  }

  return { render: render };
})();
