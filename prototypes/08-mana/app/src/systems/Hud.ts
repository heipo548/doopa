// HUD — SPEC.md §11-1 / §11-3
// 左下: 語彙の巻物（直近5字・クリックで全語彙）/ 右上: 木札のキーガイド /
// 右下: お守り型の妹の名スロット＋数珠の玉 / 上中央: 紙片のトースト

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Ctx } from './context';

export class Hud {
  private scene: Phaser.Scene;
  private ctx: Ctx;
  private vocabText!: Phaser.GameObjects.Text;
  private guideText!: Phaser.GameObjects.Text;
  private guideBg!: Phaser.GameObjects.Graphics;
  private sisterFirst!: Phaser.GameObjects.Text;
  private sisterSecond!: Phaser.GameObjects.Text;
  private gemDots: Phaser.GameObjects.Arc[] = [];
  private panel: Phaser.GameObjects.Container | null = null;
  private toastY = 0;

  constructor(scene: Phaser.Scene, ctx: Ctx) {
    this.scene = scene;
    this.ctx = ctx;

    // ---- 語彙の巻物（左下） ----
    const scroll = scene.add.container(14, GAME_HEIGHT - 14).setScrollFactor(0).setDepth(1000);
    const sg = scene.add.graphics();
    sg.fillStyle(0x2a2426, 0.22); // 影
    sg.fillRoundedRect(4, -44, 230, 46, 6);
    sg.fillStyle(0xf2ecda, 1); // 紙面
    sg.fillRect(12, -46, 206, 46);
    sg.lineStyle(1.6, 0x8a8478, 0.9);
    sg.strokeRect(12, -46, 206, 46);
    sg.lineStyle(1, 0x8a8478, 0.4);
    sg.lineBetween(12, -38, 218, -38);
    // 巻き軸（両端）
    for (const rx of [6, 224] as const) {
      sg.fillStyle(0x6a5238, 1);
      sg.fillRoundedRect(rx - 6, -50, 12, 54, 5);
      sg.fillStyle(0x8a6a48, 1);
      sg.fillRoundedRect(rx - 4, -48, 8, 50, 4);
      sg.fillStyle(0x4a3a28, 1);
      sg.fillCircle(rx, -50, 3.4);
      sg.fillCircle(rx, 5, 3.4);
    }
    scroll.add(sg);
    const label = scene.add
      .text(18, -44, 'ことのは', { fontFamily: FONT, fontSize: '10px', color: '#8A8478' })
      .setResolution(2);
    this.vocabText = scene.add
      .text(22, -34, '', { fontFamily: FONT, fontSize: '25px', color: COLORS.inkStr })
      .setResolution(2);
    scroll.add([label, this.vocabText]);
    const hit = scene.add
      .rectangle(115, -23, 230, 50, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.ctx.audio.se('paper');
      this.togglePanel();
    });
    scroll.add(hit);

    // ---- キーガイド（右上・木札） ----
    this.guideBg = scene.add.graphics().setScrollFactor(0).setDepth(1000);
    this.guideText = scene.add
      .text(GAME_WIDTH - 22, 18, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#F0E8D8',
        align: 'right',
        lineSpacing: 5,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001)
      .setResolution(2);

    // ---- 妹の名スロット（右下・お守り §11-3） ----
    const charm = scene.add.container(GAME_WIDTH - 58, GAME_HEIGHT - 44).setScrollFactor(0).setDepth(1000);
    const cg = scene.add.graphics();
    // 紐と結び
    cg.lineStyle(2, 0x8a3a30, 1);
    cg.beginPath();
    cg.arc(0, -34, 7, Math.PI * 0.15, Math.PI * 0.85, true);
    cg.strokePath();
    cg.fillStyle(0x8a3a30, 1);
    cg.fillCircle(0, -28, 2.6);
    // お守り本体（影→布→縁）
    cg.fillStyle(0x2a2426, 0.25);
    cg.fillRoundedRect(-25, -24, 52, 60, { tl: 10, tr: 10, bl: 16, br: 16 });
    cg.fillStyle(0xa84038, 1);
    cg.fillRoundedRect(-27, -27, 52, 60, { tl: 10, tr: 10, bl: 16, br: 16 });
    cg.fillStyle(0xc05048, 1);
    cg.fillRoundedRect(-23, -23, 44, 52, { tl: 8, tr: 8, bl: 14, br: 14 });
    cg.lineStyle(1.4, 0xe0a060, 0.8);
    cg.strokeRoundedRect(-20, -20, 38, 46, { tl: 7, tr: 7, bl: 12, br: 12 });
    charm.add(cg);
    const charmLabel = scene.add
      .text(-1, -12, 'いもうとの な', { fontFamily: FONT, fontSize: '8px', color: '#F0D8B8' })
      .setOrigin(0.5)
      .setResolution(2);
    this.sisterFirst = scene.add
      .text(-10, 8, '◇', { fontFamily: FONT, fontSize: '24px', color: '#E8C8B8' })
      .setOrigin(0.5)
      .setResolution(2);
    this.sisterSecond = scene.add
      .text(11, 8, '◇', { fontFamily: FONT, fontSize: '24px', color: '#E8C8B8' })
      .setOrigin(0.5)
      .setResolution(2);
    charm.add([charmLabel, this.sisterFirst, this.sisterSecond]);

    // ---- 玉（お守りの左に数珠のように） ----
    for (let i = 0; i < 3; i++) {
      const x = GAME_WIDTH - 118 + i * 19;
      const dot = scene.add
        .circle(x, GAME_HEIGHT - 76, 6, 0xd8d2c6)
        .setStrokeStyle(1.5, 0x8a8478)
        .setScrollFactor(0)
        .setDepth(1000);
      this.gemDots.push(dot);
    }
    // 数珠の紐
    const beadLine = scene.add.graphics().setScrollFactor(0).setDepth(999);
    beadLine.lineStyle(1.2, 0x8a8478, 0.6);
    beadLine.lineBetween(GAME_WIDTH - 124, GAME_HEIGHT - 76, GAME_WIDTH - 74, GAME_HEIGHT - 76);

    this.refresh();
  }

  refresh(): void {
    this.vocabText.setText(this.ctx.inv.recent(5).join(' '));
    this.gemDots.forEach((d, i) => {
      const has = i < this.ctx.inv.gems;
      d.fillColor = has ? COLORS.gold : 0xd8d2c6;
      if (has && d.scale === 1) {
        this.scene.tweens.add({ targets: d, scale: { from: 1.6, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      }
    });
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  }

  setGuide(lines: string[]): void {
    const text = lines.join('\n');
    if (this.guideText.text !== text) {
      this.guideText.setText(text);
      // 木札を文字量に合わせて描き直す
      this.guideBg.clear();
      if (lines.length > 0) {
        const w = this.guideText.width + 26;
        const h = this.guideText.height + 14;
        const x = GAME_WIDTH - 12 - w;
        this.guideBg.fillStyle(0x2a2426, 0.25);
        this.guideBg.fillRoundedRect(x + 3, 14, w, h, 6);
        this.guideBg.fillStyle(0x5a4a38, 0.92);
        this.guideBg.fillRoundedRect(x, 11, w, h, 6);
        this.guideBg.lineStyle(1.2, 0x8a7a62, 0.9);
        this.guideBg.strokeRoundedRect(x + 3, 14, w - 6, h - 6, 4);
        // 木目
        this.guideBg.lineStyle(1, 0x4a3c2e, 0.5);
        for (let i = 1; i < 3; i++) {
          this.guideBg.lineBetween(x + 6, 11 + (h / 3) * i, x + w - 6, 12 + (h / 3) * i + 2);
        }
      }
    }
    this.guideText.setVisible(lines.length > 0);
    this.guideBg.setVisible(lines.length > 0);
  }

  /** ボス解決: 妹の名 一文字目「灯」が金色に灯る */
  revealSister(): void {
    this.sisterFirst.setText('灯').setColor('#FFD890');
    this.scene.tweens.add({
      targets: this.sisterFirst,
      scale: { from: 1.8, to: 1 },
      duration: 700,
      ease: 'Back.easeOut',
    });
    // お守りがひかる
    const glow = this.scene.add
      .image(GAME_WIDTH - 58, GAME_HEIGHT - 40, 'glow')
      .setTint(0xffd890)
      .setScale(1.4)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(1001);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.8, to: 0 },
      scale: 2.4,
      duration: 1200,
      onComplete: () => glow.destroy(),
    });
  }

  toast(text: string): void {
    const c = this.scene.add.container(GAME_WIDTH / 2, 44 + this.toastY).setScrollFactor(0).setDepth(1100);
    const tmp = this.scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '17px', color: COLORS.inkStr })
      .setOrigin(0.5)
      .setResolution(2);
    const w = tmp.width + 34;
    const g = this.scene.add.graphics();
    g.fillStyle(0x2a2426, 0.2);
    g.fillRect(-w / 2 + 2, -14, w, 32);
    g.fillStyle(0xf5f0e6, 0.95);
    g.fillRect(-w / 2, -16, w, 32);
    g.lineStyle(1.4, 0x8a8478, 0.9);
    g.strokeRect(-w / 2, -16, w, 32);
    g.fillStyle(0xb03030, 0.8);
    g.fillRect(-w / 2, -16, 3, 32);
    c.add([g, tmp]);
    c.setAngle(-0.6);
    this.toastY = (this.toastY + 34) % 102;
    c.setAlpha(0);
    this.scene.tweens.add({
      targets: c,
      alpha: 1,
      y: c.y + 6,
      duration: 200,
      onComplete: () => {
        this.scene.tweens.add({
          targets: c,
          alpha: 0,
          delay: 1800,
          duration: 350,
          onComplete: () => c.destroy(),
        });
      },
    });
  }

  /** 全語彙パネル（巻物クリックで開閉） */
  private togglePanel(): void {
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
      return;
    }
    const list = this.ctx.inv.list();
    const cols = 8;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const w = 470;
    const h = rows * 52 + 70;
    const panel = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setScrollFactor(0).setDepth(1200);
    const g = this.scene.add.graphics();
    g.fillStyle(0x2a2426, 0.3);
    g.fillRoundedRect(-w / 2 + 5, -h / 2 + 6, w, h, 8);
    g.fillStyle(0xf5f0e6, 0.98);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(2.5, COLORS.inkSoft, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.lineStyle(1, COLORS.inkSoft, 0.5);
    g.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 6);
    panel.add(g);
    const bg = this.scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive();
    bg.on('pointerdown', () => this.togglePanel());
    panel.add(bg);
    panel.add(
      this.scene.add
        .text(0, -h / 2 + 24, `おぼえた ことのは（${list.length}）`, {
          fontFamily: FONT, fontSize: '15px', color: COLORS.inkSoftStr,
        })
        .setOrigin(0.5)
        .setResolution(2),
    );
    list.forEach((gl, i) => {
      const cx = -w / 2 + 56 + (i % cols) * 52;
      const cy = -h / 2 + 82 + Math.floor(i / cols) * 52;
      panel.add(
        this.scene.add
          .text(cx, cy, gl, { fontFamily: FONT, fontSize: '34px', color: COLORS.inkStr })
          .setOrigin(0.5)
          .setResolution(2),
      );
    });
    panel.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.panel = panel;
  }
}
