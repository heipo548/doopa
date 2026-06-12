// 本作の心臓部 (§4.2)。{token} 入りテキストを「読める/読めない」へ解決する。
// 全テキストは描画のたびにここを通るので、ことばを習得した瞬間に
// 過去の看板や会話もすべて自動で読めるようになる。
import { WORDS } from "../data/words";
import { G } from "./wordSystem";

const TOKEN_RE = /\{([a-z0-9_]+)\}/g;

/** テキスト中のトークンを列挙（起動時検証用） */
export function extractTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) out.push(m[1]);
  return out;
}

// 文字列→安定した数値。マスクのちらつきが毎フレーム変わらないようにする種。
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 未習得語のノイズ表現。█ を基調に ■ を混ぜ、
 * 0.5秒ごと（shimmerTick ごと）に1文字だけ別の字に揺れる (§4.2)。
 */
export function maskWord(id: string, shimmerTick: number): string {
  const len = Math.max(1, (WORDS[id]?.text ?? "??").length);
  const seed = hashStr(id);
  const chars: string[] = [];
  for (let i = 0; i < len; i++) {
    chars.push((seed >> (i * 3)) % 5 === 0 ? "■" : "█");
  }
  if (len > 0) {
    const idx = (shimmerTick + seed) % len;
    chars[idx] = (shimmerTick + seed) % 2 === 0 ? "■" : "█";
  }
  return chars.join("");
}

/**
 * {token} を解決した表示用文字列を返す。
 * knows を差し替えられるようにしてあるのはデバッグ表示・検証のため。
 */
export function resolveText(
  raw: string,
  shimmerTick = 0,
  knows: (id: string) => boolean = (id) => G.hasWord(id)
): string {
  return raw.replace(TOKEN_RE, (_m, id: string) => {
    const w = WORDS[id];
    if (!w) return "？？"; // 起動時検証で弾くので通常ここには来ない
    return knows(id) ? w.text : maskWord(id, shimmerTick);
  });
}

/** マスク（█■）を含むか。含む間だけ再描画してちらつかせる */
export function hasMask(resolved: string): boolean {
  return resolved.includes("█") || resolved.includes("■");
}

/**
 * 全角前提の簡易折り返し。1行20字・最大lines行 (§4.3)。
 * 半角スペースは「息つぎ」なので行頭に来たら捨てる。
 */
export function wrapJa(text: string, perLine = 20, lines = 3): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n") {
      out.push(line);
      line = "";
      continue;
    }
    line += ch;
    if (line.length >= perLine) {
      out.push(line);
      line = "";
    }
  }
  if (line) out.push(line);
  return out.slice(0, lines).map((l, i) => (i === 0 ? l : l.replace(/^ /, "")));
}
