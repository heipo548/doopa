# DOOPA への参加ガイド

## 0. このプロジェクトについて

ドパガキ向けインディーズゲーム DOOPA の共同開発リポジトリです。
コンセプトと操作は [README.md](./README.md) を読んでください。

参加スタイルは以下の 3 つあります。**自分に合うものを選んでください。**

| スタイル | 必要なもの | やること |
|---|---|---|
| 🎮 **遊ぶだけ** | ブラウザだけ | 公開URL（後述）にアクセスして体験する。気づきを Issue に書く |
| 💡 **アイデアを出す** | GitHub アカウント | 新しい刺激案・改善案を Issue にあげる |
| 🛠 **コードを書く** | GitHub アカウント + Git | fork or clone して branch 切って Pull Request |

---

## 1. 遊ぶだけの人へ

公開URLは：

```
https://heipo548.github.io/doopa/
```
※ セットアップ完了後にここに正しいURLが入ります。

**やってほしいこと:**
- 触ってみて「気持ちよかった瞬間」「飽きた瞬間」をメモ
- バグや変な挙動があれば [Issues](../../issues) で「バグ報告」テンプレ
- 「こんな刺激あったら」と思いついたら「アイデア提案」テンプレ

---

## 2. アイデアを出す人へ

GitHub アカウントを作って、このリポジトリの [Issues](../../issues) で:

1. **New Issue** を押す
2. テンプレ（バグ報告 / アイデア提案）を選ぶ
3. 書いて送信

**コンセプトのガードレール:**
DOOPA は「**ミニゲーム集にはしない**」のがルールです（同じだと Roblox と区別がつかなくなる）。
新しい "刺激" を提案するときは、以下を守ってください：

- ⏱ **3〜10 秒で完結**
- ❌ **ルール理解が要らない**
- ❌ **失敗概念なし**（全部報酬）
- ⚡ **即気持ちいい**（達成感・破壊・収集・成長・発見のどれか）

---

## 3. コードを書く人へ

### 初回セットアップ

```bash
# クローン
git clone https://github.com/heipo548/doopa.git
cd doopa

# ブラウザで開くだけで動く（ビルド・依存関係なし）
open index.html
```

### ブランチ運用

```bash
# 機能ごとにブランチを切る
git checkout -b feat/new-stimulus-tower

# 編集してコミット
git add .
git commit -m "feat: タワー積み上げ刺激を追加"

# push して Pull Request
git push origin feat/new-stimulus-tower
```

GitHub のページに行くと「Compare & pull request」ボタンが出るので押して PR 作成。

### ブランチ命名規則

- `feat/〇〇` 新機能
- `fix/〇〇` バグ修正
- `style/〇〇` 見た目の調整
- `docs/〇〇` ドキュメント
- `refactor/〇〇` リファクタ

### コミットメッセージ

雰囲気で良いが、頭に `feat:` `fix:` `docs:` などを付けてくれるとログが追いやすい。

### コードの書き方ルール

- **コメントは日本語OK**（初心者でも読めるように）
- **「なぜ」を書く**（「何をしてるか」はコードを読めばわかる）
- 1 ファイル 300 行を目安に分割（特に `js/stimuli/` の中）
- 依存ライブラリは追加しない（純粋 HTML/CSS/JS を維持）
- ファイルの削除は禁止。不要になったら `90_archive/` を作って移動する

### 新しい "刺激" の追加方法

1. `js/stimuli/your-name.js` を作る
2. 以下のインターフェースを実装：

```js
const YourName = (() => {
  const id = 'your-name';
  const label = '🔥 あなたの刺激名';

  /**
   * @param {HTMLElement} host  カード内のホスト要素
   * @param {{ onDone:Function, onDopamine:Function }} cb
   */
  function init(host, cb) {
    // host.innerHTML = '' して中身を組み立てる
    // cb.onDopamine(n) で報酬付与
    // cb.onDone({score}) で完走通知
    return function cleanup() {
      // タイマー解除・イベント剥がし
    };
  }
  return { id, label, init };
})();
```

3. `index.html` の `<script>` タグに追加
4. `js/main.js` の `STIMULI` 配列に追加

これだけで Algorithm が学習対象に入れます。

---

## 4. 困ったときは

- リポジトリの [Discussions](../../discussions) or Issue で質問
- README / CONTRIBUTING を更新したくなったら遠慮なく PR

楽しんでください。
