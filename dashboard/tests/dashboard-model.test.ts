import { describe, expect, test } from "vitest";
import {
  buildPortfolioRows,
  classifyBuySignal,
  computeRsi14,
  mergeMarketRows
} from "../lib/dashboard-model";

describe("dashboard model", () => {
  test("computes RSI14 from closing prices", () => {
    const closes = [
      44, 44.15, 43.9, 44.35, 44.6, 44.2, 44.95, 45.3, 45.1, 45.8,
      46.05, 45.7, 46.4, 46.95, 47.2, 47.8
    ];

    expect(computeRsi14(closes)).toBeCloseTo(80.17, 1);
  });

  test("builds portfolio rows with P/L and allocation", () => {
    const rows = buildPortfolioRows(
      [
        { ticker: "IREN", shares: 58, averageCost: 54, role: "主力" },
        { ticker: "NBIS", shares: 6, averageCost: 207.93, role: "本命" }
      ],
      new Map([
        ["IREN", { ticker: "IREN", price: 56.5, changeRate: 2.1 }],
        ["NBIS", { ticker: "NBIS", price: 180, changeRate: -3.4 }]
      ])
    );

    expect(rows.totalValue).toBeCloseTo(4357, 0);
    expect(rows.totalCost).toBeCloseTo(4379.58, 2);
    expect(rows.positions[0].profitLoss).toBeCloseTo(145, 2);
    expect(rows.positions[1].profitLossRate).toBeCloseTo(-13.43, 2);
    expect(rows.positions[0].allocation).toBeCloseTo(75.21, 2);
  });

  test("classifies buy signal from RSI, drawdown, event, and breakage inputs", () => {
    expect(
      classifyBuySignal({
        ticker: "FORM",
        rsi14: 39,
        drawdown52pct: -31,
        fromLow52pct: 130,
        changeRate: -4,
        hasUpcomingEvent: false,
        thesisBroken: false
      }).level
    ).toBe("BUY WATCH");

    expect(
      classifyBuySignal({
        ticker: "NBIS",
        rsi14: 72,
        drawdown52pct: -5,
        fromLow52pct: 420,
        changeRate: 8,
        hasUpcomingEvent: false,
        thesisBroken: false
      }).level
    ).toBe("HOT");

    expect(
      classifyBuySignal({
        ticker: "ONDS",
        rsi14: 51,
        drawdown52pct: -18,
        fromLow52pct: 90,
        changeRate: -1,
        hasUpcomingEvent: true,
        thesisBroken: false
      }).level
    ).toBe("EVENT");

    expect(
      classifyBuySignal({
        ticker: "SMCI",
        rsi14: 34,
        drawdown52pct: -67,
        fromLow52pct: 12,
        changeRate: -9,
        hasUpcomingEvent: false,
        thesisBroken: true
      }).level
    ).toBe("BROKEN?");
  });

  test("local market data overrides tracked stale snapshot while preserving market cap fallback", () => {
    const merged = mergeMarketRows(
      [
        {
          ticker: "IREN",
          price: 56,
          changeRate: 2,
          marketCapUsdB: 12.3,
          high52: 77,
          low52: 7,
          updateLocal: "old"
        }
      ],
      [
        {
          ticker: "IREN",
          price: 54,
          changeRate: -1,
          rsi14: 43,
          high52: 76,
          low52: 8,
          updatedAt: "new"
        }
      ]
    );

    expect(merged.get("IREN")?.price).toBe(54);
    expect(merged.get("IREN")?.marketCapUsdB).toBe(12.3);
    expect(merged.get("IREN")?.rsi14).toBe(43);
  });
});
