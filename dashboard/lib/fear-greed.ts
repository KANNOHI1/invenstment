import { getMarketFreshness, type MarketFreshness } from "./market-freshness";

export type FearGreedRating = "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed";

export type FearGreedTone = "extreme-fear" | "fear" | "neutral" | "greed" | "extreme-greed" | "unknown";

export type FearGreedComponent = {
  name: string;
  value: number | null;
  rating?: string;
};

export type FearGreedSnapshot = {
  value?: number | null;
  rating?: string;
  previousClose?: number | null;
  previousWeek?: number | null;
  previousMonth?: number | null;
  updatedAt?: string;
  source?: string;
  sourceUrl?: string;
  components?: FearGreedComponent[];
  error?: string;
};

export type FearGreedDisplay = {
  value: number | null;
  rating: FearGreedRating | "未取得";
  tone: FearGreedTone;
  guidance: string;
  freshness: MarketFreshness;
  updatedAt: string;
  source: string;
  sourceUrl: string;
  error?: string;
  deltas: {
    previousClose: number | null;
    previousWeek: number | null;
    previousMonth: number | null;
  };
  components: FearGreedComponent[];
};

const defaultSourceUrl = "https://www.cnn.com/markets/fear-and-greed";

export function classifyFearGreed(score: number): FearGreedRating {
  const value = clampScore(score);
  if (value <= 24) return "Extreme Fear";
  if (value <= 44) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  return "Extreme Greed";
}

export function selectFearGreedSnapshot(
  localSnapshot: FearGreedSnapshot,
  fallbackSnapshot: FearGreedSnapshot
): FearGreedSnapshot {
  return typeof localSnapshot.value === "number" && Number.isFinite(localSnapshot.value) ? localSnapshot : fallbackSnapshot;
}

export function getFearGreedDisplay(snapshot: FearGreedSnapshot, now = new Date()): FearGreedDisplay {
  const value = numberOrNull(snapshot.value);
  const rating = value === null ? "未取得" : classifyFearGreed(value);
  return {
    value,
    rating,
    tone: rating === "未取得" ? "unknown" : toneForRating(rating),
    guidance: rating === "未取得" ? "取得不安定。個別銘柄の決算・流動性・資金管理を優先。" : guidanceForRating(rating),
    freshness: getMarketFreshness(snapshot.updatedAt ?? "", now),
    updatedAt: snapshot.updatedAt ?? "未更新",
    source: snapshot.source ?? "CNN Fear & Greed Index fallback",
    sourceUrl: snapshot.sourceUrl ?? defaultSourceUrl,
    error: snapshot.error,
    deltas: {
      previousClose: calcDelta(value, snapshot.previousClose),
      previousWeek: calcDelta(value, snapshot.previousWeek),
      previousMonth: calcDelta(value, snapshot.previousMonth)
    },
    components: snapshot.components ?? []
  };
}

function toneForRating(rating: FearGreedRating): FearGreedTone {
  return rating.toLowerCase().replaceAll(" ", "-") as FearGreedTone;
}

function guidanceForRating(rating: FearGreedRating): string {
  switch (rating) {
    case "Extreme Greed":
      return "市場は熱い。一括買いは避け、利確・現金比率・分割エントリーを優先。";
    case "Greed":
      return "押し目待ち。決算確認とポジションサイズ抑制を優先。";
    case "Neutral":
      return "地合いより個別材料。決算・契約・資金繰りの触媒で判断。";
    case "Fear":
      return "質の高い候補を再点検。仮説が intact なら分割エントリー候補。";
    case "Extreme Fear":
      return "総悲観。仮説が壊れていない第一群候補を優先確認。";
  }
}

function calcDelta(current: number | null, previous: unknown): number | null {
  const past = numberOrNull(previous);
  if (current === null || past === null) return null;
  return Number((current - past).toFixed(1));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampScore(Number(value.toFixed(1)));
}
