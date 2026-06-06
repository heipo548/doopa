# プロト #04 実装計画書（IMPLEMENTATION_PLAN）

- スラッグ: `04-kotoba-no-android`
- 仮タイトル（要人間確認）: **「なぐれない むら の ルゥ」**
- 一言: なぐれない村で、ひろった ことばだけが きみの きばに なる。探索×言葉カードバトルの最小縦スライス。
- 種別: DOOPA 4 つ目の新規プロトタイプ（既存 #01〜#03 は無改変・追加のみ）
- 作成日: 2026-06-06

> ## ⭐ UPDATE（方針転換：#03 同コンセプトの上位版＋公開）
> 初回は #03 とわざと差別化したMVPだったが、監督指示で「3と差別化不要・新体制で上位クオリティの4を・公開まで」へ転換。
> 既存コア（FSM/バトル/セーブ/計測：全QA PASS）の上に、**学校ショップ・2戦アーク（かどっこ→くちなし）・
> フル神様メタ（井戸の こえ）・word→world / L 回収・3エンド・ダーク化** を載せ、GitHub Pages へ公開する。
> 検証は引き続き JXA headless-check / ui-syntax-check（CORE OK / UI OK）＋ python3。次フェーズはアート強化（art 系エージェント）。

> このプロトは、添付3資料（setting ideas memo / development proposal v1.1 / core systems）を土台に、
> **AIマルチエージェント開発体制（`docs/ai-studio` / `.claude/agents`）** を使って企画→設計→実装→QA→デプロイ導線まで通したもの。
> 既存 #03「WO_RD → WORLD」は同じ企画ブリーフを既にほぼ実装済みのため、本作は **#03 とは別個の自立した MVP** として作る（#03 の固有資産は流用しない／house 様式のみ踏襲）。

---

## 1. 3資料から読み取った今回の方針

### development proposal v1.1（今回の中核仕様）
- 可愛くポップな世界（ちいかわ風）。**主人公だけ**が進行とともにダークへ反転していく落差が肝。
- 物語は会話分岐ではなく、**集めた言葉カード**と**敵の倒し方**で人格・世界・エンドが分岐する。
- 探索型 ADV + 言葉のカードバトル。NPC/敵に「どの言葉を知りたいか」を投げ、**提示3枚から1枚**を選ぶ。
- 口喧嘩＝言葉のカードバトル（ターン制）。相手は2ゲージ：**精神HP（見える）**／**思いやり（見えない）**。
- 精神HPを削って勝つ＝言い負かす＝**凶暴へ**。思いやりを満たして勝つ＝寄り添って収める＝**優しさへ**。
- 「どう勝ったか」が分岐の記録。面白さ＝**勝ち方がそのまま人格になる**。
- 操作計測（クリック数/スキップ/読み飛ばし速度）を裏で取り、最後にメタ的に語りかける。
- セーブ/ロードは柔軟（パーマデスでない）。
- **★監督の追加要求**：なぜ相手は攻撃してきて、こちらは攻撃したり慰めたりする必要があるのか、**必然性のあるストーリー**にする。

### setting ideas memo（未確定・叩き台）
- 主人公名 L／word+l=world 伏線／L を露骨に出すか隠すか／学校＝言葉ショップ／村の秘密（ホラー系/優しい系/未定）／分岐先（裁判所・無人島）など。
- → **いずれも確定仕様ではない**。MVP では勝手に確定せず `HUMAN_DECISION_QUEUE.md` に積む。

### core systems（実装基盤・開発順）
1. 遷移の骨組みを空のまま一周つなぐ（タイトル→村→バトル→エンド→タイトル）
2. セーブ/ロードを早めに入れる
3. バトル1戦を1体ぶん完成させる
4. エリア進行の型を最初の村で1本通す
- → 本 MVP はここまでの範囲を尊重して実装する。

---

## 2. Orchestrator（AI Development Orchestrator）の判断

| 観点 | 判断 |
|---|---|
| 規模 | **L**（ゼロからの新規縦スライス＋複数サブシステム交差＋創作未確定点が多く承認ゲート複数） |
| 4つ目をどこに追加するか | `prototypes/04-kotoba-no-android/`（既存プロトと同じ独立フォルダ方式） |
| MVP スコープ | 単一ループ：タイトル→村フィールド→NPC会話→言葉カード3択→口喧嘩バトル1戦→結果/簡易エンド→タイトル |
| #03 との差別化 | 別タイトル・別パレット（涼ラベンダー）・別フィールド操作（クリック移動）・別必然性フレーム（暴力禁止の村）・あだ名「ルゥ」（型番ではない）・word→world 演出は使わない |
| 既存への影響リスク | **追加のみ**。共有3ファイル（root index.html / prototypes/README.md / root README.md）は「4番目の行/カード」を追記するだけ。01〜03 は文字単位で不変 |
| 検証 | node 不可 → `osascript -l JavaScript`（JXA ヘッドレス）＋ `python3 -m http.server` |
| 公開（push） | **人間承認後**（studio の Human Approval Gatekeeper 方針に従い、push＝公開は最終ゲート） |

---

## 3. 使用した／参照したエージェント・Skills

実体のオーケストレーションは Claude Code のメイン会話が兼任（サブエージェント入れ子不可）。
今回はダイナミックワークフローで以下のペルソナを起用（`.claude/agents/**` の実在仕様を各エージェントが Read して役を演じた）。

**Design Studio ワークフロー（8 エージェント・約 50 万 tokens）**
- operations: `ai-development-orchestrator`, `requirement-clarification`, `task-decomposition`, `project-manager`, `human-approval-gatekeeper`（方針）, `diff-audit`（方針）
- core-systems: `game-architecture-director`, `state-management-architect`, `save-load-system-engineer`, `event-flag-system-architect`, `data-schema-designer`
- battle: `battle-concept-designer`, `battle-system-programmer`, `balance-simulation`, `enemy-behavior-designer`
- narrative: `narrative-design-director`, `scenario-writer`, `dialogue-branch-designer`, `text-originality-humor-critic`
- ui-ux: `ui-ux-design-director`, `hud-designer`, `control-feel-designer`, `accessibility-review`
- coherence/critic 合議（balance-simulation + narrative-consistency-qa + diff-audit 視点）

**QA & Audit Studio ワークフロー（実装後）**
- qa: `critical-path-qa`, `save-data-qa`, `regression-qa`, `narrative-consistency-qa`, `release-readiness-qa`
- operations: `diff-audit`

**Skills（参照）**: `doopa-new`（新プロト追加の手順・3箇所ハブ登録・PR フロー・main 直 push 禁止）、`audit-game-diff`（差分監査）、`run-game-qa`、`prepare-release-check`。

**不足・名前差異の報告**: 監督指定の役割はすべて `.claude/agents` 配下に実在した。
対応関係：Battle系→`battle/*`、Narrative系→`narrative/*`、UI/UX系→`ui-ux/*`、QA系→`qa/*`、Build/DevOps→`core-systems/build-devops-engineer`。**不足エージェントなし**。

---

## 4. 既存構成への追加方法

```
doopa/
├── index.html                      ← #04 カードを1枚“追記”（01-03 は不変）
├── README.md                       ← 表に #04 行を“追記”
├── prototypes/
│   ├── README.md                   ← 表に #04 行を“追記”
│   ├── 01-dopamine-feed/           （不変）
│   ├── 02-saigo-no-tomodachi/      （不変）
│   ├── 03-word-to-world/           （不変）
│   └── 04-kotoba-no-android/       ← ★新規
│       ├── index.html
│       ├── style.css
│       ├── README.md
│       ├── docs/GDD.md
│       ├── js/{data,audio,metrics,state,save,battle,cards,field,ui,main}.js
│       └── tools/{headless-check,ui-syntax-check}.js
└── docs/prototypes/04/             ← ★本計画群（IMPLEMENTATION_PLAN/MVP_SCOPE/HUMAN_DECISION_QUEUE/QA_CHECKLIST）
```

- **技術方針は house に完全準拠**：純 HTML/CSS/JS・ビルドなし・依存ゼロ・`file://` で動く。ES Modules 不使用、通常 `<script>` + `window` 直書き共有、読込順 `data→audio→metrics→state→save→battle→cards→field→ui→main`。
- **DOM 非依存コア**（data/audio/metrics/state/save/battle/cards/field）は末尾に `if (typeof window !== "undefined")` の export guard を置き、JXA から文字列 eval でヘッドレス検証できるようにする。
- **セーブキーは 04 専用** `kotoba_save_v1`（#03 の `wo_rd_save_v1` と衝突しない）。

> 配置についての調整理由：監督指定どおり `docs/prototypes/04/` に計画群を置いた。
> 既存の `docs/ai-studio/` はスタジオ運用ドキュメント（横断）なので別系統として温存し、本プロト固有の計画は `docs/prototypes/04/` に分離した。

---

## 5. 実装ステップ（core systems の開発順に対応）

| 順 | 内容 | 対応 core systems |
|---|---|---|
| 1 | 計画群（本ファイル群）作成 | — |
| 2 | 04 フォルダ＋10 本の js 骨格＋index.html（読込順配線） | step1 |
| 3 | state.js（FSM・傾向2軸・フラグ・結果判定） | step1 |
| 4 | data.js（言葉カード/敵/NPC/結果文/タイトル文・正典） | step1/3 |
| 5 | metrics.js（clicks/skip/dwell/cursor） | — |
| 6 | save.js（localStorage 最小・metrics往復・つづきから） | step2 |
| 7 | battle.js（2ゲージ・harsh/kind・敵ターン・両ルート勝利・勝ち方記録） | step3 |
| 8 | cards.js（3択生成・選択で人格を傾ける） | — |
| 9 | field.js（村フィールド・ノード近接・会話/出口） | step4 |
| 10 | ui.js + style.css（描画・思いやり非表示・別パレット・結果メタ1行） | step1/4 |
| 11 | main.js（配線・rAF・クリック計測・遷移） | step1 |
| 12 | tools（headless-check / ui-syntax-check）＋ README/GDD | — |
| 13 | ハブ3ファイルへ #04 追記 | — |
| 14 | QA（JXA + python3）→ QA/Audit ワークフロー → デプロイ導線 | — |

---

## 6. 影響範囲

- **新規追加**：`prototypes/04-kotoba-no-android/**`、`docs/prototypes/04/**`
- **追記のみ（01-03 行は不変）**：`index.html`（#04 カード1枚）、`prototypes/README.md`（表1行）、`README.md`（表1行）
- **無改変**：`prototypes/01-*`, `prototypes/02-*`, `prototypes/03-*`、共通 CSS/footer、deploy 設定、`.github/**`
- リポジトリ作業域は `~/Projects/ai-workspace/99_sandbox/doopa/` のみ。削除・上書きは行わない（安全方針）。

---

## 7. デプロイ方針

- GitHub Pages は `main` 直下から静的配信（ビルドなし）。新プロトは push→merge で公開される。
- `doopa-new` skill の規約に従い **main 直 push 禁止**。`proto/04-kotoba-no-android` ブランチを切ってコミット。
- **本環境に `gh` CLI なし／HTTPS push 認証は未確認** のため、AI 側は **ローカルブランチへのコミットまで**実施し、
  push＝公開は **Human Approval Gatekeeper のゲート（人間承認）** として提示する（コマンドと PR 比較 URL を用意）。
- 検証は `osascript -l JavaScript`（JXA ヘッドレス）と `python3 -m http.server`（実機）で行い、node は使わない。

詳細な合否は `QA_CHECKLIST.md`、入れた/入れない/仮置きは `MVP_SCOPE.md`、未確定論点は `HUMAN_DECISION_QUEUE.md` を参照。
