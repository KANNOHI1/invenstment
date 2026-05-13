import fs from "node:fs";
import path from "node:path";
import {
  buildPortfolioRows,
  calcDrawdown,
  calcFromLow,
  classifyBuySignal,
  mergeMarketRows,
  type MarketInput,
  type PositionInput,
  type SignalLevel
} from "./dashboard-model";
import { MEMO_LINKS, WATCH_UNIVERSE, type WatchMeta } from "./watch-universe";

const dashboardRoot = process.cwd();
const projectRoot = path.resolve(dashboardRoot, "..");

type SnapshotFile = {
  as_of?: string;
  rows?: MarketInput[];
};

type LocalMarketFile = {
  updatedAt?: string;
  source?: string;
  rows?: MarketInput[];
  errors?: { ticker: string; message: string }[];
};

type PositionsFile = {
  currency?: string;
  positions?: PositionInput[];
};

type EarningsSchedule = {
  events?: EarningsEvent[];
};

export type EarningsEvent = {
  ticker: string;
  name?: string;
  hill?: string;
  kind?: string;
  expected_date: string;
  expected_time?: string;
  priority?: string;
  watch_points?: string[];
};

export type WatchRow = WatchMeta & {
  market: MarketInput | null;
  rsi14: number | null;
  drawdown52pct: number | null;
  fromLow52pct: number | null;
  signal: {
    level: SignalLevel;
    reason: string;
    score: number;
  };
  hasUpcomingEvent: boolean;
};

export type MemoEntry = {
  title: string;
  path: string;
  group: string;
  updatedAt?: string;
};

export type DashboardData = {
  generatedAt: string;
  positionsPath: string;
  marketUpdatedAt: string;
  marketSource: string;
  marketErrors: { ticker: string; message: string }[];
  portfolio: ReturnType<typeof buildPortfolioRows>;
  watchRows: WatchRow[];
  buyAlerts: WatchRow[];
  earnings: {
    events: (EarningsEvent & {
      monitorSignal: string;
      detected: boolean;
      reflected: boolean;
      memoPath?: string;
    })[];
    alertCount: number;
    statusUpdatedAt: string;
  };
  memos: MemoEntry[];
};

const fallbackPositions: PositionInput[] = [
  {
    ticker: "IREN",
    shares: 58,
    averageCost: 54,
    openedAt: "2026-05-13",
    role: "Neocloudロマン主力",
    notes: "Microsoft/NVIDIA契約の稼働、AI Cloud売上、GPU financingを追跡"
  },
  {
    ticker: "NBIS",
    shares: 6,
    averageCost: 207.93,
    openedAt: "2026-05-13",
    role: "大型Neocloud本命",
    notes: "ARR成長、CapEx、debt、Q2でのEBITDA継続を追跡"
  }
];

export function getDashboardData(): DashboardData {
  const snapshot = readJson<SnapshotFile>("watchlist/market_price_snapshot_2026-05-13.json", {});
  const localMarket = readJson<LocalMarketFile>("dashboard/data/market.local.json", {});
  const positionsFile = readJson<PositionsFile>("dashboard/data/positions.local.json", {});
  const schedule = readJson<EarningsSchedule>("watchlist/earnings_monitor_schedule_2026-05-11.json", {});
  const alertsFile = readJson<{ updated_at?: string; alerts?: { ticker: string; signal: string }[] }>(
    "research/00_earnings_monitor/earnings_monitor_alerts.json",
    {}
  );
  const statusText = readText("research/00_earnings_monitor/earnings_monitor_status.md");
  const auditText = readText("watchlist/earnings_status_audit_2026-05-11.md");

  const market = mergeMarketRows(snapshot.rows ?? [], localMarket.rows ?? []);
  const events = schedule.events ?? [];
  const upcomingTickers = new Set(
    events
      .filter((event) => daysUntil(event.expected_date) >= -1 && daysUntil(event.expected_date) <= 21)
      .map((event) => event.ticker.toUpperCase())
  );

  const portfolio = buildPortfolioRows(positionsFile.positions ?? fallbackPositions, market);
  const watchRows = WATCH_UNIVERSE.map((meta) => {
    const quote = market.get(meta.ticker);
    const drawdown52pct =
      numberOrNull((quote as MarketInput & { drawdown52pct?: number })?.drawdown52pct) ??
      calcDrawdown(quote?.price, quote?.high52);
    const fromLow52pct =
      numberOrNull((quote as MarketInput & { fromLow52pct?: number })?.fromLow52pct) ??
      calcFromLow(quote?.price, quote?.low52);
    const hasUpcomingEvent = upcomingTickers.has(meta.ticker);
    const signal = classifyBuySignal({
      ticker: meta.ticker,
      rsi14: quote?.rsi14,
      drawdown52pct,
      fromLow52pct,
      changeRate: quote?.changeRate,
      hasUpcomingEvent,
      thesisBroken: meta.status.includes("条件付き") && (drawdown52pct ?? 0) <= -60
    });
    return {
      ...meta,
      market: quote ?? null,
      rsi14: quote?.rsi14 ?? null,
      drawdown52pct,
      fromLow52pct,
      signal,
      hasUpcomingEvent
    };
  }).sort((a, b) => b.signal.score - a.signal.score || a.ticker.localeCompare(b.ticker));

  const alertTickers = new Set((alertsFile.alerts ?? []).map((alert) => alert.ticker.toUpperCase()));
  const memoByTicker = new Map(WATCH_UNIVERSE.map((meta) => [meta.ticker, meta.memoPath]));
  const earningsEvents = events.map((event) => {
    const ticker = event.ticker.toUpperCase();
    const reflected = reflectedInResearch(ticker, auditText);
    return {
      ...event,
      monitorSignal: extractSignalLine(statusText, ticker),
      detected: alertTickers.has(ticker),
      reflected,
      memoPath: memoByTicker.get(ticker)
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    positionsPath: path.join(projectRoot, "dashboard", "data", "positions.local.json"),
    marketUpdatedAt: localMarket.updatedAt ?? snapshot.as_of ?? "未更新",
    marketSource: localMarket.source ?? "tracked snapshot fallback",
    marketErrors: localMarket.errors ?? [],
    portfolio,
    watchRows,
    buyAlerts: watchRows.filter((row) => row.signal.level !== "WAIT").slice(0, 12),
    earnings: {
      events: earningsEvents,
      alertCount: alertsFile.alerts?.length ?? 0,
      statusUpdatedAt: alertsFile.updated_at ?? "未取得"
    },
    memos: getMemoEntries()
  };
}

export function readProjectMarkdown(relativePath: string): string | null {
  const resolved = safeProjectPath(relativePath);
  if (!resolved || !resolved.endsWith(".md") || !fs.existsSync(resolved)) return null;
  return fs.readFileSync(resolved, "utf8");
}

function getMemoEntries(): MemoEntry[] {
  const fromStatic = MEMO_LINKS.map((entry) => ({ ...entry, updatedAt: getMtime(entry.path) }));
  const recent = listMarkdownFiles(["research", "watchlist"])
    .filter((entry) => !fromStatic.some((staticEntry) => staticEntry.path === entry.path))
    .slice(0, 24);
  return [...fromStatic, ...recent];
}

function listMarkdownFiles(relativeDirs: string[]): MemoEntry[] {
  const files: MemoEntry[] = [];
  for (const dir of relativeDirs) {
    const start = safeProjectPath(dir);
    if (!start || !fs.existsSync(start)) continue;
    walk(start, files);
  }

  return files.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

function walk(current: string, files: MemoEntry[]): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "raw") continue;
      walk(full, files);
      continue;
    }
    if (!entry.name.endsWith(".md")) continue;
    const relative = path.relative(projectRoot, full).replaceAll("\\", "/");
    files.push({
      title: entry.name.replace(/_/g, " ").replace(/\.md$/, ""),
      path: relative,
      group: relative.startsWith("watchlist") ? "watchlist" : relative.split("/")[1] ?? "research",
      updatedAt: fs.statSync(full).mtime.toISOString()
    });
  }
}

function extractSignalLine(statusText: string, ticker: string): string {
  const line = statusText
    .split(/\r?\n/)
    .find((row) => row.startsWith(`| ${ticker} |`) || row.includes(`| ${ticker} |`));
  if (!line) return "未監視";
  const columns = line.split("|").map((column) => column.trim());
  return columns[7] || "no_signal";
}

function reflectedInResearch(ticker: string, auditText: string): boolean {
  const index = auditText.indexOf(`| ${ticker} |`);
  if (index === -1) return false;
  const segment = auditText.slice(index, index + 220);
  return segment.includes("反映済み") || segment.includes("確認済み") || segment.includes("深掘り済み");
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00+09:00`).getTime();
  const today = new Date();
  return Math.floor((target - today.getTime()) / 86_400_000);
}

function readJson<T>(relativePath: string, fallback: T): T {
  const resolved = safeProjectPath(relativePath);
  if (!resolved || !fs.existsSync(resolved)) return fallback;
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as T;
}

function readText(relativePath: string): string {
  const resolved = safeProjectPath(relativePath);
  if (!resolved || !fs.existsSync(resolved)) return "";
  return fs.readFileSync(resolved, "utf8");
}

function getMtime(relativePath: string): string | undefined {
  const resolved = safeProjectPath(relativePath);
  if (!resolved || !fs.existsSync(resolved)) return undefined;
  return fs.statSync(resolved).mtime.toISOString();
}

function safeProjectPath(relativePath: string): string | null {
  const resolved = path.resolve(projectRoot, relativePath);
  return resolved.startsWith(projectRoot) ? resolved : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
