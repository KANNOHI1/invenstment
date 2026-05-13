# 個人用投資ダッシュボード 実装仕様書 - 2026-05-14

## 目的

このダッシュボードは、一般的な資産管理アプリではなく、ロマン枠投資の作戦司令室として作る。

対象は、`C:\Users\c6341\Documents\Projects\invenstment` に蓄積している `watchlist/`、`research/`、`scripts/`、決算監視結果、実際の保有ポジションを統合し、日々の判断を速くすること。

主な目的:

- 実保有ポジションの評価額、損益、比率を常に把握する。
- Watch銘柄の値動き、RSI、52週位置、テーマ山、買い候補度を一覧する。
- 注目銘柄が買いゾーンに近づいたら、ダッシュボード内で明確に表示する。
- 決算予定、決算検知、決算反映済み/未反映を追跡する。
- 各銘柄の爆益仮説、仮説崩れ条件、次に見る数字へすぐアクセスできるようにする。

## 実装場所

このリポジトリ内に `dashboard/` を新設する。

理由:

- 既存の `watchlist/` と `research/` を直接読み込める。
- 決算監視スクリプト `scripts/earnings_monitor.py` と連携しやすい。
- 投資判断メモ、監視データ、ダッシュボードを同じGit履歴で管理できる。

## 技術方針

推奨:

- Next.js + TypeScript
- ローカルJSONファイルによる永続化
- iOS Safari / PWA 前提のスマホファーストUI
- PC幅では左ナビ + 詳細ペインに自然展開

v1では、DBや認証は不要。

理由:

- ユーザー本人だけが見るローカルツール。
- 保有株数や取得単価は手入力で十分。
- 外部ログイン情報を保存しないことを優先する。

## デザイン方針

参照デザイン:

- `C:\Users\c6341\Documents\Projects\design-systems\design-md\linear.app\DESIGN.md`
- `C:\Users\c6341\Documents\Projects\design-systems\design-md\coinbase\DESIGN.md`
- `C:\Users\c6341\Documents\Projects\design-systems\design-md\airtable\DESIGN.md`

優先順位:

1. Linear: ダークモード、状態管理、監視ツール感
2. Coinbase: 金融ダッシュボード感、評価額/損益/CTA
3. Airtable: Watchlist表、フィルタ、タグ、データ密度

UI原則:

- スマホファースト、特にiOS Safari/PWA前提。
- ランディングページは作らない。最初の画面は実用ダッシュボード。
- 下部タブナビを基本にする。
- 情報密度は高くするが、カード内の文字詰め込みで読みにくくしない。
- CTAや重要アラート以外に派手な青を使いすぎない。
- 損益、RSI、決算未反映、買いゾーンを色とラベルで瞬時に区別する。

推奨タブ:

- ホーム
- 保有
- 監視
- 決算
- メモ

## v1の画面

### 1. ホーム

一番よく見る画面。

表示項目:

- 総評価額
- 総損益
- 日次損益
- 保有銘柄の簡易カード
- 今日見るべきアラート
- 買いゾーン接近銘柄
- 決算予定/決算検知
- 最近更新された投資メモ

初期保有:

- `IREN`: 58株、取得単価54.00ドル
- `NBIS`: 6株、取得単価207.93ドル

### 2. 保有

実ポジション管理画面。

表示項目:

- ティッカー
- 株数
- 取得単価
- 現在株価
- 評価額
- 損益額
- 損益率
- ポートフォリオ比率
- 役割
- 次に見る数字
- 仮説崩れ条件

v1では売買追加はJSON手入力でよい。UIからの編集はv1.5以降でよい。

### 3. 監視

Watch銘柄一覧。

表示項目:

- ティッカー
- 山/テーマ
- 現在株価
- 日次騰落率
- RSI 14
- 52週高値からの距離
- 52週安値からの距離
- 時価総額
- Forward P/Eが使える銘柄はForward P/E
- ARR/EV/BacklogなどPER以外で見る銘柄は専用指標
- 国内証券フィルター
- 買い候補度
- ステータス

フィルタ:

- 保有中
- 第1群候補
- 決算待ち
- 決算未反映
- RSI低下
- 52週高値から大きく下落
- 山別

### 4. 決算

既存の決算監視結果を表示する。

読み込み対象:

- `watchlist/earnings_monitor_schedule_2026-05-11.json`
- `research/00_earnings_monitor/earnings_monitor_status.md`
- `research/00_earnings_monitor/earnings_monitor_alerts.json`
- `watchlist/earnings_status_audit_2026-05-11.md`

表示項目:

- 銘柄
- 予定日
- 優先度
- 山
- 見るべき数字
- 監視状態
- 検知済み/未検知
- メモ反映済み/未反映
- 関連メモへのリンク

### 5. メモ

各銘柄の深掘りメモへアクセスする。

表示項目:

- 最近更新されたメモ
- 山別メモ
- 銘柄別メモ
- 購入候補比較
- 仮説崩れ条件
- 次アクション

## データ設計

### trackedに置くもの

以下はGit管理してよい。

- Watchlist定義
- 山別分類
- 決算予定
- 銘柄メモへのパス
- 買いアラートのテンプレート条件
- ダッシュボード実装コード

### trackedに置かないもの

以下は `.gitignore` 対象にする。

- `dashboard/data/positions.local.json`
- `dashboard/data/user-settings.local.json`
- `dashboard/data/imports/`
- 証券口座情報
- APIキー
- ブラウザCookie
- Money ForwardやSBIのログイン情報

### positions.local.json

初期ファイル例:

```json
{
  "currency": "USD",
  "positions": [
    {
      "ticker": "IREN",
      "shares": 58,
      "averageCost": 54.0,
      "openedAt": "2026-05-13",
      "role": "Neocloudロマン主力",
      "notes": "Microsoft/NVIDIA契約の稼働、AI Cloud売上、GPU financingを追跡"
    },
    {
      "ticker": "NBIS",
      "shares": 6,
      "averageCost": 207.93,
      "openedAt": "2026-05-13",
      "role": "大型Neocloud本命",
      "notes": "ARR成長、CapEx、debt、Q2でのEBITDA継続を追跡"
    }
  ]
}
```

### alerts.local.json

v1では手入力でよい。

例:

```json
{
  "alerts": [
    {
      "ticker": "IREN",
      "type": "watch_buy_zone",
      "conditions": {
        "rsiBelow": 45,
        "drawdownFrom52wHighBelow": -25
      },
      "message": "IRENが過熱から冷えたら追加検討"
    },
    {
      "ticker": "MU",
      "type": "watch_pullback",
      "conditions": {
        "rsiBelow": 55
      },
      "message": "MUはForward P/Eと次回決算前の押し目を確認"
    }
  ]
}
```

## 価格取得とRSI

v1ではボタン押下またはローカルスクリプトで更新する。

取得項目:

- 現在株価
- 日次騰落率
- 時価総額
- PER/PBR/EPS
- 52週高値/安値
- 過去日足
- RSI 14

初期実装では、既存の `watchlist/market_price_snapshot_2026-05-13.json` を読み込めるようにしつつ、更新スクリプトを別途作る。

注意:

- 金融データは不安定なので、画面上に最終更新時刻を必ず出す。
- 株価取得失敗時は古いデータを表示し、警告を出す。
- 売買判断前には証券会社画面で確認する前提を明記する。

## 買いアラート方針

アラートは「自動売買」ではない。あくまで検討サイン。

v1のアラート:

- RSI低下
- 52週高値からの下落
- 注目価格到達
- 決算前/決算後
- 決算検知済みだがメモ未反映
- 仮説崩れ条件に近い

表示レベル:

- `BUY WATCH`: 買い検討
- `WAIT`: 待ち
- `HOT`: 過熱
- `EVENT`: 決算/イベント待ち
- `BROKEN?`: 仮説崩れ確認

## 初期監視対象

最初に必ず読み込む銘柄:

- 保有: `IREN`, `NBIS`
- 第1群/主要: `MU`, `POWL`, `FORM`, `OSS`
- Neocloud: `CRWV`, `CORZ`, `APLD`, `CIFR`
- メモリ: `SNDK`, `SIMO`, `WDC`, `STX`
- 光通信: `CRDO`, `AAOI`, `LITE`, `COHR`
- 電力/原子力: `OKLO`, `SMR`, `XE`, `CEG`, `VST`, `GEV`
- 水: `WTS`, `TTI`, `BMI`
- 医療AI: `TEM`
- 防衛/エッジAI: `RCAT`, `ONDS`
- AIチップ: `NVDA`, `AMD`, `MRVL`, `AVGO`, `DELL`, `AMBA`, `SMCI`

## 実装フェーズ

### Phase 1: 土台

- `dashboard/`作成
- Next.js/TypeScript初期化
- PWA基本設定
- `.gitignore`にlocal dataを追加
- `positions.local.json`サンプル作成
- 既存watchlist JSON/Markdownを読み込むユーティリティ作成

### Phase 2: UI

- スマホ下部タブ
- ホーム画面
- 保有画面
- 監視画面
- 決算画面
- メモリンク画面

### Phase 3: データ更新

- 株価更新スクリプト
- RSI計算
- 52週位置計算
- 最終更新時刻表示
- 更新失敗時の警告

### Phase 4: アラート

- 買いアラート判定
- 決算未反映アラート
- 過熱アラート
- 保有銘柄の仮説崩れチェック表示

### Phase 5: 検証

- `npm run build`
- ローカル起動
- iPhone幅相当のレスポンシブ確認
- PC幅確認
- positions.local.jsonがGitに入らないことを確認

## 完了条件

- ローカルでダッシュボードが起動する。
- iOSスマホ幅でホーム/保有/監視/決算/メモが使える。
- `IREN`と`NBIS`の保有損益が表示される。
- Watch銘柄の価格、RSI、52週位置、ステータスが表示される。
- 決算監視結果が表示される。
- 買いアラート候補が表示される。
- 実装後、URLと確認結果が報告される。

## 別ターミナルCodexへの /goal 指示文

以下を別ターミナルのCodexに貼る。

```text
/goal C:\Users\c6341\Documents\Projects\invenstment の個人用投資ダッシュボードを最後まで実装してください。まず docs/dashboard_implementation_spec_2026-05-14.md、STATUS.md、AGENTS.md、watchlist/、research/、scripts/earnings_monitor.py を読んでください。実装場所はリポジトリ内の dashboard/ です。UIはスマホファースト、特にiOS Safari/PWA前提。PC幅でも大崩れしないレスポンシブにしてください。デザインは C:\Users\c6341\Documents\Projects\design-systems\design-md\linear.app\DESIGN.md を最優先、coinbase/DESIGN.md と airtable/DESIGN.md を補助として参照してください。ランディングページではなく、ロマン枠投資の作戦司令室を作ってください。

v1要件:
- 保有ポジションを dashboard/data/positions.local.json で手入力管理する。これはgitignore対象にする。
- 初期保有は IREN 58株 @54.00ドル、NBIS 6株 @207.93ドル。
- 現在株価を取得し、評価額、損益額、損益率、保有比率を表示する。
- Watch銘柄の現在株価、日次騰落率、RSI14、52週高値/安値からの距離、時価総額、山/テーマ、ステータスを表示する。
- 買いアラート候補を表示する。自動売買ではなく検討サインとして BUY WATCH / WAIT / HOT / EVENT / BROKEN? のように分類する。
- 決算スケジュール、決算監視ステータス、決算検知alert、反映済み/未反映を表示する。
- 銘柄詳細メモや購入候補比較Markdownへリンクできるようにする。
- SBI証券、Money Forward、証券口座への自動ログインや認証情報保存は実装しない。
- tracked fileに秘密情報、証券口座情報、positions.local.jsonを入れない。

実装後は npm run build を通し、ローカルで起動してURLを提示してください。可能ならスマホ幅とPC幅で表示崩れがないか確認してください。変更は確認後にコミットしてください。
```
