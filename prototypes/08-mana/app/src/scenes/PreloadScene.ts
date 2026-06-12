// PreloadScene — フォント読み込み（FontFace API を await §3/§16）＋ テクスチャ生成

import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { makeInkTextures } from '../fx/InkParticles';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0D0C0B');
    const loading = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '墨を磨っています……', {
        fontFamily: 'serif',
        fontSize: '18px',
        color: COLORS.paperStr,
      })
      .setOrigin(0.5);

    makeInkTextures(this);

    const fontLoad = Promise.all([
      document.fonts.load('500 32px "Shippori Mincho"'),
      document.fonts.load('700 32px "Shippori Mincho"'),
    ]);
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 4000); // オフライン時は serif フォールバックで続行
    });

    void Promise.race([fontLoad, timeout]).then(() => {
      if (!this.scene.isActive('Preload')) return;
      loading.destroy();
      this.scene.start('Title');
    });
  }
}
