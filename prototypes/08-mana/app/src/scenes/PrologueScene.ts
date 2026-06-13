// PrologueScene — 8カットの紙芝居（§13-1）。クリック/Eで進む、Esc長押しでスキップ。
// 各カットに小さな墨の挿絵がつく。

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { PROLOGUE_CUTS } from '../data/dialogues';
import { inkCover, inkReveal } from '../fx/Transitions';
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
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'paperDark').setAlpha(0.85);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.45);
    inkReveal(this);
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
    getCtx(this).audio.se('paper');
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
    this.buildArt(this.cutIdx, cx, 180);
    let y = 330 - (cut.lines.length - 1) * 22;
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

  /** カットごとの小さな墨の挿絵 */
  private buildArt(idx: number, cx: number, cy: number): void {
    const g = this.add.graphics();
    const pale = 0xd8d2c4;
    const dim = 0x6a645c;
    switch (idx) {
      case 0: {
        // 言ノ国 — 字が環になって世界をつなぐ
        const glyphs = ['山', '川', '火', '木', '人', '月'];
        glyphs.forEach((ch, i) => {
          const a = (i / glyphs.length) * Math.PI * 2 - Math.PI / 2;
          const t = this.add
            .text(cx + Math.cos(a) * 88, cy + Math.sin(a) * 52, ch, {
              fontFamily: FONT, fontSize: '24px', color: '#A8A296',
            })
            .setOrigin(0.5)
            .setAlpha(0.8)
            .setResolution(2);
          this.holder.add(t);
          this.tweens.add({
            targets: t,
            y: t.y - 5,
            duration: 1800 + i * 220,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        });
        g.lineStyle(1, 0xa8a296, 0.25);
        g.strokeEllipse(cx, cy, 200, 120);
        break;
      }
      case 1: {
        // ナナシ — 墨が字を呑む
        const t = this.add
          .text(cx - 36, cy, '名', { fontFamily: FONT, fontSize: '44px', color: '#A8A296' })
          .setOrigin(0.5)
          .setResolution(2);
        this.holder.add(t);
        const blob = this.add.image(cx + 38, cy, 'inkblob').setTint(0x000000).setAlpha(0.85).setScale(1.1);
        this.holder.add(blob);
        this.tweens.add({ targets: blob, x: cx - 10, scale: 1.5, duration: 2600, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: t, alpha: 0.25, duration: 2600 });
        break;
      }
      case 2: {
        // 食卓。椅子がひとつ空いている
        g.fillStyle(dim, 1);
        g.fillRect(cx - 110, cy - 20, 220, 14);
        g.fillRect(cx - 96, cy - 6, 9, 40);
        g.fillRect(cx + 87, cy - 6, 9, 40);
        for (const ox of [-150, 150]) {
          g.fillStyle(0x84807a, 1);
          g.fillRect(cx + ox - 14, cy + 8, 28, 8);
          g.fillRect(cx + ox - 12, cy + 16, 6, 20);
          g.fillRect(cx + ox + 6, cy + 16, 6, 20);
        }
        // 空席（輪郭だけが、かすかに脈づく）
        const ghost = this.add.graphics();
        ghost.lineStyle(1.6, 0xa8a296, 0.5);
        ghost.strokeRect(cx - 14, cy - 60, 28, 8);
        ghost.strokeRect(cx - 12, cy - 52, 6, 20);
        ghost.strokeRect(cx + 6, cy - 52, 6, 20);
        this.holder.add(ghost);
        this.tweens.add({ targets: ghost, alpha: 0.2, duration: 1600, yoyo: true, repeat: -1 });
        break;
      }
      case 3: {
        // 黙 — 黒い波が端から
        g.fillStyle(0x000000, 0.8);
        g.beginPath();
        g.moveTo(cx - 240, cy + 60);
        for (let i = 0; i <= 12; i++) {
          g.lineTo(cx - 240 + i * 40, cy + 60 - Math.sin(i * 0.9) * 26 - i * 2);
        }
        g.lineTo(cx + 240, cy + 90);
        g.lineTo(cx - 240, cy + 90);
        g.closePath();
        g.fillPath();
        const silent = this.add
          .text(cx, cy - 30, '黙', { fontFamily: FONT, fontSize: '52px', color: '#3A3A40' })
          .setOrigin(0.5)
          .setResolution(2);
        this.holder.add(silent);
        this.tweens.add({ targets: silent, alpha: { from: 0.9, to: 0.4 }, duration: 2000, yoyo: true, repeat: -1 });
        break;
      }
      case 4: {
        // 家族 — 三人と、覚えのない空白
        for (const [ox, s] of [[-70, 1], [0, 1.15], [70, 0.95]] as const) {
          g.fillStyle(dim, 1);
          g.fillTriangle(cx + ox - 16 * s, cy + 50, cx + ox + 16 * s, cy + 50, cx + ox, cy + 4 * s);
          g.fillCircle(cx + ox, cy - 4 * s, 11 * s);
        }
        g.lineStyle(1.5, 0x84807a, 0.5);
        g.strokeCircle(cx + 140, cy + 18, 16);
        g.beginPath();
        g.moveTo(cx + 124, cy + 50);
        g.lineTo(cx + 156, cy + 50);
        g.lineTo(cx + 140, cy + 28);
        g.closePath();
        g.strokePath();
        break;
      }
      case 5: {
        // わたしだけが、覚えている — ちいさな灯
        g.fillStyle(pale, 0.12);
        g.fillCircle(cx, cy, 60);
        const flame = this.add.graphics();
        flame.fillStyle(0xd8a860, 0.9);
        flame.fillTriangle(cx - 7, cy + 16, cx + 7, cy + 16, cx, cy - 14);
        this.holder.add(flame);
        this.tweens.add({ targets: flame, scaleY: { from: 0.94, to: 1.1 }, duration: 380, yoyo: true, repeat: -1 });
        break;
      }
      case 6: {
        // コトノ婆が言ノ葉を託す
        g.fillStyle(dim, 1);
        g.fillTriangle(cx - 90, cy + 50, cx - 40, cy + 50, cx - 65, cy - 6);
        g.fillCircle(cx - 60, cy - 14, 10);
        g.fillStyle(0x84807a, 1);
        g.fillTriangle(cx + 44, cy + 50, cx + 92, cy + 50, cx + 68, cy + 0);
        g.fillCircle(cx + 68, cy - 9, 11);
        const gift = this.add
          .text(cx, cy + 6, '言', { fontFamily: FONT, fontSize: '26px', color: '#E0C890' })
          .setOrigin(0.5)
          .setResolution(2);
        this.holder.add(gift);
        const glow = this.add.image(cx, cy + 6, 'glow').setTint(0xe0c890).setScale(0.7).setAlpha(0.4);
        this.holder.add(glow);
        this.tweens.add({ targets: [gift, glow], y: cy, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      default: {
        // 旅立ち — 道と鳥居の影
        g.lineStyle(2, dim, 0.8);
        g.beginPath();
        g.moveTo(cx - 160, cy + 60);
        g.lineTo(cx - 20, cy + 10);
        g.lineTo(cx + 60, cy + 4);
        g.strokePath();
        g.fillStyle(0x84807a, 0.9);
        g.fillRect(cx + 88, cy - 44, 6, 48);
        g.fillRect(cx + 128, cy - 44, 6, 48);
        g.fillRect(cx + 78, cy - 52, 66, 7);
        break;
      }
    }
    this.holder.add(g);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    inkCover(this, () => this.scene.start('World'));
  }
}
