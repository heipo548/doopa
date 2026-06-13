// DialogueScene — 会話UI（常駐オーバーレイ §7-6）
// タイプライター 30字/秒。E/クリックで全文表示→次へ。
// 見た目: 和紙の札＋手描き風の二重枠＋話者の朱印札＋タイプ音。

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SPEAKERS, type DialogueLine } from '../config';
import { getCtx } from '../systems/context';

interface Batch {
  lines: DialogueLine[];
  onDone?: () => void;
}

const CHARS_PER_SEC = 30;

export class DialogueScene extends Phaser.Scene {
  private queue: Batch[] = [];
  private cur: Batch | null = null;
  private lineIdx = 0;
  private shown = 0;
  private charAcc = 0;
  private closedAt = -10000;

  private ui!: Phaser.GameObjects.Container;
  private seal!: Phaser.GameObjects.Container;
  private sealBg!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private cursor!: Phaser.GameObjects.Text;

  constructor() {
    super('Dialogue');
  }

  create(): void {
    // シーンインスタンスは使い回されるため、再起動時に状態を必ず初期化（§16）
    this.queue = [];
    this.cur = null;
    this.lineIdx = 0;
    this.shown = 0;
    this.charAcc = 0;
    this.closedAt = -10000;

    const y = GAME_HEIGHT - 72;
    this.ui = this.add.container(0, 0).setDepth(10);

    // 影 → 和紙 → 手描き風の二重枠
    const shadow = this.add.rectangle(GAME_WIDTH / 2 + 4, y + 5, 920, 116, 0x2a2426, 0.25);
    const paper = this.add.tileSprite(GAME_WIDTH / 2, y, 920, 116, 'paper').setAlpha(0.98);
    const frame = this.add.graphics();
    frame.lineStyle(2.5, COLORS.inkSoft, 1);
    frame.strokeRect(GAME_WIDTH / 2 - 460, y - 58, 920, 116);
    frame.lineStyle(1.1, COLORS.inkSoft, 0.55);
    frame.strokeRect(GAME_WIDTH / 2 - 455, y - 53, 910, 106);
    // 四隅の墨だまり
    const blots = this.add.graphics();
    blots.fillStyle(COLORS.ink, 0.5);
    for (const [bx, by] of [
      [GAME_WIDTH / 2 - 460, y - 58],
      [GAME_WIDTH / 2 + 460, y - 58],
      [GAME_WIDTH / 2 - 460, y + 58],
      [GAME_WIDTH / 2 + 460, y + 58],
    ] as const) {
      blots.fillCircle(bx, by, 3);
    }
    this.ui.add([shadow, paper, frame, blots]);

    // 話者の朱印札（縦長の seal）
    this.seal = this.add.container(GAME_WIDTH / 2 - 432, y - 58);
    this.sealBg = this.add.graphics();
    this.nameText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#F5F0E6', align: 'center' })
      .setOrigin(0.5)
      .setResolution(2);
    this.seal.add([this.sealBg, this.nameText]);
    this.ui.add(this.seal);

    this.bodyText = this.add
      .text(GAME_WIDTH / 2 - 430, y - 30, '', {
        fontFamily: FONT,
        fontSize: '19px',
        color: COLORS.inkStr,
        wordWrap: { width: 870 },
        lineSpacing: 7,
      })
      .setDepth(11)
      .setResolution(2);
    this.cursor = this.add
      .text(GAME_WIDTH / 2 + 430, y + 38, '▼', { fontFamily: FONT, fontSize: '14px', color: '#8A6A4A' })
      .setOrigin(1)
      .setDepth(11);
    this.tweens.add({ targets: this.cursor, alpha: { from: 1, to: 0.2 }, y: this.cursor.y + 3, duration: 520, yoyo: true, repeat: -1 });
    this.ui.add([this.bodyText, this.cursor]);
    this.setUiVisible(false);

    this.input.keyboard?.on('keydown-E', () => this.advance());
    this.input.keyboard?.on('keydown-Z', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.on('pointerdown', () => this.advance());
  }

  get busy(): boolean {
    return this.cur !== null || this.queue.length > 0;
  }

  /** 閉じた直後の E が World の調べると二重発火しないように（§16 入力状態機械） */
  justClosed(now: number): boolean {
    return now - this.closedAt < 300;
  }

  say(lines: DialogueLine[], onDone?: () => void): void {
    this.queue.push({ lines, onDone });
    if (!this.cur) this.next();
  }

  update(_time: number, delta: number): void {
    if (!this.cur) return;
    const full = this.currentText();
    if (this.shown < full.length) {
      this.charAcc += (delta / 1000) * CHARS_PER_SEC;
      let typed = false;
      while (this.charAcc >= 1 && this.shown < full.length) {
        this.shown++;
        this.charAcc -= 1;
        typed = true;
      }
      if (typed && this.shown % 3 === 0) getCtx(this).audio.se('tick');
      this.bodyText.setText(full.slice(0, this.shown));
      this.cursor.setVisible(this.shown >= full.length);
    }
  }

  private currentText(): string {
    if (!this.cur) return '';
    return this.cur.lines[this.lineIdx]?.text ?? '';
  }

  private advance(): void {
    if (!this.cur) return;
    const full = this.currentText();
    if (this.shown < full.length) {
      this.shown = full.length;
      this.bodyText.setText(full);
      this.cursor.setVisible(true);
      return;
    }
    getCtx(this).audio.se('paper');
    this.lineIdx++;
    if (this.lineIdx < this.cur.lines.length) {
      this.showLine();
    } else {
      const done = this.cur.onDone;
      this.cur = null;
      if (this.queue.length > 0) {
        this.next();
      } else {
        this.setUiVisible(false);
        this.closedAt = this.time.now;
      }
      done?.();
    }
  }

  private next(): void {
    const batch = this.queue.shift();
    if (!batch) return;
    this.cur = batch;
    this.lineIdx = 0;
    this.setUiVisible(true);
    // 出現のひと呼吸
    this.ui.setAlpha(0).setY(6);
    this.tweens.add({ targets: this.ui, alpha: 1, y: 0, duration: 160, ease: 'Quad.easeOut' });
    this.showLine();
  }

  private showLine(): void {
    if (!this.cur) return;
    const line = this.cur.lines[this.lineIdx];
    const sp = SPEAKERS[line.speaker] ?? SPEAKERS.system;
    const hasName = sp.label.length > 0;
    this.seal.setVisible(hasName);
    if (hasName) {
      this.nameText.setText(sp.label);
      const w = Math.max(64, this.nameText.width + 22);
      const col = Phaser.Display.Color.HexStringToColor(sp.color).color;
      this.sealBg.clear();
      this.sealBg.fillStyle(0x2a2426, 0.3);
      this.sealBg.fillRoundedRect(-w / 2 + 2, -14, w, 30, 5);
      this.sealBg.fillStyle(col, 1);
      this.sealBg.fillRoundedRect(-w / 2, -16, w, 30, 5);
      this.sealBg.lineStyle(1.5, 0xf5f0e6, 0.55);
      this.sealBg.strokeRoundedRect(-w / 2 + 3, -13, w - 6, 24, 4);
    }
    this.shown = 0;
    this.charAcc = 0;
    this.bodyText.setText('');
    this.cursor.setVisible(false);
  }

  private setUiVisible(v: boolean): void {
    this.ui.setVisible(v);
    if (!v) return;
    this.cursor.setVisible(this.shown >= this.currentText().length);
  }
}
