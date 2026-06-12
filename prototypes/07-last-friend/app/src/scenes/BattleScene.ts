// くちげんかバトル (§4.4)。
// ターン制: 相手のセリフ → ことばパレットから1語 → なかなおりゲージが動く。
// 数値は一切出さない。ゲージの満ち欠け・表情・SE だけで伝える。
// 敗北は存在しない: ゲージ0なら retryNode の一言が入って 30 から再開。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { BATTLES } from "../data/battles";
import { WORDS } from "../data/words";
import { ALL_NODES } from "../data/dialogues";
import { Telemetry } from "../systems/telemetry";
import { Sound } from "../systems/audio";
import { MessageWindow } from "../ui/messageWindow";
import { PaletteUI } from "../ui/paletteUI";

const EMO_TEX: Record<string, string> = {
  anger: "emo_anger",
  sadness: "emo_sadness",
  stubborn: "emo_stubborn",
};

export class BattleScene extends Phaser.Scene {
  private battleId = "e3";
  private oppSprites: Record<string, Phaser.GameObjects.Sprite> = {};
  private emoIcon!: Phaser.GameObjects.Image;
  private gaugeG!: Phaser.GameObjects.Graphics;

  constructor() {
    super("Battle");
  }

  init(data: { battleId?: string }) {
    this.battleId = data.battleId ?? "e3";
  }

  create() {
    const b = BATTLES[this.battleId];
    Sound.setBgm("none");
    this.add.rectangle(160, 90, 320, 180, PAL.shiro);
    this.add.rectangle(160, 36, 320, 72, PAL.wakaba, 0.35);
    this.add.rectangle(160, 71, 320, 3, PAL.midori, 0.5);
    // 白い主人公が しろ背景に溶けないための薄い帯
    this.add.rectangle(160, 97, 320, 38, PAL.momo, 0.18);

    // 相手たち（バトルは口論なので、向かい合うのではなく こちらを向いている）
    const xs = [120, 200];
    b.opponents.forEach((id, i) => {
      const s = this.add.sprite(xs[i] ?? 160, 52, `npc_${id}_0`).setScale(2);
      this.oppSprites[id] = s;
      this.tweens.add({
        targets: s,
        y: 50,
        duration: 700 + i * 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    });

    // 主人公（ことばを投げる側）
    this.add.sprite(160, 100, "player_0");

    this.emoIcon = this.add.image(0, 0, "emo_anger").setVisible(false);
    this.gaugeG = this.add.graphics();
    this.add.image(54, 90, "emo_anger").setScale(1); // 左端= もやもや
    this.add.image(268, 90, "p_heart"); // 右端= なかなおり
    this.drawGauge(b.gaugeStart, b.gaugeMax);

    this.cameras.main.fadeIn(350, 255, 246, 249);
    void this.runBattle();
  }

  private drawGauge(value: number, max: number) {
    const x = 64;
    const y = 84;
    const w = 196;
    const h = 12;
    const g = this.gaugeG;
    g.clear();
    g.fillStyle(PAL.shiro, 1).fillRect(x, y, w, h);
    g.lineStyle(2, PAL.kuro, 1).strokeRect(x, y, w, h);
    const pct = Phaser.Math.Clamp(value / max, 0, 1);
    // 低いと冷たい色、高いと あたたかい色（数値の代わりの表現）
    const color = pct < 0.35 ? PAL.fukasora : pct < 0.7 ? PAL.fuji : PAL.momo;
    g.fillStyle(color, 1).fillRect(x + 2, y + 2, Math.max(0, (w - 4) * pct), h - 4);
  }

  private tweenGauge(from: number, to: number, max: number): Promise<void> {
    return new Promise((resolve) => {
      const obj = { v: from };
      this.tweens.add({
        targets: obj,
        v: to,
        duration: 450,
        ease: "Cubic.Out",
        onUpdate: () => this.drawGauge(obj.v, max),
        onComplete: () => resolve(),
      });
    });
  }

  private react(speaker: string, delta: number) {
    const s = this.oppSprites[speaker];
    if (!s) return;
    if (delta >= 8) {
      this.tweens.add({ targets: s, scaleX: 2.3, scaleY: 2.3, duration: 140, yoyo: true });
      for (let i = 0; i < 3; i++) {
        const hp = this.add.image(s.x + (i - 1) * 12, s.y - 22, "p_heart");
        this.tweens.add({
          targets: hp,
          y: hp.y - 16,
          alpha: 0,
          delay: i * 90,
          duration: 600,
          onComplete: () => hp.destroy(),
        });
      }
    } else if (delta < 0) {
      this.tweens.add({ targets: s, x: s.x + 3, duration: 60, yoyo: true, repeat: 3 });
    } else {
      this.tweens.add({ targets: s, angle: { from: -4, to: 4 }, duration: 120, yoyo: true, repeat: 1 });
      this.tweens.add({ targets: s, angle: 0, delay: 400, duration: 80 });
    }
  }

  private async runBattle() {
    const b = BATTLES[this.battleId];
    const win = new MessageWindow(this);
    const palette = new PaletteUI(this);

    await win.show({
      speaker: "narration",
      text: "（ことばで ふたりの きもちを ほぐして あげよう）",
    });

    let gauge = b.gaugeStart;
    let pi = 0;

    while (true) {
      const ph = b.phases[pi];
      const sp = this.oppSprites[ph.speaker];
      if (sp) {
        this.emoIcon.setVisible(true).setPosition(sp.x + 14, sp.y - 22).setTexture(EMO_TEX[ph.emotion]);
        this.tweens.add({ targets: this.emoIcon, y: sp.y - 26, duration: 300, yoyo: true });
      }

      await win.show({ speaker: ph.speaker, text: ph.line });
      const wordId = await palette.ask(["kind", "world", "sad", "dark"]);
      if (!wordId) continue; // ことばが無い事態は仕様上起きない（保険）

      const w = WORDS[wordId];
      const delta = ph.matrix[wordId] ?? ph.categoryMatrix?.[w.category] ?? 1;

      // ことばが相手へ飛んでいく
      const fly = this.add
        .text(160, 96, w.text, { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.kuro })
        .setResolution(1)
        .setOrigin(0.5);
      const target = this.oppSprites[ph.speaker];
      await new Promise<void>((res) =>
        this.tweens.add({
          targets: fly,
          x: target?.x ?? 160,
          y: (target?.y ?? 52) + 14,
          alpha: { from: 1, to: 0.2 },
          duration: 380,
          ease: "Sine.In",
          onComplete: () => {
            fly.destroy();
            res();
          },
        })
      );

      if (delta >= 0) Sound.seGaugeUp();
      else Sound.seGaugeDown();
      this.react(ph.speaker, delta);

      const next = Phaser.Math.Clamp(gauge + delta, 0, b.gaugeMax);
      await this.tweenGauge(gauge, next, b.gaugeMax);
      gauge = next;

      if (gauge <= 0) {
        // 敗北ではなく「いったん深呼吸」(§4.4)
        const retry = ALL_NODES[b.retryNode];
        await win.show({ speaker: retry.speaker, text: retry.text });
        const reset = 30;
        await this.tweenGauge(gauge, reset, b.gaugeMax);
        gauge = reset;
        continue;
      }
      if (gauge >= ph.clearAt) {
        if (pi >= b.phases.length - 1) break;
        pi++;
        Sound.seHeal();
      }
    }

    // 勝利 → ワールドに戻って winNode の会話へ
    this.emoIcon.setVisible(false);
    Telemetry.battleWon();
    Sound.seHeal();
    this.cameras.main.fadeOut(500, 255, 246, 249);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("World", { runNode: BATTLES[this.battleId].winNode });
    });
  }
}
