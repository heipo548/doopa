// 名を得た実体・固定オブジェクトの描画（SPEC.md §8-3 / §14）
// 画像ファイルは一切使わない: Phaser Graphics ＋ 明朝の字 ＋ パーティクルのみ。
// 多くの named 形は「字そのものが小さく実体化して浮かぶ」スタイル（§14 の字アセット方針）。
// 環境装飾（木・家・鳥居など）は entities/Decor.ts へ分離。

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
  // 字の足元にほのかな光
  const halo = scene.add.image(0, y, 'glow').setScale(0.45).setTint(0xfff4d8).setAlpha(0.3);
  parent.add([halo, t]);
  scene.tweens.add({ targets: [t, halo], y: y - 7, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return t;
}

/** 竈（named）: 組石・二層の炎・暖光（半径120） */
export function makeKamadoNamed(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.14);
  g.fillEllipse(0, 10, 52, 13);
  // 組石（明暗二色）
  const stones: [number, number, number][] = [[-18, 6, 9], [0, 10, 10], [18, 6, 9], [-10, -4, 8], [10, -4, 8]];
  for (const [sx, sy, r] of stones) {
    g.fillStyle(0x6a6058, 1);
    g.fillCircle(sx, sy, r);
    g.fillStyle(0x847a70, 0.9);
    g.fillCircle(sx - r * 0.25, sy - r * 0.3, r * 0.55);
    g.lineStyle(1.4, 0x4a443c, 0.9);
    g.strokeCircle(sx, sy, r);
  }
  c.add(g);
  const glow = scene.add.image(0, -8, 'glow').setScale(1.9).setTint(0xffb060).setAlpha(0.5);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.6 }, duration: 600, yoyo: true, repeat: -1 });
  // 炎（外炎・内炎の二層がそれぞれ揺れる）
  const outer = scene.add.graphics();
  outer.fillStyle(COLORS.flame, 0.95);
  outer.fillTriangle(-10, 0, 10, 0, 0, -28);
  const inner = scene.add.graphics();
  inner.fillStyle(0xf0c060, 0.95);
  inner.fillTriangle(-5, 0, 5, 0, 1, -16);
  c.add([outer, inner]);
  scene.tweens.add({ targets: outer, scaleY: { from: 0.92, to: 1.12 }, scaleX: { from: 1.04, to: 0.94 }, duration: 300, yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: inner, scaleY: { from: 1.08, to: 0.9 }, duration: 220, yoyo: true, repeat: -1 });
  floatChar(scene, c, '火', -46, '#C04020');
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 橋板（木）: 桁・縄・杭つき */
export function makeBridge(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.18);
  g.fillRect(-82, 22, 164, 8);
  // 板
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-82, -26, 164, 52);
  g.fillStyle(0x9a7a55, 0.7);
  g.fillRect(-82, -26, 164, 8);
  g.lineStyle(2, 0x5a4630, 1);
  for (let i = -3; i <= 3; i++) g.lineBetween(i * 23, -26, i * 23, 26);
  g.strokeRect(-82, -26, 164, 52);
  // 杭と縄
  g.fillStyle(0x6a5238, 1);
  for (const px of [-76, 76]) {
    g.fillRect(px - 3, -36, 6, 12);
    g.fillRect(px - 3, 24, 6, 12);
  }
  g.lineStyle(2, 0x9a8a68, 1);
  g.lineBetween(-76, -32, 76, -32);
  g.lineBetween(-76, 30, 76, 30);
  c.add(g);
  floatChar(scene, c, '木', -48, '#7A5A38', 20);
  c.setDepth(6);
  return c;
}

/** ベンチ（休）: 縁台＋赤い敷物 */
export function makeBench(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.13);
  g.fillEllipse(0, 9, 58, 9);
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-28, -9, 56, 9);
  g.fillStyle(0x9a7a55, 0.8);
  g.fillRect(-28, -9, 56, 3);
  g.fillStyle(0xb03030, 0.85); // 敷物
  g.fillRect(-12, -10, 24, 4);
  g.fillStyle(0x6a5238, 1);
  g.fillRect(-24, 0, 6, 10);
  g.fillRect(18, 0, 6, 10);
  g.lineStyle(1.4, 0x4a3a28, 0.9);
  g.strokeRect(-28, -9, 56, 9);
  c.add(g);
  floatChar(scene, c, '休', -32, '#5A7A48', 20);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 台座（ベンチになる前） */
export function makePedestal(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.1);
  g.fillEllipse(0, 8, 50, 8);
  g.fillStyle(0xb8b0a4, 1);
  g.fillRect(-22, -4, 44, 10);
  g.fillStyle(0xc8c0b4, 0.8);
  g.fillRect(-22, -4, 44, 3);
  g.lineStyle(2, 0x8a8478, 1);
  g.strokeRect(-22, -4, 44, 10);
  // ひび
  g.lineStyle(1, 0x8a8478, 0.7);
  g.lineBetween(-6, -4, -2, 6);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 烏（named だが一画たりない）: 止まり木の上で身じろぐ */
export function makeCrow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.15);
  g.fillEllipse(0, 10, 30, 8);
  // 枯れ枝の止まり木
  g.lineStyle(3.5, 0x5a4a38, 1);
  g.lineBetween(-18, 8, 18, 4);
  g.lineBetween(10, 5, 18, -4);
  c.add(g);
  const t = scene.add
    .text(0, -12, '烏', { fontFamily: FONT, fontSize: '38px', color: '#2A2426' })
    .setOrigin(0.5)
    .setResolution(2);
  c.add(t);
  scene.tweens.add({ targets: t, y: -16, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 王の像: 台座・冠・苔 */
export function makeStatue(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.13);
  g.fillEllipse(0, 12, 44, 10);
  g.fillStyle(0x9a9488, 1); // 台
  g.fillRect(-18, -2, 36, 14);
  g.fillStyle(0xaaa498, 1); // 体
  g.fillRect(-10, -40, 20, 38);
  g.fillStyle(0xbcb6aa, 0.8);
  g.fillRect(-10, -40, 7, 38);
  g.fillCircle(0, -46, 9); // 頭
  g.fillStyle(0xaaa498, 1);
  g.fillCircle(0, -46, 8.4);
  // 冠
  g.fillStyle(0x8a8478, 1);
  g.fillTriangle(-7, -52, 7, -52, 0, -60);
  g.lineStyle(1.8, 0x6a645c, 1);
  g.strokeRect(-18, -2, 36, 14);
  g.strokeRect(-10, -40, 20, 38);
  // 苔
  g.fillStyle(0x70805c, 0.4);
  g.fillEllipse(-10, 8, 12, 5);
  c.add(g);
  floatChar(scene, c, '王', -72, '#8A8478', 22);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 井戸: 屋根掛け・釣瓶つき */
export function makeWell(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.14);
  g.fillEllipse(0, 8, 56, 12);
  // 石組み
  g.fillStyle(0x9a948a, 1);
  g.fillCircle(0, 0, 24);
  g.fillStyle(0x4a443c, 1);
  g.fillCircle(0, 0, 16);
  g.lineStyle(3, 0x6a645c, 1);
  g.strokeCircle(0, 0, 24);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.lineStyle(1.5, 0x6a645c, 0.7);
    g.lineBetween(Math.cos(a) * 16, Math.sin(a) * 16, Math.cos(a) * 24, Math.sin(a) * 24);
  }
  // 屋根掛け
  g.fillStyle(0x6a5a44, 1);
  g.fillRect(-26, -38, 5, 38);
  g.fillRect(21, -38, 5, 38);
  g.fillStyle(0x5a5048, 1);
  g.fillTriangle(-32, -36, 32, -36, 0, -52);
  // 釣瓶
  g.lineStyle(1.6, 0x9a8a68, 1);
  g.lineBetween(0, -36, 0, -12);
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-5, -12, 10, 8);
  c.add(g);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 川辺の古木: 注連縄を巻かれた神木 */
export function makeOldTree(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.14);
  g.fillEllipse(0, 8, 60, 13);
  // うねる幹
  g.fillStyle(0x5a4a38, 1);
  g.beginPath();
  g.moveTo(-12, 6);
  g.lineTo(-8, -28);
  g.lineTo(-14, -46);
  g.lineTo(-2, -44);
  g.lineTo(8, -48);
  g.lineTo(6, -26);
  g.lineTo(12, 6);
  g.closePath();
  g.fillPath();
  g.lineStyle(1.8, 0x3a322c, 0.8);
  g.strokePath();
  // 幹の刻み
  g.lineStyle(1.2, 0x3a322c, 0.5);
  g.lineBetween(-4, -8, -2, -30);
  g.lineBetween(4, -4, 5, -24);
  c.add(g);
  const canopy = scene.add.container(0, -64);
  const cg = scene.add.graphics();
  cg.fillStyle(0x55603f, 0.95);
  cg.fillCircle(-18, 6, 22);
  cg.fillCircle(18, 4, 24);
  cg.fillCircle(0, 14, 22);
  cg.fillStyle(0x70805c, 1);
  cg.fillCircle(-16, -6, 20);
  cg.fillCircle(17, -8, 19);
  cg.fillCircle(0, -14, 23);
  cg.fillStyle(0x8a9a72, 0.7);
  cg.fillCircle(-2, -20, 10);
  canopy.add(cg);
  c.add(canopy);
  scene.tweens.add({ targets: canopy, angle: { from: -1.2, to: 1.2 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // 注連縄
  const rope = scene.add.graphics();
  rope.lineStyle(4, 0x9a8a68, 1);
  rope.lineBetween(-13, -20, 13, -22);
  rope.fillStyle(0xf5f0e6, 1);
  for (const sx of [-8, 0, 8]) rope.fillTriangle(sx - 3, -20, sx + 3, -20, sx, -10);
  c.add(rope);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 灯籠（ボス解決後）: 火袋に灯が宿る */
export function makeLantern(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.14);
  g.fillEllipse(0, 18, 40, 9);
  g.fillStyle(0x8a8478, 1);
  g.fillRect(-6, -10, 12, 26); // 柱
  g.fillRect(-16, -22, 32, 12); // 火袋
  g.fillStyle(0xf0e8d0, 0.9);
  g.fillRect(-12, -21, 24, 10); // 障子
  g.lineStyle(1.2, 0x6a645c, 1);
  g.lineBetween(-4, -21, -4, -11);
  g.lineBetween(4, -21, 4, -11);
  g.fillStyle(0x8a8478, 1);
  g.fillTriangle(-20, -22, 20, -22, 0, -38); // 笠
  c.add(g);
  const glow = scene.add.image(0, -16, 'glow').setScale(1.6).setTint(0xffc070).setAlpha(0.55);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: { from: 0.4, to: 0.65 }, duration: 700, yoyo: true, repeat: -1 });
  floatChar(scene, c, '灯', -54, '#C06A20', 26);
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 立て札 */
export function makeSign(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.1);
  g.fillEllipse(0, 7, 30, 6);
  g.fillStyle(0x6a5238, 1);
  g.fillRect(-2, -16, 4, 22);
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-18, -34, 36, 20);
  g.fillStyle(0x9a7a55, 0.7);
  g.fillRect(-18, -34, 36, 5);
  g.lineStyle(2, 0x5a4630, 1);
  g.strokeRect(-18, -34, 36, 20);
  // 文字めいたかすれ線
  g.lineStyle(1.2, 0x4a3a28, 0.7);
  g.lineBetween(-12, -29, 12, -29);
  g.lineBetween(-12, -24, 6, -24);
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
  g.fillStyle(0x2a2426, 0.12);
  g.fillEllipse(0, 8, 62, 9);
  g.fillStyle(0xb0aa9e, 1);
  g.fillRoundedRect(-30, -38, 60, 44, 6);
  g.fillStyle(0xc4beb2, 0.7);
  g.fillRoundedRect(-30, -38, 60, 12, { tl: 6, tr: 6, bl: 0, br: 0 });
  g.lineStyle(2, 0x7a7468, 1);
  g.strokeRoundedRect(-30, -38, 60, 44, 6);
  g.lineStyle(1.2, 0x8a8478, 0.8);
  g.strokeRoundedRect(-26, -34, 52, 36, 4);
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
  g.fillStyle(0x2a2426, 0.12);
  g.fillEllipse(0, 16, 50, 10);
  g.lineStyle(4.5, 0x6a5a44, 1);
  g.strokeCircle(0, -20, 26);
  g.lineStyle(2.5, 0x6a5a44, 0.9);
  g.strokeCircle(0, -20, 17);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4 + 0.4;
    g.lineStyle(3.5, 0x6a5a44, 1);
    g.lineBetween(-Math.cos(a) * 26, -20 - Math.sin(a) * 26, Math.cos(a) * 26, -20 + Math.sin(a) * 26);
  }
  // 欠けた羽板
  g.fillStyle(0x7a6a52, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    g.fillRect(Math.cos(a) * 24 - 3, -20 + Math.sin(a) * 24 - 4, 7, 8);
  }
  g.fillStyle(0x8a6a48, 1);
  g.fillRect(-4, -2, 8, 18);
  c.add(g);
  c.setAngle(14); // 壊れて傾いている
  c.setDepth(10 + y * 0.001);
  return c;
}

/** 掘り跡 */
export function makeHole(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x4a443c, 0.95);
  g.fillEllipse(0, 0, 34, 18);
  g.fillStyle(0x2a2622, 1);
  g.fillEllipse(0, 1, 24, 11);
  g.fillStyle(0x6a6055, 0.8);
  g.fillEllipse(0, -8, 38, 9);
  // 掻き出した土
  g.fillStyle(0x7a6a55, 0.7);
  g.fillCircle(-20, 4, 4);
  g.fillCircle(22, 2, 3);
  g.fillCircle(16, 8, 2.5);
  c.add(g);
  c.setDepth(5);
  return c;
}
