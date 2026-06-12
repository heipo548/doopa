// ナナシ — 名を失った存在。崩れた字画が渦巻く墨色のノイズ（SPEC.md §7-1 / §8-3）

import Phaser from 'phaser';
import { FONT } from '../config';
import { attachSwirl, inkBurst } from '../fx/InkParticles';

export class Nameless extends Phaser.GameObjects.Container {
  readonly entityId: string;
  private marker: Phaser.GameObjects.Text;
  private swirl: Phaser.GameObjects.Particles.ParticleEmitter;
  private strokes: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, entityId: string, x: number, y: number, size: number, tint = 0x262022) {
    super(scene, x, y);
    this.entityId = entityId;

    const blob = scene.add.graphics();
    blob.fillStyle(tint, 0.92);
    blob.fillCircle(0, 0, size);
    blob.fillStyle(tint, 0.5);
    blob.fillCircle(size * 0.35, -size * 0.3, size * 0.55);
    blob.fillCircle(-size * 0.4, size * 0.25, size * 0.5);
    this.add(blob);

    // 崩れた字画（読めない線がちらつく）
    const strokeChars = ['丿', '乀', '亅', '丶'];
    for (let i = 0; i < 3; i++) {
      const s = scene.add
        .text(
          (i - 1) * size * 0.4,
          ((i % 2) - 0.5) * size * 0.5,
          strokeChars[(entityId.length + i) % strokeChars.length],
          { fontFamily: FONT, fontSize: `${Math.max(14, size * 0.5)}px`, color: '#8A8482' },
        )
        .setOrigin(0.5)
        .setAlpha(0.5)
        .setAngle((i * 67) % 360);
      this.strokes.push(s);
      this.add(s);
      scene.tweens.add({
        targets: s,
        alpha: { from: 0.15, to: 0.7 },
        angle: s.angle + 20,
        duration: 900 + i * 350,
        yoyo: true,
        repeat: -1,
      });
    }

    this.marker = scene.add
      .text(0, -size - 28, '？', { fontFamily: FONT, fontSize: '26px', color: '#4A4A4A' })
      .setOrigin(0.5)
      .setVisible(false);
    this.add(this.marker);
    scene.tweens.add({
      targets: this.marker,
      y: this.marker.y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.tweens.add({
      targets: this,
      scaleX: { from: 0.95, to: 1.06 },
      scaleY: { from: 1.05, to: 0.94 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.add.existing(this);
    this.setDepth(10 + y * 0.001);
    this.swirl = attachSwirl(scene, this, size + 8);
  }

  setMarkerVisible(v: boolean): void {
    this.marker.setVisible(v);
  }

  /** 名付け成功 → 墨が晴れて消える */
  dissolve(onDone?: () => void): void {
    const scene = this.scene;
    this.swirl.stop();
    inkBurst(scene, this.x, this.y, { n: 14 });
    scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.swirl.destroy();
        this.destroy();
        onDone?.();
      },
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.swirl.active) this.swirl.destroy();
    super.destroy(fromScene);
  }
}
