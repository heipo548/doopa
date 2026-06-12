// プレイヤー — 白い円＋笠（SPEC.md §14）。8方向移動 160px/s（§6）

import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

export class Player extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;
  private inner: Phaser.GameObjects.Container;
  private bobPhase = 0;
  private knockbackUntil = 0;
  invulnUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.inner = scene.add.container(0, 0);
    const g = scene.add.graphics();
    // からだ（白い円）
    g.fillStyle(0xfaf6ec, 1);
    g.lineStyle(2.5, 0x2a2426, 1);
    g.fillCircle(0, -10, 13);
    g.strokeCircle(0, -10, 13);
    // 笠
    g.fillStyle(0x3a322c, 1);
    g.fillTriangle(-17, -16, 17, -16, 0, -32);
    // 足元の影
    const shadow = scene.add.ellipse(0, 4, 24, 8, 0x2a2426, 0.15);
    this.inner.add([shadow, g]);
    this.add(this.inner);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(26, 20);
    this.body.setOffset(-13, -10);
  }

  /** 8方向移動。locked 時は停止 */
  move(dirX: number, dirY: number, locked: boolean, time: number, delta: number): void {
    if (time < this.knockbackUntil) return; // ノックバック減衰中
    if (locked) {
      this.body.setVelocity(0, 0);
      return;
    }
    const len = Math.hypot(dirX, dirY);
    if (len > 0) {
      this.body.setVelocity((dirX / len) * PLAYER_SPEED, (dirY / len) * PLAYER_SPEED);
      this.bobPhase += delta * 0.02;
      this.inner.y = Math.sin(this.bobPhase) * 1.8;
    } else {
      this.body.setVelocity(0, 0);
      this.inner.y = 0;
    }
  }

  knockback(fromX: number, fromY: number, time: number): void {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.body.setVelocity((dx / len) * 330, (dy / len) * 330);
    this.knockbackUntil = time + 240;
    this.invulnUntil = time + 1000;
  }
}
