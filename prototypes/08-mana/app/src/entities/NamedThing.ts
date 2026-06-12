// 名を得た実体・固定オブジェクト・装飾の描画（SPEC.md §8-3 / §14）
// 画像ファイルは一切使わない: Phaser Graphics ＋ 明朝の字 ＋ パーティクルのみ。
// 多くの named 形は「字そのものが小さく実体化して浮かぶ」スタイル（§14 の字アセット方針）。

import Phaser from 'phaser';
import { COLORS, FONT } from '../config';

function floatChar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  glyph: string,
  y: number,
  color: string,
  size = 22,
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(0, y, glyph, { fontFamily: FONT, fontSize: `${size}px`, color })
    .setOrigin(0.5)
    .setResolution(2);
  parent.add(t);
  scene.tweens.add({ targets: t, y: y - 7, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return t;
}

/** 竈（named）: 炉の炎＋暖光（半径120） */
export function makeKamadoNamed(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x6a6058, 1);
  for (const [sx, sy] of [[-18, 6], [0, 10], [18, 6], [-10, -4], [10, -4]] as const) {
    g.fillCircle(sx, sy, 9);
  }
  c.add(g);
  const glow = scene.add.image(0, -8, 'glow').setScale(1.9).setTint(0xffb060).setAlpha(0.5);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.6 }, duration: 600, yoyo: true, repeat: -1 });
  const flame = scene.add.graphics();
  flame.fillStyle(COLORS.flame, 0.95);
  flame.fillTriangle(-9, 0, 9, 0, 0, -26);
  flame.fillStyle(0xf0c060, 0.95);
  flame.fillTriangle(-5, 0, 5, 0, 0, -15);
  c.add(flame);
  scene.tweens.add({ targets: flame, scaleY: { from: 0.92, to: 1.1 }, duration: 280, yoyo: true, repeat: -1 });
  floatChar(scene, c, '火', -44, '#C04020');
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 橋板（木）: 川をわたす */
export function makeBridge(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-80, -26, 160, 52);
  g.lineStyle(2, 0x5a4630, 1);
  for (let i = -3; i <= 3; i++) g.lineBetween(i * 22, -26, i * 22, 26);
  g.strokeRect(-80, -26, 160, 52);
  c.add(g);
  floatChar(scene, c, '木', -44, '#7A5A38', 20);
  c.setDepth(6);
  return c;
}

/** ベンチ（休） */
export function makeBench(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-26, -8, 52, 8);
  g.fillRect(-22, 0, 6, 10);
  g.fillRect(16, 0, 6, 10);
  c.add(g);
  floatChar(scene, c, '休', -30, '#5A7A48', 20);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 台座（ベンチになる前） */
export function makePedestal(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0xb8b0a4, 1);
  g.fillRect(-22, -4, 44, 10);
  g.lineStyle(2, 0x8a8478, 1);
  g.strokeRect(-22, -4, 44, 10);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 烏（named だが一画たりない） */
export function makeCrow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const t = scene.add
    .text(0, -10, '烏', { fontFamily: FONT, fontSize: '38px', color: '#2A2426' })
    .setOrigin(0.5)
    .setResolution(2);
  c.add(t);
  scene.tweens.add({ targets: t, y: -14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const shadow = scene.add.ellipse(0, 8, 28, 8, 0x2a2426, 0.15);
  c.addAt(shadow, 0);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 王の像 */
export function makeStatue(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0xaaa498, 1);
  g.fillRect(-16, -6, 32, 14); // 台
  g.fillRect(-10, -40, 20, 36); // 体
  g.fillCircle(0, -46, 9); // 頭
  g.lineStyle(2, 0x7a7468, 1);
  g.strokeRect(-16, -6, 32, 14);
  c.add(g);
  floatChar(scene, c, '王', -68, '#8A8478', 22);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 井戸（涸れ/満水は WorldScene 側で水面を追加） */
export function makeWell(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x9a948a, 1);
  g.fillCircle(0, 0, 24);
  g.fillStyle(0x4a443c, 1);
  g.fillCircle(0, 0, 16);
  g.lineStyle(3, 0x6a645c, 1);
  g.strokeCircle(0, 0, 24);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 川辺の古木 */
export function makeOldTree(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x6a5a44, 1);
  g.fillRect(-8, -46, 16, 50);
  g.fillStyle(0x6a7458, 0.9);
  g.fillCircle(-16, -58, 22);
  g.fillCircle(16, -56, 24);
  g.fillCircle(0, -74, 26);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 灯籠（ボス解決後） */
export function makeLantern(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x8a8478, 1);
  g.fillRect(-6, -10, 12, 26); // 柱
  g.fillRect(-16, -22, 32, 12); // 火袋
  g.fillTriangle(-20, -22, 20, -22, 0, -38); // 笠
  c.add(g);
  const glow = scene.add.image(0, -16, 'glow').setScale(1.6).setTint(0xffc070).setAlpha(0.55);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0.65 }, duration: 700, yoyo: true, repeat: -1 });
  floatChar(scene, c, '灯', -52, '#C06A20', 26);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 立て札 */
export function makeSign(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-2, -16, 4, 22);
  g.fillRect(-18, -34, 36, 20);
  g.lineStyle(2, 0x5a4630, 1);
  g.strokeRect(-18, -34, 36, 20);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 村の名標（石板） */
export function makePlaque(scene: Phaser.Scene, x: number, y: number): {
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
} {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0xb0aa9e, 1);
  g.fillRoundedRect(-30, -38, 60, 44, 6);
  g.lineStyle(2, 0x7a7468, 1);
  g.strokeRoundedRect(-30, -38, 60, 44, 6);
  c.add(g);
  const text = scene.add
    .text(0, -16, '〼〼', { fontFamily: FONT, fontSize: '18px', color: '#8A8478' })
    .setOrigin(0.5)
    .setResolution(2);
  c.add(text);
  c.setDepth(10 + y * 0.001);
  return { container: c, text };
}

/** 壊れた水車 */
export function makeWaterwheel(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.lineStyle(4, 0x6a5a44, 1);
  g.strokeCircle(0, -20, 26);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4 + 0.4;
    g.lineBetween(-Math.cos(a) * 26, -20 - Math.sin(a) * 26, Math.cos(a) * 26, -20 + Math.sin(a) * 26);
  }
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-4, -2, 8, 16);
  c.add(g);
  c.setAngle(14); // 壊れて傾いている
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 掘り跡 */
export function makeHole(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x4a443c, 0.9);
  g.fillEllipse(0, 0, 34, 18);
  g.fillStyle(0x6a6055, 0.7);
  g.fillEllipse(0, -8, 38, 10);
  c.add(g);
  c.setDepth(5);
  return c;
}

/** 装飾（家・社・鳥居・木・石・草） */
export function makeDecor(
  scene: Phaser.Scene,
  type: 'tree' | 'stone' | 'grass' | 'torii' | 'house' | 'shrineHouse',
  x: number,
  y: number,
  s = 1,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  switch (type) {
    case 'tree':
      g.fillStyle(0x6a5a44, 1);
      g.fillRect(-6 * s, -30 * s, 12 * s, 34 * s);
      g.fillStyle(0x707a60, 0.9);
      g.fillCircle(-12 * s, -42 * s, 18 * s);
      g.fillCircle(12 * s, -40 * s, 19 * s);
      g.fillCircle(0, -54 * s, 20 * s);
      break;
    case 'stone':
      g.fillStyle(0xa8a296, 1);
      g.fillEllipse(0, 0, 30 * s, 20 * s);
      g.lineStyle(2, 0x7a7468, 1);
      g.strokeEllipse(0, 0, 30 * s, 20 * s);
      break;
    case 'grass':
      g.lineStyle(2, 0x7a8468, 1);
      for (let i = -2; i <= 2; i++) g.lineBetween(i * 6, 4, i * 6 + 3, -10);
      break;
    case 'torii':
      g.fillStyle(0x9a4a3a, 1);
      g.fillRect(-30, -64, 8, 64);
      g.fillRect(22, -64, 8, 64);
      g.fillRect(-40, -72, 80, 8);
      g.fillRect(-32, -56, 64, 6);
      break;
    case 'house':
      g.fillStyle(0xcec6b6, 1);
      g.fillRect(-60, -50, 120, 60);
      g.fillStyle(0x5a5048, 1);
      g.fillTriangle(-70, -50, 70, -50, 0, -92);
      g.fillStyle(0x4a443c, 1);
      g.fillRect(-14, -26, 28, 36);
      break;
    case 'shrineHouse':
      g.fillStyle(0xc6bcaa, 1);
      g.fillRect(-80, -44, 160, 54);
      g.fillStyle(0x8a3a30, 1);
      g.fillTriangle(-94, -44, 94, -44, 0, -96);
      g.fillStyle(0x4a443c, 1);
      g.fillRect(-20, -24, 40, 34);
      break;
  }
  c.add(g);
  c.setDepth(type === 'grass' ? 4 : 10 + y * 0.001);
  return c;
}
