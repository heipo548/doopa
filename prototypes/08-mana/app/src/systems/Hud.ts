// HUD — SPEC.md §11-1 / §11-3
// 左下: 語彙バッジ（直近5字・クリックで全語彙）/ 右上: 文脈キーガイド /
// 右下: 妹の名スロット「◇◇」＋ 玉 / 上中央: 拾得トースト

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Ctx } from './context';

export class Hud {
  private scene: Phaser.Scene;
  private ctx: Ctx;
  private vocabText!: Phaser.GameObjects.Text;
  private guideText!: Phaser.GameObjects.Text;
  private sisterFirst!: Phaser.GameObjects.Text;
  private sisterSecond!: Phaser.GameObjects.Text;
  private gemDots: Phaser.GameObjects.Arc[] = [];
  private panel: Phaser.GameObjects.Container | null = null;
  private toastY = 0;

  constructor(scene: Phaser.Scene, ctx: Ctx) {
    this.scene = scene;
    this.ctx = ctx;

    // 語彙バッジ（左下）
    const badgeBg = scene.add
      .rectangle(14, GAME_HEIGHT - 14, 230, 46, COLORS.paper, 0.88)
      .setOrigin(0, 1)
      .setStrokeStyle(2, COLORS.inkSoft)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    badgeBg.on('pointerdown', () => this.togglePanel());
    scene.add
      .text(22, GAME_HEIGHT - 56, 'ことのは', { fontFamily: FONT, fontSize: '11px', color: '#8A8478' })
      .setScrollFactor(0)
      .setDepth(1001);
    this.vocabText = scene.add
      .text(28, GAME_HEIGHT - 44, '', { fontFamily: FONT, fontSize: '26px', color: COLORS.inkStr })
      .setScrollFactor(0)
      .setDepth(1001)
      .setResolution(2);

    // キーガイド（右上）
    this.guideText = scene.add
      .text(GAME_WIDTH - 14, 12, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: COLORS.inkSoftStr,
        align: 'right',
        backgroundColor: 'rgba(245,240,230,0.75)',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setResolution(2);

    // 妹の名スロット（右下）§11-3
    scene.add
      .text(GAME_WIDTH - 88, GAME_HEIGHT - 58, 'いもうとの な', {
        fontFamily: FONT, fontSize: '11px', color: '#8A8478',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.sisterFirst = scene.add
      .text(GAME_WIDTH - 76, GAME_HEIGHT - 44, '◇', { fontFamily: FONT, fontSize: '28px', color: '#B8B2A6' })
      .setScrollFactor(0)
      .setDepth(1000)
      .setResolution(2);
    this.sisterSecond = scene.add
      .text(GAME_WIDTH - 44, GAME_HEIGHT - 44, '◇', { fontFamily: FONT, fontSize: '28px', color: '#B8B2A6' })
      .setScrollFactor(0)
      .setDepth(1000)
      .setResolution(2);

    // 玉（妹スロットの上）
    for (let i = 0; i < 3; i++) {
      const dot = scene.add
        .circle(GAME_WIDTH - 66 + i * 18, GAME_HEIGHT - 68, 5, 0xd8d2c6)
        .setStrokeStyle(1.5, 0x8a8478)
        .setScrollFactor(0)
        .setDepth(1000);
      this.gemDots.push(dot);
    }

    this.refresh();
  }

  refresh(): void {
    this.vocabText.setText(this.ctx.inv.recent(5).join(' '));
    this.gemDots.forEach((d, i) => {
      d.fillColor = i < this.ctx.inv.gems ? COLORS.gold : 0xd8d2c6;
    });
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  }

  setGuide(lines: string[]): void {
    const text = lines.join('\n');
    if (this.guideText.text !== text) this.guideText.setText(text);
    this.guideText.setVisible(lines.length > 0);
  }

  /** ボス解決: 妹の名 一文字目「灯」が金色に灯る */
  revealSister(): void {
    this.sisterFirst.setText('灯').setColor('#E0A030');
    this.scene.tweens.add({
      targets: this.sisterFirst,
      scale: { from: 1.6, to: 1 },
      duration: 600,
      ease: 'Back.easeOut',
    });
  }

  toast(text: string): void {
    const t = this.scene.add
      .text(GAME_WIDTH / 2, 44 + this.toastY, text, {
        fontFamily: FONT,
        fontSize: '17px',
        color: COLORS.inkStr,
        backgroundColor: 'rgba(245,240,230,0.92)',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100)
      .setAlpha(0)
      .setResolution(2);
    this.toastY = (this.toastY + 34) % 102;
    this.scene.tweens.add({
      targets: t,
      alpha: 1,
      y: t.y + 6,
      duration: 200,
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          delay: 1800,
          duration: 350,
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  /** 全語彙パネル（バッジクリックで開閉） */
  private togglePanel(): void {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
      return;
    }
    const list = this.ctx.inv.list();
    const cols = 8;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const w = 460;
    const h = rows * 52 + 64;
    const panel = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setScrollFactor(0).setDepth(1200);
    const bg = this.scene.add
      .rectangle(0, 0, w, h, COLORS.paper, 0.97)
      .setStrokeStyle(2.5, COLORS.inkSoft)
      .setInteractive();
    bg.on('pointerdown', () => this.togglePanel());
    panel.add(bg);
    panel.add(
      this.scene.add
        .text(0, -h / 2 + 22, `おぼえた ことのは（${list.length}）`, {
          fontFamily: FONT, fontSize: '15px', color: COLORS.inkSoftStr,
        })
        .setOrigin(0.5),
    );
    list.forEach((g, i) => {
      const cx = -w / 2 + 52 + (i % cols) * 52;
      const cy = -h / 2 + 76 + Math.floor(i / cols) * 52;
      panel.add(
        this.scene.add
          .text(cx, cy, g, { fontFamily: FONT, fontSize: '34px', color: COLORS.inkStr })
          .setOrigin(0.5)
          .setResolution(2),
      );
    });
    this.panel = panel;
  }
}
