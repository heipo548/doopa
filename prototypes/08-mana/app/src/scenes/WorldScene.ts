// WorldScene — 序章「灯し村」（SPEC.md §9）
// 方針: シーンは生成と入力ルーティング、ロジックは systems/、データは data/（§4）

import Phaser from 'phaser';
import {
  COLORS, DEBUG, FONT, INTERACT_RADIUS, LISTEN_HOLD_MS, LISTEN_RADIUS, NAMING_RADIUS,
  SISTER_NAME, WORLD_HEIGHT, WORLD_WIDTH, type DialogueLine,
} from '../config';
import { DIALOGUES, fillName } from '../data/dialogues';
import { ENTITIES, entityById, type EntityDef } from '../data/entities';
import { FRAGMENTS } from '../data/fragments';
import { HINTS } from '../data/hints';
import {
  BOSS_ARENA, BOSS_GATE, BOSS_TRIGGER_X, COLORIZE_PAN, DARK_DEEP_X, DARK_ENTRANCE, DARK_ZONE,
  DEBUG_SPOTS, DECORS, NPCS, PLAYER_START, RIVER_BRIDGE_GAP, RIVER_SOLID, RIVER_VIEW,
  SHADOW_BLOCKER, STORM_ZONE, TATEFUDA, WALLS, ZONES, type Rect,
} from '../data/level_village';
import { makeDecor } from '../entities/Decor';
import { Dog } from '../entities/Dog';
import { Nameless } from '../entities/Nameless';
import {
  makeBench, makeBridge, makeCrow, makeHole, makeKamadoNamed, makeLantern,
  makeOldTree, makePedestal, makePlaque, makeSign, makeStatue, makeWaterwheel, makeWell,
} from '../entities/NamedThing';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import { crystallize } from '../fx/GlyphCrystallize';
import { inkBurst } from '../fx/InkParticles';
import { inkCover, inkReveal } from '../fx/Transitions';
import { BossController } from '../systems/BossController';
import { ColorSystem } from '../systems/ColorSystem';
import { getCtx, type Ctx } from '../systems/context';
import { EffectRegistry, type WorldApi } from '../systems/EffectRegistry';
import { Hud } from '../systems/Hud';
import type { RecipeResult } from '../systems/RecipeEngine';
import type { DialogueScene } from './DialogueScene';

interface Interactable {
  def: EntityDef;
  done: boolean;
  nameless?: Nameless;
  marker?: Phaser.GameObjects.Text;
}

interface FragmentPickup {
  glyph: string;
  cont: Phaser.GameObjects.Container;
  hidden: boolean;
  // 浮遊アニメで cont.y が揺れるため、拾得判定は設置座標で行う
  baseX: number;
  baseY: number;
}

export class WorldScene extends Phaser.Scene implements WorldApi {
  private ctx!: Ctx;
  private colorSys!: ColorSystem;
  private effects!: EffectRegistry;
  private dlg!: DialogueScene;
  private hud!: Hud;
  private player!: Player;
  boss!: BossController;
  private dog: Dog | null = null;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'w' | 'a' | 's' | 'd' | 'e' | 'z' | 'q' | 'x', Phaser.Input.Keyboard.Key>;

  private inter = new Map<string, Interactable>();
  private fragments = new Map<string, FragmentPickup>();
  private npcs = new Map<string, Npc>();
  private namedVisuals = new Map<string, Phaser.GameObjects.Container>();
  private plaqueText!: Phaser.GameObjects.Text;
  private wellWater: Phaser.GameObjects.Arc | null = null;

  private riverMidWall!: Phaser.GameObjects.Rectangle;
  private shadowWall: Phaser.GameObjects.Rectangle | null = null;
  private gateWall!: Phaser.GameObjects.Rectangle;
  private stormEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormBlob: Nameless | null = null;

  private darkRT: Phaser.GameObjects.RenderTexture | null = null;
  private darkEraser!: Phaser.GameObjects.Image;
  private lightOrb: Phaser.GameObjects.Image | null = null;

  private listenRing!: Phaser.GameObjects.Graphics;
  private listenHold = 0;
  private listenTarget: string | null = null;

  private cutscene = false;
  private overlayCooldownUntil = 0;
  private lastStormToast = 0;
  private lastDarkWarn = 0;
  private holeUsed = false;
  private stepAcc = 0;
  private moodAcc = 0;
  private battleVeil: Phaser.GameObjects.Image | null = null;

  constructor() {
    super('World');
  }

  // ============================================================ create

  create(): void {
    this.ctx = getCtx(this);
    this.colorSys = new ColorSystem();
    this.effects = new EffectRegistry();
    this.inter.clear();
    this.fragments.clear();
    this.npcs.clear();
    this.namedVisuals.clear();
    this.dog = null;
    this.lightOrb = null;
    this.darkRT = null;
    this.stormEmitter = null;
    this.stormBlob = null;
    this.shadowWall = null;
    this.cutscene = false;
    this.listenHold = 0;
    this.holeUsed = false;
    this.stepAcc = 0;
    this.moodAcc = 0;
    this.battleVeil = null;

    this.cameras.main.setBackgroundColor(COLORS.paperStr);
    inkReveal(this);

    this.buildGround();
    const walls = this.buildWalls();
    this.buildDecor();
    this.buildNpcs();
    this.buildEntities(walls);
    this.buildFragments();

    const start = this.ctx.resumePos ?? PLAYER_START;
    this.ctx.resumePos = null;
    this.player = new Player(this, start.x, start.y);
    if (this.ctx.flags.has('p3_done')) {
      this.dog = new Dog(this, start.x - 40, start.y + 20);
    }

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.physics.add.collider(this.player, walls);
    this.physics.add.collider(this.player, this.riverMidWall);
    if (this.shadowWall) this.physics.add.collider(this.player, this.shadowWall);
    this.physics.add.collider(this.player, this.gateWall);

    this.buildAmbient();
    this.hud = new Hud(this, this.ctx);
    this.boss = new BossController(this);
    this.listenRing = this.add.graphics().setDepth(900);

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keys = {
        w: kb.addKey('W'), a: kb.addKey('A'), s: kb.addKey('S'), d: kb.addKey('D'),
        e: kb.addKey('E'), z: kb.addKey('Z'), q: kb.addKey('Q'), x: kb.addKey('X'),
      };
      kb.on('keydown-M', () => {
        const muted = this.ctx.audio.toggleMute();
        this.toast(muted ? 'おと: オフ' : 'おと: オン');
      });
    }

    this.ctx.music.start();
    this.ctx.music.setMood(this.ctx.flags.has('boss_done') ? 'celebrate' : 'village');

    this.scene.launch('Dialogue');
    this.dlg = this.scene.get('Dialogue') as DialogueScene;
    this.scene.bringToTop('Dialogue');

    if (!this.ctx.flags.has('intro_done')) {
      this.time.delayedCall(800, () => {
        if (this.ctx.flags.has('intro_done')) return;
        this.ctx.flags.set('intro_done');
        this.sayKey('kotono_intro');
      });
    }

    if (DEBUG) this.setupDebug();

    this.events.once('shutdown', () => {
      this.ctx.audio.setWind(0);
      this.scene.stop('Dialogue');
    });
  }

  private buildGround(): void {
    this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, COLORS.paper).setOrigin(0).setDepth(0);
    for (const z of ZONES) {
      const mono = this.add
        .rectangle(z.rect.x, z.rect.y, z.rect.w, z.rect.h, z.mono)
        .setOrigin(0)
        .setDepth(1);
      const color = this.add
        .rectangle(z.rect.x, z.rect.y, z.rect.w, z.rect.h, z.color)
        .setOrigin(0)
        .setDepth(2);
      this.colorSys.register(
        `zone_${z.id}`,
        [mono],
        [color],
        { x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 },
        z.id,
      );
    }
    // 川
    const rv = RIVER_VIEW;
    const riverMono = this.add.rectangle(rv.x, rv.y, rv.w, rv.h, 0xc4c8c6).setOrigin(0).setDepth(3);
    const riverColor = this.add.rectangle(rv.x, rv.y, rv.w, rv.h, 0x8ec0c8).setOrigin(0).setDepth(3);
    this.colorSys.register(
      'river_water',
      [riverMono],
      [riverColor],
      { x: rv.x + rv.w / 2, y: rv.y + rv.h / 2 },
      'river',
    );
    // 岸辺の白い縁取り
    const bank = this.add.graphics().setDepth(4);
    bank.lineStyle(2.5, 0xffffff, 0.45);
    bank.lineBetween(rv.x + 2, rv.y, rv.x + 2, rv.y + rv.h);
    bank.lineBetween(rv.x + rv.w - 2, rv.y, rv.x + rv.w - 2, rv.y + rv.h);
    bank.lineStyle(1.2, 0x6a8a90, 0.5);
    bank.lineBetween(rv.x + 7, rv.y, rv.x + 7, rv.y + rv.h);
    bank.lineBetween(rv.x + rv.w - 7, rv.y, rv.x + rv.w - 7, rv.y + rv.h);
    // 流れの筋（ゆらゆら動く）
    for (let i = 0; i < 7; i++) {
      const fy = rv.y + 60 + i * 75;
      const streak = this.add
        .image(rv.x + 30 + (i % 3) * 35, fy, 'streak')
        .setTint(0xffffff)
        .setAlpha(0.4)
        .setScale(2.2, 1.4)
        .setAngle(78)
        .setDepth(4);
      this.tweens.add({
        targets: streak,
        y: fy + 46,
        alpha: 0.12,
        duration: 1700 + i * 230,
        repeat: -1,
        ease: 'Sine.easeIn',
      });
    }
    // 木の葉が流れてくる
    this.time.addEvent({
      delay: 3800,
      loop: true,
      callback: () => {
        if (this.cutscene) return;
        const leaf = this.add
          .image(rv.x + 25 + Math.random() * (rv.w - 50), rv.y + 10, 'leaf')
          .setDepth(5)
          .setAlpha(0.95)
          .setAngle(Math.random() * 360);
        this.tweens.add({
          targets: leaf,
          y: rv.y + rv.h - 16,
          x: leaf.x + (Math.random() - 0.5) * 40,
          angle: leaf.angle + 240,
          duration: 9000,
          ease: 'Sine.easeInOut',
          onComplete: () => leaf.destroy(),
        });
      },
    });
  }

  /** 紙の質感・世界の縁・雲影・靄 — 画面に「絵巻の空気」を流す */
  private buildAmbient(): void {
    // 紙の繊維（スクリーン全体に乗算で焼き込む）
    const grain = this.add
      .tileSprite(480, 270, 960, 540, 'paper')
      .setScrollFactor(0)
      .setDepth(1500)
      .setAlpha(0.9);
    grain.setBlendMode(Phaser.BlendModes.MULTIPLY);
    // ビネット
    this.add
      .image(480, 270, 'vignette')
      .setScrollFactor(0)
      .setDepth(1501)
      .setDisplaySize(960, 540)
      .setAlpha(0.2);
    // 世界の縁 — 黙に蝕まれた淵
    const edges: [number, number, number, boolean][] = [
      [340, 810, 0, false], // 左
      [2640, 810, 0, true], // 右（反転）
    ];
    for (const [x, y, angle, flip] of edges) {
      this.add
        .image(x, y, 'edgeInk')
        .setDisplaySize(210, 1700)
        .setAngle(angle)
        .setFlipX(flip)
        .setDepth(540)
        .setAlpha(0.6);
    }
    this.add.image(1440, 110, 'edgeInk').setDisplaySize(220, 2960).setAngle(90).setDepth(540).setAlpha(0.6);
    this.add.image(1440, 1510, 'edgeInk').setDisplaySize(220, 2960).setAngle(-90).setDepth(540).setAlpha(0.6);
    // 雲影 — 大きな薄墨がゆっくり地面を渡る
    for (let i = 0; i < 3; i++) {
      const cloud = this.add
        .image(400 + i * 900, 300 + i * 420, 'glow')
        .setTint(0x141210)
        .setAlpha(0.05)
        .setScale(9 + i * 2)
        .setDepth(530);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + 1400,
        y: cloud.y + 160,
        duration: 52000 + i * 14000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    // 靄 — 暗がりの間と丘のふもとに
    for (const [mx, my, sc] of [
      [1680, 1020, 3.2],
      [620, 620, 2.6],
      [2050, 920, 2.4],
    ] as const) {
      const mist = this.add.image(mx, my, 'mist').setAlpha(0.3).setScale(sc, 1.4).setDepth(520);
      this.tweens.add({
        targets: mist,
        x: mx + 70,
        alpha: 0.16,
        duration: 7000 + Math.random() * 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** 座標が属するゾーン id（装飾の彩色プレート登録に使う） */
  private zoneAt(x: number, y: number): string | undefined {
    for (const z of ZONES) {
      if (x >= z.rect.x && x <= z.rect.x + z.rect.w && y >= z.rect.y && y <= z.rect.y + z.rect.h) {
        return z.id;
      }
    }
    return undefined;
  }

  private buildWalls(): Phaser.Physics.Arcade.StaticGroup {
    const group = this.physics.add.staticGroup();
    const addWall = (r: Rect, alpha = 0.05): void => {
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x2a2426, alpha);
      group.add(rect);
    };
    for (const r of WALLS) addWall(r);
    for (const r of RIVER_SOLID) addWall(r, 0);
    addWall({ x: 1400, y: 108, w: 160, h: 52 }, 0); // 社殿

    // 橋が架かるまで通れない川中央
    const gap = RIVER_BRIDGE_GAP;
    this.riverMidWall = this.add.rectangle(gap.x + gap.w / 2, gap.y + gap.h / 2, gap.w, gap.h, 0, 0);
    this.physics.add.existing(this.riverMidWall, true);
    if (this.ctx.flags.has('p2_bridge')) {
      (this.riverMidWall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }

    // 大きな影の通せんぼ
    if (!this.ctx.flags.has('p3_done')) {
      const sb = SHADOW_BLOCKER;
      this.shadowWall = this.add.rectangle(sb.x + sb.w / 2, sb.y + sb.h / 2, sb.w, sb.h, 0, 0);
      this.physics.add.existing(this.shadowWall, true);
    }

    // ボス戦中だけ閉じる門
    const g = BOSS_GATE;
    this.gateWall = this.add.rectangle(g.x + g.w / 2, g.y + g.h / 2, g.w, g.h, 0x2a2426, 0.25);
    this.gateWall.setVisible(false).setDepth(550);
    this.physics.add.existing(this.gateWall, true);
    (this.gateWall.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    return group;
  }

  private buildDecor(): void {
    for (const d of DECORS) {
      const res = makeDecor(this, d.type, d.x, d.y, d.s ?? 1);
      // 彩色プレートを持つ装飾（鳥居・社・窓灯・花・石灯籠）はフィナーレで色づく
      if (res.mono && res.color) {
        this.colorSys.register(
          `decor_${d.type}_${d.x}_${d.y}`,
          res.mono as (Phaser.GameObjects.GameObject & { alpha: number })[],
          res.color as (Phaser.GameObjects.GameObject & { alpha: number })[],
          { x: d.x, y: d.y },
          this.zoneAt(d.x, d.y),
        );
      }
    }
    makeSign(this, TATEFUDA.x, TATEFUDA.y);
    // 社の鐘
    const bellDef = entityById('bell');
    const bell = this.add.container(bellDef.x, bellDef.y);
    const bg = this.add.graphics();
    bg.fillStyle(0x8a6a48, 1);
    bg.fillRect(-22, -54, 6, 44);
    bg.fillRect(16, -54, 6, 44);
    bg.fillRect(-26, -60, 52, 8);
    bg.fillStyle(0x6a6a5a, 1);
    bg.fillEllipse(0, -30, 26, 30);
    bg.fillStyle(0x4a4a3c, 1);
    bg.fillCircle(0, -14, 4);
    bell.add(bg);
    bell.setDepth(10 + bellDef.y * 0.001);
  }

  private buildNpcs(): void {
    for (const n of NPCS) {
      const npc = new Npc(this, n.id, n.x, n.y);
      this.npcs.set(n.id, npc);
      const plates = npc.plates;
      this.colorSys.register(
        n.id,
        [plates.mono],
        [plates.color],
        { x: n.x, y: n.y },
        n.id === 'kotono' ? 'plaza' : undefined,
      );
    }
  }

  private buildEntities(walls: Phaser.Physics.Arcade.StaticGroup): void {
    void walls;
    const flags = this.ctx.flags;
    for (const def of ENTITIES) {
      const done = def.doneFlag !== undefined && flags.has(def.doneFlag);
      const it: Interactable = { def, done };
      this.inter.set(def.id, it);

      switch (def.id) {
        case 'kamado':
          if (done) {
            this.namedVisuals.set(def.id, makeKamadoNamed(this, def.x, def.y));
            this.colorSys.colorize(this, 'villager_a', { dur: 1, burst: false });
          } else {
            it.nameless = new Nameless(this, def.id, def.x, def.y, def.size ?? 26);
          }
          break;
        case 'darkness':
          if (!this.ctx.inv.has('明')) {
            it.done = false;
            it.nameless = new Nameless(this, def.id, def.x, def.y, def.size ?? 30, 0x3a3a44);
            it.nameless.setDepth(590);
            this.buildDark();
          } else {
            it.done = true;
          }
          break;
        case 'driftwood':
          if (done) {
            this.namedVisuals.set(def.id, makeBridge(this, 2030, 1300));
          } else {
            it.nameless = new Nameless(this, def.id, def.x, def.y, def.size ?? 24);
          }
          break;
        case 'bench1':
        case 'bench2':
          this.namedVisuals.set(def.id, done ? makeBench(this, def.x, def.y) : makePedestal(this, def.x, def.y));
          if (!done) it.marker = this.addMarker(def.x, def.y - 40);
          break;
        case 'bigshadow':
          if (!done) {
            it.nameless = new Nameless(this, def.id, def.x, def.y, def.size ?? 64, 0x201c20);
          }
          break;
        case 'stormwall':
          if (!done) {
            it.nameless = new Nameless(this, def.id, def.x, def.y, def.size ?? 50, 0x3a4248);
            it.nameless.setScale(1.4, 1.1);
            this.stormBlob = it.nameless;
            this.buildStorm();
          }
          break;
        case 'crow':
          if (done) {
            this.makeBirdAtWell(false);
          } else {
            this.namedVisuals.set(def.id, makeCrow(this, def.x, def.y));
            it.marker = this.addMarker(def.x, def.y - 52);
          }
          break;
        case 'king_statue': {
          const statue = makeStatue(this, def.x, def.y);
          this.namedVisuals.set(def.id, statue);
          if (done) {
            statue.add(this.add.circle(12, -20, 6, COLORS.gold).setStrokeStyle(1.5, 0x8a6a20));
          } else {
            it.marker = this.addMarker(def.x, def.y - 88);
          }
          break;
        }
        case 'well': {
          const well = makeWell(this, def.x, def.y);
          this.namedVisuals.set(def.id, well);
          if (done) {
            this.fillWellVisual(well);
            this.colorSys.colorize(this, 'villager_b', { dur: 1, burst: false });
          } else {
            it.marker = this.addMarker(def.x, def.y - 48);
          }
          break;
        }
        case 'old_tree': {
          const tree = makeOldTree(this, def.x, def.y);
          this.namedVisuals.set(def.id, tree);
          if (done) {
            this.addBookFloat(tree);
          } else {
            it.marker = this.addMarker(def.x, def.y - 110);
          }
          break;
        }
        case 'plaque': {
          const { container, text } = makePlaque(this, def.x, def.y);
          this.namedVisuals.set(def.id, container);
          this.plaqueText = text;
          break;
        }
        case 'waterwheel':
          this.namedVisuals.set(def.id, makeWaterwheel(this, def.x, def.y));
          break;
        case 'hole_hill':
        case 'hole_plaza':
          this.namedVisuals.set(def.id, makeHole(this, def.x, def.y));
          break;
        case 'bell':
        case 'boss_fire':
          break; // bell は buildDecor、ボスは BossController が管理
      }
    }
  }

  private buildFragments(): void {
    for (const f of FRAGMENTS) {
      if (this.ctx.inv.has(f.glyph)) continue;
      const hidden = f.hiddenUntilFlag !== undefined && !this.ctx.flags.has(f.hiddenUntilFlag);
      this.spawnFragmentSprite(f.id, f.glyph, f.x, f.y, { hidden, inDark: f.inDark });
    }
  }

  private spawnFragmentSprite(
    id: string,
    glyph: string,
    x: number,
    y: number,
    opts: { hidden?: boolean; inDark?: boolean } = {},
  ): void {
    const cont = this.add.container(x, y);
    const glow = this.add.image(0, -6, 'glow').setScale(0.8).setTint(0xfff0c0).setAlpha(opts.inDark ? 0.85 : 0.45);
    const card = this.add.rectangle(0, -6, 30, 40, 0xfdfaf2, 1).setStrokeStyle(2, COLORS.inkSoft);
    const t = this.add
      .text(0, -6, glyph, { fontFamily: FONT, fontSize: '22px', color: COLORS.inkStr })
      .setOrigin(0.5)
      .setResolution(2);
    cont.add([glow, card, t]);
    cont.setDepth(opts.inDark ? 600 : 10 + y * 0.001);
    this.tweens.add({ targets: cont, y: y - 8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (opts.hidden) cont.setVisible(false);
    this.fragments.set(id, { glyph, cont, hidden: opts.hidden ?? false, baseX: x, baseY: y });
  }

  private buildDark(): void {
    if (this.darkRT) return;
    this.darkRT = this.add
      .renderTexture(DARK_ZONE.x, DARK_ZONE.y, DARK_ZONE.w, DARK_ZONE.h)
      .setOrigin(0)
      .setDepth(500);
    this.darkEraser = this.add.image(-1000, -1000, 'glow');
    this.darkEraser.setDisplaySize(240, 240);
  }

  private buildStorm(): void {
    const z = STORM_ZONE;
    this.stormEmitter = this.add.particles(0, 0, 'inkdot', {
      x: { min: z.x, max: z.x + z.w },
      y: { min: z.y, max: z.y + z.h },
      speedX: { min: -260, max: -160 },
      speedY: { min: -20, max: 20 },
      lifespan: 700,
      scale: { start: 1.4, end: 0.2 },
      alpha: { start: 0.6, end: 0 },
      frequency: 50,
      tint: 0xb8c2c8,
    });
    this.stormEmitter.setDepth(560);
  }

  private addMarker(x: number, y: number): Phaser.GameObjects.Text {
    const m = this.add
      .text(x, y, '？', { fontFamily: FONT, fontSize: '26px', color: COLORS.inkSoftStr })
      .setOrigin(0.5)
      .setDepth(580)
      .setVisible(false)
      .setResolution(2);
    this.tweens.add({ targets: m, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return m;
  }

  // ============================================================ update

  update(time: number, delta: number): void {
    if (!this.player) return;
    this.ctx.playtime += delta / 1000;

    const listening = this.listenHold > 0;
    const locked = this.dlg.busy || this.cutscene || listening;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.s.isDown) dy += 1;
    this.player.move(dx, dy, locked, time, delta);
    this.player.setDepth(10 + this.player.y * 0.001);

    // 足音と土埃
    if (this.player.moving && !locked) {
      this.stepAcc += delta;
      if (this.stepAcc >= 295) {
        this.stepAcc = 0;
        this.ctx.audio.se('step');
        const puff = this.add
          .image(this.player.x + (Math.random() - 0.5) * 10, this.player.y + 4, 'inkdot')
          .setTint(0xcfc8b8)
          .setAlpha(0.5)
          .setScale(1.3)
          .setDepth(9);
        this.tweens.add({
          targets: puff,
          y: puff.y - 7,
          scale: 2.4,
          alpha: 0,
          duration: 460,
          onComplete: () => puff.destroy(),
        });
      }
    } else {
      this.stepAcc = 200;
    }

    // BGM ムード（500ms ごとに現在地から判定）
    this.moodAcc += delta;
    if (this.moodAcc >= 500) {
      this.moodAcc = 0;
      this.ctx.music.setMood(this.currentMood());
    }

    if (this.lightOrb) {
      this.lightOrb.x += (this.player.x - this.lightOrb.x) * 0.08;
      this.lightOrb.y += (this.player.y - 30 - this.lightOrb.y) * 0.08;
    }
    this.dog?.follow(this.player.x, this.player.y, this.cutscene ? 0 : delta);

    this.updateStorm(time);
    this.updateDark(time);
    this.updateListen(time, delta);

    if (Phaser.Input.Keyboard.JustDown(this.keys.e) || Phaser.Input.Keyboard.JustDown(this.keys.z)) {
      this.tryInteract(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this.tryNaming(time);
    }

    this.updateMarkersAndGuide();

    if (
      this.boss.phase === 'idle' &&
      this.ctx.flags.has('p4_done') &&
      !this.ctx.flags.has('boss_done') &&
      this.playerIn(BOSS_ARENA) &&
      this.player.x > BOSS_TRIGGER_X
    ) {
      this.boss.start();
    }
    this.boss.update(time, delta);
  }

  /** 現在地と進行から BGM ムードを決める */
  private currentMood(): 'village' | 'dark' | 'river' | 'hill' | 'shrine' | 'boss' | 'celebrate' {
    if (this.ctx.flags.has('boss_done')) return 'celebrate';
    if (this.boss.isFighting()) return 'boss';
    if (this.playerIn(BOSS_ARENA)) return 'shrine';
    if (this.darkRT && this.playerIn(DARK_ZONE)) return 'dark';
    const x = this.player.x;
    const y = this.player.y;
    if (x >= 1700 && y >= 900) return 'river';
    if (y < 660 && x < 1140) return 'hill';
    return 'village';
  }

  private updateStorm(time: number): void {
    if (this.ctx.flags.has('p4_done')) {
      this.ctx.audio.setWind(0);
      return;
    }
    const cx = STORM_ZONE.x + STORM_ZONE.w / 2;
    const cy = STORM_ZONE.y + STORM_ZONE.h / 2;
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);
    this.ctx.audio.setWind(Math.max(0, 1 - d / 800));
    if (this.playerIn(STORM_ZONE) && !this.cutscene) {
      this.player.body.velocity.x = -300;
      if (time > this.lastStormToast + 2500) {
        this.lastStormToast = time;
        this.toast('風が つよすぎて、すすめない！');
        this.cameras.main.shake(120, 0.002);
      }
    }
  }

  private updateDark(time: number): void {
    if (!this.darkRT) return;
    this.darkRT.clear();
    this.darkRT.fill(0x0a0a0c, 0.93);
    if (this.playerIn(DARK_ZONE)) {
      this.darkRT.erase(this.darkEraser, this.player.x - DARK_ZONE.x, this.player.y - DARK_ZONE.y);
      if (this.player.x > DARK_DEEP_X && !this.cutscene && !this.dlg.busy && time > this.lastDarkWarn + 1500) {
        this.lastDarkWarn = time;
        this.player.setPosition(DARK_ENTRANCE.x, DARK_ENTRANCE.y);
        this.cameras.main.flash(220, 10, 10, 12);
        this.sayKey('dark_deep');
      }
    }
  }

  private updateListen(time: number, delta: number): void {
    const down = this.keys.q.isDown || this.keys.x.isDown;
    this.listenRing.clear();
    if (!down || this.dlg.busy || this.cutscene || time < this.overlayCooldownUntil) {
      this.listenHold = 0;
      this.listenTarget = null;
      return;
    }
    if (this.listenHold < 0) return; // 押しっぱなし消費済み
    if (!this.listenTarget) this.listenTarget = this.findListenTarget();
    if (!this.listenTarget) return;
    this.listenHold += delta;
    const p = Math.min(this.listenHold / LISTEN_HOLD_MS, 1);
    this.listenRing.lineStyle(3.5, 0x4a4a4a, 0.9);
    this.listenRing.beginPath();
    this.listenRing.arc(this.player.x, this.player.y - 48, 14, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    this.listenRing.strokePath();
    if (this.listenHold >= LISTEN_HOLD_MS) {
      const { text } = this.ctx.hints.listen(this.listenTarget);
      this.ctx.audio.se('pickup');
      this.dlg.say([{ speaker: 'hint', text }]);
      this.listenHold = -1;
    }
  }

  /** 巨体のナナシ（影・嵐）にも届くよう、対象サイズぶん距離を割り引く */
  private reachScore(it: Interactable): number {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.def.x, it.def.y);
    return d - (it.def.size ?? 24) / 2;
  }

  private findListenTarget(): string | null {
    if (this.boss.isFighting() && this.playerIn(BOSS_ARENA)) return 'boss_fire';
    let best: string | null = null;
    let bestD = LISTEN_RADIUS;
    for (const [id, it] of this.inter) {
      if (!(id in HINTS) || it.done) continue;
      // きき診は謎解きの主役。装置より名付け対象を優先する
      const d = this.reachScore(it) - (it.def.nameable ? 20 : 0);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  // ---------------------------------------------------------- interact

  private tryInteract(time: number): void {
    if (this.dlg.busy || this.dlg.justClosed(time) || this.cutscene || this.listenHold > 0) return;
    if (time < this.overlayCooldownUntil) return;

    // ① 会話（優先度: 会話 > 拾う > 調べる §6）
    const npcId = this.nearestNpc(60);
    if (npcId) {
      this.talkTo(npcId);
      return;
    }
    // ② 拾う
    const fragId = this.nearestFragment(52);
    if (fragId) {
      this.pickupFragment(fragId);
      return;
    }
    // ③ 調べる・装置
    const dev = this.nearestDevice(INTERACT_RADIUS + 12);
    if (dev) this.useDevice(dev);
  }

  private nearestNpc(max: number): string | null {
    let best: string | null = null;
    let bestD = max;
    for (const [id, npc] of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  private nearestFragment(max: number): string | null {
    let best: string | null = null;
    let bestD = max;
    for (const [id, f] of this.fragments) {
      if (f.hidden || !f.cont.visible) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, f.baseX, f.baseY);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  private nearestDevice(max: number): string | null {
    const fromEntity = (id: string, r?: number): { id: string; x: number; y: number; r?: number } => {
      const def = entityById(id);
      return { id, x: def.x, y: def.y, r };
    };
    const candidates: { id: string; x: number; y: number; r?: number }[] = [
      fromEntity('bell', 70),
      fromEntity('bench1'),
      fromEntity('bench2'),
      fromEntity('hole_hill'),
      fromEntity('hole_plaza'),
      fromEntity('waterwheel'),
      { id: 'tateful', x: TATEFUDA.x, y: TATEFUDA.y },
      fromEntity('plaque'),
      fromEntity('well'),
      fromEntity('old_tree'),
    ];
    let best: string | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < (c.r ?? max) && d < bestD) {
        bestD = d;
        best = c.id;
      }
    }
    return best;
  }

  private talkTo(npcId: string): void {
    this.npcs.get(npcId)?.talkPulse();
    const flags = this.ctx.flags;
    if (npcId === 'kotono') {
      if (!flags.has('p0_done')) this.sayKey('kotono_intro');
      else if (!flags.has('p1_done') && !flags.has('p2_bridge')) this.sayKey('kotono_idle_early');
      else if (!flags.has('p4_done')) this.sayKey('kotono_idle_mid');
      else this.sayKey('kotono_idle_late');
    } else if (npcId === 'villager_a') {
      this.sayKey(this.colorSys.isColorized('villager_a') ? 'villager_a_color' : 'villager_a_mono');
    } else if (npcId === 'villager_b') {
      this.sayKey(this.colorSys.isColorized('villager_b') ? 'villager_b_color' : 'villager_b_mono');
    }
  }

  private pickupFragment(id: string): void {
    const f = this.fragments.get(id);
    if (!f) return;
    this.fragments.delete(id);
    this.ctx.audio.se('pickup');
    this.tweens.add({
      targets: f.cont,
      x: this.player.x,
      y: this.player.y - 20,
      scale: 0.1,
      alpha: 0.4,
      duration: 240,
      ease: 'Cubic.easeIn',
      onComplete: () => f.cont.destroy(),
    });
    this.ctx.inv.add(f.glyph);
    this.toast(`言ノ葉「${f.glyph}」を ひろった`);
    this.hud.refresh();
  }

  private useDevice(id: string): void {
    const flags = this.ctx.flags;
    switch (id) {
      case 'bell':
        if (this.boss.isFighting()) {
          this.boss.onBell();
        } else {
          this.ctx.audio.se('bell');
          this.toast('ゴーン……');
        }
        break;
      case 'bench1':
      case 'bench2':
        if (!flags.has(`${id}_built`)) return; // 台座のままなら Space で名付け
        if (this.boss.isFighting()) {
          this.toast('いまは やすめない！');
          return;
        }
        this.doSave();
        break;
      case 'hole_hill':
      case 'hole_plaza':
        this.useHole(id);
        break;
      case 'waterwheel':
        this.sayKey('waterwheel_look');
        break;
      case 'tateful':
        this.sayKey('tateful');
        break;
      case 'plaque':
        this.sayKey(flags.has('boss_done') ? 'plaque_after' : 'plaque_before');
        break;
      case 'well':
        if (!flags.has('s3_done')) this.sayKey('well_dry');
        break;
      case 'old_tree':
        if (flags.has('tree_done')) this.sayKey('book_lore');
        break;
    }
  }

  private useHole(id: string): void {
    if (!this.dog) {
      this.sayKey('hole_no_dog');
      return;
    }
    const from = entityById(id);
    const to = entityById(id === 'hole_hill' ? 'hole_plaza' : 'hole_hill');
    this.cutscene = true;
    const dog = this.dog;
    dog.dig(this, from.x, from.y, () => {
      this.cameras.main.fadeOut(280, 13, 12, 11);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.player.setPosition(to.x, to.y + 36);
        dog.warpTo(to.x - 30, to.y + 40);
        this.cameras.main.fadeIn(280, 13, 12, 11);
        this.cutscene = false;
        if (!this.holeUsed) {
          this.holeUsed = true;
          this.sayKey('hole_dig');
        }
      });
    });
  }

  private doSave(): void {
    const ok = this.ctx.save.save({
      name: this.ctx.playerName,
      flags: this.ctx.flags.list(),
      knownGlyphs: this.ctx.inv.list(),
      gems: this.ctx.inv.gems,
      pos: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      playtime: Math.round(this.ctx.playtime),
      hintLevels: this.ctx.hints.snapshot(),
    });
    this.cameras.main.flash(350, 255, 255, 255);
    this.ctx.audio.se('confirm');
    this.sayKey(ok ? 'bench_rest' : 'bench_rest');
  }

  // ---------------------------------------------------------- naming

  private tryNaming(time: number): void {
    if (this.dlg.busy || this.dlg.justClosed(time) || this.cutscene || this.listenHold > 0) return;
    if (time < this.overlayCooldownUntil) return;

    let targetId: string | null = null;
    if (this.boss.isFighting() && this.playerIn(BOSS_ARENA)) {
      if (this.boss.canName()) {
        targetId = 'boss_fire';
      } else {
        this.sayKey('boss_too_hot');
        return;
      }
    } else {
      let bestD = NAMING_RADIUS;
      for (const [id, it] of this.inter) {
        if (!it.def.nameable || it.done) continue;
        const d = this.reachScore(it);
        if (d < bestD) {
          bestD = d;
          targetId = id;
        }
      }
    }
    if (!targetId) return;
    this.ctx.audio.se('confirm');
    this.scene.launch('NamingOverlay', { targetId });
    this.scene.bringToTop('NamingOverlay');
    this.scene.pause();
  }

  /** きき診で正体が判明しているか（改字UIの解禁判定 §7-2） */
  namingBaseKnown(def: EntityDef): boolean {
    if (!def.base) return false;
    if (def.state === 'named') return true;
    if (def.id === 'boss_fire') {
      return this.boss.phase === 'p2' || this.boss.phase === 'stun' || this.ctx.hints.baseRevealed(def.id);
    }
    return this.ctx.hints.baseRevealed(def.id);
  }

  onOverlayClosed(): void {
    this.overlayCooldownUntil = this.time.now + 300;
    this.input.keyboard?.resetKeys();
  }

  /** 名付け成立: 和音 → 結晶化（J2）→ 効果発火 */
  applyNaming(targetId: string, res: NonNullable<RecipeResult>, usedChars: string[], isNew: boolean): void {
    const it = this.inter.get(targetId);
    if (!it) return;
    this.ctx.audio.namingChord(usedChars);
    const isFinale = targetId === 'boss_fire' && res.glyph === '灯';
    const x = isFinale ? this.cameras.main.midPoint.x : it.def.x;
    const y = isFinale ? this.cameras.main.midPoint.y : it.def.y;
    if (isFinale) this.beginCutscene();
    crystallize(this, x, y, res.glyph, {
      big: isFinale,
      onDone: () => {
        if (isNew) {
          this.toast(`あたらしい字「${res.glyph}」を おぼえた`);
          this.hud.refresh();
        }
        if (res.flavor) this.dlg.say([{ speaker: 'system', text: res.flavor }]);
        const handled = this.effects.apply(res.glyph, targetId, this);
        if (!handled) {
          this.ctx.audio.se('fail');
          this.sayKey('naming_mismatch', { GLYPH: res.glyph });
        } else {
          this.ctx.audio.solveJingle();
        }
      },
    });
  }

  // ---------------------------------------------------------- markers / guide

  private updateMarkersAndGuide(): void {
    const lines: string[] = [];
    let nameable = false;
    for (const [id, it] of this.inter) {
      if (!it.def.nameable || it.done) {
        it.nameless?.setMarkerVisible(false);
        it.marker?.setVisible(false);
        continue;
      }
      const d = this.reachScore(it);
      const near = d < 150;
      it.nameless?.setMarkerVisible(near);
      it.marker?.setVisible(near);
      if (d < NAMING_RADIUS) nameable = true;
      void id;
    }
    if (this.boss.isFighting() && this.playerIn(BOSS_ARENA) && this.boss.canName()) nameable = true;

    if (this.dlg.busy || this.cutscene) {
      this.hud.setGuide([]);
      return;
    }
    if (this.nearestNpc(60)) lines.push('E はなす');
    else if (this.nearestFragment(52)) lines.push('E ひろう');
    else {
      const dev = this.nearestDevice(INTERACT_RADIUS + 12);
      if (dev === 'bell') lines.push('E かねを ならす');
      else if (dev === 'bench1' || dev === 'bench2') {
        if (this.ctx.flags.has(`${dev}_built`)) lines.push('E ひとやすみ');
      } else if (dev) lines.push('E しらべる');
    }
    if (this.findListenTarget()) lines.push('Q きき診（ながおし）');
    if (nameable) lines.push('Space なづけ');
    this.hud.setGuide(lines);
  }

  // ============================================================ WorldApi

  sayKey(key: string, replace?: Record<string, string>, onDone?: () => void): void {
    const lines = DIALOGUES[key];
    if (!lines) {
      onDone?.();
      return;
    }
    const mapped: DialogueLine[] = lines.map((l) => {
      let text = fillName(l.text, this.ctx.playerName);
      if (replace) {
        for (const [k, v] of Object.entries(replace)) text = text.replace(`{${k}}`, v);
      }
      return { speaker: l.speaker, text };
    });
    this.dlg.say(mapped, onDone);
  }

  toast(text: string): void {
    this.hud.toast(text);
  }

  gainGem(): void {
    this.ctx.inv.gems = Math.min(3, this.ctx.inv.gems + 1);
    this.toast(`玉を みつけた（${this.ctx.inv.gems}/3）`);
    this.hud.refresh();
  }

  setFlag(flag: string): void {
    this.ctx.flags.set(flag);
  }

  hasFlag(flag: string): boolean {
    return this.ctx.flags.has(flag);
  }

  playSe(name: string): void {
    this.ctx.audio.se(name);
  }

  playerPos(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  beginCutscene(): void {
    this.cutscene = true;
  }

  endCutscene(): void {
    this.cutscene = false;
  }

  /** ボス戦中の赤いビネット */
  setBattleVeil(on: boolean): void {
    if (on && !this.battleVeil) {
      this.battleVeil = this.add
        .image(480, 270, 'vignette')
        .setScrollFactor(0)
        .setDepth(1490)
        .setDisplaySize(960, 540)
        .setTint(0xb03030)
        .setAlpha(0);
      this.tweens.add({ targets: this.battleVeil, alpha: { from: 0, to: 0.3 }, duration: 900, yoyo: true, repeat: -1 });
    } else if (!on && this.battleVeil) {
      const veil = this.battleVeil;
      this.battleVeil = null;
      this.tweens.killTweensOf(veil);
      this.tweens.add({ targets: veil, alpha: 0, duration: 600, onComplete: () => veil.destroy() });
    }
  }

  musicStinger(descend = false): void {
    this.ctx.music.stinger(descend);
  }

  setBossGate(on: boolean): void {
    this.gateWall.setVisible(on);
    (this.gateWall.body as Phaser.Physics.Arcade.StaticBody).enable = on;
  }

  showFormula(text: string): void {
    const t = this.add
      .text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y - 80, text, {
        fontFamily: FONT, fontSize: '40px', color: '#B03030',
      })
      .setOrigin(0.5)
      .setDepth(870)
      .setAlpha(0)
      .setResolution(2);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 300,
      yoyo: true,
      hold: 1100,
      onComplete: () => t.destroy(),
    });
  }

  spawnFragment(glyph: string, x: number, y: number): void {
    inkBurst(this, x, y, { n: 10, color: 0xb03030 });
    this.spawnFragmentSprite(`dyn_${glyph}`, glyph, x, y);
  }

  tryHitPlayer(time: number, fromX: number, fromY: number): boolean {
    if (this.cutscene || time < this.player.invulnUntil) return false;
    this.player.knockback(fromX, fromY, time);
    this.cameras.main.flash(140, 190, 60, 50);
    this.cameras.main.shake(120, 0.004);
    this.ctx.audio.se('thud');
    return true;
  }

  // ---- 効果ハンドラ実装（§8-4） ----

  lightHearth(): void {
    this.setFlag('p0_done');
    const it = this.inter.get('kamado');
    if (it) {
      it.done = true;
      it.nameless?.dissolve(() => {
        this.namedVisuals.set('kamado', makeKamadoNamed(this, 840, 880));
      });
      it.nameless = undefined;
    }
    this.colorSys.colorize(this, 'villager_a');
    this.time.delayedCall(1100, () => {
      this.sayKey('kotono_after_p0', undefined, () => {
        if (this.ctx.inv.add('点')) this.hud.refresh();
      });
    });
  }

  applyLightOrb(): void {
    this.setFlag('p1_done');
    const it = this.inter.get('darkness');
    if (it && !it.done) {
      it.done = true;
      it.nameless?.dissolve();
      it.nameless = undefined;
    }
    if (!this.lightOrb) {
      this.lightOrb = this.add
        .image(this.player.x, this.player.y - 30, 'glow')
        .setScale(2.6)
        .setTint(0xfff0c0)
        .setAlpha(0.55)
        .setDepth(595);
    }
    if (this.darkRT) {
      const rt = this.darkRT;
      this.darkRT = null;
      this.tweens.add({ targets: rt, alpha: 0, duration: 900, onComplete: () => rt.destroy() });
    }
    this.sayKey('dark_lit');
  }

  buildBridge(): void {
    this.setFlag('p2_bridge');
    const it = this.inter.get('driftwood');
    if (it) {
      it.done = true;
      it.nameless?.dissolve(() => {
        this.namedVisuals.set('driftwood', makeBridge(this, 2030, 1300));
      });
      it.nameless = undefined;
    }
    (this.riverMidWall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.toast('むこう岸へ わたれるように なった');
  }

  buildBench(benchId: string): void {
    this.setFlag(`${benchId}_built`);
    const it = this.inter.get(benchId);
    const def = entityById(benchId);
    if (it) {
      it.done = true;
      it.marker?.destroy();
      it.marker = undefined;
    }
    this.namedVisuals.get(benchId)?.destroy();
    this.namedVisuals.set(benchId, makeBench(this, def.x, def.y));
    this.toast('やすめる ばしょが できた（E で ひとやすみ）');
  }

  transformShadowToDog(): void {
    this.setFlag('p3_done');
    const it = this.inter.get('bigshadow');
    if (it) {
      it.done = true;
      const pos = { x: it.def.x, y: it.def.y };
      it.nameless?.dissolve(() => {
        this.dog = new Dog(this, pos.x, pos.y);
        this.ctx.audio.se('bark');
        this.toast('犬が なかまに なった！');
      });
      it.nameless = undefined;
    }
    if (this.shadowWall) {
      (this.shadowWall.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.shadowWall.destroy();
      this.shadowWall = null;
    }
  }

  calmStorm(): void {
    this.setFlag('p4_done');
    const it = this.inter.get('stormwall');
    if (it) {
      it.done = true;
      it.nameless?.dissolve();
      it.nameless = undefined;
    }
    this.stormBlob = null;
    if (this.stormEmitter) {
      this.stormEmitter.stop();
      const em = this.stormEmitter;
      this.stormEmitter = null;
      this.time.delayedCall(900, () => em.destroy());
    }
    this.ctx.audio.setWind(0);
    this.toast('かぜが やんだ。社への 道が ひらけた');
  }

  birdRise(): void {
    this.setFlag('s1_done');
    const it = this.inter.get('crow');
    if (it) {
      it.done = true;
      it.marker?.destroy();
      it.marker = undefined;
    }
    this.namedVisuals.get('crow')?.destroy();
    this.ctx.audio.se('bird');
    this.time.delayedCall(200, () => this.ctx.audio.se('bird'));
    this.makeBirdAtWell(true);
    this.gainGem();
    const f = this.fragments.get('mizu');
    if (f) {
      f.hidden = false;
      f.cont.setVisible(true);
      inkBurst(this, f.cont.x, f.cont.y, { n: 8, color: 0x8ec0c8 });
    }
    this.dlg.say([{ speaker: 'system', text: '鳥は うれしそうに 井戸の ほうへ 飛んでいった。' }]);
  }

  private makeBirdAtWell(fly: boolean): void {
    const crowDef = entityById('crow');
    const wellDef = entityById('well');
    const bird = this.add
      .text(fly ? crowDef.x : wellDef.x + 40, fly ? crowDef.y - 20 : wellDef.y - 30, '鳥', {
        fontFamily: FONT, fontSize: '34px', color: '#3A5A80',
      })
      .setOrigin(0.5)
      .setDepth(610)
      .setResolution(2);
    this.tweens.add({ targets: bird, scaleY: { from: 0.85, to: 1.1 }, duration: 300, yoyo: true, repeat: -1 });
    if (fly) {
      this.tweens.add({
        targets: bird,
        x: wellDef.x + 40,
        y: wellDef.y - 30,
        duration: 2200,
        ease: 'Sine.easeInOut',
      });
    }
  }

  statueGem(): void {
    this.setFlag('s2_done');
    const it = this.inter.get('king_statue');
    if (it) {
      it.done = true;
      it.marker?.destroy();
      it.marker = undefined;
    }
    const def = entityById('king_statue');
    const gem = this.add.circle(def.x + 12, def.y - 20, 6, COLORS.gold).setDepth(620);
    this.tweens.add({
      targets: gem,
      x: this.player.x,
      y: this.player.y,
      duration: 700,
      ease: 'Cubic.easeIn',
      delay: 300,
      onComplete: () => gem.destroy(),
    });
    this.gainGem();
  }

  fillWell(): void {
    this.setFlag('s3_done');
    const it = this.inter.get('well');
    if (it) {
      it.done = true;
      it.marker?.destroy();
      it.marker = undefined;
    }
    const well = this.namedVisuals.get('well');
    if (well) this.fillWellVisual(well, true);
    this.colorSys.colorize(this, 'villager_b');
    this.gainGem();
    this.sayKey('villager_b_color');
  }

  private fillWellVisual(well: Phaser.GameObjects.Container, animate = false): void {
    const water = this.add.circle(0, 0, 15, 0x6ab0c8, animate ? 0 : 0.95);
    well.add(water);
    if (animate) {
      this.tweens.add({ targets: water, fillAlpha: 0.95, duration: 900 });
    }
    const t = this.add
      .text(0, -38, '水', { fontFamily: FONT, fontSize: '20px', color: '#3A7A9A' })
      .setOrigin(0.5)
      .setResolution(2);
    well.add(t);
    this.tweens.add({ targets: t, y: -45, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.wellWater = water;
  }

  showBook(): void {
    this.setFlag('tree_done');
    const it = this.inter.get('old_tree');
    if (it) {
      it.done = true;
      it.marker?.destroy();
      it.marker = undefined;
    }
    const tree = this.namedVisuals.get('old_tree');
    if (tree) this.addBookFloat(tree);
    this.sayKey('book_lore');
  }

  private addBookFloat(tree: Phaser.GameObjects.Container): void {
    const t = this.add
      .text(0, -120, '本', { fontFamily: FONT, fontSize: '24px', color: '#7A5A38' })
      .setOrigin(0.5)
      .setResolution(2);
    tree.add(t);
    this.tweens.add({ targets: t, y: -128, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  bossFireNamed(): void {
    this.boss.onFireNamed();
  }

  /** 灯 → RESOLVE（§10 Phase3）: 時止め→灯籠→彩色クライマックス→エンドカードへ */
  bossLanternResolve(): void {
    this.beginCutscene();
    this.setFlag('boss_done');
    const lanternPos = { x: 1480, y: 234 };
    this.boss.beginResolve();
    this.setBattleVeil(false);
    this.boss.convergeTo(lanternPos.x, lanternPos.y - 10, () => {
      const lantern = makeLantern(this, lanternPos.x, lanternPos.y);
      lantern.setScale(0);
      this.tweens.add({ targets: lantern, scale: 1, duration: 500, ease: 'Back.easeOut' });
      this.ctx.audio.se('bell');
      // 灯籠から光の柱が立ちのぼる
      const pillar = this.add
        .image(lanternPos.x, lanternPos.y - 240, 'glow')
        .setDisplaySize(110, 540)
        .setTint(0xffe0a0)
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(840);
      this.tweens.add({
        targets: pillar,
        alpha: { from: 0, to: 0.75 },
        duration: 700,
        yoyo: true,
        hold: 600,
        onComplete: () => pillar.destroy(),
      });
      this.time.delayedCall(900, () => this.colorizeAllSequence(() => this.afterColorize()));
    });
  }

  private colorizeAllSequence(onDone: () => void): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    this.ctx.audio.se('colorize');
    let i = 0;
    // pan のコールバック連鎖は完了タイミングの競合で次の pan が無視されることがあるため、
    // delayedCall ＋ force=true の決定的なチェーンにする（§16）
    const step = (): void => {
      if (i >= COLORIZE_PAN.length) {
        this.colorSys.colorizeAllRemaining(this);
        cam.flash(400, 255, 255, 255);
        this.ctx.audio.startBreeze();
        cam.pan(this.player.x, this.player.y, 700, 'Sine.easeInOut', true);
        this.time.delayedCall(760, () => {
          cam.startFollow(this.player, true, 0.12, 0.12);
          onDone();
        });
        return;
      }
      const pt = COLORIZE_PAN[i++];
      cam.pan(pt.x, pt.y, 480, 'Sine.easeInOut', true);
      this.time.delayedCall(510, () => {
        this.colorSys.colorizeZone(this, pt.zone);
        this.ctx.audio.se('colorize');
        step();
      });
    };
    step();
  }

  private afterColorize(): void {
    this.plaqueText.setText('灯し村').setFontSize(15).setColor('#B03030');
    this.hud.revealSister();
    this.startCelebration();
    this.sayKey('boss_resolve', undefined, () => {
      this.sayKey('sister_voice', { SISTER: SISTER_NAME }, () => {
        this.time.delayedCall(1300, () => {
          inkCover(this, () => this.scene.start('EndCard'));
        });
      });
    });
  }

  /** 彩色後の世界 — 花弁が舞い、鳥が空を渡る */
  private startCelebration(): void {
    this.ctx.music.setMood('celebrate');
    this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => {
        const view = this.cameras.main.worldView;
        const x = view.x + Math.random() * view.width;
        const y = view.y - 16;
        const p = this.add
          .image(x, y, 'petal')
          .setDepth(545)
          .setAlpha(0.95)
          .setAngle(Math.random() * 360)
          .setScale(0.8 + Math.random() * 0.5);
        this.tweens.add({
          targets: p,
          x: x - 130 - Math.random() * 130,
          y: y + view.height + 60,
          angle: p.angle + 380,
          duration: 6600 + Math.random() * 2600,
          ease: 'Sine.easeIn',
          onComplete: () => p.destroy(),
        });
      },
    });
    this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => {
        const view = this.cameras.main.worldView;
        for (let i = 0; i < 3; i++) {
          const bird = this.add
            .text(view.x - 60 - i * 50, view.y + 70 + i * 26, '鳥', {
              fontFamily: FONT, fontSize: `${18 - i * 3}px`, color: '#3A5A80',
            })
            .setDepth(546)
            .setAlpha(0.75)
            .setResolution(2);
          this.tweens.add({ targets: bird, scaleY: { from: 0.8, to: 1.1 }, duration: 260, yoyo: true, repeat: -1 });
          this.tweens.add({
            targets: bird,
            x: view.x + view.width + 80,
            y: bird.y - 50,
            duration: 9000 + i * 700,
            onComplete: () => bird.destroy(),
          });
        }
        this.ctx.audio.se('bird');
      },
    });
  }

  // ============================================================ util

  private playerIn(r: Rect): boolean {
    return (
      this.player.x >= r.x && this.player.x <= r.x + r.w && this.player.y >= r.y && this.player.y <= r.y + r.h
    );
  }

  private setupDebug(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    DEBUG_SPOTS.forEach((s) => {
      kb.on(`keydown-${s.key}`, () => {
        this.player.setPosition(s.x, s.y);
        this.toast(`[debug] ${s.label}`);
      });
    });
    kb.on('keydown-G', () => {
      for (const g of ['人', '火', '日', '月', '木', '点', '止', '一', '水', '丁', '明', '休', '犬', '凪', '鳥', '玉', '本']) {
        this.ctx.inv.add(g);
      }
      this.hud.refresh();
      this.toast('[debug] 全語彙を付与');
    });
  }
}
