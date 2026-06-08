/*
 * ui.js — 画面描画（DOMはここだけが触る）
 *
 * engine.js の `state` を読んで HTML に反映するだけ。ロジックは持たない。
 * 方針：理解度・警戒度は“数値を前面に出さない”。バーと「ことば」で見せる（spec 10.2）。
 * ボタンのクリックは main.js の Game.* を呼ぶ（配線は main.js）。
 */
var UI = (function () {

  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function pct(cur, max) { if (max <= 0) return 0; return Math.max(0, Math.min(100, Math.round((cur / max) * 100))); }

  /* ── 相手の顔（インラインSVG・画像依存なし／かわいいが どこか不穏）── */
  var FACES = {
    // 泣いている子：ひざを抱えて うずくまる小さな子。涙ひとつぶ。
    child:
      '<svg viewBox="0 0 120 120" width="84" height="84" role="img">' +
      '<ellipse cx="60" cy="110" rx="26" ry="5" fill="#0000000f"/>' +
      '<path d="M34 96 q4 -34 26 -34 q22 0 26 34 z" fill="#cfe0f4" stroke="#a9c2e6" stroke-width="2"/>' +
      '<circle cx="60" cy="54" r="26" fill="#ffe9d6" stroke="#e9c3a0" stroke-width="2"/>' +
      '<path d="M40 40 q20 -14 40 0" fill="none" stroke="#caa07a" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M46 56 q4 4 8 0 M66 56 q4 4 8 0" fill="none" stroke="#5b4a36" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M53 68 q7 4 14 0" fill="none" stroke="#b07a64" stroke-width="2.6" stroke-linecap="round"/>' +
      '<circle cx="50" cy="64" r="2.4" fill="#8fb6e0"/>' +
      '<path d="M50 66 q-1 7 1 12" fill="none" stroke="#8fb6e0" stroke-width="2.2" stroke-linecap="round"/>' +
      '</svg>',
    // 門番：腕を組んだ立ち姿。眉は きりっと、でも目線は どこか外を気にする。
    gate:
      '<svg viewBox="0 0 120 120" width="84" height="84" role="img">' +
      '<ellipse cx="60" cy="112" rx="30" ry="5" fill="#0000000f"/>' +
      '<rect x="30" y="62" width="60" height="44" rx="12" fill="#d7cdbf" stroke="#bdae99" stroke-width="2"/>' +
      '<path d="M38 84 q22 -10 44 0" fill="none" stroke="#a8987f" stroke-width="3" stroke-linecap="round"/>' + /* 組んだ腕 */
      '<circle cx="60" cy="44" r="26" fill="#ffe2bf" stroke="#e6b27e" stroke-width="2"/>' +
      '<path d="M40 36 q8 -6 16 -1 M64 35 q8 -5 16 1" fill="none" stroke="#9c7a4e" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M44 46 q5 -2 10 0 M66 46 q5 -2 10 0" fill="none" stroke="#5b4a36" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M52 58 q8 2 16 0" fill="none" stroke="#a86b4a" stroke-width="3" stroke-linecap="round"/>' +
      '<ellipse cx="44" cy="52" rx="4" ry="2.4" fill="#f3a8a0" opacity=".5"/>' +
      '<ellipse cx="78" cy="52" rx="4" ry="2.4" fill="#f3a8a0" opacity=".5"/>' +
      '</svg>'
  };

  /* ── チップ（タイプ・状態）── */
  function chip(cls, label, title, color) {
    var c = el('span', 'chip ' + cls);
    c.textContent = label;
    if (title) c.title = title;
    if (color) { c.style.color = color; c.style.borderColor = color; }
    return c;
  }

  /* ── 相手ゾーン ── */
  function renderEnemy() {
    var en = state.enemy;
    $('enemy-face').innerHTML = FACES[en.face] || '';
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';

    // タイプ
    var tbox = $('enemy-types'); tbox.innerHTML = '';
    for (var i = 0; i < en.types.length; i++) {
      var t = ENEMY_TYPES[en.types[i]];
      if (t) tbox.appendChild(chip('chip-type', t.label, t.note, t.color));
    }

    // 状態（無ければ何も出さない＝静かさを保つ）
    var sbox = $('enemy-states'); sbox.innerHTML = '';
    for (var k = 0; k < en.states.length; k++) {
      var s = STATES[en.states[k]];
      if (s) sbox.appendChild(chip('chip-state', s.label, s.note, s.color));
    }

    // 様子（ターン開始時の観察文）。強がり中は“信用できない”印をそえる。
    var look = $('enemy-look');
    look.textContent = lookText();
    look.classList.toggle('untrust', hasState('bluff'));

    // 直前の反応（セリフ）
    var sp = $('enemy-speech');
    if (en.line) { sp.textContent = en.line; sp.style.display = ''; }
    else { sp.textContent = ''; sp.style.display = 'none'; }
  }

  /* ── ゲージ（数値は出さず ことばで）── */
  function renderGauges() {
    var en = state.enemy;
    $('und-fill').style.width = pct(state.understanding, en.goal) + '%';
    $('und-word').textContent = gaugeWord('understanding', state.understanding);

    $('alert-fill').style.width = pct(state.alert, en.alertCap) + '%';
    $('alert-word').textContent = gaugeWord('alert', state.alert);
    $('alert-fill').classList.toggle('high', state.alert >= 70);

    var cf = $('comp-fill');
    cf.style.width = pct(state.composure, BALANCE.composureMax) + '%';
    cf.classList.toggle('low', state.composure <= 24);
    $('comp-word').textContent = gaugeWord('composure', state.composure);

    $('goal-word').textContent = '目標：' + goalPhrase(en.id);
    $('turn-num').textContent = state.turn;
    $('turn-limit').textContent = en.turnLimit;
  }

  function goalPhrase(encId) {
    if (encId === 'naku_ko') return 'この子の さびしさを、分かってあげる';
    if (encId === 'gatekeeper') return '門番が、本音を 話せる ところまで';
    return '相手を 理解する';
  }

  /* ── 選択肢ボタン ── */
  // 余裕の使い方を“ことば”にする（数値は出さない）
  function costPhrase(c) {
    if (c.recover && (c.cost || 0) === 0) return '余裕が もどる';
    var cost = c.cost || 0;
    if (cost <= 6) return '余裕：すこし';
    if (cost <= 12) return '余裕：そこそこ';
    return '余裕：おおきく';
  }

  function makeChoiceButton(c, idx) {
    var cat = CATEGORIES[c.category] || { label: c.category, color: '#999', desc: '' };
    var btn = el('button', 'choice cat-' + c.category);
    btn.id = 'choice-' + idx;
    btn.setAttribute('data-cat', c.category);
    btn.setAttribute('data-role', c.role || '');
    btn.disabled = !!(state.phase !== 'player' || state.result);
    btn.style.borderLeftColor = cat.color;

    var head = el('div', 'choice-head');
    var badge = el('span', 'choice-cat');
    badge.textContent = cat.label;
    badge.style.background = cat.color;
    head.appendChild(badge);
    var cost = el('span', 'choice-cost');
    cost.textContent = costPhrase(c);
    head.appendChild(cost);

    var text = el('div', 'choice-text');
    text.textContent = c.text;

    btn.appendChild(head);
    btn.appendChild(text);
    btn.title = cat.desc;
    btn.onclick = function () { Game.choose(c.id); };
    return btn;
  }

  function renderChoices() {
    var box = $('choices'); box.innerHTML = '';
    for (var i = 0; i < state.choices.length; i++) {
      box.appendChild(makeChoiceButton(state.choices[i], i));
    }
  }

  /* ── ログ ── */
  function renderLog() {
    var log = $('log'); log.innerHTML = '';
    for (var i = 0; i < state.log.length; i++) {
      var line = el('div', 'log-line');
      var txt = state.log[i];
      if (txt.charAt(0) === '（') line.className += ' note';      // 補足
      else if (txt.indexOf('L：') === 0) line.className += ' me'; // 自分の言葉
      line.textContent = txt;
      log.appendChild(line);
    }
    log.scrollTop = log.scrollHeight;
  }

  /* ── 勝敗オーバーレイ（勝利時は報酬選択UIも）── */
  var OVERLAY_TITLE = {
    warmwin: '心の距離が、ちぢまった',
    win: '心が、すこし 開いた',
    reject: '相手は、背を向けた',
    surface: '表面だけの 会話で 終わった'
  };

  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }
    var enc = ENC ? ENC() : ENCOUNTERS[state.encounterId];

    var title = $('overlay-title');
    title.textContent = OVERLAY_TITLE[state.result] || '';
    var win = (state.result === 'win' || state.result === 'warmwin');
    title.className = 'overlay-title ' + (win ? 'win' : 'lose');
    $('overlay-box').className = 'overlay-box ' + (win ? 'win' : 'lose');

    // 本文
    var lines = enc.winText;
    if (state.result === 'warmwin') lines = enc.warmWinText || enc.winText;
    else if (state.result === 'reject') lines = enc.loseReject;
    else if (state.result === 'surface') lines = enc.loseSurface;

    var body = $('overlay-text'); body.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var p = el('p'); p.textContent = lines[i]; body.appendChild(p);
    }

    // 報酬（勝利時のみ：覚えられる ことば を1つ選ぶ。モックなので表示だけ）
    var reward = $('reward'); reward.innerHTML = '';
    if (win) {
      var cap = el('p', 'reward-cap');
      cap.textContent = 'L は、新しい ことばを ひとつ 覚えられそうだ。（モック：選んでも次戦には引き継ぎません）';
      reward.appendChild(cap);
      var row = el('div', 'reward-row');
      var words = rewardChoices();
      for (var r = 0; r < words.length; r++) {
        var w = words[r];
        var b = el('button', 'reward-btn cat-' + w.category);
        b.textContent = w.name;
        b.title = w.desc;
        b.style.borderLeftColor = (CATEGORIES[w.category] || {}).color || '#ccc';
        b.onclick = (function (word, capEl) {
          return function () {
            capEl.textContent = 'L は「' + word.name + '」に そっと 触れた。——ことばが ひとつ、世界に 増えた。';
          };
        })(w, cap);
        row.appendChild(b);
      }
      reward.appendChild(row);
    }

    // 「次の相手へ」ボタン：子に勝ったら門番をすすめる
    var nextBtn = $('next-enc-btn');
    if (win && state.encounterId === 'naku_ko') {
      nextBtn.style.display = '';
      nextBtn.textContent = '次の相手（門番）へ →';
      nextBtn.onclick = function () { Game.setEncounter('gatekeeper'); };
    } else {
      nextBtn.style.display = 'none';
    }

    ov.classList.add('show');
  }

  /* ── 相手切り替えボタンの active 表示 ── */
  function renderEncSelect() {
    var btns = document.querySelectorAll('.enc-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-enc') === state.encounterId);
    }
  }

  function render() {
    renderEnemy();
    renderGauges();
    renderChoices();
    renderLog();
    renderOverlay();
    renderEncSelect();
  }

  return { render: render };
})();
