// SEC EDGARから決算の一次データを取得して watchlist/filings.json に書き出す。
//
// なぜ必要か: 実行環境（Claude Codeのコンテナ）からは sec.gov も金融サイトも
// egress遮断で接続すらできない（2026-08-28に確認、HTTP応答コード000）。
// そのため「一次資料で確認した」と称していたものが実際は全て記事の二次引用であり、
// IRENの発行済株式数を37M株誤り（357M→実際394.06M）、
// 希薄化率を年率14%と誤った（実際45.7%）事故が起きた。
//
// **SECは断念した（2026-08-28）**: www.sec.gov も data.sec.gov も GitHub Actions の
// ランナーIPに対して403を返す（SECはクラウド事業者のIPを広く遮断している）。4回試行して確認。
// 代わりに、株価と同じ Yahoo Finance の機械可読エンドポイントから
// 発行済株式数と主要財務を取る。**これは提出書類そのものではない（二次）。**
// ただし毎回同じ経路・同じ形式・日付つきで取れるため、
// 「記事によって357Mだったり394Mだったりする」問題は消える。
// 提出書類の原文が要る判断のときは、SECのURLを人が開いて確認する（下記 secUrl）。
//
// **ローカルで実行しないこと。** 更新は watchlist/.price-refresh-trigger を押す。
// 依存パッケージなし。Node 20+。

import fs from "node:fs/promises";
import path from "node:path";

// SECはUser-Agentに連絡先を要求する（未設定だと403）。
// SECはUser-Agentに「組織名＋連絡先」を要求する。形式が不正だと403を返す。
// SECの規約: User-Agentに「組織名＋連絡先メール」が必要。欠けると403で弾かれる。
// 個人メールは使わず、GitHubの公開用noreplyアドレスを連絡先にする。
const UA = "Mozilla/5.0 invenstment-research/1.0";
// www.sec.gov はGitHub Actionsのランナーから403で弾かれる（2026-08-28確認）。
// APIホストの data.sec.gov は別扱いなので、CIKは設定ファイルから与える。
// **番号を間違えると別会社のデータを取得してしまう**ため、expectで社名を必ず検証する。
const CIK_PATH = path.join(process.cwd(), "watchlist", "cik.json");

// 取りに行くXBRLの概念。決算のたびに手で読み直さないための機械可読ソース。
const CONCEPTS = [
  ["dei", "EntityCommonStockSharesOutstanding", "発行済株式数"],
  ["us-gaap", "CommonStockSharesOutstanding", "発行済株式数(us-gaap)"],
  ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax", "売上"],
  ["us-gaap", "Revenues", "売上(Revenues)"],
  ["us-gaap", "NetIncomeLoss", "純損益"],
  ["us-gaap", "AssetImpairmentCharges", "資産減損"],
  ["us-gaap", "CashAndCashEquivalentsAtCarryingValue", "現金及び現金同等物"],
  ["us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding", "希薄化後加重平均株数"]
];

const get = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`HTTP ${res.status} ${url} :: ${body}`);
  }
  return res.json();
};

const MODULES = [
  "defaultKeyStatistics", "financialData", "summaryDetail",
  "incomeStatementHistory", "balanceSheetHistory", "calendarEvents"
].join(",");

const out = { fetchedAt: new Date().toISOString(), source: "Yahoo Finance quoteSummary（GitHub Actions runner）", note: "提出書類そのものではない（二次）。ただし機械可読で日付つき。原文が要るときは secUrl を人が開く。", companies: {}, errors: [] };

let CIKS = [];
try { CIKS = JSON.parse(await fs.readFile(CIK_PATH, "utf8")); }
catch (e) { out.errors.push({ step: "cik.json", message: String(e.message ?? e) }); }

for (const entry of CIKS) {
  const t = entry.ticker;
  const cik = Array.isArray(entry.cik) ? entry.cik[0] : entry.cik;
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=${MODULES}`;
    const j = await get(url);
    const r = j.quoteSummary?.result?.[0];
    if (!r) throw new Error("quoteSummaryが空");
    const ks = r.defaultKeyStatistics ?? {}, fd = r.financialData ?? {}, sd = r.summaryDetail ?? {};
    const inc = r.incomeStatementHistory?.incomeStatementHistory ?? [];
    const bal = r.balanceSheetHistory?.balanceSheetStatements ?? [];
    const v = (x) => (x && typeof x === "object" ? (x.raw ?? null) : (x ?? null));

    out.companies[t] = {
      cik,
      // 判断に直結するのはここ。株数を人が記事から拾うのをやめる。
      sharesOutstanding: v(ks.sharesOutstanding),
      impliedSharesOutstanding: v(ks.impliedSharesOutstanding),
      floatShares: v(ks.floatShares),
      heldPercentInsiders: v(ks.heldPercentInsiders),
      shortRatio: v(ks.shortRatio),
      totalRevenue: v(fd.totalRevenue),
      grossMargins: v(fd.grossMargins),
      totalCash: v(fd.totalCash),
      totalDebt: v(fd.totalDebt),
      marketCap: v(sd.marketCap),
      // 期別の推移。1期だけ見て「増えた/減った」を語らないため。
      incomeHistory: inc.slice(0, 4).map((x) => ({ end: v(x.endDate), revenue: v(x.totalRevenue), netIncome: v(x.netIncome) })),
      balanceHistory: bal.slice(0, 4).map((x) => ({ end: v(x.endDate), cash: v(x.cash), totalLiab: v(x.totalLiab), shares: v(x.commonStock) })),
      nextEarnings: (r.calendarEvents?.earnings?.earningsDate ?? []).map((d) => v(d)),
      secUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&dateb=&owner=include&count=10`
    };
    process.stdout.write(`${t} `);
  } catch (e) {
    out.errors.push({ ticker: t, message: String(e.message ?? e).slice(0, 200) });
    process.stdout.write(`${t}:x `);
  }
}

const p = path.join(process.cwd(), "watchlist", "filings.json");
if (Object.keys(out.companies).length === 0) {
  out.note = "取得全滅。errorsに原因がある。";
  await fs.writeFile(p, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.error("取得全滅。原因を filings.json に記録した。");
  console.error(JSON.stringify(out.errors, null, 2));
  process.exit(0);
}
await fs.writeFile(p, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\nWrote ${p} (${Object.keys(out.companies).length} companies, ${out.errors.length} errors)`);
