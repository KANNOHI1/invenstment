// 巡回の機械部分を1コマンドで出す。
//
// なぜスクリプトにするか: 毎回 node -e を手打ちしていたため、
// 登録簿の反証条件そのものではなく「代理指標」を計算していた事故が起きた
// （2026-08-21判明: 仮説Cの「監視銘柄の過半が5営業日下落」を
//  「NVDAの続落日数」で代用しており、3/5まで来ていたことに3日間気づかなかった）。
// 条件は登録簿からコードへ一度だけ写し、以後は手で書き直さない。
//
// 使い方: node scripts/patrol_check.mjs
// 出力は結論行のみ。生データは会話に入れない。

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const prices = JSON.parse(await fs.readFile(path.join(root, "watchlist", "latest_prices.json"), "utf8"));
const holdings = JSON.parse(await fs.readFile(path.join(root, "watchlist", "holdings.json"), "utf8"));

const rows = Object.fromEntries(prices.rows.map((r) => [r.ticker, r]));
const L = holdings.lines;
const pct = (from, to) => ((to / from - 1) * 100);
const f = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

const out = [];
out.push(`quoteTime ${prices.rows[0]?.quoteTime ?? prices.fetchedAt}（fetched ${prices.fetchedAt}）`);
out.push("");

// ── 日次: 仮説C「7/29が市場全体の底」の反証3条件 ───────────────────
// 仮説C「7/29が底」は2026-08-24に崩壊済み。その反証条件をチェックし続けても意味がない。
// ただし「7/29終値割れ」と「過半下落の連続日数」は市場の広がりを見る指標として有用なので、
// 仮説のラベルを外して残す。NVDAの-10%ラインはCに固有だったため削除。
out.push("【市場の広がり】※仮説Cは2026-08-24に崩壊済み。以下は指標として継続");

// 7/29（直近の主要な安値日）を終値で下回っている銘柄
const breaches = [];
for (const r of prices.rows) {
  const jul29 = (r.history ?? []).find((h) => h.date === L.jul29_reference_date);
  if (jul29 && r.price < jul29.close) breaches.push(`${r.ticker} ${r.price}<${jul29.close}`);
}
out.push(`  7/29終値を下回る銘柄: ${breaches.length ? breaches.join(", ") : "なし（9銘柄）"}`);

// 過半下落の連続日数（市場全体が売られ続けているか）
const dates = (prices.rows[0].history ?? []).map((h) => h.date);
const majorityDown = [];
for (const dt of dates) {
  let down = 0;
  let total = 0;
  for (const r of prices.rows) {
    const h = r.history ?? [];
    const i = h.findIndex((x) => x.date === dt);
    if (i < 1) continue;
    total++;
    if (h[i].close < h[i - 1].close) down++;
  }
  if (total) majorityDown.push({ dt, down, total, hit: down > total / 2 });
}
let streak = 0;
for (let i = majorityDown.length - 1; i >= 0; i--) {
  if (majorityDown[i].hit) streak++;
  else break;
}
const last = majorityDown[majorityDown.length - 1];
out.push(`  過半下落の連続日数: ${streak}日（直近${last.dt} ${last.down}/${last.total}下落）`);
out.push("");

// ── 距離（監視線） ─────────────────────────────────────────
// 損失線は引かない（2026-09-01 ユーザー決定）。売却は事業の論理が壊れたときのみ。
// 旧SIMO撤退線$209.68は根拠（仮説Cの反証ライン）が8/24に崩壊したため撤回済み。
out.push("【監視】価格による売却線は無し。事業の論理が壊れたときのみ売る（`thesis_register.md`の反証条件で判定）");
out.push("");

// ── 保有（点ではなく線）─────────────────────────────────────
out.push("【保有】取得→現在の軌跡");
let total = 0;
const isMonthStart = new Date(prices.fetchedAt).getUTCDate() <= 3;
for (const p of holdings.positions) {
  const r = rows[p.ticker];
  if (!r) { out.push(`  ${p.ticker}: 価格なし（推測で埋めない）`); continue; }
  total += p.shares * r.price;
  const pl = isMonthStart ? `　含み${f(pct(p.cost, r.price))}` : "";
  out.push(`  ${p.ticker} ${p.shares}株 $${p.cost}（${p.since}取得）→ $${r.price}（日次${f(r.changePct)}）${pl}`);
}
out.push(`  評価額合計 $${total.toFixed(0)}／現金 $${holdings.cash.usd}＋¥${holdings.cash.jpy}`);
const b = holdings.budget;
out.push(`  執行上限 $${b.execCapUsd}（予備費¥${b.reserveJpy.toLocaleString()}は${b.reserveLocation ?? "口座内"}）`);
out.push("");

// ── 週次（土曜のみ）: 仮説A「借りる側 vs 稼ぐ側」──────────────────
// 反証条件は「2週間継続」。日次で見ても判定が変わらないため土曜だけ計算する。
const dow = new Date(prices.fetchedAt).getUTCDay();
if (dow === 6 || process.argv.includes("--weekly")) {
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const g = (ts) => ts.filter((t) => rows[t]).map((t) => rows[t].trajectory.pctFromHigh);
  const borrow = g(["IREN", "CRWV", "NBIS"]);
  const earn = g(["NVDA", "MU", "SIMO"]);
  const hit = avg(borrow) > avg(earn);
  out.push("【週次】仮説A 借りる側 vs 稼ぐ側（2ヶ月高値比）");
  out.push(`  借りる側 ${avg(borrow).toFixed(1)}% vs 稼ぐ側 ${avg(earn).toFixed(1)}%: ${hit ? "★借りる側が優位＝反証カウント+1" : "カウント0（反証進行なし）"}`);
  out.push("");
}

// ── イベント判定の注意 ──────────────────────────────────────
out.push("【イベント】B=決算日のみ判定／D=毎日の材料調査で判定（価格では出ない）");

console.log(out.join("\n"));
