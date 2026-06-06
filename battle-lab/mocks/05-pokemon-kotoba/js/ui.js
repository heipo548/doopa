/*
 * ui.js — 画面描画（DOMはここだけが触る）
 *
 * engine.js の `state` を読んで HTML に反映するだけ。ロジックは持たない。
 * ボタンのクリックは main.js の Game.* を呼ぶ（配線は main.js）。
 */

var UI = (function () {

  function $(id) { return document.getElementById(id); }

  // バー(残量)を % で表す。0除算を避ける
  function pct(cur, max) {
    if (max <= 0) return 0;
    var p = Math.round((cur / max) * 100);
    return Math.max(0, Math.min(100, p));
  }

  // 状態異常チップ（受容/迷い/警戒/ほころび…）を作る
  function statusChip(key, value) {
    var def = STATUS_DEFS[key];
    var el = document.createElement('span');
    el.className = 'chip chip-' + key;
    el.title = def ? def.desc : key;
    el.textContent = (def ? def.name : key) + (value ? ' ' + value : '');
    return el;
  }

  /* ── 相手（村長）──────────────────────────── */
  function renderEnemy() {
    var en = state.enemy;
    var emo = EMOTION_TYPES[en.emotion] || { label: en.emotion, note: '', color: '#999' };

    // 感情タイプ（一番見やすく出す。色も感情ごとに変える）
    var label = $('enemy-emotion-label');
    label.textContent = emo.label;
    label.style.color = emo.color;
    label.style.borderColor = emo.color;
    $('enemy-emotion-note').textContent = emo.note;

    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';
    $('enemy-heart-num').textContent = en.heart + ' / ' + en.maxHeart;
    $('enemy-heart-fill').style.width = pct(en.heart, en.maxHeart) + '%';

    // 村長の状態（警戒・身がまえ・ほころび）
    var box = $('enemy-status');
    box.innerHTML = '';
    if (keikaiActive()) box.appendChild(statusChip('keikai', ''));
    if (en.guardNext) box.appendChild(statusChip('guard', ''));
    if (en.hokorobi > 0) box.appendChild(statusChip('hokorobi', en.hokorobi));
    if (box.children.length === 0) {
      var none = document.createElement('span');
      none.className = 'state-none';
      none.textContent = '状態：—';
      box.appendChild(none);
    }

    // 村長のセリフ
    $('enemy-speech').textContent = en.line || '';

    // 「いまの感情に効きやすい言葉」のヒント（相性表 good を出す）
    var hint = $('hint-types');
    hint.innerHTML = '';
    var m = MATCHUP[en.emotion];
    if (m) {
      for (var i = 0; i < m.good.length; i++) {
        var wt = WORD_TYPES[m.good[i]];
        var c = document.createElement('span');
        c.className = 'hint-type';
        c.textContent = wt ? wt.label : m.good[i];
        hint.appendChild(c);
      }
    } else {
      hint.textContent = '—';
    }
  }

  /* ── プレイヤー（L）──────────────────────── */
  function renderPlayer() {
    var p = state.player;
    $('player-noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('player-noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';
    $('player-juyou-num').textContent = p.juyou;

    var box = $('player-status');
    box.innerHTML = '';
    if (p.mayoi > 0) box.appendChild(statusChip('mayoi', p.mayoi));
    if (p.aimDownNext) box.appendChild(statusChip('aimdown', ''));
    if (p.mitigateNext > 0) box.appendChild(statusChip('shizuka', p.mitigateNext));
    if (box.children.length === 0) {
      var none = document.createElement('span');
      none.className = 'state-none';
      none.textContent = '状態：なし';
      box.appendChild(none);
    }
  }

  // 言葉技の効果を、数値入りの短い文にする
  function effectText(def) {
    var e = def.effect || {};
    var parts = [];
    if (e.damage) parts.push('閉じた心 -' + e.damage);
    if (e.selfJuyou) parts.push('受容 +' + e.selfJuyou);
    if (e.selfNoise) parts.push('耐性 +' + e.selfNoise);
    if (e.mitigateNext) parts.push('次ノイズ -' + e.mitigateNext);
    if (e.weakenEnemy) parts.push('相手の次を弱める');
    if (e.bonusVs) parts.push('特定の感情に 追加');
    if (e.changeEmotion) parts.push('感情を ゆさぶる');
    if (e.selfNoiseCost) parts.push('反動 -' + e.selfNoiseCost);
    return parts.join(' / ');
  }

  // 1つの言葉技ボタンを作る
  function makeMoveButton(inst) {
    var def = MOVE_LIBRARY[inst.id];
    var wt = WORD_TYPES[def.wordType] || { label: def.wordType };
    var usable = inst.pp > 0 && state.phase === 'player' && !state.result;

    var btn = document.createElement('button');
    btn.className = 'move wt-' + def.wordType + (usable ? '' : ' disabled');
    btn.disabled = !usable;

    var head = document.createElement('div');
    head.className = 'move-head';
    var name = document.createElement('span');
    name.className = 'move-name';
    name.textContent = def.name;
    var type = document.createElement('span');
    type.className = 'move-type';
    type.textContent = wt.label;
    head.appendChild(name);
    head.appendChild(type);

    var eff = document.createElement('div');
    eff.className = 'move-eff';
    eff.textContent = effectText(def);

    var meta = document.createElement('div');
    meta.className = 'move-meta';
    meta.innerHTML = '命中 <b>' + def.acc + '</b>　' +
      LORE.termPp + ' <b>' + inst.pp + '</b> / ' + inst.maxPp;

    btn.appendChild(head);
    btn.appendChild(eff);
    btn.appendChild(meta);
    btn.title = def.desc;

    if (usable) {
      btn.onclick = function () { Game.useMove(inst.id); };
    }
    return btn;
  }

  function renderMoves() {
    var box = $('moves');
    box.innerHTML = '';
    for (var i = 0; i < state.moves.length; i++) {
      box.appendChild(makeMoveButton(state.moves[i]));
    }
  }

  function renderTurn() {
    $('turn-num').textContent = state.turn;
    var phase = $('phase-label');
    if (state.result) phase.textContent = '——';
    else phase.textContent = (state.phase === 'player') ? 'Lの番' : '村長の番…';
  }

  function renderLog() {
    var log = $('log');
    log.innerHTML = '';
    for (var i = 0; i < state.log.length; i++) {
      var line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = state.log[i];
      log.appendChild(line);
    }
    log.scrollTop = log.scrollHeight; // 最新を見せる
  }

  /* ── 勝敗オーバーレイ（勝利時は報酬選択UIも出す）──────── */
  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }

    var lines = (state.result === 'win') ? WIN_TEXT : LOSE_TEXT;
    var title = $('overlay-title');
    title.textContent = (state.result === 'win') ? '閉じた心が、ほどけた' : 'ばらばらに なった';
    title.className = 'overlay-title ' + state.result;

    var body = $('overlay-text');
    body.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement('p');
      p.textContent = lines[i];
      body.appendChild(p);
    }

    // 勝利時だけ：報酬選択UI（今回は“表示だけ”。次戦には引き継がない）
    var reward = $('reward');
    reward.innerHTML = '';
    if (state.result === 'win') {
      var cap = document.createElement('p');
      cap.className = 'reward-cap';
      cap.textContent = 'Lは、新しい言葉をひとつ覚えられそうだ。（モック：選んでも次戦には引き継ぎません）';
      reward.appendChild(cap);
      var row = document.createElement('div');
      row.className = 'reward-row';
      for (var r = 0; r < REWARD_OPTIONS.length; r++) {
        var def = MOVE_LIBRARY[REWARD_OPTIONS[r]];
        var b = document.createElement('button');
        b.className = 'reward-btn wt-' + def.wordType;
        b.textContent = def.name;
        b.title = def.desc;
        b.onclick = (function (label) {
          return function () {
            cap.textContent = 'Lは「' + label + '」に そっと触れた。（※モックなので まだ覚えません）';
          };
        })(def.name);
        row.appendChild(b);
      }
      reward.appendChild(row);
    }

    ov.classList.add('show');
  }

  function render() {
    renderEnemy();
    renderPlayer();
    renderMoves();
    renderTurn();
    renderLog();
    renderOverlay();
  }

  return { render: render };
})();
