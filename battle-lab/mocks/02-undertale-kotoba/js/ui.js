/*
 * ui.js — 画面描画（DOM と canvas はここだけが触る）
 *
 * engine.js の `state` と bullet.js の `field` を読んで画面に反映するだけ。
 * ロジックは持たない。ボタンのクリックは main.js の Game.* を呼ぶ（配線は main.js）。
 */

var UI = (function () {

  function $(id) { return document.getElementById(id); }

  var openCat = null;       // いま開いている親コマンド（null＝親の一覧）
  var dialogueLines = [];   // 会話欄に出す行
  var canvas = null, ctx = null;

  // バー(残量)を % で表す。0除算を避ける
  function pct(cur, max) {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
  }

  /* ───────────── 説明文（ページ上部） ───────────── */
  function renderHowto() {
    var box = $('howto');
    box.innerHTML = '';
    for (var i = 0; i < LORE.howto.length; i++) {
      var p = document.createElement('p');
      p.textContent = LORE.howto[i];
      box.appendChild(p);
    }
  }

  /* ───────────── 相手（村長） ───────────── */
  function renderEnemy() {
    var en = state.enemy;
    $('enemy-name').textContent = en.name;
    $('enemy-title').textContent = en.title || '';

    $('und-num').textContent = en.understanding + ' / ' + BALANCE.understandingMax;
    $('und-fill').style.width = pct(en.understanding, BALANCE.understandingMax) + '%';
    $('war-num').textContent = en.wariness + ' / ' + BALANCE.warinessMax;
    $('war-fill').style.width = pct(en.wariness, BALANCE.warinessMax) + '%';

    $('heart-text').textContent = closedHeartText(en.understanding);

    // 次の感情（予告）
    var f = $('emotion-forecast');
    f.textContent = en.emotion ? en.emotion.name : '—';
  }

  /* ───────────── プレイヤー（L） ───────────── */
  function renderPlayer() {
    var p = state.player;
    $('noise-num').textContent = p.noise + ' / ' + p.maxNoise;
    $('noise-fill').style.width = pct(p.noise, p.maxNoise) + '%';
  }

  /* ───────────── 会話欄 ───────────── */
  function setDialogue(lines) {
    dialogueLines = lines ? lines.slice() : [];
    renderDialogue();
  }
  function renderDialogue() {
    var box = $('dialogue');
    box.innerHTML = '';
    for (var i = 0; i < dialogueLines.length; i++) {
      var line = document.createElement('div');
      // 主人公Lのセリフ（"L" で始まる行）は無機質＝等幅にする
      var isL = (dialogueLines[i].charAt(0) === 'L');
      line.className = 'd-line' + (isL ? ' is-L' : '');
      line.textContent = dialogueLines[i];
      box.appendChild(line);
    }
  }

  /* ───────────── コマンド選択 UI ───────────── */
  function openCategory(catId) { openCat = catId; renderCommands(); }
  function closeCategory() { openCat = null; renderCommands(); }

  // option の効果を短い文にする（ボタンに出す）
  function effectText(opt) {
    var e = opt.effect || {};
    var parts = [];
    if (typeof e.und === 'number') parts.push('理解' + (e.und >= 0 ? '+' : '') + e.und);
    if (typeof e.war === 'number') parts.push('警戒' + (e.war >= 0 ? '+' : '') + e.war);
    if (typeof e.heal === 'number') parts.push('耐性+' + e.heal);
    if (e.unlock === 'shinpai') parts.push('「心配している」を覚える');
    if (e.slowNext) parts.push('次のノイズを遅く');
    if (e.guardNext) parts.push('次の被ダメ軽減');
    if (e.win) parts.push('理解80以上で勝利');
    return parts.join(' / ');
  }

  function renderCommands() {
    // 親コマンドの一覧
    var cats = $('cmd-cats');
    cats.innerHTML = '';
    for (var c = 0; c < COMMAND_TREE.length; c++) {
      (function (cat) {
        var btn = document.createElement('button');
        btn.className = 'cmd-cat';
        var name = document.createElement('div'); name.className = 'c-name'; name.textContent = cat.label;
        var hint = document.createElement('div'); hint.className = 'c-hint'; hint.textContent = cat.hint;
        btn.appendChild(name); btn.appendChild(hint);
        btn.onclick = function () { Game.openCategory(cat.id); };
        cats.appendChild(btn);
      })(COMMAND_TREE[c]);
    }

    // サブ選択肢（親が開かれているときだけ）
    var subs = $('cmd-subs');
    subs.innerHTML = '';
    if (!openCat) { subs.className = 'cmd-subs empty'; return; }
    subs.className = 'cmd-subs';

    var cat = null;
    for (var k = 0; k < COMMAND_TREE.length; k++) if (COMMAND_TREE[k].id === openCat) cat = COMMAND_TREE[k];
    if (!cat) { subs.className = 'cmd-subs empty'; return; }

    var head = document.createElement('div'); head.className = 'cmd-subhead';
    var label = document.createElement('span'); label.className = 'sub-cat'; label.textContent = cat.label + ' — どの言葉？';
    var back = document.createElement('button'); back.className = 'cmd-back'; back.textContent = '← もどる';
    back.onclick = function () { Game.closeCategory(); };
    head.appendChild(label); head.appendChild(back);
    subs.appendChild(head);

    var grid = document.createElement('div'); grid.className = 'sub-grid';
    for (var o = 0; o < cat.options.length; o++) {
      var opt = cat.options[o];
      if (!isOptionVisible(opt)) continue; // 心配している は まねる前は出さない
      grid.appendChild(makeOptionButton(opt));
    }
    subs.appendChild(grid);
  }

  function makeOptionButton(opt) {
    var isHodoku = !!(opt.effect && opt.effect.win);
    var enabled = isOptionEnabled(opt);
    var ready = isHodoku && state.enemy.understanding >= BALANCE.winThreshold;

    var btn = document.createElement('button');
    btn.className = 'cmd-opt'
      + (isHodoku ? ' is-hodoku' : '')
      + (ready ? ' ready' : '')
      + (enabled ? '' : ' locked');
    btn.disabled = !enabled;

    var name = document.createElement('div'); name.className = 'o-name'; name.textContent = opt.name;
    btn.appendChild(name);

    var eff = document.createElement('div'); eff.className = 'o-eff'; eff.textContent = effectText(opt);
    btn.appendChild(eff);

    // ほどく が まだ早いときは、注記を出す（押すと“失敗テキスト”は返る）
    if (isHodoku && !ready) {
      var hint = document.createElement('div'); hint.className = 'o-hint';
      hint.textContent = opt.lockedHint || '';
      btn.appendChild(hint);
    }

    if (enabled) btn.onclick = function () { Game.choose(opt.id); };
    return btn;
  }

  /* ───────────── パネル切り替え（コマンド ⇔ 弾よけ） ───────────── */
  function showPhase(phase) {
    var cmd = $('command-panel');
    var dodge = $('dodge-panel');
    if (phase === 'dodge') { cmd.hidden = true; dodge.hidden = false; }
    else { cmd.hidden = false; dodge.hidden = true; }
  }

  /* ───────────── 弾よけフェーズの描画 ───────────── */
  function initCanvas() {
    canvas = $('dodge-canvas');
    ctx = canvas.getContext('2d');
    $('dodge-help').textContent = LORE.dodgeHelp;
    return canvas;
  }

  function setDodgeEmotion(emotion) {
    $('dodge-emotion').textContent = emotion ? emotion.line : '';
  }

  function renderDodgeFrame(field) {
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 記憶のかけら（◇）：淡く光らせる＝“触れていい言葉”
    for (var s = 0; s < field.shards.length; s++) {
      var sh = field.shards[s];
      ctx.save();
      ctx.shadowColor = '#7bb5c4'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#5fa0b4';
      ctx.font = 'bold 20px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sh.glyph, sh.x, sh.y);
      ctx.restore();
    }

    // 避ける弾（？！）
    for (var b = 0; b < field.bullets.length; b++) {
      var bl = field.bullets[b];
      ctx.fillStyle = (bl.cls === 'n-anger') ? '#d96a78' : '#7d8aa8';
      ctx.font = 'bold ' + (bl.cls === 'n-anger' ? 24 : 21) + 'px -apple-system, "Hiragino Sans", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bl.glyph, bl.x, bl.y);
    }

    // プレイヤー（こころ）。被弾直後は点滅させて無敵を分かりやすく
    var blink = (field.invuln > 0) && (Math.floor(field.t * 16) % 2 === 0);
    if (!blink) drawHeart(field.player.x, field.player.y, field.player.r, field.hitFlash > 0);
  }

  // 小さな「こころ」を描く（無機質な青緑。被弾時は白く光る）
  function drawHeart(x, y, r, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = flash ? '#ffffff' : '#3fa6ac';
    ctx.strokeStyle = '#2b7e84'; ctx.lineWidth = 1.5;
    var s = r * 1.15;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.7);
    ctx.bezierCurveTo(s, -s * 0.2, s * 0.5, -s, 0, -s * 0.35);
    ctx.bezierCurveTo(-s * 0.5, -s, -s, -s * 0.2, 0, s * 0.7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function setDodgeTimer(remainSec) {
    $('dodge-timer').textContent = 'のこり ' + remainSec.toFixed(1) + 's';
  }

  /* ───────────── ログ ───────────── */
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

  /* ───────────── 勝敗オーバーレイ ───────────── */
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

  /* ───────────── まとめ描画（コマンドフェーズ用） ───────────── */
  function render() {
    renderEnemy();
    renderPlayer();
    renderDialogue();
    renderCommands();
    renderLog();
    renderOverlay();
    showPhase(state.phase);
  }

  // 公開API
  return {
    render: render, renderHowto: renderHowto,
    setDialogue: setDialogue, openCategory: openCategory, closeCategory: closeCategory,
    showPhase: showPhase, initCanvas: initCanvas, setDodgeEmotion: setDodgeEmotion,
    renderDodgeFrame: renderDodgeFrame, setDodgeTimer: setDodgeTimer,
    renderLog: renderLog, renderEnemy: renderEnemy, renderPlayer: renderPlayer,
    renderOverlay: renderOverlay, getOpenCat: function () { return openCat; }
  };
})();
