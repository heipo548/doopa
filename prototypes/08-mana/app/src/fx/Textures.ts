// 生成テクスチャ一式 — 外部画像を一切使わないための工房（SPEC.md §14）
// すべて canvas / Graphics から実行時に生成する。Preload で makeAllTextures() を1回呼ぶ。

import Phaser from 'phaser';
import { makeInkTextures } from './InkParticles';

export function makeAllTextures(scene: Phaser.Scene): void {
  makeInkTextures(scene); // dot8 / inkdot / glow
  if (scene.textures.exists('paper')) return;
  makePaper(scene, 'paper', [245, 240, 230], false);
  makePaper(scene, 'paperDark', [18, 15, 12], true);
  makeVignette(scene);
  makeInkBlob(scene);
  makePetal(scene);
  makeLeaf(scene);
  makeStreak(scene);
  makeFlame(scene);
  makeMist(scene);
  makeEdgeInk(scene);
}

/** 和紙: 地色＋繊維＋斑（むら） */
function makePaper(scene: Phaser.Scene, key: string, base: [number, number, number], dark: boolean): void {
  const size = 512;
  const c = scene.textures.createCanvas(key, size, size);
  if (!c) return;
  const ctx = c.getContext();
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, size, size);
  // 斑（おおきな淡いむら）
  for (let i = 0; i < 26; i++) {
    const r = 40 + Math.random() * 90;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    const tone = dark ? '255,250,240' : '110,100,84';
    g.addColorStop(0, `rgba(${tone},${dark ? 0.02 : 0.018})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.save();
    ctx.translate(Math.random() * size, Math.random() * size);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  // 微細な紙粉
  for (let i = 0; i < 1500; i++) {
    const a = 0.015 + Math.random() * 0.035;
    ctx.fillStyle =
      Math.random() < 0.5
        ? `rgba(${dark ? '235,225,205' : '96,88,72'},${a})`
        : `rgba(${dark ? '60,52,40' : '255,255,248'},${a})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random(), 1 + Math.random());
  }
  // 繊維（短い細線）
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 5 + Math.random() * 16;
    const ang = Math.random() * Math.PI;
    ctx.strokeStyle = `rgba(${dark ? '210,200,180' : '120,110,92'},${0.02 + Math.random() * 0.025})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  c.refresh();
}

/** 画面隅を落とすビネット（480x270 を拡大利用） */
function makeVignette(scene: Phaser.Scene): void {
  const w = 480;
  const h = 270;
  const c = scene.textures.createCanvas('vignette', w, h);
  if (!c) return;
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(20,16,12,0)');
  g.addColorStop(1, 'rgba(20,16,12,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  c.refresh();
}

/** 不定形の墨だまり（遷移・ナナシ用） */
function makeInkBlob(scene: Phaser.Scene): void {
  const size = 128;
  const c = scene.textures.createCanvas('inkblob', size, size);
  if (!c) return;
  const ctx = c.getContext();
  ctx.fillStyle = 'rgba(255,255,255,1)';
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2;
    const dist = 14 + Math.random() * 18;
    const r = 22 + Math.random() * 16;
    ctx.beginPath();
    ctx.arc(64 + Math.cos(ang) * dist, 64 + Math.sin(ang) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(64, 64, 34, 0, Math.PI * 2);
  ctx.fill();
  c.refresh();
}

/** 花びら */
function makePetal(scene: Phaser.Scene): void {
  const c = scene.textures.createCanvas('petal', 12, 8);
  if (!c) return;
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(6, 4, 0, 6, 4, 6);
  g.addColorStop(0, 'rgba(255,235,238,1)');
  g.addColorStop(1, 'rgba(244,180,196,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(6, 4, 5.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  c.refresh();
}

/** 葉（川流し用） */
function makeLeaf(scene: Phaser.Scene): void {
  const c = scene.textures.createCanvas('leaf', 12, 8);
  if (!c) return;
  const ctx = c.getContext();
  ctx.fillStyle = 'rgba(122,140,96,0.95)';
  ctx.beginPath();
  ctx.ellipse(6, 4, 5.5, 2.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(86,100,66,0.9)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1.5, 6);
  ctx.lineTo(10.5, 2);
  ctx.stroke();
  c.refresh();
}

/** 風筋・弾道用の細い線 */
function makeStreak(scene: Phaser.Scene): void {
  const c = scene.textures.createCanvas('streak', 24, 3);
  if (!c) return;
  const ctx = c.getContext();
  const g = ctx.createLinearGradient(0, 0, 24, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 3);
  c.refresh();
}

/** 火の雫（ボス弾・火の粉） */
function makeFlame(scene: Phaser.Scene): void {
  const c = scene.textures.createCanvas('flameDrop', 16, 22);
  if (!c) return;
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(8, 14, 1, 8, 13, 9);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.45, 'rgba(240,150,70,0.95)');
  g.addColorStop(1, 'rgba(176,48,32,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.quadraticCurveTo(15, 12, 8, 21);
  ctx.quadraticCurveTo(1, 12, 8, 0);
  ctx.fill();
  c.refresh();
}

/** 横にたなびく靄 */
function makeMist(scene: Phaser.Scene): void {
  const w = 256;
  const h = 64;
  const c = scene.textures.createCanvas('mist', w, h);
  if (!c) return;
  const ctx = c.getContext();
  for (let i = 0; i < 7; i++) {
    const cx = Math.random() * w;
    const cy = h / 2 + (Math.random() - 0.5) * 18;
    const r = 36 + Math.random() * 42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,252,0.45)');
    g.addColorStop(1, 'rgba(255,255,252,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  c.refresh();
}

/** 世界の縁を蝕む黙（片側グラデーション） */
function makeEdgeInk(scene: Phaser.Scene): void {
  const w = 64;
  const h = 256;
  const c = scene.textures.createCanvas('edgeInk', w, h);
  if (!c) return;
  const ctx = c.getContext();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(16,13,11,0.95)');
  g.addColorStop(0.55, 'rgba(16,13,11,0.4)');
  g.addColorStop(1, 'rgba(16,13,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 縁のささくれ（細かく・薄く）
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * h;
    const len = 2 + Math.random() * 9;
    ctx.fillStyle = `rgba(16,13,11,${0.12 + Math.random() * 0.22})`;
    ctx.fillRect(w * 0.3 + Math.random() * w * 0.45, y, len, 0.7);
  }
  c.refresh();
}
