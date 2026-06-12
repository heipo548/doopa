// TitleScene — J7: 黒地に「真名」が墨で滲み出す → 英字 MANA フェード（§12）
// 名前入力（最大6文字・デフォルト「ヒビキ」§5）→ はじめる / つづきから

import Phaser from 'phaser';
import { COLORS, DEFAULT_PLAYER_NAME, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { inkBurst } from '../fx/InkParticles';
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

    // 「真名」が墨で滲み出す
    const chars = ['真', '名'];
    chars.forEach((ch, i) => {
      const t = this.add
        .text(cx - 75 + i * 150, 150, ch, { fontFamily: FONT, fontSize: '128px', color: COLORS.paperStr })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(1.5)
        .setResolution(2);
      this.tweens.add({
        targets: t,
        alpha: 1,
        scale: 1,
        delay: 300 + i * 450,
        duration: 700,
        ease: 'Cubic.easeOut',
        onStart: () => inkBurst(this, t.x, t.y, { n: 12, color: 0xf5f0e6, speed: 90 }),
      });
    });
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
    this.input.once('pointerdown', () => ctx.audio.unlock());
    this.events.once('shutdown', () => this.removeInput());
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 220, 40, COLORS.paper, 0.12)
      .setStrokeStyle(1.5, 0xa8a296)
      .setInteractive({ useHandCursor: true });
    const t = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '19px', color: COLORS.paperStr })
      .setOrigin(0.5)
      .setResolution(2);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.paper, 0.28));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.paper, 0.12));
    bg.on('pointerdown', onClick);
    c.add([bg, t]);
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
    const name = (this.nameInput?.value ?? '').trim().slice(0, 6) || DEFAULT_PLAYER_NAME;
    newGame(ctx, name);
    ctx.audio.se('confirm');
    this.removeInput();
    this.cameras.main.fadeOut(600, 13, 12, 11);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Prologue');
    });
  }

  private startContinue(): void {
    if (this.started) return;
    const ctx = getCtx(this);
    const data = ctx.save.load();
    if (!data) return;
    this.started = true;
    ctx.audio.unlock();
    continueGame(ctx, data);
    ctx.audio.se('confirm');
    this.removeInput();
    this.cameras.main.fadeOut(600, 13, 12, 11);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('World');
    });
  }
}
