/*
 * encounter.js — 遭遇（通常戦闘の代わり）の状態機械
 *
 * 設計の肝：相手を“倒す”のではなく、言葉と様子を読み取り、間合いと行動を選ぶ。
 *   内部に 3 つの値： u=理解度 / w=警戒度 / t=緊張度。
 *   ※ 数値は画面に出さない。cfg.moods のしきい値で“文章”として状態を伝える（読解体験を優先）。
 *
 *   行動を選ぶ → 効果(u/w/t)を加算 → 文を返す → 言葉を覚える/相手のセリフが読める →
 *   核のことば に近づく → 成功条件を満たす行動 or 緊張/警戒の限界 で決着。
 *   失敗してもゲームオーバーにはしない（“すれ違い”として処理し、最低限の言葉は残す）。
 *
 * ※ DOM 非依存。末尾で window へ明示エクスポート。
 */

// 条件評価（actions.enableWhen / autoLearn.when 共通）。
function _encCond(c) {
  if (!c) return true;
  const enc = game.enc;
  if (c.knows && !isKnown(c.knows)) return false;
  if (c.notKnows && isKnown(c.notKnows)) return false;
  if (c.minU != null && enc.u < c.minU) return false;
  if (c.maxU != null && enc.u > c.maxU) return false;
  if (c.maxW != null && enc.w > c.maxW) return false;
  if (c.minW != null && enc.w < c.minW) return false;
  if (c.has && !hasItem(c.has)) return false;
  if (c.flag && !hasFlag(c.flag)) return false;
  if (c.used && !(enc.used[c.used])) return false;
  if (c.notUsed && (enc.used[c.notUsed])) return false;
  return true;
}

// ──────────────────────────────────────────
// 遭遇を開始する
// ──────────────────────────────────────────
function startEncounter(encId) {
  const cfg = ENCOUNTERS[encId];
  if (!cfg) return null;
  game.enc = {
    id: encId, cfg: cfg,
    u: 0, w: 0, t: 0, turn: 0,
    ladderIdx: {},   // 耳をすます等の段階
    used: {},        // 各行動の使用回数
    speechFreshId: null,
    successKey: null,
    done: false, result: null, resultData: null, gained: [],
  };
  game.state = STATES.ENCOUNTER;
  app.screen = "encounter";
  return game.enc;
}

// 導入文（最初の1ビート）。
function encOpenLines() { return (game.enc && game.enc.cfg.open) ? game.enc.cfg.open.slice() : []; }

// 相手のセリフ（覚えた語ぶんだけ読める）。直近に覚えた語は書き換え演出でハイライト。
function encSpeechHtml() {
  const enc = game.enc; if (!enc) return "";
  return renderText(enc.cfg.speech, enc.speechFreshId);
}
function encSpeakerLabel() {
  const enc = game.enc; if (!enc) return "";
  return enc.cfg.speakerLabel ? renderText("{" + enc.cfg.speakerLabel + "}") : "";
}

// 相手の様子（u/w を見て“文章”で）。
function encMood() {
  const enc = game.enc; if (!enc) return "";
  let txt = null;
  for (const m of enc.cfg.moods) {
    let ok = true;
    if (m.minU != null && enc.u < m.minU) ok = false;
    if (m.maxU != null && enc.u > m.maxU) ok = false;
    if (m.minW != null && enc.w < m.minW) ok = false;
    if (m.maxW != null && enc.w > m.maxW) ok = false;
    if (ok) txt = m.text;
  }
  return txt || enc.cfg.moods[0].text;
}

// いま選べる行動（enableWhen / once を反映）。表示用に label/hint を解決して返す。
function encActions() {
  const enc = game.enc; if (!enc) return [];
  return enc.cfg.actions.filter((a) => {
    if (a.once && enc.used[a.id]) return false;
    if (a.enableWhen && !_encCond(a.enableWhen)) return false;
    // ladder を撃ち尽くした「耳をすます」も、最後の一言のために残す（消さない）。
    return true;
  }).map((a) => ({
    id: a.id, label: a.label, icon: a.icon || "",
    hint: a.hint ? plainText(a.hint) : "",
    route: a.route || null,
  }));
}

// ──────────────────────────────────────────
// 行動を選ぶ → 何を見せるかの記述子を返す
//   { say:[...], learn:{id,kind}|null, fresh:id|null, autoLearn:{id,say}|null,
//     resolved:'success'|'fail'|null, se:'select'|'listen'|'learn'|'warn' }
// ──────────────────────────────────────────
function encChoose(actionId) {
  const enc = game.enc; if (!enc || enc.done) return null;
  const a = enc.cfg.actions.find((x) => x.id === actionId);
  if (!a) return null;

  enc.turn++;
  enc.used[a.id] = (enc.used[a.id] || 0) + 1;
  const res = { say: [], learn: null, fresh: null, autoLearn: null, resolved: null, se: "select" };

  if (a.ladder) {
    // 段階学習（耳をすます）：1回ごとに1段ずつ。撃ち尽くしたら exhaustedSay。
    const idx = enc.ladderIdx[a.id] || 0;
    if (idx < a.ladder.length) {
      const rung = a.ladder[idx];
      enc.ladderIdx[a.id] = idx + 1;
      res.say = (rung.say || []).slice();
      res.se = "listen";
      if (rung.frag && wordLevel(rung.frag) < 1) { learnFrag(rung.frag); res.fresh = rung.frag; res.learn = { id: rung.frag, kind: "frag" }; }
      if (rung.learn) {
        const r = learnWord(rung.learn);
        if (r === "new") { res.fresh = rung.learn; res.learn = { id: rung.learn, kind: "word" }; res.se = "learn"; }
      }
    } else {
      res.say = (a.exhaustedSay || ["……"]).slice();
      res.se = "listen";
    }
  } else {
    // 通常行動：2回目以降は repeatSay があれば そちら。
    if (enc.used[a.id] > 1 && a.repeatSay) res.say = a.repeatSay.slice();
    else res.say = (a.say || []).slice();
    if (a.frag && wordLevel(a.frag) < 1) { learnFrag(a.frag); res.fresh = a.frag; res.learn = { id: a.frag, kind: "frag" }; }
    if (a.learn) {
      const r = learnWord(a.learn);
      if (r === "new") { res.fresh = a.learn; res.learn = { id: a.learn, kind: "word" }; res.se = "learn"; }
    }
    if (a.icon === "→" && a.eff && a.eff.t > 0) res.se = "warn"; // 進む＝きしむ音
  }

  // ゲージ反映（負にはしない）
  if (a.eff) {
    enc.u = Math.max(0, enc.u + (a.eff.u || 0));
    enc.w = Math.max(0, enc.w + (a.eff.w || 0));
    enc.t = Math.max(0, enc.t + (a.eff.t || 0));
  }

  // ルート（成功/失敗）の明示行動
  if (a.route === "success") { res.resolved = "success"; enc.successKey = a.success || null; res.se = "success"; }
  else if (a.route === "fail") { res.resolved = "fail"; res.se = "fail"; }

  // ゲージ限界での失敗（成功確定時は除く）
  if (!res.resolved) {
    if (enc.cfg.tensionMax != null && enc.cfg.onTensionMax && enc.t >= enc.cfg.tensionMax) { res.resolved = "fail"; res.se = "fail"; }
    if (enc.cfg.waryMax != null && enc.cfg.onWaryMax && enc.w >= enc.cfg.waryMax) { res.resolved = "fail"; res.se = "fail"; }
  }

  // 自動習得（例：泣く＋理解 → こわい）。成功/失敗の決着時は割り込まない。
  if (!res.resolved && enc.cfg.autoLearn) {
    for (const al of enc.cfg.autoLearn) {
      if (al.learn && !isKnown(al.learn) && _encCond(al.when)) {
        learnWord(al.learn);
        res.autoLearn = { id: al.learn, say: (al.say || []).slice() };
        break;
      }
    }
  }

  enc.speechFreshId = res.fresh; // 相手セリフの書き換えハイライト対象
  return res;
}

// ──────────────────────────────────────────
// 決着：成功/失敗のデータを返し、言葉付与・フラグ設定・新規習得語の記録を行う。
//   main は data.text を流したあと、data._gained の語を順にポップアップ表示する。
// ──────────────────────────────────────────
function encResolve(kind) {
  const enc = game.enc; if (!enc) return null;
  const cfg = enc.cfg;
  let data;
  if (kind === "success") {
    if (enc.successKey && cfg.successAlt && cfg.successAlt.key === enc.successKey) data = cfg.successAlt;
    else data = cfg.success;
  } else {
    data = cfg.fail;
  }
  // 付与する語のうち“今 初めて覚える”ものを記録（main がポップアップ）。
  const gained = [];
  (data.words || []).forEach((id) => {
    if (wordLevel(id) < 2) gained.push(id);
    learnWord(id);
  });
  if (data.flag) setFlag(data.flag);
  if (data.softFlag) setFlag(data.softFlag);

  enc.done = true; enc.result = kind; enc.resultData = data; enc.gained = gained;
  return { text: (data.text || []).slice(), gained: gained, kind: kind };
}

function encIsDone() { return !!(game.enc && game.enc.done); }
function encCore() { return game.enc ? game.enc.cfg.coreWord : null; }

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.startEncounter = startEncounter;
  window.encOpenLines = encOpenLines;
  window.encSpeechHtml = encSpeechHtml;
  window.encSpeakerLabel = encSpeakerLabel;
  window.encMood = encMood;
  window.encActions = encActions;
  window.encChoose = encChoose;
  window.encResolve = encResolve;
  window.encIsDone = encIsDone;
  window.encCore = encCore;
}
