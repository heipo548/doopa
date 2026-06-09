/*
 * words.js — 言葉システム（？？？ ↔ 覚えた語 の 描き換え）。このゲームの“見え方”を司る。
 *
 * 役割：
 *   ・isKnown(id)        … その言葉を覚えたか。
 *   ・learnWord(id)      … 覚える（順番を記録・直近語をハイライト・フラグ learned_<id> を立てる）。
 *   ・renderText(str)    … 文中の {{id}} を「覚えた語(色つき)」or「？？？」に置換 ★本作の心臓。
 *   ・knownWords()       … 覚えた語を WORD_ORDER 順で返す（図鑑/エンディング）。
 *
 * 覚えた瞬間、画面を render し直すと、同じ {{id}} が一斉に “読める言葉” に変わる
 * ＝「覚える言葉で世界の見え方が変わる」を、テキストの描き換えで体感させる。
 *
 * ※ ビルドなし・依存ゼロ。末尾で window へ明示エクスポート。
 */

function isKnown(id) { return !!(game && game.words && game.words[id]); }
function toneOfWord(id) { return (WORDS[id] && WORDS[id].tone) || "neutral"; }

// 言葉を覚える。覚えた語によっては世界トーンが ほんの少し動く（やわらか→明・とげ→暗）。
function learnWord(id) {
  if (!game || !WORDS[id]) return false;
  if (game.words[id]) return false; // すでに覚えている
  game.words[id] = true;
  game.wordsOrder.push(id);
  game.lastLearned = id;
  setFlag("learned_" + id);
  // 覚えるだけでも、語のトーンが世界をほんのり染める（小さめ）。
  const tn = toneOfWord(id);
  if (tn === "yawa") adjustTone(2);
  else if (tn === "toge") adjustTone(-2);
  log("「" + WORDS[id].text + "」を おぼえた。");
  return true;
}

// HTML エスケープ（覚えた語/？？？以外の地の文を安全に出す）。
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// {{id}} を置換。覚えていれば色つきの語、未習得なら ？？？。
//   直近に覚えた語は .justlearned を付けて書き換え演出（ui/css が拾う）。
function renderText(str) {
  if (str == null) return "";
  const parts = String(str).split(/(\{\{\w+\}\})/g);
  let html = "";
  for (const part of parts) {
    const m = /^\{\{(\w+)\}\}$/.exec(part);
    if (!m) { html += escapeHtml(part); continue; }
    const id = m[1];
    const w = WORDS[id];
    if (!w) { html += escapeHtml(part); continue; }
    if (isKnown(id)) {
      const cls = w.tone === "toge" ? "w toge" : w.tone === "yawa" ? "w yawa" : "w";
      const hl = (game && game.lastLearned === id) ? " justlearned" : "";
      html += '<span class="' + cls + hl + '">' + escapeHtml(w.text) + "</span>";
    } else {
      html += '<span class="w unknown">？？？</span>';
    }
  }
  return html;
}

// 覚えた語を WORD_ORDER 順で（図鑑・エンディングのモンタージュ用）。
function knownWords() { return WORD_ORDER.filter(isKnown); }
function vocabCount() { return game && game.words ? Object.keys(game.words).length : 0; }

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.isKnown = isKnown;
  window.toneOfWord = toneOfWord;
  window.learnWord = learnWord;
  window.escapeHtml = escapeHtml;
  window.renderText = renderText;
  window.knownWords = knownWords;
  window.vocabCount = vocabCount;
}
