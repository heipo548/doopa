/*
 * audio.js — 依存ゼロの簡易 BGM ＋ SE（Web Audio API でコード生成）
 *
 * ねらい：外部音源なし（ライセンス問題なし）で、雰囲気に合う音を鳴らす。
 *   ・BGM … ループ。自動再生しない（右下ボタンを押した時だけ開始）。
 *   ・SE  … 言葉を選んだ時などに鳴る短い効果音。クリック（ユーザー操作）が
 *           起点なので、ブラウザの自動再生制限に引っかからない。
 *   ・AudioContext が無い環境（テスト/JXA）では静かに無効化される。
 *
 * Battle 15 の音作り：かわいいけど少し不穏。低いパッド＋まばらな鉄琴＋
 * ときどき “半音ずれ” の音を混ぜて、無機質な L と ポップな世界の ズレを出す。
 */

/* ═══════════ BGM（ループ）═══════════ */
var BGM = (function () {
  var ctx = null, master = null, on = false, timer = 0, prof = null, step = 0, noiseBuf = null, btn = null;

  var PROFILES = {
    // 15 理解バトル：静かな対話。低いパッド／まばらな鉄琴／たまに半音ずれの不穏な音。
    rikai: { stepMs: 420, gain: 0.055, voices: [
      { kind:'tone', wave:'sine', vol:0.5, dur:2600, seq:[146.83,0,0,0,0,0,0,0, 130.81,0,0,0,0,0,0,0] }, // 低いパッド D3→C3
      { kind:'tone', wave:'triangle', vol:0.26, dur:900, seq:[0,0,0,587.33,0,0,0,0, 0,0,493.88,0,0,0,0,0] }, // まばらな鉄琴
      { kind:'tone', wave:'sine', vol:0.14, dur:700, seq:[0,0,0,0,0,0,0,0, 0,0,0,0,0,622.25,0,0] }, // たまに 半音ずれ（不穏）
      { kind:'noise', vol:0.05, freq:5000, q:7, dur:30, seq:[1,0,0,0,0,0,0,0] } ] } // 遠い 衣ずれ
  };

  function makeNoiseBuf() {
    var len = ctx.sampleRate * 1.0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function playTone(wave, freq, vol, durMs) {
    var t = ctx.currentTime, dur = durMs / 1000, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function playNoise(freq, q, vol, durMs) {
    var t = ctx.currentTime, dur = durMs / 1000, s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  function tick() {
    if (!prof) return;
    for (var v = 0; v < prof.voices.length; v++) {
      var vo = prof.voices[v], val = vo.seq[step % vo.seq.length];
      if (!val) continue;
      if (vo.kind === 'tone') playTone(vo.wave, val, vo.vol, vo.dur);
      else if (vo.kind === 'noise') playNoise(vo.freq, vo.q, vo.vol, vo.dur);
    }
    step++;
  }
  function start() {
    if (on || !prof) return;
    try {
      if (!ctx) {
        var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        noiseBuf = makeNoiseBuf();
      }
      if (ctx.state === 'suspended') ctx.resume();
      on = true; step = 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(prof.gain, ctx.currentTime + 0.5);
      tick(); timer = setInterval(tick, prof.stepMs); updateBtn();
    } catch (e) {}
  }
  function stop() {
    on = false; if (timer) { clearInterval(timer); timer = 0; }
    try { if (master && ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); } } catch (e) {}
    updateBtn();
  }
  function toggle() { on ? stop() : start(); }
  function updateBtn() {
    if (!btn) return;
    btn.textContent = on ? '♪ BGM ⏸' : '♪ BGM ▶';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.classList.add('on'); else btn.classList.remove('on');
  }
  function mountBtn() {
    if (typeof document === 'undefined' || !document.body) return;
    btn = document.getElementById('bgm-btn');
    if (!btn) { btn = document.createElement('button'); btn.id = 'bgm-btn'; btn.className = 'bgm-btn'; btn.title = 'BGMの ON / OFF'; document.body.appendChild(btn); }
    btn.onclick = function () { toggle(); }; updateBtn();
  }
  function setup(profileId) { prof = PROFILES[profileId] || PROFILES.rikai; mountBtn(); }

  return { setup: setup, toggle: toggle, start: start, stop: stop, isOn: function () { return on; } };
})();

/* ═══════════ SE（短い効果音・ワンショット）═══════════ */
var SE = (function () {
  var ctx = null, master = null, muted = false;

  // 音の素（音名→周波数 列、波形、音量、長さ）
  var SOUNDS = {
    choice:     { wave:'triangle', vol:0.16, dur:90,  notes:[523.25] },                 // ことばを選ぶ：そっと
    understand: { wave:'sine',     vol:0.18, dur:240, notes:[523.25, 659.25] },          // 理解が進む：上がる二音
    reveal:     { wave:'triangle', vol:0.14, dur:160, notes:[880, 1174.66] },            // 見えてくる：きらめき
    alert:      { wave:'sine',     vol:0.22, dur:260, notes:[174.61, 138.59] },          // 警戒が上がる：下がる低音（不穏）
    win:        { wave:'sine',     vol:0.20, dur:300, notes:[392, 523.25, 659.25, 783.99] }, // 勝ち：あたたかいアルペジオ
    lose:       { wave:'triangle', vol:0.18, dur:300, notes:[392, 311.13, 246.94] }      // 失敗：力なく下がる
  };

  function ensureCtx() {
    if (ctx) return true;
    try {
      var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function play(name) {
    if (muted) return;
    var s = SOUNDS[name]; if (!s) return;
    if (!ensureCtx()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var gap = (s.dur / 1000) * 0.55; // 連続音の間隔
      for (var i = 0; i < s.notes.length; i++) {
        var t0 = ctx.currentTime + i * gap, d = s.dur / 1000;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = s.wave; o.frequency.value = s.notes[i];
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(s.vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0006, t0 + d);
        o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.02);
      }
    } catch (e) {}
  }
  function setMuted(m) { muted = !!m; }

  return { play: play, setMuted: setMuted };
})();
