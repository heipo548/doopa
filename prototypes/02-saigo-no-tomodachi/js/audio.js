/*
 * audio.js — 効果音とBGMを Web Audio API で“合成”する（外部音源ファイル不要）
 *
 * 仕様書では「フリー音源を仮置き／BGMは明・暗2系統」とあるが、
 * 自己完結（open index.html だけで動く）を優先し、波形を合成して鳴らす。
 * BGMは theme（night=夜の暗／warm=ひかりの朝／gray=にび色／cold=しずか）で雰囲気を変える。
 *
 * ※ ブラウザは「ユーザー操作の後」でないと音を鳴らせないため、
 *   最初のクリック時に initAudio() を呼ぶ設計にしている。
 */

let audioCtx = null;   // AudioContext（最初の操作で作る）
let masterGain = null; // 全体音量
let bgmTimer = null;   // BGMのループ用タイマー
let bgmStep = 0;       // BGMの何音目か
let bgmTheme = "night";
let _muted = false;

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return; // 非対応ブラウザでも無音で動く
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = _muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
}

// 1音を鳴らす（freq=高さ, dur=長さ秒, type=波形, gain=音量, when=開始時刻）
function tone(freq, dur, type, gain, when) {
  if (!audioCtx || _muted) return;
  const t = when || audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  // 0からの指数補間は不可なので、ごく小さい値から立ち上げて減衰させる
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function _t(offset) {
  return (audioCtx ? audioCtx.currentTime : 0) + (offset || 0);
}

// 効果音の定義（コマンドや結果に対応）
const SE = {
  select() { tone(440, 0.05, "sine", 0.10); },                         // ボタン選択
  fight()  { tone(220, 0.12, "square", 0.18); tone(150, 0.16, "square", 0.14, _t(0.04)); }, // 祓う
  act()    { tone(540, 0.20, "sine", 0.16); },                         // こころみる
  save()   { [523, 659, 784].forEach((f, i) => tone(f, 0.32, "sine", 0.16, _t(i * 0.09))); }, // すくう（上昇チャイム）
  item()   { tone(660, 0.10, "triangle", 0.16); tone(880, 0.12, "triangle", 0.14, _t(0.06)); }, // どうぐ
  defend() { tone(120, 0.24, "sine", 0.22); },                         // まもる
  hit()    { tone(90, 0.20, "sawtooth", 0.16); },                      // 被弾
  die()    { tone(200, 0.16, "square", 0.12); tone(110, 0.22, "square", 0.10, _t(0.07)); }, // 敵を祓った
  evolve() { [659, 880, 1175, 1318].forEach((f, i) => tone(f, 0.42, "triangle", 0.18, _t(i * 0.07))); }, // 進化
  levelup(){ [523, 784].forEach((f, i) => tone(f, 0.26, "sine", 0.18, _t(i * 0.08))); }, // レベルアップ
  dawn()   { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.6, "sine", 0.16, _t(i * 0.12))); }, // 夜明け
};

function playSe(name) {
  initAudio();
  if (SE[name]) SE[name]();
}

// BGMのテーマ別スケール（音階）。暗→明で雰囲気を変える。
const BGM_SCALES = {
  night: [196.0, 233.08, 261.63, 293.66, 311.13], // 暗め（夜の出撃）
  warm:  [261.63, 329.63, 392.0, 523.25],         // 明るい（ひかりの朝）
  gray:  [261.63, 293.66, 349.23, 392.0],         // 中間（にび色の朝）
  cold:  [261.63, 311.13, 349.23, 415.30],        // 寒い（しずかな朝）
};

// ゆっくりしたパッドを一定間隔で鳴らし続ける簡易BGM
function startBgm(theme) {
  initAudio();
  if (!audioCtx) return;
  bgmTheme = theme || "night";
  bgmStep = 0;
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = setInterval(() => {
    if (_muted || !audioCtx) return;
    const scale = BGM_SCALES[bgmTheme] || BGM_SCALES.night;
    const f = scale[bgmStep % scale.length];
    tone(f, 1.4, "sine", 0.06);      // 主旋律（やわらかい）
    tone(f / 2, 1.6, "triangle", 0.04); // 低い支え
    bgmStep++;
  }, 1100);
}

// 結末などでBGMの雰囲気だけ切り替える
function setBgmTheme(theme) {
  bgmTheme = theme;
  bgmStep = 0;
  if (!bgmTimer) startBgm(theme);
}

function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

// ミュート切替（戻り値：ミュート中かどうか）
function toggleMute() {
  _muted = !_muted;
  if (masterGain) masterGain.gain.value = _muted ? 0 : 0.5;
  return _muted;
}
