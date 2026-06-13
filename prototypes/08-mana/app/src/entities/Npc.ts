// NPC — モノクロの素描 → 彩色で生気が戻る（SPEC.md §14）
// コトノ婆=腰の曲がった老命名師（杖・髷）/ 村人A=農夫（編笠・鍬）/ 村人B=水汲みの女（桶）
// まばたき・呼吸・会話のうなずき付き。

import Phaser from 'phaser';

interface Palette {
  robe: number;
  robe2: number;
  skin: number;
  prop: number;
}

const MONO: Palette = { robe: 0x9a948a, robe2: 0x8a847a, skin: 0xd8d2c4, prop: 0x84807a };

const COLOR_PALETTES: Record<string, Palette> = {
  kotono: { robe: 0x8c6e4a, robe2: 0x6a5238, skin: 0xeed9bc, prop: 0x5a4630 },
  villager_a: { robe: 0x4a6a8a, robe2: 0x3a5570, skin: 0xeed9bc, prop: 0x8a6a48 },
  villager_b: { robe: 0x5a8a5a, robe2: 0x477246, skin: 0xeed9bc, prop: 0x9a7a52 },
};

export class Npc extends Phaser.GameObjects.Container {
  readonly npcId: string;
  private monoBody: Phaser.GameObjects.Container;
  private colorBody: Phaser.GameObjects.Container;
  private eyesList: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene, npcId: string, x: number, y: number) {
    super(scene, x, y);
    this.npcId = npcId;

    const shadow = scene.add.ellipse(0, 4, 28, 9, 0x2a2426, 0.14);
    this.add(shadow);
    this.monoBody = this.drawFigure(scene, MONO, true);
    this.colorBody = this.drawFigure(scene, COLOR_PALETTES[npcId] ?? MONO, false);
    this.colorBody.setAlpha(0);
    this.add([this.monoBody, this.colorBody]);

    scene.add.existing(this);
    this.setDepth(10 + y * 0.001);

    // 呼吸
    scene.tweens.add({
      targets: [this.monoBody, this.colorBody],
      scaleY: { from: 1, to: 1.015 },
      y: { from: 0, to: -1.2 },
      duration: 1700 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // まばたき
    this.scheduleBlink(scene);
  }

  /** 話しかけられたときの小さなうなずき */
  talkPulse(): void {
    this.scene.tweens.add({
      targets: [this.monoBody, this.colorBody],
      y: '+=2.5',
      duration: 120,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
  }

  get plates(): { mono: Phaser.GameObjects.Container; color: Phaser.GameObjects.Container } {
    return { mono: this.monoBody, color: this.colorBody };
  }

  private scheduleBlink(scene: Phaser.Scene): void {
    scene.time.delayedCall(1800 + Math.random() * 3200, () => {
      if (!this.active) return;
      for (const e of this.eyesList) e.setVisible(false);
      scene.time.delayedCall(120, () => {
        if (!this.active) return;
        for (const e of this.eyesList) e.setVisible(true);
        this.scheduleBlink(scene);
      });
    });
  }

  // ---- 造形 ----

  private drawFigure(scene: Phaser.Scene, p: Palette, isMono: boolean): Phaser.GameObjects.Container {
    const c = scene.add.container(0, 0);
    switch (this.npcId) {
      case 'kotono':
        this.drawKotono(scene, c, p, isMono);
        break;
      case 'villager_b':
        this.drawVillagerB(scene, c, p, isMono);
        break;
      default:
        this.drawVillagerA(scene, c, p, isMono);
        break;
    }
    return c;
  }

  /** 腰の曲がった老命名師。杖・白髪の髷・肩掛け */
  private drawKotono(scene: Phaser.Scene, c: Phaser.GameObjects.Container, p: Palette, isMono: boolean): void {
    const g = scene.add.graphics();
    // 杖
    g.lineStyle(2.5, p.prop, 1);
    g.lineBetween(13, 2, 17, -26);
    g.fillStyle(p.prop, 1);
    g.fillCircle(17, -26, 2.5);
    // 着物（前屈みの台形）
    g.fillStyle(p.robe, 1);
    g.beginPath();
    g.moveTo(-13, 2);
    g.lineTo(11, 2);
    g.lineTo(8, -16);
    g.lineTo(-4, -24);
    g.lineTo(-12, -12);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x3a322c, isMono ? 0.5 : 0.8);
    g.strokePath();
    // 肩掛け
    g.fillStyle(p.robe2, 1);
    g.beginPath();
    g.moveTo(-12, -12);
    g.lineTo(-4, -24);
    g.lineTo(4, -20);
    g.lineTo(-6, -10);
    g.closePath();
    g.fillPath();
    // 頭（前方に突き出す）
    g.fillStyle(p.skin, 1);
    g.fillCircle(-7, -29, 7.5);
    g.lineStyle(1.6, 0x3a322c, 0.85);
    g.strokeCircle(-7, -29, 7.5);
    // 白髪の髷
    g.fillStyle(isMono ? 0xc4beb2 : 0xe8e2d6, 1);
    g.fillCircle(-9, -36, 4.2);
    g.fillCircle(-4, -35, 3);
    c.add(g);
    // 目（閉じ気味の線）
    const eyes = scene.add.graphics();
    eyes.lineStyle(1.4, 0x3a322c, 0.9);
    eyes.lineBetween(-12, -29, -9, -28.4);
    eyes.lineBetween(-6, -28.4, -3, -29);
    c.add(eyes);
    this.eyesList.push(eyes);
  }

  /** 農夫。編笠・鍬・たすき掛け */
  private drawVillagerA(scene: Phaser.Scene, c: Phaser.GameObjects.Container, p: Palette, isMono: boolean): void {
    const g = scene.add.graphics();
    // 鍬
    g.lineStyle(2.4, p.prop, 1);
    g.lineBetween(-14, 0, -18, -30);
    g.fillStyle(0x6a6a6a, 1);
    g.fillRect(-23, -33, 8, 4);
    // 着物
    g.fillStyle(p.robe, 1);
    g.beginPath();
    g.moveTo(-12, 2);
    g.lineTo(12, 2);
    g.lineTo(9, -22);
    g.lineTo(-9, -22);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x3a322c, isMono ? 0.5 : 0.8);
    g.strokePath();
    // たすき
    g.lineStyle(2, p.robe2, 1);
    g.lineBetween(-8, -20, 8, -8);
    // 頭
    g.fillStyle(p.skin, 1);
    g.fillCircle(0, -30, 8);
    g.lineStyle(1.6, 0x3a322c, 0.85);
    g.strokeCircle(0, -30, 8);
    // 編笠
    g.fillStyle(isMono ? 0xb0a892 : 0xc8b478, 1);
    g.beginPath();
    g.arc(0, -34, 11, Math.PI, 0);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.4, 0x3a322c, 0.7);
    g.lineBetween(-11, -34, 11, -34);
    c.add(g);
    const eyes = scene.add.graphics();
    eyes.fillStyle(0x3a322c, 0.95);
    eyes.fillCircle(-3, -29, 1.1);
    eyes.fillCircle(3, -29, 1.1);
    c.add(eyes);
    this.eyesList.push(eyes);
  }

  /** 水汲みの女。前掛け・桶・結い髪 */
  private drawVillagerB(scene: Phaser.Scene, c: Phaser.GameObjects.Container, p: Palette, isMono: boolean): void {
    const g = scene.add.graphics();
    // 桶（左腰）
    g.fillStyle(p.prop, 1);
    g.fillRect(-19, -12, 10, 11);
    g.lineStyle(1.4, 0x3a322c, 0.8);
    g.strokeRect(-19, -12, 10, 11);
    g.lineBetween(-19, -8, -9, -8);
    // 着物（裾広がり）
    g.fillStyle(p.robe, 1);
    g.beginPath();
    g.moveTo(-11, 2);
    g.lineTo(11, 2);
    g.lineTo(7, -22);
    g.lineTo(-7, -22);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x3a322c, isMono ? 0.5 : 0.8);
    g.strokePath();
    // 前掛け
    g.fillStyle(0xf0e8d8, isMono ? 0.55 : 0.9);
    g.fillTriangle(-6, 0, 6, 0, 0, -14);
    // 頭
    g.fillStyle(p.skin, 1);
    g.fillCircle(0, -30, 7.5);
    g.lineStyle(1.6, 0x3a322c, 0.85);
    g.strokeCircle(0, -30, 7.5);
    // 結い髪
    g.fillStyle(isMono ? 0x84807a : 0x4a3a30, 1);
    g.beginPath();
    g.arc(0, -32, 7.8, Math.PI * 1.05, Math.PI * 1.95);
    g.closePath();
    g.fillPath();
    g.fillCircle(0, -39, 3.4);
    c.add(g);
    const eyes = scene.add.graphics();
    eyes.fillStyle(0x3a322c, 0.95);
    eyes.fillCircle(-2.6, -29, 1.1);
    eyes.fillCircle(2.6, -29, 1.1);
    c.add(eyes);
    this.eyesList.push(eyes);
  }
}
