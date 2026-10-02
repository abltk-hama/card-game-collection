# PROJECT_AGENT_CONTEXT v1.0

## Document Status
|項目|値|
|---|---|
|Version|1.0|
|Status|設計中（確定事項と未決事項を区別）|

## Project Summary
- Purpose: TypeScriptでトランプゲームとUNO風ゲームを集めたゲーム集を作る。
- Scope: 相手が必要なゲームはAI対戦。UNO風ゲームにはオリジナル効果のカードを導入する。
- Current Phase: DESIGN / ALIGNMENT_REQUIRED。ゲームコードの実装開始は未承認。

## Working Agreement
- ユーザーの明示的な実装指示を受けてからコードを変更する。
- CODE_FACT、USER_DECISION、ENGINEERING_DECISIONを区別する。
- UNKNOWNはUNKNOWNのまま扱う。
- 未実施の検証をPASSと扱わない。
- 画像仕様書は明示依頼時のみ生成。生成する場合はGround Truth JSONを意味の正本、SVGを描画の正本、PNGを派生物とする。
- 設計記録はdocs/ai_discussion_log.mdに追記し、直近10件を超えた内容は別名の略歴Markdownへ移す。
- 本ファイルの今後の更新はAGENTS.mdに従い、承認後のみ行う。

## Canonical Sources
|対象|正本|
|---|---|
|プロジェクト運用|AGENTS.md|
|確定した目的・制約|PROJECT_AGENT_CONTEXT.md|
|設計議論・選択肢・実装案件|docs/ai_discussion_log.md|
|ゲームルール・API・依存|UNKNOWN（未作成・未選定）|

## Repository Structure
|Path|責務|
|---|---|
|.agents/skills/|テンプレート由来の作業手順（未記入の雛形）|
|docs/|設計記録|
|src/|未作成：ゲーム実装の候補配置先|
|tests/|未作成：テストの候補配置先|

## Skill Template
`.agents/skills/`の文書は標準作業手順の雛形。必要なときに対応文書を参照する。未記入部分は実施済み手順・確定ルールとして扱わない。

## Skill Routing
|作業|Skill|
|---|---|
|初回解析|repository-survey|
|新機能追加|feature-development|
|バグ修正|bug-fix|
|リファクタリング|refactoring|
|検証|validation|
|提案|proposal|

## Known Constraints
- USER_DECISION: 開発言語はTypeScript。
- USER_DECISION: スマートフォンから遊ぶことを主軸とする。
- USER_DECISION: 公開先はGitHub Pages。
- USER_DECISION: 相手が必要な場合はAI対戦。
- USER_DECISION: UNO風ゲームにオリジナル効果のカードを入れる。
- USER_DECISION: Projectテンプレートの適用を承認（2026-10-02）。

## Known Pitfalls
- 初期ゲーム、特殊カード効果、AI難易度、画面方向、フレームワークはUNKNOWN。
- GitHubリポジトリとPages設定・公開URLは未確認。公開作業は未実施。

## Improvement Candidates
未登録。

## Context Update Candidates
承認後に反映する。
