/*
 * meta.js — ★本作の心臓：あなたの“実挙動”を裏で数える。そして最後に、神的存在が読み上げる。
 *
 * バイブルの核：
 *   「マウスのクリック数や、読み飛ばした回数をカウントして、最後にメタ的に批判する。
 *    すべてを監視している神的な存在がいて、操作ログから動的に難易度を変えている。」
 *
 * 計測するもの（このプレイの間だけ。ローカル完結・送信は一切しない）：
 *   ・clicks   … 画面のどこかを押した総回数（＝ぽち）
 *   ・skips    … タイプ中（文字が出きる前）に送った回数＝“読み飛ばし”
 *   ・reads    … 文字が出きってから送った回数＝“ちゃんと読んだ”
 *   ・voids    … なにも ない地面を押した回数＝手持ち無沙汰の くせ
 *   ・fast     … 前のクリックから 250ms 以内に押した回数＝連打
 *   ・blurCount/blurMs … ウィンドウが背面に行った回数と合計時間＝“よそ見”（YouTube等）
 *   ・idleMaxMs… いちばん長く 何も しなかった時間
 *   ・togeSaid/yawaSaid … 言い争いで とげ/やわらか の言葉を選んだ回数
 *
 * これらから watch（監視スコア 0..100）を作り、
 *   ・動的難易度 metaForgiveness()（だらけてるほど世界が ほんの少し手強くなる）
 *   ・エンディングの審判 metaVerdict()（あなたの数字を具体的に言い当てる）
 * に使う。
 *
 * ※ ビルドなし・依存ゼロ。Date.now() はブラウザ/JXA どちらでも使える（headless でも落ちない）。
 *   末尾で window へ明示エクスポート。
 */

function _mnow() { try { return Date.now(); } catch (e) { return 0; } }

const Meta = {
  clicks: 0, skips: 0, reads: 0, voids: 0, fast: 0,
  blurCount: 0, blurMs: 0, idleMaxMs: 0,
  togeSaid: 0, yawaSaid: 0, coreUsed: 0, steps: 0,
  startedAt: 0, lastInputAt: 0, lastClickAt: 0,
  _blurAt: 0, _peeking: false,
};

// 新しいプレイのはじめに ぜんぶ 0 に戻す（一周ごとに あなたを 数えなおす）。
function metaReset() {
  const t = _mnow();
  Meta.clicks = 0; Meta.skips = 0; Meta.reads = 0; Meta.voids = 0; Meta.fast = 0;
  Meta.blurCount = 0; Meta.blurMs = 0; Meta.idleMaxMs = 0;
  Meta.togeSaid = 0; Meta.yawaSaid = 0; Meta.coreUsed = 0; Meta.steps = 0;
  Meta.startedAt = t; Meta.lastInputAt = t; Meta.lastClickAt = 0;
  Meta._blurAt = 0; Meta._peeking = false;
}

// ──────────────────────────────────────────
// soul — かぞえうたの“消えない記憶”。新しいプレイでもリセットされない（別キーで保存）。
//   何周したか・どの結末を見たか・最後のなづけ。タイトルと審判が これを参照する。
//   ★ 削除はしない方針：上書き(setItem)のみ。
// ──────────────────────────────────────────
const SOUL_KEY = "kotobamura_soul_v1";
let _soul = null;
function _soulDefault() { return { rounds: 0, clears: 0, endings: { light: 0, dim: 0, dark: 0 }, lastChoice: null, lastEnding: null }; }
function soulData() {
  if (_soul) return _soul;
  try {
    const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(SOUL_KEY) : null;
    _soul = raw ? JSON.parse(raw) : _soulDefault();
  } catch (e) { _soul = _soulDefault(); }
  if (!_soul || typeof _soul !== "object") _soul = _soulDefault();
  if (!_soul.endings) _soul.endings = { light: 0, dim: 0, dark: 0 };
  return _soul;
}
function _soulSave() { try { localStorage.setItem(SOUL_KEY, JSON.stringify(soulData())); } catch (e) {} }
function soulRunStart() { const s = soulData(); s.rounds = (s.rounds || 0) + 1; _soulSave(); return s.rounds; }
function soulOnClear(kind, choiceId) {
  const s = soulData();
  s.clears = (s.clears || 0) + 1;
  if (s.endings[kind] != null) s.endings[kind]++;
  s.lastEnding = kind || null;
  s.lastChoice = choiceId || null;
  _soulSave();
}

// クリック：総数＋連打判定。どんな入力でも idle を更新。
function metaNoteClick() {
  const t = _mnow();
  Meta.clicks++;
  if (Meta.lastClickAt && (t - Meta.lastClickAt) < 250) Meta.fast++;
  Meta.lastClickAt = t;
  metaNoteInput();
}
function metaNoteInput() {
  const t = _mnow();
  if (Meta.lastInputAt) { const gap = t - Meta.lastInputAt; if (gap > Meta.idleMaxMs) Meta.idleMaxMs = gap; }
  Meta.lastInputAt = t;
}
function metaNoteVoid() { Meta.voids++; }        // 何もない所を押した
function metaNoteSkip() { Meta.skips++; }        // 読みきる前に送った
function metaNoteRead() { Meta.reads++; }        // 読みきってから送った
function metaNoteSay(tone) {                     // 言い争いで言葉を選んだ
  if (tone === "toge") Meta.togeSaid++;
  else if (tone === "yawa") Meta.yawaSaid++;
}
function metaNoteCore() { Meta.coreUsed++; }     // “通じることば”で あたたかく解決した
function metaNoteSteps(d) { if (d > 0) Meta.steps += d; } // 歩いた距離（タイル単位の小数で積む）

// よそ見（ウィンドウが背面/前面）。focus 復帰で離れていた時間を足す。
function metaNoteBlur() {
  if (Meta._peeking) return;
  Meta._peeking = true; Meta._blurAt = _mnow(); Meta.blurCount++;
}
function metaNoteFocus() {
  if (!Meta._peeking) return;
  const t = _mnow();
  if (Meta._blurAt) Meta.blurMs += Math.max(0, t - Meta._blurAt);
  Meta._peeking = false; Meta._blurAt = 0;
  Meta.lastInputAt = t; // 戻ってきた＝入力とみなして idle を切る
}

// 経過秒（表示用）。
function metaElapsedSec() { return Meta.startedAt ? Math.round((_mnow() - Meta.startedAt) / 1000) : 0; }

// ──────────────────────────────────────────
// watch（監視スコア 0..100）。だらけ・よそ見・連打・とげが効く。
//   ていねいに読むプレイは低く、ドパガキ的プレイは高くなるよう重みづけ。
// ──────────────────────────────────────────
function metaWatch() {
  let s = 0;
  s += Meta.skips * 4;
  s += Meta.voids * 3;
  s += Meta.fast * 2;
  s += Meta.blurCount * 9;
  s += Meta.togeSaid * 5;
  if (Meta.blurMs > 0) s += Math.min(20, Meta.blurMs / 3000); // 30秒よそ見で +10 くらい
  // ちゃんと読んだ分は ほんの少し相殺（ていねいさ）。
  s -= Math.min(15, Meta.reads * 1.2);
  if (s < 0) s = 0; if (s > 100) s = 100;
  return Math.round(s);
}

// 動的難易度：だらけてる(watch高)ほど 0 に近づく＝世界が ほんの少し手強い。
//   argue.js が “通じることば に必要な つうじ” の しきい値を少し動かすのに使う。
function metaForgiveness() {
  const w = metaWatch();
  const f = 1 - (w / 140); // watch=0→1.0 / watch=100→約0.29
  return Math.max(0.25, Math.min(1, f));
}

// トーン（明暗）への寄与。とげを多く言うと世界が暗く、やわらかいと明るく。
// （実トーンは state が持つ。ここは“審判での言及”用の補助。）
function metaToneBias() { return Meta.yawaSaid * 6 - Meta.togeSaid * 8; }

// ──────────────────────────────────────────
// 審判：VERDICT の言い回しに、じっさいの数字を差し込んで配列で返す。
//   “あなたが実際にやったこと”だけを並べる＝不気味なほど具体的に。
//   watchHigh で sharp（皮肉/不気味）/ soft（やさしい）を出し分け。
// ──────────────────────────────────────────
function _vline(key, n, sharp) {
  const v = VERDICT.lines[key]; if (!v) return null;
  const tmpl = sharp ? v.sharp : v.soft;
  if (!tmpl) return null;
  return tmpl.replace("{n}", String(n));
}

function metaVerdict() {
  const w = metaWatch();
  const high = w >= 40;          // 全体トーン
  const out = [];

  // 必ず出す2項目（クリック数・読み方）。ここで“数えていた”ことを突きつける。
  out.push(_vline("clicks", Meta.clicks, Meta.clicks >= 60));
  out.push(_vline("skips", Meta.skips, Meta.skips >= 3));

  // 条件を満たした“あなたの癖”だけを足す（やってないことは言わない＝具体的で怖い）。
  if (Meta.blurCount >= 1) out.push(_vline("blur", Meta.blurCount, true));
  else out.push(_vline("blur", 0, false)); // 一度もよそ見しなかった人へのやさしい一言
  if (Meta.blurMs >= 8000) out.push(_vline("blurMs", Math.round(Meta.blurMs / 1000), true));
  if (Meta.voids >= 6) out.push(_vline("voids", Meta.voids, true));
  if (Meta.fast >= 8) out.push(_vline("fast", Meta.fast, true));
  if (Meta.togeSaid >= 1) out.push(_vline("toge", Meta.togeSaid, true));
  if (Meta.idleMaxMs >= 20000) out.push(_vline("idle", Math.round(Meta.idleMaxMs / 1000), true));

  // 時間と歩数（“いた”ことを言い当てる）。歩数はタイル距離→ぽ に換算。
  out.push(_vline("time", Math.max(1, Math.round(metaElapsedSec() / 60)), high));
  if (Meta.steps >= 10) out.push(_vline("steps", Math.round(Meta.steps), high));
  // 周回（soul）。2かいめ以降だけ言う＝“ぜんぶ おぼえている”。
  const s = soulData();
  if (s && s.rounds >= 2) out.push(_vline("rounds", s.rounds, high));

  // しめ。
  const close = high ? VERDICT.closeSharp : VERDICT.closeSoft;
  const lines = out.filter(Boolean).concat(close);
  return lines;
}

// 数字のサマリ（図鑑/デバッグ表示用）。
function metaSummary() {
  return {
    clicks: Meta.clicks, skips: Meta.skips, reads: Meta.reads, voids: Meta.voids,
    fast: Meta.fast, blurCount: Meta.blurCount, blurSec: Math.round(Meta.blurMs / 1000),
    idleMaxSec: Math.round(Meta.idleMaxMs / 1000), toge: Meta.togeSaid, yawa: Meta.yawaSaid,
    steps: Math.round(Meta.steps), watch: metaWatch(), elapsedSec: metaElapsedSec(),
  };
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.Meta = Meta;
  window.metaReset = metaReset;
  window.metaNoteClick = metaNoteClick;
  window.metaNoteInput = metaNoteInput;
  window.metaNoteVoid = metaNoteVoid;
  window.metaNoteSkip = metaNoteSkip;
  window.metaNoteRead = metaNoteRead;
  window.metaNoteSay = metaNoteSay;
  window.metaNoteCore = metaNoteCore;
  window.metaNoteSteps = metaNoteSteps;
  window.soulData = soulData;
  window.soulRunStart = soulRunStart;
  window.soulOnClear = soulOnClear;
  window.metaNoteBlur = metaNoteBlur;
  window.metaNoteFocus = metaNoteFocus;
  window.metaElapsedSec = metaElapsedSec;
  window.metaWatch = metaWatch;
  window.metaForgiveness = metaForgiveness;
  window.metaToneBias = metaToneBias;
  window.metaVerdict = metaVerdict;
  window.metaSummary = metaSummary;
}
