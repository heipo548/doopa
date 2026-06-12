// EndCardScene — SPEC.md §13-5
// タイトル / 妹の名「灯◇」 / 玉 x/3 / プレイ時間 / 「名付けることは、愛すること――製品版に続く」

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { getCtx } from '../systems/context';

export class EndCardScene extends Phaser.Scene {
  constructor() {
    super('EndCard');
  }

  create(): void {
    const ctx = getCtx(this);
    this.cameras.main.setBackgroundColor(COLORS.paperStr);

    const cx = GAME_WIDTH / 2;
    const mins = Math.floor(ctx.playtime / 60);
    const secs = Math.floor(ctx.playtime % 60);

    const items: { y: number; text: string; size: string; color: string }[] = [
      { y: 130, text: '真名 -マナ-', size: '64px', color: COLORS.inkStr },
      { y: 200, text: '序章「灯し村」', size: '20px', color: COLORS.inkSoftStr },
      { y: 270, text: 'いもうとの な', size: '15px', color: '#8A8478' },
      { y: 310, text: '灯◇', size: '44px', color: '#E0A030' },
      { y: 380, text: `玉 ${ctx.inv.gems}/3　　プレイ時間 ${mins}:${String(secs).padStart(2, '0')}`, size: '19px', color: COLORS.inkSoftStr },
      { y: 440, text: '名付けることは、愛すること――', size: '22px', color: COLORS.inkStr },
      { y: 478, text: '製品版に続く', size: '17px', color: '#8A8478' },
    ];

    items.forEach((it, i) => {
      const t = this.add
        .text(cx, it.y, it.text, { fontFamily: FONT, fontSize: it.size, color: it.color })
        .setOrigin(0.5)
        .setAlpha(0)
        .setResolution(2);
      this.tweens.add({ targets: t, alpha: 1, duration: 800, delay: 400 + i * 500 });
    });

    this.time.delayedCall(5200, () => {
      const back = this.add
        .text(cx, 515, 'クリックで タイトルへ', { fontFamily: FONT, fontSize: '14px', color: '#A8A296' })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: back, alpha: 1, duration: 600 });
      this.input.once('pointerdown', () => {
        getCtx(this).audio.stopBreeze();
        this.scene.start('Title');
      });
    });
  }
}
