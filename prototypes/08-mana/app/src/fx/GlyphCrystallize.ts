// 文字結晶化演出（SPEC.md §12 J2）
// 結果の字を対象上に表示 → 白縁が走る → 0.6s で実体へにじむ

import Phaser from 'phaser';
import { FONT } from '../config';
import { inkBurst } from './InkParticles';

export function crystallize(
  scene: Phaser.Scene,
  x: number,
  y: number,
  glyph: string,
  opts: { big?: boolean; color?: string; onDone?: () => void } = {},
): void {
  const size = opts.big ? '150px' : '96px';
  const baseStyle = { fontFamily: FONT, fontSize: size, color: opts.color ?? '#2A2426' };
  const ink = scene.add
    .text(x, y - 46, glyph, baseStyle)
    .setOrigin(0.5)
    .setDepth(860)
    .setResolution(2)
    .setAlpha(0)
    .setScale(1.35);
  const white = scene.add
    .text(x, y - 46, glyph, { ...baseStyle, color: '#FFFFFF' })
    .setOrigin(0.5)
    .setDepth(861)
    .setResolution(2)
    .setAlpha(0)
    .setScale(1.35);

  scene.tweens.add({
    targets: [ink, white],
    scale: 1,
    duration: 180,
    ease: 'Cubic.easeOut',
  });
  scene.tweens.add({
    targets: ink,
    alpha: 1,
    duration: 160,
    onComplete: () => {
      if (!white.active) return;
      // 白縁が走る
      scene.tweens.add({
        targets: white,
        alpha: { from: 0.95, to: 0 },
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => {
          scene.time.delayedCall(140, () => {
            if (!ink.active) return;
            // 実体へにじむ
            scene.tweens.add({
              targets: ink,
              y,
              scale: 0.25,
              alpha: 0,
              duration: 260,
              ease: 'Cubic.easeIn',
              onComplete: () => {
                inkBurst(scene, x, y, { n: 12 });
                ink.destroy();
                white.destroy();
                opts.onDone?.();
              },
            });
          });
        },
      });
    },
  });
}
