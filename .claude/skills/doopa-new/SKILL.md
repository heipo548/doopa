---
name: doopa-new
description: Use this skill when the user wants to create a brand-new prototype in the DOOPA project (ドパガキ向けゲーム実験場, ~/Projects/ai-workspace/99_sandbox/doopa). Triggers include "新プロト作って", "新しいアイデア試したい", "/doopa-new <concept>", or any request to start a fresh experiment in DOOPA. Receives a concept description and creates a minimal working prototype with hub registration, README, and git push.
---

# DOOPA 新プロト作成

ユーザーの一行コンセプトから、DOOPA の新プロトタイプを最小構成で作成し、ハブに登録し、ブランチに push する。

## プロジェクト前提（コンテキスト）

- **場所:** `~/Projects/ai-workspace/99_sandbox/doopa/`
- **GitHub:** https://github.com/heipo548/doopa （Public）
- **コンセプト:** ドパガキ向けゲームの実験場。ターゲット = ドパガキ だけ確定、他は自由
- **構造:** 各プロトは `prototypes/XX-slug/` に独立配置（XX は連番、slug は kebab-case）
- **ガードレール:** プロジェクト全体は「ターゲット = ドパガキ」のみ。メカニクス系の縛りはプロト固有
- **削除禁止:** 失敗・没アイデアも archived ステータスで残す

## 実行手順

### 1. 作業ディレクトリへ
```bash
cd ~/Projects/ai-workspace/99_sandbox/doopa
```

### 2. 次の連番とスラッグを決める
```bash
ls prototypes/
```
で既存プロトを確認 → 次の `XX` を決定。
スラッグは kebab-case の英数字（5〜20 字推奨）。コンセプトから案を 2-3 個提案して、ユーザーに選んでもらう。

例: コンセプトが「絵文字を高速シューティング」→ `emoji-shooter` / `dopa-blast` / `tap-rain` など。

### 3. ブランチを切る
```bash
git checkout -b proto/XX-slug
```

### 4. フォルダと最小ファイルを作る
```bash
mkdir -p prototypes/XX-slug
```

#### `prototypes/XX-slug/index.html`
ブラウザで開けば動く最小 HTML。依存ゼロ。
DOOPA トーンに揃えるなら背景ダーク + ネオン配色（参考: `prototypes/01-dopamine-feed/style.css` の color variables）。
複雑にしすぎず、コンセプトの "気持ちよさ" のコアだけ実装。30 分で動かせる範囲に。

#### `prototypes/XX-slug/README.md`
以下のテンプレに従う:
```markdown
# XX — <Slug>

**正式名**

## 一言コンセプト
（30字以内）

## このプロト固有のガードレール
（あれば。例: 全部 5 秒以内 / クリック以外禁止 / テキストゼロ）

## 起動
\`\`\`bash
open https://heipo548.github.io/doopa/prototypes/XX-slug/
# or
open prototypes/XX-slug/index.html
\`\`\`

## 操作
| 操作 | 動作 |
|---|---|
| | |

## 何を試したかったか
（このプロトで検証したい仮説。後で見返したときの学びの種）

## ステータス
🌱 seed

## 作者
@heipo548
```

### 5. ハブとインデックスを更新
**3 箇所更新:**

1. ルート `index.html` の `<section class="block">` 内に新カード追加（既存 01 のカードをコピペ → 番号・タイトル・スラッグ・説明・PLAY リンク変更）
2. `prototypes/README.md` の表に行追加
3. ルート `README.md` の表に行追加

### 6. 動作確認をユーザーに案内
```bash
open prototypes/XX-slug/index.html
```
を促し、「動くか」「コンセプトが体感できるか」確認してもらう。
ユーザーの「OK」or 修正依頼を待つ。修正があれば反映。

### 7. コミット & push
```bash
git add prototypes/XX-slug index.html prototypes/README.md README.md
git commit -m "feat: 新プロト #XX <slug> を追加 — <30字一言>"
git push origin proto/XX-slug
```

### 8. PR URL を案内
ユーザーに以下を提示:
```
https://github.com/heipo548/doopa/compare/main...proto/XX-slug?expand=1
```
クリックで PR 作成画面が開く。`open` コマンドで開いても良い。

## 守ること

- **しょぼくてOK** — 30 分以内で動くものを優先。「出した数が偉い」精神
- **削除禁止** — `rm` や `git rm` 系は使わない（archived ステータスで残す運用）
- **main 直 push 禁止** — 必ず `proto/XX-slug` ブランチ経由
- **機密データ禁止** — Public リポなので個人情報・API キー等は含めない
- **依存ライブラリ追加禁止** — 純粋 HTML/CSS/JS を維持（どうしても必要なら CDN リンクで `index.html` に直書き）
- **対話確認** — スラッグ決定時と動作確認時はユーザーに必ず確認

## 失敗時のリカバリ

- ブランチ作成後にやめたい: `git checkout main && git branch -D proto/XX-slug`（push 前のみ）
- push 後にやめたい: PR を Close、ブランチは残しておく（学びとして）
