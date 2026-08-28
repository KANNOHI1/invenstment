// 企業の基礎データ（株数・財務）を要約して出す。
// 目的は「記事の孫引きで株数を語らない」こと。出所は Yahoo の機械可読エンドポイント（二次）。
// 提出書類の原文が必要な判断のときは secUrl を人が開く。
import fs from "node:fs/promises";
import path from "node:path";

const f = JSON.parse(await fs.readFile(path.join(process.cwd(), "watchlist", "filings.json"), "utf8"));
const M = (v) => (v == null ? "n/a" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + v.toLocaleString());
const S = (v) => (v == null ? "n/a" : (v / 1e6).toFixed(1) + "M株");
const D = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "?");

const out = [`fundamentals fetchedAt ${f.fetchedAt}`, `出所: ${f.source}`, ""];
for (const [t, c] of Object.entries(f.companies ?? {})) {
  out.push(`【${t}】`);
  out.push(`  発行済 ${S(c.sharesOutstanding)}／潜在込み ${S(c.impliedSharesOutstanding)}／浮動 ${S(c.floatShares)}`);
  out.push(`  時価総額 ${M(c.marketCap)}／現金 ${M(c.totalCash)}／負債 ${M(c.totalDebt)}／粗利率 ${c.grossMargins != null ? (c.grossMargins * 100).toFixed(1) + "%" : "n/a"}`);
  const ih = c.incomeHistory ?? [];
  if (ih.length) out.push(`  売上の推移 ${ih.map((x) => `${D(x.end)}:${M(x.revenue)}`).join(" ← ")}`);
  const bh = c.balanceHistory ?? [];
  if (bh.length >= 2) {
    const now = bh[0], old = bh[bh.length - 1];
    if (now.shares && old.shares) {
      const chg = ((now.shares / old.shares - 1) * 100).toFixed(1);
      out.push(`  株数の推移 ${D(old.end)} ${S(old.shares)} → ${D(now.end)} ${S(now.shares)}（${chg >= 0 ? "+" : ""}${chg}%）`);
    }
  }
  if (c.nextEarnings?.length) out.push(`  次回決算 ${c.nextEarnings.map(D).join(" / ")}`);
  out.push("");
}
if (f.errors?.length) out.push(`エラー: ${f.errors.map((e) => `${e.ticker ?? e.step}(${String(e.message).slice(0, 80)})`).join(" / ")}`);
console.log(out.join("\n"));
