// 決算の一次データ（SEC EDGAR）を要約して出す。
// 目的は「記事の孫引きで数字を語らない」こと。出力は結論行のみ。
import fs from "node:fs/promises";
import path from "node:path";

const f = JSON.parse(await fs.readFile(path.join(process.cwd(), "watchlist", "filings.json"), "utf8"));
const n = (v) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v));
const out = [`filings fetchedAt ${f.fetchedAt}（出所: SEC EDGAR）`, ""];

for (const [t, c] of Object.entries(f.companies)) {
  out.push(`【${t}】${c.name ?? ""} CIK ${c.cik}`);
  const sh = c.latest["発行済株式数"] ?? c.latest["発行済株式数(us-gaap)"];
  if (sh) out.push(`  発行済株式数 ${n(sh.value)}（${sh.form} 提出${sh.filed}、基準${sh.end}）`);
  for (const k of ["希薄化後加重平均株数", "売上", "売上(Revenues)", "純損益", "資産減損", "現金及び現金同等物"]) {
    const v = c.latest[k];
    if (v) out.push(`  ${k} ${n(v.value)}（${v.form} ${v.fy ?? ""}${v.fp ?? ""} 期末${v.end}）`);
  }
  const latest = (c.recentFilings ?? [])[0];
  if (latest) out.push(`  直近提出 ${latest.form} ${latest.filed} → ${latest.url}`);
  out.push("");
}
if (f.errors?.length) out.push(`エラー: ${f.errors.map((e) => `${e.ticker ?? e.step}(${e.message})`).join(", ")}`);
console.log(out.join("\n"));
