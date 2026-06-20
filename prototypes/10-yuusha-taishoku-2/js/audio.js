/* =========================================================================
   audio.js — 効果音とBGMを WebAudio で“その場で”鳴らす（音声ファイル不使用）。
   グローバル名は SFX（Audio はブラウザ組み込みなので避ける）。
   最初のユーザー操作で init()（自動再生制限の解除）してから鳴らす。
   ========================================================================= */
const SFX = (() => {
  let ac = null;          // AudioContext
  let master = null;      // 全体音量
  let muted = false;
  let bgmTimer = null;    // BGMのステップ用 setInterval
  let bgmGain = null;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
      bgmGain = ac.createGain(); bgmGain.gain.value = 0.5; bgmGain.connect(master);
    } catch (e) { ac = null; }
  }

  // 単音（矩形波などのチップトーン）
  function tone(freq, dur, type, vol, dest, slideTo) {
    if (!ac) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.value = 0; g.gain.linearRampToValueAtTime(vol || 0.3, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g); g.connect(dest || master);
    o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  // ノイズ（足音・紙・暗転に）
  function noise(dur, vol, hp) {
    if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = vol || 0.2;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  const N = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9,
    C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C3: 130.8, E3: 164.8, G3: 196, A3: 220 };

  function play(name) {
    if (!ac || muted) return;
    switch (name) {
      case 'move':    noise(0.05, 0.06, 1400); break;
      case 'bump':    tone(120, 0.08, 'square', 0.15); break;
      case 'select':  tone(N.C5, 0.06, 'square', 0.22); break;
      case 'cursor':  tone(N.E5, 0.05, 'square', 0.18); break;
      case 'confirm': tone(N.G4, 0.07, 'square', 0.24); setTimeout(() => tone(N.C5, 0.12, 'square', 0.24), 70); break;
      case 'cancel':  tone(N.E4, 0.08, 'square', 0.2, null, N.C4); break;
      case 'talk':    tone(N.A4 + Math.random() * 40, 0.03, 'square', 0.12); break;
      case 'page':    noise(0.06, 0.12, 1800); break;
      case 'bracelet':// 腕輪が光る：不穏なきらめき
        tone(N.B4, 0.5, 'sine', 0.25, null, N.E5); tone(N.E5, 0.5, 'triangle', 0.12); break;
      case 'effect':  // 施策実行の決定音
        [N.C5, N.E5, N.G5].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.22), i * 60)); break;
      case 'good':    // 状態が好転した時のキラッ
        [N.E5, N.G5, N.C5 * 2].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.2), i * 50)); break;
      case 'event':   tone(N.A3, 0.2, 'sawtooth', 0.18, null, N.E4); break;
      case 'win':     ['C5', 'E5', 'G5', 'C5'].forEach((k, i) => setTimeout(() => tone(N[k] || 1046, 0.18, 'square', 0.26), i * 130)); setTimeout(() => tone(1046, 0.4, 'triangle', 0.2), 560); break;
      case 'lose':    ['G4', 'E4', 'C4'].forEach((k, i) => setTimeout(() => tone(N[k], 0.22, 'sawtooth', 0.22), i * 180)); break;
      case 'stamp':   // §2：魔王の承認印「ドンッ」。低い衝撃音＋短いノイズで“押した”感を出す
        tone(150, 0.16, 'square', 0.3, null, 60); tone(90, 0.22, 'sine', 0.28, null, 45); noise(0.09, 0.22, 400); break;
      case 'page2':   // 書類・資料カードをめくる（紙の擦れ＋小さな決定音）
        noise(0.05, 0.12, 1600); setTimeout(() => tone(N.C5, 0.05, 'square', 0.14), 40); break;
      case 'thunder': // §4：怒りで雷を落とす妄想（落ちる前に腕輪が止める）
        noise(0.25, 0.3, 200); tone(70, 0.4, 'sawtooth', 0.22, null, 40); break;
      case 'frog':    // §4：広報官をカエルにする妄想（コミカルに）
        tone(180, 0.1, 'square', 0.2, null, 120); setTimeout(() => tone(150, 0.12, 'square', 0.2, null, 90), 110); break;
      default: break;
    }
  }

  // ── BGM：単純なループ（場面で雰囲気を変える） ──
  const TUNES = {
    // [周波数 or 0(休符), …] を一定間隔で鳴らすだけの簡易シーケンス
    castle: { bass: [N.A3, 0, N.A3, 0, N.F4 / 2 || 174, 0, N.G3, 0], lead: [N.A4, N.C5, N.E5, N.C5, N.F4, N.A4, N.G4, N.E4], step: 360, wave: 'triangle' },
    tense:  { bass: [N.A3, N.A3, N.G3, N.G3], lead: [N.E5, 0, N.D5, 0, N.C5, 0, N.B4, 0], step: 240, wave: 'square' },
    title:  { bass: [N.C3, 0, N.G3, 0, N.A3, 0, N.E3, 0], lead: [N.E5, N.G5, N.A5, N.G5, N.E5, N.C5, N.D5, N.E5], step: 380, wave: 'triangle' },
  };
  let step = 0, curTune = null;
  function bgm(name) {
    if (!ac) return;
    stopBgm();
    curTune = TUNES[name]; step = 0;
    if (!curTune) return;
    bgmTimer = setInterval(() => {
      if (muted || !curTune) return;
      const T = curTune; const i = step % T.lead.length; const bi = step % T.bass.length;
      if (T.lead[i]) tone(T.lead[i], T.step / 1000 * 0.9, T.wave, 0.08, bgmGain);
      if (T.bass[bi]) tone(T.bass[bi] / 2, T.step / 1000 * 1.1, 'square', 0.06, bgmGain);
      step++;
    }, curTune.step);
  }
  function stopBgm() { if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } curTune = null; }
  function setMuted(m) { muted = m; if (m) stopBgm(); }
  function isMuted() { return muted; }

  return { init, play, bgm, stopBgm, setMuted, isMuted };
})();
