# 真名 -マナ- 体験版

名付けで世界を変える 2D ADV。仕様の正は SPEC.md。矛盾時は SPEC.md > このファイル > コード内コメント。

## コマンド

```
npm run dev      # 開発サーバ
npm run build    # tsc（strict）+ vite 静的ビルド
npm test         # vitest（RecipeEngine ほか）
```

※ この Mac では Node を `~/Projects/ai-workspace/.tools/node/bin` に置いている。
`export PATH=$HOME/Projects/ai-workspace/.tools/node/bin:$PATH` してから実行する。

## 規約

- TypeScript strict・any 禁止。データは `src/data/` に集約、ハードコード禁止
- シーンは入力ルーティングと生成のみ。ロジックは `systems/`。1ファイル300行目安
- レシピ・台詞・座標の変更は必ず `data/` の表を更新（SPEC.md §8〜§9 と同期）
- コミット: `feat:` / `fix:` / `polish:` / `data:` プレフィクス。マイルストーン完了時にタグ M0..M5
- 使用 AI ツール・ライブラリは README「開発ツール開示」に追記（コンテスト規約対応）
- 外部画像・音声アセットの導入は禁止（権利クリーン縛り。SPEC.md §14）

## Definition of Done

SPEC.md §1 の5条件＋該当マイルストーン（§15）の受け入れ条件に合格していること。

## 自己判断ポリシー

SPEC.md §18 に従う。迷ったら「名付け」以外の解決手段を増やさない。
