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
// SECの規約: User-Agentに「組織名＋連絡先メール」が必要。欠けると403で弾かれる。
// 個人メールは使わず、GitHubの公開用noreplyアドレスを連絡先にする。
const UA = "invenstment-research 219152498+KANNOHI1@users.noreply.github.com";
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

const out = { fetchedAt: new Date().toISOString(), source: "SEC EDGAR (data.sec.gov / www.sec.gov)", companies: {}, errors: [] };

// ティッカー→CIKの対応表もSECが公開している。手で埋めない。
let CIKS = [];
try {
  CIKS = JSON.parse(await fs.readFile(CIK_PATH, "utf8"));
} catch (e) {
  out.errors.push({ step: "cik.json", message: String(e.message ?? e) });
}
if (!CIKS.length) console.error("cik.json が読めない。取得できない。");

for (const entry of CIKS) {
  const { ticker: t, cik, expect } = entry;
  const rec = { cik, latest: {}, recentFilings: [] };
  try {
    // 直近の提出書類（10-K/10-Q/8-K/20-F/6-K）へのリンク。原文を読みに行くための入口。
    const sub = await get(`https://data.sec.gov/submissions/CIK${cik}.json`);
    rec.name = sub.name;
    // CIKの取り違えは「別会社の数字を自社の数字として使う」最悪の事故になる。必ず社名で検証する。
    if (expect && !String(sub.name ?? "").toUpperCase().includes(String(expect).toUpperCase())) {
      throw new Error(`社名不一致: CIK${cik} は "${sub.name}"（期待: "${expect}"）— cik.jsonを修正すること`);
    }
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

const p = path.join(process.cwd(), "watchlist", "filings.json");

// 全滅しても「なぜ失敗したか」はリポジトリに残す。
// CIログを追わないと原因が分からない状態が、修正を2往復させた（2026-08-28）。
if (Object.keys(out.companies).length === 0) {
  let prev = null;
  try { prev = JSON.parse(await fs.readFile(p, "utf8")); } catch { /* 初回 */ }
  if (prev?.companies && Object.keys(prev.companies).length) {
    // 良好なデータは潰さず、失敗の記録だけ足す
    prev.lastFailure = { at: out.fetchedAt, errors: out.errors };
    await fs.writeFile(p, JSON.stringify(prev, null, 2) + "\n", "utf8");
    console.error("取得全滅。既存データを維持し lastFailure に記録した。");
  } else {
    out.note = "取得全滅。companiesが空。errorsに原因がある。";
    await fs.writeFile(p, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.error("取得全滅。原因を filings.json の errors に記録した。");
  }
  console.error(JSON.stringify(out.errors, null, 2));
  process.exit(0); // ファイルは書けたので後続のコミットを妨げない
}
await fs.writeFile(p, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\nWrote ${p} (${Object.keys(out.companies).length} companies, ${out.errors.length} errors)`);
