// NamingOverlayScene — 名付けUI（SPEC.md §7-2 / §11-2）
// 単字 / 結字（スロット1⇔2タブ）/ 改字（base字＋修飾スロット）
// 見た目: 和紙＋円相（一筆の円）＋原稿用紙ふうのマス＋札のような言ノ葉＋朱印の決定。
// 言ノ葉は消費しない。成立しうる字は淡く明滅（おすすめモード常時ON）。
// ※ 操作座標は E2E と互換（タブ y92 / チップ格子 / 決定ボタン位置は不変）

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { entityById, type EntityDef } from '../data/entities';
import { getCtx, type Ctx } from '../systems/context';
import type { WorldScene } from './WorldScene';

type Mode = 'tanji' | 'ketsuji' | 'kaiji';

const MODE_LABEL: Record<Mode, string> = { tanji: '単字', ketsuji: '結字', kaiji: '改字' };

export class NamingOverlayScene extends Phaser.Scene {
  private targetId!: string;
  private def!: EntityDef;
  private ctx!: Ctx;
  private world!: WorldScene;

  private mode: Mode = 'tanji';
  private modes: Mode[] = [];
  private slots: (string | null)[] = [null];
  private board!: Phaser.GameObjects.Container;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotMarks: Phaser.GameObjects.Graphics[] = [];
  private tabTexts = new Map<Mode, Phaser.GameObjects.Text>();
  private tabLine!: Phaser.GameObjects.Graphics;
  private chips: { glyph: string; hl: Phaser.GameObjects.Rectangle; lift: Phaser.GameObjects.Container }[] = [];
  private msg!: Phaser.GameObjects.Text;
  private decideC!: Phaser.GameObjects.Container;
  private decideBg!: Phaser.GameObjects.Rectangle;
  private deciding = false;

  constructor() {
    super('NamingOverlay');
  }

  init(data: { targetId: string }): void {
    this.targetId = data.targetId;
  }

  create(): void {
    this.ctx = getCtx(this);
    this.world = this.scene.get('World') as WorldScene;
    this.def = entityById(this.targetId);
    this.deciding = false;
    this.slotTexts = [];
    this.slotMarks = [];
    this.chips = [];
    this.tabTexts.clear();

    const baseKnown = this.world.namingBaseKnown(this.def);
    this.modes = baseKnown ? ['kaiji', 'tanji', 'ketsuji'] : ['tanji', 'ketsuji'];
    this.mode = baseKnown ? 'kaiji' : 'tanji';

    // 和紙パネル（下層クリック遮断）。ふわりと出る。
    const bg = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'paper')
      .setAlpha(0)
      .setInteractive();
    this.tweens.add({ targets: bg, alpha: 0.96, duration: 220 });

    // 円相 — 大きな一筆の円（うっすら）
    const enso = this.add.graphics().setAlpha(0);
    for (let i = 0; i < 3; i++) {
      enso.lineStyle(20 - i * 5, 0x2a2426, 0.035);
      enso.beginPath();
      enso.arc(GAME_WIDTH / 2, 215, 148 + i * 6, -Math.PI * 0.7, Math.PI * 0.78);
      enso.strokePath();
    }
    this.tweens.add({ targets: enso, alpha: 1, duration: 600, delay: 100 });

    // 墨のにじみ（四隅）
    for (const [bx, by] of [[60, 60], [900, 70], [70, 480], [890, 470]] as const) {
      const blot = this.add.image(bx, by, 'inkblob').setTint(0x2a2426).setAlpha(0.06).setScale(1.4);
      this.tweens.add({ targets: blot, alpha: 0.1, duration: 1400, yoyo: true, repeat: -1 });
    }

    // 見出し
    const title = this.add
      .text(GAME_WIDTH / 2, 46, `${this.def.label} に なまえを つける`, {
        fontFamily: FONT, fontSize: '21px', color: COLORS.inkStr, fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(2);
    const rule = this.add.graphics();
    rule.lineStyle(1.5, 0x8a8478, 0.7);
    rule.lineBetween(GAME_WIDTH / 2 - title.width / 2 - 30, 62, GAME_WIDTH / 2 + title.width / 2 + 30, 62);
    rule.fillStyle(0xb03030, 0.85);
    rule.fillCircle(GAME_WIDTH / 2 - title.width / 2 - 38, 62, 2.5);
    rule.fillCircle(GAME_WIDTH / 2 + title.width / 2 + 38, 62, 2.5);

    // タブ（座標互換: y92, 間隔110）
    this.tabLine = this.add.graphics();
    this.modes.forEach((m, i) => {
      const x = GAME_WIDTH / 2 + (i - (this.modes.length - 1) / 2) * 110;
      const t = this.add
        .text(x, 92, MODE_LABEL[m], { fontFamily: FONT, fontSize: '17px', color: '#8A8478' })
        .setOrigin(0.5)
        .setResolution(2)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        this.ctx.audio.se('paper');
        this.setMode(m);
      });
      this.tabTexts.set(m, t);
    });

    this.board = this.add.container(0, 0);
    this.msg = this.add
      .text(GAME_WIDTH / 2, 308, '', { fontFamily: FONT, fontSize: '16px', color: '#8A4A3A' })
      .setOrigin(0.5)
      .setResolution(2);

    this.buildPalette();

    // 決定 = 朱印（クリック領域は従来と同じ 150x44 @ (W-110, H-36)）
    this.decideC = this.add.container(GAME_WIDTH - 110, GAME_HEIGHT - 36);
    const sealShadow = this.add.graphics();
    sealShadow.fillStyle(0x2a2426, 0.3);
    sealShadow.fillRoundedRect(-73, -19, 150, 44, 10);
    const seal = this.add.graphics();
    seal.fillStyle(0xb03030, 1);
    seal.fillRoundedRect(-75, -22, 150, 44, 10);
    seal.lineStyle(2, 0xe0a060, 0.9);
    seal.strokeRoundedRect(-71, -18, 142, 36, 8);
    const decideText = this.add
      .text(0, 0, '名づける', { fontFamily: FONT, fontSize: '20px', color: '#F5F0E6', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(2);
    this.decideBg = this.add
      .rectangle(0, 0, 150, 44, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    this.decideBg.on('pointerdown', () => this.decide());
    this.decideBg.on('pointerover', () => this.decideC.setScale(1.04));
    this.decideBg.on('pointerout', () => this.decideC.setScale(1));
    this.decideC.add([sealShadow, seal, decideText, this.decideBg]);

    const closeBg = this.add
      .rectangle(96, GAME_HEIGHT - 36, 110, 40, COLORS.paper, 0.001)
      .setStrokeStyle(1.5, COLORS.inkSoft)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(96, GAME_HEIGHT - 36, 'とじる', { fontFamily: FONT, fontSize: '16px', color: COLORS.inkSoftStr })
      .setOrigin(0.5)
      .setResolution(2);
    closeBg.on('pointerdown', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    this.setMode(this.mode);
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.slots = m === 'ketsuji' ? [null, null] : [null];
    for (const [mode, t] of this.tabTexts) {
      t.setColor(mode === m ? COLORS.inkStr : '#A8A296');
      t.setFontStyle(mode === m ? 'bold' : 'normal');
    }
    // 選択タブの筆下線
    this.tabLine.clear();
    const active = this.tabTexts.get(m);
    if (active) {
      this.tabLine.lineStyle(3, 0xb03030, 0.85);
      this.tabLine.lineBetween(active.x - 26, 104, active.x + 22, 103);
      this.tabLine.lineStyle(1.2, 0xb03030, 0.5);
      this.tabLine.lineBetween(active.x - 22, 107, active.x + 26, 106);
    }
    this.buildBoard();
    this.refresh();
  }

  /** 原稿用紙ふうのマスを描く */
  private drawSquare(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    const h = size / 2;
    g.fillStyle(0x2a2426, 0.18);
    g.fillRect(x - h + 3, y - h + 4, size, size);
    g.fillStyle(0xfdfaf2, 1);
    g.fillRect(x - h, y - h, size, size);
    g.lineStyle(2.2, COLORS.inkSoft, 1);
    g.strokeRect(x - h, y - h, size, size);
    g.lineStyle(1, COLORS.inkSoft, 0.5);
    g.strokeRect(x - h + 4, y - h + 4, size - 8, size - 8);
    // 習字の十字ガイド
    g.lineStyle(1, 0x8a8478, 0.22);
    g.lineBetween(x - h + 6, y, x + h - 6, y);
    g.lineBetween(x, y - h + 6, x, y + h - 6);
  }

  private buildBoard(): void {
    this.board.removeAll(true);
    this.slotTexts = [];
    this.slotMarks = [];
    const cy = 205;
    const squares = this.add.graphics();
    this.board.add(squares);

    const makeSlot = (x: number, idx: number): void => {
      this.drawSquare(squares, x, cy, 96);
      const hit = this.add.rectangle(x, cy, 96, 96, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.slots[idx] !== null) {
          this.ctx.audio.se('paper');
          this.slots[idx] = null;
          this.refresh();
        }
      });
      const t = this.add
        .text(x, cy, '', { fontFamily: FONT, fontSize: '64px', color: COLORS.inkStr })
        .setOrigin(0.5)
        .setResolution(2);
      const mark = this.add.graphics(); // 選択中マスの彩り
      this.board.add([hit, mark, t]);
      this.slotRectsAdd(mark, x, cy);
      this.slotTexts[idx] = t;
    };
    const plus = (x: number): void => {
      this.board.add(
        this.add
          .text(x, cy, '＋', { fontFamily: FONT, fontSize: '34px', color: '#A8A296' })
          .setOrigin(0.5),
      );
    };

    if (this.mode === 'kaiji' && this.def.base) {
      // 対象の字が中央に大きく坐り、右に修飾スロット（§7-2）
      this.drawSquare(squares, GAME_WIDTH / 2 - 100, cy, 128);
      const baseT = this.add
        .text(GAME_WIDTH / 2 - 100, cy, this.def.base, {
          fontFamily: FONT, fontSize: '104px', color: '#5A544C',
        })
        .setOrigin(0.5)
        .setResolution(2);
      this.board.add(baseT);
      plus(GAME_WIDTH / 2 - 8);
      makeSlot(GAME_WIDTH / 2 + 90, 0);
    } else if (this.mode === 'ketsuji') {
      makeSlot(GAME_WIDTH / 2 - 80, 0);
      plus(GAME_WIDTH / 2);
      makeSlot(GAME_WIDTH / 2 + 80, 1);
    } else {
      makeSlot(GAME_WIDTH / 2, 0);
    }
    // 盤の出現
    this.board.setAlpha(0).setScale(0.96);
    this.tweens.add({ targets: this.board, alpha: 1, scale: 1, duration: 200, ease: 'Quad.easeOut' });
  }

  private slotRectsAdd(mark: Phaser.GameObjects.Graphics, x: number, y: number): void {
    this.slotMarks.push(mark);
    mark.setData('cx', x);
    mark.setData('cy', y);
  }

  private buildPalette(): void {
    const list = this.ctx.inv.list();
    const cols = 12;
    // 棚板（パレットの下敷き）
    const rows = Math.ceil(Math.max(1, list.length) / cols);
    const shelf = this.add.graphics();
    shelf.fillStyle(0x2a2426, 0.05);
    shelf.fillRoundedRect(GAME_WIDTH / 2 - 440, 332, 880, rows * 72 + 16, 10);
    shelf.lineStyle(1.2, 0x8a8478, 0.5);
    shelf.strokeRoundedRect(GAME_WIDTH / 2 - 440, 332, 880, rows * 72 + 16, 10);
    this.add
      .text(GAME_WIDTH / 2 - 426, 322, 'ことのは', { fontFamily: FONT, fontSize: '12px', color: '#8A8478' })
      .setResolution(2);

    list.forEach((glyph, i) => {
      const x = GAME_WIDTH / 2 + ((i % cols) - (Math.min(list.length, cols) - 1) / 2) * 70;
      const y = 372 + Math.floor(i / cols) * 72;
      const hl = this.add.rectangle(x, y, 62, 62, 0xffffff, 0).setStrokeStyle(2.5, COLORS.gold, 0);
      // 札（カード）— 持ち上がる部分をコンテナに
      const lift = this.add.container(x, y);
      const card = this.add.graphics();
      card.fillStyle(0x2a2426, 0.2);
      card.fillRoundedRect(-26, -24, 56, 56, 6);
      card.fillStyle(0xfdfaf2, 1);
      card.fillRoundedRect(-28, -28, 56, 56, 6);
      card.lineStyle(1.5, 0x8a8478, 1);
      card.strokeRoundedRect(-28, -28, 56, 56, 6);
      card.lineStyle(1, 0xb03030, 0.25);
      card.strokeRoundedRect(-24, -24, 48, 48, 4);
      const t = this.add
        .text(0, 0, glyph, { fontFamily: FONT, fontSize: '34px', color: COLORS.inkStr })
        .setOrigin(0.5)
        .setResolution(2);
      lift.add([card, t]);
      const hit = this.add.rectangle(x, y, 56, 56, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.pickChip(glyph));
      hit.on('pointerover', () => this.tweens.add({ targets: lift, y: y - 4, duration: 90 }));
      hit.on('pointerout', () => this.tweens.add({ targets: lift, y, duration: 120 }));
      this.chips.push({ glyph, hl, lift });
    });
  }

  private pickChip(glyph: string): void {
    const idx = this.slots.indexOf(null);
    if (idx === -1) return;
    this.slots[idx] = glyph;
    this.ctx.audio.charTone(glyph, 0, 0.4);
    const chip = this.chips.find((c) => c.glyph === glyph);
    if (chip) {
      this.tweens.add({ targets: chip.lift, scale: { from: 0.88, to: 1 }, duration: 140, ease: 'Back.easeOut' });
    }
    this.refresh();
  }

  private refresh(): void {
    this.slots.forEach((s, i) => {
      const t = this.slotTexts[i];
      if (!t) return;
      if (t.text !== (s ?? '')) {
        t.setText(s ?? '');
        if (s) {
          t.setScale(1.3).setAlpha(0.4);
          this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
        }
      }
      const mark = this.slotMarks[i];
      if (mark) {
        mark.clear();
        if (s) {
          const cx = mark.getData('cx') as number;
          const cyy = mark.getData('cy') as number;
          mark.lineStyle(2.5, 0xb03030, 0.55);
          mark.strokeRect(cx - 48, cyy - 48, 96, 96);
        }
      }
    });
    const filled = this.slots.filter((s): s is string => s !== null);
    const ready = filled.length === this.slots.length;
    this.decideC.setAlpha(ready ? 1 : 0.4);

    // 成立しうる組合せの字を淡く示す（§11-2 おすすめ常時ON）
    const base = this.mode === 'kaiji' ? this.def.base : undefined;
    for (const chip of this.chips) {
      const wouldFit =
        !ready && this.ctx.engine.canComplete(filled, chip.glyph, base, this.def.tags);
      chip.hl.setStrokeStyle(2.5, COLORS.gold, wouldFit ? 0.85 : 0);
    }
    this.msg.setText('');
  }

  private decide(): void {
    if (this.deciding) return;
    const inputs = this.slots.filter((s): s is string => s !== null);
    if (inputs.length < this.slots.length || inputs.length === 0) return;
    const base = this.mode === 'kaiji' ? this.def.base : undefined;
    const res = this.ctx.engine.resolve(inputs, base, this.def.tags);
    if (!res) {
      // ソフト失敗: 字盤が小さく軋み、墨がにじむ（§11-2）
      this.ctx.audio.se('fail');
      this.msg.setText('……なにも おこらない。');
      const splat = this.add
        .image(GAME_WIDTH / 2, 205, 'inkblob')
        .setTint(0x2a2426)
        .setAlpha(0)
        .setScale(0.6)
        .setDepth(5);
      this.tweens.add({
        targets: splat,
        alpha: { from: 0.25, to: 0 },
        scale: 1.4,
        duration: 500,
        onComplete: () => splat.destroy(),
      });
      this.tweens.add({
        targets: this.board,
        x: { from: -5, to: 5 },
        duration: 50,
        yoyo: true,
        repeat: 3,
        onComplete: () => this.board.setX(0),
      });
      return;
    }
    this.deciding = true;
    const isNew = !this.ctx.inv.has(res.glyph);
    this.ctx.inv.add(res.glyph);
    this.ctx.audio.se('stamp');
    // 朱印を押す
    this.tweens.add({ targets: this.decideC, scale: 0.9, duration: 80, yoyo: true });
    const used = this.mode === 'kaiji' && this.def.base ? [this.def.base, ...inputs] : inputs;
    // 成立: 白がはしって閉じ、結晶化はワールド側で続く（§11-2 / J2）
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.85 },
      duration: 160,
      yoyo: true,
      onComplete: () => {
        this.close(() => this.world.applyNaming(this.targetId, res, used, isNew));
      },
    });
  }

  private close(after?: () => void): void {
    this.scene.stop();
    this.scene.resume('World');
    this.world.onOverlayClosed();
    after?.();
  }
}
