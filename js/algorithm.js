/* ============================================================
   algorithm.js
   ・各刺激の「好み度」を学習する超シンプルな推薦エンジン
   ・本物のレコメンドアルゴリズムを模した「TikTok っぽさ」のデモ用
   ============================================================ */

const DoopaAlgo = (() => {
  /** 重み辞書 { stimulusId: number } */
  let weights = {};
  /** 直近に出した刺激のID（連続を避けるため） */
  let lastId = null;
  /** 履歴（後で可視化に使えるよう保持） */
  const history = [];

  // 30% の確率で重みを無視してランダムに選ぶ（＝新規探索）。
  // TikTok 等のレコメンドが「知らないジャンル」をたまに混ぜるのを模倣。
  const EXPLORE_RATE = 0.3;

  // 重みの上限・下限。極端に偏ると同じ刺激しか出なくなるのを防ぐ。
  const MIN_W = 0.15;
  const MAX_W = 4.0;

  function register(stimulusIds) {
    stimulusIds.forEach(id => { if (!(id in weights)) weights[id] = 1.0; });
  }

  /**
   * 次に出す刺激を選ぶ
   * @param {string[]} allIds
   * @returns {string}
   */
  function pickNext(allIds) {
    if (!allIds.length) return null;

    // 探索：たまに完全ランダム（直前と同じも一応避ける）
    if (Math.random() < EXPLORE_RATE) {
      const pool = allIds.filter(id => id !== lastId);
      const pick = (pool.length ? pool : allIds)[Math.floor(Math.random() * (pool.length || allIds.length))];
      lastId = pick;
      return pick;
    }

    // 重み付きランダム選択（直前と同じは重み 0 にする＝連続防止）
    const pool = allIds.map(id => ({
      id,
      w: id === lastId ? 0 : (weights[id] ?? 1.0),
    }));
    const total = pool.reduce((s, p) => s + p.w, 0);
    if (total <= 0) {
      // 直前以外ぜんぶ 0 になることはまずないが念のため
      const pick = allIds[Math.floor(Math.random() * allIds.length)];
      lastId = pick;
      return pick;
    }
    let r = Math.random() * total;
    for (const p of pool) {
      r -= p.w;
      if (r <= 0) { lastId = p.id; return p.id; }
    }
    lastId = pool[pool.length - 1].id;
    return lastId;
  }

  /**
   * フィードバックを反映
   * @param {string} id
   * @param {'like'|'dislike'|'completed'|'skipped-early'|'skipped'} kind
   */
  function feedback(id, kind) {
    if (!(id in weights)) weights[id] = 1.0;
    const before = weights[id];
    let mul = 1;
    switch (kind) {
      case 'like':          mul = 1.6; break;
      case 'dislike':       mul = 0.35; break;
      case 'completed':     mul = 1.12; break; // 飽きずに最後まで見た
      case 'skipped-early': mul = 0.7;  break; // 2秒以内に次へ
      case 'skipped':       mul = 0.95; break; // 普通にスキップ
      default: mul = 1;
    }
    weights[id] = clamp(before * mul, MIN_W, MAX_W);
    history.push({ id, kind, at: Date.now(), w: weights[id] });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function snapshot() {
    return { weights: { ...weights }, lastId, count: history.length };
  }

  return { register, pickNext, feedback, snapshot, get history() { return history.slice(); } };
})();
