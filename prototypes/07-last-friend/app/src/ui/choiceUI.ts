// 固定選択肢ボックス。E4 の分岐など「ことば以外の行動」を選ぶときだけ使う。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { Sound } from "../systems/audio";

export interface ChoiceItem {
  label: string;
  next: string;
}

export class ChoiceUI {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private cursorMark: Phaser.GameObjects.Text;
  private items: ChoiceItem[] = [];
  private cursor = 0;
  private openedAt = 0;
  private resolver: ((c: ChoiceItem) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(1560).setScrollFactor(0).setVisible(false);
    this.bg = scene.add.graphics();
    this.root.add(this.bg);
    this.cursorMark = scene.add
      .text(0, 0, "▶", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.komomo })
      .setResolution(1);
    this.root.add(this.cursorMark);
    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.onKey(e));
  }

  get isOpen() {
    return this.root.visible;
  }

  ask(items: ChoiceItem[]): Promise<ChoiceItem> {
    this.items = items;
    this.cursor = 0;
    this.openedAt = performance.now();
    const w = Math.max(...items.map((i) => i.label.length)) * 16 + 36;
    const h = items.length * 18 + 12;
    const x = 320 - w - 6;
    const y = 116 - h - 4;

    this.bg.clear();
    this.bg.fillStyle(PAL.shiro, 0.97).fillRect(x, y, w, h);
    this.bg.lineStyle(2, PAL.kuro, 1).strokeRect(x, y, w, h);

    for (const t of this.texts) t.destroy();
    this.texts = [];
    items.forEach((item, i) => {
      const t = this.scene.add
        .text(x + 24, y + 6 + i * 18, item.label, {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: HEX.kuro,
        })
        .setResolution(1)
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => {
        this.cursor = i;
        this.layoutCursor(x, y);
        Sound.seCursor();
      });
      t.on("pointerdown", () => this.choose());
      this.root.add(t);
      this.texts.push(t);
    });
    this.layoutCursor(x, y);
    this.root.setVisible(true);
    Sound.seCursor();
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  private lastXY = { x: 0, y: 0 };
  private layoutCursor(x: number, y: number) {
    this.lastXY = { x, y };
    this.cursorMark.setPosition(x + 6, y + 6 + this.cursor * 18);
  }

  private onKey(e: KeyboardEvent) {
    if (!this.root.visible || !this.resolver) return;
    if (performance.now() - this.openedAt < 80) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      this.cursor = (this.cursor + this.items.length - 1) % this.items.length;
      this.layoutCursor(this.lastXY.x, this.lastXY.y);
      Sound.seCursor();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      this.cursor = (this.cursor + 1) % this.items.length;
      this.layoutCursor(this.lastXY.x, this.lastXY.y);
      Sound.seCursor();
    } else if (["KeyZ", "Enter", "Space"].includes(e.code)) {
      this.choose();
    }
  }

  private choose() {
    if (!this.resolver) return;
    const r = this.resolver;
    this.resolver = null;
    this.root.setVisible(false);
    Sound.seDecide();
    r(this.items[this.cursor]);
  }
}
