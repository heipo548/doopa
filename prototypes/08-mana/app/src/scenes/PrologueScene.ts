// PrologueScene — 8カットの紙芝居（§13-1）。クリック/Eで進む、Esc長押しでスキップ。

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { PROLOGUE_CUTS } from '../data/dialogues';
import { getCtx } from '../systems/context';

export class PrologueScene extends Phaser.Scene {
  private cutIdx = -1;
  private holder!: Phaser.GameObjects.Container;
  private skipHold = 0;
  private skipArc!: Phaser.GameObjects.Graphics;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private transitioning = false;
  private finished = false;

  constructor() {
    super('Prologue');
  }

  create(): void {
    this.cutIdx = -1;
    this.skipHold = 0;
    this.transitioning = false;
    this.finished = false;
    this.cameras.main.setBackgroundColor('#0D0C0B');
    this.cameras.main.fadeIn(500, 13, 12, 11);
    this.holder = this.add.container(0, 0);

    this.add
      .text(GAME_WIDTH - 16, GAME_HEIGHT - 18, 'クリックで すすむ ／ Esc ながおしで スキップ', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#6A645C',
      })
      .setOrigin(1);
    this.skipArc = this.add.graphics();

    this.input.on('pointerdown', () => this.nextCut());
    this.input.keyboard?.on('keydown-E', () => this.nextCut());
    this.input.keyboard?.on('keydown-SPACE', () => this.nextCut());
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false) ?? null;

    this.nextCut();
  }

  update(_time: number, delta: number): void {
    if (this.escKey?.isDown) {
      this.skipHold += delta;
      this.skipArc.clear();
      this.skipArc.lineStyle(3, 0xa8a296, 0.9);
      this.skipArc.beginPath();
      this.skipArc.arc(
        GAME_WIDTH - 40,
        GAME_HEIGHT - 48,
        12,
        -Math.PI / 2,
        -Math.PI / 2 + Math.min(this.skipHold / 1000, 1) * Math.PI * 2,
      );
      this.skipArc.strokePath();
      if (this.skipHold >= 1000) this.finish();
    } else {
      this.skipHold = 0;
      this.skipArc.clear();
    }
  }

  private nextCut(): void {
    if (this.transitioning || this.finished) return;
    this.cutIdx++;
    if (this.cutIdx >= PROLOGUE_CUTS.length) {
      this.finish();
      return;
    }
    this.transitioning = true;
    this.tweens.add({
      targets: this.holder,
      alpha: 0,
      duration: this.cutIdx === 0 ? 0 : 250,
      onComplete: () => {
        this.holder.removeAll(true);
        this.buildCut();
        this.tweens.add({
          targets: this.holder,
          alpha: 1,
          duration: 450,
          onComplete: () => {
            this.transitioning = false;
          },
        });
      },
    });
  }

  private buildCut(): void {
    const cut = PROLOGUE_CUTS[this.cutIdx];
    const ctx = getCtx(this);
    const cx = GAME_WIDTH / 2;
    let y = GAME_HEIGHT / 2 - (cut.lines.length - 1) * 22;
    if (cut.visual === 'table') {
      // 食卓と、空いた椅子
      const g = this.add.graphics();
      g.fillStyle(0x4a443c, 1);
      g.fillRect(cx - 110, 160, 220, 16);
      g.fillRect(cx - 96, 176, 10, 46);
      g.fillRect(cx + 86, 176, 10, 46);
      for (const ox of [-150, 150]) {
        g.fillStyle(0x6a645c, 1);
        g.fillRect(cx + ox - 14, 190, 28, 8);
        g.fillRect(cx + ox - 12, 198, 6, 22);
        g.fillRect(cx + ox + 6, 198, 6, 22);
      }
      // 空いた椅子（輪郭だけが残る）
      g.lineStyle(2, 0x6a645c, 0.5);
      g.strokeRect(cx - 14, 120, 28, 8);
      this.holder.add(g);
      y = 300;
    }
    for (const line of cut.lines) {
      const text = line.replace(/\{NAME\}/g, ctx.playerName);
      const t = this.add
        .text(cx, y, text, { fontFamily: FONT, fontSize: '21px', color: COLORS.paperStr, align: 'center' })
        .setOrigin(0.5)
        .setResolution(2);
      this.holder.add(t);
      y += 44;
    }
    this.holder.setAlpha(0);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(700, 13, 12, 11);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('World');
    });
  }
}
