// ことば習得カットイン (§4.1)。
// 画面中央に語が浮かび、コロンとした SE、世界がほんの少し色づく。
// 本作いちばんの「気持ちいい瞬間」なので、短くても必ず止めて見せる。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { WORDS } from "../data/words";
import { Sound } from "../systems/audio";

const CAT_HEX: Record<string, string> = {
  world: HEX.sora,
  kind: HEX.momo,
  sad: HEX.fukasora,
  dark: HEX.kofuji,
  truth: HEX.hikari,
};

export class Cutin {
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  play(wordId: string): Promise<void> {
    const w = WORDS[wordId];
    return new Promise((resolve) => {
      const s = this.scene;
      const dim = s.add.rectangle(160, 90, 320, 180, PAL.yoru, 0).setDepth(1700).setScrollFactor(0);
      const glow = s.add
        .rectangle(160, 86, w.text.length * 32 + 40, 40, PAL.hikari, 0)
        .setDepth(1701)
        .setScrollFactor(0);
      const txt = s.add
        .text(160, 84, w.text, {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: CAT_HEX[w.category] ?? HEX.shiro,
        })
        .setResolution(1)
        .setOrigin(0.5)
        .setScale(2) // 16px のドットをそのまま2倍（整数倍でにじまない）
        .setDepth(1702)
        .setScrollFactor(0)
        .setAlpha(0);
      const sub = s.add
        .text(160, 108, "あたらしい ことば", {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: HEX.shiro,
        })
        .setResolution(1)
        .setOrigin(0.5)
        .setDepth(1702)
        .setScrollFactor(0)
        .setAlpha(0);

      const sparks: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const sp = s.add.image(160, 84, "p_spark").setDepth(1703).setScrollFactor(0).setAlpha(0);
        sparks.push(sp);
        s.tweens.add({
          targets: sp,
          x: 160 + Math.cos(a) * 56,
          y: 84 + Math.sin(a) * 30,
          alpha: { from: 1, to: 0 },
          delay: 150,
          duration: 600,
        });
      }

      Sound.seLearn();
      s.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 150 });
      s.tweens.add({ targets: glow, fillAlpha: 0.25, duration: 250, delay: 100 });
      s.tweens.add({
        targets: txt,
        alpha: 1,
        scale: { from: 1.2, to: 2 },
        duration: 250,
        ease: "Back.Out",
      });
      s.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 250 });

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        s.input.keyboard?.off("keydown", skip);
        s.input.off("pointerdown", skip);
        s.tweens.add({
          targets: [dim, glow, txt, sub, ...sparks],
          alpha: 0,
          fillAlpha: 0,
          duration: 160,
          onComplete: () => {
            dim.destroy();
            glow.destroy();
            txt.destroy();
            sub.destroy();
            sparks.forEach((x) => x.destroy());
            resolve();
          },
        });
      };
      // 演出は短め＋スキップ可 (§4.1)
      const auto = s.time.delayedCall(1050, finish);
      const skip = () => {
        auto.remove();
        finish();
      };
      s.time.delayedCall(200, () => {
        s.input.keyboard?.on("keydown", skip);
        s.input.on("pointerdown", skip);
      });
    });
  }
}
