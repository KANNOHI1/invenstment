# 決算自動監視ステータス

- 最終確認: 2026-05-11T23:26:54+09:00
- 監視方式: GitHub Actionsまたはローカル実行で、予定日周辺の公式IR/ニュースページを巡回
- 注意: 自動検出は一次確認の補助。最終判断は公式リリース本文を読んで反映する

## 監視対象

| 銘柄 | 予定日 | 時刻 | 優先度 | 山 | 状態 | シグナル | 詳細 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CEG | 2026-05-11 | 10:00 ET | high | nuclear_power_infrastructure | checked | changed, results_keyword | CEG investor event updated; CEG investor event has results keyword; CEG investor home has results keyword |
| OKLO | 2026-05-12 | after market close / 17:00 ET call | highest | nuclear_power_infrastructure | skip | outside_window | 巡回対象期間外 |
| NBIS | 2026-05-13 | before market open / 08:00 ET call | highest | neocloud_ai_datacenter | skip | outside_window | 巡回対象期間外 |
| TSEM | 2026-05-13 | 10:00 ET call | highest | optical_photonics | skip | outside_window | 巡回対象期間外 |
| 285A | 2026-05-15 | 15:30 JST | highest | memory_storage | skip | outside_window | 巡回対象期間外 |
| NTAP | 2026-05-28 | after market close / 17:30 ET webcast | medium | memory_storage | skip | outside_window | 巡回対象期間外 |

## 検出ログ

- 2026-05-11 23:26:54 `CEG` CEG investor event: ページ変化を検出。source: https://investors.constellationenergy.com/events/event-details/q1-2026-constellation-energy-corporation-earnings-conference-call/
