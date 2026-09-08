// 決算発表の翌営業日にどう動いたかを、検証済みの終値だけで計算する。
// Web検索由来の値動きの記述は使わない（2026-08-06にMODで17.8%の誤差を出した経緯による）。
// 使い方: node scripts/earnings_reaction.mjs [TICKER]
import fs from "node:fs";

const ticker = (process.argv[2] ?? "MU").toUpperCase();
const D = JSON.parse(fs.readFileSync("watchlist/daily_long.json", "utf8"));
const E = JSON.parse(fs.readFileSync("watchlist/earnings_dates.json", "utf8"));

const hist = D.series[ticker];
if (!hist) { console.error(`${ticker} の日次履歴が daily_long.json に無い`); process.exit(1); }
const dates = E[ticker];
if (!dates) { console.error(`${ticker} の決算日が earnings_dates.json に無い`); process.exit(1); }

const idx = new Map(hist.map((r, i) => [r.date, i]));
const pct = (a, b) => ((b - a) / a) * 100;
const f = (v) => (v > 0 ? "+" : "") + v.toFixed(1) + "%";

console.log(`${ticker} 決算翌営業日の反応（終値ベース）`);
console.log(`価格データ: watchlist/daily_long.json fetchedAt ${D.fetchedAt}（${hist[0].date}〜${hist[hist.length-1].date}）`);
console.log(`決算日: watchlist/earnings_dates.json（全て引け後発表。反応は翌営業日）\n`);

const rows = [];
for (const e of dates) {
  // 発表日そのものが休場等で無い場合は直前の営業日を基準にする
  let i = idx.get(e.date);
  if (i === undefined) {
    for (let j = hist.length - 1; j >= 0; j--) if (hist[j].date < e.date) { i = j; break; }
  }
  if (i === undefined || i + 1 >= hist.length) continue;
  const base = hist[i], next = hist[i + 1];
  const d1 = pct(base.close, next.close);
  const k = Math.min(i + 5, hist.length - 1);
  const d5 = pct(base.close, hist[k].close);
  rows.push({ q: e.quarter, d: e.date, base: base.close, nd: next.date, next: next.close, d1, d5 });
}

for (const r of rows) {
  console.log(
    `${r.q.padEnd(8)} ${r.d} $${String(r.base).padStart(9)} → ${r.nd} $${String(r.next).padStart(9)}  ` +
    `翌日 ${f(r.d1).padStart(7)}   5営業日後 ${f(r.d5).padStart(7)}`
  );
}

const up = rows.filter((r) => r.d1 > 0).length;
const dn = rows.filter((r) => r.d1 < 0).length;
const abs = rows.map((r) => Math.abs(r.d1));
const avgAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
const flip = rows.filter((r) => Math.sign(r.d1) !== Math.sign(r.d5)).length;
console.log(`\n件数 ${rows.length}／上昇 ${up}・下落 ${dn}`);
console.log(`翌日変化の絶対値: 平均 ${avgAbs.toFixed(1)}%・最大 ${Math.max(...abs).toFixed(1)}%・最小 ${Math.min(...abs).toFixed(1)}%`);
console.log(`翌日と5営業日後で符号が反転した回数: ${flip}／${rows.length}`);
