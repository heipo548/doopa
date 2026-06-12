// マップ文字グリッドの組み立てヘルパー。
// 40×30 を手打ちすると1文字のズレが事故になるので、
// 「矩形・線・点」で宣言的に塗る。出力はただの文字列配列（純データ）。
export type Grid = string[][];

export function makeGrid(w: number, h: number, fill: string): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

export function set(g: Grid, x: number, y: number, ch: string) {
  if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
}

export function fillRect(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(g, xx, yy, ch);
}

export function hline(g: Grid, y: number, x1: number, x2: number, ch: string) {
  for (let x = x1; x <= x2; x++) set(g, x, y, ch);
}

export function vline(g: Grid, x: number, y1: number, y2: number, ch: string) {
  for (let y = y1; y <= y2; y++) set(g, x, y, ch);
}

/** 外周 thickness マスを ch で囲む */
export function border(g: Grid, thickness: number, ch: string) {
  const h = g.length;
  const w = g[0].length;
  fillRect(g, 0, 0, w, thickness, ch);
  fillRect(g, 0, h - thickness, w, thickness, ch);
  fillRect(g, 0, 0, thickness, h, ch);
  fillRect(g, w - thickness, 0, thickness, h, ch);
}

export function scatter(g: Grid, ch: string, points: [number, number][]) {
  for (const [x, y] of points) set(g, x, y, ch);
}

export function toRows(g: Grid): string[] {
  return g.map((row) => row.join(""));
}
