// 文字結晶化演出（SPEC.md §12 J2）
// 筆が走るように字が現れる（マスク・リビール）→ 白縁の煌めき → 衝撃の輪 →
// 金粉 → 0.6s で実体へにじむ

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
  const sizePx = opts.big ? 150 : 96;
  const baseStyle = { fontFamily: FONT, fontSize: `${sizePx}px`, color: opts.color ?? '#2A2426' };
  const cy = y - 46;
  const ink = scene.add
    .text(x, cy, glyph, baseStyle)
    .setOrigin(0.5)
    .setDepth(860)
    .setResolution(2);
  const white = scene.add
    .text(x, cy, glyph, { ...baseStyle, color: '#FFFFFF' })
    .setOrigin(0.5)
    .setDepth(861)
    .setResolution(2)
    .setAlpha(0);

  // 筆が走るリビール（左上→右下へ斜めに現れる）
  const reveal = scene.add.graphics().setVisible(false);
  const mask = reveal.createGeometryMask();
  ink.setMask(mask);
  const half = sizePx * 0.75;
  const sweep = { p: 0 };
  // 筆先の光
  const tip = scene.add.image(x - half, cy - half, 'glow').setTint(0xfff4d8).setScale(0.5).setAlpha(0.8).setDepth(862);

  scene.tweens.add({
    targets: sweep,
    p: 1,
    duration: opts.big ? 420 : 300,
    ease: 'Sine.easeIn',
    onUpdate: () => {
      if (!ink.active) return;
      reveal.clear();
      reveal.fillStyle(0xffffff, 1);
      // 斜めの帯が伸びて字を現す
      const w = sizePx * 2.6 * sweep.p;
      reveal.save();
      reveal.translateCanvas(x - half, cy - half);
      reveal.rotateCanvas(Math.PI / 4);
      reveal.fillRect(-sizePx, -sizePx * 1.6, w, sizePx * 3.4);
      reveal.restore();
      tip.setPosition(x - half + sweep.p * sizePx * 1.5, cy - half + sweep.p * sizePx * 1.5);
      tip.setAlpha(0.8 * (1 - sweep.p));
    },
    onComplete: () => {
      if (!ink.active) return;
      ink.clearMask();
      reveal.destroy();
      tip.destroy();
      // 白縁が走る
      scene.tweens.add({
        targets: white,
        alpha: { from: 0.95, to: 0 },
        duration: 240,
        ease: 'Quad.easeOut',
      });
      // 衝撃の輪
      shockRing(scene, x, cy, opts.big ? 130 : 80);
      // 金粉
      goldDust(scene, x, cy, opts.big ? 18 : 10);
      scene.time.delayedCall(340, () => {
        if (!ink.active) return;
        // 実体へにじむ
        scene.tweens.add({
          targets: ink,
          y,
          scale: 0.25,
          alpha: 0,
          duration: 280,
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

  // 出現時のわずかな拡大→着地
  ink.setScale(1.25);
  white.setScale(1.25);
  scene.tweens.add({ targets: [ink, white], scale: 1, duration: 260, ease: 'Cubic.easeOut' });
}

function shockRing(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  const ring = scene.add.graphics().setDepth(859);
  const st = { r: 10, a: 0.8 };
  scene.tweens.add({
    targets: st,
    r: radius,
    a: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      ring.clear();
      ring.lineStyle(3, 0x2a2426, st.a * 0.6);
      ring.strokeCircle(x, y, st.r);
      ring.lineStyle(1.5, 0xc8a03c, st.a);
      ring.strokeCircle(x, y, st.r * 0.86);
    },
    onComplete: () => ring.destroy(),
  });
}

function goldDust(scene: Phaser.Scene, x: number, y: number, n: number): void {
  const e = scene.add.particles(x, y, 'inkdot', {
    speed: { min: 30, max: 110 },
    angle: { min: 0, max: 360 },
    lifespan: 800,
    scale: { start: 1.1, end: 0 },
    alpha: { start: 0.9, end: 0 },
    gravityY: -40,
    tint: [0xc8a03c, 0xf0d8a0, 0xfff4d8],
    emitting: false,
  });
  e.setDepth(862);
  e.explode(n);
  scene.time.delayedCall(900, () => {
    if (e.active) e.destroy();
  });
}
