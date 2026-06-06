# プロト #04 QA チェックリスト（QA_CHECKLIST）

検証手段（node 不可前提）:
- ヘッドレス・ロジック: `osascript -l JavaScript prototypes/04-kotoba-no-android/tools/headless-check.js`
- UI/DOM 構文: `osascript -l JavaScript prototypes/04-kotoba-no-android/tools/ui-syntax-check.js`
- 実機: `cd prototypes/04-kotoba-no-android && python3 -m http.server 8770` → ブラウザで確認
- 差分監査: `git status` / `git diff`（追記のみ・01-03 不変の確認）

判定: PASS / FAIL（FAIL は理由とともに記録）。

---

## 1. 既存への非破壊（最重要）

| # | 項目 | 手段 | 結果 |
|---|---|---|---|
| R1 | 既存サイト（root index.html）が壊れていない | python3 起動・目視 | ☐ |
| R2 | #01 dopamine-feed が従来どおり開く | 目視 | ☐ |
| R3 | #02 saigo-no-tomodachi が従来どおり開く | 目視 | ☐ |
| R4 | #03 word-to-world が従来どおり開く（無改変） | 目視＋`git diff` | ☐ |
| R5 | 共有3ファイルは「4番目の追記のみ」、01-03 の行は文字単位で不変 | `git diff index.html prototypes/README.md README.md` | ☐ |
| R6 | #03 の固有資産（WO_RD/WORLD/#L-0 等）を 04 が流用していない | `grep -R "WO_RD\|WORLD\|#L-0" prototypes/04-*` がヒット0 | ☐ |
| R7 | セーブキーが #03（`wo_rd_save_v1`）と衝突しない | `grep -R "kotoba_save_v1" prototypes/04-*` | ☐ |

## 2. 4番目プロトの導線

| # | 項目 | 結果 |
|---|---|---|
| H1 | 4番目プロトが一覧（root index.html）にカードとして出る | ☐ |
| H2 | prototypes/README.md の表に 04 行が出る | ☐ |
| H3 | root README.md の表に 04 行が出る | ☐ |
| H4 | カードの「あそぶ」から 04 が開ける（別ページ・別ゲーム） | ☐ |

## 3. ゲーム本体（縦スライス1周）

| # | 項目 | 手段 | 結果 |
|---|---|---|---|
| G1 | タイトルから「はじめる」で開始できる | 実機 | ☐ |
| G2 | 村フィールドで主人公を移動できる（クリック移動＋キー代替） | 実機 | ☐ |
| G3 | NPC に話しかけられる（typewriter 会話） | 実機 | ☐ |
| G4 | カード3択が出る | 実機/headless | ☐ |
| G5 | カードを1枚選べる（手札に入る・既知なら Lv↑） | 実機/headless | ☐ |
| G6 | バトルに入れる | 実機/headless | ☐ |
| G7 | 精神HP が見える（敵 mindHp バー） | 実機 | ☐ |
| G8 | 思いやりゲージが**内部的に機能**し、**UI に出ない** | headless（数値往復）＋目視（器が無い） | ☐ |
| G9 | 精神HP 勝利（harsh）が可能 | headless | ☐ |
| G10 | 思いやり勝利（kind）が可能 | headless | ☐ |
| G11 | 両ルートともプレイヤーが死なずに勝てる（非パーマデス・kind でも生存） | headless | ☐ |
| G12 | どちらで勝ったかが記録される（lastWinKind / counters） | headless | ☐ |
| G13 | 優しい/凶暴の傾きが記録される（tendency 2軸） | headless | ☐ |
| G14 | 結果/簡易エンド画面に進む | 実機/headless | ☐ |
| G15 | 結果画面に選択傾向が短く出る（勝ち方×傾向の文面分岐） | 実機 | ☐ |
| G16 | 操作計測が記録される（clicks/skip/dwell/cursor） | headless | ☐ |
| G17 | 結果のメタ1行が計測（skip 傾向）に連動する | headless/実機 | ☐ |
| G18 | 結果→タイトルで1周が閉じる（行き止まりなし） | 実機 | ☐ |

## 4. セーブ/ロード

| # | 項目 | 手段 | 結果 |
|---|---|---|---|
| S1 | localStorage に保存できる | headless（stub）/実機 | ☐ |
| S2 | 「つづきから」で復元できる（進行/手札/傾向/counters） | headless/実機 | ☐ |
| S3 | metrics スナップショットが往復する（癖が巻き戻らない） | headless | ☐ |
| S4 | セーブが無い初回は「つづきから」が無効/非表示で例外を出さない | 実機 | ☐ |
| S5 | 壊れた/空セーブで安全にフォールバック（loadGame=false、消さない） | headless | ☐ |

## 5. ビルド/技術

| # | 項目 | 手段 | 結果 |
|---|---|---|---|
| B1 | DOM 非依存コアの headless-check が "CORE OK"（構文/契約 PASS） | `osascript -l JavaScript tools/headless-check.js` | ☐ |
| B2 | ui/main/field/audio の構文チェック PASS（DOM スタブ） | `osascript -l JavaScript tools/ui-syntax-check.js` | ☐ |
| B3 | `file://` / python3 で外部素材 404 が出ない（CSS/SVG/WebAudio のみ） | 実機/grep | ☐ |
| B4 | 依存ライブラリゼロ・ES Modules 不使用・読込順正しい | grep | ☐ |
| B5 | JS コンソールに例外が出ない（1周通し） | 実機 | ☐ |

## 6. アクセシビリティ/弁別

| # | 項目 | 結果 |
|---|---|---|
| A1 | prefers-reduced-motion で演出が止まり情報欠落しない | ☐ |
| A2 | harsh/kind が色＋形＋語で冗長表現（色のみ依存ゼロ） | ☐ |
| A3 | #03 と並べて配色が明確に異なる（涼ラベンダー vs 暖ピンク） | ☐ |

## 7. デプロイ

| # | 項目 | 結果 |
|---|---|---|
| D1 | `proto/04-kotoba-no-android` ブランチへコミット済み | ☐ |
| D2 | 実行コマンド・成功/失敗・次手順が報告されている | ☐ |
| D3 | GitHub Pages 反映条件（main へ merge）が明記されている | ☐ |
| D4 | push（公開）は人間承認後に実施する運用が守られている | ☐ |

---

## 実行結果サマリ（記入欄）

- headless-check: （結果を貼る）
- ui-syntax-check: （結果を貼る）
- python3 実機: （結果）
- git diff（共有3ファイル）: （追記のみ確認）
- 総合判定: PASS / FAIL（理由）
