// 保有・監視銘柄の株価を取得して watchlist/latest_prices.json に書き出す。
// GitHub Actions のランナー上で実行する前提（実行環境のプロキシ制限を回避するため）。
// 依存パッケージなし。Node 20+ の fetch を使用。

import fs from "node:fs/promises";
import path from "node:path";

const TICKERS = process.argv.slice(2).length
  ? process.argv.slice(2).map((t) => t.toUpperCase())
  : ["IREN", "NBIS", "MU", "SIMO", "MOD", "CRWV", "POWL", "SNDK", "NVDA"];

const rows = [];
const errors = [];

for (const ticker of TICKERS) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2mo&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 price-snapshot/1.0", Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error(json.chart?.error?.description ?? "empty result");

    const meta = result.meta ?? {};
    const price = meta.regularMarketPrice ?? null;
    // meta.chartPreviousClose はレンジ開始前の終値なので日次騰落には使えない。
    // 実際の前営業日終値は closes 配列の末尾から2番目を使う。
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((v) => typeof v === "number");
    const prev =
      closes.length >= 2 && Math.abs(closes[closes.length - 1] - price) < 0.01
        ? closes[closes.length - 2]
        : (closes.length >= 1 ? closes[closes.length - 1] : null) ?? meta.previousClose ?? null;
    const change = price !== null && prev !== null ? price - prev : null;
    const changePct = change !== null && prev ? (change / prev) * 100 : null;

    rows.push({
      ticker,
      price: round(price),
      previousClose: round(prev),
      change: round(change),
      changePct: round(changePct),
      currency: meta.currency ?? null,
      marketState: meta.marketState ?? null,
      // 取得時点を必ず残す。これが無い数値は使わない。
      quoteTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      fiftyTwoWeekHigh: round(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: round(meta.fiftyTwoWeekLow),
      // 軌跡（線）。点だけを見て方向を語る誤りを防ぐため、計算済みの値を必ず添える。
      trajectory: buildTrajectory(
        (result.timestamp ?? [])
          .map((ts, i) => ({
            date: new Date(ts * 1000).toISOString().slice(0, 10),
            close: round(result.indicators?.quote?.[0]?.close?.[i])
          }))
          .filter((d) => d.close !== null),
        price
      ),
      history: (result.timestamp ?? [])
        .map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().slice(0, 10),
          close: round(result.indicators?.quote?.[0]?.close?.[i])
        }))
        .filter((d) => d.close !== null)
    });
    process.stdout.write(".");
  } catch (e) {
    errors.push({ ticker, message: e instanceof Error ? e.message : String(e) });
    process.stdout.write("x");
  }
}

const out = {
  fetchedAt: new Date().toISOString(),
  source: "Yahoo Finance chart endpoint (GitHub Actions runner)",
  note: "取得失敗した銘柄は errors に入る。rows に無い銘柄の株価を推測で埋めないこと。",
  rows,
  errors
};

const outPath = path.join(process.cwd(), "watchlist", "latest_prices.json");
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
process.stdout.write(`\nWrote ${outPath} (${rows.length} rows, ${errors.length} errors)\n`);

if (errors.length) {
  console.error("Errors:", JSON.stringify(errors, null, 2));
}

function round(v) {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

// 「点」ではなく「線」を必ず提示するための計算。
// 現値だけを見て方向を語ると誤る（2026-08-06に実際に誤った）ため、
// 底値・高値・そこからの距離・短中期のトレンドを常に添える。
function buildTrajectory(hist, price) {
  if (!hist.length || price === null) return null;
  const low = hist.reduce((a, b) => (b.close < a.close ? b : a));
  const high = hist.reduce((a, b) => (b.close > a.close ? b : a));
  const back = (n) => (hist.length > n ? hist[hist.length - 1 - n] : hist[0]);
  const pct = (from) => (from && from.close ? round(((price / from.close) - 1) * 100) : null);
  return {
    periodDays: hist.length,
    lowDate: low.date,
    lowClose: low.close,
    pctFromLow: pct(low),
    highDate: high.date,
    highClose: high.close,
    pctFromHigh: pct(high),
    pct5d: pct(back(5)),
    pct20d: pct(back(20)),
    // 方向の要約。単独で使わず必ず上の数値と日付を添えて報告すること。
    direction:
      pct(back(5)) === null
        ? null
        : pct(back(5)) > 3
          ? "5日で上昇"
          : pct(back(5)) < -3
            ? "5日で下落"
            : "5日で横ばい"
  };
}
