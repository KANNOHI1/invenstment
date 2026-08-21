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
out.push("【日次】仮説C 反証3条件");

// 条件1: いずれかの主要銘柄が7/29の安値を終値で下回る
const breaches = [];
for (const r of prices.rows) {
  const jul29 = (r.history ?? []).find((h) => h.date === L.jul29_reference_date);
  if (jul29 && r.price < jul29.close) breaches.push(`${r.ticker} ${r.price}<${jul29.close}`);
}
out.push(`  ①7/29終値割れ: ${breaches.length ? "★該当 " + breaches.join(", ") : "なし（9銘柄）"}`);

// 条件2: NVDAが2ヶ月高値から-10%以上
const nvda = rows.NVDA;
if (nvda) {
  const d = pct(nvda.price, L.NVDA_thesisC_floor);
  out.push(`  ②NVDA -10%ライン $${L.NVDA_thesisC_floor}: 現値$${nvda.price}、あと${f(d)} ${nvda.price <= L.NVDA_thesisC_floor ? "★該当" : ""}`);
}

// 条件3: 5営業日以上、監視銘柄の過半が下落を続ける
// ここが代理指標に置き換わっていた箇所。登録条件そのものを計算する。
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
out.push(`  ③過半下落の連続日数: ${streak}/5日（直近${last.dt} ${last.down}/${last.total}下落）${streak >= 5 ? " ★該当" : ""}`);
out.push("");

// ── 距離（監視線） ─────────────────────────────────────────
out.push("【距離】監視線まで");
if (rows.SIMO) out.push(`  SIMO 撤退線$${L.SIMO_exit}: 現値$${rows.SIMO.price}、あと${f(pct(rows.SIMO.price, L.SIMO_exit))}`);
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
out.push(`  執行上限 $${b.yenConversionDone ? b.execCapUsdIfYenConverted : b.execCapUsd}（円転${b.yenConversionDone ? "済" : "未実行"}）`);
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
