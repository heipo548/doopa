# 08 — mana

**真名 -マナ-（体験版・序章「灯し村」）**

## 一言コンセプト
漢字の成り立ちそのものを魔法に、万物へ名前を取り戻す——「名づける」ひとつの動詞で謎解き・ボス戦・物語を貫くADV

## このプロト固有のガードレール
- 数値を見せない（経験値・HP・ダメージなし。緊張は弾幕でなく知的タイマーで作る）
- 「名づける」以外の解決手段を増やさない（これが背骨）
- 全テクスチャ実行時生成・全SE WebAudio合成（外部画像/音声ファイル不使用）
- 体験版スコープ＝序章のみ（20〜25分）。製品版の章・経済・戦闘数値は実装しない

## 起動
```bash
# 公開URL（GitHub Pages）
open https://heipo548.github.io/doopa/prototypes/08-mana/

# ローカル開発
cd prototypes/08-mana/app
export PATH=$HOME/Projects/ai-workspace/.tools/node/bin:$PATH   # この環境の Node 配置
npm install && npm run dev
```

## あそびかた
1. **拾う** — 世界に散らばる「言ノ葉」（火・日・月・木・点…）を集める
2. **きく** — Q長押しでナナシ（名を失ったもの）の声をきく（3段階ヒント）
3. **名づける** — 単字 / 結字（日＋月＝明）/ 改字（大＋点＝犬）で名前を与える
4. 名を得たものは色を取り戻し、世界が変わる

言ノ葉は消費しない。覚えた字＝あなたの力。

## 操作
| 入力 | 動作 |
|---|---|
| WASD / 矢印 | 移動 |
| E / Z | 調べる・話す・拾う・鐘を鳴らす |
| Q / X 長押し | きき診（困ったらこれ） |
| Space | 名付けモード（「？」マーカーの近くで） |
| Esc | オーバーレイを閉じる |
| マウス | 名付けUI・語彙バッジの操作 |

`?debug=1` を付けると数字キーで各ゾーンへ瞬間移動・G で全語彙付与。

## 配信のしくみ
- ゲーム本体は `app/`（Phaser 3 + TypeScript + Vite）。`src/` は SQEX コンテスト提出版から無改変
- `app/` で `npm run build && npm run deploy` すると `app/dist/` がこのフォルダ直下へコピーされ、
  GitHub Pages が `prototypes/08-mana/index.html` を直接配信する（他プロトと同じ「▶ あそぶ」導線）
- 詳細仕様は [app/SPEC.md](./app/SPEC.md)

## 開発ツール開示（コンテストAI利用ガイドライン対応）
企画・ディレクション=人間／実装=Claude Code（人間レビュー）／Phaser 3・Vite・TypeScript・
Shippori Mincho（SIL OFL）。画像・音声の外部素材ファイルは不使用（Graphics＋フォント描画＋
Web Audio 合成のみ）。
