// ColorSystem — モノクロ→彩色（SPEC.md §7-8 / §12 J1, J4）
// 全表示物は {mono, color} の2プレートを持つ。クロスフェードに加え、
// 「色の波紋」リング、ゾーン地面には（WebGL時）中心から色が滲み広がるマスク・リビール。

import Phaser from 'phaser';
import { inkBurst } from '../fx/InkParticles';

type Fadeable = Phaser.GameObjects.GameObject & { alpha: number; x?: number; y?: number };

interface PairEntry {
  mono: Fadeable[];
  color: Fadeable[];
  zone?: string;
  colored: boolean;
  cx: number;
  cy: number;
}

export class ColorSystem {
  private pairs = new Map<string, PairEntry>();

  /** color 側は alpha0 で登録される */
  register(id: string, mono: Fadeable[], color: Fadeable[], at: { x: number; y: number }, zone?: string): void {
    for (const c of color) c.alpha = 0;
    this.pairs.set(id, { mono, color, zone, colored: false, cx: at.x, cy: at.y });
  }

  isColorized(id: string): boolean {
    return this.pairs.get(id)?.colored ?? false;
  }

  /** J1: ヂュイーン 0.8s ＋ 墨はじけ8粒 ＋ 色の波紋 */
  colorize(scene: Phaser.Scene, id: string, opts: { dur?: number; burst?: boolean; ripple?: boolean } = {}): void {
    const p = this.pairs.get(id);
    if (!p || p.colored) return;
    p.colored = true;
    const dur = opts.dur ?? 800;
    const monoAlive = p.mono.filter((o) => o.active);
    const colorAlive = p.color.filter((o) => o.active);
    if (monoAlive.length) scene.tweens.add({ targets: monoAlive, alpha: 0, duration: dur });
    if (colorAlive.length) scene.tweens.add({ targets: colorAlive, alpha: 1, duration: dur });
    if (opts.burst !== false) inkBurst(scene, p.cx, p.cy, { n: 8 });
    if (opts.ripple !== false && dur > 60) this.ripple(scene, p.cx, p.cy, dur);
  }

  /** 色が差す瞬間の波紋（柔光のリング） */
  private ripple(scene: Phaser.Scene, x: number, y: number, dur: number): void {
    const glow = scene.add.image(x, y, 'glow').setTint(0xfff0c8).setAlpha(0.5).setScale(0.3).setDepth(845);
    scene.tweens.add({
      targets: glow,
      scale: 2.6,
      alpha: 0,
      duration: Math.max(500, dur),
      ease: 'Cubic.easeOut',
      onComplete: () => glow.destroy(),
    });
    const ring = scene.add.graphics().setDepth(845);
    const state = { r: 8, a: 0.7 };
    scene.tweens.add({
      targets: state,
      r: 90,
      a: 0,
      duration: Math.max(500, dur),
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2.5, 0xf0d8a0, state.a);
        ring.strokeCircle(x, y, state.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  /** ゾーン単位の彩色（J4 のパン中に呼ぶ）。地面は中心から色が滲み広がる */
  colorizeZone(scene: Phaser.Scene, zone: string, dur = 700): void {
    for (const [id, p] of this.pairs) {
      if (p.zone !== zone || p.colored) continue;
      if (id.startsWith('zone_') && scene.game.renderer.type === Phaser.WEBGL) {
        this.bleedZone(scene, p, dur);
      } else {
        this.colorize(scene, id, { dur, burst: false, ripple: false });
      }
    }
  }

  /** 地面プレートのラジアル・リビール（墨に色が滲みていく） */
  private bleedZone(scene: Phaser.Scene, p: PairEntry, dur: number): void {
    p.colored = true;
    const target = p.color[0];
    const maskImg = scene.make.image({ x: p.cx, y: p.cy, key: 'glow', add: false });
    maskImg.setScale(0.2);
    const mask = maskImg.createBitmapMask();
    const maskable = target as unknown as { setMask?: (m: Phaser.Display.Masks.BitmapMask) => void; clearMask?: () => void };
    maskable.setMask?.(mask);
    target.alpha = 1;
    scene.tweens.add({
      targets: maskImg,
      scale: 16,
      duration: dur * 2.2,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        maskable.clearMask?.();
        maskImg.destroy();
      },
    });
    const monoAlive = p.mono.filter((o) => o.active);
    if (monoAlive.length) scene.tweens.add({ targets: monoAlive, alpha: 0, duration: dur * 2 });
  }

  colorizeAllRemaining(scene: Phaser.Scene): void {
    for (const [id, p] of this.pairs) {
      if (!p.colored) this.colorize(scene, id, { dur: 600, burst: false, ripple: false });
      void id;
    }
  }

  clear(): void {
    this.pairs.clear();
  }
}
