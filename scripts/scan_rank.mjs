// ゼロベース再スキャンの一次ふるい（価格の線のみ）。
//
// 目的: 保有銘柄リストを投資宇宙にしないこと。
// これは「候補を絞る」道具であって「銘柄を選ぶ」道具ではない。
// 最終判断は必ずファンダ（受注・バックログ・資金調達依存度）と併せて行う。
//
// 使い方: node scripts/scan_rank.mjs [--all]
// 出力は結論行のみ。生データは会話に入れない。

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scan = JSON.parse(await fs.readFile(path.join(root, "watchlist", "scan_prices.json"), "utf8"));
const held = JSON.parse(await fs.readFile(path.join(root, "watchlist", "latest_prices.json"), "utf8"));

// 保有・既存監視も同じ土俵に載せる。比較対象がないと「安い」は判定できない。
const all = [...scan.rows.map((r) => ({ ...r, held: false })), ...held.rows.map((r) => ({ ...r, held: true }))];

const fmt = (v) => (v === null || v === undefined ? "  n/a" : (v >= 0 ? "+" : "") + v.toFixed(0) + "%");

const scored = all.map((r) => {
  const t = r.trajectory ?? {};
  const l = r.longTerm ?? {};
  return {
    ticker: r.ticker,
    held: r.held,
    price: r.price,
    fromHigh: t.pctFromHigh,            // 2ヶ月高値からの距離＝直近で叩かれた度合い
    fromLow: t.pctFromLow,              // 7/29安値からの戻り＝底堅さ
    d5: t.pct5d,
    d20: t.pct20d,
    y1: l.pct1y,                        // 1年騰落＝テーマに乗れているか
    rangePos: l.rangePosition,          // 5年レンジ内の位置（高いほど既に走った後）
    from5yHigh: l.pctFrom5yHigh
  };
});

// ふるいの考え方:
//  ①直近で叩かれている（2ヶ月高値比が深い）＝相場要因の下げなら拾い場
//  ②1年では上げている＝テーマに乗れている（構造的な負け組を拾わない）
//  ③5年レンジ内で天井に張り付いていない＝これから3倍の余地
const showAll = process.argv.includes("--all");
const cands = scored
  .filter((s) => s.fromHigh !== null && s.y1 !== null)
  .map((s) => ({ ...s, score: -s.fromHigh + Math.min(s.y1, 200) / 4 - Math.max(0, s.rangePos - 90) * 2 }))
  .sort((a, b) => b.score - a.score);

console.log(`scan fetchedAt ${scan.fetchedAt}／候補${scan.rows.length}＋保有監視${held.rows.length}`);
console.log("");
console.log("ticker  保有 2M高値比 7/29比  5日   1年  5yレンジ位置");
for (const s of (showAll ? cands : cands.slice(0, 18))) {
  console.log(
    `${s.ticker.padEnd(6)} ${s.held ? "★" : " "}   ${fmt(s.fromHigh).padStart(5)} ${fmt(s.fromLow).padStart(6)} ${fmt(s.d5).padStart(5)} ${fmt(s.y1).padStart(6)}  ${s.rangePos === null ? "n/a" : s.rangePos.toFixed(0) + "%"}`
  );
}
console.log("");
console.log("※これは一次ふるい。順位＝買い推奨ではない。ファンダ検証を必ず通すこと。");
