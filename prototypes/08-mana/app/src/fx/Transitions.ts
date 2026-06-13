// 墨ワイプ画面遷移 — 墨が画面を呑み、紙に戻る（J7拡張）
// 使い方: 旧シーンで inkCover(this, () => scene.start(...)) → 新シーンの create で inkReveal(this)

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

const BLOB_N = 12;

/** 墨が広がって画面を覆う。覆い切ったら onCovered を呼ぶ */
export function inkCover(scene: Phaser.Scene, onCovered: () => void): void {
  const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(6000);
  for (let i = 0; i < BLOB_N; i++) {
    const b = scene.add
      .image(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 'inkblob')
      .setTint(0x14110e)
      .setScale(0)
      .setAlpha(0.96)
      .setAngle(Math.random() * 360);
    c.add(b);
    scene.tweens.add({
      targets: b,
      scale: 3.4 + Math.random() * 2,
      duration: 360 + Math.random() * 140,
      delay: i * 24,
      ease: 'Cubic.easeIn',
    });
  }
  const sheet = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x14110e, 0);
  c.add(sheet);
  scene.tweens.add({ targets: sheet, fillAlpha: 1, duration: 300, delay: 280 });
  scene.time.delayedCall(620, onCovered);
}

/** 墨が引いて場面が現れる（新シーン側） */
export function inkReveal(scene: Phaser.Scene, onDone?: () => void): void {
  const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(6000);
  const sheet = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x14110e, 1);
  c.add(sheet);
  const blobs: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < BLOB_N; i++) {
    const b = scene.add
      .image(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 'inkblob')
      .setTint(0x14110e)
      .setScale(3.6 + Math.random() * 2)
      .setAlpha(0.96)
      .setAngle(Math.random() * 360);
    blobs.push(b);
    c.add(b);
  }
  scene.tweens.add({ targets: sheet, fillAlpha: 0, duration: 320, delay: 60 });
  blobs.forEach((b, i) => {
    scene.tweens.add({
      targets: b,
      scale: 0,
      alpha: 0,
      duration: 430 + Math.random() * 160,
      delay: 120 + i * 26,
      ease: 'Cubic.easeOut',
    });
  });
  scene.time.delayedCall(900, () => {
    if (c.active) c.destroy();
    onDone?.();
  });
}
