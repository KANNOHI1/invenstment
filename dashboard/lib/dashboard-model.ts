export type SignalLevel = "BUY WATCH" | "WAIT" | "HOT" | "EVENT" | "BROKEN?";

export type PositionInput = {
  ticker: string;
  shares: number;
  averageCost: number;
  role?: string;
  notes?: string;
  openedAt?: string;
};

export type MarketInput = {
  ticker: string;
  name?: string;
  price?: number | null;
  change?: number | null;
  changeRate?: number | null;
  rsi14?: number | null;
  high52?: number | null;
  low52?: number | null;
  marketCapUsdB?: number | null;
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  updateLocal?: string | null;
  updatedAt?: string | null;
  stale?: boolean;
  source?: string;
};

export type PortfolioPosition = PositionInput & {
  price: number | null;
  marketValue: number;
  costBasis: number;
  profitLoss: number;
  profitLossRate: number;
  allocation: number;
  dayChangeRate: number | null;
};

export type PortfolioSummary = {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossRate: number;
  positions: PortfolioPosition[];
};

export type AllocationSegment = {
  ticker: string;
  start: number;
  end: number;
  value: number;
  allocation: number;
  profitLossRate: number;
};

export type SignalInput = {
  ticker: string;
  rsi14?: number | null;
  drawdown52pct?: number | null;
  fromLow52pct?: number | null;
  changeRate?: number | null;
  hasUpcomingEvent?: boolean;
  thesisBroken?: boolean;
};

export type SignalResult = {
  level: SignalLevel;
  reason: string;
  score: number;
};

export function computeRsi14(closes: number[]): number | null {
  const values = closes.filter((value) => Number.isFinite(value));
  if (values.length < 15) return null;

  const recent = values.slice(-15);
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const delta = recent[index] - recent[index - 1];
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  const averageGain = gains / 14;
  const averageLoss = losses / 14;
  if (averageLoss === 0) return 100;

  const relativeStrength = averageGain / averageLoss;
  return round(100 - 100 / (1 + relativeStrength), 2);
}

export function buildPortfolioRows(
  positions: PositionInput[],
  market: Map<string, MarketInput>
): PortfolioSummary {
  const rows = positions.map((position) => {
    const quote = market.get(position.ticker.toUpperCase());
    const price = numberOrNull(quote?.price);
    const marketValue = price === null ? 0 : position.shares * price;
    const costBasis = position.shares * position.averageCost;
    const profitLoss = marketValue - costBasis;
    const profitLossRate = costBasis === 0 ? 0 : (profitLoss / costBasis) * 100;

    return {
      ...position,
      ticker: position.ticker.toUpperCase(),
      price,
      marketValue,
      costBasis,
      profitLoss,
      profitLossRate,
      allocation: 0,
      dayChangeRate: numberOrNull(quote?.changeRate)
    };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.costBasis, 0);
  const totalProfitLoss = totalValue - totalCost;
  const totalProfitLossRate = totalCost === 0 ? 0 : (totalProfitLoss / totalCost) * 100;

  return {
    totalValue,
    totalCost,
    totalProfitLoss,
    totalProfitLossRate,
    positions: rows.map((row) => ({
      ...row,
      allocation: totalValue === 0 ? 0 : (row.marketValue / totalValue) * 100
    }))
  };
}

export function buildAllocationSegments(positions: PortfolioPosition[]): AllocationSegment[] {
  let cursor = 0;
  return positions.map((position, index) => {
    const start = round(cursor, 2);
    const end = index === positions.length - 1 ? 100 : round(cursor + position.allocation, 2);
    cursor = end;
    return {
      ticker: position.ticker,
      start,
      end,
      value: position.marketValue,
      allocation: position.allocation,
      profitLossRate: position.profitLossRate
    };
  });
}

export function classifyBuySignal(input: SignalInput): SignalResult {
  if (input.thesisBroken || (input.drawdown52pct ?? 0) <= -65) {
    return {
      level: "BROKEN?",
      reason: "急落または仮説崩れ条件を確認",
      score: -3
    };
  }

  if (input.hasUpcomingEvent) {
    return {
      level: "EVENT",
      reason: "決算または重要イベント待ち",
      score: 1
    };
  }

  const rsi = input.rsi14;
  const drawdown = input.drawdown52pct;
  const fromLow = input.fromLow52pct;
  const changeRate = input.changeRate;

  if ((rsi !== null && rsi !== undefined && rsi >= 70) || (fromLow ?? 0) >= 350 || (changeRate ?? 0) >= 7) {
    return {
      level: "HOT",
      reason: "過熱圏。追いかけず押し目待ち",
      score: 0
    };
  }

  if ((rsi ?? 100) <= 45 && (drawdown ?? 0) <= -25) {
    return {
      level: "BUY WATCH",
      reason: "RSI低下かつ52週高値から十分下落",
      score: 3
    };
  }

  if ((rsi ?? 100) <= 55 || (drawdown ?? 0) <= -35) {
    return {
      level: "BUY WATCH",
      reason: "押し目候補。決算と仮説崩れ条件を確認",
      score: 2
    };
  }

  return {
    level: "WAIT",
    reason: "条件待ち",
    score: 0
  };
}

export function mergeMarketRows(
  trackedRows: MarketInput[],
  localRows: MarketInput[]
): Map<string, MarketInput> {
  const merged = new Map<string, MarketInput>();
  for (const row of trackedRows) {
    merged.set(row.ticker.toUpperCase(), normalizeMarketRow(row));
  }

  for (const row of localRows) {
    const ticker = row.ticker.toUpperCase();
    const fallback = merged.get(ticker);
    merged.set(ticker, {
      ...fallback,
      ...normalizeMarketRow(row),
      marketCapUsdB: numberOrNull(row.marketCapUsdB) ?? fallback?.marketCapUsdB ?? null,
      name: row.name ?? fallback?.name,
      per: numberOrNull(row.per) ?? fallback?.per ?? null,
      pbr: numberOrNull(row.pbr) ?? fallback?.pbr ?? null,
      eps: numberOrNull(row.eps) ?? fallback?.eps ?? null
    });
  }
  return merged;
}

export function calcDrawdown(price?: number | null, high52?: number | null): number | null {
  const current = numberOrNull(price);
  const high = numberOrNull(high52);
  if (current === null || high === null || high === 0) return null;
  return ((current - high) / high) * 100;
}

export function calcFromLow(price?: number | null, low52?: number | null): number | null {
  const current = numberOrNull(price);
  const low = numberOrNull(low52);
  if (current === null || low === null || low === 0) return null;
  return ((current - low) / low) * 100;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeMarketRow(row: MarketInput): MarketInput {
  return {
    ...row,
    ticker: row.ticker.toUpperCase(),
    price: numberOrNull(row.price),
    change: numberOrNull(row.change),
    changeRate: numberOrNull(row.changeRate),
    rsi14: numberOrNull(row.rsi14),
    high52: numberOrNull(row.high52),
    low52: numberOrNull(row.low52),
    marketCapUsdB: numberOrNull(row.marketCapUsdB)
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
