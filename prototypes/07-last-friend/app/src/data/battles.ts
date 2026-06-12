// E3「りす × ふくろう の どんぐり論争」の口げんかバトルデータ (§4.4)。
// 体験版の戦闘はこの1戦だけだが、システムは完全データ駆動
// （本編15戦は battles にデータを足すだけで増やせる）。
//
// 数値設計メモ: ゲージ 50 開始。各フェーズの突破値は 65 / 80 / 100。
// 良い言葉 +8〜12、まあまあ +4〜6、場ちがいな名詞は小さく効くか笑いになる
// (GAME_DESIGN §7.2)。dark は大きくマイナス。数値は画面に出さない。
import type { Battle } from "../types";

export const BATTLES: Record<string, Battle> = {
  e3: {
    id: "e3",
    opponents: ["fukurou", "risu"],
    gaugeStart: 50,
    gaugeMax: 100,
    winNode: "e3_win1",
    retryNode: "e3_retry",
    phases: [
      {
        emotion: "anger",
        speaker: "fukurou",
        line: "わしが さきに みつけたのじゃ！ {donguri}は わしのじゃ！",
        matrix: {
          daijoubu: 10,
          gomenne: 8,
          konnichiwa: 7,
          pan: 9, // 場ちがいな名詞 → ふくろうが思わず笑う
          oishii: 8,
          suki: 6,
          mukashi: 5,
          uso: -12,
        },
        categoryMatrix: { kind: 6, world: 4, sad: 2, dark: -10 },
        clearAt: 65,
      },
      {
        emotion: "sadness",
        speaker: "risu",
        line: "だって･･･ ふゆの ごはんが なくなっちゃう、なの･･･",
        matrix: {
          daijoubu: 12,
          pan: 10, // 「ごはんなら ある」が いちばん効く
          suki: 8,
          oishii: 7,
          omoide: 6,
          gomenne: 6,
          mukashi: 4,
          uso: -12,
        },
        categoryMatrix: { kind: 6, world: 3, sad: 8, dark: -10 },
        clearAt: 80,
      },
      {
        emotion: "stubborn",
        speaker: "fukurou",
        line: "む､むう｡ いまさら ひっこみが つかんのじゃ･･･",
        matrix: {
          gomenne: 12,
          mukashi: 10, // 「むかしは なかよしだったでしょ」
          omoide: 10,
          daijoubu: 8,
          arigatou: 8,
          suki: 6,
          uso: -12,
        },
        categoryMatrix: { kind: 5, world: 3, sad: 6, dark: -10 },
        clearAt: 100,
      },
    ],
  },
};
