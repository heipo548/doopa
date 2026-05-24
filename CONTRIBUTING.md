# DOOPA への参加ガイド

DOOPA は **ドパガキ向けゲームのアイデアを並列に試す実験場**。
このガイドは「新しいプロトタイプを増やす」「既存プロトを改善する」「アイデアを投げる」のやり方をまとめたものです。

## 0. このプロジェクトのスタンス

- ✅ **発散優先** — メカニクスもジャンルも操作も自由。「これゲームっぽくないけど…」全然OK
- ✅ **数で勝負** — しょぼくても未完成でも、出した数が偉い
- ✅ **学びを残す** — やめるときも「削除」じゃなく archived にして残す（次の人が学べる）
- ❌ **ガードレールはひとつだけ:** ターゲット = ドパガキ を意識すること
  - メカニクス系のガードレール（時間制限・難易度など）は **プロト単位** で各自設定

## 1. 参加スタイル

| やりたいこと | 必要なもの | やること |
|---|---|---|
| 🎮 **遊んで感想を投げる** | ブラウザだけ | 公開URL → 感想を Issue or Discord |
| 💡 **新プロトのアイデアを投げる** | GitHub アカウント | [Issue: 🆕 新プロト](https://github.com/heipo548/doopa/issues/new?template=new_prototype.md) |
| 🛠 **新プロトを自分で作って追加する** | Git + HTML/CSS/JS | 後述「新プロトの追加方法」 |
| 🔧 **既存プロトを改善する** | 同上 | Issue + PR |
| 🐛 **バグ報告** | GitHub アカウント | [Issue: 🐛 バグ](https://github.com/heipo548/doopa/issues/new?template=bug_report.md) |

---

## 2. 新プロトの追加方法（メイン）

### 2-1. 命名と場所
```
prototypes/
└── XX-your-slug/        ← XX は連番（02, 03, ...）、slug は kebab-case
    ├── index.html       ← 必須・このプロトのエントリ
    ├── README.md        ← 必須・コンセプト/操作/作者/ガードレール
    └── （他のファイル自由：style.css, js/, assets/ ...）
```

例: `prototypes/02-infinite-zoom/`、`prototypes/03-fake-news-shorts/`

### 2-2. 最小ステップ

```bash
# クローン
git clone https://github.com/heipo548/doopa.git
cd doopa

# ブランチ切る
git checkout -b proto/02-your-slug

# フォルダ作る
mkdir -p prototypes/02-your-slug

# index.html を書く（ブラウザで開くだけで動くもの）
# README.md を書く（下のテンプレ参照）

# 動作確認
open prototypes/02-your-slug/index.html

# コミット & push & PR
git add prototypes/02-your-slug
git commit -m "feat: 新プロト #02 your-slug を追加"
git push origin proto/02-your-slug
```

GitHub のページに「Compare & pull request」が出るので押して PR。

### 2-3. ハブと一覧表も更新

新プロト追加 PR には以下も含めてください（メンバー全員から見えるように）:

- **ルート [index.html](./index.html) の `<section class="block">` 内にカード追加**（既存のカードをコピペして書き換え）
- **[prototypes/README.md](./prototypes/README.md) の表に行追加**
- **[README.md](./README.md) の表にも 1 行追加**

3 箇所更新がだるい場合、ハブと表は別 PR でも、PR 後に他の人が追加でも構いません。

### 2-4. プロト README.md のテンプレ

```markdown
# XX — Your Slug

**プロト正式名**

## 一言コンセプト
（30 字以内）

## このプロト固有のガードレール
（自由に設定。例: 「全部 5 秒以内」「クリック以外禁止」など）

## 起動
\`\`\`bash
open https://heipo548.github.io/doopa/prototypes/XX-your-slug/
# or
open prototypes/XX-your-slug/index.html
\`\`\`

## 操作
| 操作 | 動作 |
|---|---|
| | |

## 何を試したかったか
（メモ。後で他の人が学べるように）

## ステータス
🌱 seed / 🟢 active / 🧊 frozen / 🪦 archived

## 作者
@your-github-name
```

---

## 3. 既存プロトの改善

- バグ修正・演出強化・新機能追加など何でも歓迎
- 改善前に Issue を立てて「これ触ります」と宣言推奨（ぶつかり防止）
- ブランチ命名: `fix/01-balloon-pop-sound`、`feat/01-add-shake-stimulus` など

---

## 4. ステータスの運用

各プロトの README に明記:

- 🌱 **seed** — アイデア・モックアップ段階、動かないかも
- 🟢 **active** — 動いてる、改善 PR 歓迎
- 🧊 **frozen** — 一旦止まってる、再開時期未定
- 🪦 **archived** — 試した結果クローズ、学びだけ残す

**やめるときも消さない。** `archived` にすれば次の人が学べる。

---

## 5. コードの書き方ルール

- **依存ライブラリは追加しない**（純粋 HTML/CSS/JS を維持）
  - どうしても必要な場合は CDN リンクで `index.html` に直書き
- **各プロトは `index.html` 単独で開いて動くこと**（ローカルサーバー不要、`file://` で動く）
- **コメントは日本語OK**（初心者でも読めるように）
- **「なぜ」を書く**（「何をしてるか」はコードを読めばわかる）
- **ファイルの削除は禁止**。不要になったプロトは README のステータスを `archived` に変えるだけ
- 1 ファイル 300 行を超えたら分割を検討

---

## 6. ブランチ命名規則

| 用途 | 例 |
|---|---|
| 新プロト追加 | `proto/02-your-slug` |
| 既存プロト改善 | `feat/01-add-xxx` `fix/01-yyy-bug` |
| ドキュメント | `docs/update-readme` |
| ハブページ調整 | `style/hub-grid` |

---

## 7. コミットメッセージ

雰囲気で良いが、頭にプレフィックスを付けてくれるとログ追いやすい:

- `feat:` 新機能・新プロト
- `fix:` バグ修正
- `style:` 見た目調整
- `docs:` ドキュメント
- `refactor:` リファクタ
- `chore:` その他（設定・雑務）

---

## 8. 困ったときは

- このリポの [Issues](https://github.com/heipo548/doopa/issues) で質問
- Discord で雑に投げる
- README / CONTRIBUTING を改善したくなったら遠慮なく PR

楽しんでください 🎮
