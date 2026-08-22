// 保有・監視銘柄の株価を取得して watchlist/latest_prices.json に書き出す。
// GitHub Actions のランナー上で実行する前提（実行環境のプロキシ制限を回避するため）。
// **ローカル（Claude Codeのコンテナ）で実行しないこと。** egress遮断で全銘柄403になる。
// 更新は watchlist/.price-refresh-trigger を書き換えて push する。
// 依存パッケージなし。Node 20+ の fetch を使用。

import fs from "node:fs/promises";
import path from "node:path";

const TICKERS = process.argv.slice(2).length
  ? process.argv.slice(2).map((t) => t.toUpperCase())
  : ["IREN", "NBIS", "MU", "SIMO", "MOD", "CRWV", "POWL", "SNDK", "NVDA"];

// ゼロベース再スキャン用の候補宇宙。保有銘柄リストを投資宇宙にしないための装置。
// watchlist/.scan-tickers があれば、その銘柄も取得して scan_prices.json に別出しする。
// latest_prices.json を膨らませないのは、巡回のたびに読むファイルを軽く保つため。
const SCAN_LIST_PATH = path.join(process.cwd(), "watchlist", ".scan-tickers");
const SCAN_OUT_PATH = path.join(process.cwd(), "watchlist", "scan_prices.json");

// ローテーション観測の計器。セクターETF・金利・原油・ドル・クレジット・VIX。
// 「今どの象限か」「資金がどこにあるか」を測るためのもので、売買候補ではない。
const ROTATION_LIST_PATH = path.join(process.cwd(), "watchlist", ".rotation-tickers");
const ROTATION_OUT_PATH = path.join(process.cwd(), "watchlist", "rotation_prices.json");

const rows = [];
const errors = [];

// 期間は「答えたい問い」に合わせる。単一の窓しか見ないと、
// 短期では正しく長期では誤った判断になる（2026-08-06に実際に発生）。
const HORIZONS = [
  { key: "short", range: "3mo", interval: "1d", label: "執行・レジーム判断用（日次3ヶ月）" },
  { key: "long", range: "5y", interval: "1wk", label: "ポジション・サイクル判断用（週次5年）" },
  // 時間外（プレ／アフター）。日本から見ると米国の通常取引時間は深夜であり、
  // 注文を出す時点では時間外の値しか見えないことが多い。執行判断に直結するため必ず取る。
  { key: "extended", range: "1d", interval: "1m", label: "時間外を含む当日1分足", includePrePost: true }
];

await fetchInto(TICKERS, rows, errors);

async function fetchInto(tickers, rowsOut, errorsOut) {
for (const ticker of tickers) {
  try {
    const series = {};
    for (const h of HORIZONS) {
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?range=${h.range}&interval=${h.interval}` +
        (h.includePrePost ? "&includePrePost=true" : "");
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 price-snapshot/1.0", Accept: "application/json" }
      });
      if (!res.ok) throw new Error(`${h.key}: HTTP ${res.status}`);
      const json = await res.json();
      const result = json.chart?.result?.[0];
      if (!result) throw new Error(`${h.key}: ${json.chart?.error?.description ?? "empty result"}`);
      series[h.key] = result;
    }

    const meta = series.short.meta ?? {};
    const price = meta.regularMarketPrice ?? null;
    const shortHist = toHist(series.short);
    const longHist = toHist(series.long);
    const prev = shortHist.length >= 2 ? shortHist[shortHist.length - 2].close : null;
    const change = price !== null && prev !== null ? price - prev : null;
    const changePct = change !== null && prev ? (change / prev) * 100 : null;

    rowsOut.push({
      ticker,
      price: round(price),
      previousClose: round(prev),
      change: round(change),
      changePct: round(changePct),
      currency: meta.currency ?? null,
      quoteTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      fiftyTwoWeekHigh: round(meta.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: round(meta.fiftyTwoWeekLow),
      // 短期の線: 執行タイミングとレジーム判断用
      trajectory: buildTrajectory(shortHist, price),
      // 長期の線: 「この値段から3倍は妥当か」「サイクルのどこか」を判断するため。
      // 短期窓だけで見ると、既に大きく上昇した後の調整を「安い」と誤認する。
      longTerm: buildLongTerm(longHist, price),
      // 時間外。日本時間の日中に注文を検討する際、これが唯一の生きた値になる。
      extended: buildExtended(series.extended, price),
      history: shortHist
    });
    process.stdout.write(".");
  } catch (e) {
    errorsOut.push({ ticker, message: e instanceof Error ? e.message : String(e) });
    process.stdout.write("x");
  }
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
// 全滅した取得結果で正常なスナップショットを上書きしない。
// 2026-08-21、Claude Code のコンテナ内でこのスクリプトを実行してしまい（egress遮断で全銘柄403）、
// rows:0 のファイルが良好なスナップショットを潰した。空データは無いデータより危険（誤った判断に直結する）。
if (rows.length === 0) {
  console.error("取得が全滅したため latest_prices.json を上書きしない。既存のスナップショットを維持する。");
  console.error("Errors:", JSON.stringify(errors, null, 2));
  process.exit(1);
}
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
process.stdout.write(`\nWrote ${outPath} (${rows.length} rows, ${errors.length} errors)\n`);

if (errors.length) {
  console.error("Errors:", JSON.stringify(errors, null, 2));
}

// スキャン用の候補宇宙。存在すれば取得する。失敗しても本編の出力は壊さない。
try {
  const raw = await fs.readFile(SCAN_LIST_PATH, "utf8");
  const scanTickers = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((t) => t.toUpperCase());
  if (scanTickers.length) {
    const scanRows = [];
    const scanErrors = [];
    process.stdout.write(`Scanning ${scanTickers.length} candidates\n`);
    await fetchInto(scanTickers, scanRows, scanErrors);
    // history は本編だけで足りるため、スキャン側は落としてファイルを軽くする。
    for (const r of scanRows) delete r.history;
    const scanOut = {
      fetchedAt: new Date().toISOString(),
      source: "Yahoo Finance chart endpoint (GitHub Actions runner)",
      note: "ゼロベース再スキャン用の候補宇宙。保有銘柄リストを投資宇宙にしないための装置。",
      rows: scanRows,
      errors: scanErrors
    };
    if (scanRows.length === 0) {
      console.error("スキャンが全滅したため scan_prices.json を上書きしない。");
    } else {
    await fs.writeFile(SCAN_OUT_PATH, JSON.stringify(scanOut, null, 2) + "\n", "utf8");
    }
    process.stdout.write(`\nWrote ${SCAN_OUT_PATH} (${scanRows.length} rows, ${scanErrors.length} errors)\n`);
  }
} catch (e) {
  if (e && e.code !== "ENOENT") {
    console.error("Scan list error:", e instanceof Error ? e.message : String(e));
  }
}

// ローテーション観測。history は相対強度の計算に使うので残す。
try {
  const raw = await fs.readFile(ROTATION_LIST_PATH, "utf8");
  const rotTickers = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (rotTickers.length) {
    const rotRows = [];
    const rotErrors = [];
    process.stdout.write(`Rotation: ${rotTickers.length} instruments\n`);
    await fetchInto(rotTickers, rotRows, rotErrors);
    if (rotRows.length === 0) {
      console.error("ローテーション取得が全滅したため rotation_prices.json を上書きしない。");
    } else {
      const rotOut = {
        fetchedAt: new Date().toISOString(),
        source: "Yahoo Finance chart endpoint (GitHub Actions runner)",
        note: "ローテーション観測の計器。セクターETF・金利・原油・ドル・クレジット・VIX。売買候補ではない。",
        rows: rotRows,
        errors: rotErrors
      };
      await fs.writeFile(ROTATION_OUT_PATH, JSON.stringify(rotOut, null, 2) + "\n", "utf8");
      process.stdout.write(`Wrote ${ROTATION_OUT_PATH} (${rotRows.length} rows, ${rotErrors.length} errors)\n`);
    }
  }
} catch (e) {
  if (e && e.code !== "ENOENT") {
    console.error("Rotation list error:", e instanceof Error ? e.message : String(e));
  }
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

function toHist(result) {
  return (result.timestamp ?? [])
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: round(result.indicators?.quote?.[0]?.close?.[i])
    }))
    .filter((d) => d.close !== null);
}

// 長期の線。年単位でどこにいるかを常に添える。
function buildLongTerm(hist, price) {
  if (!hist.length || price === null) return null;
  const low = hist.reduce((a, b) => (b.close < a.close ? b : a));
  const high = hist.reduce((a, b) => (b.close > a.close ? b : a));
  const agoWeeks = (w) => (hist.length > w ? hist[hist.length - 1 - w] : hist[0]);
  const pct = (from) => (from && from.close ? round(((price / from.close) - 1) * 100) : null);
  const range = high.close - low.close;
  return {
    periodWeeks: hist.length,
    low5y: low.close,
    low5yDate: low.date,
    high5y: high.close,
    high5yDate: high.date,
    pctFrom5yLow: pct(low),
    pctFrom5yHigh: pct(high),
    // 5年レンジ内の位置（0%=安値, 100%=高値）。高いほど「既に上げ切っている」。
    rangePosition: range > 0 ? round(((price - low.close) / range) * 100) : null,
    pct1y: pct(agoWeeks(52)),
    pct2y: pct(agoWeeks(104)),
    pct3y: pct(agoWeeks(156))
  };
}

// 時間外（プレ／アフターマーケット）の最終値。
// 日本から注文を出す時間帯には通常取引が閉まっているため、執行判断にはこちらが要る。
function buildExtended(result, regularPrice) {
  if (!result) return null;
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  let lastIdx = -1;
  for (let i = closes.length - 1; i >= 0; i--) {
    if (typeof closes[i] === "number") { lastIdx = i; break; }
  }
  if (lastIdx < 0) return null;
  const period = result.meta?.currentTradingPeriod ?? {};
  const t = ts[lastIdx];
  const session =
    period.post && t >= period.post.start ? "post"
    : period.pre && t < period.pre.end ? "pre"
    : "regular";
  const last = round(closes[lastIdx]);
  return {
    price: last,
    session,
    time: new Date(t * 1000).toISOString(),
    vsRegularClose: regularPrice ? round(((last / regularPrice) - 1) * 100) : null
  };
}
