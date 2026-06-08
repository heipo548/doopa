/*
 * words.js — 言葉システム（本作の心臓）
 *
 * やること：
 *   1) 覚えた言葉の状態を持つ（game.words[id] = 0 未習得 / 1 断片 / 2 習得）。
 *   2) 文章テンプレ（"その {hashi} は {abunai}"）を、現在の習得状況で“描き換える”。
 *        ・未習得  → 「？？？」(にじみ)
 *        ・断片(1) → words.frag（例「ま…て…」）
 *        ・習得(2) → words.disp（例「橋」）
 *   3) 言葉を覚える（learnWord / learnFrag）。覚えた順番も記録（エンディングのモンタージュ用）。
 *
 * なぜ“描き換え”を関数1本に集約するのか：
 *   会話・名札・遭遇・調べ文……あらゆるテキストが同じ仕組みで読めるようになる。
 *   新しい語を覚えた瞬間に「過去に見た文まで読めるようになる」体験を、再描画だけで実現できる。
 *
 * ※ DOM 非依存（HTML文字列を“作る”だけ。実際の差し込みは ui.js）。末尾で window へ明示エクスポート。
 */

// ── 習得レベルの読み書き（game.words が器。state.newGame が用意する）──
function wordLevel(id) {
  return (game && game.words && game.words[id]) || 0;
}
function isKnown(id) { return wordLevel(id) >= 2; } // 完全習得
function isFrag(id)  { return wordLevel(id) === 1; } // 断片だけ
function wordDisp(id) {
  const w = WORDS[id];
  return w ? w.disp : id;
}

// 覚えた言葉の数（HUD「覚えた言葉数」＝完全習得の数）。
function vocabCount() {
  if (!game || !game.words) return 0;
  let n = 0;
  for (const id in game.words) { if (game.words[id] >= 2) n++; }
  return n;
}
// 覚えた言葉の一覧（覚えた順）。一覧パネルとエンディングで使う。
function learnedList() {
  return (game && game.wordsOrder) ? game.wordsOrder.slice() : [];
}

// ──────────────────────────────────────────
// 言葉を覚える
//   learnWord(id) … 完全習得(2)。初習得なら "new"、すでに習得済なら "already"。
//                   覚えた順 game.wordsOrder に積む（重複は積まない）。
//   learnFrag(id) … 断片(1)。未習得のときだけ 1 にする（すでに 1/2 なら据え置き）。
//   いずれも「最後に覚えた語」を game.lastLearned に入れる（書き換え演出のハイライト用）。
// ──────────────────────────────────────────
function learnWord(id) {
  if (!WORDS[id] || !game) return "already";
  const prev = wordLevel(id);
  game.words[id] = 2;
  game.lastLearned = id;
  if (prev < 2) {
    if (!game.wordsOrder.includes(id)) game.wordsOrder.push(id);
    if (typeof setFlag === "function") setFlag("learned_" + id); // 進行ゲートで使う（例 learned_mizu）
    return "new";
  }
  return "already";
}
function learnFrag(id) {
  if (!WORDS[id] || !game) return "already";
  if (wordLevel(id) >= 1) return "already";
  game.words[id] = 1;
  game.lastLearned = id;
  return "frag";
}

// 習得ポップアップの文（"「水」を おぼえた"）。frag のときは控えめな文に。
function learnPopupText(id, kind) {
  const w = WORDS[id];
  if (!w) return "";
  if (kind === "frag") return "ことばの かけらを ひろった……";
  return "「" + w.disp + "」を おぼえた";
}

// ──────────────────────────────────────────
// テンプレ文 → セグメント配列（描画・タイプライタ共通の中間表現）
//   各セグメント：{ text, cls, w }
//     cls: "" / "w-known" / "w-frag" / "w-unknown" / "gen"(生の？？？)
//     w  : 語id（書き換え演出のハイライト対象を特定するため。無ければ null）
//   ・"{id}" を語トークンとして解決。
//   ・地の文中の「？」連続は“いつまでも分からないもの”として gen で包む（一貫した にじみ表現）。
// ──────────────────────────────────────────
const _TOKEN_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function resolveSegments(str) {
  const out = [];
  if (str == null) return out;
  const s = String(str);
  let last = 0, m;
  _TOKEN_RE.lastIndex = 0;
  while ((m = _TOKEN_RE.exec(s)) !== null) {
    if (m.index > last) _pushLiteral(out, s.slice(last, m.index));
    _pushToken(out, m[1]);
    last = m.index + m[0].length;
  }
  if (last < s.length) _pushLiteral(out, s.slice(last));
  return out;
}

// 地の文：生の「？」連続だけ gen で包み、残りはそのまま。
function _pushLiteral(out, text) {
  const parts = text.split(/(？+)/);
  for (const p of parts) {
    if (!p) continue;
    if (/^？+$/.test(p)) out.push({ text: p, cls: "gen", w: null });
    else out.push({ text: p, cls: "", w: null });
  }
}

// 語トークン：習得状況で表示を切り替える。
function _pushToken(out, id) {
  const w = WORDS[id];
  if (!w) { out.push({ text: "{" + id + "}", cls: "", w: null }); return; }
  const lv = wordLevel(id);
  if (lv >= 2)      out.push({ text: w.disp, cls: "w-known", w: id });
  else if (lv === 1) out.push({ text: w.frag || "？？？", cls: "w-frag", w: id });
  else               out.push({ text: "？？？", cls: "w-unknown", w: id });
}

// セグメント → HTML（ui が innerHTML に流す）。
//   freshId を渡すと、その語の習得セグメントに .is-reveal を付け、書き換えアニメを起こす。
function segmentsToHtml(segs, freshId) {
  let html = "";
  for (const sg of segs) {
    const fresh = (freshId && sg.w === freshId) ? " is-reveal" : "";
    const cls = ("seg " + (sg.cls || "")).trim() + fresh;
    const dataW = sg.w ? ' data-w="' + sg.w + '"' : "";
    html += '<span class="' + cls + '"' + dataW + ">" + _esc(sg.text) + "</span>";
  }
  return html;
}

// テンプレ文 → HTML（一発変換のショートカット）。
function renderText(str, freshId) {
  return segmentsToHtml(resolveSegments(str), freshId);
}

// テンプレ文 → 素のテキスト（読み上げ・計測・フォールバック用）。
function plainText(str) {
  return resolveSegments(str).map((s) => s.text).join("");
}

function _esc(t) {
  return String(t)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.wordLevel = wordLevel;
  window.isKnown = isKnown;
  window.isFrag = isFrag;
  window.wordDisp = wordDisp;
  window.vocabCount = vocabCount;
  window.learnedList = learnedList;
  window.learnWord = learnWord;
  window.learnFrag = learnFrag;
  window.learnPopupText = learnPopupText;
  window.resolveSegments = resolveSegments;
  window.segmentsToHtml = segmentsToHtml;
  window.renderText = renderText;
  window.plainText = plainText;
}
