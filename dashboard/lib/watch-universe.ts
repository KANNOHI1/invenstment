export type WatchMeta = {
  ticker: string;
  hill: string;
  hillLabel: string;
  status: string;
  broker: string;
  memoPath?: string;
  thesis?: string;
  breakSignal?: string;
};

export const WATCH_UNIVERSE: WatchMeta[] = [
  {
    ticker: "IREN",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud",
    status: "保有中 / 第1群",
    broker: "SBI/Monex確認",
    memoPath: "research/neocloud_ai_datacenter/iren_deep_dive_2026-05-13.md",
    thesis: "NVIDIA契約、AI Cloud、5GW power",
    breakSignal: "GPU financingと粗利率が崩れる"
  },
  {
    ticker: "NBIS",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud",
    status: "保有中 / 決算後再採点",
    broker: "SBI/Monex確認",
    memoPath: "research/neocloud_ai_datacenter/nbis_q1_2026_update_2026-05-13.md",
    thesis: "ARR、contracted revenue、GPU capacity ramp",
    breakSignal: "CapExとdebtが成長を上回る"
  },
  {
    ticker: "MU",
    hill: "memory_storage",
    hillLabel: "メモリ/HBM",
    status: "第1群",
    broker: "SBI/Monex/Rakuten確認",
    memoPath: "research/memory_storage/mu_deep_dive_2026-05-07.md",
    thesis: "AI/HBMで利益水準が変わる大型再評価"
  },
  {
    ticker: "POWL",
    hill: "ai_physical_infrastructure",
    hillLabel: "AI物理インフラ",
    status: "第1群",
    broker: "SBI/Monex確認",
    memoPath: "research/ai_physical_infrastructure/powl_deep_dive_2026-05-09.md",
    thesis: "受注とbacklogでAI電力制御の再評価"
  },
  {
    ticker: "FORM",
    hill: "optical_photonics",
    hillLabel: "光/HBM検査",
    status: "第1群 / サイズ再考",
    broker: "SBI/Monex確認",
    memoPath: "research/optical_photonics/form_deep_dive_2026-05-07.md",
    thesis: "HBM/DRAM検査ボトルネック"
  },
  {
    ticker: "OSS",
    hill: "defense_edge_ai_drones",
    hillLabel: "防衛/エッジAI",
    status: "第1群 / 小型オプション",
    broker: "SBI/Monex確認",
    memoPath: "research/defense_edge_ai_drones/oss_deep_dive_2026-05-12.md",
    thesis: "Q1売上+55%、book-to-bill 1.8倍"
  },
  {
    ticker: "SNDK",
    hill: "memory_storage",
    hillLabel: "メモリ/SSD",
    status: "第2群 / 高期待",
    broker: "SBI/Monex/Rakuten確認",
    memoPath: "research/memory_storage/sndk_deep_dive_2026-05-07.md"
  },
  {
    ticker: "SIMO",
    hill: "memory_storage",
    hillLabel: "メモリ/コントローラ",
    status: "第2群",
    broker: "SBI/Monex確認",
    memoPath: "research/memory_storage/simo_deep_dive_2026-05-07.md"
  },
  {
    ticker: "WDC",
    hill: "memory_storage",
    hillLabel: "メモリ/HDD",
    status: "テーマ確認",
    broker: "Monex確認",
    memoPath: "research/memory_storage/wdc_deep_dive_2026-05-07.md"
  },
  {
    ticker: "STX",
    hill: "memory_storage",
    hillLabel: "HDD",
    status: "テーマ確認",
    broker: "Monex確認",
    memoPath: "research/memory_storage/stx_deep_dive_2026-05-07.md"
  },
  {
    ticker: "CRDO",
    hill: "optical_photonics",
    hillLabel: "光通信",
    status: "購入候補 / 高倍率",
    broker: "SBI/Monex確認",
    memoPath: "research/optical_photonics/crdo_deep_dive_2026-05-08.md"
  },
  {
    ticker: "AAOI",
    hill: "optical_photonics",
    hillLabel: "光通信",
    status: "購入候補 / 粗利率待ち",
    broker: "SBI/Monex確認",
    memoPath: "research/optical_photonics/aaoi_deep_dive_2026-05-08.md"
  },
  {
    ticker: "LITE",
    hill: "optical_photonics",
    hillLabel: "光通信大型",
    status: "大型本命監視",
    broker: "Monex確認"
  },
  {
    ticker: "COHR",
    hill: "optical_photonics",
    hillLabel: "光通信大型",
    status: "大型本命監視",
    broker: "Monex確認"
  },
  {
    ticker: "OKLO",
    hill: "nuclear_power_infrastructure",
    hillLabel: "原子力/SMR",
    status: "決算後更新待ち",
    broker: "Monex確認",
    memoPath: "research/nuclear_power_infrastructure/oklo_bwxt_be_large_power_check_2026-05-11.md"
  },
  {
    ticker: "SMR",
    hill: "nuclear_power_infrastructure",
    hillLabel: "原子力/SMR",
    status: "購入候補",
    broker: "Monex確認",
    memoPath: "research/nuclear_power_infrastructure/smr_deep_dive_2026-05-11.md"
  },
  {
    ticker: "XE",
    hill: "nuclear_power_infrastructure",
    hillLabel: "原子力/SMR",
    status: "IPO後初回開示待ち",
    broker: "要注文画面確認",
    memoPath: "research/nuclear_power_infrastructure/xe_deep_dive_2026-05-11.md"
  },
  {
    ticker: "CEG",
    hill: "nuclear_power_infrastructure",
    hillLabel: "電力大型",
    status: "大型本命確認",
    broker: "Monex確認",
    memoPath: "research/nuclear_power_infrastructure/ceg_q1_2026_update_2026-05-11.md"
  },
  {
    ticker: "GEV",
    hill: "nuclear_power_infrastructure",
    hillLabel: "電力大型",
    status: "テーマ確認",
    broker: "Monex確認"
  },
  {
    ticker: "WTS",
    hill: "water_cooling_infrastructure",
    hillLabel: "水/冷却",
    status: "第2群",
    broker: "SBI/Monex確認",
    memoPath: "research/water_cooling_infrastructure/wts_deep_dive_2026-05-10.md"
  },
  {
    ticker: "BMI",
    hill: "water_cooling_infrastructure",
    hillLabel: "水/反転",
    status: "反転確認待ち",
    broker: "Monex確認",
    memoPath: "research/water_cooling_infrastructure/bmi_deep_dive_2026-05-11.md"
  },
  {
    ticker: "TEM",
    hill: "healthcare_ai",
    hillLabel: "医療AI",
    status: "Investor Day待ち",
    broker: "Monex確認",
    memoPath: "research/healthcare_ai/healthcare_ai_source_notes_2026-05-12.md"
  },
  {
    ticker: "RCAT",
    hill: "defense_edge_ai_drones",
    hillLabel: "防衛/ドローン",
    status: "第2群",
    broker: "SBI/Monex確認",
    memoPath: "research/defense_edge_ai_drones/rcat_deep_dive_2026-05-12.md"
  },
  {
    ticker: "ONDS",
    hill: "defense_edge_ai_drones",
    hillLabel: "防衛/ドローン",
    status: "決算待ち",
    broker: "SBI/Monex確認",
    memoPath: "research/defense_edge_ai_drones/ondas_pre_q1_check_2026-05-12.md"
  },
  {
    ticker: "AMD",
    hill: "ai_chips_accelerators",
    hillLabel: "AIチップ",
    status: "大型3倍候補",
    broker: "SBI/Monex/Rakuten確認",
    memoPath: "research/ai_chips_accelerators/amd_deep_dive_2026-05-12.md"
  },
  {
    ticker: "MRVL",
    hill: "ai_chips_accelerators",
    hillLabel: "AIチップ",
    status: "決算待ち",
    broker: "Monex確認"
  },
  {
    ticker: "SMCI",
    hill: "ai_chips_accelerators",
    hillLabel: "AIサーバー",
    status: "条件付き候補",
    broker: "SBI/Monex確認",
    memoPath: "research/ai_chips_accelerators/smci_deep_dive_2026-05-12.md",
    breakSignal: "粗利率/運転資金/輸出管理が悪化"
  },
  {
    ticker: "DELL",
    hill: "ai_chips_accelerators",
    hillLabel: "AIサーバー",
    status: "決算待ち",
    broker: "SBI/Monex/Rakuten確認",
    memoPath: "research/ai_server_infrastructure/dell_deep_dive_2026-05-07.md"
  },
  {
    ticker: "AVGO",
    hill: "ai_chips_accelerators",
    hillLabel: "AIチップ大型",
    status: "決算待ち",
    broker: "Monex確認"
  },
  {
    ticker: "AMBA",
    hill: "ai_chips_accelerators",
    hillLabel: "エッジAI SoC",
    status: "決算待ち",
    broker: "SBI/Monex確認"
  },
  {
    ticker: "MP",
    hill: "rare_earth_magnets",
    hillLabel: "希土類",
    status: "品質本命",
    broker: "SBI/Monex確認"
  },
  {
    ticker: "USAR",
    hill: "rare_earth_magnets",
    hillLabel: "希土類",
    status: "決算後比較待ち",
    broker: "SBI/Monex確認"
  },
  {
    ticker: "CRWV",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud大型",
    status: "大型本命監視",
    broker: "SBI/Monex確認",
    memoPath: "research/neocloud_ai_datacenter/crwv_deep_dive_2026-05-13.md"
  },
  {
    ticker: "CORZ",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud",
    status: "購入候補",
    broker: "SBI/Monex確認"
  },
  {
    ticker: "APLD",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud",
    status: "購入候補",
    broker: "SBI/Monex確認"
  },
  {
    ticker: "CIFR",
    hill: "neocloud_ai_datacenter",
    hillLabel: "Neocloud",
    status: "高リスク監視",
    broker: "SBI/Monex確認"
  }
];

export const MEMO_LINKS = [
  {
    title: "横断ポジション設計",
    path: "watchlist/romance_portfolio_position_design_2026-05-12.md",
    group: "横断"
  },
  {
    title: "投資候補ショートリスト",
    path: "watchlist/romance_portfolio_shortlist_2026-05-12.md",
    group: "横断"
  },
  {
    title: "全Watch再評価",
    path: "watchlist/all_watch_revaluation_2026-05-13.md",
    group: "横断"
  },
  {
    title: "決算状況監査",
    path: "watchlist/earnings_status_audit_2026-05-11.md",
    group: "決算"
  },
  {
    title: "国内証券フィルター",
    path: "watchlist/broker_availability_2026-05-07.md",
    group: "実行前確認"
  }
];
