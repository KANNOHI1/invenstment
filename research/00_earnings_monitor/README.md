# 決算自動監視

## 目的

今後決算を控えている銘柄について、公式IRページやニュースページを定期巡回し、ページ変化や決算キーワードを検出する。

これは自動売買や自動判断ではない。役割は「決算が出た可能性を早く見つけて、公式一次情報を読むきっかけを作る」こと。

## 主要ファイル

| ファイル | 用途 |
| --- | --- |
| `watchlist\earnings_monitor_schedule_2026-05-11.json` | 監視対象、決算予定日、見るべき論点、公式ソース |
| `scripts\earnings_monitor.py` | GitHub Actions向けのクロスプラットフォーム監視スクリプト |
| `scripts\earnings_monitor.ps1` | ローカルPowerShell版の監視スクリプト |
| `research\00_earnings_monitor\earnings_monitor_status.md` | 最新の監視結果 |
| `research\00_earnings_monitor\earnings_monitor_state.json` | 差分検出用の状態ファイル |
| `research\00_earnings_monitor\earnings_monitor_alerts.json` | GitHub Issue通知に使う検知イベント |
| `research\00_earnings_monitor\raw\` | 変化検出時のHTMLスナップショット |
| `.github\workflows\earnings-monitor.yml` | GitHub Actionsで既知の決算予定日時だけ巡回する設定 |

## ローカル実行

```powershell
python scripts\earnings_monitor.py --lookahead-days 0 --lookback-days 0
```

HTMLスナップショットをローカルに残したい場合:

```powershell
python scripts\earnings_monitor.py --lookahead-days 0 --lookback-days 0 --save-raw
```

## GitHub Actionsで使う条件

- このフォルダをGitリポジトリ化する。
- GitHubへpushする。
- GitHub側でActionsを有効にする。
- GitHubの通知設定で、Issueのメール通知を受け取れる状態にする。
- `.github\workflows\earnings-monitor.yml`が、既知の決算予定日時だけ監視スクリプトを実行する。
- 決算直後に急ぎで見たい場合は、GitHub Actionsの`workflow_dispatch`で手動実行する。
- GitHub cronには年の指定がないため、決算シーズンが終わった古い日付cronは次回メンテナンスで削除する。
- 検知イベントがあれば、`Earnings alert: TICKER YYYY-MM-DD`というGitHub Issueを作成し、`KANNOHI1`へアサインする。
- GitHubの通知設定でIssue/Assignedのメール通知が有効なら、メールで気づける。
- 変化があれば、`research\00_earnings_monitor\`配下のステータスと状態ファイルをコミットする。
- raw HTMLはGitHubへコミットせず、ローカル確認用にだけ使う。

## 注意点

- 一部IRサイトはCloudflareやbot対策で取得できない場合がある。
- ページ変化は、決算発表以外の軽微なページ更新でも起きる。
- `results_keyword`は決算らしい語が含まれるという意味であり、決算本文を読んだことを意味しない。
- Issue通知は作業キューであり、売買判断ではない。
- 実際の投資判断に反映する前に、必ず公式リリース、10-Q/決算短信、決算資料を読む。
