// メッセージウィンドウ (§4.3)。
// ・タイプライタ 1文字30ms / Z で全表示 → 次へ
// ・未習得トークンは █ ノイズとして描かれ、0.5秒ごとに1文字ゆれる
// ・lie:true のセリフは「うそ」習得後 ±1px で常時ふるえる (lie_shake §4.5)
// 顔アイコンを置くため1行は最大17字（§4.3 の20字から本作裁量で調整）。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { NPCS } from "../data/npcs";
import { resolveText, hasMask, wrapJa } from "../systems/textMask";
import { G } from "../systems/wordSystem";
import { Telemetry } from "../systems/telemetry";
import { Sound } from "../systems/audio";

const SPEAKER_LABEL: Record<string, string> = {
  narration: "",
  kamisama: "カミサマ",
  player: "きみ",
};

export interface ShowOpts {
  speaker: string;
  text: string;
  lie?: boolean;
}

export class MessageWindow {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private face: Phaser.GameObjects.Image;
  private nameBg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;

  private raw = "";
  private lie = false;
  private shimmer = 0;
  private revealed = 0;
  private fullLen = 0;
  private typing = false;
  private openedAt = 0;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(1550).setScrollFactor(0).setVisible(false);

    this.bg = scene.add.graphics();
    this.bg.fillStyle(PAL.shiro, 0.96).fillRect(3, 116, 314, 61);
    this.bg.lineStyle(2, PAL.kuro, 1).strokeRect(3, 116, 314, 61);
    this.root.add(this.bg);

    this.nameBg = scene.add.graphics();
    this.nameText = scene.add
      .text(10, 99, "", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.shiro })
      .setResolution(1);
    this.root.add(this.nameBg);
    this.root.add(this.nameText);

    this.face = scene.add.image(22, 142, "face_player").setVisible(false);
    this.root.add(this.face);

    this.body = scene.add
      .text(40, 122, "", {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.kuro,
        lineSpacing: 1,
      })
      .setResolution(1);
    this.root.add(this.body);

    this.arrow = scene.add
      .text(302, 160, "▼", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.komomo })
      .setResolution(1)
      .setVisible(false);
    this.root.add(this.arrow);

    // ゆれ・ちらつき・点滅は1本のタイマーでまとめて駆動（負荷を抑える）
    const t = scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.tick(),
    });
    this.timers.push(t);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get isOpen() {
    return this.root.visible;
  }

  private tickCount = 0;
  private tick() {
    if (!this.root.visible) return;
    this.tickCount++;
    // 0.5秒ごとにマスクが1文字ゆれる (§4.2)
    if (this.tickCount % 5 === 0) {
      this.shimmer++;
      this.redraw();
    }
    // lie_shake: ±1px の小刻みなふるえ
    if (this.lie && G.hasWord("uso")) {
      this.body.setX(40 + (this.tickCount % 2 === 0 ? 1 : -1));
    } else {
      this.body.setX(this.face.visible ? 40 : 12);
    }
    // 送りマークの点滅
    if (this.arrow.visible) this.arrow.setAlpha(this.tickCount % 6 < 3 ? 1 : 0.2);
  }

  private resolved(): string {
    return resolveText(this.raw, this.shimmer);
  }

  private redraw() {
    const text = this.resolved();
    const wrapped = wrapJa(text, this.face.visible ? 17 : 18, 3).join("\n");
    // タイプライタ中は revealed 文字まで（改行は文字数に数えない）
    let count = 0;
    let out = "";
    for (const ch of wrapped) {
      if (ch !== "\n") count++;
      if (count > this.revealed && ch !== "\n") break;
      out += ch;
    }
    this.body.setText(out);
  }

  /** セリフを表示して、読み終わり（Z）まで待つ */
  show(opts: ShowOpts): Promise<void> {
    return new Promise((resolve) => {
      const label = NPCS[opts.speaker]?.label ?? SPEAKER_LABEL[opts.speaker] ?? opts.speaker;
      const faceKey = `face_${opts.speaker}`;
      const hasFace = opts.speaker !== "narration" && this.scene.textures.exists(faceKey);

      this.root.setVisible(true);
      this.raw = opts.text;
      this.lie = !!opts.lie;
      this.revealed = 0;
      this.typing = true;
      // 開いた瞬間の同じキー押下で進んでしまうのを防ぐ（イベント二重発火対策）
      this.openedAt = performance.now();
      this.arrow.setVisible(false);

      this.face.setVisible(hasFace);
      if (hasFace) this.face.setTexture(faceKey);
      this.body.setX(hasFace ? 40 : 12);

      this.nameBg.clear();
      this.nameText.setText(label);
      this.nameBg.setVisible(!!label);
      this.nameText.setVisible(!!label);
      if (label) {
        const w = label.length * 16 + 12;
        this.nameBg.fillStyle(PAL.kuro, 1).fillRect(3, 98, w, 18);
      }

      this.fullLen = [...this.resolved()].length;

      const typeTimer = this.scene.time.addEvent({
        delay: 30, // 1文字30ms (§4.3)
        loop: true,
        callback: () => {
          this.revealed++;
          if (this.revealed % 2 === 0) Sound.seTick();
          this.redraw();
          if (this.revealed >= this.fullLen) {
            typeTimer.remove();
            this.typing = false;
            this.arrow.setVisible(true);
          }
        },
      });
      this.timers.push(typeTimer);

      const onAdvance = () => {
        if (!this.root.visible) return;
        if (performance.now() - this.openedAt < 80) return;
        if (this.typing) {
          // 1回目の Z: 全文表示
          this.revealed = this.fullLen;
          typeTimer.remove();
          this.typing = false;
          this.redraw();
          this.arrow.setVisible(true);
        } else {
          // 2回目の Z: 次へ
          cleanup();
          Telemetry.advance();
          Sound.seDecide();
          resolve();
        }
      };
      const keyHandler = (e: KeyboardEvent) => {
        if (["KeyZ", "Enter", "Space"].includes(e.code)) onAdvance();
      };
      const ptrHandler = () => onAdvance();
      const cleanup = () => {
        this.scene.input.keyboard?.off("keydown", keyDispatch);
        this.scene.input.off("pointerdown", ptrHandler);
      };
      const keyDispatch = (e: KeyboardEvent) => keyHandler(e);
      this.scene.input.keyboard?.on("keydown", keyDispatch);
      this.scene.input.on("pointerdown", ptrHandler);
    });
  }

  hide() {
    this.root.setVisible(false);
  }

  /** マスク文字を含むか（演出側の参考用） */
  containsMask(): boolean {
    return hasMask(this.resolved());
  }

  private destroy() {
    for (const t of this.timers) t.remove();
  }
}
