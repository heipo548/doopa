/* ============================================================
   effects.js
   ・パーティクル（Canvas で爆発エフェクト）
   ・効果音（Web Audio API でリアルタイム生成 → 外部音源ファイル不要）
   ・画面フラッシュ、トースト、ドカン演出
   全ての刺激から `Effects` 経由で呼び出す共通基盤。
   ============================================================ */

const Effects = (() => {
  // ----- Canvas（パーティクル）-----
  /** @type {HTMLCanvasElement} */
  let canvas;
  /** @type {CanvasRenderingContext2D} */
  let ctx;
  /** @type {Particle[]} */
  let particles = [];
  let rafId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.getElementById('fx-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  /**
   * パーティクル一発。x,y は viewport 座標
   * @param {number} x
   * @param {number} y
   * @param {object} [opts]
   */
  function burst(x, y, opts = {}) {
    ensureCanvas();
    const count = opts.count ?? 24;
    const colors = opts.colors ?? ['#ff2bd6', '#00f7ff', '#fff200'];
    const speed = opts.speed ?? 5;
    const size = opts.size ?? 4;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.5, // 軽く上にバイアス
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: size * (0.6 + Math.random() * 0.8),
      });
    }
    startLoop();
  }

  function startLoop() {
    if (rafId) return;
    const loop = () => {
      if (!particles.length) { rafId = null; ctx.clearRect(0,0,canvas.width,canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter'; // 加算合成で派手に
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;     // 重力
        p.vx *= 0.99;
        p.life -= 0.022;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  // ----- Web Audio（効果音）-----
  /** @type {AudioContext|null} */
  let audioCtx = null;
  let muted = false;

  function unlockAudio() {
    // ユーザー操作の後でなければ AudioContext は鳴らないので、起動時に1回呼ぶ
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext unavailable', e);
    }
  }
  function setMuted(v) { muted = v; }

  /**
   * 簡易シンセ。type / freq / dur / vol を指定して短音を鳴らす
   */
  function tone({ type = 'sine', freq = 440, dur = 0.12, vol = 0.15, slide = 0 } = {}) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 名前付きプリセット（呼び出し側がコードを覚えなくていいように）
  const sfx = {
    pop:    () => tone({ type: 'square',   freq: 800, dur: 0.08, vol: 0.12, slide: -400 }),
    coin:   () => { tone({ type: 'triangle', freq: 880, dur: 0.06, vol: 0.12 }); setTimeout(()=>tone({ type: 'triangle', freq: 1320, dur: 0.08, vol: 0.12 }), 50); },
    tap:    () => tone({ type: 'sine',     freq: 600, dur: 0.04, vol: 0.08 }),
    levelup:() => { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone({ type:'triangle', freq:f, dur:0.1, vol:0.15 }), i*60)); },
    fanfare:() => { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone({ type:'sawtooth', freq:f, dur:0.18, vol:0.13 }), i*70)); },
    swipe:  () => tone({ type: 'sine',     freq: 300, dur: 0.18, vol: 0.08, slide: 200 }),
    like:   () => { tone({ type:'triangle', freq:880, dur:0.1, vol:0.14 }); setTimeout(()=>tone({ type:'triangle', freq:1320, dur:0.14, vol:0.14 }),80); },
    nope:   () => tone({ type: 'sawtooth', freq: 220, dur: 0.18, vol: 0.1, slide: -120 }),
    boom:   () => { tone({ type:'square', freq:120, dur:0.25, vol:0.2, slide:-80 }); tone({ type:'sawtooth', freq:80, dur:0.3, vol:0.15, slide:-40 }); },
    rare:   () => { [392,494,587,784,988,1175].forEach((f,i)=>setTimeout(()=>tone({ type:'triangle', freq:f, dur:0.13, vol:0.14 }), i*50)); },
  };

  // ----- 画面演出 -----
  function flash(color = '#fff', duration = 120) {
    const div = document.createElement('div');
    div.style.cssText = `
      position:fixed; inset:0;
      background:${color};
      opacity:0.6;
      pointer-events:none;
      z-index:600;
      transition:opacity ${duration}ms;
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.style.opacity = '0');
    setTimeout(() => div.remove(), duration + 20);
  }

  function shake(target = document.body, intensity = 8, duration = 200) {
    const original = target.style.transform;
    const start = performance.now();
    function step(now) {
      const t = now - start;
      if (t >= duration) { target.style.transform = original; return; }
      const decay = 1 - t / duration;
      const dx = (Math.random() - 0.5) * intensity * decay;
      const dy = (Math.random() - 0.5) * intensity * decay;
      target.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /**
   * カード内中央に "BOOM!" 的なテキストを出す
   * @param {HTMLElement} parent 表示先（刺激のホスト）
   * @param {string} text
   * @param {string} [color]
   */
  function boom(parent, text, color = '#fff200') {
    const d = document.createElement('div');
    d.className = 'boom';
    d.textContent = text;
    d.style.color = color;
    d.style.textShadow = `0 0 30px ${color}`;
    parent.appendChild(d);
    setTimeout(() => d.remove(), 700);
  }

  /**
   * 上部トースト（いいね/やだ等）
   */
  function toast(text, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = type; }, 900);
  }

  return {
    unlockAudio, setMuted,
    burst, sfx,
    flash, shake, boom, toast,
  };
})();
