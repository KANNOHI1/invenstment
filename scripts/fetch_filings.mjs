// SEC EDGAR から決算の一次データを取得して watchlist/filings.json に書き出す。
//
// なぜ必要か: 「一次資料で確認した」と称していたものが実際は記事の二次引用で、
// IREN の発行済株式数を 37M 株誤る（357M → 実際 394.06M）事故が起きた（2026-08-28）。
// クラウド（GitHub Actions / Claude のコンテナ）からは SEC が 403 で遮断していたため
// 一時 Yahoo 版に書き換えたが、ローカル一本化（2026-09-08）で家庭用 IP から到達できるようになり
// SEC 版を復元した（2026-09-10）。
//
// 使い方（プロジェクトルートで）:
//   node scripts/fetch_filings.mjs            # cik.json の全銘柄
//   node scripts/fetch_filings.mjs IREN MU    # 指定銘柄だけ
// 依存パッケージなし。Node 20+。
//
// 出所: data.sec.gov の submissions（提出書類一覧）と companyfacts（XBRL 全事実）。
// 1 社あたり 2 リクエスト。SEC の上限は 10 req/s。

import fs from "node:fs/promises";
import path from "node:path";

// SEC の規約: User-Agent に「名前＋連絡先メール」が必要。欠けると 403。
const UA = "Hirotake Kanno c63410@gmail.com";
const CIK_PATH = path.join(process.cwd(), "watchlist", "cik.json");
const OUT_PATH = path.join(process.cwd(), "watchlist", "filings.json");

// 取りに行く XBRL の概念。決算のたびに手で読み直さないための機械可読ソース。
// 同じ意味で会社によりタグが割れるものは同じ label に並べ、最初に見つかったものを採る。
const CONCEPTS = [
  ["発行済株式数(表紙)", ["dei:EntityCommonStockSharesOutstanding"]],
  ["発行済株式数(BS)", ["us-gaap:CommonStockSharesOutstanding", "ifrs-full:NumberOfSharesOutstanding"]],
  ["売上", ["us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "ifrs-full:Revenue"]],
  ["純損益", ["us-gaap:NetIncomeLoss", "us-gaap:ProfitLoss", "ifrs-full:ProfitLoss"]],
  ["資産減損", ["us-gaap:AssetImpairmentCharges", "us-gaap:ImpairmentOfLongLivedAssetsHeldForUse", "ifrs-full:ImpairmentLoss"]],
  ["現金及び現金同等物", ["us-gaap:CashAndCashEquivalentsAtCarryingValue", "us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "ifrs-full:CashAndCashEquivalents"]],
  ["営業CF", ["us-gaap:NetCashProvidedByUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperatingActivities"]],
  ["長期債務", ["us-gaap:LongTermDebt", "us-gaap:LongTermDebtNoncurrent", "us-gaap:LongTermDebtAndCapitalLeaseObligations", "ifrs-full:NoncurrentBorrowingsAndNoncurrentPortionOfCurrentBorrowings"]],
  ["転換社債", ["us-gaap:ConvertibleNotesPayable", "us-gaap:ConvertibleLongTermNotesPayable"]],
  ["債務満期(12か月以内)", ["us-gaap:LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths"]],
  ["債務満期(2年目)", ["us-gaap:LongTermDebtMaturitiesRepaymentsOfPrincipalInYearTwo"]],
  ["債務満期(3年目)", ["us-gaap:LongTermDebtMaturitiesRepaymentsOfPrincipalInYearThree"]],
  ["希薄化後加重平均株数", ["us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding", "ifrs-full:WeightedAverageNumberOfDilutedOrdinarySharesOutstanding"]]
];
// これより古い提出日の事実は「最新値」として扱わない（タグ替えで放棄された古い値を拾う事故を防ぐ）
const STALE_DAYS = 550;
// 推移を残す概念（1 点だけ見て「増えた / 減った」を語らないため）
const HISTORY_LABELS = new Set(["発行済株式数(表紙)", "売上", "純損益", "現金及び現金同等物", "営業CF"]);
const HISTORY_POINTS = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`HTTP ${res.status} ${url} :: ${body}`);
  }
  return res.json();
};

// XBRL の事実 → 提出日の新しい順に並べ、同じ (end, val) の重複を落とす。
// 候補タグが複数あるときは「最も新しく提出された」タグを採る（会社が年度途中でタグを替えるため）。
// 単位は USD → shares → pure を優先（SIMO は旧年度に TWD 建ての同名タグを持つ）。
const UNIT_PREF = ["USD", "shares", "pure"];
const series = (facts, keys) => {
  let best = null;
  for (const key of keys) {
    const [taxonomy, tag] = key.split(":");
    const units = facts?.[taxonomy]?.[tag]?.units;
    if (!units) continue;
    const unit = UNIT_PREF.find((u) => units[u]?.length) ?? Object.keys(units).find((u) => units[u]?.length);
    if (!unit) continue;
    const rows = units[unit].slice().sort((a, b) => String(b.filed).localeCompare(String(a.filed)) || String(b.end).localeCompare(String(a.end)));
    if (!best || String(rows[0].filed) > String(best.rows[0].filed)) best = { tag: key, unit, rows };
  }
  if (!best) return null;
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400e3).toISOString().slice(0, 10);
  if (String(best.rows[0].filed) < cutoff) return null;
  const seen = new Set();
  const out = [];
  for (const r of best.rows) {
    const k = `${r.end}|${r.val}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ value: r.val, start: r.start ?? null, end: r.end, filed: r.filed, form: r.form, fy: r.fy, fp: r.fp, frame: r.frame ?? null });
  }
  return { tag: best.tag, unit: best.unit, rows: out };
};

const wanted = new Set(process.argv.slice(2).map((s) => s.toUpperCase()));
const out = { fetchedAt: new Date().toISOString(), source: "SEC EDGAR (data.sec.gov submissions + companyfacts)", companies: {}, errors: [] };

let CIKS = [];
try { CIKS = JSON.parse(await fs.readFile(CIK_PATH, "utf8")); }
catch (e) { out.errors.push({ step: "cik.json", message: String(e.message ?? e) }); }
if (wanted.size) CIKS = CIKS.filter((c) => wanted.has(c.ticker.toUpperCase()));

for (const entry of CIKS) {
  const { ticker: t, expect } = entry;
  const candidates = Array.isArray(entry.cik) ? entry.cik : [entry.cik];
  const tried = [];
  try {
    // CIK の取り違えは「別会社の数字を自社の数字として使う」最悪の事故。
    // 候補を順に当たり、社名が expect と一致したものだけを採用する。expect 無しは認めない。
    if (!expect) throw new Error("cik.json に expect（社名の照合文字列）が無い");
    let cik = null, sub = null;
    for (const c of candidates) {
      try {
        const s2 = await get(`https://data.sec.gov/submissions/CIK${c}.json`);
        const name = String(s2.name ?? "");
        tried.push(`${c}="${name}"`);
        if (name.toUpperCase().includes(String(expect).toUpperCase())) { cik = c; sub = s2; break; }
      } catch (e) {
        tried.push(`${c}:${String(e.message ?? e).slice(0, 60)}`);
      }
      await sleep(150);
    }
    if (!sub) throw new Error(`社名が一致する CIK が無い（期待:"${expect}"）試行: ${tried.join(" / ")}`);

    const rec = { cik, name: sub.name, fiscalYearEnd: sub.fiscalYearEnd ?? null, cikResolvedFrom: tried, recentFilings: [], latest: {}, history: {} };
    const r = sub.filings?.recent ?? {};
    for (let i = 0; i < (r.form?.length ?? 0) && rec.recentFilings.length < 12; i++) {
      if (!["10-K", "10-Q", "8-K", "20-F", "6-K", "424B5"].includes(r.form[i])) continue;
      rec.recentFilings.push({
        form: r.form[i],
        filed: r.filingDate[i],
        period: r.reportDate?.[i] || null,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${(r.accessionNumber[i] || "").replace(/-/g, "")}/${r.primaryDocument[i]}`
      });
    }

    await sleep(150);
    const cf = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
    for (const [label, keys] of CONCEPTS) {
      const s = series(cf.facts, keys);
      if (!s) continue;
      rec.latest[label] = { ...s.rows[0], tag: s.tag, unit: s.unit };
      if (HISTORY_LABELS.has(label)) rec.history[label] = { tag: s.tag, unit: s.unit, rows: s.rows.slice(0, HISTORY_POINTS) };
    }
    out.companies[t] = rec;
    process.stdout.write(`${t} `);
  } catch (e) {
    out.errors.push({ ticker: t, message: String(e.message ?? e) });
    process.stdout.write(`${t}:x `);
  }
  await sleep(150);
}

// 全滅しても既存の良好なデータは潰さない（fetch_prices.mjs と同じガード）。
if (Object.keys(out.companies).length === 0) {
  let prev = null;
  try { prev = JSON.parse(await fs.readFile(OUT_PATH, "utf8")); } catch { /* 初回 */ }
  if (prev?.companies && Object.keys(prev.companies).length) {
    prev.lastFailure = { at: out.fetchedAt, errors: out.errors };
    await fs.writeFile(OUT_PATH, JSON.stringify(prev, null, 2) + "\n", "utf8");
    console.error("取得全滅。既存データを維持し lastFailure に記録した。");
  } else {
    out.note = "取得全滅。companies が空。errors に原因がある。";
    await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.error("取得全滅。原因を filings.json の errors に記録した。");
  }
  console.error(JSON.stringify(out.errors, null, 2));
  process.exit(1);
}

// 一部指定で走らせたときは、指定外の銘柄の既存データを残す
if (wanted.size) {
  try {
    const prev = JSON.parse(await fs.readFile(OUT_PATH, "utf8"));
    for (const [t, c] of Object.entries(prev.companies ?? {})) if (!out.companies[t]) out.companies[t] = c;
  } catch { /* 初回 */ }
}
await fs.writeFile(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\nWrote ${OUT_PATH} (${Object.keys(out.companies).length} companies, ${out.errors.length} errors)`);
if (out.errors.length) console.error(JSON.stringify(out.errors, null, 2));
