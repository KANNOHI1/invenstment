# Dashboard GitHub Pages Automation

## 方針

- 外出先のPC/スマホから見るため、`dashboard/`はGitHub Pagesへ静的デプロイする。
- リポジトリはpublic前提。保有ポジションも`dashboard/data/positions.public.json`として公開データにする。
- 証券口座ログイン、Cookie、APIキー、自動売買、外部送信は実装しない。

## 自動化フロー

1. `main`へのpush、手動実行、または平日スケジュールで`.github/workflows/dashboard-pages.yml`が起動する。
2. `dashboard/`で依存関係をインストールする。
3. `npm run market:update`で市場データを取得する。
4. `npm test`で計算ロジックと静的export補助ロジックを検証する。
5. `GITHUB_PAGES=true`で`npm run build`を実行し、`dashboard/out/`を生成する。
6. `.nojekyll`を追加し、Next.jsの`_next/`配下がGitHub Pagesで配信されるようにする。
7. Pages artifactをアップロードし、GitHub Pagesへデプロイする。

## 公開URL

Pages有効化後の想定URL:

```text
https://kannohi1.github.io/invenstment/
```

## ローカル確認

```powershell
cd C:\Users\c6341\Documents\Projects\invenstment\dashboard
npm run market:update
npm run check
npm run start
```

`npm run start`は`out/`を`http://127.0.0.1:4175`で配信する。

## GitHub側で必要な設定

- Repository Settings -> Pages -> Build and deployment -> Sourceを`GitHub Actions`にする。
- `dashboard-pages.yml`を含む変更を`main`へpushする。
- Actionsの`Dashboard Pages`が成功したら、PagesのURLをスマホで開く。

## 運用上の注意

- 市場データはGitHub Actionsの実行時点で静的HTMLに焼き込まれる。
- 手元で最新化したい場合は、GitHub Actionsの`Dashboard Pages`を手動実行する。
- 売買直前価格、取扱証券会社、注文条件は必ず証券会社画面で確認する。
