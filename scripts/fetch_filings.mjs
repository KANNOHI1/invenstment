// SEC EDGARから決算の一次データを取得して watchlist/filings.json に書き出す。
//
// なぜ必要か: 実行環境（Claude Codeのコンテナ）からは sec.gov も金融サイトも
// egress遮断で接続すらできない（2026-08-28に確認、HTTP応答コード000）。
// そのため「一次資料で確認した」と称していたものが実際は全て記事の二次引用であり、
// IRENの発行済株式数を37M株誤り（357M→実際394.06M）、
// 希薄化率を年率14%と誤った（実際45.7%）事故が起きた。
// GitHub Actionsのランナーは遮断の外側にあるため、株価と同じ方式で一次データを取る。
//
// **ローカルで実行しないこと。** 更新は watchlist/.price-refresh-trigger を押す。
// 依存パッケージなし。Node 20+。

import fs from "node:fs/promises";
import path from "node:path";

// SECはUser-Agentに連絡先を要求する（未設定だと403）。
// SECはUser-Agentに「組織名＋連絡先」を要求する。形式が不正だと403を返す。
const UA = "KANNOHI1-invenstment-research github.com/KANNOHI1/invenstment";
const TICKERS = ["IREN", "POWL", "SIMO", "MOD", "MU"];

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
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
};

const out = { fetchedAt: new Date().toISOString(), source: "SEC EDGAR (data.sec.gov / www.sec.gov)", companies: {}, errors: [] };

// ティッカー→CIKの対応表もSECが公開している。手で埋めない。
let tickerMap = {};
// 対応表は2経路試す。片方が塞がってもCIKを解決できるようにする。
const MAP_URLS = [
  "https://www.sec.gov/files/company_tickers.json",
  "https://www.sec.gov/files/company_tickers_exchange.json"
];
for (const url of MAP_URLS) {
  try {
    const raw = await get(url);
    if (raw.data && raw.fields) {
      // company_tickers_exchange.json は {fields:[...], data:[[cik,name,ticker,exchange],...]}
      const iC = raw.fields.indexOf("cik"), iT = raw.fields.indexOf("ticker");
      for (const row of raw.data) tickerMap[String(row[iT]).toUpperCase()] = String(row[iC]).padStart(10, "0");
    } else {
      for (const v of Object.values(raw)) {
        if (!v || !v.ticker) continue;
        tickerMap[String(v.ticker).toUpperCase()] = String(v.cik_str).padStart(10, "0");
      }
    }
    if (Object.keys(tickerMap).length) {
      console.log(`CIK対応表を取得: ${url}（${Object.keys(tickerMap).length}銘柄)`);
      break;
    }
  } catch (e) {
    console.error(`CIK対応表の取得に失敗: ${url} → ${e.message ?? e}`);
    out.errors.push({ step: "company_tickers", url, message: String(e.message ?? e) });
  }
}
if (!Object.keys(tickerMap).length) console.error("CIK対応表が空。以降のCIK解決は全て失敗する。");

for (const t of TICKERS) {
  const cik = tickerMap[t];
  if (!cik) { out.errors.push({ ticker: t, message: "CIK未解決" }); continue; }
  const rec = { cik, latest: {}, recentFilings: [] };
  try {
    // 直近の提出書類（10-K/10-Q/8-K/20-F/6-K）へのリンク。原文を読みに行くための入口。
    const sub = await get(`https://data.sec.gov/submissions/CIK${cik}.json`);
    rec.name = sub.name;
    const r = sub.filings?.recent ?? {};
    for (let i = 0; i < (r.form?.length ?? 0) && rec.recentFilings.length < 8; i++) {
      if (!["10-K", "10-Q", "8-K", "20-F", "6-K"].includes(r.form[i])) continue;
      rec.recentFilings.push({
        form: r.form[i],
        filed: r.filingDate[i],
        period: r.reportDate?.[i] ?? null,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${(r.accessionNumber[i] || "").replace(/-/g, "")}/${r.primaryDocument[i]}`
      });
    }
    // XBRLの数値。「表紙の株数」を機械で読むのが最大の目的。
    for (const [taxonomy, tag, label] of CONCEPTS) {
      try {
        const cc = await get(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${tag}.json`);
        const units = Object.values(cc.units ?? {})[0] ?? [];
        if (!units.length) continue;
        // 提出日が最も新しいものを採る（期間ではなく提出日で見ないと古い値を拾う）
        const latest = units.slice().sort((a, b) => String(a.filed).localeCompare(String(b.filed))).pop();
        rec.latest[label] = { value: latest.val, end: latest.end, filed: latest.filed, form: latest.form, fy: latest.fy, fp: latest.fp };
      } catch { /* その会社に無い概念は飛ばす */ }
    }
    out.companies[t] = rec;
    process.stdout.write(`${t} `);
  } catch (e) {
    out.errors.push({ ticker: t, message: String(e.message ?? e) });
    process.stdout.write(`${t}:x `);
  }
}

if (Object.keys(out.companies).length === 0) {
  console.error("\n決算データが全滅したため filings.json を上書きしない。");
  console.error(JSON.stringify(out.errors, null, 2));
  process.exit(1);
}
const p = path.join(process.cwd(), "watchlist", "filings.json");
await fs.writeFile(p, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\nWrote ${p} (${Object.keys(out.companies).length} companies, ${out.errors.length} errors)`);
