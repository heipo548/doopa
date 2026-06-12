// DialogueScene — 会話UI（常駐オーバーレイ §7-6）
// タイプライター 30字/秒。E/クリックで全文表示→次へ。話者名と話者色で枠を着色。

import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SPEAKERS, type DialogueLine } from '../config';

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

  private box!: Phaser.GameObjects.Rectangle;
  private edge!: Phaser.GameObjects.Rectangle;
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
    this.box = this.add
      .rectangle(GAME_WIDTH / 2, y, 920, 116, COLORS.paper, 0.95)
      .setStrokeStyle(2.5, COLORS.inkSoft)
      .setDepth(10);
    this.edge = this.add.rectangle(GAME_WIDTH / 2 - 456, y, 8, 116, COLORS.inkSoft, 1).setDepth(11);
    this.nameText = this.add
      .text(GAME_WIDTH / 2 - 440, y - 48, '', { fontFamily: FONT, fontSize: '15px', color: '#8C6E4A' })
      .setDepth(11)
      .setResolution(2);
    this.bodyText = this.add
      .text(GAME_WIDTH / 2 - 440, y - 26, '', {
        fontFamily: FONT,
        fontSize: '19px',
        color: COLORS.inkStr,
        wordWrap: { width: 880 },
        lineSpacing: 6,
      })
      .setDepth(11)
      .setResolution(2);
    this.cursor = this.add
      .text(GAME_WIDTH / 2 + 430, y + 38, '▼', { fontFamily: FONT, fontSize: '14px', color: COLORS.inkSoftStr })
      .setOrigin(1)
      .setDepth(11);
    this.tweens.add({ targets: this.cursor, alpha: { from: 1, to: 0.2 }, duration: 500, yoyo: true, repeat: -1 });
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
      while (this.charAcc >= 1 && this.shown < full.length) {
        this.shown++;
        this.charAcc -= 1;
      }
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
    this.showLine();
  }

  private showLine(): void {
    if (!this.cur) return;
    const line = this.cur.lines[this.lineIdx];
    const sp = SPEAKERS[line.speaker] ?? SPEAKERS.system;
    this.nameText.setText(sp.label).setColor(sp.color);
    this.edge.setFillStyle(Phaser.Display.Color.HexStringToColor(sp.color).color, 1);
    this.shown = 0;
    this.charAcc = 0;
    this.bodyText.setText('');
    this.cursor.setVisible(false);
  }

  private setUiVisible(v: boolean): void {
    this.box.setVisible(v);
    this.edge.setVisible(v);
    this.nameText.setVisible(v);
    this.bodyText.setVisible(v);
    this.cursor.setVisible(v && this.shown >= this.currentText().length);
  }
}
