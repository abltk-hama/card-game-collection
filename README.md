# ひとやすみカード部

スマートフォンの縦画面を中心に遊べるTypeScript製カードゲーム集。神経衰弱・ババ抜き・カラーマッチ（UNO風）をAIと対戦できます。

## 開発

Node.js 22.18以降とpnpm 11.19.0を使用します。

````sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm preview
````

開発URLは `http://127.0.0.1:5173/card-game-collection/`。画面・ルール・AIの処理はブラウザー内で完結します。

## ゲーム

- 神経衰弱：24枚、AIと1対1。公開済みカードをAIが記憶します。
- ババ抜き：53枚、自分＋AI3人。最後にジョーカーが残った人が負け。
- カラーマッチ：自分＋AI3人、各7枚。独自カードをオン／オフできます。

交換は相手と残りの手札を交換、シールドはドローを1回防御、全員ドローは自分以外が1枚引きます。カード効果処理後に手札0枚の人が勝利。交換を最後のカードとして使い、相手の手札が0枚になった場合は相手の勝利です。+2・+4の積み重ね・UNO宣言・チャレンジはありません。詳しい説明は各ゲームの「遊び方」を参照してください。

## GitHub Pages

`vite.config.ts` は `/card-game-collection/` を公開パスに設定しています。

1. GitHubのリポジトリで **Settings → Pages → Source → GitHub Actions** を選択します。
2. `main` にpushすると `.github/workflows/pages.yml` がテスト・ビルド・公開を実行します。
3. 公開成功後の予定URL：`https://abltk-hama.github.io/card-game-collection/`。

公開設定・push・リモートでの実行が完了するまでは公開済みではありません。

## 制約

途中保存・オンライン対戦は初期版に含みません。画面を再読み込みするとゲームがリセットされます。カラーマッチは独自のルール・表示で作成したUNO風ゲームです。
