// 起動シーン: フォント読込 → テクスチャ生成 → データ検証 → タイトルへ。
// 未定義トークンが1つでもあればここで止める (§4.2)。誤字は起動できない、が本作の規律。
import Phaser from "phaser";
import { HEX } from "../gfx/palette";
import { generateTiles, generateCritter, generateFace, generateMisc } from "../gfx/sprites";
import { NPCS } from "../data/npcs";
import { validateData } from "../systems/validate";
import { Telemetry } from "../systems/telemetry";
import { Debug } from "../systems/debug";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  async create() {
    const loading = this.add
      .text(160, 90, "よみこみちゅう…", { fontSize: "12px", color: HEX.shiro })
      .setOrigin(0.5);

    // フォントは必ずローカル同梱の woff2 から読む（CDN 禁止 §1）
    try {
      const url = `${import.meta.env.BASE_URL}fonts/DotGothic16-Regular.woff2`;
      const face = new FontFace("DotGothic16", `url(${url})`);
      await face.load();
      document.fonts.add(face);
    } catch (e) {
      // フォントが読めなくてもゲームは止めない（システムフォントで続行）
      console.warn("font load failed", e);
    }

    // 全テクスチャを実行時生成（外部画像ゼロ §5）
    generateTiles(this);
    generateMisc(this);
    generateCritter(this, "player", { body: "shiro", ear: "none", tail: "none" });
    generateFace(this, "face_player", { body: "shiro", ear: "none", tail: "none" });
    generateFace(this, "face_kamisama", "kamisama");
    for (const npc of Object.values(NPCS)) {
      generateCritter(this, `npc_${npc.id}`, npc.look);
      generateFace(this, `face_${npc.id}`, npc.look);
    }

    // データ検証。エラーがあれば画面に出して起動を止める
    const errors = validateData();
    if (errors.length > 0) {
      loading.destroy();
      this.add
        .text(8, 8, "データエラー（しゅうせい してください）", {
          fontFamily: "DotGothic16",
          fontSize: "16px",
          color: "#FF6FA5",
        })
        .setResolution(1);
      this.add
        .text(8, 28, errors.slice(0, 8).join("\n"), {
          fontSize: "10px",
          color: HEX.shiro,
          wordWrap: { width: 304 },
        });
      console.error(errors);
      return;
    }

    Telemetry.start();
    Debug.init();
    this.scene.start("Title");
  }
}
