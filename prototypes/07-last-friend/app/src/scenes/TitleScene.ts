// タイトル画面 (§4.8)。状態機械:
//   初回起動      : はじめから / ？？？（選べない・カーソルが合うとノイズ）
//   セーブあり    : つづきから / はじめから / ？？？
//   体験版クリア後: ？？？ が選べるようになり、1行だけ表示して戻る
// 本編拡張ポイント (§15): クリア後は？？？を「むこう」へ差し替え、
// 裏周回（うらがわ）開始処理をこの状態機械に追加する。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { STR } from "../data/strings";
import { Save } from "../systems/save";
import { Sound } from "../systems/audio";

interface MenuItem {
  key: "continue" | "new" | "secret";
  label: string;
}

export class TitleScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private cursor = 0;
  private cursorMark!: Phaser.GameObjects.Text;
  private noiseRect!: Phaser.GameObjects.Rectangle;
  private secretOpen = false;
  private busy = false;

  constructor() {
    super("Title");
  }

  create() {
    this.busy = false;
    this.secretOpen = false;
    this.add.rectangle(160, 90, 320, 180, PAL.yoru);

    // 星をまたたかせる（タイトルは しずかな よる）
    for (let i = 0; i < 14; i++) {
      const star = this.add.image(12 + ((i * 53) % 300), 8 + ((i * 31) % 70), "p_star").setAlpha(0.5);
      this.tweens.add({
        targets: star,
        alpha: { from: 0.15, to: 0.9 },
        duration: 900 + i * 120,
        yoyo: true,
        repeat: -1,
      });
    }

    this.add
      .text(160, 46, STR.title, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.hikari })
      .setResolution(1)
      .setOrigin(0.5)
      .setScale(2);
    this.add
      .text(160, 68, `― ${STR.subtitle} ―`, {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.fuji,
      })
      .setResolution(1)
      .setOrigin(0.5);

    const hasGame = Save.hasGame();
    this.items = [];
    if (hasGame) this.items.push({ key: "continue", label: STR.menuContinue });
    this.items.push({ key: "new", label: STR.menuNew });
    this.items.push({ key: "secret", label: STR.menuSecret });

    this.texts = this.items.map((item, i) => {
      const enabled = item.key !== "secret" || Save.isCleared();
      const t = this.add
        .text(160, 102 + i * 20, item.label, {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: enabled ? HEX.shiro : HEX.kuro,
        })
        .setResolution(1)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => this.focus(i));
      t.on("pointerdown", () => this.select());
      return t;
    });

    this.cursorMark = this.add
      .text(0, 0, "▶", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.ki })
      .setResolution(1);

    this.noiseRect = this.add.rectangle(160, 90, 320, 180, PAL.shiro, 0).setDepth(50);

    this.add
      .text(160, 168, "Ｚ けってい　／　やじるし うごく", {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.shiro,
      })
      .setResolution(1)
      .setOrigin(0.5)
      .setAlpha(0.4);

    this.focus(0, true);

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.busy) return;
      if (this.secretOpen) {
        this.secretOpen = false;
        this.children.getByName("secretLine")?.destroy();
        this.children.getByName("secretBg")?.destroy();
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") this.focus((this.cursor + this.items.length - 1) % this.items.length);
      else if (e.code === "ArrowDown" || e.code === "KeyS") this.focus((this.cursor + 1) % this.items.length);
      else if (["KeyZ", "Enter", "Space"].includes(e.code)) this.select();
    });
  }

  private focus(i: number, silent = false) {
    this.cursor = i;
    const t = this.texts[i];
    this.cursorMark.setPosition(t.x - t.displayWidth / 2 - 18, t.y - 8);
    if (!silent) Sound.seCursor();
    // ？？？ にカーソルが合うと一瞬ノイズが走る (§4.8)
    if (this.items[i].key === "secret" && !Save.isCleared()) this.flickNoise();
  }

  private flickNoise() {
    Sound.seNoise();
    this.noiseRect.setFillStyle(PAL.shiro, 0.25);
    this.time.delayedCall(60, () => this.noiseRect.setFillStyle(PAL.shiro, 0));
  }

  private select() {
    if (this.busy || this.secretOpen) return;
    const item = this.items[this.cursor];
    if (item.key === "secret") {
      if (!Save.isCleared()) {
        this.flickNoise(); // 選べない。ノイズだけが応える
        return;
      }
      // クリア後: 1行だけ (§4.8)
      Sound.seDecide();
      this.secretOpen = true;
      this.add.rectangle(160, 90, 260, 28, PAL.yoru, 0.9).setName("secretBg").setDepth(60);
      this.add
        .text(160, 90, STR.secretLine, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.hikari })
        .setResolution(1)
        .setOrigin(0.5)
        .setName("secretLine")
        .setDepth(61);
      return;
    }
    this.busy = true;
    Sound.seDecide();
    if (item.key === "new") Save.newGame();
    else Save.loadIntoG();
    this.cameras.main.fadeOut(400, 21, 18, 31);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("World", {});
    });
  }
}
