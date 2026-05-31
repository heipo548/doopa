---
name: doopa-list
description: Use this skill when the user wants to quickly see the current state of all DOOPA prototypes — names, status (seed/active/frozen/archived), authors, and URLs. Triggers include "doopa 一覧", "/doopa-list", "プロト何があったっけ", "DOOPA の状況確認". Lists prototypes from prototypes/ folder with metadata extracted from each README.
---

# DOOPA プロト一覧

`prototypes/` の各 README から名前・ステータス・作者を抜き出してテーブル表示する。

## 実行手順

1. `cd ~/Projects/ai-workspace/99_sandbox/doopa`
2. `ls prototypes/` で全プロトフォルダを取得
3. 各 `prototypes/XX-slug/README.md` を読んで以下を抽出:
   - 番号 + スラッグ（フォルダ名から）
   - 正式名（README 冒頭の見出し）
   - 一言コンセプト
   - ステータス（🌱 seed / 🟢 active / 🧊 frozen / 🪦 archived）
   - 作者
4. 以下の形式でテーブル表示:

```
| # | スラッグ | 名前 | 一言 | ステータス | 作者 |
|---|---|---|---|---|---|
| 01 | dopamine-feed | ドーパミン直接摂取マシーン | "気持ちいい瞬間" を 3〜10 秒で連続摂取 | 🟢 active | @heipo548 |
...
```

5. 末尾に以下も案内:
   - ハブURL: https://heipo548.github.io/doopa/
   - 新プロト追加: `/doopa-new <concept>`
   - 既存改善: `/doopa-improve <slug> <description>`

## 注意

- README のフォーマットが揺れてる場合は推測でOK（厳密パースしない）
- ステータス未記載のものは `❓ unknown` と表示
