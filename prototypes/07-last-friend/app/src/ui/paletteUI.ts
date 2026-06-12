// ことばパレット (§4.3 / §6.3)。
// 固定選択肢ではなく「覚えたことばから選んで返す」本作の返答UI。
// 語彙が増える＝言えることが増える、をそのまま画面にする。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { WORDS, CATEGORY_ORDER } from "../data/words";
import { STR } from "../data/strings";
import type { WordCategory } from "../types";
import { G } from "../systems/wordSystem";
import { Sound } from "../systems/audio";

const CAT_COLOR: Record<string, number> = {
  world: PAL.sora,
  kind: PAL.momo,
  sad: PAL.fukasora,
  dark: PAL.kofuji,
  truth: PAL.hikari,
};

const COLS = 3;
const VISIBLE_ROWS = 3;
const CELL_W = 100;
const CELL_H = 18;
const PANEL = { x: 6, y: 10, w: 308, h: 100 };

interface Item {
  id: string;
  text: string;
  category: WordCategory;
}

// ?debug=1 の自動テストがパレットを決定的に操作するための読み取り窓
export const PaletteDebug = { open: false, cursor: 0, items: [] as string[] };

export class PaletteUI {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private cells: { box: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];
  private hint: Phaser.GameObjects.Text;
  private upMark: Phaser.GameObjects.Text;
  private downMark: Phaser.GameObjects.Text;

  private items: Item[] = [];
  private cursor = 0;
  private scrollRow = 0;
  private openedAt = 0;
  private resolver: ((id: string) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1560).setScrollFactor(0).setVisible(false);

    this.bg = scene.add.graphics();
    this.root.add(this.bg);

    for (let i = 0; i < COLS * VISIBLE_ROWS; i++) {
      const box = scene.add.graphics();
      const label = scene.add
        .text(0, 0, "", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
        .setResolution(1);
      this.root.add(box);
      this.root.add(label);
      const idx = i;
      // 文字数でヒット領域が変わらないよう、チップ全体を固定サイズで当たり判定にする
      label.setInteractive(
        new Phaser.Geom.Rectangle(-2, -1, CELL_W - 4, CELL_H),
        Phaser.Geom.Rectangle.Contains
      );
      label.on("pointerover", () => this.focusVisible(idx));
      label.on("pointerdown", () => {
        if (this.visibleIndexToGlobal(idx) === this.cursor) this.choose();
        else this.focusVisible(idx);
      });
      this.cells.push({ box, label });
    }

    this.hint = scene.add
      .text(PANEL.x + 8, PANEL.y + PANEL.h - 20, "", {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.fukasora,
      })
      .setResolution(1);
    this.root.add(this.hint);

    this.upMark = scene.add
      .text(PANEL.x + PANEL.w - 18, PANEL.y + 14, "▲", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
      .setResolution(1);
    this.downMark = scene.add
      .text(PANEL.x + PANEL.w - 18, PANEL.y + 14 + VISIBLE_ROWS * CELL_H - 16, "▼", {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.kuro,
      })
      .setResolution(1);
    this.root.add(this.upMark);
    this.root.add(this.downMark);

    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.onKey(e));
  }

  get isOpen() {
    return this.root.visible;
  }

  /** カテゴリ内の覚えた語から1語選ばせる。語がなければ "" を返す */
  ask(categories: WordCategory[]): Promise<string> {
    this.items = [];
    for (const cat of CATEGORY_ORDER) {
      if (!categories.includes(cat)) continue;
      for (const w of Object.values(WORDS)) {
        if (w.category === cat && G.hasWord(w.id)) {
          this.items.push({ id: w.id, text: w.text, category: w.category });
        }
      }
    }
    if (this.items.length === 0) {
      // 何も言えない（通常は起きない）。空文字を返して default 分岐へ
      return Promise.resolve("");
    }
    this.cursor = 0;
    this.scrollRow = 0;
    this.openedAt = performance.now();
    this.root.setVisible(true);
    PaletteDebug.open = true;
    PaletteDebug.items = this.items.map((i) => i.id);
    this.redraw();
    Sound.seCursor();
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  private visibleIndexToGlobal(vi: number): number {
    return this.scrollRow * COLS + vi;
  }

  private focusVisible(vi: number) {
    const gi = this.visibleIndexToGlobal(vi);
    if (gi < this.items.length) {
      this.cursor = gi;
      Sound.seCursor();
      this.redraw();
    }
  }

  private onKey(e: KeyboardEvent) {
    if (!this.root.visible || !this.resolver) return;
    if (performance.now() - this.openedAt < 80) return;
    const cols = COLS;
    let c = this.cursor;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        c = Math.max(0, c - 1);
        break;
      case "ArrowRight":
      case "KeyD":
        c = Math.min(this.items.length - 1, c + 1);
        break;
      case "ArrowUp":
      case "KeyW":
        c = c - cols >= 0 ? c - cols : c;
        break;
      case "ArrowDown":
      case "KeyS":
        c = c + cols < this.items.length ? c + cols : c;
        break;
      case "KeyZ":
      case "Enter":
      case "Space":
        this.choose();
        return;
      default:
        return;
    }
    if (c !== this.cursor) {
      this.cursor = c;
      const row = Math.floor(c / cols);
      if (row < this.scrollRow) this.scrollRow = row;
      if (row >= this.scrollRow + VISIBLE_ROWS) this.scrollRow = row - VISIBLE_ROWS + 1;
      Sound.seCursor();
      this.redraw();
    }
  }

  private choose() {
    if (!this.resolver) return;
    const item = this.items[this.cursor];
    const r = this.resolver;
    this.resolver = null;
    this.root.setVisible(false);
    PaletteDebug.open = false;
    Sound.seDecide();
    r(item.id);
  }

  private redraw() {
    this.bg.clear();
    this.bg.fillStyle(PAL.shiro, 0.97).fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    this.bg.lineStyle(2, PAL.kuro, 1).strokeRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    this.bg.fillStyle(PAL.kuro, 1).fillRect(PANEL.x, PANEL.y, PANEL.w, 14);

    const totalRows = Math.ceil(this.items.length / COLS);
    this.upMark.setVisible(this.scrollRow > 0);
    this.downMark.setVisible(this.scrollRow + VISIBLE_ROWS < totalRows);

    for (let vi = 0; vi < this.cells.length; vi++) {
      const gi = this.visibleIndexToGlobal(vi);
      const cell = this.cells[vi];
      if (gi >= this.items.length) {
        cell.box.clear();
        cell.label.setVisible(false);
        continue;
      }
      const item = this.items[gi];
      const col = vi % COLS;
      const row = Math.floor(vi / COLS);
      const x = PANEL.x + 4 + col * CELL_W;
      const y = PANEL.y + 18 + row * CELL_H;
      cell.box.clear();
      if (gi === this.cursor) {
        cell.box.fillStyle(CAT_COLOR[item.category], 0.35).fillRect(x, y, CELL_W - 4, CELL_H - 2);
        cell.box.lineStyle(1, PAL.kuro, 1).strokeRect(x, y, CELL_W - 4, CELL_H - 2);
      }
      // カテゴリ色のしるし
      cell.box.fillStyle(CAT_COLOR[item.category], 1).fillRect(x + 2, y + 4, 4, 10);
      cell.label.setVisible(true);
      cell.label.setPosition(x + 9, y + 1);
      cell.label.setText(item.text);
    }

    const sel = this.items[this.cursor];
    this.hint.setText(sel ? WORDS[sel.id].hint : "");
    PaletteDebug.cursor = this.cursor;
  }
}

export const PALETTE_HELP = STR.paletteHelp;
