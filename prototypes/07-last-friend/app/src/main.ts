// エントリポイント。320×180 の内部解像度を「整数倍」だけで拡大する (§1)。
// 整数倍にこだわる理由: ドットが等幅でない拡大率だと にじんで見えるため。
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { WorldScene } from "./scenes/WorldScene";
import { BattleScene } from "./scenes/BattleScene";
import { EndingScene } from "./scenes/EndingScene";
import { Sound } from "./systems/audio";
import { G } from "./systems/wordSystem";
import { Save } from "./systems/save";
import { Telemetry } from "./systems/telemetry";
import { Debug } from "./systems/debug";

const W = 320;
const H = 180;

function calcZoom(): number {
  return Math.max(1, Math.min(Math.floor(window.innerWidth / W), Math.floor(window.innerHeight / H)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: W,
  height: H,
  backgroundColor: "#15121F",
  pixelArt: true,
  roundPixels: true,
  physics: { default: "arcade" },
  scale: { mode: Phaser.Scale.NONE, zoom: calcZoom() },
  scene: [BootScene, TitleScene, WorldScene, BattleScene, EndingScene],
});

window.addEventListener("resize", () => {
  game.scale.setZoom(calcZoom());
});

// ?debug=1 のときだけ、自動テスト・デバッグ用に内部状態を覗けるようにする
// （通常ビルドの UI からは一切到達不可能 §2）
if (new URLSearchParams(location.search).get("debug") === "1") {
  void import("./ui/paletteUI").then(({ PaletteDebug }) => {
    (window as unknown as Record<string, unknown>).__LF = {
      G,
      Save,
      Telemetry,
      Debug,
      game,
      palette: PaletteDebug,
    };
  });
}

// ブラウザの自動再生制限: 最初の操作で AudioContext を起こす
const unlock = () => {
  Sound.unlock();
  window.removeEventListener("keydown", unlock);
  window.removeEventListener("pointerdown", unlock);
};
window.addEventListener("keydown", unlock);
window.addEventListener("pointerdown", unlock);

// M: ミュート切り替え（どの画面でも効く §2）
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") Sound.toggleMute();
});

// 矢印・スペースでページがスクロールしないように
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});
