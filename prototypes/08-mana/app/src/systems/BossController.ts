// BossController — 火のナナシ戦（SPEC.md §10）
// INTRO → FIGHT_P1（体当たり・正解「火」）→ FIGHT_P2（炎・粒弾・鐘→丁→灯）→ RESOLVE
// ダメージ数値なし。「緊張は弾幕でなく、組み上げるための知的タイマー」

import Phaser from 'phaser';
import { BOSS_ARENA, BOSS_HOME } from '../data/level_village';
import { attachSwirl } from '../fx/InkParticles';
import type { WorldScene } from '../scenes/WorldScene';

export type BossPhase = 'idle' | 'intro' | 'p1' | 'pause1' | 'p2' | 'stun' | 'resolve' | 'done';

interface Bullet {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  born: number;
}

export class BossController {
  phase: BossPhase = 'idle';
  private world: WorldScene;
  private blob: Phaser.GameObjects.Container | null = null;
  private blob2: Phaser.GameObjects.Container | null = null;
  private swirls: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private bullets: Bullet[] = [];
  private dashState: 'rest' | 'dash' = 'rest';
  private dashLeft = 900;
  private dashVx = 0;
  private dashVy = 0;
  private bulletTimer = 1200;
  private bulletWave = 0;
  private stunLeft = 0;
  private hits = 0;
  private assistSaid = false;
  private bellUsed = false;
  private orbitT = 0;

  constructor(world: WorldScene) {
    this.world = world;
  }

  start(): void {
    if (this.phase !== 'idle') return;
    this.phase = 'intro';
    this.world.beginCutscene();
    this.blob = this.makeBlob(BOSS_HOME.x, BOSS_HOME.y, 56);
    this.world.cameras.main.shake(200, 0.003);
    this.world.sayKey('boss_intro', undefined, () => {
      this.phase = 'p1';
      this.world.endCutscene();
      this.world.setBossGate(true);
    });
  }

  isFighting(): boolean {
    return this.phase === 'p1' || this.phase === 'pause1' || this.phase === 'p2' || this.phase === 'stun';
  }

  /** 名付けモードを開けるか（P1: いつでも / P2: 鐘の鎮み中のみ §10） */
  canName(): boolean {
    return this.phase === 'p1' || this.phase === 'stun';
  }

  update(time: number, delta: number): void {
    if (!this.blob) return;
    if (this.phase === 'p1') this.updateP1(time, delta);
    else if (this.phase === 'p2') this.updateP2(time, delta);
    else if (this.phase === 'stun') {
      this.stunLeft -= delta;
      if (this.stunLeft <= 0) {
        this.phase = 'p2';
        this.blob.setAlpha(1);
        this.blob2?.setAlpha(1);
      }
    }
    this.updateBullets(time, delta);
  }

  private updateP1(time: number, delta: number): void {
    const blob = this.blob;
    if (!blob) return;
    this.dashLeft -= delta;
    if (this.dashState === 'rest' && this.dashLeft <= 0) {
      // プレイヤーへ向かって突進（速度200・1.5s間隔 §10）
      const p = this.world.playerPos();
      const dx = p.x - blob.x;
      const dy = p.y - blob.y;
      const len = Math.hypot(dx, dy) || 1;
      this.dashVx = (dx / len) * 200;
      this.dashVy = (dy / len) * 200;
      this.dashState = 'dash';
      this.dashLeft = 650;
      this.world.playSe('thud');
    } else if (this.dashState === 'dash') {
      blob.x += this.dashVx * (delta / 1000);
      blob.y += this.dashVy * (delta / 1000);
      this.clampToArena(blob);
      if (this.dashLeft <= 0) {
        this.dashState = 'rest';
        this.dashLeft = 850;
      }
    }
    this.checkContact(time, blob, 50);
  }

  private updateP2(time: number, delta: number): void {
    const blob = this.blob;
    if (!blob) return;
    // 二つの炎が社のまわりを旋回
    this.orbitT += delta / 1000;
    blob.x = BOSS_HOME.x + Math.cos(this.orbitT * 1.1) * 90;
    blob.y = BOSS_HOME.y + Math.sin(this.orbitT * 1.1) * 46;
    if (this.blob2) {
      this.blob2.x = BOSS_HOME.x - Math.cos(this.orbitT * 1.1) * 90;
      this.blob2.y = BOSS_HOME.y - Math.sin(this.orbitT * 1.1) * 46;
    }
    // 放射弾: 8方向・速度120・2s毎（§10）
    this.bulletTimer -= delta;
    if (this.bulletTimer <= 0) {
      this.bulletTimer = 2000;
      this.bulletWave++;
      const offset = (this.bulletWave % 2) * (Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + offset;
        const img = this.world.add
          .image(blob.x, blob.y, 'dot8')
          .setTint(0xe06a30)
          .setScale(1.8)
          .setDepth(700);
        this.bullets.push({ img, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, born: time });
      }
    }
    this.checkContact(time, blob, 46);
    if (this.blob2) this.checkContact(time, this.blob2, 46);
  }

  private updateBullets(time: number, delta: number): void {
    const p = this.world.playerPos();
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.img.x += b.vx * (delta / 1000);
      b.img.y += b.vy * (delta / 1000);
      const out =
        b.img.x < BOSS_ARENA.x - 60 ||
        b.img.x > BOSS_ARENA.x + BOSS_ARENA.w + 60 ||
        b.img.y < BOSS_ARENA.y - 60 ||
        b.img.y > BOSS_ARENA.y + BOSS_ARENA.h + 60;
      if (time - b.born > 4500 || out) {
        b.img.destroy();
        this.bullets.splice(i, 1);
        continue;
      }
      if (Phaser.Math.Distance.Between(b.img.x, b.img.y, p.x, p.y) < 22) {
        b.img.destroy();
        this.bullets.splice(i, 1);
        this.onPlayerHit(time, b.img.x, b.img.y);
      }
    }
  }

  private checkContact(time: number, blob: Phaser.GameObjects.Container, radius: number): void {
    if (this.phase === 'stun') return;
    const p = this.world.playerPos();
    if (Phaser.Math.Distance.Between(blob.x, blob.y, p.x, p.y) < radius) {
      this.onPlayerHit(time, blob.x, blob.y);
    }
  }

  private onPlayerHit(time: number, fromX: number, fromY: number): void {
    if (!this.world.tryHitPlayer(time, fromX, fromY)) return;
    if (this.phase === 'p2') {
      this.hits++;
      // 被弾3回でコトノ婆の叫びアシスト（§7-5 / §10）
      if (this.hits >= 3 && !this.assistSaid) {
        this.assistSaid = true;
        this.world.sayKey('boss_assist');
      }
    }
  }

  /** P1 正解「火」 */
  onFireNamed(): void {
    if (this.phase !== 'p1') return;
    this.phase = 'pause1';
    this.dashState = 'rest';
    this.world.sayKey('boss_named', undefined, () => {
      this.world.sayKey('boss_phase2', undefined, () => this.enterP2());
    });
    // 鎮静の白む演出（3秒 §10）
    if (this.blob) {
      this.world.tweens.add({ targets: this.blob, alpha: 0.45, duration: 400, yoyo: true, repeat: 2 });
    }
  }

  private enterP2(): void {
    if (!this.blob) return;
    // sys_en 演出: 火＋火＝炎（プレイヤー使用不可のシステムレシピ §8-2）
    this.world.showFormula('火 ＋ 火 ＝ 炎');
    this.blob2 = this.makeBlob(this.blob.x + 60, this.blob.y, 40);
    this.blob.setScale(0.8);
    this.phase = 'p2';
    this.bulletTimer = 1400;
  }

  /** 社の鐘（E）→ ゴーン → 5秒の鎮み。初回のみ「丁」落下（§10） */
  onBell(): void {
    this.world.playSe('bell');
    if (this.phase !== 'p2' && this.phase !== 'stun') return;
    this.phase = 'stun';
    this.stunLeft = 5000;
    for (const b of this.bullets) b.img.destroy();
    this.bullets = [];
    this.blob?.setAlpha(0.4);
    this.blob2?.setAlpha(0.4);
    this.world.cameras.main.shake(160, 0.004);
    if (!this.bellUsed) {
      this.bellUsed = true;
      this.world.spawnFragment('丁', 1430, 230);
      this.world.sayKey('boss_bell_first');
    } else {
      this.world.sayKey('boss_bell');
    }
  }

  /** 灯 → RESOLVE（演出本体は WorldScene.runFinale） */
  beginResolve(): { x: number; y: number } {
    this.phase = 'resolve';
    for (const b of this.bullets) b.img.destroy();
    this.bullets = [];
    for (const s of this.swirls) s.stop();
    const pos = { x: this.blob?.x ?? BOSS_HOME.x, y: this.blob?.y ?? BOSS_HOME.y };
    this.world.setBossGate(false);
    return pos;
  }

  /** 炎が灯籠へ吸い込まれる */
  convergeTo(x: number, y: number, onDone: () => void): void {
    const targets = [this.blob, this.blob2].filter((b): b is Phaser.GameObjects.Container => b !== null);
    let left = targets.length;
    if (left === 0) {
      onDone();
      return;
    }
    for (const t of targets) {
      this.world.tweens.add({
        targets: t,
        x,
        y,
        scale: 0.1,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          t.destroy();
          left--;
          if (left === 0) {
            this.finish();
            onDone();
          }
        },
      });
    }
  }

  private finish(): void {
    for (const s of this.swirls) {
      if (s.active) s.destroy();
    }
    this.swirls = [];
    this.blob = null;
    this.blob2 = null;
    this.phase = 'done';
  }

  private clampToArena(blob: Phaser.GameObjects.Container): void {
    blob.x = Phaser.Math.Clamp(blob.x, BOSS_ARENA.x + 50, BOSS_ARENA.x + BOSS_ARENA.w - 50);
    blob.y = Phaser.Math.Clamp(blob.y, BOSS_ARENA.y + 50, BOSS_ARENA.y + BOSS_ARENA.h - 50);
  }

  private makeBlob(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.world.add.container(x, y);
    const g = this.world.add.graphics();
    g.fillStyle(0x401818, 0.95);
    g.fillCircle(0, 0, size);
    g.fillStyle(0xb03030, 0.7);
    g.fillCircle(size * 0.25, -size * 0.3, size * 0.5);
    g.fillStyle(0xe06a30, 0.6);
    g.fillCircle(-size * 0.2, size * 0.2, size * 0.4);
    c.add(g);
    const glow = this.world.add.image(0, 0, 'glow').setScale(size / 34).setTint(0xe06a30).setAlpha(0.4);
    c.add(glow);
    this.world.tweens.add({
      targets: c,
      scaleX: { from: 0.94, to: 1.08 },
      scaleY: { from: 1.06, to: 0.92 },
      duration: 460,
      yoyo: true,
      repeat: -1,
    });
    c.setDepth(600);
    this.world.add.existing(c);
    this.swirls.push(attachSwirl(this.world, c, size + 10, 0xb03030));
    return c;
  }
}
