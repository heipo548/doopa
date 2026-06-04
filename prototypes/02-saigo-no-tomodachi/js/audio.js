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
  // ── ミックス品質を一段 上げる（Web Audio の定石）──
  //   コンプレッサで 合成音の凸凹を まとめ（歪み/音割れを防ぐ）、軽いリバーブで“奥行き”を足す。
  let out = audioCtx.destination;
  try {
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    comp.connect(out); out = comp; // 以後は全部 コンプ経由で出す
  } catch (e) { /* 非対応でも素通り */ }
  masterGain.connect(out);
  // 軽いリバーブ送り（合成インパルス応答）。dry はそのまま、wet を控えめに足して 温かみ・空気感を出す。
  try {
    const conv = audioCtx.createConvolver();
    conv.buffer = _makeImpulse(1.6, 2.4);
    const wet = audioCtx.createGain(); wet.gain.value = 0.15;
    masterGain.connect(conv); conv.connect(wet); wet.connect(out);
  } catch (e) { /* リバーブ無しでも動く */ }
}

// 合成インパルス応答（ノイズの指数減衰）＝外部音源なしで かんたんな残響をつくる。
function _makeImpulse(seconds, decay) {
  const rate = audioCtx.sampleRate, len = Math.max(1, Math.floor(rate * seconds));
  const buf = audioCtx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
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

// いまの 狂気／ぬくもり を安全に読む（タイトル中など game 未生成でも 0 を返す）
function _kyoki() { return (typeof game !== "undefined" && game && game.player) ? game.player.kyoki : 0; }
function _nukumori() { return (typeof game !== "undefined" && game && game.player) ? game.player.nukumori : 0; }

// 効果音の定義（コマンドや結果に対応）
//   口喧嘩バトル：きついことば＝濁って鋭い（狂気で不協和が増す）／
//                 やさしい・問いかけ＝やわらかい（ぬくもりで明るくなる）。音の質感で2つの道を描き分ける。
const SE = {
  select() { tone(440, 0.05, "sine", 0.10); },                         // ボタン選択
  fight()  {
    // ぶつける（きついことば）：ことばごとに鳴き分け＝「どれを言ったか」が耳でも分かる（選ぶ楽しさ）。
    const det = 1 + Math.min(0.07, _kyoki() * 0.007);
    const w = (typeof game !== "undefined" && game && game.lastWeapon) || "";
    if (w === "namida") {            // バカ＝高く刺す
      tone(330, 0.08, "square", 0.17); tone(247 * det, 0.12, "square", 0.13, _t(0.03));
    } else if (w === "damare") {     // だまれ＝短くピシャッと切る
      tone(190, 0.05, "square", 0.18); tone(120, 0.05, "square", 0.12, _t(0.03));
    } else if (w === "poyo") {       // うるさい＝うねって耳ざわり
      tone(200, 0.16, "sawtooth", 0.12); tone(212 * det, 0.16, "sawtooth", 0.10, _t(0.02));
    } else {                          // 既定（あっちいけ/きえろ/進化 など）
      tone(220, 0.12, "square", 0.18); tone(150 * det, 0.16, "square", 0.14, _t(0.04));
    }
    if (_kyoki() >= 5) tone(108 * det, 0.18, "sawtooth", 0.08, _t(0.02)); // 高狂気＝濁りを足す
  },
  act()    {
    // きいてみる（やさしい/問いかけ）：やわらかい音。ぬくもりが高いほど 上の倍音で明るく。
    const n = _nukumori();
    tone(540, 0.20, "sine", 0.16);
    if (n >= 3) tone(810, 0.22, "sine", 0.07, _t(0.05));
    if (n >= 9) tone(1080, 0.24, "sine", 0.05, _t(0.09));
  },
  save()   { [523, 659, 784].forEach((f, i) => tone(f, 0.32, "sine", 0.16, _t(i * 0.09))); }, // 手をのばす（上昇チャイム）
  item()   { tone(660, 0.10, "triangle", 0.16); tone(880, 0.12, "triangle", 0.14, _t(0.06)); }, // もちもの
  defend() { tone(120, 0.24, "sine", 0.22); },                         // こらえる
  hit()    { tone(90, 0.20, "sawtooth", 0.16); },                      // 被弾
  die()    { tone(200, 0.16, "square", 0.12); tone(110, 0.22, "square", 0.10, _t(0.07)); }, // 敵を祓った
  evolve() { [659, 880, 1175, 1318].forEach((f, i) => tone(f, 0.42, "triangle", 0.18, _t(i * 0.07))); }, // 進化
  levelup(){ [523, 784].forEach((f, i) => tone(f, 0.26, "sine", 0.18, _t(i * 0.08))); }, // レベルアップ
  dawn()   { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.6, "sine", 0.16, _t(i * 0.12))); }, // 夜明け
  calm()   { tone(660, 0.18, "sine", 0.12); tone(990, 0.24, "sine", 0.09, _t(0.06)); }, // 心の壁がほどけた（ほっ…）＝やわらかい
  heal()   { tone(523, 0.16, "sine", 0.10); tone(784, 0.24, "sine", 0.10, _t(0.06)); }, // 手をのばすHP回復のあたたかさ
  miss()   { tone(165, 0.10, "sine", 0.07); },                          // ことばが響かなかった（やわらかい低音）
  step()   { tone(1500, 0.018, "square", 0.04); },                      // 夜の道の足音（コッ・ごく軽く）
  learn()  { [659, 880, 1047, 1319].forEach((f, i) => tone(f, 0.3, "triangle", 0.13, _t(i * 0.07))); }, // ことばを覚えた（きらきら上昇）
};

function playSe(name) {
  initAudio();
  if (SE[name]) SE[name]();
}

// BGMのテーマ別スケール（音階）。暗→明、街→道 で雰囲気を変える。
const BGM_SCALES = {
  // 夜：暗すぎる指摘を受け、明るめのオルゴール子守唄へ。中〜高音のメジャーペンタトニックで
  //   “かわいくて少し切ない”が、重く沈まないトーンに（ちいかわ的なやさしい夜）。
  night: [392.0, 440.0, 523.25, 587.33, 659.25],  // G4 A4 C5 D5 E5（あたたかいメジャーペンタ）
  warm:  [523.25, 587.33, 659.25, 783.99, 880.0], // 明るい（ひかりの朝）
  gray:  [392.0, 440.0, 523.25, 587.33],          // 中間（にび色の朝）
  cold:  [415.30, 466.16, 523.25, 622.25],        // 寒い（しずかな朝）
  // v0.4：街＝やわらかい子守唄（拠点の安心）／フィールド＝歩く前進感（朝へ進む）。
  town:  [392.0, 440.0, 523.25, 587.33, 659.25],  // 夜と同じ温度だが、ゆっくり静かに鳴らす
  field: [523.25, 587.33, 659.25, 783.99, 880.0], // 明るめ＝前へ歩く高揚
};

// テーマ別の間隔（ms）。街はゆったり、道は歩くテンポ、戦闘の夜は子守唄。
const BGM_INTERVAL = { town: 1000, field: 520, night: 760 };

// ゆっくりしたパッドを一定間隔で鳴らし続ける簡易BGM
function startBgm(theme) {
  initAudio();
  if (!audioCtx) return;
  bgmTheme = theme || "night";
  bgmStep = 0;
  if (bgmTimer) clearInterval(bgmTimer);
  const interval = BGM_INTERVAL[bgmTheme] || 760;
  bgmTimer = setInterval(() => {
    if (_muted || !audioCtx) return;
    const scale = BGM_SCALES[bgmTheme] || BGM_SCALES.night;

    // ── 街：やわらかい子守唄（音すくなめ・低音量・ゆっくり）＝拠点の安心 ──
    if (bgmTheme === "town") {
      const seq = [0, 2, 4, 2, 1, 3, 2, 0];
      const f = scale[seq[bgmStep % seq.length] % scale.length];
      tone(f, 1.3, "sine", 0.05);                   // やわらかいサイン波
      tone(f * 2, 1.0, "sine", 0.014, _t(0.06));    // ほのかな倍音
      if (bgmStep % 2 === 0) tone(f / 2, 1.4, "sine", 0.025); // ゆれる低音
      bgmStep++;
      return;
    }
    // ── フィールド：歩く前進感（アルペジオ＋毎拍クリック）＝朝へ進む ──
    if (bgmTheme === "field") {
      const seq = [0, 2, 4, 5, 4, 2];
      const f = scale[seq[bgmStep % seq.length] % scale.length];
      tone(f, 0.45, "triangle", 0.06);              // 歩くアルペジオ
      tone(f * 2, 0.35, "sine", 0.02, _t(0.03));    // きらきら
      if (bgmStep % 2 === 0) tone(f / 2, 0.5, "sine", 0.03); // 一歩おきの支え
      tone(1800, 0.02, "square", 0.03);             // 毎拍の足音クリック＝前進のノリ
      bgmStep++;
      return;
    }

    // ── それ以外（夜の戦闘／結末テーマ）──
    let f;
    if (bgmTheme === "night") {
      // 単純な順送りをやめ、上り下りの“旋律”で往復＝かわいい子守唄に（ループ感を減らす）。
      const seq = [0, 1, 2, 3, 4, 3, 2, 1, 2, 4, 3, 1];
      f = scale[seq[bgmStep % seq.length] % scale.length];
      f = f * (1 + Math.min(0.015, _kyoki() * 0.0015));      // 高狂気でだけ ほんの少し翳る
      if (bgmStep % 4 === 0) tone(f * 2, 0.4, "triangle", 0.02, _t(0.0));  // オクターブ上の装飾音
      if (bgmStep % 8 === 3) tone(f * 1.25, 0.7, "sine", 0.02, _t(0.12));  // ときどき3度のハモリ
    } else {
      f = scale[bgmStep % scale.length];
    }
    // やわらかいオルゴール風：主音(三角)＋上の倍音できらきら、低音は軽く1つおき。
    tone(f, 0.9, "triangle", 0.06);                          // 主旋律（オルゴール風）
    tone(f * 2, 0.7, "sine", 0.022, _t(0.04));               // きらきら（明るさ）
    if (bgmStep % 2 === 0) tone(f / 2, 1.0, "sine", 0.03);   // 軽い支え（1つおき＝重くしない）
    if (bgmStep % 4 === 0) tone(2100, 0.025, "square", 0.03); // 拍頭の軽いクリック＝“ノリ”を立てる
    bgmStep++;
  }, interval);
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

// ミュートを 明示的に設定（設定メニュー/セーブ復元から呼ぶ）。
function setMuted(v) {
  _muted = !!v;
  if (masterGain) masterGain.gain.value = _muted ? 0 : 0.5;
  return _muted;
}
// ミュート切替（戻り値：ミュート中かどうか）。設定にも反映して永続化する。
function toggleMute() {
  setMuted(!_muted);
  if (typeof SETTINGS !== "undefined") { SETTINGS.muted = _muted; if (typeof saveSettings === "function") saveSettings(); }
  return _muted;
}
