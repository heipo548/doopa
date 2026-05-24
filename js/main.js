/* ============================================================
   main.js — 全体統括
   ・全刺激を登録
   ・スワイプ／キーボード操作
   ・刺激のライフサイクル管理（init → 完走 or skip → cleanup → 次へ）
   ・ドーパミンメーター、累計カウンタ、いいね/やだ処理
   ============================================================ */

(() => {
  // ----- 全刺激の登録（追加するときはここに足す）-----
  const STIMULI = [Balloon, Counter, Coin, Combo, Rare];
  const byId = Object.fromEntries(STIMULI.map(s => [s.id, s]));
  DoopaAlgo.register(STIMULI.map(s => s.id));

  // ----- DOM 参照 -----
  const startScreen = document.getElementById('start-screen');
  const startBtn = document.getElementById('start-btn');
  const app = document.getElementById('app');
  const card = document.getElementById('card-current');
  const cardNext = document.getElementById('card-next');
  const host = document.getElementById('stimulus-host');
  const labelEl = document.getElementById('stimulus-label');
  const dopFill = document.getElementById('dopamine-fill');
  const totalCountEl = document.getElementById('total-count');
  const likeBtn = document.getElementById('like-btn');
  const dislikeBtn = document.getElementById('dislike-btn');
  const shareBtn = document.getElementById('share-btn');

  // ----- 状態 -----
  let currentId = null;
  let currentCleanup = null;
  let currentStartAt = 0;
  let currentCompleted = false; // 自然に最後まで行ったか
  let dopamine = 0;             // 0〜100
  let total = 0;                // 累計消費刺激数
  let paused = false;
  let transitioning = false;    // 切替中の二重起動防止

  // ----- 開始処理 -----
  startBtn.addEventListener('click', () => {
    Effects.unlockAudio();
    startScreen.classList.add('hidden');
    app.classList.remove('hidden');
    next('forward'); // 最初の刺激
  });

  // ----- 刺激切替 -----
  function loadStimulus(stim) {
    currentId = stim.id;
    currentStartAt = performance.now();
    currentCompleted = false;
    labelEl.textContent = stim.label;
    currentCleanup = stim.init(host, {
      onDone: (result) => {
        currentCompleted = true;
        // 完走したら 0.7 秒後に自動で次へ
        setTimeout(() => {
          if (currentCompleted && !transitioning) next('forward', /*completed*/true);
        }, 700);
      },
      onDopamine: (amount) => addDopamine(amount),
    });
  }

  function unloadStimulus() {
    if (currentCleanup) { try { currentCleanup(); } catch(e) { console.warn(e); } }
    currentCleanup = null;
    host.innerHTML = '';
  }

  /**
   * 次／前の刺激へ遷移。
   * @param {'forward'|'back'} dir
   * @param {boolean} [naturalCompletion]
   */
  function next(dir = 'forward', naturalCompletion = false) {
    if (transitioning) return;
    transitioning = true;

    // 直前刺激のフィードバック
    if (currentId) {
      const elapsed = performance.now() - currentStartAt;
      let kind;
      if (naturalCompletion) kind = 'completed';
      else if (elapsed < 2000) kind = 'skipped-early';
      else kind = 'skipped';
      DoopaAlgo.feedback(currentId, kind);
      total++;
      totalCountEl.textContent = total;
    }

    // 切替音
    Effects.sfx.swipe();

    // アニメで現カードを送り出し、新カードを呼び込む
    const outClass = dir === 'forward' ? 'swipe-out-up' : 'swipe-out-down';
    const inClass  = dir === 'forward' ? 'swipe-in-up'  : 'swipe-in-down';

    card.classList.add(outClass);

    // アニメ後にホストを差し替え
    setTimeout(() => {
      unloadStimulus();
      card.classList.remove(outClass);
      card.classList.add(inClass);

      // 次の刺激を選んで init
      const nextId = DoopaAlgo.pickNext(STIMULI.map(s => s.id));
      const nextStim = byId[nextId] || STIMULI[0];
      loadStimulus(nextStim);

      setTimeout(() => {
        card.classList.remove(inClass);
        transitioning = false;
      }, 320);
    }, 320);
  }

  // ----- ドーパミンメーター -----
  function addDopamine(amount) {
    dopamine = Math.min(100, dopamine + amount);
    dopFill.style.width = dopamine + '%';
    if (dopamine >= 100) {
      // 満タンで派手にリセット
      Effects.flash('rgba(255,242,0,0.5)', 250);
      Effects.shake(app, 14, 400);
      Effects.toast('DOPAMINE OVERFLOW!!!', 'combo');
      Effects.sfx.boom();
      dopamine = 0;
      setTimeout(() => dopFill.style.width = '0%', 300);
    }
  }

  // 時間経過で少しずつ減る（ずっと放置だと下がる＝飽きの可視化）
  setInterval(() => {
    if (paused) return;
    if (dopamine > 0) {
      dopamine = Math.max(0, dopamine - 0.4);
      dopFill.style.width = dopamine + '%';
    }
  }, 500);

  // ----- いいね/やだ -----
  function like() {
    if (!currentId) return;
    DoopaAlgo.feedback(currentId, 'like');
    likeBtn.classList.remove('liked');
    void likeBtn.offsetWidth;
    likeBtn.classList.add('liked');
    Effects.sfx.like();
    Effects.toast('💖 LIKED', 'like');
    addDopamine(8);
    // ハートのパーティクル
    const r = likeBtn.getBoundingClientRect();
    Effects.burst(r.left + r.width/2, r.top + r.height/2,
      { count: 16, colors: ['#ff2bd6','#ff6fb5','#fff'], speed: 4, size: 4 });
  }
  function dislike() {
    if (!currentId) return;
    DoopaAlgo.feedback(currentId, 'dislike');
    dislikeBtn.classList.remove('disliked');
    void dislikeBtn.offsetWidth;
    dislikeBtn.classList.add('disliked');
    Effects.sfx.nope();
    Effects.toast('NOT FOR YOU', 'dislike');
    next('forward'); // やだはそのまま次へ
  }
  likeBtn.addEventListener('click', like);
  dislikeBtn.addEventListener('click', dislike);

  // シェア（雰囲気だけ）
  shareBtn.addEventListener('click', () => {
    Effects.sfx.coin();
    Effects.toast('SHARED (※雰囲気)', 'combo');
    addDopamine(3);
  });

  // ----- キーボード操作 -----
  window.addEventListener('keydown', (e) => {
    if (startScreen && !startScreen.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); next('forward'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); next('back'); }
    else if (e.key.toLowerCase() === 'l') { like(); }
    else if (e.key.toLowerCase() === 'd') { dislike(); }
    else if (e.code === 'Space') { e.preventDefault(); paused = !paused; Effects.toast(paused ? 'PAUSED' : 'RESUMED'); }
  });

  // ----- マウスドラッグでスワイプ -----
  // 刺激領域内のクリックを潰さないよう、card 全体ではなく "余白" でしか拾わない
  let dragStart = null;
  card.addEventListener('mousedown', (e) => {
    // 刺激の中身（タップ可能要素）に当たったらドラッグしない
    if (e.target.closest('.balloon, .counter-stage, .coin, .coin-cursor, .combo-stage, .rare-stage, .rare-card')) {
      return;
    }
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  window.addEventListener('mouseup', (e) => {
    if (!dragStart) return;
    const dy = e.clientY - dragStart.y;
    const dt = performance.now() - dragStart.t;
    dragStart = null;
    if (Math.abs(dy) < 60 || dt > 800) return;
    if (dy < 0) next('forward'); else next('back');
  });

  // マウスホイールでもスワイプ（トラックパッドのスクロール対応）
  let wheelLock = 0;
  window.addEventListener('wheel', (e) => {
    if (paused) return;
    const now = performance.now();
    if (now - wheelLock < 600) return;
    if (Math.abs(e.deltaY) < 30) return;
    wheelLock = now;
    if (e.deltaY > 0) next('forward'); else next('back');
  }, { passive: true });

  // ----- 全体右クリックメニュー封じ（ゲーム中の誤操作防止）-----
  app.addEventListener('contextmenu', e => e.preventDefault());

  // デバッグ用：window から重みを確認できる
  window.DOOPA_DEBUG = {
    snapshot: () => DoopaAlgo.snapshot(),
    history: () => DoopaAlgo.history,
  };
})();
