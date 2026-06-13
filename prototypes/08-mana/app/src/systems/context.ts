// ゲーム全体で共有するコンテキスト（シーン間は Phaser registry 経由で受け渡す）

import Phaser from 'phaser';
import { DEFAULT_PLAYER_NAME } from '../config';
import { INITIAL_GLYPHS } from '../data/fragments';
import { RECIPES } from '../data/recipes';
import { AudioSystem } from './AudioSystem';
import { FlagManager } from './FlagManager';
import { HintSystem } from './HintSystem';
import { Inventory } from './Inventory';
import { MusicSystem } from './MusicSystem';
import { RecipeEngine } from './RecipeEngine';
import { SaveSystem, type SaveData } from './SaveSystem';

export interface Ctx {
  inv: Inventory;
  flags: FlagManager;
  engine: RecipeEngine;
  hints: HintSystem;
  audio: AudioSystem;
  music: MusicSystem;
  save: SaveSystem;
  playerName: string;
  playtime: number; // 秒
  /** つづきから開始時の復帰座標（World が消費する） */
  resumePos: { x: number; y: number } | null;
}

export function createCtx(): Ctx {
  const audio = new AudioSystem();
  const ctx: Ctx = {
    inv: new Inventory(),
    flags: new FlagManager(),
    engine: new RecipeEngine(RECIPES),
    hints: new HintSystem(),
    audio,
    music: new MusicSystem(audio),
    save: new SaveSystem(),
    playerName: DEFAULT_PLAYER_NAME,
    playtime: 0,
    resumePos: null,
  };
  ctx.inv.reset(INITIAL_GLYPHS);
  return ctx;
}

export function newGame(ctx: Ctx, name: string): void {
  ctx.inv.reset(INITIAL_GLYPHS);
  ctx.flags.reset();
  ctx.hints.reset();
  ctx.playerName = name;
  ctx.playtime = 0;
  ctx.resumePos = null;
}

export function continueGame(ctx: Ctx, data: SaveData): void {
  ctx.inv.load(data.knownGlyphs, data.gems);
  ctx.flags.load(data.flags);
  ctx.hints.load(data.hintLevels);
  ctx.playerName = data.name;
  ctx.playtime = data.playtime;
  ctx.resumePos = { ...data.pos };
}

export function getCtx(scene: Phaser.Scene): Ctx {
  return scene.registry.get('ctx') as Ctx;
}
