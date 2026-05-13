# 決算/イベント自動監視ステータス

- 最終確認: 2026-05-13T15:20:06+00:00
- 監視方式: GitHub Actionsまたはローカル実行で、予定日周辺の公式IR/ニュース/イベントページを巡回
- 注意: 自動検出は一次確認の補助。最終判断は公式リリース本文を読んで反映する

## 監視対象

| 銘柄 | 種別 | 予定日 | 時刻 | 優先度 | 山 | 状態 | シグナル | 詳細 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CEG | earnings | 2026-05-11 | 10:00 ET | high | nuclear_power_infrastructure | skip | outside_window | 巡回対象期間外 |
| OKLO | earnings | 2026-05-12 | after market close / 17:00 ET call | highest | nuclear_power_infrastructure | skip | outside_window | 巡回対象期間外 |
| NBIS | earnings | 2026-05-13 | before market open / 08:00 ET call | highest | neocloud_ai_datacenter | checked | changed, results_keyword | NBIS date announcement updated; NBIS date announcement has results keyword; NBIS investor hub updated; NBIS investor hub has results keyword |
| TSEM | earnings | 2026-05-13 | 10:00 ET call | highest | optical_photonics | checked | changed, results_keyword | TSEM date announcement updated; TSEM date announcement has results keyword; TSEM investor news updated |
| USAR | earnings | 2026-05-13 | after market close / 17:00 ET call | high | rare_earth_magnets | checked | changed, results_keyword | USAR date announcement updated; USAR date announcement has results keyword; USAR investor home updated; USAR investor home has results keyword |
| ONDS | earnings | 2026-05-14 | before market open / 08:30 ET call | high | defense_edge_ai_drones | skip | outside_window | 巡回対象期間外 |
| 285A | earnings | 2026-05-15 | 15:30 JST | highest | memory_storage | skip | outside_window | 巡回対象期間外 |
| NTAP | earnings | 2026-05-28 | after market close / 17:30 ET webcast | medium | memory_storage | skip | outside_window | 巡回対象期間外 |
| MRVL | earnings | 2026-05-27 | after market close / 13:45 PT call | high | ai_chips_accelerators | skip | outside_window | 巡回対象期間外 |
| DELL | earnings | 2026-05-28 | 15:30 CDT | high | ai_chips_accelerators | skip | outside_window | 巡回対象期間外 |
| AMBA | earnings | 2026-05-28 | 13:30 PT | medium | ai_chips_accelerators | skip | outside_window | 巡回対象期間外 |
| TEM | investor_day | 2026-05-29 | 09:00 EDT | high | healthcare_ai | skip | outside_window | 巡回対象期間外 |
| AVGO | earnings | 2026-06-03 | after market close / 14:00 PT call | medium | ai_chips_accelerators | skip | outside_window | 巡回対象期間外 |

## 検出ログ

- 2026-05-13 15:20:06 `NBIS` NBIS date announcement: ページ変化を検出。source: https://nebius.com/newsroom/nebius-group-announces-date-of-first-quarter-2026-results-and-conference-call
- 2026-05-13 15:20:06 `NBIS` NBIS date announcement: 決算関連キーワードを検出。source: https://nebius.com/newsroom/nebius-group-announces-date-of-first-quarter-2026-results-and-conference-call
- 2026-05-13 15:20:06 `NBIS` NBIS investor hub: ページ変化を検出。source: https://nebius.com/investor-hub
- 2026-05-13 15:20:06 `NBIS` NBIS investor hub: 決算関連キーワードを検出。source: https://nebius.com/investor-hub
- 2026-05-13 15:20:06 `TSEM` TSEM date announcement: ページ変化を検出。source: https://www.globenewswire.com/news-release/2026/04/20/3276797/0/en/tower-semiconductor-announces-first-quarter-2026-financial-results-and-conference-call.html
- 2026-05-13 15:20:06 `TSEM` TSEM date announcement: 決算関連キーワードを検出。source: https://www.globenewswire.com/news-release/2026/04/20/3276797/0/en/tower-semiconductor-announces-first-quarter-2026-financial-results-and-conference-call.html
- 2026-05-13 15:20:06 `TSEM` TSEM investor news: ページ変化を検出。source: https://towersemi.com/investor-relations/
- 2026-05-13 15:20:06 `USAR` USAR date announcement: ページ変化を検出。source: https://investors.usare.com/news-releases/news-release-details/usa-rare-earth-announces-date-release-first-quarter-2026-results
- 2026-05-13 15:20:06 `USAR` USAR date announcement: 決算関連キーワードを検出。source: https://investors.usare.com/news-releases/news-release-details/usa-rare-earth-announces-date-release-first-quarter-2026-results
- 2026-05-13 15:20:06 `USAR` USAR investor home: ページ変化を検出。source: https://investors.usare.com/
- 2026-05-13 15:20:06 `USAR` USAR investor home: 決算関連キーワードを検出。source: https://investors.usare.com/
