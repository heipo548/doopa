// ナナシ — 名を失った存在。崩れた字画が渦巻く墨色のノイズ（SPEC.md §7-1 / §8-3）
// 演出: 多層ブロブの蠢き・周回する欠けた字画・墨の滴り・（大型のみ）ほの白い眼

import Phaser from 'phaser';
import { FONT } from '../config';
import { attachSwirl, inkBurst } from '../fx/InkParticles';

export class Nameless extends Phaser.GameObjects.Container {
  readonly entityId: string;
  private marker: Phaser.GameObjects.Text;
  private swirl: Phaser.GameObjects.Particles.ParticleEmitter;
  private dripTimer: Phaser.Time.TimerEvent;
  private orbiters: { t: Phaser.GameObjects.Text; r: number; speed: number; phase: number }[] = [];
  private orbitTween: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, entityId: string, x: number, y: number, size: number, tint = 0x262022) {
    super(scene, x, y);
    this.entityId = entityId;

    // にじみ（本体より一回り大きい薄墨）
    const halo = scene.add.image(0, 0, 'inkblob').setTint(tint).setAlpha(0.18).setScale((size * 2.6) / 128);
    this.add(halo);
    scene.tweens.add({
      targets: halo,
      scale: halo.scale * 1.12,
      alpha: 0.1,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 多層ブロブ（それぞれ別周期で蠢く）
    const lobes: [number, number, number, number][] = [
      [0, 0, 1, 0.95],
      [size * 0.38, -size * 0.3, 0.62, 0.6],
      [-size * 0.42, size * 0.24, 0.55, 0.55],
      [size * 0.1, size * 0.38, 0.5, 0.45],
    ];
    lobes.forEach(([lx, ly, ls, la], i) => {
      const lobe = scene.add.image(lx, ly, 'inkblob').setTint(tint).setAlpha(la).setScale((size * ls * 2) / 128);
      lobe.setAngle(Math.random() * 360);
      this.add(lobe);
      scene.tweens.add({
        targets: lobe,
        scale: lobe.scale * (1.06 + i * 0.03),
        angle: lobe.angle + (i % 2 === 0 ? 14 : -14),
        duration: 900 + i * 360,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
    // 中心の濃い核
    const core = scene.add.image(0, 0, 'inkblob').setTint(0x14110e).setAlpha(0.9).setScale((size * 1.1) / 128);
    this.add(core);
    scene.tweens.add({
      targets: core,
      scale: core.scale * 0.92,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 大型（おおきな影・嵐）には、ほの白い眼
    if (size >= 50) {
      const eyes = scene.add.graphics();
      eyes.fillStyle(0xd8d2c4, 0.5);
      eyes.fillEllipse(-size * 0.22, -size * 0.3, size * 0.13, size * 0.07);
      eyes.fillEllipse(size * 0.22, -size * 0.3, size * 0.13, size * 0.07);
      this.add(eyes);
      scene.tweens.add({
        targets: eyes,
        alpha: { from: 0.25, to: 0.7 },
        duration: 2100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 周回する欠けた字画
    const strokeChars = ['丿', '乀', '亅', '丶', '乚', '一'];
    const n = size >= 50 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const t = scene.add
        .text(0, 0, strokeChars[(entityId.length + i) % strokeChars.length], {
          fontFamily: FONT,
          fontSize: `${Math.max(13, size * 0.42)}px`,
          color: '#8A8482',
        })
        .setOrigin(0.5)
        .setAlpha(0.55)
        .setAngle(Math.random() * 360);
      this.add(t);
      this.orbiters.push({
        t,
        r: size * (0.85 + Math.random() * 0.5),
        speed: (0.4 + Math.random() * 0.5) * (i % 2 === 0 ? 1 : -1),
        phase: (i / n) * Math.PI * 2,
      });
    }
    // 角度プロパティを進めて周回させる（counter tween）
    const state = { a: 0 };
    this.orbitTween = scene.tweens.add({
      targets: state,
      a: Math.PI * 2,
      duration: 6000,
      repeat: -1,
      onUpdate: () => {
        if (!this.active) return;
        for (const o of this.orbiters) {
          const ang = state.a * o.speed + o.phase;
          o.t.setPosition(Math.cos(ang) * o.r, Math.sin(ang) * o.r * 0.7);
          o.t.angle += 0.3;
          o.t.setAlpha(0.25 + (Math.sin(ang * 2) + 1) * 0.2);
        }
      },
    });

    // 墨の滴り
    this.dripTimer = scene.time.addEvent({
      delay: 1400 + Math.random() * 1200,
      loop: true,
      callback: () => {
        if (!this.active || !this.visible) return;
        const dx = (Math.random() - 0.5) * size;
        const drop = scene.add
          .image(this.x + dx, this.y + size * 0.5, 'inkdot')
          .setTint(tint)
          .setScale(1.4)
          .setDepth(this.depth - 1);
        scene.tweens.add({
          targets: drop,
          y: drop.y + 14 + Math.random() * 10,
          scaleX: 2.2,
          scaleY: 0.5,
          alpha: 0,
          duration: 650,
          ease: 'Cubic.easeIn',
          onComplete: () => drop.destroy(),
        });
      },
    });

    this.marker = scene.add
      .text(0, -size - 28, '？', { fontFamily: FONT, fontSize: '26px', color: '#4A4A4A' })
      .setOrigin(0.5)
      .setVisible(false)
      .setResolution(2);
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
      scaleX: { from: 0.96, to: 1.05 },
      scaleY: { from: 1.04, to: 0.95 },
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
    this.dripTimer.remove();
    inkBurst(scene, this.x, this.y, { n: 16 });
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
    this.dripTimer?.remove();
    this.orbitTween?.remove();
    if (this.swirl?.active) this.swirl.destroy();
    super.destroy(fromScene);
  }
}
