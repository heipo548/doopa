// NPC — モノクロのシルエット → 彩色で色がもどる（SPEC.md §14）

import Phaser from 'phaser';

export interface NpcStyle {
  robe: number;
  robeColor: number;
  small?: boolean;
}

export const NPC_STYLES: Record<string, NpcStyle> = {
  kotono: { robe: 0x8a8478, robeColor: 0x8c6e4a, small: true },
  villager_a: { robe: 0x9a948a, robeColor: 0x5a7a9a },
  villager_b: { robe: 0x9a948a, robeColor: 0x5a8a5a },
};

export class Npc extends Phaser.GameObjects.Container {
  readonly npcId: string;
  private monoBody: Phaser.GameObjects.Graphics;
  private colorBody: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, npcId: string, x: number, y: number) {
    super(scene, x, y);
    this.npcId = npcId;
    const style = NPC_STYLES[npcId] ?? { robe: 0x9a948a, robeColor: 0x9a948a };
    const h = style.small ? 0.85 : 1;

    const shadow = scene.add.ellipse(0, 4, 26, 8, 0x2a2426, 0.13);
    this.add(shadow);
    this.monoBody = Npc.drawBody(scene, style.robe, h);
    this.colorBody = Npc.drawBody(scene, style.robeColor, h);
    this.colorBody.setAlpha(0);
    this.add([this.monoBody, this.colorBody]);

    scene.add.existing(this);
    this.setDepth(10 + y * 0.001);
    scene.tweens.add({
      targets: this,
      y: y - 2,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private static drawBody(scene: Phaser.Scene, robe: number, h: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(robe, 1);
    // 着物姿の台形
    g.fillTriangle(-14 * h, 2, 14 * h, 2, 0, -30 * h);
    g.fillRect(-10 * h, -18 * h, 20 * h, 20 * h);
    // 頭
    g.fillStyle(0xe8ded0, 1);
    g.fillCircle(0, -36 * h, 9 * h);
    g.lineStyle(2, 0x4a443c, 0.8);
    g.strokeCircle(0, -36 * h, 9 * h);
    return g;
  }

  /** ColorSystem 登録用 */
  get plates(): { mono: Phaser.GameObjects.Graphics; color: Phaser.GameObjects.Graphics } {
    return { mono: this.monoBody, color: this.colorBody };
  }
}
