---
name: doopa-improve
description: Use this skill when the user wants to improve, extend, or fix an existing DOOPA prototype in ~/Projects/ai-workspace/99_sandbox/doopa/prototypes/. Triggers include "プロト改善したい", "01-dopamine-feed をブラッシュアップ", "/doopa-improve <slug> <description>", or any request to modify an existing DOOPA prototype. The user provides target prototype (number or slug) plus what they want changed. Workflow: 把握 → 2-3案提案 → ユーザー選択 → 実装 → push.
---

# DOOPA 既存プロト改善

指定されたプロトを改善する。「現状把握 → 改善案 2-3 提案 → ユーザー選択 → 実装 → push」のサイクル。

## プロジェクト前提（コンテキスト）

- **場所:** `~/Projects/ai-workspace/99_sandbox/doopa/`
- **GitHub:** https://github.com/heipo548/doopa
- **各プロトは独立:** `prototypes/XX-slug/` 単位、他プロトへの依存禁止
- **プロト固有のガードレール:** 各プロトの README に書かれた縛りを尊重する

## 実行手順

### 1. 作業ディレクトリへ
```bash
cd ~/Projects/ai-workspace/99_sandbox/doopa
```

### 2. 対象プロトを特定
- ユーザーが `01` や `dopamine-feed` などで指定 → `prototypes/XX-slug/` を特定
- 曖昧 or 未指定 → `ls prototypes/` で候補リスト → ユーザーに確認

### 3. 現状把握（必須）
以下を順に Read:
- `prototypes/XX-slug/README.md` — コンセプト・固有ガードレール・操作・ステータス
- `prototypes/XX-slug/index.html` — エントリ
- 必要に応じて `prototypes/XX-slug/style.css`, `js/` 配下

**把握せずに改善案を出さない。** ガードレールから外れた提案は的外れになりやすい。

### 4. 改善案を 2-3 個提案
- ユーザーの「やりたいこと」をプロトの固有ガードレールに照らして解釈
- 案ごとに「変更ファイル」「工数感（〇分）」「期待される効果」を提示
- 案が大改造になる場合は **別案として「新プロト化（doopa-new に行く）」も提示**（既存プロトの一貫性を保つため）

### 5. ユーザー選択を待つ
選ばれた案で実装計画を簡潔に確認 → 明示的な OK を待ってから次へ。

### 6. ブランチ作成
変更の性質に応じて:
- 新機能 → `git checkout -b feat/XX-<short-desc>`
- バグ修正 → `git checkout -b fix/XX-<short-desc>`
- 演出強化 → `git checkout -b style/XX-<short-desc>`

例: `feat/01-add-shake-stimulus`、`fix/01-rare-stuck`

### 7. 実装
- 該当ファイルを Edit/Write
- 1 コミット = 1 論理単位（細かく分けてもOK、巨大コミットは避ける）
- README の更新が必要なら一緒に（ステータス変更含む）

### 8. 動作確認をユーザーに案内
```bash
open prototypes/XX-slug/index.html
```
を促し、ユーザーの「OK」or 修正依頼を待つ。

### 9. コミット & push
```bash
git add prototypes/XX-slug
git commit -m "<type>: #XX <slug> <変更内容を1行>"
git push origin <branch>
```

### 10. PR URL を案内
```
https://github.com/heipo548/doopa/compare/main...<branch>?expand=1
```

## 守ること

- **対象プロト固有のガードレール尊重** — README に書かれた縛りを破る場合は理由を明示し、ユーザーに確認
- **削除禁止** — 不要になったコードはコメントアウト or 別 PR で整理（即時 `rm` 禁止）
- **main 直 push 禁止**
- **大改造になりそうなら新プロト化を提案** — 「これを土台に別方向で試す」のは新プロトの方が筋

## アンチパターン

- ユーザーの一言を聞いて即実装に走る → 必ず提案 → 選択を挟む
- 「ついでに」リファクタを混ぜる → 別 PR / 別 issue に分離
- 全く新しいメカニクスを既存プロトに突っ込む → 新プロトとして doopa-new に流す
