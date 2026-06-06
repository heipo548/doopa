# Battle Lab / バトルシステム試作場

これから作るゲームの**バトルシステムをいろいろ試す場所**。
完成版ゲームを作る場所ではなく、**複数のバトルモックを並べて「面白くなりそうか」を触って判断する**ための実験場です。

公開URL（GitHub Pages）:
**https://heipo548.github.io/doopa/battle-lab/**

## 作っているゲームの方向性

- 主人公＝言葉を覚えていない、無機質なアンドロイドのような存在。
- 周囲のNPC＝ポップでかわいい。
- この「無機質な主人公」と「ポップな世界」のズレで、少し不気味で、でも優しい雰囲気を出す。
- 言葉を集めて世界に干渉していく。**敵を倒すのではなく、言葉で「閉じた心」をほどく**。

## モック一覧

| # | スラッグ | 参考 | 状態 |
|---|---|---|---|
| 01 | [01-slay-the-spire-kotoba](./mocks/01-slay-the-spire-kotoba/) | Slay the Spire | 🟢 PLAYABLE |
| 02 | [02-undertale-kotoba](./mocks/02-undertale-kotoba/) | UNDERTALE | 🟢 PLAYABLE |
| 03 | [03-inscryption-kotoba](./mocks/03-inscryption-kotoba/) | Inscryption | 🟢 PLAYABLE |
| 04 | [04-dicey-dungeons-kotoba](./mocks/04-dicey-dungeons-kotoba/) | Dicey Dungeons | 🟢 PLAYABLE |
| 05 | （逆転裁判型・言葉の矛盾を突く） | 逆転裁判 | 🌱 準備中 |

## 新しいバトルモックを足すには

1. `mocks/XX-スラッグ/` を作る（`index.html` で完結、`js/` にロジック）。
   - 既存の `mocks/01-slay-the-spire-kotoba/` をひな形にすると速い。
   - カード・敵・状態異常・バランスは `js/data.js` に集約する（ロジックと分ける）。
   - 進行ルール（engine）はDOMに触れない純粋ロジックにしておくと、JXAで自動検証できる。
2. `battle-lab/index.html` の「BATTLE MOCKS」にカードを1枚コピペで追加。
3. この表に1行足す。

## 今後足したいもの（構造だけ用意済み）

- 言葉のレベルアップ（3段階）：ありがとう → 本当にありがとう → ありがとう、いてくれて
- 記憶のかけら（＝レリック）
- 学校（＝ショップ）
- エリア別ルール（裁判所・無人島 など）

## 技術方針

- ピュア HTML / CSS / JavaScript（依存ライブラリゼロ・ビルドなし）。
- 各モックは独立。`open index.html` でローカルでも動く。
- DOM非依存のコアは JXA（`osascript -l JavaScript`）で点検できる（各モックの `tools/` 参照）。
