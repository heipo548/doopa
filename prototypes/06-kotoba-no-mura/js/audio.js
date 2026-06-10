/*
 * audio.js — 8bit チップチューンの BGM と効果音（外部音源ゼロ・すべて合成）。
 *
 * 方針（バイブル準拠）：
 *   ・基本は 8bit（矩形波/三角波）。全行動に SE（歩く・送り・選ぶ・覚えた・言う…）。
 *   ・世界が暗くなるほど BGM のピッチ/テンポを動的に下げる（同じ曲を“沈ませる”）。
 *   ・ほこら＝無音演出（BGM を完全に止め、こえだけ響かせる）。
 *   ・文字送りは Undertale 風の“しゃべってる風”ブリップ（話者ごとに音程）。
 *
 * ★ ヘッドレス安全：BGM は setTimeout 再帰ではなく requestAnimationFrame で駆動する。
 *   テスト環境の rAF はコールバックを呼ばないので、BGM ループは一度も回らず落ちない。
 *
 * ※ AudioContext が無い/失敗する環境でも全関数で握りつぶす。末尾で window へ明示エクスポート。
 */

let _ac = null, _master = null, _muted = false;
let _bgmActive = false, _bgmRaf = null, _bgmNext = 0, _bgmStep = 0;
let _theme = "village";       // village / forest / shrine(=無音)
let _toneFactor = 0;          // -100..100（暗いほどマイナス）。ピッチ/テンポに反映。

function initAudio() {
  if (_ac) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    _ac = new AC();
    _master = _ac.createGain();
    _master.gain.value = _muted ? 0 : 0.5;
    _master.connect(_ac.destination);
  } catch (e) { _ac = null; }
}
function _now() { return _ac ? _ac.currentTime : 0; }

// 単発トーン（type と gain の立ち上げ/減衰）。
function _tone(freq, dur, when, type, gain) {
  if (!_ac || _muted) return;
  try {
    const t = (when != null ? when : _now());
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.type = type || "square";
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    const peak = (gain != null ? gain : 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function _sweep(f0, f1, dur, type, gain) {
  if (!_ac || _muted) return;
  try {
    const t = _now();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain != null ? gain : 0.1, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

// ──────────────────────────────────────────
// 効果音（8bit）。プレイヤーの行動 1 つ 1 つに音を割り当てる（バイブル）。
// ──────────────────────────────────────────
const SE = {
  step:   () => _tone(150, 0.05, null, "square", 0.04),
  blip:   () => _tone(660, 0.03, null, "square", 0.05),    // 文字送り（既定）
  page:   () => _tone(380, 0.05, null, "square", 0.05),
  select: () => { const t = _now(); _tone(520, 0.06, t, "square", 0.10); _tone(780, 0.07, t + 0.05, "square", 0.08); },
  back:   () => { const t = _now(); _tone(420, 0.06, t, "square", 0.08); _tone(300, 0.07, t + 0.05, "square", 0.07); },
  look:   () => _tone(560, 0.09, null, "triangle", 0.09),
  learn:  () => { // 覚えた：明るい 8bit アルペジオ
    const t = _now();
    _tone(523.25, 0.10, t,        "square", 0.12);
    _tone(659.25, 0.10, t + 0.09, "square", 0.12);
    _tone(783.99, 0.12, t + 0.18, "square", 0.12);
    _tone(1046.5, 0.20, t + 0.28, "triangle", 0.11);
  },
  sayYawa: () => { const t = _now(); _tone(587, 0.10, t, "triangle", 0.10); _tone(880, 0.12, t + 0.08, "triangle", 0.09); },
  sayToge: () => { _sweep(330, 150, 0.18, "sawtooth", 0.12); }, // とげ＝ざらついた下降
  success: () => { const t = _now(); _tone(523, 0.16, t, "square", 0.12); _tone(659, 0.16, t + 0.12, "square", 0.12); _tone(880, 0.32, t + 0.24, "triangle", 0.12); },
  fail:    () => { _sweep(440, 180, 0.5, "sawtooth", 0.1); },
  warn:    () => _tone(260, 0.12, null, "sawtooth", 0.07),
  count:   () => _tone(440, 0.07, null, "sine", 0.06),       // 井戸の“かぞえる”冷たい一音
  reveal:  () => { // 不気味：少しデチューンしたクラスタ
    const t = _now();
    _tone(196, 0.6, t, "sawtooth", 0.06);
    _tone(198.5, 0.6, t, "sawtooth", 0.05);
    _tone(294, 0.6, t + 0.02, "triangle", 0.04);
  },
  name:    () => { const t = _now(); _tone(659, 0.14, t, "triangle", 0.10); _tone(988, 0.3, t + 0.12, "triangle", 0.10); },
  // 世界パルス：節目の言葉を覚えた瞬間、世界が“ひらく”音（上昇スイープ＋きらめき）。
  pulse:   () => { const t = _now(); _sweep(220, 880, 0.5, "sine", 0.08); _tone(1318.5, 0.4, t + 0.15, "triangle", 0.05); _tone(1760, 0.3, t + 0.3, "sine", 0.03); },
};
function playSe(name) { if (!_ac) return; const fn = SE[name]; if (fn) { try { fn(); } catch (e) {} } }

// 文字送りブリップ（話者ごとに音程を少し変える＝“しゃべってる風”）。
const _blipPitch = { default: 660, moko: 720, ton: 560, uta: 480, piko: 820, popo: 700, muku: 600, nushi: 300, watcher: 392, player: 640 };
function audioBlip(speaker) {
  if (!_ac || _muted) return;
  const base = _blipPitch[speaker] || _blipPitch.default;
  // 暗いほど少し低く（沈んだ声）。
  const f = base * Math.pow(2, (_toneFactor < 0 ? _toneFactor : 0) / 600);
  _tone(f, 0.03, null, "square", 0.045);
}

// ──────────────────────────────────────────
// BGM（rAF 駆動のチップチューン）。テーマとトーンでピッチ/テンポ/厚みが変わる。
//   各曲：mel（32step メロディ・半音オフセット・null=休符）＋ bass（4stepごとの根音）。
//   さらに アルペジオ（裏拍・ベース+1oct）と ハット（表拍・短い高音）で“8bitバンド”にする。
//   暗いトーン：テンポ↓・根音↓・アルペジオとハットを抜く（音がやせて 沈む）。
// ──────────────────────────────────────────
const _SONGS = {
  village: { // あさの むら：はずむ ルラバイ（Cメジャー）
    step: 0.16,
    mel:  [0, null, 4, 7,  9, 7, 4, null,  5, 9, 12, 9,  7, null, 4, null,
           0, null, 4, 7,  9, 12, 14, 12,  9, 7, 5, 4,   2, null, 0, null],
    bass: [0, 0, 5, 5, 7, 7, 0, 0],
  },
  forest: { // もや の もり：すこし ふしぎ（マイナー寄り）
    step: 0.19,
    mel:  [0, null, 3, 5,  7, null, 5, 3,   0, null, -2, 0,  3, null, null, null,
           7, null, 10, 7, 5, null, 3, 5,   3, 0, -2, null,  0, null, null, null],
    bass: [0, 0, -4, -4, 3, 3, 0, 0],
  },
};
const _BASE_ROOT = 261.63; // C4

function _bgmTick() {
  if (!_bgmActive) { _bgmRaf = null; return; }
  if (_ac && !_muted && _theme !== "shrine") {
    try {
      const nowT = _now();
      // ミュート/タブ復帰などで予定時刻が過去に置き去りなら、今に追従（過去ノートの一斉発火＝バースト防止）。
      if (_bgmNext < nowT - 0.05) _bgmNext = nowT + 0.02;
      const lookahead = nowT + 0.25;
      const song = _SONGS[_theme] || _SONGS.village;
      // テンポ：暗いほど遅く。根音：暗いほど下げる（最大-4半音）。
      const dark = _toneFactor < 0 ? -_toneFactor : 0; // 0..100
      const stepDur = song.step + Math.min(0.12, dark / 100 * 0.12);
      const rootSemi = _toneFactor < 0 ? Math.round(_toneFactor / 25) : 0;
      const root = _BASE_ROOT * Math.pow(2, rootSemi / 12);
      const sparse = dark > 30; // 暗い：アルペジオ/ハットを抜いて“やせた”音に

      while (_bgmNext < lookahead) {
        const i = _bgmStep % song.mel.length;
        const semi = song.mel[i];
        const bSemi = song.bass[Math.floor(_bgmStep / 4) % song.bass.length];
        if (semi != null) _tone(root * Math.pow(2, semi / 12), stepDur * 1.6, _bgmNext, "triangle", 0.055);
        if (_bgmStep % 4 === 0) _tone((root / 2) * Math.pow(2, bSemi / 12), stepDur * 3.4, _bgmNext, "square", 0.04);
        if (!sparse && _bgmStep % 2 === 1) _tone(root * Math.pow(2, (bSemi + 12) / 12), stepDur * 0.8, _bgmNext, "triangle", 0.018);
        if (!sparse && _bgmStep % 2 === 0) _tone(1700, 0.03, _bgmNext, "square", 0.012);
        _bgmNext += stepDur;
        _bgmStep++;
      }
    } catch (e) {}
  }
  if (typeof requestAnimationFrame === "function") _bgmRaf = requestAnimationFrame(_bgmTick);
  else _bgmRaf = null;
}

function startBgm() {
  if (!_ac) return;
  if (_bgmActive) return;
  _bgmActive = true; _bgmNext = _now() + 0.05; _bgmStep = 0;
  if (typeof requestAnimationFrame === "function") _bgmRaf = requestAnimationFrame(_bgmTick);
}
function stopBgm() {
  _bgmActive = false;
  if (_bgmRaf && typeof cancelAnimationFrame === "function") { try { cancelAnimationFrame(_bgmRaf); } catch (e) {} }
  _bgmRaf = null;
}
// 無音演出（ほこら）：BGM を止める。
function silence() { _theme = "shrine"; stopBgm(); }

// テーマ切替（village/forest/shrine）。shrine は無音。
function setTheme(theme) {
  if (theme === "shrine") { silence(); return; }
  _theme = theme || "village";
  if (_ac && !_bgmActive) startBgm();
}
// トーン（明暗）を BGM に反映。
function setBgmTone(tone) { _toneFactor = (typeof tone === "number") ? tone : 0; }

function toggleMute() {
  _muted = !_muted;
  if (_master) { try { _master.gain.value = _muted ? 0 : 0.5; } catch (e) {} }
  return _muted;
}
function isMuted() { return _muted; }

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.initAudio = initAudio;
  window.playSe = playSe;
  window.audioBlip = audioBlip;
  window.startBgm = startBgm;
  window.stopBgm = stopBgm;
  window.silence = silence;
  window.setTheme = setTheme;
  window.setBgmTone = setBgmTone;
  window.toggleMute = toggleMute;
  window.isMuted = isMuted;
}
