/*
 * metrics.js — プレイヤーの「操作の癖」を裏で常時計測する（本作の肝）
 *
 * なぜ計測するか：
 *   本作は「言葉を覚える」ゲーム。だが急ぐ人は文章を読み飛ばし、
 *   無意識に harsh（言い負かす）側＝凶暴へ流れる——という非対称が設計の核にある。
 *   終盤のメタ演出で「神様的存在」が、このアキュムレータの集計を提示して
 *   プレイヤーを“見透かす”（「言葉を覚えるゲームで、言葉を飛ばしたね」）。
 *   つまり計測は採点ではなく、結末で本人に返す“鏡”として使う。
 *   ゲージや数値は途中ではUIに一切出さない（見られていると気づかせない）のが肝。
 *
 *   時刻は performance.now() を使う（実機ブラウザで単調増加・高分解能。
 *   Date より途中の時刻ずれに強く、滞在時間の計測がブレにくいため）。
 *
 * 計測する“癖”：
 *   - clicks       … クリック総数（せっかちさ／操作量）
 *   - cursorDist   … カーソル移動距離の合計（迷い・落ち着きのなさ）
 *   - skips        … 全文タイプ前に送った回数（読み飛ばし）
 *   - dwell        … テキスト1ブロックの滞在ミリ秒（じっくり読んだか）
 */

// グローバル計測アキュムレータ（save.js がスナップショットを往復させ、
//   途中ロードしても“癖”が途切れずメタ演出が成立する）。
let metrics = {
  clicks: 0,          // クリック総数
  cursorDist: 0,      // カーソル移動距離の累計（px）
  skips: 0,           // 全文表示前に送った（＝読み飛ばした）回数
  blocksShown: 0,     // 提示したテキストブロック数
  blocksSkipped: 0,   // そのうち飛ばされたブロック数
  dwellTotalMs: 0,    // 各ブロックの滞在時間の合計（avgDwell算出用）
  startedAt: 0,       // 計測開始時刻（seconds算出用）
  // 直前に提示したブロックの作業用（textShown→textAdvanced で1組）
  _curBlockStart: 0,  // そのブロックを表示し始めた時刻
  _curBlockChars: 0,  // そのブロックの文字数（将来の重み付け用に保持）
  _blockOpen: false,  // 現在「提示中（まだ送られていない）」ブロックがあるか
};

// 時刻取得。performance.now() があれば高分解能の単調時刻、無ければ Date で代替。
function _now() {
  return (typeof performance !== "undefined" && performance.now)
    ? performance.now()
    : Date.now();
}

// 計測開始：全カウンタを0に戻し、開始時刻を記録する。
//   newGame() / 新規プレイ開始時に呼ぶ（ロード時は save.js が上書き復元する）。
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

// クリック1回。main.js が document 全体の click で常時呼ぶ。
function noteClick() {
  metrics.clicks++;
}

// カーソル移動量を加算。pointermove の差分(dx,dy)を渡す。
//   ユークリッド距離で“実際に動いた長さ”を積む（落ち着きのなさの指標）。
function noteCursor(dx, dy) {
  const x = dx || 0, y = dy || 0;
  metrics.cursorDist += Math.sqrt(x * x + y * y);
}

// テキストブロックを提示した瞬間に呼ぶ（typewriter開始時）。
//   文字数と表示開始時刻を記録し、「提示中ブロック」を開く。
//   前のブロックを閉じ忘れていた場合に備え、開く前に一応締めておく。
function textShown(charCount) {
  // 直前ブロックが閉じられていなければ、ここで滞在を確定させてから新規を開く。
  if (metrics._blockOpen) {
    textAdvanced({ skipped: false });
  }
  metrics._curBlockChars = charCount || 0;
  metrics._curBlockStart = _now();
  metrics._blockOpen = true;
}

// ブロックを送った（次へ）瞬間に呼ぶ。
//   skipped=true は「全文タイプが終わる前に送った」＝読み飛ばし。
//   滞在ミリ秒を積み、blocksShown/blocksSkipped/skips を更新する。
function textAdvanced(opts) {
  // 開いているブロックが無ければ何もしない（多重送りの安全弁）。
  if (!metrics._blockOpen) return;
  const skipped = !!(opts && opts.skipped);
  const dwell = _now() - metrics._curBlockStart;
  // 負やNaNは0に丸めて集計汚染を防ぐ（時刻巻き戻りなどの保険）。
  metrics.dwellTotalMs += (dwell > 0 ? dwell : 0);
  metrics.blocksShown++;
  if (skipped) {
    metrics.blocksSkipped++;
    metrics.skips++;
  }
  metrics._blockOpen = false;
}

// 集計を1まとめにして返す（メタ演出 renderMeta が読む“鏡”の中身）。
//   すべて0除算ガード済み。比率は 0..1。
function metricsSummary() {
  const shown = metrics.blocksShown;
  // skipRatio：提示したブロックのうち、どれだけ飛ばしたか（0..1）。
  const skipRatio = shown > 0 ? metrics.blocksSkipped / shown : 0;
  // readRatio：その裏返し（ちゃんと読んだ割合）。
  const readRatio = 1 - skipRatio;
  // avgDwellMs：1ブロックあたりの平均滞在ミリ秒（じっくり度）。
  const avgDwellMs = shown > 0 ? metrics.dwellTotalMs / shown : 0;
  // seconds：計測開始からの経過秒（プレイ時間の目安）。
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
