import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const dashboardRoot = process.cwd();
const projectRoot = path.resolve(dashboardRoot, "..");
const snapshotPath = firstExistingPath([
  path.join(projectRoot, "watchlist", "00_market_snapshots", "market_price_snapshot_2026-05-13.json"),
  path.join(projectRoot, "watchlist", "market_price_snapshot_2026-05-13.json")
]);
const outputPath = path.join(dashboardRoot, "data", "market.local.json");
const explicitTickers = process.argv.slice(2).map((ticker) => ticker.toUpperCase());

const fallbackSnapshot = await readJson(snapshotPath, { rows: [] });
const fallbackRows = new Map((fallbackSnapshot.rows ?? []).map((row) => [row.ticker.toUpperCase(), row]));
const tickers = explicitTickers.length
  ? explicitTickers
  : Array.from(
      new Set([
        "IREN",
        "NBIS",
        "MU",
        "POWL",
        "FORM",
        "OSS",
        "CRDO",
        "AAOI",
        "SNDK",
        "SIMO",
        "WTS",
        "BMI",
        "OKLO",
        "SMR",
        "XE",
        "CEG",
        "GEV",
        "TEM",
        "RCAT",
        "ONDS",
        "AMD",
        "MRVL",
        "SMCI",
        "DELL",
        "AVGO",
        "AMBA",
        "MP",
        "USAR",
        "CRWV",
        "CORZ",
        "APLD",
        "CIFR",
        ...fallbackRows.keys()
      ])
    );

const rows = [];
const errors = [];

for (const ticker of tickers) {
  try {
    const chart = await fetchChart(ticker);
    rows.push(toMarketRow(ticker, chart, fallbackRows.get(ticker)));
    process.stdout.write(".");
  } catch (error) {
    errors.push({ ticker, message: error instanceof Error ? error.message : String(error) });
    const fallback = fallbackRows.get(ticker);
    if (fallback) {
      rows.push({ ...fallback, ticker, stale: true, source: "tracked snapshot fallback" });
    }
    process.stdout.write("x");
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
  outputPath,
  JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      source: "Yahoo Finance chart endpoint with tracked snapshot market-cap fallback",
      rows,
      errors
    },
    null,
    2
  ),
  "utf8"
);

process.stdout.write(`\nWrote ${outputPath} (${rows.length} rows, ${errors.length} errors)\n`);

async function fetchChart(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=1y&interval=1d`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 local-investment-dashboard/1.0",
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error(payload.chart?.error?.description ?? "empty chart result");
  return result;
}

function toMarketRow(ticker, result, fallback) {
  const meta = result.meta ?? {};
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((value) => typeof value === "number");
  const latestClose = lastNumber(closes) ?? meta.regularMarketPrice ?? fallback?.price ?? null;
  const previousClose = closes.length >= 2 ? closes[closes.length - 2] : null;
  const change = latestClose !== null && previousClose !== null ? latestClose - previousClose : fallback?.change ?? null;
  const changeRate =
    change !== null && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : fallback?.changeRate ?? null;
  const high52 = meta.fiftyTwoWeekHigh ?? fallback?.high52 ?? null;
  const low52 = meta.fiftyTwoWeekLow ?? fallback?.low52 ?? null;

  return {
    ticker,
    name: meta.longName ?? meta.shortName ?? fallback?.name ?? ticker,
    price: round(latestClose),
    change: round(change),
    changeRate: round(changeRate),
    rsi14: computeRsi14(closes),
    high52: round(high52),
    low52: round(low52),
    marketCapUsdB: fallback?.marketCapUsdB ?? null,
    per: fallback?.per ?? null,
    pbr: fallback?.pbr ?? null,
    eps: fallback?.eps ?? null,
    volume: meta.regularMarketVolume ?? fallback?.volume ?? null,
    updatedAt: new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    source: "yahoo-chart"
  };
}

function computeRsi14(closes) {
  const values = closes.filter((value) => Number.isFinite(value));
  if (values.length < 15) return null;
  const recent = values.slice(-15);
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < recent.length; index += 1) {
    const delta = recent[index] - recent[index - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const averageGain = gains / 14;
  const averageLoss = losses / 14;
  if (averageLoss === 0) return 100;
  return round(100 - 100 / (1 + averageGain / averageLoss));
}

function lastNumber(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (typeof values[index] === "number" && Number.isFinite(values[index])) return values[index];
  }
  return null;
}

function round(value, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

async function readJson(filePath, fallback) {
  if (!filePath) return fallback;
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function firstExistingPath(filePaths) {
  for (const filePath of filePaths) {
    if (fsSync.existsSync(filePath)) {
      return filePath;
    }
  }
  return filePaths[0];
}
