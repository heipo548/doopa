// ワールドシーン: マップ・移動・しらべ・会話・イベント E0〜E7 の進行を司る。
// 進行状態はすべて G（フラグ・習得語・フェーズ）にあり、
// このシーンは「G を読んで世界を組み立て直す」だけにしてある
// （セーブ＝G の保存、ロード＝G の復元、で全部つじつまが合う設計）。
import Phaser from "phaser";
import { PAL, HEX } from "../gfx/palette";
import { CHAR_TO_TILE, COLLIDING_TILES } from "../gfx/tileLegend";
import { MAPS } from "../systems/validate";
import { NPCS } from "../data/npcs";
import { WORD_COUNT } from "../data/words";
import { ALL_NODES } from "../data/dialogues";
import { STR } from "../data/strings";
import { G } from "../systems/wordSystem";
import { Save } from "../systems/save";
import { Telemetry } from "../systems/telemetry";
import { Sound } from "../systems/audio";
import { Debug } from "../systems/debug";
import { applyDebugPreset } from "../systems/debugPresets";
import { DialogueBook } from "../systems/dialogue";
import { recordGreet, greetCount } from "../systems/quest";
import { MessageWindow } from "../ui/messageWindow";
import { PaletteUI } from "../ui/paletteUI";
import { ChoiceUI } from "../ui/choiceUI";
import { Notebook } from "../ui/notebook";
import { Cutin } from "../ui/cutin";
import { DialogueDirector, type ActionResult } from "../ui/dialogueDirector";
import type { Action, DayPhase, MapDef, NpcDef } from "../types";

const SPEED = 70;

interface WorldData {
  runNode?: string;
  startSleep?: boolean;
}

export class WorldScene extends Phaser.Scene {
  private mapDef!: MapDef;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.Physics.Arcade.Sprite;
  private npcSprites: { def: NpcDef; sprite: Phaser.Physics.Arcade.Sprite }[] = [];
  private propBodies!: Phaser.Physics.Arcade.StaticGroup;
  private npcGroup!: Phaser.Physics.Arcade.StaticGroup;
  private tear: Phaser.GameObjects.Image | null = null;
  private stars: Phaser.GameObjects.Image[] = [];

  private win!: MessageWindow;
  private palette!: PaletteUI;
  private choice!: ChoiceUI;
  private notebook!: Notebook;
  private cutin!: Cutin;
  private director!: DialogueDirector;

  private blackout!: Phaser.GameObjects.Rectangle;
  private phaseOverlay!: Phaser.GameObjects.Rectangle;
  private satOverlay!: Phaser.GameObjects.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private tutorialArrow: Phaser.GameObjects.Text | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;

  private moveKeys!: Record<string, Phaser.Input.Keyboard.Key>;
  private needRespawn = false;
  private facing = new Phaser.Math.Vector2(0, 1);
  private lastTile = { x: -1, y: -1 };
  private walkClock = 0;
  private walkFrame = 0;
  private sleeping = false;
  private transferring = false;
  private pendingTransfer: "map" | "sleep" | "ending" | null = null;
  private songTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super("World");
  }

  // ---------------- 生成 ----------------
  create(data: WorldData) {
    this.sleeping = false;
    this.transferring = false;
    this.pendingTransfer = null;
    this.npcSprites = [];
    this.tear = null;
    this.stars = [];
    this.tutorialArrow = null;
    this.toastText = null;

    this.mapDef = MAPS[G.map];
    const rows = this.mapDef.grid;
    const tileData = rows.map((r) => [...r].map((ch) => CHAR_TO_TILE[ch] ?? 0));
    const map = this.make.tilemap({ data: tileData, tileWidth: 16, tileHeight: 16 });
    const tiles = map.addTilesetImage("tiles", "tiles", 16, 16, 0, 0)!;
    this.layer = map.createLayer(0, tiles, 0, 0)!;
    this.layer.setCollision(COLLIDING_TILES);

    // 大きな飾り（森はずれの木など）
    this.propBodies = this.physics.add.staticGroup();
    for (const p of this.mapDef.props ?? []) {
      const tex = this.textures.get(p.texture).getSourceImage() as HTMLImageElement;
      const cx = p.x * 16 + p.w * 8;
      const bottom = (p.y + p.h) * 16;
      this.add.image(cx, bottom - tex.height / 2, p.texture).setDepth(bottom);
      const body = this.add.rectangle(cx, p.y * 16 + p.h * 8, p.w * 16, p.h * 16);
      this.propBodies.add(body);
      body.setVisible(false);
    }

    // プレイヤー
    this.player = this.physics.add.sprite(G.x * 16 + 8, G.y * 16 + 8, "player_0");
    this.player.setSize(10, 8).setOffset(3, 7);
    this.player.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.propBodies);

    this.npcGroup = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.npcGroup);
    this.respawnNpcs();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player, true);
    cam.fadeIn(400, 21, 18, 31);

    // 夜空の星（よるフェーズだけ見える）
    for (let i = 0; i < 16; i++) {
      const star = this.add
        .image(20 + ((i * 41) % (map.widthInPixels - 40)), 6 + ((i * 17) % 40), "p_star")
        .setDepth(5)
        .setVisible(false);
      this.stars.push(star);
    }

    // オーバーレイ（下から: 彩度 → 時間帯 → 暗転）
    this.satOverlay = this.add
      .rectangle(160, 90, 320, 180, PAL.kuro, 0)
      .setScrollFactor(0)
      .setDepth(899);
    this.phaseOverlay = this.add
      .rectangle(160, 90, 320, 180, PAL.fuji, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.blackout = this.add
      .rectangle(160, 90, 320, 180, PAL.yoru, 0)
      .setScrollFactor(0)
      .setDepth(1500);

    this.prompt = this.add
      .text(0, 0, "▼", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.ki })
      .setResolution(1)
      .setOrigin(0.5)
      .setDepth(800)
      .setVisible(false);

    // UI 部品と会話ディレクター
    this.win = new MessageWindow(this);
    this.palette = new PaletteUI(this);
    this.choice = new ChoiceUI(this);
    this.notebook = new Notebook(this);
    this.cutin = new Cutin(this);
    this.director = new DialogueDirector(new DialogueBook(ALL_NODES), {
      window: this.win,
      palette: this.palette,
      choice: this.choice,
      cutin: this.cutin,
      onAction: (a) => this.onAction(a),
      onEnd: () => this.onDialogueEnd(),
    });

    // 入力（移動キーは1回だけ生成して使い回す）
    this.moveKeys = this.input.keyboard!.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard?.on("keydown-Z", () => this.onConfirmKey());
    this.input.keyboard?.on("keydown-ENTER", () => this.onConfirmKey());
    this.input.keyboard?.on("keydown-SPACE", () => this.onConfirmKey());
    this.input.keyboard?.on("keydown-C", () => {
      if (!this.uiBusy()) void this.notebook.open();
    });

    // フェーズ・習得・フラグの変化に世界を追従させる
    const onPhase = () => this.applyPhase();
    const onLearn = () => this.updateSaturation();
    const onFlag = () => this.requestRespawn();
    G.events.on("phase", onPhase);
    G.events.on("learn", onLearn);
    G.events.on("flag", onFlag);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      G.events.off("phase", onPhase);
      G.events.off("learn", onLearn);
      G.events.off("flag", onFlag);
      this.songTimer?.remove();
    });

    this.applyPhase();
    this.updateSaturation();

    // デバッグフック (?debug=1 のときだけ意味を持つ)。
    // game 経由で登録する理由: バトル中など WorldScene が止まっていても
    // ジャンプできるように、シーンの生死に依存させないため。
    const gameRef = this.game;
    Debug.hooks.jumpTo = (ev) => {
      const data = applyDebugPreset(ev);
      const mgr = gameRef.scene;
      for (const key of ["Battle", "Ending", "Title"]) {
        if (mgr.isActive(key)) mgr.stop(key);
      }
      if (mgr.isActive("World")) {
        (mgr.getScene("World") as Phaser.Scene).scene.restart(data);
      } else {
        mgr.start("World", data);
      }
    };
    Debug.hooks.learnOne = (id) => {
      if (G.learnWord(id, "でばっぐ")) void this.cutin.play(id);
    };

    // 開始時の自動イベント
    if (G.map === "hill" && !G.hasFlag("e0_op_done")) {
      this.blackout.setFillStyle(PAL.yoru, 1);
      this.time.delayedCall(350, () => void this.director.run("e0_op1"));
    }
    if (data.runNode) {
      this.time.delayedCall(450, () => void this.director.run(data.runNode!));
    }
    if (data.startSleep) {
      this.time.delayedCall(300, () => void this.runSleep());
    }
  }

  // ---------------- NPC ----------------
  private respawnNpcs() {
    for (const n of this.npcSprites) n.sprite.destroy();
    this.npcSprites = [];
    this.tear?.destroy();
    this.tear = null;
    this.npcGroup.clear(true, true);

    for (const def of Object.values(NPCS)) {
      const spawn = def.spawns.find((s) => s.map === G.map && G.checkConds(s.if));
      if (!spawn) continue;
      const sprite = this.npcGroup.create(
        spawn.x * 16 + 8,
        spawn.y * 16 + 8,
        `npc_${def.id}_0`
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(sprite.y);
      (sprite.body as Phaser.Physics.Arcade.StaticBody).setSize(12, 10).setOffset(2, 5);
      this.npcSprites.push({ def, sprite });

      // reveal_sad (§4.5): 「かなしい」を知ってはじめて、なみだが見える
      if (def.id === "kitsune") {
        this.tear = this.add.image(sprite.x - 3, sprite.y + 1, "tear").setDepth(sprite.y + 1);
      }
    }
  }

  // ---------------- 進行アクション ----------------
  private async onAction(a: Action): Promise<ActionResult> {
    if (a.type === "startBattle") {
      this.transferring = true;
      Save.write();
      this.cameras.main.fadeOut(350, 21, 18, 31);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Battle", { battleId: a.id });
      });
      return "stop";
    }
    if (a.type !== "event") return;

    const name = a.name;
    if (name === "wake") {
      await new Promise<void>((res) =>
        this.tweens.add({
          targets: this.blackout,
          fillAlpha: 0,
          duration: 1300,
          onComplete: () => res(),
        })
      );
      return;
    }
    if (name === "save") {
      Save.write();
      return;
    }
    if (name === "toVillage") {
      G.map = "village";
      G.x = 19;
      G.y = 2;
      this.pendingTransfer = "map";
      return "stop";
    }
    if (name === "sleep") {
      this.pendingTransfer = "sleep";
      return "stop";
    }
    if (name === "ending") {
      this.pendingTransfer = "ending";
      return "stop";
    }
    if (name === "hearts") {
      const fox = this.npcSprites.find((n) => n.def.id === "kitsune")?.sprite;
      const cx = fox?.x ?? this.player.x;
      const cy = fox?.y ?? this.player.y;
      for (let i = 0; i < 7; i++) {
        const hp = this.add.image(cx + (i - 3) * 7, cy - 6, "p_heart").setDepth(2000);
        this.tweens.add({
          targets: hp,
          y: cy - 34 - (i % 3) * 6,
          alpha: { from: 1, to: 0 },
          delay: i * 80,
          duration: 900,
          onComplete: () => hp.destroy(),
        });
      }
      Sound.seHeal();
      return;
    }
    if (name === "song") {
      // ことりのうた: ♪ がただよう（E5）
      Sound.setBgm("night");
      const kotori = this.npcSprites.find((n) => n.def.id === "kotori")?.sprite;
      this.songTimer?.remove();
      this.songTimer = this.time.addEvent({
        delay: 450,
        repeat: 20,
        callback: () => {
          const x = (kotori?.x ?? this.player.x) + Phaser.Math.Between(-10, 10);
          const y = (kotori?.y ?? this.player.y) - 8;
          const note = this.add
            .text(x, y, "♪", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.hikari })
            .setResolution(1)
            .setDepth(2000);
          this.tweens.add({
            targets: note,
            y: y - 28,
            alpha: { from: 1, to: 0 },
            duration: 1400,
            onComplete: () => note.destroy(),
          });
        },
      });
      return;
    }
    if (name.startsWith("greet:")) {
      const npcId = name.slice("greet:".length);
      const justDone = recordGreet(npcId);
      const count = greetCount();
      this.toast(
        justDone ? STR.toastQ1Done : STR.toastQ1.replace("〈greet〉", String(count))
      );
      if (justDone) Save.write();
      return;
    }
  }

  private onDialogueEnd() {
    if (this.needRespawn && !this.transferring && !this.sleeping) {
      this.needRespawn = false;
      this.respawnNpcs();
    }
    const p = this.pendingTransfer;
    this.pendingTransfer = null;
    if (p === "map") {
      this.doTransfer();
    } else if (p === "sleep") {
      void this.runSleep();
    } else if (p === "ending") {
      this.goEnding();
    }
  }

  private doTransfer() {
    if (this.transferring) return;
    this.transferring = true;
    Save.write();
    this.cameras.main.fadeOut(350, 21, 18, 31);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({});
    });
  }

  private goEnding() {
    if (this.transferring) return;
    this.transferring = true;
    this.cameras.main.fadeOut(700, 255, 246, 249);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Ending");
    });
  }

  // ---------------- E6: かみさまの よる ----------------
  private waitAdvance(): Promise<void> {
    return new Promise((res) => {
      const key = (e: KeyboardEvent) => {
        if (["KeyZ", "Enter", "Space"].includes(e.code)) done();
      };
      const done = () => {
        this.input.keyboard?.off("keydown", key);
        this.input.off("pointerdown", done);
        res();
      };
      this.input.keyboard?.on("keydown", key);
      this.input.on("pointerdown", done);
    });
  }

  private kamiLine(text: string): Promise<void> {
    // 窓なし・マスクなし・無音。1行ごとに長めの間 (§9 E6 / §11)
    return new Promise((res) => {
      const t = this.add
        .text(160, 86, "", { fontFamily: "DotGothic16", fontSize: "16px", color: HEX.shiro })
        .setResolution(1)
        .setOrigin(0.5)
        .setDepth(1600)
        .setScrollFactor(0);
      let i = 0;
      const timer = this.time.addEvent({
        delay: 80,
        loop: true,
        callback: () => {
          i++;
          t.setText(text.slice(0, i));
          if (i >= text.length) {
            timer.remove();
            this.time.delayedCall(700, async () => {
              await this.waitAdvance();
              this.tweens.add({
                targets: t,
                alpha: 0,
                duration: 250,
                onComplete: () => {
                  t.destroy();
                  res();
                },
              });
            });
          }
        },
      });
    });
  }

  private async runSleep() {
    if (this.sleeping) return;
    this.sleeping = true;
    Sound.setBgm("none");
    await new Promise<void>((res) =>
      this.tweens.add({
        targets: this.blackout,
        fillAlpha: 1,
        duration: 1600,
        onComplete: () => res(),
      })
    );
    await new Promise<void>((res) => {
      this.time.delayedCall(900, () => res());
    });

    // テレメトリの実値が、ここではじめて言葉になる (§4.6)
    const lines: string[] = [];
    lines.push(STR.kamiLines[0].replace("〈n〉", String(G.learned.size)));
    lines.push(STR.kamiLines[1].replace("〈m〉", String(Telemetry.data.examines)));
    if (G.kokoro.dark >= 1) lines.push(STR.kamiLines[2]);
    lines.push(STR.kamiLines[3]);
    lines.push(STR.kamiLines[4]);
    for (const line of lines) await this.kamiLine(line);

    await new Promise<void>((res) => {
      this.time.delayedCall(1300, () => res());
    });

    G.setFlag("e6_done");
    G.setPhase("morning");
    G.map = "village";
    G.x = 19;
    G.y = 8;
    Save.write();
    this.scene.restart({});
  }

  // ---------------- 表示状態 ----------------
  private applyPhase() {
    const p: DayPhase = G.phase;
    if (p === "day") this.phaseOverlay.setFillStyle(PAL.fuji, 0);
    else if (p === "evening") this.phaseOverlay.setFillStyle(PAL.fuji, 0.3);
    else if (p === "night") this.phaseOverlay.setFillStyle(PAL.kofuji, 0.42);
    else this.phaseOverlay.setFillStyle(PAL.ki, 0.1);
    for (const s of this.stars) s.setVisible(p === "night");
    Sound.setBgm(p === "evening" ? "evening" : p === "night" ? "night" : "day");
    this.requestRespawn();
  }

  /** 会話の途中で NPC が消えると不自然なので、会話が終わってから配置し直す */
  private requestRespawn() {
    if (this.director?.active) this.needRespawn = true;
    else this.respawnNpcs();
  }

  private updateSaturation() {
    // 学ぶほど世界の彩度が上がる (§4.1)。くすみを少しずつ剥がす表現
    const a = 0.2 * (1 - G.learned.size / WORD_COUNT);
    this.satOverlay.setFillStyle(PAL.kuro, Math.max(0, a));
  }

  private toast(text: string) {
    this.toastText?.destroy();
    const t = this.add
      .text(160, 18, text, {
        fontFamily: "DotGothic16",
        fontSize: "16px",
        color: HEX.shiro,
        backgroundColor: HEX.kuro,
        padding: { x: 6, y: 2 },
      })
      .setResolution(1)
      .setOrigin(0.5)
      .setDepth(1650)
      .setScrollFactor(0)
      .setAlpha(0);
    this.toastText = t;
    this.tweens.add({ targets: t, alpha: 1, duration: 200 });
    this.time.delayedCall(2000, () =>
      this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() })
    );
  }

  private uiBusy(): boolean {
    return (
      this.director.active ||
      this.notebook.isOpen ||
      this.sleeping ||
      this.transferring ||
      this.blackout.fillAlpha > 0.5
    );
  }

  // ---------------- 入力・インタラクション ----------------
  private onConfirmKey() {
    if (this.uiBusy()) return; // 会話中の送りは MessageWindow 側が処理する
    const target = this.findTarget();
    if (!target) return;
    if (target.kind === "npc") {
      const entry = target.def.entries.find((e) => G.checkConds(e.if));
      if (entry) void this.director.run(entry.node);
    } else {
      Telemetry.examine();
      void this.director.run(target.node);
    }
  }

  private findTarget():
    | { kind: "npc"; def: NpcDef; x: number; y: number }
    | { kind: "ex"; node: string; x: number; y: number }
    | null {
    const px = this.player.x + this.facing.x * 14;
    const py = this.player.y + this.facing.y * 14;
    for (const n of this.npcSprites) {
      if (Phaser.Math.Distance.Between(px, py, n.sprite.x, n.sprite.y) < 12) {
        return { kind: "npc", def: n.def, x: n.sprite.x, y: n.sprite.y };
      }
    }
    // 向いている先のタイル → 自分が乗っているタイル の順でしらべる
    // （花のように歩けるタイルは、上に立ったままでも しらべられるように）
    const candidates: [number, number][] = [
      [Math.floor(px / 16), Math.floor(py / 16)],
      [Math.floor(this.player.x / 16), Math.floor(this.player.y / 16)],
    ];
    for (const [tx, ty] of candidates) {
      for (const ex of this.mapDef.examinables) {
        const w = ex.w ?? 1;
        const h = ex.h ?? 1;
        if (tx >= ex.x && tx < ex.x + w && ty >= ex.y && ty < ex.y + h && G.checkCond(ex.if)) {
          return { kind: "ex", node: ex.node, x: tx * 16 + 8, y: ty * 16 + 8 };
        }
      }
    }
    return null;
  }

  private checkZones(tx: number, ty: number) {
    for (const z of this.mapDef.zones) {
      if (tx < z.x || tx >= z.x + z.w || ty < z.y || ty >= z.y + z.h) continue;
      if (!G.checkCond(z.if)) continue;
      if (z.once) {
        if (G.hasFlag(z.once)) continue;
        G.setFlag(z.once);
      }
      if (z.event === "ending") {
        this.goEnding();
        return;
      }
      if (z.node) {
        void this.director.run(z.node);
        return;
      }
    }
  }

  private checkTransitions(tx: number, ty: number) {
    if (this.transferring) return;
    for (const t of this.mapDef.transitions) {
      if (tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h) {
        G.map = t.to.map;
        G.x = t.to.x;
        G.y = t.to.y;
        this.doTransfer();
        return;
      }
    }
  }

  // ---------------- 毎フレーム ----------------
  update(_time: number, delta: number) {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (this.uiBusy()) {
      body.setVelocity(0, 0);
      this.prompt.setVisible(false);
      return;
    }

    const cursors = this.moveKeys;
    let vx = 0;
    let vy = 0;
    if (cursors.LEFT.isDown || cursors.A.isDown) vx -= 1;
    if (cursors.RIGHT.isDown || cursors.D.isDown) vx += 1;
    if (cursors.UP.isDown || cursors.W.isDown) vy -= 1;
    if (cursors.DOWN.isDown || cursors.S.isDown) vy += 1;
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.lengthSq() > 0) {
      v.normalize().scale(SPEED);
      this.facing.set(Math.sign(vx), Math.sign(vy));
      if (vx !== 0 && vy !== 0) this.facing.set(Math.sign(vx), 0); // ななめは横優先
      // 歩きアニメ（2フレームのぴょこぴょこ）
      this.walkClock += delta;
      if (this.walkClock > 160) {
        this.walkClock = 0;
        this.walkFrame = 1 - this.walkFrame;
        this.player.setTexture(`player_${this.walkFrame}`);
      }
    } else {
      this.player.setTexture("player_0");
    }
    body.setVelocity(v.x, v.y);
    this.player.setDepth(this.player.y);

    // タイルをまたいだら歩数・ゾーン・マップ遷移を判定
    const tx = Math.floor(this.player.x / 16);
    const ty = Math.floor(this.player.y / 16);
    if (tx !== this.lastTile.x || ty !== this.lastTile.y) {
      this.lastTile = { x: tx, y: ty };
      Telemetry.step();
      this.checkZones(tx, ty);
      this.checkTransitions(tx, ty);
      G.x = tx;
      G.y = ty;
    }

    // しらべ対象の頭上マーク
    const target = this.findTarget();
    if (target) {
      this.prompt.setVisible(true);
      this.prompt.setPosition(target.x, target.y - 16 + Math.sin(_time / 180) * 2);
    } else {
      this.prompt.setVisible(false);
    }

    // E0 チュートリアル: 文字を使わず矢印だけで花へ誘導 (§9 E0)
    if (G.map === "hill" && !G.hasWord("hana")) {
      if (!this.tutorialArrow) {
        this.tutorialArrow = this.add
          .text(8 * 16 + 8, 4 * 16 - 10, "▼", {
            fontFamily: "DotGothic16",
            fontSize: "16px",
            color: HEX.komomo,
          })
          .setResolution(1)
          .setOrigin(0.5)
          .setDepth(810);
      }
      this.tutorialArrow.setY(4 * 16 - 10 + Math.sin(_time / 150) * 3);
    } else if (this.tutorialArrow) {
      this.tutorialArrow.destroy();
      this.tutorialArrow = null;
    }

    // NPC のぴょこぴょこ＆きつねのこの なみだ (reveal_sad)
    for (const n of this.npcSprites) {
      const frame = Math.floor(_time / 420 + n.sprite.x) % 2;
      n.sprite.setTexture(`npc_${n.def.id}_${frame}`);
    }
    if (this.tear) {
      const fox = this.npcSprites.find((n) => n.def.id === "kitsune")?.sprite;
      const show =
        !!fox && G.hasWord("kanashii") && G.hasFlag("e3_done") && !G.hasFlag("e4_done");
      this.tear.setVisible(show);
      if (fox && show) this.tear.setPosition(fox.x - 3, fox.y + 1 + (Math.floor(_time / 500) % 2));
    }
  }
}
