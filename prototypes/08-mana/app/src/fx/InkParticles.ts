// 墨パーティクル（SPEC.md §12 J3）＋ 共通生成テクスチャ
// パーティクル総数上限 200 を守るため、常駐スワールは低頻度・短命に保つ（§16）

import Phaser from 'phaser';

/** dot8 / inkdot / glow テクスチャを生成（Preload で1回呼ぶ） */
export function makeInkTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('inkdot')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('dot8', 8, 8);
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture('inkdot', 6, 6);
  g.destroy();

  const size = 128;
  const canvas = scene.textures.createCanvas('glow', size, size);
  if (canvas) {
    const c = canvas.getContext();
    const grd = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}

/** 一回きりの墨はじけ */
export function inkBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { n?: number; color?: number; speed?: number } = {},
): void {
  const n = opts.n ?? 10;
  const e = scene.add.particles(x, y, 'inkdot', {
    speed: { min: 40, max: opts.speed ?? 130 },
    angle: { min: 0, max: 360 },
    lifespan: 500,
    scale: { start: 1.6, end: 0 },
    tint: opts.color ?? 0x2a2426,
    emitting: false,
  });
  e.setDepth(850);
  e.explode(n);
  scene.time.delayedCall(700, () => {
    if (e.active) e.destroy();
  });
}

/** ナナシの周囲を漂う墨粒（対象に追従） */
export function attachSwirl(
  scene: Phaser.Scene,
  follow: Phaser.GameObjects.Container,
  radius: number,
  tint = 0x2a2426,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const e = scene.add.particles(0, 0, 'inkdot', {
    speed: { min: 4, max: 18 },
    lifespan: { min: 600, max: 1100 },
    scale: { start: 1.1, end: 0 },
    alpha: { start: 0.7, end: 0 },
    frequency: 150,
    tint,
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Circle(0, 0, radius),
      quantity: 1,
    },
  });
  e.startFollow(follow);
  e.setDepth(follow.depth + 1);
  return e;
}
