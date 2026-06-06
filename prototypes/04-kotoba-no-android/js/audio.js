/*
 * audio.js — 最小サウンド（Web Audio 合成・任意）
 *
 * 外部音源ファイルは使わない（依存ゼロ・file:// で動く）。短い効果音を合成で鳴らすだけ。
 * ブラウザの自動再生制約のため、最初のユーザー操作（はじめる/クリック）で initAudio() する。
 * 鳴らせない環境（JXA・古いブラウザ）でも例外で落ちないよう、全部 try/catch でガードする。
 *
 * ※ DOM 非依存（AudioContext のみ）。末尾で window へ明示エクスポート。
 */

let _ac = null;        // AudioContext（遅延生成）
let _muted = false;    // ミュート状態

function initAudio() {
  if (_ac) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _ac = new AC();
  } catch (e) {
    _ac = null; // 使えなくても無音で続行
  }
}

function isMuted() { return _muted; }
function toggleMute() { _muted = !_muted; return _muted; }

// 単純なトーンを1つ鳴らす（freq:Hz, dur:秒, type:波形, gain:音量）。
function _tone(freq, dur, type, gain) {
  if (!_ac || _muted) return;
  try {
    const t = _ac.currentTime;
    const osc = _ac.createOscillator();
    const g = _ac.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    osc.connect(g); g.connect(_ac.destination);
    osc.start(t);
    osc.stop(t + (dur || 0.12) + 0.02);
  } catch (e) {}
}

// 名前付きの効果音（battle/ui から se()/playSe() 経由で呼ばれる）。
function playSe(name) {
  if (!_ac || _muted) return;
  switch (name) {
    case "harsh":    _tone(220, 0.10, "sawtooth", 0.06); break; // とげ：低くざらつく
    case "kind":     _tone(660, 0.16, "sine", 0.05); break;      // やわ：高くやわらかい
    case "enemyHit": _tone(160, 0.10, "square", 0.05); break;    // 被弾：鈍い
    case "heal":     _tone(880, 0.18, "triangle", 0.05); break;
    case "lowerAtk": _tone(330, 0.14, "sine", 0.04); break;
    case "winHarsh": _tone(180, 0.30, "sawtooth", 0.06); break;  // 凶暴勝ち：低く長い
    case "winKind":  _tone(784, 0.30, "sine", 0.06); break;      // 優しさ勝ち：澄んだ和音風
    case "gameover": _tone(120, 0.45, "sine", 0.06); break;
    case "click":    _tone(520, 0.05, "sine", 0.03); break;
    case "pick":     _tone(700, 0.10, "triangle", 0.05); break;
    default:         _tone(440, 0.08, "sine", 0.04); break;
  }
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.initAudio = initAudio;
  window.isMuted = isMuted;
  window.toggleMute = toggleMute;
  window.playSe = playSe;
}
