// 全テクスチャを起動時に Phaser Graphics で生成する (§5)。
// 外部画像ファイルを使わない理由: 権利リスクをゼロにし、
// 本編でドット絵素材に差し替えるときも「テクスチャキーが同じなら動く」状態を保つため。
import Phaser from "phaser";
import { PAL } from "./palette";
import type { NpcDef } from "../types";

function rect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number) {
  g.fillStyle(c, 1);
  g.fillRect(x, y, w, h);
}

// ---- タイルセット ----
// 凡例は gfx/tileLegend.ts（Node の検証スクリプトと共有）
export { CHAR_TO_TILE, TILE_COUNT, COLLIDING_TILES } from "./tileLegend";
import { TILE_COUNT } from "./tileLegend";

export function generateTiles(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.setVisible(false);

  const grassBase = (ox: number) => {
    rect(g, ox, 0, 16, 16, PAL.wakaba);
    rect(g, ox + 3, 4, 1, 1, PAL.midori);
    rect(g, ox + 11, 9, 1, 1, PAL.midori);
    rect(g, ox + 6, 12, 1, 1, PAL.midori);
  };

  for (let i = 0; i < TILE_COUNT; i++) {
    const ox = i * 16;
    switch (i) {
      case 0:
        grassBase(ox);
        break;
      case 1:
        grassBase(ox);
        rect(g, ox + 4, 7, 1, 1, PAL.shiro);
        rect(g, ox + 12, 3, 1, 1, PAL.shiro);
        rect(g, ox + 9, 13, 1, 1, PAL.shiro);
        break;
      case 2:
        rect(g, ox, 0, 16, 16, PAL.tsuchi);
        rect(g, ox + 2, 3, 2, 1, PAL.kotsuchi);
        rect(g, ox + 10, 8, 2, 1, PAL.kotsuchi);
        rect(g, ox + 5, 13, 2, 1, PAL.kotsuchi);
        break;
      case 3:
        rect(g, ox, 0, 16, 16, PAL.sora);
        rect(g, ox + 1, 4, 5, 1, PAL.fukasora);
        rect(g, ox + 9, 10, 5, 1, PAL.fukasora);
        rect(g, ox + 6, 14, 4, 1, PAL.fukasora);
        rect(g, ox + 12, 2, 1, 1, PAL.shiro);
        break;
      case 4: // 花（E0 の最初のことば「はな」の主役なので少し豪華に）
        grassBase(ox);
        rect(g, ox + 7, 9, 2, 4, PAL.midori);
        rect(g, ox + 6, 4, 4, 4, PAL.momo);
        rect(g, ox + 5, 5, 6, 2, PAL.momo);
        rect(g, ox + 7, 5, 2, 2, PAL.komomo);
        rect(g, ox + 4, 11, 2, 1, PAL.midori);
        break;
      case 5: // 木
        grassBase(ox);
        rect(g, ox + 6, 10, 4, 5, PAL.kotsuchi);
        rect(g, ox + 2, 2, 12, 9, PAL.midori);
        rect(g, ox + 3, 1, 10, 1, PAL.midori);
        rect(g, ox + 3, 2, 4, 2, PAL.wakaba);
        break;
      case 6: // 柵
        grassBase(ox);
        rect(g, ox, 5, 16, 2, PAL.kotsuchi);
        rect(g, ox, 10, 16, 2, PAL.kotsuchi);
        rect(g, ox + 2, 3, 2, 11, PAL.kotsuchi);
        rect(g, ox + 12, 3, 2, 11, PAL.kotsuchi);
        break;
      case 7: // 岩
        grassBase(ox);
        rect(g, ox + 3, 6, 10, 8, PAL.tsuchi);
        rect(g, ox + 4, 4, 8, 3, PAL.tsuchi);
        rect(g, ox + 4, 12, 9, 2, PAL.kotsuchi);
        rect(g, ox + 5, 5, 3, 2, PAL.shiro);
        break;
      case 8: // かべ
        rect(g, ox, 0, 16, 16, PAL.shiro);
        rect(g, ox, 0, 16, 1, PAL.kotsuchi);
        rect(g, ox, 14, 16, 2, PAL.tsuchi);
        rect(g, ox + 7, 2, 1, 12, PAL.kotsuchi);
        break;
      case 9: // 屋根
        rect(g, ox, 0, 16, 16, PAL.yamabuki);
        rect(g, ox, 3, 16, 1, PAL.ki);
        rect(g, ox, 8, 16, 1, PAL.ki);
        rect(g, ox, 13, 16, 1, PAL.ki);
        rect(g, ox, 15, 16, 1, PAL.kotsuchi);
        break;
      case 10: // とびら
        rect(g, ox, 0, 16, 16, PAL.shiro);
        rect(g, ox + 3, 2, 10, 14, PAL.kotsuchi);
        rect(g, ox + 4, 3, 8, 12, PAL.tsuchi);
        rect(g, ox + 10, 9, 2, 2, PAL.ki);
        break;
      case 11: // たて看板
        grassBase(ox);
        rect(g, ox + 7, 8, 2, 7, PAL.kotsuchi);
        rect(g, ox + 2, 2, 12, 7, PAL.tsuchi);
        rect(g, ox + 2, 2, 12, 1, PAL.kotsuchi);
        rect(g, ox + 2, 8, 12, 1, PAL.kotsuchi);
        rect(g, ox + 4, 4, 8, 1, PAL.kuro);
        rect(g, ox + 4, 6, 6, 1, PAL.kuro);
        break;
      case 12: // けいじばん（はり紙3枚）
        grassBase(ox);
        rect(g, ox + 1, 1, 14, 11, PAL.kotsuchi);
        rect(g, ox + 2, 2, 12, 9, PAL.tsuchi);
        rect(g, ox + 3, 3, 3, 4, PAL.shiro);
        rect(g, ox + 7, 4, 3, 5, PAL.shiro);
        rect(g, ox + 11, 3, 2, 3, PAL.shiro);
        rect(g, ox + 2, 12, 2, 3, PAL.kotsuchi);
        rect(g, ox + 12, 12, 2, 3, PAL.kotsuchi);
        break;
      case 13: // はたけ
        rect(g, ox, 0, 16, 16, PAL.tsuchi);
        rect(g, ox, 3, 16, 1, PAL.kotsuchi);
        rect(g, ox, 8, 16, 1, PAL.kotsuchi);
        rect(g, ox, 13, 16, 1, PAL.kotsuchi);
        rect(g, ox + 3, 5, 1, 2, PAL.wakaba);
        rect(g, ox + 9, 10, 1, 2, PAL.wakaba);
        rect(g, ox + 13, 5, 1, 2, PAL.wakaba);
        break;
      case 14: // 橋
        rect(g, ox, 0, 16, 16, PAL.sora);
        rect(g, ox, 2, 16, 12, PAL.tsuchi);
        rect(g, ox, 5, 16, 1, PAL.kotsuchi);
        rect(g, ox, 9, 16, 1, PAL.kotsuchi);
        rect(g, ox, 2, 16, 1, PAL.kotsuchi);
        rect(g, ox, 13, 16, 1, PAL.kotsuchi);
        break;
      case 15: // ほしみだいの床（うす紫の石畳）
        rect(g, ox, 0, 16, 16, PAL.shiro);
        rect(g, ox, 7, 16, 1, PAL.fuji);
        rect(g, ox + 7, 0, 1, 7, PAL.fuji);
        rect(g, ox + 3, 8, 1, 8, PAL.fuji);
        rect(g, ox + 12, 11, 1, 1, PAL.hikari);
        break;
      case 16: // 階段
        rect(g, ox, 0, 16, 16, PAL.shiro);
        for (let y = 1; y < 16; y += 4) rect(g, ox, y, 16, 1, PAL.fuji);
        break;
      case 17: // 闇
        rect(g, ox, 0, 16, 16, PAL.yoru);
        rect(g, ox + 8, 6, 1, 1, PAL.kofuji);
        break;
      case 18: // 明るい草（はじまりの丘の誕生地点）
        rect(g, ox, 0, 16, 16, PAL.wakaba);
        rect(g, ox + 5, 3, 1, 1, PAL.ki);
        rect(g, ox + 11, 8, 1, 1, PAL.ki);
        rect(g, ox + 3, 12, 1, 1, PAL.shiro);
        break;
      case 19: // しげみ
        grassBase(ox);
        rect(g, ox + 1, 4, 14, 10, PAL.midori);
        rect(g, ox + 2, 3, 12, 1, PAL.midori);
        rect(g, ox + 3, 5, 4, 2, PAL.wakaba);
        break;
    }
  }
  g.generateTexture("tiles", TILE_COUNT * 16, 16);
  g.destroy();
}

// ---- キャラクター（16×16・2フレーム） ----
type Look = NpcDef["look"];

function drawCritter(g: Phaser.GameObjects.Graphics, look: Look, frame: number) {
  const body = PAL[look.body];
  const bob = frame === 1 ? 1 : 0; // 2フレームの「ぴょこぴょこ」歩き (§5.2)
  const by = 5 + bob;

  // しっぽは体より先に描く（背面に見せるため）
  if (look.tail === "big") {
    rect(g, 12, by - 3, 4, 9, body);
    rect(g, 13, by - 4, 2, 2, body);
    rect(g, 13, by, 2, 3, PAL.shiro);
  } else if (look.tail === "fluffy") {
    rect(g, 12, by + 2, 4, 5, body);
    rect(g, 13, by + 5, 3, 2, PAL.shiro);
  } else if (look.tail === "small") {
    rect(g, 13, by + 3, 2, 2, body);
  }

  // 耳・羽角
  if (look.ear === "long") {
    rect(g, 4, by - 5, 2, 6, body);
    rect(g, 10, by - 5, 2, 6, body);
  } else if (look.ear === "round") {
    rect(g, 3, by - 2, 3, 3, body);
    rect(g, 10, by - 2, 3, 3, body);
  } else if (look.ear === "pointy") {
    rect(g, 4, by - 3, 2, 4, body);
    rect(g, 5, by - 4, 1, 1, body);
    rect(g, 10, by - 3, 2, 4, body);
    rect(g, 10, by - 4, 1, 1, body);
  } else if (look.ear === "tuft") {
    rect(g, 4, by - 3, 1, 3, body);
    rect(g, 11, by - 3, 1, 3, body);
  }

  // 体（角を欠いた丸っこいブロック）
  rect(g, 4, by, 8, 9, body);
  rect(g, 3, by + 1, 10, 7, body);
  // 足（フレームで左右に揺れる）
  rect(g, 5 + (frame === 1 ? 1 : 0), by + 9, 2, 1, body);
  rect(g, 9 - (frame === 1 ? 1 : 0), by + 9, 2, 1, body);

  if (look.wing) {
    rect(g, 2, by + 3, 2, 4, PAL.shiro);
    rect(g, 12, by + 3, 2, 4, PAL.shiro);
  }

  // 目（くろ2点）。これが「どの動物にも見える」最低限の記号 (§5.2)
  rect(g, 5, by + 3, 2, 2, PAL.kuro);
  rect(g, 9, by + 3, 2, 2, PAL.kuro);
}

export function generateCritter(scene: Phaser.Scene, key: string, look: Look) {
  for (const frame of [0, 1]) {
    const g = scene.add.graphics();
    g.setVisible(false);
    drawCritter(g, look, frame);
    g.generateTexture(`${key}_${frame}`, 16, 16);
    g.destroy();
  }
}

// ---- 顔アイコン（24×24・会話ウィンドウ用 §4.3） ----
export function generateFace(scene: Phaser.Scene, key: string, look: Look | "kamisama") {
  const g = scene.add.graphics();
  g.setVisible(false);
  if (look === "kamisama") {
    // かみさまは「顔がない」。夜色の枠にひかりの点だけ
    rect(g, 0, 0, 24, 24, PAL.yoru);
    rect(g, 11, 11, 2, 2, PAL.hikari);
  } else {
    const body = PAL[look.body];
    rect(g, 0, 0, 24, 24, PAL.shiro);
    if (look.ear === "long") {
      rect(g, 5, 1, 3, 8, body);
      rect(g, 16, 1, 3, 8, body);
    } else if (look.ear === "round") {
      rect(g, 3, 4, 4, 4, body);
      rect(g, 17, 4, 4, 4, body);
    } else if (look.ear === "pointy") {
      rect(g, 4, 2, 3, 6, body);
      rect(g, 17, 2, 3, 6, body);
    } else if (look.ear === "tuft") {
      rect(g, 5, 2, 2, 4, body);
      rect(g, 17, 2, 2, 4, body);
    }
    rect(g, 4, 7, 16, 14, body);
    rect(g, 3, 9, 18, 10, body);
    rect(g, 8, 12, 2, 3, PAL.kuro);
    rect(g, 14, 12, 2, 3, PAL.kuro);
    rect(g, 11, 17, 2, 1, PAL.kuro);
    // ふちどり
    rect(g, 0, 0, 24, 1, PAL.kuro);
    rect(g, 0, 23, 24, 1, PAL.kuro);
    rect(g, 0, 0, 1, 24, PAL.kuro);
    rect(g, 23, 0, 1, 24, PAL.kuro);
  }
  g.generateTexture(key, 24, 24);
  g.destroy();
}

// ---- そのほかの小物 ----
export function generateMisc(scene: Phaser.Scene) {
  // 感情アイコン (§4.4): いかり / かなしみ / いじ
  let g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 2, 2, 3, 3, PAL.komomo);
  rect(g, 7, 1, 3, 3, PAL.komomo);
  rect(g, 4, 6, 3, 3, PAL.komomo);
  rect(g, 9, 6, 2, 2, PAL.komomo);
  g.generateTexture("emo_anger", 12, 12);
  g.destroy();

  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 5, 1, 2, 3, PAL.sora);
  rect(g, 4, 4, 4, 4, PAL.sora);
  rect(g, 3, 6, 6, 3, PAL.fukasora);
  g.generateTexture("emo_sadness", 12, 12);
  g.destroy();

  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 2, 2, 8, 8, PAL.kuro);
  rect(g, 4, 4, 4, 4, PAL.kotsuchi);
  g.generateTexture("emo_stubborn", 12, 12);
  g.destroy();

  // パーティクル
  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 1, 0, 2, 2, PAL.komomo);
  rect(g, 4, 0, 2, 2, PAL.komomo);
  rect(g, 0, 1, 7, 2, PAL.komomo);
  rect(g, 1, 3, 5, 1, PAL.komomo);
  rect(g, 2, 4, 3, 1, PAL.komomo);
  rect(g, 3, 5, 1, 1, PAL.komomo);
  g.generateTexture("p_heart", 7, 6);
  g.destroy();

  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 2, 0, 1, 5, PAL.ki);
  rect(g, 0, 2, 5, 1, PAL.ki);
  rect(g, 1, 1, 3, 3, PAL.ki);
  g.generateTexture("p_star", 5, 5);
  g.destroy();

  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 0, 0, 2, 2, PAL.hikari);
  g.generateTexture("p_spark", 2, 2);
  g.destroy();

  // きつねのこの涙（reveal_sad の差分 §4.5）
  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 0, 0, 1, 2, PAL.sora);
  rect(g, 2, 1, 1, 2, PAL.sora);
  g.generateTexture("tear", 3, 3);
  g.destroy();

  // 森はずれの木（きつねのこの定位置・少し特別な見た目）
  g = scene.add.graphics();
  g.setVisible(false);
  rect(g, 12, 26, 8, 14, PAL.kotsuchi);
  rect(g, 10, 36, 12, 2, PAL.kotsuchi);
  rect(g, 2, 4, 28, 22, PAL.midori);
  rect(g, 4, 2, 24, 2, PAL.midori);
  rect(g, 5, 5, 8, 4, PAL.wakaba);
  rect(g, 6, 8, 2, 2, PAL.momo);
  rect(g, 22, 12, 2, 2, PAL.momo);
  rect(g, 14, 6, 2, 2, PAL.momo);
  rect(g, 10, 18, 2, 2, PAL.momo);
  g.generateTexture("bigtree", 32, 40);
  g.destroy();
}
