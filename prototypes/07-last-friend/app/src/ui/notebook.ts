// ことばノート（Cキー §4.1）。
// カテゴリ別タブ。未習得は数も出さず、覚えた語だけが increments していく。
// 最終ページ（？？？）には空枠が1つだけ——体験版では永遠に埋まらない (§4.1)。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { WORDS, CATEGORY_ORDER, CATEGORY_LABEL } from "../data/words";
import { STR } from "../data/strings";
import { G } from "../systems/wordSystem";
import { Sound } from "../systems/audio";

const CAT_COLOR: Record<string, number> = {
  world: PAL.sora,
  kind: PAL.momo,
  sad: PAL.fukasora,
  dark: PAL.kofuji,
  truth: PAL.hikari,
};

const LIST_TOP = 36;
const ROW_H = 18;
const VISIBLE = 5;

export class Notebook {
  private root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private srcText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;

  private tab = 0;
  private cursor = 0;
  private scroll = 0;
  private openedAt = 0;
  private resolver: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1580).setScrollFactor(0).setVisible(false);
    this.g = scene.add.graphics();
    this.root.add(this.g);

    CATEGORY_ORDER.forEach((cat, i) => {
      const t = scene.add
        .text(8 + i * 62, 8, CATEGORY_LABEL[cat], {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: HEX.kuro,
        })
        .setResolution(1)
        .setInteractive({ useHandCursor: true });
      t.on("pointerdown", () => {
        this.tab = i;
        this.cursor = 0;
        this.scroll = 0;
        Sound.seCursor();
        this.redraw();
      });
      this.root.add(t);
      this.tabTexts.push(t);
    });

    for (let i = 0; i < VISIBLE; i++) {
      const t = scene.add
        .text(16, LIST_TOP + i * ROW_H, "", {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: HEX.kuro,
        })
        .setResolution(1);
      this.root.add(t);
      this.rowTexts.push(t);
    }

    this.hintText = scene.add
      .text(12, 132, "", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.fukasora })
      .setResolution(1);
    this.srcText = scene.add
      .text(12, 150, "", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.tsuchi })
      .setResolution(1);
    this.helpText = scene.add
      .text(12, 166, STR.notebookHelp, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
      .setResolution(1)
      .setAlpha(0.6);
    this.root.add(this.hintText);
    this.root.add(this.srcText);
    this.root.add(this.helpText);

    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.onKey(e));
  }

  get isOpen() {
    return this.root.visible;
  }

  open(): Promise<void> {
    this.tab = 0;
    this.cursor = 0;
    this.scroll = 0;
    // 開いた C キーと同じ押下で閉じてしまうのを防ぐ
    this.openedAt = performance.now();
    this.root.setVisible(true);
    Sound.seDecide();
    this.redraw();
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  private close() {
    if (!this.resolver) return;
    const r = this.resolver;
    this.resolver = null;
    this.root.setVisible(false);
    Sound.seCancel();
    r();
  }

  private entries(): { text: string; hint: string; src: string }[] {
    const cat = CATEGORY_ORDER[this.tab];
    if (cat === "truth") {
      // 永遠に埋まらない空枠（伏線）
      return [{ text: STR.notebookSlotUnknown, hint: "･････", src: "" }];
    }
    return Object.values(WORDS)
      .filter((w) => w.category === cat && G.hasWord(w.id))
      .map((w) => ({
        text: w.text,
        hint: w.hint,
        src: G.learnedMeta[w.id]?.src ?? "",
      }));
  }

  private onKey(e: KeyboardEvent) {
    if (!this.root.visible || !this.resolver) return;
    if (performance.now() - this.openedAt < 80) return;
    const list = this.entries();
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.tab = (this.tab + CATEGORY_ORDER.length - 1) % CATEGORY_ORDER.length;
        this.cursor = 0;
        this.scroll = 0;
        Sound.seCursor();
        break;
      case "ArrowRight":
      case "KeyD":
        this.tab = (this.tab + 1) % CATEGORY_ORDER.length;
        this.cursor = 0;
        this.scroll = 0;
        Sound.seCursor();
        break;
      case "ArrowUp":
      case "KeyW":
        if (this.cursor > 0) {
          this.cursor--;
          if (this.cursor < this.scroll) this.scroll = this.cursor;
          Sound.seCursor();
        }
        break;
      case "ArrowDown":
      case "KeyS":
        if (this.cursor < list.length - 1) {
          this.cursor++;
          if (this.cursor >= this.scroll + VISIBLE) this.scroll = this.cursor - VISIBLE + 1;
          Sound.seCursor();
        }
        break;
      case "KeyX":
      case "Escape":
      case "KeyC":
        this.close();
        return;
      default:
        return;
    }
    this.redraw();
  }

  private redraw() {
    const cat = CATEGORY_ORDER[this.tab];
    this.g.clear();
    this.g.fillStyle(PAL.shiro, 0.98).fillRect(0, 0, 320, 180);
    this.g.lineStyle(2, PAL.kuro, 1).strokeRect(2, 2, 316, 176);
    // タブの下線（選択中カテゴリの色）
    this.g.fillStyle(CAT_COLOR[cat], 1).fillRect(8 + this.tab * 62, 26, 56, 3);
    this.g.fillStyle(PAL.kuro, 0.08).fillRect(6, 128, 308, 36);

    this.tabTexts.forEach((t, i) => t.setAlpha(i === this.tab ? 1 : 0.45));

    const list = this.entries();
    for (let i = 0; i < VISIBLE; i++) {
      const idx = this.scroll + i;
      const row = this.rowTexts[i];
      if (idx >= list.length) {
        row.setText(idx === 0 && i === 0 ? STR.notebookEmpty : "");
        row.setAlpha(0.4);
        continue;
      }
      const mark = idx === this.cursor ? "▶ " : "　 ";
      row.setText(mark + list[idx].text);
      row.setAlpha(1);
    }

    const sel = list[this.cursor];
    this.hintText.setText(sel ? sel.hint : "");
    this.srcText.setText(sel?.src ? `――${sel.src}` : "");
  }
}
