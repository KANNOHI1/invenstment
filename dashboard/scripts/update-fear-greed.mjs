import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dashboardRoot = process.cwd();
const projectRoot = path.resolve(dashboardRoot, "..");
const outputPath = path.join(dashboardRoot, "data", "fear-greed.local.json");
const fallbackPath = path.join(dashboardRoot, "data", "fear-greed.public.json");
const endpoint = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const sourceUrl = "https://www.cnn.com/markets/fear-and-greed";

const componentKeys = [
  ["market_momentum_sp500", "Market Momentum"],
  ["stock_price_strength", "Stock Price Strength"],
  ["stock_price_breadth", "Stock Price Breadth"],
  ["put_call_options", "Put/Call Options"],
  ["junk_bond_demand", "Junk Bond Demand"],
  ["market_volatility_vix", "Market Volatility"],
  ["safe_haven_demand", "Safe Haven Demand"]
];

async function main() {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9,ja;q=0.8",
        referer: sourceUrl,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`CNN endpoint returned ${response.status}`);
    }

    const raw = await response.json();
    const snapshot = normalizeCnnPayload(raw);
    await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`Fear & Greed updated: ${snapshot.value ?? "unknown"} -> ${path.relative(projectRoot, outputPath)}`);
  } catch (error) {
    const fallback = await readFallback();
    const snapshot = {
      ...fallback,
      source: fallback.source ?? "tracked Fear & Greed fallback",
      sourceUrl: fallback.sourceUrl ?? sourceUrl,
      error: error instanceof Error ? error.message : String(error)
    };
    await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.warn(`Fear & Greed fallback used: ${snapshot.error}`);
  }
}

function normalizeCnnPayload(raw) {
  const current = raw?.fear_and_greed ?? raw?.fearGreed ?? raw?.current ?? raw;
  const value = readScore(current);
  const previousClose = readScore(current?.previous_close ?? current?.previousClose);
  const previousWeek = readScore(current?.previous_1_week ?? current?.previousWeek);
  const previousMonth = readScore(current?.previous_1_month ?? current?.previousMonth);
  const updatedAt = readTimestamp(current?.timestamp ?? current?.updatedAt ?? raw?.timestamp) ?? new Date().toISOString();

  return {
    value,
    rating: typeof current?.rating === "string" ? current.rating : undefined,
    previousClose,
    previousWeek,
    previousMonth,
    updatedAt,
    source: "CNN Fear & Greed Index",
    sourceUrl,
    components: componentKeys
      .map(([key, name]) => ({
        name,
        value: readScore(raw?.[key]),
        rating: typeof raw?.[key]?.rating === "string" ? raw[key].rating : undefined
      }))
      .filter((component) => component.value !== null || component.rating)
  };
}

function readScore(input) {
  const value =
    typeof input === "number"
      ? input
      : typeof input?.score === "number"
        ? input.score
        : typeof input?.value === "number"
          ? input.value
          : typeof input?.data?.[0]?.y === "number"
            ? input.data[0].y
            : null;
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function readTimestamp(value) {
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const milliseconds = value > 10_000_000_000 ? value : value * 1000;
  return new Date(milliseconds).toISOString();
}

async function readFallback() {
  try {
    return JSON.parse(await fs.readFile(fallbackPath, "utf8"));
  } catch {
    return {
      value: null,
      updatedAt: new Date().toISOString(),
      source: "empty Fear & Greed fallback",
      sourceUrl
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
