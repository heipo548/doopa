// 真名 -マナ- 体験版 エントリポイント（Phaser.Game 設定のみ §4）

import Phaser from 'phaser';
import { DEBUG, GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { DialogueScene } from './scenes/DialogueScene';
import { EndCardScene } from './scenes/EndCardScene';
import { NamingOverlayScene } from './scenes/NamingOverlayScene';
import { PreloadScene } from './scenes/PreloadScene';
import { PrologueScene } from './scenes/PrologueScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0D0C0B',
  pixelArt: false, // 字の描画を滑らかに（§3）
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    PrologueScene,
    WorldScene,
    DialogueScene,
    NamingOverlayScene,
    EndCardScene,
  ],
});

// ?debug=1 のときだけ E2E スモークテスト用にゲームインスタンスを公開
if (DEBUG) {
  (window as unknown as { __mana?: Phaser.Game }).__mana = game;
}
