// TitleScene — J7: 黒地に「真名」が墨で滲み出す → 円相が一筆で描かれ → MANA フェード
// 名前入力（最大6文字・デフォルト「ヒビキ」§5）→ はじめる / つづきから
// ※ ボタン座標は E2E と互換（はじめる 480,448 / つづきから 480,498 / 入力 388）

import Phaser from 'phaser';
import { COLORS, DEFAULT_PLAYER_NAME, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { inkBurst } from '../fx/InkParticles';
import { inkCover } from '../fx/Transitions';
import { continueGame, getCtx, newGame } from '../systems/context';

export class TitleScene extends Phaser.Scene {
  private nameInput: HTMLInputElement | null = null;
  private started = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.started = false;
    this.cameras.main.setBackgroundColor('#0D0C0B');
    const cx = GAME_WIDTH / 2;
    const ctx = getCtx(this);

    // 闇の和紙＋ただよう墨煙
    this.add.tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'paperDark').setAlpha(0.9);
    for (let i = 0; i < 4; i++) {
      const smoke = this.add
        .image(Math.random() * GAME_WIDTH, 80 + Math.random() * 380, 'inkblob')
        .setTint(0x000000)
        .setAlpha(0.16)
        .setScale(2.2 + Math.random() * 1.6);
      this.tweens.add({
        targets: smoke,
        x: smoke.x + (Math.random() < 0.5 ? -130 : 130),
        y: smoke.y - 30,
        alpha: 0.08,
        scale: smoke.scale * 1.25,
        duration: 16000 + Math.random() * 9000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // ビネット
    this.add.image(cx, GAME_HEIGHT / 2, 'vignette').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.5);

    // 円相 — 一筆の円がタイトルの背後に描かれていく
    const enso = this.add.graphics();
    const ensoState = { t: 0 };
    this.tweens.add({
      targets: ensoState,
      t: 1,
      delay: 500,
      duration: 1300,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        enso.clear();
        const start = -Math.PI * 0.62;
        const span = Math.PI * 1.78 * ensoState.t;
        for (let i = 0; i < 3; i++) {
          enso.lineStyle(13 - i * 4, 0xf5f0e6, 0.05 + i * 0.014);
          enso.beginPath();
          enso.arc(cx, 178, 136 + i * 4, start, start + span);
          enso.strokePath();
        }
      },
    });

    // 「真名」が墨で滲み出す
    const chars = ['真', '名'];
    chars.forEach((ch, i) => {
      const t = this.add
        .text(cx - 75 + i * 150, 150, ch, { fontFamily: FONT, fontSize: '128px', color: COLORS.paperStr })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(1.5)
        .setResolution(2);
      const ghost = this.add
        .text(t.x, t.y, ch, { fontFamily: FONT, fontSize: '128px', color: COLORS.paperStr })
        .setOrigin(0.5)
        .setAlpha(0)
        .setResolution(2);
      this.tweens.add({
        targets: t,
        alpha: 1,
        scale: 1,
        delay: 300 + i * 450,
        duration: 700,
        ease: 'Cubic.easeOut',
        onStart: () => inkBurst(this, t.x, t.y, { n: 14, color: 0xf5f0e6, speed: 95 }),
        onComplete: () => {
          // 滲みの余韻（薄い残像がゆっくり脈づく）
          ghost.setAlpha(0.12).setScale(1.06);
          this.tweens.add({
            targets: ghost,
            alpha: 0.05,
            scale: 1.1,
            duration: 2400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
    });
    // 金粉がゆっくり舞う
    const dust = this.add.particles(cx, 170, 'inkdot', {
      x: { min: -180, max: 180 },
      y: { min: -90, max: 90 },
      speedY: { min: -8, max: -20 },
      speedX: { min: -6, max: 6 },
      lifespan: 4200,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      frequency: 380,
      tint: [0xc8a03c, 0xf0d8a0],
    });
    dust.setDepth(2);

    const mana = this.add
      .text(cx, 238, '- M A N A -', { fontFamily: FONT, fontSize: '20px', color: '#A8A296' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: mana, alpha: 1, delay: 1500, duration: 800 });
    const concept = this.add
      .text(cx, 280, '世界は、名前でできている。', { fontFamily: FONT, fontSize: '16px', color: '#8A8478' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: concept, alpha: 1, delay: 2100, duration: 800 });

    // 名前入力
    const prompt = this.add
      .text(cx, 330, 'なまえを つけてください', { fontFamily: FONT, fontSize: '18px', color: COLORS.paperStr })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, delay: 2400, duration: 600 });

    this.makeNameInput();

    const startBtn = this.makeButton(cx, 448, 'はじめる', () => this.startNew());
    this.tweens.add({ targets: startBtn, alpha: { from: 0, to: 1 }, delay: 2600, duration: 600 });

    if (ctx.save.exists()) {
      const contBtn = this.makeButton(cx, 498, 'つづきから', () => this.startContinue());
      this.tweens.add({ targets: contBtn, alpha: { from: 0, to: 1 }, delay: 2700, duration: 600 });
    }

    this.input.keyboard?.on('keydown-ENTER', () => this.startNew());
    this.input.once('pointerdown', () => {
      ctx.audio.unlock();
      ctx.music.start();
      ctx.music.setMood('title');
    });
    this.events.once('shutdown', () => this.removeInput());
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xf5f0e6, 0.07);
    g.fillRoundedRect(-110, -20, 220, 40, 4);
    g.lineStyle(1.5, 0xa8a296, 0.9);
    g.strokeRoundedRect(-110, -20, 220, 40, 4);
    g.lineStyle(1, 0xa8a296, 0.35);
    g.strokeRoundedRect(-106, -16, 212, 32, 3);
    const t = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '19px', color: COLORS.paperStr })
      .setOrigin(0.5)
      .setResolution(2);
    const hit = this.add
      .rectangle(0, 0, 220, 40, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      this.tweens.add({ targets: c, scale: 1.04, duration: 100 });
      getCtx(this).audio.se('paper');
    });
    hit.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    hit.on('pointerdown', onClick);
    c.add([g, t, hit]);
    return c;
  }

  private makeNameInput(): void {
    this.removeInput();
    const input = document.createElement('input');
    input.className = 'mana-name-input';
    input.maxLength = 6;
    input.value = DEFAULT_PLAYER_NAME;
    document.body.appendChild(input);
    this.nameInput = input;
    this.positionInput();
    this.scale.on('resize', this.positionInput, this);
  }

  /** canvas のスケールに合わせて DOM input を配置 */
  private positionInput(): void {
    if (!this.nameInput) return;
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + rect.width * 0.5;
    const y = rect.top + rect.height * (388 / GAME_HEIGHT);
    this.nameInput.style.left = `${x}px`;
    this.nameInput.style.top = `${y}px`;
  }

  private removeInput(): void {
    this.scale.off('resize', this.positionInput, this);
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
  }

  private startNew(): void {
    if (this.started) return;
    this.started = true;
    const ctx = getCtx(this);
    ctx.audio.unlock();
    ctx.music.start();
    const name = (this.nameInput?.value ?? '').trim().slice(0, 6) || DEFAULT_PLAYER_NAME;
    newGame(ctx, name);
    ctx.audio.se('confirm');
    this.removeInput();
    inkCover(this, () => this.scene.start('Prologue'));
  }

  private startContinue(): void {
    if (this.started) return;
    const ctx = getCtx(this);
    const data = ctx.save.load();
    if (!data) return;
    this.started = true;
    ctx.audio.unlock();
    ctx.music.start();
    continueGame(ctx, data);
    ctx.audio.se('confirm');
    this.removeInput();
    inkCover(this, () => this.scene.start('World'));
  }
}
