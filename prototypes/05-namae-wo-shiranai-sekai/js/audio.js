/*
 * audio.js — WebAudio による環境音と効果音（外部音源ゼロ）
 *
 * 方針：やさしい絵本の世界に合うよう、すべて合成音（オシレータ）で“ふんわり”鳴らす。
 *   ・env … エリアごとの薄いアンビエント（森＝鳥／橋＝川せせらぎ／村＝あたたかいパッド）。
 *   ・se  … 行動の手応え（歩く・調べる・耳をすます・覚えた・成功・失敗・送り）。
 *   ・初回の操作で initAudio()（ブラウザの自動再生制限を踏まないよう、クリック後に開始）。
 *   ・AudioContext が無い環境（headless 等）でも一切落ちないよう全関数で握りつぶす。
 *
 * ※ 末尾で window へ明示エクスポート。
 */

let _ac = null;        // AudioContext
let _master = null;    // 全体ゲイン（mute で 0 に）
let _muted = false;
let _envNodes = null;  // 現在のアンビエントのノード群（エリア切替で止める）
let _envTheme = null;

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

// 単発トーン（やわらかい三角波＋ゲインの立ち上げ/減衰）。
function _tone(freq, dur, when, type, gain) {
  if (!_ac || _muted) return;
  try {
    const t = (when != null ? when : _now());
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = type || "triangle";
    o.frequency.setValueAtTime(freq, t);
    const peak = (gain != null ? gain : 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

// 上昇/下降グリッサンド（耳をすます等）。
function _sweep(f0, f1, dur, type, gain) {
  if (!_ac || _muted) return;
  try {
    const t = _now();
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain != null ? gain : 0.12, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(_master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

// ──────────────────────────────────────────
// 効果音
// ──────────────────────────────────────────
const SE = {
  step:    () => _tone(180, 0.06, null, "sine", 0.05),
  look:    () => { _tone(520, 0.10, null, "triangle", 0.10); },
  page:    () => _tone(330, 0.05, null, "square", 0.03),
  select:  () => { _tone(440, 0.08, null, "triangle", 0.10); _tone(660, 0.08, _now() + 0.04, "triangle", 0.08); },
  listen:  () => _sweep(280, 760, 0.55, "sine", 0.10),       // 耳をすます＝意味へ近づく上昇音
  // 覚えた：明るい3音アルペジオ（ド・ミ・ソ＋オクターブ）
  learn:   () => {
    const t = _now();
    _tone(523.25, 0.16, t,        "triangle", 0.16);
    _tone(659.25, 0.16, t + 0.10, "triangle", 0.15);
    _tone(783.99, 0.22, t + 0.20, "triangle", 0.15);
    _tone(1046.5, 0.30, t + 0.30, "sine",     0.12);
  },
  frag:    () => { _tone(620, 0.10, null, "sine", 0.10); _tone(740, 0.10, _now() + 0.06, "sine", 0.08); },
  success: () => {
    const t = _now();
    _tone(523.25, 0.22, t,        "triangle", 0.15);
    _tone(659.25, 0.22, t + 0.14, "triangle", 0.15);
    _tone(880.00, 0.40, t + 0.28, "triangle", 0.14);
  },
  fail:    () => { _sweep(420, 180, 0.5, "sine", 0.12); },
  warn:    () => { _tone(300, 0.12, null, "sawtooth", 0.07); }, // 進む＝板がきしむ
};

function playSe(name) {
  if (!_ac) return;
  const fn = SE[name];
  if (fn) { try { fn(); } catch (e) {} }
}

// ──────────────────────────────────────────
// アンビエント（エリアごと）。薄く敷いて、操作音を邪魔しない音量に。
// ──────────────────────────────────────────
function _stopEnv() {
  if (!_envNodes) return;
  try { _envNodes.forEach((n) => { try { n.stop ? n.stop() : (n.disconnect && n.disconnect()); } catch (e) {} }); }
  catch (e) {}
  _envNodes = null;
}

function setEnv(theme) {
  if (!_ac || theme === _envTheme) return;
  _stopEnv();
  _envTheme = theme;
  if (_muted) return;
  try {
    const t = _now();
    const nodes = [];
    // ベースのやわらかいパッド（テーマで根音を変える）
    const root = theme === "village" ? 196 : theme === "bridge" ? 174 : 220; // G3 / F3 / A3
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = "sine"; o.frequency.value = root;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.05, t + 1.5);
    o.connect(g); g.connect(_master); o.start(t);
    nodes.push(o);
    // 5度上のうっすらした倍音
    const o2 = _ac.createOscillator();
    const g2 = _ac.createGain();
    o2.type = "triangle"; o2.frequency.value = root * 1.5;
    g2.gain.value = 0.0001;
    g2.gain.exponentialRampToValueAtTime(0.02, t + 2.0);
    o2.connect(g2); g2.connect(_master); o2.start(t);
    nodes.push(o2);
    _envNodes = nodes;
  } catch (e) { _envNodes = null; }
}

function toggleMute() {
  _muted = !_muted;
  if (_master) { try { _master.gain.value = _muted ? 0 : 0.5; } catch (e) {} }
  if (_muted) _stopEnv();
  else { const th = _envTheme; _envTheme = null; setEnv(th); } // 復帰時に鳴らし直す
  return _muted;
}
function isMuted() { return _muted; }

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.initAudio = initAudio;
  window.playSe = playSe;
  window.setEnv = setEnv;
  window.toggleMute = toggleMute;
  window.isMuted = isMuted;
}
