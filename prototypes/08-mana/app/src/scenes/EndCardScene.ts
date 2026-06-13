// EndCardScene — SPEC.md §13-5
// 巻物がひらくように現れる: タイトル / 妹の名「灯◇」 / 玉 x/3 / プレイ時間 /
// 「名付けることは、愛すること――製品版に続く」＋ 朱印「真名」

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { inkReveal } from '../fx/Transitions';
import { getCtx } from '../systems/context';

export class EndCardScene extends Phaser.Scene {
  constructor() {
    super('EndCard');
  }

  create(): void {
    const ctx = getCtx(this);
    this.cameras.main.setBackgroundColor(COLORS.paperStr);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'paper');
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0.18);
    inkReveal(this);

    const cx = GAME_WIDTH / 2;
    const mins = Math.floor(ctx.playtime / 60);
    const secs = Math.floor(ctx.playtime % 60);

    // 巻物の上下軸
    const rollers = this.add.graphics();
    for (const ry of [26, GAME_HEIGHT - 26] as const) {
      rollers.fillStyle(0x2a2426, 0.18);
      rollers.fillRoundedRect(70, ry - 7 + 3, GAME_WIDTH - 140, 16, 8);
      rollers.fillStyle(0x6a5238, 1);
      rollers.fillRoundedRect(66, ry - 8, GAME_WIDTH - 132, 16, 8);
      rollers.fillStyle(0x8a6a48, 1);
      rollers.fillRoundedRect(70, ry - 5, GAME_WIDTH - 140, 10, 5);
      rollers.fillStyle(0x4a3a28, 1);
      rollers.fillCircle(62, ry, 7);
      rollers.fillCircle(GAME_WIDTH - 62, ry, 7);
    }
    // 細い飾り罫
    const rule = this.add.graphics();
    rule.lineStyle(1.2, 0x8a8478, 0.6);
    rule.strokeRect(110, 56, GAME_WIDTH - 220, GAME_HEIGHT - 112);
    rule.lineStyle(0.8, 0x8a8478, 0.35);
    rule.strokeRect(118, 64, GAME_WIDTH - 236, GAME_HEIGHT - 128);

    const items: { y: number; text: string; size: string; color: string }[] = [
      { y: 128, text: '真名 -マナ-', size: '64px', color: COLORS.inkStr },
      { y: 196, text: '序章「灯し村」', size: '20px', color: COLORS.inkSoftStr },
      { y: 262, text: 'いもうとの な', size: '15px', color: '#8A8478' },
      { y: 302, text: '灯◇', size: '44px', color: '#E0A030' },
      { y: 372, text: `玉 ${ctx.inv.gems}/3　　プレイ時間 ${mins}:${String(secs).padStart(2, '0')}`, size: '19px', color: COLORS.inkSoftStr },
      { y: 432, text: '名付けることは、愛すること――', size: '22px', color: COLORS.inkStr },
      { y: 468, text: '製品版に続く', size: '17px', color: '#8A8478' },
    ];

    items.forEach((it, i) => {
      const t = this.add
        .text(cx, it.y, it.text, { fontFamily: FONT, fontSize: it.size, color: it.color })
        .setOrigin(0.5)
        .setAlpha(0)
        .setResolution(2);
      this.tweens.add({ targets: t, alpha: 1, duration: 800, delay: 500 + i * 480 });
      if (it.text === '灯◇') {
        this.tweens.add({
          targets: t,
          scale: { from: 1.04, to: 1 },
          duration: 1800,
          delay: 500 + i * 480,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });

    // 朱印「真名」を押す
    this.time.delayedCall(4200, () => {
      const seal = this.add.container(GAME_WIDTH - 190, 440).setAlpha(0).setScale(1.6).setAngle(-8);
      const sg = this.add.graphics();
      sg.fillStyle(0xb03030, 0.92);
      sg.fillRoundedRect(-26, -26, 52, 52, 6);
      sg.lineStyle(2, 0xf5f0e6, 0.7);
      sg.strokeRoundedRect(-21, -21, 42, 42, 4);
      const st = this.add
        .text(0, 0, '真\n名', { fontFamily: FONT, fontSize: '19px', color: '#F5F0E6', align: 'center', lineSpacing: -4 })
        .setOrigin(0.5)
        .setResolution(2);
      seal.add([sg, st]);
      this.tweens.add({
        targets: seal,
        alpha: 0.95,
        scale: 1,
        duration: 240,
        ease: 'Cubic.easeIn',
        onComplete: () => getCtx(this).audio.se('stamp'),
      });
    });

    this.time.delayedCall(5200, () => {
      const back = this.add
        .text(cx, 508, 'クリックで タイトルへ', { fontFamily: FONT, fontSize: '14px', color: '#A8A296' })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: back, alpha: 1, duration: 600 });
      this.input.once('pointerdown', () => {
        const c = getCtx(this);
        c.audio.stopBreeze();
        c.music.setMood('title');
        this.scene.start('Title');
      });
    });
  }
}
