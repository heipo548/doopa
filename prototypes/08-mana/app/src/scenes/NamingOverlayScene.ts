// NamingOverlayScene — 名付けUI（SPEC.md §7-2 / §11-2）
// 単字 / 結字（スロット1⇔2タブ）/ 改字（base字＋修飾スロット）
// 言ノ葉は消費しない。成立しうる字は淡く明滅（おすすめモード常時ON）。

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
  private slotRects: Phaser.GameObjects.Rectangle[] = [];
  private tabTexts = new Map<Mode, Phaser.GameObjects.Text>();
  private chips: { glyph: string; hl: Phaser.GameObjects.Rectangle }[] = [];
  private msg!: Phaser.GameObjects.Text;
  private decideBg!: Phaser.GameObjects.Rectangle;
  private decideText!: Phaser.GameObjects.Text;
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
    this.slotRects = [];
    this.chips = [];
    this.tabTexts.clear();

    const baseKnown = this.world.namingBaseKnown(this.def);
    this.modes = baseKnown ? ['kaiji', 'tanji', 'ketsuji'] : ['tanji', 'ketsuji'];
    this.mode = baseKnown ? 'kaiji' : 'tanji';

    // 和紙の半透明パネル（§11-2）。下から出現。
    const bg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.paper, 0.92)
      .setInteractive(); // 下層クリック遮断
    bg.setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 1, duration: 220 });
    // 墨のにじみ（四隅）
    for (const [bx, by] of [[60, 60], [900, 70], [70, 480], [890, 470]] as const) {
      const blot = this.add.image(bx, by, 'glow').setTint(0x2a2426).setAlpha(0.07).setScale(1.6);
      this.tweens.add({ targets: blot, alpha: 0.11, duration: 1400, yoyo: true, repeat: -1 });
    }

    this.add
      .text(GAME_WIDTH / 2, 46, `${this.def.label} に なまえを つける`, {
        fontFamily: FONT, fontSize: '21px', color: COLORS.inkStr,
      })
      .setOrigin(0.5)
      .setResolution(2);

    // タブ
    this.modes.forEach((m, i) => {
      const x = GAME_WIDTH / 2 + (i - (this.modes.length - 1) / 2) * 110;
      const t = this.add
        .text(x, 92, MODE_LABEL[m], { fontFamily: FONT, fontSize: '17px', color: '#8A8478' })
        .setOrigin(0.5)
        .setResolution(2)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => this.setMode(m));
      this.tabTexts.set(m, t);
    });

    this.board = this.add.container(0, 0);
    this.msg = this.add
      .text(GAME_WIDTH / 2, 308, '', { fontFamily: FONT, fontSize: '16px', color: '#8A6A4A' })
      .setOrigin(0.5)
      .setResolution(2);

    this.buildPalette();

    // 決定 / とじる
    this.decideBg = this.add
      .rectangle(GAME_WIDTH - 110, GAME_HEIGHT - 36, 150, 44, COLORS.ink, 1)
      .setInteractive({ useHandCursor: true });
    this.decideText = this.add
      .text(GAME_WIDTH - 110, GAME_HEIGHT - 36, '名づける', { fontFamily: FONT, fontSize: '19px', color: COLORS.paperStr })
      .setOrigin(0.5)
      .setResolution(2);
    this.decideBg.on('pointerdown', () => this.decide());

    const closeBg = this.add
      .rectangle(96, GAME_HEIGHT - 36, 110, 40, COLORS.paper, 0)
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
    this.buildBoard();
    this.refresh();
  }

  private buildBoard(): void {
    this.board.removeAll(true);
    this.slotTexts = [];
    this.slotRects = [];
    const cy = 205;
    const makeSlot = (x: number, idx: number): void => {
      const r = this.add
        .rectangle(x, cy, 96, 96, 0xfdfaf2, 1)
        .setStrokeStyle(2.5, COLORS.inkSoft)
        .setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => {
        if (this.slots[idx] !== null) {
          this.slots[idx] = null;
          this.refresh();
        }
      });
      const t = this.add
        .text(x, cy, '', { fontFamily: FONT, fontSize: '64px', color: COLORS.inkStr })
        .setOrigin(0.5)
        .setResolution(2);
      this.board.add([r, t]);
      this.slotRects[idx] = r;
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
      const baseT = this.add
        .text(GAME_WIDTH / 2 - 100, cy, this.def.base, {
          fontFamily: FONT, fontSize: '120px', color: '#5A544C',
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
  }

  private buildPalette(): void {
    const list = this.ctx.inv.list();
    const cols = 12;
    list.forEach((glyph, i) => {
      const x = GAME_WIDTH / 2 + ((i % cols) - (Math.min(list.length, cols) - 1) / 2) * 70;
      const y = 372 + Math.floor(i / cols) * 72;
      const hl = this.add.rectangle(x, y, 60, 60, 0xffffff, 0).setStrokeStyle(2.5, COLORS.gold, 0);
      const bg = this.add
        .rectangle(x, y, 56, 56, 0xfdfaf2, 1)
        .setStrokeStyle(1.5, 0x8a8478)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x, y, glyph, { fontFamily: FONT, fontSize: '34px', color: COLORS.inkStr })
        .setOrigin(0.5)
        .setResolution(2);
      bg.on('pointerdown', () => this.pickChip(glyph));
      bg.on('pointerover', () => bg.setFillStyle(0xf2ecd8, 1));
      bg.on('pointerout', () => bg.setFillStyle(0xfdfaf2, 1));
      this.chips.push({ glyph, hl });
      // おすすめ明滅用トゥイーン（refresh で strokeAlpha を操作）
      this.tweens.add({ targets: t, alpha: 1, duration: 1 });
    });
  }

  private pickChip(glyph: string): void {
    const idx = this.slots.indexOf(null);
    if (idx === -1) return;
    this.slots[idx] = glyph;
    this.ctx.audio.charTone(glyph, 0, 0.4);
    this.refresh();
  }

  private refresh(): void {
    this.slots.forEach((s, i) => {
      this.slotTexts[i]?.setText(s ?? '');
      this.slotRects[i]?.setStrokeStyle(2.5, s ? COLORS.ink : COLORS.inkSoft);
    });
    const filled = this.slots.filter((s): s is string => s !== null);
    const ready = filled.length === this.slots.length;
    this.decideBg.setAlpha(ready ? 1 : 0.35);
    this.decideText.setAlpha(ready ? 1 : 0.5);

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
      // ソフト失敗: 字盤が小さく軋む（§11-2）
      this.ctx.audio.se('fail');
      this.msg.setText('……なにも おこらない。');
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
    this.ctx.audio.se('confirm');
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
