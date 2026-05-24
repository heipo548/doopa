# 01 — Dopamine Feed

**ドーパミン直接摂取マシーン**

DOOPA プロジェクトの最初の実験プロトタイプ。

## 一言コンセプト

ゲームの "気持ちいい瞬間"（破壊・収集・連打・レア発見・成長）の断片だけを 3〜10 秒で連続摂取する装置。
TikTok 的にスワイプして、アルゴリズムが好みを学習する。

## このプロトのガードレール

各プロトには固有のガードレール（実験の縛り）があってもよい。このプロトは:

- ⏱ **3〜10 秒で完結**
- ❌ **ルール理解が要らない**（見た瞬間にやれる）
- ❌ **失敗概念なし**（全部報酬）
- ⚡ **即気持ちいい**（破壊・収集・連打・レア発見・成長 のどれか）

## 起動

```bash
# 公開URL
open https://heipo548.github.io/doopa/prototypes/01-dopamine-feed/

# ローカル
open ~/Projects/ai-workspace/99_sandbox/doopa/prototypes/01-dopamine-feed/index.html
```

## 操作

| 操作 | 動作 |
|---|---|
| `↓` / マウス下ドラッグ / ホイール下 | 次の刺激へ |
| `↑` / マウス上ドラッグ / ホイール上 | 前へ戻る |
| `L` / 💖 | LIKE（次に似たのが出やすくなる） |
| `D` / 👎 | NOPE（次に出にくくなる） |
| `Space` | 一時停止 |

## 搭載されている "刺激" 5 種

| 刺激 | カテゴリ | 操作 |
|---|---|---|
| 🎈 風船パンッ | 破壊 | クリックで割る |
| 🔢 数字爆増 | 成長 | クリックで ×2 |
| 💰 コイン雨 | 収集 | マウスで集める |
| ⚡ 連打ゲージ | 達成 | 連打して MAX |
| ✨ レアガチャ | 発見 | 自動、たまに SSR |

## ファイル

```
01-dopamine-feed/
├── index.html
├── style.css
├── README.md（このファイル）
└── js/
    ├── main.js         # スワイプ制御・全体統括
    ├── algorithm.js    # 好み学習
    ├── effects.js      # パーティクル / Web Audio 効果音
    └── stimuli/
        ├── balloon.js
        ├── counter.js
        ├── coin.js
        ├── combo.js
        └── rare.js
```

## 拡張するなら

新しい "刺激" を増やす手順は [../../CONTRIBUTING.md](../../CONTRIBUTING.md) の「既存プロトを拡張する」セクション参照。

## ステータス

🟢 **active** — 触ってOK、改善 PR 歓迎、メイン作者 [@heipo548](https://github.com/heipo548)
