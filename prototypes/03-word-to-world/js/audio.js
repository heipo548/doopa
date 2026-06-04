/*
 * audio.js — 効果音とBGMを Web Audio API で“合成”する（外部音源ファイル一切なし）
 *
 * このプロト#03「WO_RD → WORLD」では、ことばのカードバトルが核。
 *   harsh（きついことば）＝濁った短い和音で“刺す/削る”手応え。
 *   kind （やさしいことば）＝やわらかく上昇する音で“満たす/寄り添う”手応え。
 * 音の質感そのものが「凶暴の道／優しさの道」を耳で描き分ける。
 *
 * 主人公 L のダーク化（darkLevel 0..3）に合わせて、setTone() で全体を
 *   少しずつデチューン（音程をわずかにずらして翳らせる）させる＝世界が翳る体感。
 *
 * ※ ブラウザは「ユーザー操作の後」でないと音を出せないため、
 *   最初のクリックで initAudio() を呼ぶ設計（main.js から）。
 *   未対応ブラウザ／未初期化でも、すべて無音で安全に素通りする。
 */

let audioCtx = null;   // AudioContext（最初の操作で生成）
let masterGain = null; // 全体音量
let bgmTimer = null;   // BGM ループ用タイマー
let bgmStep = 0;       // BGM の何音目か
let bgmTheme = "village";
let _muted = false;
let _detune = 0;       // setTone(darkLevel) が決める“翳り”。0..約0.03（高いほど音程が下にずれる）

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
//   _detune を掛けて全体をわずかに下げる＝ダーク化で世界が翳って聞こえる。
function tone(freq, dur, type, gain, when) {
  if (!audioCtx || _muted) return;
  const t = when || audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type || "sine";
  // ダークが深いほど音程を少し下げる（デチューン）。1音ごとに掛けるので全体が翳る。
  osc.frequency.value = freq * (1 - _detune);
  // 0からの指数補間は不可なので、ごく小さい値から立ち上げて減衰させる。
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || 0.2, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

// いまからの相対時刻（秒）を返す。和音を少しずらして重ねるのに使う。
function _t(offset) {
  return (audioCtx ? audioCtx.currentTime : 0) + (offset || 0);
}

// いまの darkLevel を安全に読む（タイトル中など game 未生成でも 0）。
//   harsh の濁りはダークが深いほど増す＝凶暴へ寄るほど音も濁る、という連動。
function _dark() {
  if (typeof darkLevel === "function") { try { return darkLevel() || 0; } catch (e) { return 0; } }
  return 0;
}

/*
 * 効果音テーブル（契約の playSe(name) で鳴らす name 一覧）。
 *   select / harsh / kind / hit / calm / win / lose / page
 */
const SE = {
  // ボタン選択：軽いクリック。
  select() { tone(440, 0.05, "sine", 0.10); },

  // harsh（きついことば）＝濁った短い和音。
  //   半音ぶつけ＋低音の sawtooth で“刺さって濁る”。ダークが深いほど濁りを足す。
  harsh() {
    const d = _dark();
    tone(220, 0.10, "square", 0.18);                 // 主音（短くピシャッと）
    tone(233.08, 0.12, "square", 0.13, _t(0.02));    // 半音上をぶつける＝不協和（濁り）
    tone(146.83, 0.14, "sawtooth", 0.12, _t(0.03));  // 低音で“重さ/鋭さ”
    if (d >= 2) tone(110, 0.16, "sawtooth", 0.08, _t(0.02)); // 凶暴が進むほど濁りを足す
  },

  // kind（やさしいことば）＝やわらかく上昇する音。
  //   sine の三度上昇で“満ちていく/ほどける”。決して刺さらない柔らかさ。
  kind() {
    tone(523.25, 0.18, "sine", 0.14);                // C5
    tone(659.25, 0.22, "sine", 0.10, _t(0.05));      // E5（上昇＝満ちる）
    tone(783.99, 0.26, "sine", 0.07, _t(0.10));      // G5（ほのかな倍音で明るく）
  },

  // 被弾（敵の精神HPに当たる／プレイヤーが殴られる、どちらの“当たり”にも使える鈍い音）。
  hit() { tone(96, 0.18, "sawtooth", 0.16); },

  // calm：思いやりが届いて心がほどけた合図（ほっ…）。kind 勝利の余韻にも。
  calm() { tone(660, 0.18, "sine", 0.11); tone(990, 0.24, "sine", 0.08, _t(0.06)); },

  // 勝利（言い負かした／寄り添った 共通の上昇チャイム）。
  win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.34, "triangle", 0.16, _t(i * 0.08))); },

  // 敗北（ゲームオーバー）：力なく下降する。
  lose() { [392, 311.13, 233.08].forEach((f, i) => tone(f, 0.30, "square", 0.12, _t(i * 0.10))); },

  // ページ送り（テキストを1ブロック送る／めくる微音）。
  page() { tone(1500, 0.020, "square", 0.045); },
};

function playSe(name) {
  initAudio();
  if (SE[name]) SE[name]();
}

/*
 * BGM。テーマ別のスケール（音階）で雰囲気を変える。
 *   village＝ポップで可愛い村（明るいメジャーペンタ）
 *   cave   ＝不穏な洞窟（短調・低め）
 *   meta   ＝神様的存在のメタ演出（無機質で広がる音）
 * いずれも tone() を一定間隔で鳴らす簡易ループ。_detune も自動で効く。
 */
const BGM_SCALES = {
  village: [523.25, 587.33, 659.25, 783.99, 880.0], // C D E G A（明るいメジャーペンタ＝かわいい村）
  cave:    [261.63, 311.13, 349.23, 392.0, 415.30], // C Eb F G Ab（短調まじり＝不穏）
  meta:    [329.63, 392.0, 493.88, 587.33],         // E G B D（無機質に広がる響き）
};

// テーマ別の間隔（ms）。村はゆったり弾む、洞窟はじりじり遅く、メタは間（ま）を置く。
const BGM_INTERVAL = { village: 560, cave: 820, meta: 1100 };

function playBgm(theme) {
  initAudio();
  if (!audioCtx) return;
  bgmTheme = (theme && BGM_SCALES[theme]) ? theme : "village";
  bgmStep = 0;
  if (bgmTimer) clearInterval(bgmTimer);
  const interval = BGM_INTERVAL[bgmTheme] || 560;
  bgmTimer = setInterval(() => {
    if (_muted || !audioCtx) return;
    const scale = BGM_SCALES[bgmTheme] || BGM_SCALES.village;

    // ── village：ポップで可愛い村（弾むアルペジオ＋きらきら倍音）──
    if (bgmTheme === "village") {
      const seq = [0, 2, 4, 2, 1, 3, 4, 2];          // 上り下りで子守唄っぽく（ループ感を減らす）
      const f = scale[seq[bgmStep % seq.length] % scale.length];
      tone(f, 0.42, "triangle", 0.06);               // 主旋律（オルゴール風）
      tone(f * 2, 0.30, "sine", 0.018, _t(0.03));    // きらきら（明るさ）
      if (bgmStep % 2 === 0) tone(f / 2, 0.5, "sine", 0.03); // 軽い支え（1つおき）
      if (bgmStep % 4 === 0) tone(2100, 0.022, "square", 0.03); // 拍頭の軽いクリック＝弾むノリ
      bgmStep++;
      return;
    }

    // ── cave：不穏な洞窟（低い持続音＋まばらな短調の旋律）──
    if (bgmTheme === "cave") {
      const seq = [0, 1, 0, 3, 2, 1];
      const f = scale[seq[bgmStep % seq.length] % scale.length];
      tone(f / 2, 1.4, "sine", 0.05);                // 低い持続音（ドローン＝不安）
      tone(f, 0.7, "triangle", 0.05, _t(0.05));      // ぽつりと鳴る旋律
      if (bgmStep % 3 === 1) tone(f * 1.5, 0.6, "sawtooth", 0.018, _t(0.1)); // ときどき濁る上音
      bgmStep++;
      return;
    }

    // ── meta：神様的存在のメタ演出（広がる無機質なパッド）──
    const seqM = [0, 2, 1, 3, 2, 0];
    const fm = scale[seqM[bgmStep % seqM.length] % scale.length];
    tone(fm, 1.6, "sine", 0.05);                     // 長く伸びる主音
    tone(fm * 2, 1.2, "sine", 0.015, _t(0.2));       // 高い倍音（空間の広がり）
    tone(fm / 2, 1.8, "sine", 0.025, _t(0.0));       // 低い土台（静かな圧）
    bgmStep++;
  }, interval);
}

// 主人公のダーク化に合わせて全体の“翳り”を更新する。
//   darkLevel 0..3 を受け取り、深いほど tone() のデチューンを強める＝世界が下にずれて翳る。
function setTone(darkLevelValue) {
  const d = Math.max(0, Math.min(3, darkLevelValue || 0));
  // 0,1,2,3 → 0, 0.006, 0.014, 0.024（はっきり翳るが不快にならない範囲）
  _detune = [0, 0.006, 0.014, 0.024][d];
}

// BGM を止める（エリア移動やメタ画面の切り替えで使う）。
function stopBgm() {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

// ミュート切替（戻り値：いまミュート中かどうか）。
function toggleMute() {
  _muted = !_muted;
  if (masterGain) masterGain.gain.value = _muted ? 0 : 0.5;
  return _muted;
}
