/*
 * argue.js — 言い争い（戦闘の代わり）。なぐらない村では、ことばで むきあう。
 *
 * 相手を“倒す”のではない。相手の様子と ことばを読み、どの言葉を 言うかを選ぶ。
 *   ・観察（みみをすます/ようすをみる）… 相手の おくに ある言葉を覚える。
 *   ・言う … 覚えた言葉から選ぶ。やわらか語＝つうじ↑・世界が明るく / とげ語＝相手を黙らせる・世界が暗く。
 *   ・“通じることば”(core) を、つうじが じゅうぶん高い時に言う → あたたかい解決。
 *   ・とげで わだかまり(wari) を 0 まで削る → とげの解決（早いが、なにも つうじない）。
 *
 * 内部に wari(警戒/わだかまり) と tsuuji(つうじ/理解) を持つが、数値は画面に出さない（様子を文章で）。
 * 動的難易度：metaForgiveness() が低い（だらけ）ほど、core に必要な つうじ が少し高くなる。
 *
 * ※ ほこらの“かぞえうた”＝審判 は特別なので main.js が直接 演出する（ここは通常の言い争いのみ）。
 * ※ DOM 非依存。末尾で window へ明示エクスポート。
 */

function startArgue(argueId, opts) {
  const def = ARGUES[argueId];
  if (!def) return null;
  game.argue = {
    id: argueId, def: def,
    wari: 6, tsuuji: 0,        // 警戒は高め、理解は0から
    used: {}, done: false,
    doneFlag: (opts && opts.doneFlag) || null,
  };
  game.state = STATES.ARGUE;
  app.screen = "argue";
  return game.argue;
}

function argueOpenLines() { const a = game.argue; return a ? a.def.open.slice() : []; }

// 相手の“様子”（数値は出さない）。
function _mood(a) {
  if (a.tsuuji >= 5 && a.wari <= 3) return "あいては、めを あわせてくれた。";
  if (a.wari <= 1) return "あいては、くちを とじてしまった。";
  if (a.tsuuji >= 3) return "あいての とげが、すこし やわらいだ。";
  if (a.wari >= 6) return "あいては、つよく かまえている。";
  return "あいては、ことばを まっている。";
}

// 行動リスト（観察＋言える言葉）。ui がボタンにする。
function argueActions() {
  const a = game.argue; if (!a) return [];
  const def = a.def, acts = [];
  for (const key of ["kiku", "miru"]) {
    const ob = def.observe && def.observe[key];
    if (ob && !a.used[key]) acts.push({ id: "ob:" + key, label: ob.label, kind: "observe" });
  }
  (def.sayPool || []).forEach((id) => {
    if (isKnown(id)) acts.push({ id: "say:" + id, label: WORDS[id].text, kind: "say", tone: toneOfWord(id), word: id });
  });
  return acts;
}

// ui 用に 1 フレームぶんの情報をまとめる。
function argueFrame() {
  const a = game.argue; if (!a) return null;
  return { speaker: a.def.speaker, portrait: a.def.portrait, mood: _mood(a), actions: argueActions(), done: a.done };
}

// core(通じることば) に必要な つうじ。だらけ(watch高)ほど 少し上がる（4〜7）。
function _coreThreshold() {
  const f = (typeof metaForgiveness === "function") ? metaForgiveness() : 1;
  return Math.max(4, Math.ceil(4 * (2 - f)));
}

// 行動を選んだ結果（main が typeInto/showLearn/解決 を指揮）。
function argueChoose(actionId) {
  const a = game.argue; if (!a || a.done) return null;
  const def = a.def;

  // ── 観察 ──
  if (actionId.slice(0, 3) === "ob:") {
    const key = actionId.slice(3), ob = def.observe[key];
    if (!ob || a.used[key]) return null;
    a.used[key] = true;
    a.tsuuji = Math.min(10, a.tsuuji + 1);
    a.wari = Math.max(0, a.wari - 1);
    // “ついでに耳に入る”言葉（とげ語など）は、ポップなしで覚える。
    (ob.learnAlso || []).forEach((id) => { if (!isKnown(id)) learnWord(id); });
    const res = { say: (ob.say || []).slice(), se: "look" };
    if (ob.learn && !isKnown(ob.learn)) {
      learnWord(ob.learn);                       // 本体の語をここで覚える（ポップは main が出す）
      res.learn = { id: ob.learn, kind: "word" }; res.fresh = ob.learn; res.learnSay = (ob.learnSay || []).slice();
    }
    return res;
  }

  // ── 言う ──
  if (actionId.slice(0, 4) === "say:") {
    const id = actionId.slice(4);
    if (!isKnown(id)) return null;
    const tone = toneOfWord(id);
    if (typeof metaNoteSay === "function") metaNoteSay(tone);

    // “理解を しめす”ことば（みず/はな 等＝探索の成果）：相手の心に いちばん深く とどく。
    const rx = def.reactions && def.reactions[id];
    if (rx) { a.tsuuji = Math.min(10, a.tsuuji + 2); a.wari = Math.max(0, a.wari - 1); adjustTone(2); }
    else if (tone === "yawa") { a.tsuuji = Math.min(10, a.tsuuji + 2); a.wari = Math.max(0, a.wari - 1); adjustTone(4); }
    else if (tone === "toge") { a.wari = Math.max(0, a.wari - 3); a.tsuuji = Math.max(0, a.tsuuji - 1); adjustTone(-7); }
    else { a.tsuuji = Math.min(10, a.tsuuji + 1); }
    if (typeof setBgmTone === "function") setBgmTone(game.tone || 0);

    const res = { say: _reaction(a, id, tone), se: rx ? "sayYawa" : (tone === "toge" ? "sayToge" : (tone === "yawa" ? "sayYawa" : "select")) };

    if (id === def.core && a.tsuuji >= _coreThreshold()) {
      res.resolved = "warm";
      if (typeof metaNoteCore === "function") metaNoteCore();
    } else if (a.wari <= 0) {
      res.resolved = "harsh";
    }
    return res;
  }
  return null;
}

function _reaction(a, id, tone) {
  if (a.def.reactions && a.def.reactions[id]) return a.def.reactions[id].slice();
  if (id === a.def.core) {
    if (a.tsuuji >= _coreThreshold()) return ["きみは そっと 「{{" + id + "}}」と いった。"];
    return ["きみは 「{{" + id + "}}」と いった。", "（…まだ、とどいていない きがする）"];
  }
  if (tone === "yawa") return ["きみは 「{{" + id + "}}」と いった。", "あいての かたから、ちからが すこし ぬけた。"];
  if (tone === "toge") return ["きみは 「{{" + id + "}}」と いった。", "するどい ことばが、あいてに ささる。"];
  return ["きみは 「{{" + id + "}}」と いった。"];
}

// 解決（warm/harsh）。もらえる語を覚え、doneFlag を立てる。
function argueResolve(kind) {
  const a = game.argue; if (!a) return { text: [], gained: [] };
  const r = a.def.resolve[kind] || a.def.resolve.warm;
  const gained = [];
  (r.gained || []).forEach((id) => { if (!isKnown(id)) { learnWord(id); gained.push(id); } });
  a.done = true;
  // “どう解決したか”もフラグに残す（例 quarrel_done_warm）。あとの世界（doneLook の分岐）が これを見る。
  if (a.doneFlag) { setFlag(a.doneFlag); setFlag(a.doneFlag + "_" + kind); }
  return { text: (r.text || []).slice(), gained: gained, gainedSay: r.gainedSay || null, toast: r.toast || "" };
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.startArgue = startArgue;
  window.argueOpenLines = argueOpenLines;
  window.argueActions = argueActions;
  window.argueFrame = argueFrame;
  window.argueChoose = argueChoose;
  window.argueResolve = argueResolve;
}
