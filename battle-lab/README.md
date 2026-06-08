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
| 05 | [05-pokemon-kotoba](./mocks/05-pokemon-kotoba/) | Pokémon | 🟢 PLAYABLE |
| 06 | [06-persona-kotoba](./mocks/06-persona-kotoba/) | ペルソナ（心象弱点・総鳴り） | 🟢 PLAYABLE |
| 07 | [07-gyakuten-saiban-kotoba](./mocks/07-gyakuten-saiban-kotoba/) | 逆転裁判 | 🟢 PLAYABLE |
| 08 | [08-kokoro-timeline](./mocks/08-kokoro-timeline/) | こころの時間差（タイムライン式） | 🟢 PLAYABLE |
| 09 | [09-kotoba-action](./mocks/09-kotoba-action/) | ことばアクションコマンド（届け方のタイミング） | 🟢 PLAYABLE |
| 10 | [10-kokoro-bui](./mocks/10-kokoro-bui/) | こころの部位（部位ごとにほどく） | 🟢 PLAYABLE |
| 11 | [11-kotoba-board](./mocks/11-kotoba-board/) | ことばを置く盤面（言葉を世界に置く） | 🟢 PLAYABLE |
| 12 | [12-kodou-rhythm](./mocks/12-kodou-rhythm/) | 鼓動リズム（呼吸を合わせる） | 🟢 PLAYABLE |
| 13 | [13-maai-yomiai](./mocks/13-maai-yomiai/) | 間合いと読み合い（距離の同時選択） | 🟢 PLAYABLE |
| 14 | [14-tabishitaku-auto](./mocks/14-tabishitaku-auto/) | 旅支度オート（準備が戦い） | 🟢 PLAYABLE |
| 15 | [15-kotoba-rikai](./mocks/15-kotoba-rikai/) | ことば選択型・理解バトル（本命候補：Pokémon × Slay the Spire × UNDERTALE） | 🟢 PLAYABLE |

> 01〜07 は既存のゲーム構造を参考にした検証群、08〜14 は「言葉を使う世界観」に寄せたオリジナル発想の検証群。
> 15 は本命候補。倒さず、ことばを選んで相手を理解し、警戒させすぎずに心の距離を縮める「理解バトル」。
> 自動点検は JXA（`osascript -l JavaScript`）で行う。進行ルールは各モックの `tools/headless-check.js`、
> UI配線は `tools/dom-smoke.js`（08〜14 と 04・07 に同梱）。

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
