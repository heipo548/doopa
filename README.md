# DOOPA

> ドパガキ向けゲームの**実験場**。アイデアを発散させて並列に試し続けるプロジェクト。

## ✅ 唯一決まっていること

- **ターゲット = ドパガキ**
  - TikTok / YouTube Shorts によって常に新しい刺激を求める状態にされた若者
  - 同じコンテンツに飽きるのが早い、本は落ち着いて読めない、映画は長くて最後まで見れない、ゲームを覚えて上達するのも面倒

それ以外（メカニクス・ジャンル・操作・見せ方・コンセプト・トーン）は **何でも自由**。
失敗 OK、未完成 OK、しょぼい OK。**出した数が偉い**。

## 🌐 公開URL

- 🎮 ハブ（プロト一覧）: **https://heipo548.github.io/doopa/**
- 🧪 バトルシステム試作場 / Battle Lab: **https://heipo548.github.io/doopa/battle-lab/**
- 🛠 リポジトリ: https://github.com/heipo548/doopa
- 📨 アイデア/バグ投稿: https://github.com/heipo548/doopa/issues/new/choose

## 🧪 現在のプロトタイプ

| # | スラッグ | 名前 | 一言 | ステータス | 作者 |
|---|---|---|---|---|---|
| 01 | [dopamine-feed](./prototypes/01-dopamine-feed/) | ドーパミン直接摂取マシーン | "気持ちいい瞬間" を 3〜10 秒で連続摂取 | 🟢 active | @heipo548 |
| 02 | [saigo-no-tomodachi](./prototypes/02-saigo-no-tomodachi/) | さいごのともだち | ことばで戦う口喧嘩RPG。ぶつけるか手をのばすか、語彙が増え夜明けが変わる | 🟢 active | @heipo548 |
| 03 | [word-to-world](./prototypes/03-word-to-world/) | WO_RD → WORLD | 探索×言葉カードバトル。精神HPを削るか見えない思いやりを満たすか、勝ち方が人格を染める。終盤、神様が操作の癖を見透かす | 🟢 active | @heipo548 |
| 04 | [kotoba-no-android](./prototypes/04-kotoba-no-android/) | ルゥと せかいの あいだ | 手を出せない村のことばカードバトル探索。言い負かすか寄り添うか、勝ち方が人格を染め、終盤『井戸の こえ』が操作の癖を見透かす。ことばに きみを 足すと せかいに なる | 🟢 active | @heipo548 |
| 05 | [namae-wo-shiranai-sekai](./prototypes/05-namae-wo-shiranai-sekai/) | 名前を知らない世界 | 戦わない探索RPG。観察・対話で言葉を覚えると ？？？が「読める言葉」に変わる | 🟢 active | @heipo548 |
| 06 | [kotoba-no-mura](./prototypes/06-kotoba-no-mura/) | ことばの むら | 言葉で世界が読める×"かぞえうた"がきみの行動を数えて審判する探索RPG | 🟢 active | @heipo548 |
| 07 | [last-friend](./prototypes/07-last-friend/) | さいごのともだち（体験版） | ことばを覚えるたび ███ が「読める」に変わるRPG。Phaser+TS製・SQEXコンテスト応募作の体験版 | 🟢 active | @heipo548 |

詳細は [prototypes/README.md](./prototypes/README.md)。

## 🧪 バトルシステム試作場 / Battle Lab

これから作るゲームの**バトルシステムだけ**を、いろいろ試す場所。完成版ではなく検証用のモック置き場です。
**敵を倒すのではなく、言葉で「閉じた心」をほどく**——複数のバトル型（Slay the Spire / UNDERTALE / Inscryption / Dicey Dungeons …）を並べて比較します。

- 入口: [battle-lab/](./battle-lab/) ／ 公開: https://heipo548.github.io/doopa/battle-lab/
- 最初のモック: [言葉デッキバトル（Slay the Spire 参考）](./battle-lab/mocks/01-slay-the-spire-kotoba/)

詳細は [battle-lab/README.md](./battle-lab/README.md)。

## 📚 物語リファレンス

ゲームの土台にする物語・テーマの調べもの置き場（読みもの）。

- 🎬 [ことばを獲得する映画 7選](./docs/references/films/) — 「言葉を覚える＝世界が広がる」を主題に、**奇跡の人 / ブラック / ネル / 潜水服は蝶の夢を見る / メッセージ / シェイプ・オブ・ウォーター / 愛は静けさの中に** を、ストーリー＋差別化・革命的ポイント＋DOOPA創作への応用つきで視覚化（自作SVGキービジュアル）。
  - 公開: **https://heipo548.github.io/doopa/docs/references/films/**

## 👥 参加方法

| やりたいこと | 必要なもの | 方法 |
|---|---|---|
| 🎮 遊んで感想を投げる | ブラウザだけ | 上の公開URLにアクセス → 気づきを Issue or Discord に |
| 💡 新しいプロトのアイデアを投げる | GitHub アカウント | [New Issue](https://github.com/heipo548/doopa/issues/new/choose) → 🆕 新プロトのアイデア |
| 🛠 自分でプロトを作って追加する | Git + HTML/CSS/JS | `prototypes/XX-your-slug/` を作って PR、詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) |
| 🔧 既存プロトを改善する | 同上 | Issue + PR |

## 📦 リポ構成

```
doopa/
├── index.html              # ハブページ（プロト一覧 UI）
├── README.md               # このファイル
├── CONTRIBUTING.md         # 開発参加ガイド（新プロトの追加方法など）
├── LICENSE                 # MIT
├── prototypes/
│   ├── README.md           # プロト一覧の概観
│   └── 01-dopamine-feed/   # プロト#01
│       ├── index.html
│       ├── style.css
│       ├── js/
│       └── README.md
├── battle-lab/             # 🧪 バトルシステム試作場（バトルだけを試す場）
│   ├── index.html          #   モック一覧ハブ
│   ├── README.md
│   └── mocks/
│       └── 01-slay-the-spire-kotoba/  # 言葉デッキバトル（最初のモック）
│           ├── index.html
│           ├── js/         #   data/engine/ui/main（data.jsにカード・敵を集約）
│           └── tools/      #   headless-check.js（JXAでロジック検証）
├── docs/                   # 調べもの・設計メモ
│   └── references/
│       └── films/          # 📚 物語リファレンス（ことばを獲得する映画7選）
│           └── index.html  #   自作SVG＋ストーリー＋差別化・革命的ポイント
└── .github/
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        ├── new_prototype.md
        └── improvement.md
```

## 🛠 技術方針

- ピュア HTML / CSS / JavaScript（依存ライブラリゼロ・ビルドなし）
- 各プロトは `prototypes/XX-slug/index.html` で完結（独立性を保つ）
- ローカルでは `open index.html` だけで動く前提
- Web Audio API、Canvas、CSS アニメ等、ブラウザ標準は何使ってもOK

## 📜 ライセンス

MIT — 自由に使って改変してOK。詳細 [LICENSE](./LICENSE)。
