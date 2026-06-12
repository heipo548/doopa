// E7: しろいカード (§9 E7)。
// 「きょうの ことばは ここまで」→ タイトルへ。以後 ？？？ が解禁される。
// どこでも返し要素はここ止まり（GAME_DESIGN §13: 深層は本編まで出さない）。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { STR } from "../data/strings";
import { Save } from "../systems/save";
import { Sound } from "../systems/audio";

export class EndingScene extends Phaser.Scene {
  constructor() {
    super("Ending");
  }

  create() {
    Sound.setBgm("none");
    this.add.rectangle(160, 90, 320, 180, PAL.shiro);
    this.cameras.main.fadeIn(900, 255, 246, 249);

    const line1 = this.add
      .text(160, 72, STR.endCard1, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
      .setResolution(1)
      .setOrigin(0.5)
      .setAlpha(0);
    const line2 = this.add
      .text(160, 98, STR.endCard2, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
      .setResolution(1)
      .setOrigin(0.5)
      .setAlpha(0);
    const prompt = this.add
      .text(300, 164, "▼", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.komomo })
      .setResolution(1)
      .setAlpha(0);

    this.tweens.add({ targets: line1, alpha: 1, duration: 800, delay: 500 });
    this.tweens.add({ targets: line2, alpha: 0.92, duration: 800, delay: 1600 });
    // ███ の行は かすかに明滅させて「まだ読めない」気配を残す
    this.tweens.add({
      targets: line2,
      alpha: { from: 0.92, to: 0.7 },
      duration: 700,
      delay: 2600,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.add({ targets: prompt, alpha: 1, duration: 300, delay: 2800 });

    let accepted = false;
    const done = () => {
      if (accepted) return;
      accepted = true;
      Sound.seDecide();
      Save.markCleared(); // ここで ？？？ が解禁される (§4.8)
      this.cameras.main.fadeOut(900, 21, 18, 31);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Title");
      });
    };
    this.time.delayedCall(2800, () => {
      this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
        if (["KeyZ", "Enter", "Space"].includes(e.code)) done();
      });
      this.input.on("pointerdown", done);
    });
  }
}
