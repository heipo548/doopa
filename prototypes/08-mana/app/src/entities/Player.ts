// プレイヤー — 白い円＋笠（SPEC.md §14）。8方向移動 160px/s（§6）
// 演出: 歩行ボブ・進行方向への傾き・笠の揺れ・呼吸・影の伸縮

import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

export class Player extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;
  private inner: Phaser.GameObjects.Container;
  private hat: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private bobPhase = 0;
  private breathe = 0;
  private knockbackUntil = 0;
  invulnUntil = 0;
  /** WorldScene が足音/土埃に使う */
  moving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.inner = scene.add.container(0, 0);

    this.shadow = scene.add.ellipse(0, 4, 26, 9, 0x2a2426, 0.16);

    const g = scene.add.graphics();
    // からだ（白い装束・裾の線）
    g.fillStyle(0xfaf6ec, 1);
    g.lineStyle(2.5, 0x2a2426, 1);
    g.fillCircle(0, -10, 13);
    g.strokeCircle(0, -10, 13);
    g.lineStyle(1.4, 0x9a917f, 0.8);
    g.beginPath();
    g.arc(0, -8, 10.5, Math.PI * 0.18, Math.PI * 0.82);
    g.strokePath();
    // 帯
    g.fillStyle(0x8c6e4a, 0.9);
    g.fillRect(-9, -8, 18, 3);
    // 風呂敷（方向の手がかりに右肩へ）
    g.fillStyle(0xb03030, 0.85);
    g.fillCircle(10, -16, 4);
    g.lineStyle(1.2, 0x6a2020, 0.9);
    g.strokeCircle(10, -16, 4);

    // 笠（二層＋縁線＋頂点の結び）
    this.hat = scene.add.graphics();
    this.hat.fillStyle(0x4a3f33, 1);
    this.hat.fillTriangle(-18, -15, 18, -15, 0, -33);
    this.hat.fillStyle(0x6a5a44, 1);
    this.hat.fillTriangle(-13, -19, 13, -19, 0, -32);
    this.hat.lineStyle(2, 0x2a2426, 1);
    this.hat.strokeTriangle(-18, -15, 18, -15, 0, -33);
    this.hat.fillStyle(0x2a2426, 1);
    this.hat.fillCircle(0, -33, 2);

    this.inner.add([this.shadow, g, this.hat]);
    this.add(this.inner);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(26, 20);
    this.body.setOffset(-13, -10);
  }

  /** 8方向移動。locked 時は停止 */
  move(dirX: number, dirY: number, locked: boolean, time: number, delta: number): void {
    if (time < this.knockbackUntil) return; // ノックバック減衰中
    this.breathe += delta * 0.0024;
    if (locked) {
      this.body.setVelocity(0, 0);
      this.moving = false;
      this.idlePose();
      return;
    }
    const len = Math.hypot(dirX, dirY);
    if (len > 0) {
      this.moving = true;
      this.body.setVelocity((dirX / len) * PLAYER_SPEED, (dirY / len) * PLAYER_SPEED);
      this.bobPhase += delta * 0.021;
      const bob = Math.sin(this.bobPhase);
      this.inner.y = bob * 2.2;
      this.inner.angle = (dirX / len) * 4 + bob * 1.5; // 進行方向へ傾ぐ
      this.hat.y = Math.sin(this.bobPhase - 0.6) * 0.9; // 笠は半歩おくれて揺れる
      this.shadow.setScale(1 - Math.abs(bob) * 0.12, 1);
    } else {
      this.moving = false;
      this.body.setVelocity(0, 0);
      this.idlePose();
    }
  }

  private idlePose(): void {
    const b = Math.sin(this.breathe) * 0.8;
    this.inner.y = b;
    this.inner.angle *= 0.85;
    this.hat.y = b * 0.4;
    this.shadow.setScale(1, 1);
  }

  knockback(fromX: number, fromY: number, time: number): void {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.body.setVelocity((dx / len) * 330, (dy / len) * 330);
    this.knockbackUntil = time + 240;
    this.invulnUntil = time + 1000;
    // 被弾の白点滅
    this.scene.tweens.add({ targets: this.inner, alpha: { from: 0.35, to: 1 }, duration: 110, repeat: 3 });
  }
}
