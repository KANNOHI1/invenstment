# クラウド巡回の復旧手順（ローカルが動かなくなったとき）

2026-09-10にローカル一本化した。**通常はこの手順を使わない。**
ローカル（Task Scheduler `InvestmentMorningPatrol`）が復旧不能なときだけ使う。

**この手順はクラウドのClaude Codeセッションで実行する。ローカルからはRoutineを操作できない。**

---

## 前提: クラウド側は3つ止めてある

| 止めたもの | 状態 |
|---|---|
| Routine「相場観レポート（定期巡回）」 | `enabled: false`（**削除していない**） |
| price-snapshot.yml の定時実行（cron） | 削除済み |
| price-snapshot.yml の push起点 | 削除済み（`workflow_dispatch`のみ残存） |

**Routineだけ戻しても巡回は完走しない。** クラウドはegress遮断で
`node scripts/fetch_prices.mjs` が全銘柄403になるため、株価はGitHub Actions経由でしか取れない。
**必ず下の順番で両方戻す。**

---

## 手順1: 株価の取得経路を戻す

`.github/workflows/price-snapshot.yml` の `on:` を以下に戻し、commit・push する。

```yaml
on:
  workflow_dispatch:
  push:
    paths:
      - ".github/workflows/price-snapshot.yml"
      - "scripts/fetch_prices.mjs"
      - "scripts/fetch_filings.mjs"
      - "watchlist/.price-refresh-trigger"
      - "watchlist/.scan-tickers"
      - "watchlist/.rotation-tickers"
```

**cronは戻さない。** push起点だけで足りる（巡回の手順1が毎回pushする）。

**注意**: 監視対象に `.scan-tickers` / `.rotation-tickers` が含まれる。
**月初のゼロベース再構築でこれらを編集するとActionsが発火する。**
ローカルが同時に動いているなら株価JSONを二重に書き換える事故になるので、
**ローカルが完全に止まっていることを確認してから戻すこと。**

動作確認:
```bash
date -u +%Y-%m-%dT%H:%M:%SZ > watchlist/.price-refresh-trigger
git add watchlist/.price-refresh-trigger && git commit -m "price refresh trigger" && git push
# 約40秒後
git pull && node -e "console.log(require('./watchlist/latest_prices.json').rows[0].quoteTime)"
```
`quoteTime` が直近の米国終値に進んでいれば成功。

## 手順2: Routineの文面を差し替える

**そのまま有効化してはいけない。** 文面が「これまでの会話の続きとして実行してください」で始まっており、
`/clear` 後や新セッションでは噛み合わない。また株価取得の記述も古い可能性がある。

`mcp__Claude_Code_Remote__update_trigger` で `trigger_id: trig_01TUF9eRUquZFc1QAicAT2UK` に対し、
**`watchlist/trigger_prompt_v1.md` の区切り線（`---`）の間の本文をそのまま`prompt`に入れる。**
このファイルは新セッション前提で書かれており、
必要な文脈は `watchlist/rotation_state.md` と `watchlist/thesis_register.md` から復元する形になっている。

ただし `trigger_prompt_v1.md` は**ローカル前提**（`node scripts/fetch_prices.mjs` を直接実行）なので、
**手順1のGitHub Actions経由に読み替えて書き換えること。**

## 手順3: Routineを有効化する

```
update_trigger(trigger_id: "trig_01TUF9eRUquZFc1QAicAT2UK", enabled: true,
               name: "相場観レポート（定期巡回）")
```

- cron `0 23 * * 1-5`（平日 23:00 UTC ＝ 翌 08:00 JST）は変更しない
- `persistent_session_id: session_01XK9kDViRg8wT4ayssAaYHs` に固定されている。
  **そのセッションが `/clear` 済みでも、CLAUDE.md が自動で読まれるので文脈は復元できる**
- `list_triggers(enabled: true)` で有効化を確認する

## 手順4: CLAUDE.md を実態に合わせる

冒頭の「定期巡回について」がローカル前提のままなので、クラウド運用に戻したことを書く。
**嘘の記述を残さない**（2026-09-08に「Routineは停止済み」と書かれていて実際は稼働中、という食い違いが起きた）。

---

## 逆向き（ローカルへ戻すとき）

1. ローカルの `Start-ScheduledTask InvestmentMorningPatrol` で完走を確認
2. **時刻トリガーが自力で発火する**のを確認する（手動起動だけでは不十分。
   2026-09-10に `MultipleInstances=Parallel` の設定漏れで7:00起動が無視される不具合が実際にあった）
3. Routineを `enabled: false` に戻す（**削除しない**）
4. price-snapshot.yml の push起点を再度削除する
5. CLAUDE.md を更新する

---

## 関連ファイル

| 用途 | ファイル |
|---|---|
| 移植の全体像・ローカルの構成 | `HANDOVER_TO_LOCAL.md` |
| 巡回の起動指示文 | `watchlist/trigger_prompt_v1.md` |
| 巡回の仕様 | `watchlist/report_template_rotation.md` |
| 前回の座標（差分の基準） | `watchlist/rotation_state.md` |
| なぜローカルへ移したか | `research/data_source_limits.md` |
