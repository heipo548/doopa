/*
 * audio.js — 依存ゼロの簡易BGMユーティリティ（Web Audio API でコード生成）
 *
 * ねらい：外部音源を使わず、各バトルの雰囲気に合うループBGMをコードで鳴らす。
 *   ・ライセンス問題なし（全部 OscillatorNode / 自作ノイズ）
 *   ・自動再生しない（ユーザーがボタンを押した時だけ AudioContext を作って開始）
 *   ・うるさすぎない（master gain は低め）・ループ再生・ON/OFF ボタン同梱
 *   ・既存挙動を壊さない（読み込んでも setup を呼ぶまで何もしない）
 *
 * 使い方（main.js から）：
 *   BGM.setup('ffx');     // プロファイルIDを渡すとボタンが出る（最初はOFF）
 *   ボタンを押すと再生開始（ブラウザの自動再生制限に準拠）。
 *
 * テスト時（擬似DOM/JXA）でも、AudioContext が無ければ静かに無効化される。
 */
var BGM = (function () {
  var ctx = null, master = null, on = false, timer = 0, prof = null, step = 0, noiseBuf = null, btn = null;

  // ── プロファイル（バトルごとの音色・パターン）──
  // step は setInterval の1コマ。各 voice の seq は step % seq.length で巡回。
  //   tone: {kind:'tone', wave, vol, dur(ms), seq:[freq|0,...]}
  //   kick: {kind:'kick', vol, seq:[1|0,...], (lowからのピッチ落ち)}
  //   noise:{kind:'noise', vol, freq(中心), q, dur, seq:[1|0,...]}
  var PROFILES = {
    // 08 FFX参考：時計・秒針・静かな緊張・少し切ないシンセ
    ffx: { stepMs: 360, gain: 0.06, voices: [
      { kind:'tone', wave:'sine', vol:0.5, dur:1500, seq:[220,0,0,0,0,0,0,0, 174.61,0,0,0,0,0,0,0] }, // 低いパッド A→F
      { kind:'tone', wave:'triangle', vol:0.32, dur:520, seq:[0,0,659.25,0,0,0,0,0, 0,0,523.25,0,0,0,493.88,0] }, // 切ない単音
      { kind:'noise', vol:0.18, freq:5200, q:8, dur:40, seq:[1,0,0,0] } ] }, // 秒針クリック
    // 09 マリオRPG参考：ポップ・マリンバ/ピコピコ・リズム取りやすい
    mario: { stepMs: 150, gain: 0.07, voices: [
      { kind:'tone', wave:'triangle', vol:0.4, dur:130, seq:[130.81,0,196,0, 130.81,0,196,0] }, // バウンドする低音
      { kind:'tone', wave:'square', vol:0.18, dur:120, seq:[523.25,659.25,783.99,659.25, 587.33,659.25,523.25,0, 523.25,659.25,783.99,880,783.99,659.25,587.33,0] },
      { kind:'noise', vol:0.1, freq:7000, q:4, dur:30, seq:[0,1,0,1] } ] }, // 裏打ちハット
    // 10 モンハン参考：低いドローン・壊れたオルゴール・かわいいけど怖い
    monhan: { stepMs: 300, gain: 0.06, voices: [
      { kind:'tone', wave:'sine', vol:0.5, dur:2400, seq:[65.41,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }, // 低ドローン C2
      { kind:'tone', wave:'triangle', vol:0.24, dur:700, seq:[0,0,0,880,0,0,0,0, 0,698.46,0,0,0,0,830.61,0] }, // 壊れたオルゴール（不協を少し）
      { kind:'kick', vol:0.22, seq:[1,0,0,0,0,0,0,0, 1,0,0,0,0,0,0,0] } ] }, // 低い鼓動
    // 11 Into the Breach参考：ミニマル電子・短い反復・考える余白
    breach: { stepMs: 210, gain: 0.055, voices: [
      { kind:'tone', wave:'triangle', vol:0.3, dur:170, seq:[293.66,440,349.23,440] }, // 4音アルペジオ反復
      { kind:'tone', wave:'sine', vol:0.34, dur:420, seq:[73.42,0,0,0,0,0,0,0] }, // 低いベース D2
      { kind:'noise', vol:0.09, freq:6000, q:6, dur:30, seq:[1,0,0,0] } ] },
    // 12 Patapon参考：太鼓・心臓の鼓動・コール&レスポンス・間
    patapon: { stepMs: 185, gain: 0.075, voices: [
      { kind:'kick', vol:0.55, seq:[1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0] }, // 太鼓 ドン・ドン・ドド・ドン
      { kind:'kick', vol:0.3, seq:[1,0,0,1, 0,0,0,0, 0,0,0,0, 0,0,0,0] }, // 心臓 ドクッ
      { kind:'noise', vol:0.2, freq:2200, q:3, dur:60, seq:[0,0,1,0, 0,0,1,0, 0,0,0,0, 0,0,1,0] }, // タム
      { kind:'tone', wave:'square', vol:0.14, dur:140, seq:[0,0,0,0, 196,0,0,0, 0,0,0,0, 174.61,0,0,0] } ] }, // 低い掛け声
    // 13 スマブラ参考：短いバトルループ・少しスピード感・駆け引き
    smash: { stepMs: 140, gain: 0.07, voices: [
      { kind:'tone', wave:'sawtooth', vol:0.3, dur:120, seq:[82.41,82.41,98,82.41, 110,110,98,82.41, 82.41,82.41,98,82.41, 130.81,123.47,110,98] }, // 駆けるベース
      { kind:'tone', wave:'square', vol:0.18, dur:110, seq:[0,0,329.63,0, 0,0,392,0, 0,0,329.63,0, 0,0,440,0] }, // 裏のスタブ
      { kind:'noise', vol:0.28, freq:1800, q:1.5, dur:70, seq:[0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] }, // スネア 2・4
      { kind:'noise', vol:0.1, freq:8000, q:5, dur:25, seq:[1,1,1,1] } ] }, // 16分ハット
    // 14 Loop Hero参考：ゆるいループ・歩くテンポ・牧歌的
    loophero: { stepMs: 235, gain: 0.06, voices: [
      { kind:'tone', wave:'triangle', vol:0.34, dur:200, seq:[98,0,146.83,0, 98,0,123.47,0] }, // 歩くベース G2..
      { kind:'tone', wave:'triangle', vol:0.26, dur:200, seq:[392,0,440,0, 493.88,0,587.33,0, 523.25,0,493.88,0, 440,0,392,0] }, // 牧歌メロディ
      { kind:'noise', vol:0.07, freq:6500, q:5, dur:30, seq:[1,0,0,0, 1,0,0,0] } ] }
  };

  function makeNoiseBuf() {
    var len = ctx.sampleRate * 1.0;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playTone(wave, freq, vol, durMs) {
    var t = ctx.currentTime, dur = durMs / 1000;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function playKick(vol) {
    var t = ctx.currentTime;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.18);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.2);
  }
  function playNoise(freq, q, vol, durMs) {
    var t = ctx.currentTime, dur = durMs / 1000;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  function tick() {
    if (!prof) return;
    for (var v = 0; v < prof.voices.length; v++) {
      var vo = prof.voices[v];
      var val = vo.seq[step % vo.seq.length];
      if (!val) continue;
      if (vo.kind === 'tone') playTone(vo.wave, val, vo.vol, vo.dur);
      else if (vo.kind === 'kick') playKick(vo.vol);
      else if (vo.kind === 'noise') playNoise(vo.freq, vo.q, vo.vol, vo.dur);
    }
    step++;
  }

  function start() {
    if (on || !prof) return;
    try {
      if (!ctx) {
        var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;                 // 音が出せない環境（テスト等）では何もしない
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        noiseBuf = makeNoiseBuf();
      }
      if (ctx.state === 'suspended') ctx.resume();
      on = true; step = 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(prof.gain, ctx.currentTime + 0.4);
      tick();
      timer = setInterval(tick, prof.stepMs);
      updateBtn();
    } catch (e) { /* 音が出せなくてもゲームは続行 */ }
  }
  function stop() {
    on = false;
    if (timer) { clearInterval(timer); timer = 0; }
    try { if (master && ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25); } } catch (e) {}
    updateBtn();
  }
  function toggle() { on ? stop() : start(); }

  function updateBtn() {
    if (!btn) return;
    btn.textContent = on ? '♪ BGM ⏸' : '♪ BGM ▶';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.classList.add('on'); else btn.classList.remove('on');
  }

  // 画面右下に小さな ON/OFF ボタンを置く（無ければ作る）
  function mountBtn() {
    if (typeof document === 'undefined' || !document.body) return;
    btn = document.getElementById('bgm-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'bgm-btn'; btn.className = 'bgm-btn';
      btn.title = 'BGMの ON / OFF';
      document.body.appendChild(btn);
    }
    btn.onclick = function () { toggle(); };
    updateBtn();
  }

  function setup(profileId) {
    prof = PROFILES[profileId] || PROFILES.ffx;
    mountBtn();        // 最初はOFF。ユーザーがボタンを押すまで音は鳴らない。
  }

  return { setup: setup, toggle: toggle, start: start, stop: stop, isOn: function(){ return on; } };
})();
