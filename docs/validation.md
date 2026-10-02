# 初期版の検証結果

実施日：2026-10-02

|検証|結果|範囲|
|---|---|---|
|`pnpm test`|PASS|12件。ババ抜き・UNO風各100対戦、カード総数と重複、勝敗、特殊カード、山札枯渇、引いたカード制約、手番方向|
|`pnpm build`|PASS|TypeScript strict型検査とVite本番ビルド|
|ブラウザー操作|PASS|3ゲーム開始、神経衰弱2枚選択とAI進行、ババ抜き取得、UNO風シールドの色選択と確定|
|幅360pxの表示|PASS|ゲーム一覧と3ゲームでdocumentのscrollWidthとclientWidthが一致。縦スクロールバー分を除いた内容幅は345px|
|ブラウザーエラー|PASS|操作確認時のerrorログなし|
|本番プレビュー|PASS|`/card-game-collection/`でゲーム一覧表示|
|実機iOS・Android|NOT_RUN|実端末のタッチ・Safari・Chromeで確認が必要|
|GitHub Actions・Pages公開|PASS|mainへのpush、Pagesのworkflow方式有効化、公開ワークフロー37004912348の再実行2回目でbuild・deploy成功|
|公開URLでの起動|PASS|https://abltk-hama.github.io/card-game-collection/ で一覧表示と3ゲーム開始、ブラウザーerrorログなし|

初期版に途中保存はなく、再読み込みでゲームはリセットされる。

ゲーム仕様は `docs/ai_discussion_log.md` の詳細候補を実装。交換時に交換相手の手札が0枚になった場合、その相手が勝利する。山札が空でも出せるカードがある場合は引き分けにせず、手札を出すよう案内する。

`PROJECT_AGENT_CONTEXT.md` はテンプレート適用時点の記録。現在の承認・実装・検証状態は設計ログと本書を参照する。本ファイルの更新に合わせて同Contextを無断更新していない。
