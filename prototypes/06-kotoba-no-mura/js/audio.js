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
};
function playSe(name) { if (!_ac) return; const fn = SE[name]; if (fn) { try { fn(); } catch (e) {} } }

// 文字送りブリップ（話者ごとに音程を少し変える＝“しゃべってる風”）。
const _blipPitch = { default: 660, moko: 720, ton: 560, uta: 480, popo: 700, muku: 600, nushi: 300, watcher: 392, player: 640 };
function audioBlip(speaker) {
  if (!_ac || _muted) return;
  const base = _blipPitch[speaker] || _blipPitch.default;
  // 暗いほど少し低く（沈んだ声）。
  const f = base * Math.pow(2, (_toneFactor < 0 ? _toneFactor : 0) / 600);
  _tone(f, 0.03, null, "square", 0.045);
}

// ──────────────────────────────────────────
// BGM（rAF 駆動の簡易チップチューン）。テーマとトーンでピッチ/テンポが変わる。
// ──────────────────────────────────────────
// 各テーマのメロディ（半音オフセットの並び）。null は休符。
const _PATTERNS = {
  village: [0, 4, 7, 12, 7, 4, 0, null, 2, 5, 9, 5, null, 7, 4, 0],
  forest:  [0, 3, 7, 10, 7, 3, null, 0, -2, 3, 7, 3, null, 0, null, null],
};
const _BASE_ROOT = 261.63; // C4

function _bgmTick() {
  if (!_bgmActive) { _bgmRaf = null; return; }
  if (_ac && !_muted && _theme !== "shrine") {
    try {
      const lookahead = _now() + 0.25;
      // テンポ：暗いほど遅く（step 秒）。明=0.17 / 暗=0.30 くらい。
      const stepDur = 0.17 + (_toneFactor < 0 ? Math.min(0.13, (-_toneFactor) / 100 * 0.13) : 0);
      const pat = _PATTERNS[_theme] || _PATTERNS.village;
      // 根音：暗いほど数半音下げる（最大 -4）。
      const rootSemi = (_toneFactor < 0 ? Math.round(_toneFactor / 25) : 0); // 0..-4
      const root = _BASE_ROOT * Math.pow(2, rootSemi / 12);
      while (_bgmNext < lookahead) {
        const semi = pat[_bgmStep % pat.length];
        if (semi != null) {
          const f = root * Math.pow(2, semi / 12);
          _tone(f, stepDur * 0.9, _bgmNext, "triangle", 0.05);
          // ベース（1 拍おき）
          if (_bgmStep % 4 === 0) _tone(f / 2, stepDur * 1.6, _bgmNext, "square", 0.035);
        }
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
