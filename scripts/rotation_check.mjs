// ローテーションの現在地を機械判定する。
//
// なぜ作ったか: 2026-08-18〜20、金利上昇と原油高で保有が約4%溶けたとき、
// 巡回の機械チェックは3日間「反証なし」と言い続けた。仮説登録簿は
// 「テーマが死んだか」しか見ておらず、「サイクルの時計がどこを指しているか」を
// 見る装置が一つも無かったため。ここはその欠落を埋める。
//
// 出す3つ:
//   ①象限判定（金融相場／業績相場／逆金融相場／逆業績相場）と根拠
//   ②11セクターの相対強度ランキング（資金がどこにあるか）
//   ③教科書が言う主役 vs 実際に走っている層のズレ ← これが最大の情報
//
// 使い方: node scripts/rotation_check.mjs
// 出力は結論行のみ。生データは会話に入れない。

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rot = JSON.parse(await fs.readFile(path.join(root, "watchlist", "rotation_prices.json"), "utf8"));
const R = Object.fromEntries(rot.rows.map((r) => [r.ticker, r]));

const SECTORS = {
  XLK: "情報技術", XLF: "金融", XLE: "エネルギー", XLV: "ヘルスケア",
  XLP: "生活必需品", XLU: "公益", XLI: "資本財", XLB: "素材",
  XLY: "一般消費財", XLRE: "不動産", XLC: "通信サービス"
};
// 教科書（セクターローテーション）の主役マッピング
const PLAYBOOK = {
  "金融相場":   { lead: ["XLK", "XLF"], note: "金利低下×景気底入れ。情報技術・金融が主役" },
  "業績相場":   { lead: ["XLI", "XLB", "XLY"], note: "景気拡大×金利上昇。資本財・素材・一般消費財が主役" },
  "逆金融相場": { lead: ["XLE"], note: "景気ピーク×インフレ/高金利。エネルギーが主役、株全体は逆風" },
  "逆業績相場": { lead: ["XLC", "XLV", "XLP", "XLU"], note: "景気後退×金利低下。ディフェンシブが主役" }
};

const pct = (r, days) => {
  const h = r?.history ?? [];
  if (h.length <= days) return null;
  const from = h[h.length - 1 - days].close;
  return from ? ((r.price / from) - 1) * 100 : null;
};
const f = (v, d = 1) => (v === null || v === undefined ? "n/a" : (v >= 0 ? "+" : "") + v.toFixed(d) + "%");
// 週足ベースの変化率。20日窓は基準日の入れ替わりで符号が反転しうるため、
// 大局の判定はこちらで行う（2026-08-24〜26に原油の20日変化が+3.0%→-3.1%と反転した）。
const wpct = (r, weeks) => {
  const h = r?.historyWeekly ?? [];
  if (h.length <= weeks) return null;
  const from = h[h.length - 1 - weeks].close;
  return from ? ((r.price / from) - 1) * 100 : null;
};
// 40週移動平均（≒200日線）と、その傾き（直近13週で上向きか）
const ma = (r, weeks, backWeeks = 0) => {
  const h = r?.historyWeekly ?? [];
  const end = h.length - backWeeks;
  if (end < weeks) return null;
  const slice = h.slice(end - weeks, end);
  return slice.reduce((s, x) => s + x.close, 0) / slice.length;
};
const trendOf = (r) => {
  const m40 = ma(r, 40), m40prev = ma(r, 40, 13);
  if (m40 === null || m40prev === null) return null;
  const above = r.price > m40;
  const rising = m40 > m40prev;
  if (above && rising) return "上昇トレンド";
  if (!above && !rising) return "下降トレンド";
  if (above && !rising) return "反発中（均線はまだ下向き）";
  return "調整中（均線は上向き）";
};

const out = [];

out.push(`rotation fetchedAt ${rot.fetchedAt}`);
out.push("");

// ── ①マクロ座標 ────────────────────────────────────────
out.push("【マクロ座標】現値（20日変化）");
const macro = [
  ["^TNX", "10年金利"], ["^TYX", "30年金利"], ["CL=F", "WTI原油"],
  ["DX-Y.NYB", "ドル指数"], ["^VIX", "VIX"], ["GC=F", "金"]
];
for (const [t, name] of macro) {
  const r = R[t];
  if (!r) continue;
  out.push(`  ${name.padEnd(8, "　")} ${String(r.price).padStart(8)}（20日 ${f(pct(r, 20))}）`);
}
// クレジット選好: HYG/LQD の相対
const hyg = pct(R.HYG, 20), lqd = pct(R.LQD, 20);
const credit = hyg !== null && lqd !== null ? hyg - lqd : null;
out.push(`  クレジット選好 HYG-LQD 20日差 ${f(credit)}${credit !== null ? (credit > 0 ? "（信用選好=景気に強気）" : "（信用回避=景気に弱気）") : ""}`);
out.push("");

// ── ②象限判定 ────────────────────────────────────────
// 横軸=景気: 景気敏感セクター vs ディフェンシブの相対強度、小型/大型、クレジット
const avg = (a) => { const v = a.filter((x) => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const cyc = avg(["XLI", "XLB", "XLY"].map((t) => pct(R[t], 20)));
const def = avg(["XLP", "XLU", "XLV"].map((t) => pct(R[t], 20)));
const iwmSpy = pct(R.IWM, 20) !== null && pct(R.SPY, 20) !== null ? pct(R.IWM, 20) - pct(R.SPY, 20) : null;

let ecoScore = 0;
const ecoWhy = [];
if (cyc !== null && def !== null) {
  ecoScore += cyc > def ? 1 : -1;
  ecoWhy.push(`景気敏感${f(cyc)} vs ディフェンシブ${f(def)}`);
}
if (iwmSpy !== null) { ecoScore += iwmSpy > 0 ? 1 : -1; ecoWhy.push(`小型-大型 ${f(iwmSpy)}`); }
if (credit !== null) { ecoScore += credit > 0 ? 1 : -1; ecoWhy.push(`クレジット ${f(credit)}`); }

// 縦軸=金利: 10年金利の20日変化＋原油の20日変化
const tnx = pct(R["^TNX"], 20), oil = pct(R["CL=F"], 20);
// 不感帯（デッドバンド）: ゼロ近傍の20日変化で象限ラベルが反転するのを防ぐ。
// 2026-08-28、10年金利の20日変化が +0.21%→-0.42% とゼロを跨いだだけで
// 判定が「業績相場」→「金融相場」へ反転した。同じ金利は60日+5.12%・52週+15.4%で
// 上昇トレンドのままであり、趨勢は何も変わっていなかった。ラベルだけが動く誤報。
const DEADBAND = 1.5; // %。これ未満の20日変化は「方向なし」として0点にする
let rateScore = 0;
const rateWhy = [];
const dbScore = (v) => (Math.abs(v) < DEADBAND ? 0 : v > 0 ? 1 : -1);
if (tnx !== null) { rateScore += dbScore(tnx); rateWhy.push(`10年金利 ${f(tnx)}${Math.abs(tnx) < DEADBAND ? "（不感帯・方向なし）" : ""}`); }
if (oil !== null) { rateScore += dbScore(oil); rateWhy.push(`原油 ${f(oil)}${Math.abs(oil) < DEADBAND ? "（不感帯・方向なし）" : ""}`); }

const eco = ecoScore >= 0 ? "強い" : "弱い";
// 不感帯で0点なら「判定不能」。ゼロ近傍を強引に上昇/低下へ丸めない。
const rate = rateScore > 0 ? "上昇" : rateScore < 0 ? "低下" : "方向なし";
let quad, quadNote = "";
if (rate === "方向なし") {
  // 20日では方向が出ない。週足の趨勢で代替する（大局を優先）。
  const wTnx = wpct(R["^TNX"], 13);
  const wDir = wTnx === null ? null : wTnx > 0 ? "上昇" : "低下";
  quad = eco === "強い" ? (wDir === "低下" ? "金融相場" : "業績相場") : (wDir === "低下" ? "逆業績相場" : "逆金融相場");
  quadNote = `（20日は不感帯。週足13週の金利${f(wTnx)}で代替判定）`;
} else if (eco === "強い" && rate === "上昇") quad = "業績相場";
else if (eco === "強い" && rate === "低下") quad = "金融相場";
else if (eco === "弱い" && rate === "上昇") quad = "逆金融相場";
else quad = "逆業績相場";

out.push(`【象限判定】**${quad}**${quadNote}（景気=${eco} スコア${ecoScore >= 0 ? "+" : ""}${ecoScore} ／ 金利=${rate} スコア${rateScore >= 0 ? "+" : ""}${rateScore}）`);
out.push(`  景気の根拠: ${ecoWhy.join("、")}`);
out.push(`  金利の根拠: ${rateWhy.join("、")}`);
out.push(`  教科書の処方: ${PLAYBOOK[quad].note}`);
out.push("");

// ── ③セクター序列 ──────────────────────────────────────
const ranked = Object.keys(SECTORS)
  .filter((t) => R[t])
  .map((t) => ({ t, name: SECTORS[t], d5: pct(R[t], 5), d20: pct(R[t], 20), d60: pct(R[t], 60) }))
  .sort((a, b) => (b.d20 ?? -999) - (a.d20 ?? -999));

out.push("【資金の所在】セクター相対強度（20日順）");
out.push("  順  セクター      5日     20日    60日");
ranked.forEach((s, i) => {
  out.push(`  ${String(i + 1).padStart(2)}  ${s.name.padEnd(8, "　")} ${f(s.d5).padStart(7)} ${f(s.d20).padStart(7)} ${f(s.d60).padStart(7)}`);
});
out.push("");

// ── ④教科書とのズレ ───────────────────────────────────
const leadTickers = PLAYBOOK[quad].lead;
const positions = leadTickers.map((t) => {
  const i = ranked.findIndex((r) => r.t === t);
  return { t, name: SECTORS[t], rank: i >= 0 ? i + 1 : null };
});
const actualTop3 = ranked.slice(0, 3).map((r) => r.name).join("・");
const bookNames = positions.map((p) => `${p.name}(${p.rank ?? "?"}位)`).join("、");
const inTop = positions.filter((p) => p.rank !== null && p.rank <= 5).length;
const inBottom = positions.filter((p) => p.rank !== null && p.rank >= 8).length;
let verdict;
if (inTop === positions.length) verdict = "一致。教科書どおりに回っている";
else if (inTop > 0 && inBottom > 0) verdict = "★分裂。教科書の主役が上位と下位に割れている——象限が移動中か、別の力が働いている";
else if (inTop > 0) verdict = "部分一致。主役の一部だけが走っている";
else verdict = "★不一致。教科書が効かない局面——市場が別の何かを先取りしている";

out.push("【主役の判定】");
out.push(`  教科書の主役: ${bookNames}`);
out.push(`  実際の上位3: ${actualTop3}`);
out.push(`  実際の下位3: ${ranked.slice(-3).map((r) => r.name).join("・")}`);
out.push(`  → ${verdict}`);
out.push("");

// ── ⑤大局（週足）──────────────────────────────────────
// 短期の窓だけを見ると、数日の戦争・決算のボラで趨勢を見失う。
out.push("【大局】週足の趨勢（13週=約3ヶ月／52週=1年／40週線=約200日線）");
out.push("  計器          13週     52週  40週線との位置");
for (const [t, name] of [["^TNX", "10年金利"], ["^TYX", "30年金利"], ["CL=F", "WTI原油"], ["DX-Y.NYB", "ドル指数"], ["^VIX", "VIX"], ["GC=F", "金"]]) {
  const r = R[t];
  if (!r || !r.historyWeekly) continue;
  const tr = trendOf(r);
  out.push(`  ${name.padEnd(9, "　")} ${f(wpct(r, 13)).padStart(7)} ${f(wpct(r, 52)).padStart(8)}  ${tr ?? "n/a"}`);
}
out.push("");
out.push("  主要セクターの週足（13週／52週）");
for (const [t, name] of [["XLK", "情報技術"], ["XLE", "エネルギー"], ["XLI", "資本財"], ["XLV", "ヘルスケア"], ["XLU", "公益"], ["SMH", "半導体"]]) {
  const r = R[t];
  if (!r || !r.historyWeekly) continue;
  out.push(`  ${name.padEnd(9, "　")} ${f(wpct(r, 13)).padStart(7)} ${f(wpct(r, 52)).padStart(8)}  ${trendOf(r) ?? "n/a"}`);
}
out.push("");

// ── ⑥テーマ内サブセクター ────────────────────────────────
out.push("【テーマ内の中身】20日");
for (const [t, name] of [["SMH", "半導体"], ["IGV", "ソフトウェア"], ["URA", "ウラン"], ["XME", "資源"], ["QQQ", "ナスダック100"]]) {
  if (R[t]) out.push(`  ${name.padEnd(10, "　")} ${f(pct(R[t], 20)).padStart(7)}`);
}

console.log(out.join("\n"));
