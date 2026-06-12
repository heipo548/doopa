// BootScene — コンテキスト初期化のみ

import Phaser from 'phaser';
import { createCtx } from '../systems/context';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.registry.set('ctx', createCtx());
    // オーバーレイ表示中の下層入力貫通を防ぐ（SPEC.md §16）
    this.input.setTopOnly(true);
    this.scene.start('Preload');
  }
}
