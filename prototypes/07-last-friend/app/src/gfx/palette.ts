// §5.1 固定16色パレット。体験版で使ってよい色はこの16色だけ。
// 色をデータで縛る理由: ドット絵の統一感を保ち、本編で差し替えるときも
// このファイルだけ直せば全画面に反映されるようにするため。
export const PAL = {
  shiro: 0xfff6f9, // 背景・ウィンドウ地
  kuro: 0x4a4357, // 文字・輪郭
  momo: 0xff9ec4, // 花・アクセント
  komomo: 0xff6fa5, // 花芯・ハート
  sora: 0x7ec8ff, // 空・水
  fukasora: 0x3a93d8, // 川・影
  ki: 0xffd86b, // 灯り・パン
  yamabuki: 0xf0a830, // 屋根・どんぐり
  wakaba: 0x9be7a8, // 草地
  midori: 0x3da259, // 木・茂み
  fuji: 0xc9a6ff, // 夕方・魔法時
  kofuji: 0x8a5cf0, // 夜の差し色
  tsuchi: 0x8a6f5c, // 道・土
  kotsuchi: 0x5c4a3d, // 幹・柵
  yoru: 0x15121f, // 夜・神様シーン地
  hikari: 0xb388ff, // 習得演出・？？？
} as const;

export type PalName = keyof typeof PAL;

// Phaser の Text は CSS 形式の色文字列が必要なので、数値→ "#RRGGBB" に変換して持つ
export const HEX: Record<PalName, string> = Object.fromEntries(
  Object.entries(PAL).map(([k, v]) => [k, "#" + v.toString(16).padStart(6, "0")])
) as Record<PalName, string>;
