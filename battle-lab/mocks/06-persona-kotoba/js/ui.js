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

  /* ───────── 相手（村長の影） ───────── */
  function renderEnemy() {
    var en = state.enemy;
    var mask = MASKS[en.maskId];
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';
    $('mask-name').textContent = mask.name;
    $('mask-state').textContent = en.kuzure ? '心崩れ' : mask.state;

    $('enemy-heart-num').textContent = en.heart + ' / ' + en.maxHeart;
    $('enemy-heart-fill').style.width = pct(en.heart, en.maxHeart) + '%';

    // ほころび／こわばり：開示済みのタイプだけ出す（未開示は ？？？）
    fillReveal($('reveal-weak'), 'weak');
    fillReveal($('reveal-resist'), 'resist');

    // 仮面ごとの色味・心崩れ・本音 を カードのクラスで表現
    var card = $('enemy-card');
    card.className = 'enemy-card mask-' + en.maskId + (en.kuzure ? ' is-kuzure' : '');
  }

  // 指定カテゴリ（weak/resist）で開示済みのタイプ名を並べる
  function fillReveal(box, category) {
    box.innerHTML = '';
    var found = [];
    for (var t in state.enemy.revealed) {
      if (!state.enemy.revealed.hasOwnProperty(t)) continue;
      if (state.enemy.revealed[t] === category) found.push(t);
    }
    if (found.length === 0) {
      var unk = document.createElement('span');
      unk.className = 'unknown';
      unk.textContent = '？？？';
      box.appendChild(unk);
      return;
    }
    for (var i = 0; i < found.length; i++) {
      var chip = document.createElement('span');
      chip.className = 'type-chip ' + category;
      chip.textContent = WORD_TYPES[found[i]] || found[i];
      box.appendChild(chip);
    }
  }

  /* ───────── プレイヤー（L） ───────── */
  function renderPlayer() {
    var p = state.player;
    $('player-noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('player-noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';
    $('player-kokoro-num').textContent = p.kokoro + ' / ' + p.maxKokoro;
    $('player-kokoro-fill').style.width = pct(p.kokoro, p.maxKokoro) + '%';
    $('player-image').textContent = p.imageName;

    // 状態：迷い／命中低下／受容。何も無ければ「なし」
    var box = $('player-status');
    box.innerHTML = '';
    if (p.juyou > 0) box.appendChild(chip('juyou', '受容 ' + p.juyou));
    if (p.mayoi > 0) box.appendChild(chip('mayoi', '迷い ' + p.mayoi));
    if (p.meichuDown > 0) box.appendChild(chip('meichu', '命中低下 ' + p.meichuDown));
    if (box.children.length === 0) box.appendChild(chip('none', '状態：なし'));
  }

  function chip(kind, label) {
    var el = document.createElement('span');
    el.className = 'chip chip-' + kind;
    el.textContent = label;
    return el;
  }

  /* ───────── 行動エリア（言葉技・コマンド・対話） ───────── */
  function renderActions() {
    var zone = document.querySelector('.action-zone');
    var inDialogue = !!state.dialogue;
    var canAct = (state.phase === 'player' || state.phase === 'oneMore') && !state.result && !inDialogue;

    // もう一言／対話 のモードをクラスで切り替え
    zone.className = 'action-zone'
      + (state.phase === 'oneMore' && !state.result ? ' is-onemore' : '')
      + (inDialogue ? ' is-dialogue' : '');

    // 状況メモ
    var note = $('phase-note');
    if (state.result) note.textContent = '——';
    else if (inDialogue) note.textContent = 'たずねる言葉を選んでください。';
    else if (state.phase === 'enemy') note.textContent = '村長の番…';
    else if (state.phase === 'oneMore') note.textContent = '弱点を突いた！ もう一度だけ言える（言葉技 / 対話 / 総鳴り）。';
    else note.textContent = 'あなたの番。言葉を選んでください。';

    renderSkills(canAct);
    renderCommands(canAct);
    renderDialogue();
  }

  function renderSkills(canAct) {
    var box = $('skills');
    box.innerHTML = '';
    for (var i = 0; i < SKILL_ORDER.length; i++) {
      box.appendChild(makeSkill(SKILLS[SKILL_ORDER[i]], canAct));
    }
  }

  function makeSkill(skill, canAct) {
    var affordable = canAct && skill.cost <= state.player.kokoro;
    var btn = document.createElement('button');

    // 開示済みなら 弱点/耐性を ふちで匂わせる
    var hint = '';
    var revealed = state.enemy.revealed;
    var anyWeak = false, anyResist = false;
    for (var k = 0; k < skill.types.length; k++) {
      var c = revealed[skill.types[k]];
      if (c === 'weak') anyWeak = true;
      else if (c === 'resist') anyResist = true;
    }
    if (anyWeak) hint = ' is-weak';
    else if (anyResist) hint = ' is-resist';

    btn.className = 'skill' + hint + (affordable ? '' : ' disabled');
    btn.disabled = !affordable;

    var head = document.createElement('div');
    head.className = 'skill-head';
    var name = document.createElement('span');
    name.className = 'skill-name';
    name.textContent = skill.name;
    var cost = document.createElement('span');
    cost.className = 'skill-cost';
    cost.textContent = 'こころ ' + skill.cost;
    head.appendChild(name);
    head.appendChild(cost);

    var type = document.createElement('span');
    type.className = 'skill-type';
    type.textContent = skill.types.map(function (t) { return WORD_TYPES[t] || t; }).join(' / ');

    var eff = document.createElement('div');
    eff.className = 'skill-eff';
    eff.textContent = effText(skill);

    var note = document.createElement('div');
    note.className = 'skill-note';
    note.textContent = skill.text;

    btn.appendChild(head);
    btn.appendChild(type);
    btn.appendChild(eff);
    btn.appendChild(note);

    if (affordable) btn.onclick = function () { Game.playSkill(skill.id); };
    return btn;
  }

  // 言葉技の効果を、数値入りの短い文にする
  function effText(skill) {
    var parts = [];
    if (skill.damageOnlyOnWeak) parts.push('弱点なら閉じた心に ' + skill.power);
    else if (skill.power) parts.push('閉じた心に ' + skill.power);
    if (skill.condDmg) parts.push(MASKS[skill.condDmg.mask].name + 'に追加 ' + skill.condDmg.amount);
    if (skill.block) parts.push('受容 +' + skill.block);
    if (skill.selfHeal) parts.push('ノイズ耐性 +' + skill.selfHeal);
    if (skill.selfNoise) parts.push('反動 −' + skill.selfNoise);
    if (skill.weakenNext) parts.push(skill.weakenNext <= 0.3 ? '相手の次を大きく弱める' : '相手の次を弱める');
    if (skill.changeMask) parts.push('仮面を揺らす(' + Math.round(skill.changeMask.p * 100) + '%)');
    if (skill.hintHonne) parts.push('本音ヒント');
    if (skill.hit < 100) parts.push('命中 ' + skill.hit);
    return parts.join(' / ');
  }

  function renderCommands(canAct) {
    var talkReady = canAct && canTalk();
    var sounariReady = canAct && state.enemy.kuzure;

    var u = $('cmd-uketomeru');
    u.disabled = !canAct;

    var t = $('cmd-taiwa');
    t.disabled = !talkReady;
    t.className = 'cmd cmd-taiwa' + (talkReady ? ' ready' : '');

    var s = $('cmd-sounari');
    s.disabled = !sounariReady;
    s.className = 'cmd cmd-sounari' + (sounariReady ? ' ready' : '');
  }

  function renderDialogue() {
    if (!state.dialogue) return;
    var set = DIALOGUES[state.dialogue];
    $('dialogue-prompt').textContent = set.prompt;
    var box = $('dialogue-choices');
    box.innerHTML = '';
    for (var i = 0; i < set.choices.length; i++) {
      box.appendChild(makeChoice(set.choices[i], i));
    }
  }

  function makeChoice(choice, index) {
    var btn = document.createElement('button');
    btn.className = 'dlg-choice';
    var num = document.createElement('span');
    num.className = 'num';
    num.textContent = (index + 1) + '.';
    btn.appendChild(num);
    btn.appendChild(document.createTextNode(choice.text));
    btn.onclick = function () { Game.chooseDialogue(index); };
    return btn;
  }

  /* ───────── ログ（手応えのある行は色を強める） ───────── */
  function renderLog() {
    var log = $('log');
    log.innerHTML = '';
    for (var i = 0; i < state.log.length; i++) {
      var line = document.createElement('div');
      var text = state.log[i];
      line.className = 'log-line' + logClass(text);
      line.textContent = text;
      log.appendChild(line);
    }
    log.scrollTop = log.scrollHeight;
  }

  function logClass(text) {
    if (text === '') return ' blank';
    if (text.indexOf('ほころびに届いた') >= 0) return ' hit-weak';
    if (text.indexOf('心が崩れた') >= 0) return ' kuzure';
    if (text.indexOf('もう一言') >= 0) return ' onemore';
    if (text.indexOf('一斉に鳴った') >= 0 || text.indexOf('ひとつの音') >= 0) return ' sounari';
    if (text.indexOf('あなたの番') >= 0) return ' turn';
    if (text.indexOf('村長「') >= 0 || text.indexOf('L「') >= 0) return ' serif';
    return '';
  }

  /* ───────── 勝敗オーバーレイ ───────── */
  function renderOverlay() {
    var ov = $('overlay');
    if (!state.result) { ov.classList.remove('show'); return; }

    var isWin = (state.result === 'win');
    var title = $('overlay-title');
    title.textContent = isWin ? '本音に、とどいた' : 'ばらばらに なった';
    title.className = 'overlay-title ' + state.result;

    var body = $('overlay-text');
    body.innerHTML = '';
    var lines = isWin ? WIN_TEXT : LOSE_TEXT;
    for (var i = 0; i < lines.length; i++) {
      var p = document.createElement('p');
      if (lines[i] === '') { p.className = 'blank'; }
      else { p.textContent = lines[i]; }
      body.appendChild(p);
    }

    var reward = $('overlay-reward');
    reward.innerHTML = '';
    if (isWin) {
      var rt = document.createElement('div');
      rt.className = 'rw-title';
      rt.textContent = '🜂 ' + WIN_REWARD.title;
      var rd = document.createElement('div');
      rd.className = 'rw-desc';
      rd.textContent = WIN_REWARD.desc;
      reward.appendChild(rt);
      reward.appendChild(rd);
      reward.style.display = '';
    } else {
      reward.style.display = 'none';
    }

    ov.classList.add('show');
  }

  function render() {
    renderEnemy();
    renderPlayer();
    renderActions();
    renderLog();
    renderOverlay();
  }

  return { render: render };
})();
