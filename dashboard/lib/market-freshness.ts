export type MarketFreshnessLevel = "fresh" | "aging" | "stale";

export type MarketFreshness = {
  level: MarketFreshnessLevel;
  minutes: number | null;
  label: string;
  message: string;
};

export function getMarketFreshness(updatedAt: string, now = new Date()): MarketFreshness {
  const parsed = new Date(updatedAt);
  if (!updatedAt || Number.isNaN(parsed.getTime())) {
    return {
      level: "stale",
      minutes: null,
      label: "更新時刻不明",
      message: "価格データの時刻を確認できません"
    };
  }

  const minutes = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 60_000));
  if (minutes <= 15) {
    return {
      level: "fresh",
      minutes,
      label: `${minutes}分前`,
      message: "直近更新の参考価格"
    };
  }

  if (minutes <= 60) {
    return {
      level: "aging",
      minutes,
      label: `${minutes}分前`,
      message: "少し古い可能性があります"
    };
  }

  return {
    level: "stale",
    minutes,
    label: `${minutes}分前`,
    message: "古い価格です。更新してから判断してください"
  };
}
