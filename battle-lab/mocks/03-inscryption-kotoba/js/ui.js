/*
 * ui.js — 画面描画（DOM はここだけが触る）
 *
 * engine.js の `state` を読んで HTML に反映するだけ。ロジックは持たない。
 * クリック操作は main.js の Game.* を呼ぶ（配線は main.js）。
 *
 * 盤面は「予告 / 村長の声の道 / L の声の道」を 4列グリッドで縦に揃え、
 * 同じ列が「正面」同士になるようにしている（どの言葉が ぶつかるか 直感的に分かる）。
 */

var UI = (function () {

  function $(id) { return document.getElementById(id); }

  // バー残量を % で（0除算回避）
  function pct(cur, max) {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  // 性質バッジ（守る/のぞく/壁…）を作る
  function natureBadge(natureKey) {
    if (!natureKey) return null;
    var def = NATURE_DEFS[natureKey];
    var el = document.createElement('span');
    el.className = 'nature nature-' + natureKey;
    el.textContent = def ? def.name : natureKey;
    el.title = def ? def.desc : natureKey;
    return el;
  }

  /* ───────── 相手（村長）と残響 ───────── */
  function renderEnemy() {
    var en = state.enemy;
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';
    $('enemy-heart-num').textContent = en.heart + ' / ' + en.maxHeart;
    $('enemy-heart-fill').style.width = pct(en.heart, en.maxHeart) + '%';
    $('echo-num').textContent = state.echo;
  }

  /* ───────── プレイヤー（無機質な L） ───────── */
  function renderPlayer() {
    var p = state.player;
    $('player-noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('player-noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';
    $('echo-num2').textContent = state.echo;
  }

  /* ───────── 山札 / ターン / 捨て札 ───────── */
  function renderPiles() {
    $('pile-draw').textContent = state.drawPile.length;
    $('pile-discard').textContent = state.discard.length;
    $('turn-num').textContent = state.turn;
  }

  // 盤面の言霊カード（場に出た言葉）の見た目を作る
  function makeLemma(word, side) {
    var def = (side === 'p') ? CARD_LIBRARY[word.defId] : ENEMY_WORDS[word.defId];
    var el = document.createElement('div');
    el.className = 'lemma lemma-' + side + (def.nature ? ' has-nature' : '');

    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = def.name;
    el.appendChild(nm);

    var stat = document.createElement('div');
    stat.className = 'stat';
    // 届く力 ／ こわれにくさ（現在値）
    stat.innerHTML = '<span class="reach" title="届く力">▶' + def.reach + '</span>'
      + '<span class="dur" title="こわれにくさ">◆' + word.dur + '</span>';
    el.appendChild(stat);

    var nb = natureBadge(def.nature);
    if (nb) el.appendChild(nb);
    return el;
  }

  // 予告セル（村長が次に出す言葉）
  function makeIntentCell(defId) {
    var cell = document.createElement('div');
    cell.className = 'cell intent-cell';
    if (!defId) { cell.classList.add('empty'); cell.textContent = '—'; return cell; }
    var def = ENEMY_WORDS[defId];
    cell.classList.add('telegraph');
    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = def.name;
    var st = document.createElement('div');
    st.className = 'stat';
    st.innerHTML = '<span class="reach">▶' + def.reach + '</span><span class="dur">◆' + def.dur + '</span>';
    cell.appendChild(nm);
    cell.appendChild(st);
    var nb = natureBadge(def.nature);
    if (nb) cell.appendChild(nb);
    return cell;
  }

  // 盤面セル（村長の声の道 / L の声の道）
  function makeBoardCell(side, lane) {
    var row = (side === 'p') ? state.pBoard : state.eBoard;
    var word = row[lane];
    var cell = document.createElement('div');
    cell.className = 'cell board-cell board-' + side;
    var pend = state.pending;

    if (word) {
      cell.appendChild(makeLemma(word, side));
      // 供える対象：自分の盤面の言霊で、供えが必要な設置の途中なら選べる
      if (side === 'p' && pend && pend.need > 0) {
        var selected = pend.offerings.indexOf(word.uid) >= 0;
        cell.classList.add('offerable');
        if (selected) cell.classList.add('offering-selected');
        cell.onclick = function () { Game.toggleOffering(word.uid); };
      }
    } else {
      cell.classList.add('empty');
      var ph = document.createElement('span');
      ph.className = 'ph';
      ph.textContent = '・';
      cell.appendChild(ph);
      // 設置先：自分側の空きレーンで、供えが足りていれば「ここに置く」
      if (side === 'p' && pend && pend.offerings.length >= pend.need) {
        cell.classList.add('placeable');
        cell.onclick = function () { Game.placeAt(lane); };
      }
    }
    return cell;
  }

  // 3つのレーン行（予告 / 村長 / L）を描く
  function renderLanes() {
    var intentRow = $('intent-row');
    var enemyRow = $('enemy-row');
    var playerRow = $('player-row');
    intentRow.innerHTML = ''; enemyRow.innerHTML = ''; playerRow.innerHTML = '';
    for (var lane = 0; lane < state.lanes; lane++) {
      intentRow.appendChild(makeIntentCell(state.intent[lane]));
      enemyRow.appendChild(makeBoardCell('e', lane));
      playerRow.appendChild(makeBoardCell('p', lane));
    }
    // のぞく：さらに先の予告の「気配」
    var peek = $('deep-peek');
    if (state.deepPeek) {
      peek.textContent = 'さらに先の気配：「' + ENEMY_WORDS[state.deepPeek].name + '」…（変わることがある）';
      peek.classList.add('show');
    } else {
      peek.textContent = '';
      peek.classList.remove('show');
    }
  }

  // 手元の言葉（手札カード）を作る
  function makeHandCard(inst) {
    var def = CARD_LIBRARY[inst.defId];
    var card = document.createElement('button');
    var isEcho = (def.kind === 'echo');
    card.className = 'card' + (isEcho ? ' card-echo' : '') + (def.nature ? ' nat-' + def.nature : '');

    // 置けるか／使えるか の判定
    var playable;
    if (isEcho) {
      playable = (state.phase === 'player' && !state.result
        && state.echo >= def.echoCost && state.discard.length > 0);
    } else {
      var need = effectiveOffer(def);
      playable = (state.phase === 'player' && !state.result
        && hasEmptyLane() && ownBoardCount() >= need);
    }
    if (!playable) card.classList.add('disabled');
    if (state.pending && state.pending.uid === inst.uid) card.classList.add('selected');

    // コスト表示：供え言葉 or 残響
    var cost = document.createElement('span');
    cost.className = 'card-cost' + (isEcho ? ' cost-echo' : '');
    if (isEcho) {
      cost.textContent = '残響' + def.echoCost;
      cost.title = '残響を ' + def.echoCost + ' 使う';
    } else {
      var eff = effectiveOffer(def);
      cost.textContent = (eff > 0 ? '供え' + eff : '供え0');
      cost.title = (eff > 0 ? '場の言葉を ' + eff + 'つ 供える' : '供え言葉は いらない');
      if (eff > def.offer) cost.classList.add('cost-raised'); // 問い(重い)で上がっている
    }
    card.appendChild(cost);

    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = def.name;
    card.appendChild(nm);

    if (!isEcho) {
      var stat = document.createElement('div');
      stat.className = 'card-stat';
      stat.innerHTML = '<span class="reach" title="届く力">届く力 ' + def.reach + '</span>'
        + '<span class="dur" title="こわれにくさ">こわれにくさ ' + def.dur + '</span>';
      card.appendChild(stat);
      var nb = natureBadge(def.nature);
      if (nb) card.appendChild(nb);
    }

    var note = document.createElement('div');
    note.className = 'card-note';
    note.textContent = def.text;
    card.appendChild(note);

    card.onclick = function () { Game.clickHandCard(inst.uid); };
    return card;
  }

  function renderHand() {
    var hand = $('hand');
    hand.innerHTML = '';
    for (var i = 0; i < state.hand.length; i++) hand.appendChild(makeHandCard(state.hand[i]));
    if (state.hand.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'hand-empty';
      empty.textContent = '（いま 手元に 言葉が ない）';
      hand.appendChild(empty);
    }
  }

  // 操作ガイド（供える→置く の途中状態を 言葉で案内）
  function renderBanner() {
    var banner = $('action-banner');
    var cancel = $('cancel-btn');
    var pend = state.pending;
    if (!pend) {
      banner.textContent = (state.phase === 'player' && !state.result)
        ? '手元の言葉を 選ぶ → 必要なら 場の言葉を 供える → 空いた声の道に 置く'
        : '';
      banner.className = 'action-banner';
      cancel.style.display = 'none';
      return;
    }
    var def = CARD_LIBRARY[pend.defId];
    if (pend.need > 0 && pend.offerings.length < pend.need) {
      banner.textContent = '「' + def.name + '」を 置くために、場の自分の言葉を '
        + pend.need + 'つ 供える（' + pend.offerings.length + '/' + pend.need + '）— 言霊を クリック';
      banner.className = 'action-banner warn';
    } else {
      banner.textContent = '「' + def.name + '」を 置く声の道（空き）を 選ぶ';
      banner.className = 'action-banner go';
    }
    cancel.style.display = 'inline-block';
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
    log.scrollTop = log.scrollHeight;
  }

  function renderControls() {
    var btn = $('end-turn-btn');
    var inPlayer = (state.phase === 'player' && !state.result);
    btn.disabled = !inPlayer;
    btn.textContent = inPlayer ? 'ターン終了' : '声の道が 動いている…';
  }

  // ノイズ耐性が低いと、名前に淡いグリッチ（不穏ギミック③・視覚のみ）
  function renderGlitch() {
    var board = $('board');
    var low = state.player.noise <= state.player.maxNoise * 0.4;
    if (low) board.classList.add('low-noise'); else board.classList.remove('low-noise');
  }

  // 勝敗オーバーレイ
  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }
    var lines = (state.result === 'win') ? WIN_TEXT : LOSE_TEXT;
    var title = $('overlay-title');
    title.textContent = (state.result === 'win') ? '言葉が、届いた' : 'ばらばらに なった';
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
    renderLanes();
    renderHand();
    renderBanner();
    renderLog();
    renderControls();
    renderGlitch();
    renderOverlay();
  }

  return { render: render };
})();
