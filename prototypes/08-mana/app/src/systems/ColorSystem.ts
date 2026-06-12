// ColorSystem — モノクロ→彩色（SPEC.md §7-8 / §12 J1, J4）
// 全表示物は {mono, color} の2プレートを持ち、クロスフェードで彩色する。

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

  /** J1: ヂュイーン 0.8s ＋ 墨はじけ8粒 */
  colorize(scene: Phaser.Scene, id: string, opts: { dur?: number; burst?: boolean } = {}): void {
    const p = this.pairs.get(id);
    if (!p || p.colored) return;
    p.colored = true;
    const dur = opts.dur ?? 800;
    const monoAlive = p.mono.filter((o) => o.active);
    const colorAlive = p.color.filter((o) => o.active);
    if (monoAlive.length) scene.tweens.add({ targets: monoAlive, alpha: 0, duration: dur });
    if (colorAlive.length) scene.tweens.add({ targets: colorAlive, alpha: 1, duration: dur });
    if (opts.burst !== false) inkBurst(scene, p.cx, p.cy, { n: 8 });
  }

  /** ゾーン単位の彩色（J4 のパン中に呼ぶ） */
  colorizeZone(scene: Phaser.Scene, zone: string, dur = 700): void {
    for (const [id, p] of this.pairs) {
      if (p.zone === zone && !p.colored) this.colorize(scene, id, { dur, burst: false });
    }
  }

  colorizeAllRemaining(scene: Phaser.Scene): void {
    for (const [id, p] of this.pairs) {
      if (!p.colored) this.colorize(scene, id, { dur: 600, burst: false });
    }
  }

  clear(): void {
    this.pairs.clear();
  }
}
