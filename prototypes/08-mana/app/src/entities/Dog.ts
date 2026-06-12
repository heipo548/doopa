// 犬 —「犬」の字が小さく実体化した姿（SPEC.md §14 の字アセット好例）
// 追従AI: 距離60で停止（§8-4）

import Phaser from 'phaser';
import { FONT } from '../config';
import { inkBurst } from '../fx/InkParticles';

export class Dog extends Phaser.GameObjects.Container {
  private glyph: Phaser.GameObjects.Text;
  private busy = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const shadow = scene.add.ellipse(0, 6, 26, 8, 0x2a2426, 0.15);
    this.glyph = scene.add
      .text(0, -8, '犬', { fontFamily: FONT, fontSize: '34px', color: '#7A4A28' })
      .setOrigin(0.5)
      .setResolution(2);
    this.add([shadow, this.glyph]);
    scene.add.existing(this);
    this.setDepth(10 + y * 0.001);
    // しっぽを振るように字がゆれる
    scene.tweens.add({ targets: this.glyph, angle: { from: -6, to: 6 }, duration: 420, yoyo: true, repeat: -1 });
  }

  follow(targetX: number, targetY: number, delta: number): void {
    if (this.busy) return;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 60) {
      const speed = Math.min(170, dist * 1.6);
      this.x += (dx / dist) * speed * (delta / 1000);
      this.y += (dy / dist) * speed * (delta / 1000);
      this.setDepth(10 + this.y * 0.001);
    }
  }

  /** 掘り跡を掘る演出 */
  dig(scene: Phaser.Scene, x: number, y: number, onDone: () => void): void {
    this.busy = true;
    scene.tweens.add({
      targets: this,
      x,
      y: y - 6,
      duration: 350,
      onComplete: () => {
        if (!this.active) return;
        scene.tweens.add({
          targets: this.glyph,
          y: { from: -8, to: -2 },
          duration: 110,
          yoyo: true,
          repeat: 5,
          onStart: () => inkBurst(scene, x, y, { n: 8, color: 0x6a6055 }),
          onComplete: () => {
            this.busy = false;
            onDone();
          },
        });
      },
    });
  }

  warpTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}
