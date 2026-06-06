/*
 * metrics.js — プレイヤーの「操作の癖」を裏で常時計測する（本作の肝の一つ）
 *
 * なぜ計測するか：
 *   「ことばを ひろう」ゲームなのに、急ぐ人は文章を読み飛ばし、無意識に
 *   harsh（言い負かす）側＝凶暴へ流れる——その非対称が設計の核。
 *   結果画面で“軽い1行メタ”が、この集計を提示して そっと見透かす。
 *   採点ではなく、結末で本人に返す“鏡”。途中は UI に一切出さない。
 *
 * 計測する“癖”：
 *   - clicks       … クリック総数（せっかちさ／操作量）
 *   - cursorDist   … カーソル移動距離の合計（落ち着きのなさ）
 *   - skips        … 全文タイプ前に送った回数（読み飛ばし）
 *   - dwell        … テキスト1ブロックの滞在ミリ秒（じっくり読んだか）
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提。<script>（data→audio→metrics→…）で読み、
 *   末尾で window へ明示エクスポート（headless チェッカは文字列 eval で読むため）。
 */

// グローバル計測アキュムレータ（save.js がスナップショットを往復させ、
//   途中ロードしても“癖”が途切れず結果メタが成立する）。
let metrics = {
  clicks: 0,
  cursorDist: 0,
  skips: 0,
  blocksShown: 0,
  blocksSkipped: 0,
  dwellTotalMs: 0,
  startedAt: 0,
  _curBlockStart: 0,
  _curBlockChars: 0,
  _blockOpen: false,
};

// 時刻取得。performance.now() があれば高分解能、無ければ Date で代替（JXA はこちら）。
function _now() {
  return (typeof performance !== "undefined" && performance.now)
    ? performance.now()
    : Date.now();
}

// 計測開始：全カウンタを0に戻し、開始時刻を記録する（新規プレイ開始時）。
function startMetrics() {
  metrics.clicks = 0;
  metrics.cursorDist = 0;
  metrics.skips = 0;
  metrics.blocksShown = 0;
  metrics.blocksSkipped = 0;
  metrics.dwellTotalMs = 0;
  metrics.startedAt = _now();
  metrics._curBlockStart = 0;
  metrics._curBlockChars = 0;
  metrics._blockOpen = false;
}

// クリック1回（main.js が document 全体の click で常時呼ぶ）。
function noteClick() {
  metrics.clicks++;
}

// カーソル移動量を加算（pointermove の差分 dx,dy）。ユークリッド距離で積む。
function noteCursor(dx, dy) {
  const x = dx || 0, y = dy || 0;
  metrics.cursorDist += Math.sqrt(x * x + y * y);
}

// テキストブロックを提示した瞬間（typewriter 開始）。前ブロックを閉じ忘れていたら締める。
function textShown(charCount) {
  if (metrics._blockOpen) {
    textAdvanced({ skipped: false });
  }
  metrics._curBlockChars = charCount || 0;
  metrics._curBlockStart = _now();
  metrics._blockOpen = true;
}

// ブロックを送った瞬間。skipped=true は「全文タイプ前に送った」＝読み飛ばし。
function textAdvanced(opts) {
  if (!metrics._blockOpen) return; // 多重送りの安全弁
  const skipped = !!(opts && opts.skipped);
  const dwell = _now() - metrics._curBlockStart;
  metrics.dwellTotalMs += (dwell > 0 ? dwell : 0); // 負/NaN は0に丸める
  metrics.blocksShown++;
  if (skipped) {
    metrics.blocksSkipped++;
    metrics.skips++;
  }
  metrics._blockOpen = false;
}

// 集計を1まとめにして返す（結果メタが読む“鏡”）。すべて0除算ガード済み。比率は 0..1。
function metricsSummary() {
  const shown = metrics.blocksShown;
  const skipRatio = shown > 0 ? metrics.blocksSkipped / shown : 0;
  const readRatio = 1 - skipRatio;
  const avgDwellMs = shown > 0 ? metrics.dwellTotalMs / shown : 0;
  const seconds = metrics.startedAt > 0 ? (_now() - metrics.startedAt) / 1000 : 0;
  return {
    clicks: metrics.clicks,
    cursorDist: metrics.cursorDist,
    skips: metrics.skips,
    blocksShown: metrics.blocksShown,
    blocksSkipped: metrics.blocksSkipped,
    skipRatio: skipRatio,
    readRatio: readRatio,
    avgDwellMs: avgDwellMs,
    seconds: seconds,
  };
}

// 結果メタ1行を skipRatio から選ぶ（data.META_LINES）。計測が“ことば”になって返ってくる。
function metaLineForMetrics() {
  const s = metricsSummary();
  const m = (typeof META_LINES !== "undefined") ? META_LINES : { hiSkip: "", midSkip: "", loSkip: "" };
  if (s.blocksShown === 0) return m.loSkip;           // 何も読んでいない＝判定材料なし→静かな方へ
  if (s.skipRatio >= 0.5) return m.hiSkip;            // 半分以上 飛ばした＝急いだ
  if (s.skipRatio > 0) return m.midSkip;              // 少し飛ばした
  return m.loSkip;                                    // 最後まで読んだ
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.metrics = metrics;
  window.startMetrics = startMetrics;
  window.noteClick = noteClick;
  window.noteCursor = noteCursor;
  window.textShown = textShown;
  window.textAdvanced = textAdvanced;
  window.metricsSummary = metricsSummary;
  window.metaLineForMetrics = metaLineForMetrics;
}
