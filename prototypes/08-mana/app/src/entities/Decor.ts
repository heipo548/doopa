// 環境装飾 — 墨絵の村を形づくる小物たち（SPEC.md §14: 全て Graphics/文字/パーティクル）
// 彩色対象（鳥居・社・家の窓灯・花・石灯籠）は {mono, color} プレートを返し、
// WorldScene が ColorSystem に登録する。フィナーレで世界に色が差す瞬間の主役。

import Phaser from 'phaser';

export type DecorType =
  | 'tree'
  | 'pine'
  | 'stone'
  | 'grass'
  | 'flower'
  | 'torii'
  | 'house'
  | 'shrineHouse'
  | 'fence'
  | 'stoneLantern'
  | 'path';

export interface DecorResult {
  c: Phaser.GameObjects.Container;
  mono?: Phaser.GameObjects.GameObject[];
  color?: Phaser.GameObjects.GameObject[];
}

export function makeDecor(
  scene: Phaser.Scene,
  type: DecorType,
  x: number,
  y: number,
  s = 1,
): DecorResult {
  const c = scene.add.container(x, y);
  let result: DecorResult = { c };
  switch (type) {
    case 'tree':
      result = drawTree(scene, c, s);
      break;
    case 'pine':
      result = drawPine(scene, c, s);
      break;
    case 'stone':
      drawStone(scene, c, s);
      break;
    case 'grass':
      drawGrass(scene, c, s);
      break;
    case 'flower':
      result = drawFlower(scene, c, s);
      break;
    case 'torii':
      result = drawTorii(scene, c, s);
      break;
    case 'house':
      result = drawHouse(scene, c);
      break;
    case 'shrineHouse':
      result = drawShrineHouse(scene, c);
      break;
    case 'fence':
      drawFence(scene, c, s);
      break;
    case 'stoneLantern':
      result = drawStoneLantern(scene, c, s);
      break;
    case 'path':
      drawPath(scene, c, s);
      break;
  }
  c.setDepth(type === 'grass' || type === 'path' || type === 'flower' ? 4 : 10 + y * 0.001);
  return result;
}

/** 広葉樹: 二段影の枝葉＋ゆらぎ */
function drawTree(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): DecorResult {
  const trunk = scene.add.graphics();
  trunk.fillStyle(0x5a4a38, 1);
  trunk.beginPath();
  trunk.moveTo(-6 * s, 4 * s);
  trunk.lineTo(-3 * s, -30 * s);
  trunk.lineTo(3 * s, -30 * s);
  trunk.lineTo(7 * s, 4 * s);
  trunk.closePath();
  trunk.fillPath();
  trunk.lineStyle(1.6, 0x3a322c, 0.7);
  trunk.strokePath();
  // 根本の影
  trunk.fillStyle(0x2a2426, 0.1);
  trunk.fillEllipse(0, 5 * s, 30 * s, 8 * s);

  const canopy = scene.add.container(0, -46 * s);
  const under = scene.add.graphics();
  under.fillStyle(0x55603f, 0.95); // 下葉（影）
  under.fillCircle(-14 * s, 8 * s, 17 * s);
  under.fillCircle(14 * s, 9 * s, 16 * s);
  under.fillCircle(0, 13 * s, 18 * s);
  const top = scene.add.graphics();
  top.fillStyle(0x70805c, 1); // 上葉（光）
  top.fillCircle(-12 * s, -2 * s, 16 * s);
  top.fillCircle(13 * s, 0 * s, 15 * s);
  top.fillCircle(0, -8 * s, 18 * s);
  top.fillStyle(0x8a9a72, 0.7);
  top.fillCircle(-4 * s, -12 * s, 8 * s);
  canopy.add([under, top]);
  c.add([trunk, canopy]);
  scene.tweens.add({
    targets: canopy,
    angle: { from: -1.4, to: 1.4 },
    duration: 2600 + Math.random() * 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return { c };
}

/** 松: 段になった枝ぶり（社まわり用） */
function drawPine(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): DecorResult {
  const g = scene.add.graphics();
  g.fillStyle(0x4a3f30, 1);
  g.fillRect(-3 * s, -38 * s, 6 * s, 42 * s);
  g.lineStyle(2.4, 0x4a3f30, 1);
  g.lineBetween(0, -26 * s, 14 * s, -32 * s);
  g.lineBetween(0, -16 * s, -13 * s, -22 * s);
  const layers: [number, number, number][] = [
    [0, -44 * s, 16],
    [14 * s, -34 * s, 11],
    [-13 * s, -24 * s, 11],
  ];
  for (const [lx, ly, r] of layers) {
    g.fillStyle(0x3f5544, 1);
    g.fillEllipse(lx, ly, r * 2 * s, r * s);
    g.fillStyle(0x52685a, 0.8);
    g.fillEllipse(lx, ly - 2 * s, r * 1.5 * s, r * 0.6 * s);
  }
  g.fillStyle(0x2a2426, 0.1);
  g.fillEllipse(0, 5 * s, 26 * s, 7 * s);
  c.add(g);
  return { c };
}

function drawStone(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.1);
  g.fillEllipse(1, 4 * s, 32 * s, 9 * s);
  g.fillStyle(0xa8a296, 1);
  g.fillEllipse(0, 0, 30 * s, 20 * s);
  g.fillStyle(0xbcb6aa, 0.9);
  g.fillEllipse(-4 * s, -4 * s, 18 * s, 9 * s);
  g.lineStyle(1.8, 0x6a645c, 0.9);
  g.strokeEllipse(0, 0, 30 * s, 20 * s);
  // 苔
  g.fillStyle(0x70805c, 0.45);
  g.fillEllipse(7 * s, 5 * s, 10 * s, 4 * s);
  c.add(g);
}

function drawGrass(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): void {
  const g = scene.add.graphics();
  for (let i = -3; i <= 3; i++) {
    const h = (8 + Math.random() * 7) * s;
    const sway = (Math.random() - 0.5) * 6;
    g.lineStyle(1.6, Math.random() < 0.5 ? 0x7a8468 : 0x8a946f, 0.9);
    g.beginPath();
    g.moveTo(i * 5 * s, 4);
    g.lineTo(i * 5 * s + sway, 4 - h);
    g.strokePath();
  }
  c.add(g);
  scene.tweens.add({
    targets: c,
    angle: { from: -2, to: 2 },
    duration: 1700 + Math.random() * 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

/** 花: モノクロでは蕾、彩色で咲く */
function drawFlower(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): DecorResult {
  const stem = scene.add.graphics();
  stem.lineStyle(1.5, 0x7a8468, 0.9);
  stem.lineBetween(0, 4, 0, -9 * s);
  stem.lineBetween(3, 4, 4, -6 * s);
  c.add(stem);
  const mono = scene.add.graphics();
  mono.fillStyle(0xb8b2a6, 1);
  mono.fillCircle(0, -11 * s, 3 * s);
  mono.fillCircle(4, -8 * s, 2.4 * s);
  const color = scene.add.graphics();
  const hue = Math.random() < 0.5 ? 0xd87a8a : 0xe0b13c;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    color.fillStyle(hue, 1);
    color.fillEllipse(Math.cos(a) * 3.4 * s, -11 * s + Math.sin(a) * 3.4 * s, 4.4 * s, 2.6 * s);
  }
  color.fillStyle(0xf5f0e6, 1);
  color.fillCircle(0, -11 * s, 1.6 * s);
  c.add([mono, color]);
  return { c, mono: [mono], color: [color] };
}

/** 鳥居: 灰 → 朱 */
function drawTorii(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): DecorResult {
  const draw = (g: Phaser.GameObjects.Graphics, main: number, dark: number): void => {
    g.fillStyle(dark, 1);
    g.fillRect(-32 * s, -62 * s, 9 * s, 62 * s);
    g.fillRect(23 * s, -62 * s, 9 * s, 62 * s);
    g.fillStyle(main, 1);
    // 笠木（両端が反る）
    g.beginPath();
    g.moveTo(-44 * s, -68 * s);
    g.lineTo(44 * s, -68 * s);
    g.lineTo(40 * s, -76 * s);
    g.lineTo(-40 * s, -76 * s);
    g.closePath();
    g.fillPath();
    g.fillRect(-34 * s, -58 * s, 68 * s, 6 * s);
    g.fillStyle(dark, 1);
    g.fillRect(-3 * s, -58 * s, 6 * s, 8 * s); // 額束
  };
  const mono = scene.add.graphics();
  draw(mono, 0x8a8478, 0x6a645c);
  const color = scene.add.graphics();
  draw(color, 0xb03030, 0x7a2020);
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x2a2426, 0.1);
  shadow.fillEllipse(0, 2, 70 * s, 8 * s);
  c.add([shadow, mono, color]);
  return { c, mono: [mono], color: [color] };
}

/** 民家: 板壁・庇・障子窓（窓は彩色で灯る） */
function drawHouse(scene: Phaser.Scene, c: Phaser.GameObjects.Container): DecorResult {
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.12);
  g.fillEllipse(0, 12, 150, 18);
  // 壁
  g.fillStyle(0xcec6b6, 1);
  g.fillRect(-60, -50, 120, 60);
  g.lineStyle(1.2, 0x9a917f, 0.8);
  for (let i = 1; i < 6; i++) g.lineBetween(-60, -50 + i * 10, 60, -50 + i * 10);
  // 屋根（茅葺の厚み）
  g.fillStyle(0x5a5048, 1);
  g.fillTriangle(-72, -48, 72, -48, 0, -96);
  g.fillStyle(0x6a6055, 1);
  g.fillTriangle(-64, -52, 64, -52, 0, -94);
  g.lineStyle(2, 0x3a322c, 0.8);
  g.lineBetween(-72, -48, 0, -96);
  g.lineBetween(72, -48, 0, -96);
  // 戸口＋暖簾
  g.fillStyle(0x4a443c, 1);
  g.fillRect(-14, -28, 28, 38);
  g.fillStyle(0x6a5a78, 0.9);
  g.fillRect(-13, -28, 12, 16);
  g.fillRect(1, -28, 12, 16);
  c.add(g);
  // 窓（彩色で灯る）
  const winMono = scene.add.graphics();
  winMono.fillStyle(0x9a948a, 1);
  winMono.fillRect(26, -34, 20, 16);
  winMono.lineStyle(1.4, 0x6a645c, 1);
  winMono.strokeRect(26, -34, 20, 16);
  winMono.lineBetween(36, -34, 36, -18);
  const winColor = scene.add.container(0, 0);
  const wg = scene.add.graphics();
  wg.fillStyle(0xf0c879, 1);
  wg.fillRect(26, -34, 20, 16);
  wg.lineStyle(1.4, 0x8a6a3a, 1);
  wg.strokeRect(26, -34, 20, 16);
  wg.lineBetween(36, -34, 36, -18);
  const glow = scene.add.image(36, -26, 'glow').setTint(0xffd890).setScale(0.6).setAlpha(0.5);
  winColor.add([wg, glow]);
  c.add([winMono, winColor]);
  return { c, mono: [winMono], color: [winColor] };
}

/** 社: 朱の屋根・注連縄・紙垂（彩色で朱に） */
function drawShrineHouse(scene: Phaser.Scene, c: Phaser.GameObjects.Container): DecorResult {
  const base = scene.add.graphics();
  base.fillStyle(0x2a2426, 0.12);
  base.fillEllipse(0, 14, 200, 20);
  base.fillStyle(0xc6bcaa, 1);
  base.fillRect(-80, -44, 160, 54);
  base.lineStyle(1.4, 0x8a8070, 0.9);
  for (let i = 1; i < 4; i++) base.lineBetween(-80 + i * 40, -44, -80 + i * 40, 10);
  base.fillStyle(0x4a443c, 1);
  base.fillRect(-20, -24, 40, 34);
  // 階段
  base.fillStyle(0xb0a896, 1);
  base.fillRect(-26, 10, 52, 5);
  base.fillRect(-22, 15, 44, 5);
  c.add(base);
  // 屋根: 灰 → 朱
  const roof = (g: Phaser.GameObjects.Graphics, main: number, ridge: number): void => {
    g.fillStyle(main, 1);
    g.fillTriangle(-96, -42, 96, -42, 0, -98);
    g.lineStyle(3, ridge, 1);
    g.lineBetween(-96, -42, 0, -98);
    g.lineBetween(96, -42, 0, -98);
    // 千木
    g.lineStyle(4, ridge, 1);
    g.lineBetween(-10, -96, -22, -116);
    g.lineBetween(10, -96, 22, -116);
  };
  const roofMono = scene.add.graphics();
  roof(roofMono, 0x6a6055, 0x4a443c);
  const roofColor = scene.add.graphics();
  roof(roofColor, 0x8a3a30, 0x5a2018);
  c.add([roofMono, roofColor]);
  // 注連縄＋紙垂
  const rope = scene.add.graphics();
  rope.lineStyle(5, 0x9a8a68, 1);
  rope.beginPath();
  rope.arc(0, -52, 70, Math.PI * 0.08, Math.PI * 0.92);
  rope.strokePath();
  for (const sx of [-44, -15, 15, 44]) {
    rope.fillStyle(0xf5f0e6, 1);
    const sy = -52 + Math.sqrt(Math.max(0, 70 * 70 - sx * sx)) * 0.96;
    rope.fillTriangle(sx - 4, sy, sx + 4, sy, sx, sy + 12);
  }
  c.add(rope);
  return { c, mono: [roofMono], color: [roofColor] };
}

/** 低い木柵 */
function drawFence(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): void {
  const g = scene.add.graphics();
  g.lineStyle(3, 0x7a6a52, 1);
  g.lineBetween(-30 * s, -10, 30 * s, -10);
  g.lineBetween(-30 * s, -3, 30 * s, -3);
  for (const px of [-26, 0, 26]) {
    g.lineStyle(3.6, 0x6a5a44, 1);
    g.lineBetween(px * s, 2, px * s, -16);
  }
  c.add(g);
}

/** 石灯籠: 彩色後（フィナーレ）に灯が入る */
function drawStoneLantern(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): DecorResult {
  const g = scene.add.graphics();
  g.fillStyle(0x2a2426, 0.12);
  g.fillEllipse(0, 4, 26 * s, 7 * s);
  g.fillStyle(0x9a948a, 1);
  g.fillRect(-4 * s, -18 * s, 8 * s, 20 * s); // 柱
  g.fillRect(-10 * s, -28 * s, 20 * s, 10 * s); // 火袋
  g.fillTriangle(-14 * s, -28 * s, 14 * s, -28 * s, 0, -40 * s); // 笠
  g.fillStyle(0x6a645c, 1);
  g.fillRect(-7 * s, -26 * s, 4 * s, 6 * s); // 火口
  g.fillRect(3 * s, -26 * s, 4 * s, 6 * s);
  c.add(g);
  const mono = scene.add.graphics();
  mono.fillStyle(0x4a443c, 1);
  mono.fillRect(-3 * s, -26 * s, 6 * s, 6 * s);
  const colorC = scene.add.container(0, 0);
  const fire = scene.add.graphics();
  fire.fillStyle(0xf0c060, 1);
  fire.fillRect(-3 * s, -26 * s, 6 * s, 6 * s);
  const glow = scene.add.image(0, -23 * s, 'glow').setTint(0xffc070).setScale(0.7 * s).setAlpha(0.55);
  colorC.add([fire, glow]);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.4, to: 0.65 },
    duration: 600 + Math.random() * 300,
    yoyo: true,
    repeat: -1,
  });
  c.add([mono, colorC]);
  return { c, mono: [mono], color: [colorC] };
}

/** 参道・庭の敷石 */
function drawPath(scene: Phaser.Scene, c: Phaser.GameObjects.Container, s: number): void {
  const g = scene.add.graphics();
  for (let i = 0; i < 5; i++) {
    const px = (i - 2) * 26 * s + (Math.random() - 0.5) * 8;
    const py = (Math.random() - 0.5) * 10;
    g.fillStyle(0xd8d2c4, 0.9);
    g.fillEllipse(px, py, 22 * s, 13 * s);
    g.lineStyle(1.2, 0xa8a296, 0.8);
    g.strokeEllipse(px, py, 22 * s, 13 * s);
  }
  c.add(g);
}
