/* =========================================================================
   ui.js — 画面まわり全部：HUDの状態チップ／会話ウィンドウ（タイプ送り）／
   施策メニュー／ヘルプ／トースト／週送りの幕／エンディングカード。
   数値は出さず「状態名＋顔＋段階バー」で見せる、を徹底する。
   ========================================================================= */
const UI = (() => {
  const $ = id => document.getElementById(id);
  let E = {};
  let view = 'title';
  let sceneDraw = null;       // scene-canvas をどう描くか（main の描画ループが使う）
  let endingActive = false, endingKey = null, endingCtx = null;
  let prevStages = { mayoi: -1, nakama: -1, seken: -1 };

  // 会話の状態
  const dia = { active: false, lines: [], idx: 0, text: '', shown: 0, typing: false, onDone: null, timer: null, opts: {} };

  function init() {
    ['view-title', 'view-field', 'view-scene', 'btn-start', 'btn-continue',
      'hud-week', 'hud-distance', 'hud-help', 'hud-mute', 'state-bar', 'field-msg', 'field-label',
      'ov-dialogue', 'dia-face', 'dia-name', 'dia-text', 'dia-next', 'dia-choices',
      'ov-policy', 'policy-dept', 'policy-list', 'policy-close',
      'ov-help', 'help-close',
      'ov-ending', 'ending-canvas', 'ending-badge', 'ending-title', 'ending-body', 'ending-replay',
      'toast', 'curtain', 'curtain-text', 'scene-canvas', 'scene-caption']
      .forEach(id => { E[id] = $(id); });
    endingCtx = E['ending-canvas'].getContext('2d');

    // 会話送り（オーバーレイのどこをタップしても進む）
    E['ov-dialogue'].addEventListener('click', (e) => {
      if (e.target.closest('.dia-choice')) return; // 選択肢は別処理
      advance();
    });
    E['hud-help'].addEventListener('click', () => openHelp());
    E['hud-mute'].addEventListener('click', () => {
      const m = !SFX.isMuted(); SFX.setMuted(m);
      E['hud-mute'].textContent = m ? '🔇' : '🔊';
      if (!m) { SFX.init(); SFX.bgm('castle'); } // 解除時はBGMを戻す
    });
    E['help-close'].addEventListener('click', () => { E['ov-help'].classList.add('hidden'); SFX.play('cancel'); });
    E['policy-close'].addEventListener('click', () => { closePolicy(); });

    buildChips();
  }

  /* ── ビュー切替 ── */
  function show(v) {
    view = v;
    E['view-title'].classList.toggle('hidden', v !== 'title');
    E['view-field'].classList.toggle('hidden', v !== 'field');
    E['view-scene'].classList.toggle('hidden', v !== 'scene');
    document.body.dataset.scene = (v === 'title') ? 'title' : (v === 'scene' ? 'scene' : 'field');
  }
  function getView() { return view; }

  /* ── HUD：3つの状態チップ ── */
  function buildChips() {
    E['state-bar'].innerHTML = '';
    Object.keys(DATA.states).forEach(key => {
      const s = DATA.states[key];
      const chip = document.createElement('div');
      chip.className = 'state-chip ' + s.cls; chip.id = 'chip-' + key;
      chip.innerHTML =
        `<div class="chip-top"><canvas class="chip-face" width="20" height="20"></canvas>` +
        `<span class="chip-label">${s.icon} ${s.label}</span></div>` +
        `<div class="chip-state" id="chipstate-${key}"></div>` +
        `<div class="chip-pips">${'<span class="pip"></span>'.repeat(5)}</div>`;
      E['state-bar'].appendChild(chip);
    });
  }
  const repChar = { mayoi: 'leon', nakama: 'garud', seken: 'villager' };
  function renderHUD() {
    E['hud-week'].textContent = `第${State.turn}週`;
    E['hud-distance'].innerHTML = `勇者まで <b>${State.distance}</b>`;
    Object.keys(DATA.states).forEach(key => {
      const s = DATA.states[key]; const st = State.stage(key);
      $('chipstate-' + key).textContent = s.stages[st];
      const chip = $('chip-' + key);
      const pips = chip.querySelectorAll('.pip');
      pips.forEach((p, i) => p.classList.toggle('on', i <= st));
      const fc = chip.querySelector('.chip-face');
      const c = fc.getContext('2d'); c.clearRect(0, 0, 20, 20);
      Sprites.face(c, repChar[key], s.faces[st], 1, 2, 2);
      // 改善したらパルス＋キラッ
      if (prevStages[key] !== -1 && st > prevStages[key]) { chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse'); }
      prevStages[key] = st;
    });
  }
  function syncStages() { Object.keys(DATA.states).forEach(k => prevStages[k] = State.stage(k)); }

  /* ── フィールドの近接ラベル ── */
  function fieldLabel(thing) {
    if (!thing) { E['field-label'].classList.add('hidden'); return; }
    E['field-label'].textContent = thing.label + '　▶調べる';
    E['field-label'].classList.remove('hidden');
  }
  function fieldMsg(t) { E['field-msg'].textContent = t || ''; }

  /* ── トースト ── */
  let toastTimer = null;
  function toast(msg) {
    E['toast'].textContent = msg; E['toast'].classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => E['toast'].classList.remove('show'), 2600);
  }

  /* ── 週送りの幕（暗転トランジション） ── */
  function curtain(text, mid, done) {
    E['curtain-text'].textContent = text || '';
    E['curtain'].classList.remove('hidden');
    requestAnimationFrame(() => E['curtain'].classList.add('show'));
    setTimeout(() => { if (mid) mid(); }, 560);
    setTimeout(() => {
      E['curtain'].classList.remove('show');
      setTimeout(() => { E['curtain'].classList.add('hidden'); if (done) done(); }, 520);
    }, 1150);
  }

  /* ── 会話ウィンドウ（タイプ送り） ──
     lines: [{who, text, expr?}]、opts.onDone, opts.exprFor */
  function exprFor(who) {
    if (who === 'leon') return ['angry', 'neutral', 'think', 'sad', 'sad'][State.stage('mayoi')];
    if (who === 'garud') return State.stage('nakama') >= 3 ? 'mad' : 'neutral';
    if (who === 'miria') return State.flag('priest_shaken') ? 'think' : 'neutral';
    if (who === 'villager') return DATA.states.seken.faces[State.stage('seken')];
    if (who === 'maou') return 'neutral';
    return 'neutral';
  }
  function runDialogue(lines, onDone, opts) {
    dia.active = true; dia.lines = lines.slice(); dia.idx = -1; dia.onDone = onDone || null; dia.opts = opts || {};
    dia.choicesPending = false; // 前の会話の選択肢待ちフラグを必ずリセット（送れなくなる固まりを防ぐ）
    E['ov-dialogue'].classList.remove('hidden');
    E['dia-choices'].classList.add('hidden'); E['dia-choices'].innerHTML = '';
    nextLine();
  }
  function nextLine() {
    dia.idx++;
    if (dia.idx >= dia.lines.length) { endDialogue(); return; }
    const ln = dia.lines[dia.idx];
    const ch = DATA.chars[ln.who] || {};
    // ポートレート
    if (ch.narr || !ln.who) { E['dia-face'].parentElement.style.visibility = 'hidden'; E['dia-name'].textContent = ''; }
    else {
      E['dia-face'].parentElement.style.visibility = 'visible';
      Sprites.portrait(E['dia-face'], ln.who, ln.expr || exprFor(ln.who));
      E['dia-name'].textContent = ch.name || '';
    }
    // タイプ送り開始
    dia.text = ln.text; dia.shown = 0; dia.typing = true; E['dia-next'].classList.add('hidden');
    E['dia-text'].textContent = '';
    clearInterval(dia.timer);
    dia.timer = setInterval(() => {
      dia.shown++;
      E['dia-text'].textContent = dia.text.slice(0, dia.shown);
      if (dia.shown % 3 === 0) SFX.play('talk');
      if (dia.shown >= dia.text.length) { clearInterval(dia.timer); dia.typing = false; E['dia-next'].classList.remove('hidden'); maybeChoices(); }
    }, 22);
  }
  function advance() {
    if (!dia.active) return;
    if (dia.typing) { // 文字送り中なら全部表示
      clearInterval(dia.timer); dia.shown = dia.text.length; E['dia-text'].textContent = dia.text;
      dia.typing = false; E['dia-next'].classList.remove('hidden'); maybeChoices(); return;
    }
    if (dia.choicesPending) return; // 選択肢待ちは進めない
    SFX.play('select'); nextLine();
  }
  function maybeChoices() {
    // 最終行に選択肢がぶら下がっていれば出す
    if (dia.idx === dia.lines.length - 1 && dia.opts.choices) { showChoices(dia.opts.choices, dia.opts.onChoice); }
  }
  function endDialogue() {
    dia.active = false; clearInterval(dia.timer);
    E['ov-dialogue'].classList.add('hidden');
    const cb = dia.onDone; dia.onDone = null; if (cb) cb();
  }
  function showChoices(choices, onPick) {
    dia.choicesPending = true;
    E['dia-next'].classList.add('hidden');
    const box = E['dia-choices']; box.innerHTML = ''; box.classList.remove('hidden');
    choices.forEach(ch => {
      const b = document.createElement('button'); b.className = 'dia-choice';
      b.innerHTML = `${ch.label}` + (ch.hint ? `<span class="hint">${ch.hint}</span>` : '');
      b.addEventListener('click', () => {
        // 選んだら、いまの会話は終了（オーバーレイを閉じる）。
        // 続けて別の会話を出す場合は onPick 側が runDialogue で開き直す。
        dia.choicesPending = false; dia.active = false; clearInterval(dia.timer);
        box.classList.add('hidden'); box.innerHTML = '';
        E['ov-dialogue'].classList.add('hidden');
        SFX.play('confirm'); onPick(ch);
      });
      box.appendChild(b);
    });
  }
  function dialogueActive() { return dia.active; }

  /* ── 施策メニュー ── */
  let policyOnPick = null, policyOnClose = null;
  function openPolicy(dept, list, onPick, onClose) {
    policyOnPick = onPick; policyOnClose = onClose;
    E['policy-dept'].textContent = '🏛 ' + dept;
    const box = E['policy-list']; box.innerHTML = '';
    list.forEach(item => {
      const b = document.createElement('button');
      b.className = 'policy-item' + (item.locked ? ' locked' : '') + (item.spent ? ' spent' : '');
      const aimLabel = { yuusha: '勇者を揺らす', nakama: '仲間を崩す', seken: '世間を味方に', recon: '下準備' }[item.policy.aim];
      const aimCls = 'aim-' + item.policy.aim;
      b.innerHTML =
        `<div class="pi-title">${item.policy.title}` +
        (item.locked ? '' : `<span class="pi-aim ${aimCls}">${aimLabel}</span>`) + `</div>` +
        (item.locked ? `<div class="pi-desc">🔒 ${item.lockMsg || 'まだ解放されていない'}</div>`
          : `<div class="pi-desc">${item.policy.desc}</div>` +
            (item.policy.risk ? `<div class="pi-risk">⚠ ${item.policy.risk}</div>` : '') +
            (item.policy.tag ? `<div class="pi-tag">✦ ${item.policy.tag}</div>` : ''));
      if (!item.locked && !item.spent) {
        b.addEventListener('click', () => {
          SFX.play('confirm');
          const p = item.policy;
          const cb = policyOnPick;   // closePolicy が null 化する前に必ず退避（これを忘れると施策が実行されず固まる）
          closePolicy(true);
          if (cb) cb(p);
        });
      }
      box.appendChild(b);
    });
    E['ov-policy'].classList.remove('hidden');
    SFX.play('select');
  }
  function closePolicy(silent) {
    E['ov-policy'].classList.add('hidden');
    if (!silent) { SFX.play('cancel'); const cb = policyOnClose; if (cb) cb(); }
    policyOnPick = null; policyOnClose = null;
  }
  function policyOpen() { return !E['ov-policy'].classList.contains('hidden'); }

  /* ── ヘルプ ── */
  function openHelp() { E['ov-help'].classList.remove('hidden'); SFX.play('select'); }
  function helpOpen() { return !E['ov-help'].classList.contains('hidden'); }
  function closeHelp() { E['ov-help'].classList.add('hidden'); }

  /* ── 演出シーン（scene-canvas）の描画フックと字幕 ── */
  function setSceneDraw(fn) { sceneDraw = fn; }
  function getSceneDraw() { return sceneDraw; }
  function sceneCaption(t) { E['scene-caption'].textContent = t || ''; }

  /* ── エンディングカード ── */
  function showEnding(key, onReplay) {
    const e = DATA.endings[key];
    endingActive = true; endingKey = e.scene;
    E['ending-badge'].textContent = e.badge; E['ending-badge'].classList.toggle('bad', !e.good);
    E['ending-title'].textContent = e.title;
    E['ending-body'].innerHTML = e.body.replace(/\n/g, '<br>');
    // カードに good/bad を付け、入場アニメを毎回再生し直す
    const card = E['ov-ending'].querySelector('.ending-card');
    if (card) { card.classList.toggle('good', e.good); card.classList.toggle('bad', !e.good); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
    E['ov-ending'].classList.remove('hidden');
    document.body.dataset.scene = 'ending';
    E['ending-replay'].onclick = () => { endingActive = false; E['ov-ending'].classList.add('hidden'); SFX.play('select'); onReplay && onReplay(); };
    SFX.play(e.good ? 'win' : 'lose');
  }
  function drawEnding(t) { if (endingActive && endingKey) Sprites.ending(endingCtx, endingKey, t); }
  function endingShown() { return endingActive; }

  /* ── 何らかのオーバーレイが開いているか（フィールド入力を止める判定に使う） ── */
  function anyOverlay() { return dia.active || policyOpen() || helpOpen() || endingActive; }

  return {
    init, show, getView, renderHUD, syncStages, fieldLabel, fieldMsg, toast, curtain,
    runDialogue, advance, showChoices, dialogueActive,
    openPolicy, closePolicy, policyOpen, openHelp, helpOpen, closeHelp,
    setSceneDraw, getSceneDraw, sceneCaption, showEnding, drawEnding, endingShown, anyOverlay,
    get E() { return E; },
  };
})();
