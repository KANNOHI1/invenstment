// filings.json（SEC EDGAR 一次データ）を人が読める形に要約する。
// 目的は「記事の孫引きで株数・現金を語らない」こと。数字には必ず提出日と様式を添える。
//   node scripts/filing_check.mjs          # 全銘柄
//   node scripts/filing_check.mjs IREN MU  # 指定銘柄
import fs from "node:fs/promises";
import path from "node:path";

const f = JSON.parse(await fs.readFile(path.join(process.cwd(), "watchlist", "filings.json"), "utf8"));
const wanted = new Set(process.argv.slice(2).map((s) => s.toUpperCase()));
const M = (v) => (v == null ? "n/a" : Math.abs(v) >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + v.toLocaleString());
const S = (v) => (v == null ? "n/a" : (v / 1e6).toFixed(2) + "M株");
const tag = (x) => `${x.form} ${x.fp ?? ""} 提出${x.filed} 期末${x.end}`;

const out = [`filings fetchedAt ${f.fetchedAt}`, `出所: ${f.source}`, ""];
for (const [t, c] of Object.entries(f.companies ?? {})) {
  if (wanted.size && !wanted.has(t)) continue;
  const L = c.latest ?? {}, H = c.history ?? {};
  out.push(`【${t}】${c.name}（CIK ${c.cik}、決算期末 ${c.fiscalYearEnd ?? "?"}）`);
  const sh = L["発行済株式数(表紙)"];
  if (sh) out.push(`  表紙の株数 ${S(sh.value)}（${tag(sh)}）`);
  const shH = H["発行済株式数(表紙)"]?.rows ?? [];
  if (shH.length >= 2) {
    const now = shH[0], old = shH[shH.length - 1];
    const chg = ((now.value / old.value - 1) * 100).toFixed(1);
    out.push(`  株数の推移 ${old.end} ${S(old.value)} → ${now.end} ${S(now.value)}（${chg >= 0 ? "+" : ""}${chg}%、${shH.length}点）`);
  }
  for (const k of ["売上", "純損益", "営業CF", "現金及び現金同等物", "長期債務", "転換社債", "債務満期(12か月以内)", "債務満期(2年目)", "債務満期(3年目)", "資産減損"]) {
    const x = L[k];
    if (x) out.push(`  ${k} ${M(x.value)}（${tag(x)}${x.start ? `、期間 ${x.start}〜` : ""}）`);
  }
  const rev = H["売上"]?.rows ?? [];
  if (rev.length) out.push(`  売上の推移(提出順) ${rev.slice(0, 5).map((x) => `${x.end}:${M(x.value)}`).join(" ← ")}`);
  const rf = (c.recentFilings ?? []).slice(0, 5);
  if (rf.length) out.push(`  直近提出 ${rf.map((x) => `${x.form}(${x.filed})`).join(" / ")}`);
  out.push("");
}
if (f.errors?.length) out.push(`エラー: ${f.errors.map((e) => `${e.ticker ?? e.step}(${String(e.message).slice(0, 80)})`).join(" / ")}`);
if (f.lastFailure) out.push(`前回失敗: ${f.lastFailure.at}`);
console.log(out.join("\n"));
