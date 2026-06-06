/*
 * ui.js — 画面描画（DOMはここだけが触る）
 *
 * engine.js の `state` を読んで HTML に反映するだけ。ロジックは持たない。
 * ボタンやカードのクリックは main.js の Game.* を呼ぶ（配線は main.js）。
 */

var UI = (function () {

  function $(id) { return document.getElementById(id); }

  // バー(残量)を % で表す。0除算を避ける
  function pct(cur, max) {
    if (max <= 0) return 0;
    var p = Math.round((cur / max) * 100);
    return Math.max(0, Math.min(100, p));
  }

  // 状態異常チップ（受容/迷い/ほころび）を作る
  function statusChip(key, value) {
    var def = STATUS_DEFS[key];
    var el = document.createElement('span');
    el.className = 'chip chip-' + key;
    el.title = def ? def.desc : key;
    el.textContent = (def ? def.name : key) + ' ' + value;
    return el;
  }

  function renderEnemy() {
    var en = state.enemy;
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';
    $('enemy-heart-num').textContent = en.heart + ' / ' + en.maxHeart;
    $('enemy-heart-fill').style.width = pct(en.heart, en.maxHeart) + '%';

    // 相手の状態異常（ほころび）
    var box = $('enemy-status');
    box.innerHTML = '';
    if (en.hokorobi > 0) box.appendChild(statusChip('hokorobi', en.hokorobi));

    // 次の感情（行動予告）
    var move = en.intent;
    var label = $('intent-label');
    var detail = $('intent-detail');
    if (move) {
      if (move.kind === 'attack') {
        var n = intentNoise(move);
        label.textContent = move.name + '（ノイズ ' + n + (move.applyPlayer ? ' ＋ 迷い' : '') + '）';
        label.className = 'intent-name intent-attack';
      } else {
        label.textContent = move.name + '（ためている）';
        label.className = 'intent-name intent-charge';
      }
      detail.textContent = move.intent || '';
    }
  }

  function renderPlayer() {
    var p = state.player;
    $('player-noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('player-noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';

    // こころ（エナジー）を pip で表現：使った分は薄く
    var pips = $('energy-pips');
    pips.innerHTML = '';
    for (var i = 0; i < BALANCE.energyPerTurn; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip' + (i < state.energy ? ' on' : '');
      pips.appendChild(pip);
    }
    $('energy-num').textContent = state.energy + ' / ' + BALANCE.energyPerTurn;

    // プレイヤーの状態異常（受容・迷い）
    var box = $('player-status');
    box.innerHTML = '';
    if (p.juyou > 0) box.appendChild(statusChip('juyou', p.juyou));
    if (p.mayoi > 0) box.appendChild(statusChip('mayoi', p.mayoi));
  }

  function renderPiles() {
    $('pile-draw').textContent = state.drawPile.length;
    $('pile-discard').textContent = state.discard.length;
    $('turn-num').textContent = state.turn;
  }

  // 1枚のカード要素を作る
  function makeCard(inst) {
    var def = CARD_LIBRARY[inst.defId];
    var affordable = def.cost <= state.energy && state.phase === 'player' && !state.result;

    var card = document.createElement('button');
    card.className = 'card type-' + def.type + (affordable ? '' : ' disabled');
    card.disabled = !affordable;

    var cost = document.createElement('span');
    cost.className = 'card-cost';
    cost.textContent = def.cost;
    cost.title = LORE.termEnergy + ' を ' + def.cost + ' 使う';

    var type = document.createElement('span');
    type.className = 'card-type';
    type.textContent = CARD_TYPES[def.type] ? CARD_TYPES[def.type].label : def.type;

    var name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = def.name;

    var eff = document.createElement('div');
    eff.className = 'card-eff';
    eff.textContent = effectText(def);

    var note = document.createElement('div');
    note.className = 'card-note';
    note.textContent = def.text;

    card.appendChild(cost);
    card.appendChild(type);
    card.appendChild(name);
    card.appendChild(eff);
    card.appendChild(note);

    if (affordable) {
      card.onclick = function () { Game.playCard(inst.uid); };
    }
    return card;
  }

  // カードの効果を、数値入りの短い文にする
  function effectText(def) {
    var e = def.effect || {};
    var parts = [];
    if (e.damage) parts.push('閉じた心に ' + e.damage);
    if (e.block) parts.push('受容 +' + e.block);
    if (e.draw) parts.push('言葉を ' + e.draw + '枚引く');
    if (e.applyEnemy && e.applyEnemy.hokorobi) parts.push('相手にほころび+' + e.applyEnemy.hokorobi);
    if (e.discardRandom) parts.push('手札を ' + e.discardRandom + '枚 捨てる');
    return parts.join(' / ');
  }

  function renderHand() {
    var hand = $('hand');
    hand.innerHTML = '';
    for (var i = 0; i < state.hand.length; i++) {
      hand.appendChild(makeCard(state.hand[i]));
    }
    if (state.hand.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'hand-empty';
      empty.textContent = '（いま いえる言葉が ない）';
      hand.appendChild(empty);
    }
  }

  function renderLog() {
    var log = $('log');
    log.innerHTML = '';
    // 新しいものが下に来るよう、そのままの順で追記
    for (var i = 0; i < state.log.length; i++) {
      var line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = state.log[i];
      log.appendChild(line);
    }
    log.scrollTop = log.scrollHeight;
  }

  function renderControls() {
    var btn = $('end-turn-btn');
    var inPlayer = (state.phase === 'player' && !state.result);
    btn.disabled = !inPlayer;
    btn.textContent = inPlayer ? 'ターン終了' : '相手の番…';
  }

  // 勝敗オーバーレイ
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
    renderPiles();
    renderHand();
    renderLog();
    renderControls();
    renderOverlay();
  }

  return { render: render };
})();
