import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  CircleDollarSign,
  Flame,
  Gauge,
  ListFilter,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { getDashboardData, type WatchRow } from "@/lib/data";
import { buildAllocationSegments, type PortfolioPosition } from "@/lib/dashboard-model";
import { classifyFearGreed, type FearGreedDisplay } from "@/lib/fear-greed";
import { getMemoHref } from "@/lib/static-export";
import { MarketRefreshButton } from "./market-refresh-button";

const tabs = [
  { href: "#home", label: "ホーム", icon: BarChart3 },
  { href: "#positions", label: "保有", icon: CircleDollarSign },
  { href: "#watch", label: "監視", icon: ListFilter },
  { href: "#earnings", label: "決算", icon: CalendarClock },
  { href: "#memos", label: "メモ", icon: BookOpen }
];

export default function DashboardPage() {
  const data = getDashboardData();
  const firstPosition = data.portfolio.positions[0];
  const urgentEarnings = data.earnings.events.filter((event) => event.detected || !event.reflected).slice(0, 5);
  const allocationSegments = buildAllocationSegments(data.portfolio.positions);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ROMANCE ALLOCATION COMMAND</p>
          <h1>ロマン枠 作戦司令室</h1>
        </div>
        <div className="topbar__actions">
          <div className={`topbar__status topbar__status--${data.marketFreshness.level}`}>
            <span>市場データ</span>
            <strong>{data.marketFreshness.label}</strong>
          </div>
          <MarketRefreshButton />
        </div>
      </header>

      <section className={`market-warning market-warning--${data.marketFreshness.level}`} aria-live="polite">
        <div className="market-warning__main">
          <strong>{data.marketFreshness.message}</strong>
          <span>
            最終更新: {formatDateTime(data.marketUpdatedAt)}
            {data.marketErrors.length > 0 ? ` / 取得失敗 ${data.marketErrors.length}銘柄` : ""}
          </span>
        </div>
        <div className="market-warning__side">
          <span>{data.marketSource}</span>
          <MarketRefreshButton />
        </div>
      </section>

      <FearGreedCard fearGreed={data.fearGreed} />

      <section id="home" className="section hero-grid">
        <article className="panel hero-panel">
          <div className="panel__header">
            <span className="section-label">Portfolio</span>
            <span className={valueClass(data.portfolio.totalProfitLoss)}>
              {formatSignedUsd(data.portfolio.totalProfitLoss)} / {formatPercent(data.portfolio.totalProfitLossRate)}
            </span>
          </div>
          <div className="portfolio-visual">
            <AllocationDonut positions={data.portfolio.positions} />
            <div className="portfolio-visual__main">
              <div className="hero-number">{formatUsd(data.portfolio.totalValue)}</div>
              <div className="allocation-stack">
                {data.portfolio.positions.map((position, index) => (
                  <div className="allocation-item" key={`top-${position.ticker}`}>
                    <div className="allocation-item__label">
                      <span>
                        <i style={{ background: chartColors[index % chartColors.length] }} />
                        {position.ticker}
                      </span>
                      <strong>{formatPercent(position.allocation)}</strong>
                    </div>
                    <div className="allocation-track">
                      <span
                        style={{
                          width: `${Math.max(3, position.allocation)}%`,
                          background: chartColors[index % chartColors.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-subgrid">
            <Metric label="投下元本" value={formatUsd(data.portfolio.totalCost)} />
            <Metric
              label="最大保有"
              value={firstPosition ? `${firstPosition.ticker} ${formatPercent(firstPosition.allocation)}` : "-"}
            />
            <Metric label="保有銘柄" value={`${data.portfolio.positions.length}銘柄`} />
          </div>
          <div className="segment-strip" aria-label="保有比率">
            {allocationSegments.map((segment, index) => (
              <span
                key={segment.ticker}
                title={`${segment.ticker} ${formatPercent(segment.allocation)}`}
                style={{
                  width: `${Math.max(3, segment.end - segment.start)}%`,
                  background: chartColors[index % chartColors.length]
                }}
              />
            ))}
          </div>
          <p className="risk-note">
            自動売買ではありません。売買直前は証券会社画面で価格、取扱、注文条件を確認します。
          </p>
        </article>

        <article className="panel">
          <div className="panel__header">
            <span className="section-label">Today</span>
            <AlertTriangle size={16} />
          </div>
          <div className="alert-stack">
            {data.buyAlerts.slice(0, 5).map((row) => (
              <AlertRow key={row.ticker} row={row} />
            ))}
          </div>
        </article>
      </section>

      <section className="section split-grid">
        <article className="panel">
          <div className="panel__header">
            <span className="section-label">Event Monitor</span>
            <span className="muted">{data.earnings.alertCount} alerts</span>
          </div>
          <div className="compact-list">
            {urgentEarnings.map((event) => (
              <div className="compact-list__row" key={`${event.ticker}-${event.expected_date}`}>
                <div>
                  <strong>{event.ticker}</strong>
                  <span>{event.expected_date} {event.expected_time}</span>
                </div>
                <Badge tone={event.detected ? "event" : event.reflected ? "ok" : "wait"}>
                  {event.detected ? "検知" : event.reflected ? "反映済み" : "未反映"}
                </Badge>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <span className="section-label">Data Boundary</span>
            <ShieldCheck size={16} />
          </div>
          <div className="boundary-list">
            <div>
              <span>保有入力</span>
              <strong>positions.local.json</strong>
            </div>
            <div>
              <span>外部ログイン</span>
              <strong>実装なし</strong>
            </div>
            <div>
              <span>価格更新</span>
              <strong>npm run market:update</strong>
            </div>
          </div>
        </article>
      </section>

      <section id="positions" className="section">
        <SectionTitle icon={CircleDollarSign} title="保有ポジション" sub="手入力JSONを評価額と損益へ変換" />
        <div className="position-grid">
          {data.portfolio.positions.map((position, index) => (
            <article className="position-card" key={position.ticker}>
              <div className="position-card__top">
                <div>
                  <span className="ticker">{position.ticker}</span>
                  <p>{position.role}</p>
                </div>
                <Badge tone={position.profitLoss >= 0 ? "ok" : "danger"}>
                  {formatPercent(position.profitLossRate)}
                </Badge>
              </div>
              <div className="position-chart">
                <div
                  className="position-chart__ring"
                  style={{
                    background: `conic-gradient(${chartColors[index % chartColors.length]} 0deg ${Math.max(
                      4,
                      position.allocation * 3.6
                    )}deg, rgba(255,255,255,0.06) ${Math.max(4, position.allocation * 3.6)}deg 360deg)`
                  }}
                >
                  <span>{formatPercent(position.allocation)}</span>
                </div>
                <div>
                  <div className="position-card__value">{formatUsd(position.marketValue)}</div>
                  <div className="pnl-track">
                    <span
                      className={position.profitLoss >= 0 ? "pnl-track__up" : "pnl-track__down"}
                      style={{ width: `${Math.min(100, Math.max(8, Math.abs(position.profitLossRate) * 4))}%` }}
                    />
                  </div>
                  <div className="position-chart__caption">
                    <span>損益</span>
                    <strong className={valueClass(position.profitLoss)}>{formatSignedUsd(position.profitLoss)}</strong>
                  </div>
                </div>
              </div>
              <div className="metric-line">
                <span>株数</span>
                <strong>{position.shares}</strong>
              </div>
              <div className="metric-line">
                <span>取得単価</span>
                <strong>{formatUsd(position.averageCost)}</strong>
              </div>
              <div className="metric-line">
                <span>現在株価</span>
                <strong>{formatNullableUsd(position.price)}</strong>
              </div>
              <div className="metric-line">
                <span>損益</span>
                <strong className={valueClass(position.profitLoss)}>{formatSignedUsd(position.profitLoss)}</strong>
              </div>
              <p className="note-text">{position.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="watch" className="section">
        <SectionTitle icon={Gauge} title="Watch銘柄" sub="RSI、52週位置、山、買い検討サインを横断表示" />
        <div className="watch-table-wrap">
          <table className="watch-table">
            <thead>
              <tr>
                <th>銘柄</th>
                <th>山</th>
                <th>株価</th>
                <th>日次</th>
                <th>RSI14</th>
                <th>52W高値</th>
                <th>52W安値</th>
                <th>時価総額</th>
                <th>サイン</th>
                <th>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {data.watchRows.map((row) => (
                <tr key={row.ticker}>
                  <td>
                    <div className="ticker-cell">
                      <strong>{row.ticker}</strong>
                      {row.memoPath ? (
                        <a href={getMemoHref(row.memoPath)}>memo</a>
                      ) : null}
                      {row.market?.stale ? <span className="stale-pill">STALE</span> : null}
                    </div>
                  </td>
                  <td>{row.hillLabel}</td>
                  <td>{formatNullableUsd(row.market?.price ?? null)}</td>
                  <td className={valueClass(row.market?.changeRate ?? 0)}>{formatPercent(row.market?.changeRate ?? null)}</td>
                  <td>{formatNumber(row.rsi14)}</td>
                  <td>{formatPercent(row.drawdown52pct)}</td>
                  <td>{formatPercent(row.fromLow52pct)}</td>
                  <td>{formatMarketCap(row.market?.marketCapUsdB ?? null)}</td>
                  <td>
                    <Badge tone={toneForSignal(row.signal.level)}>{row.signal.level}</Badge>
                  </td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <SectionTitle icon={Flame} title="買いアラート候補" sub="検討サイン。発注や外部ログインは行わない" />
        <div className="alert-grid">
          {data.buyAlerts.map((row) => (
            <article className="alert-card" key={`alert-${row.ticker}`}>
              <div className="alert-card__top">
                <span className="ticker">{row.ticker}</span>
                <Badge tone={toneForSignal(row.signal.level)}>{row.signal.level}</Badge>
              </div>
              <p>{row.signal.reason}</p>
              <div className="alert-card__stats">
                <span>RSI {formatNumber(row.rsi14)}</span>
                <span>高値比 {formatPercent(row.drawdown52pct)}</span>
                <span>{row.status}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="earnings" className="section">
        <SectionTitle icon={CalendarClock} title="決算監視" sub="スケジュール、検知alert、反映済み/未反映" />
        <div className="earnings-list">
          {data.earnings.events.map((event) => (
            <article className="earnings-row" key={`${event.ticker}-${event.expected_date}`}>
              <div>
                <strong>{event.ticker}</strong>
                <span>{event.name}</span>
              </div>
              <div>
                <strong>{event.expected_date}</strong>
                <span>{event.expected_time || "時刻未設定"}</span>
              </div>
              <div>
                <span>{event.hill}</span>
                <strong>{event.priority}</strong>
              </div>
              <div className="earnings-row__badges">
                <Badge tone={event.detected ? "event" : "wait"}>{event.detected ? "alert検知" : event.monitorSignal}</Badge>
                <Badge tone={event.reflected ? "ok" : "danger"}>{event.reflected ? "反映済み" : "未反映"}</Badge>
                {event.memoPath ? (
                  <a href={getMemoHref(event.memoPath)}>memo</a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="memos" className="section">
        <SectionTitle icon={BookOpen} title="メモリンク" sub="深掘りメモ、比較表、仮説崩れ条件へ移動" />
        <div className="memo-grid">
          {data.memos.map((memo) => (
            <a className="memo-card" href={getMemoHref(memo.path)} key={memo.path}>
              <span>{memo.group}</span>
              <strong>{memo.title}</strong>
              <small>{memo.path}</small>
            </a>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <RefreshCw size={15} />
          <span>価格更新: GitHub Actions またはローカルで `npm run market:update`</span>
        </div>
        <span>GitHub Pages版は公開データを静的ビルドに焼き込み</span>
      </footer>

      <nav className="bottom-tabs" aria-label="主要タブ">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <a href={tab.href} key={tab.href}>
              <Icon size={18} />
              <span>{tab.label}</span>
            </a>
          );
        })}
      </nav>
    </main>
  );
}

const chartColors = ["#7170ff", "#10b981", "#22d3ee", "#f59e0b", "#fb7185"];
const fearGreedSegments = [
  { label: "EXTREME\nFEAR", start: 0, end: 24, className: "fear-gauge__segment--extreme-fear" },
  { label: "FEAR", start: 25, end: 44, className: "fear-gauge__segment--fear" },
  { label: "NEUTRAL", start: 45, end: 55, className: "fear-gauge__segment--neutral" },
  { label: "GREED", start: 56, end: 75, className: "fear-gauge__segment--greed" },
  { label: "EXTREME\nGREED", start: 76, end: 100, className: "fear-gauge__segment--extreme-greed" }
];

function FearGreedCard({ fearGreed }: { fearGreed: FearGreedDisplay }) {
  return (
    <section className="section market-environment" aria-label="市場環境">
      <article className={`panel fear-greed fear-greed--${fearGreed.tone}`}>
        <div className="panel__header fear-greed__header">
          <div>
            <span className="section-label">Market Environment</span>
            <h2>CNN Fear & Greed</h2>
          </div>
          <span className={`freshness-pill freshness-pill--${fearGreed.freshness.level}`}>
            {fearGreed.freshness.label}
          </span>
        </div>
        <div className="fear-greed__layout">
          <div>
            <FearGreedGauge fearGreed={fearGreed} />
            <div className="fear-greed__meta fear-greed__meta--gauge">
              <span>最終更新: {formatDateTime(fearGreed.updatedAt)}</span>
              <a href={fearGreed.sourceUrl}>{fearGreed.source}</a>
            </div>
          </div>
          <div className="fear-greed__side">
            <FearGreedComparisons fearGreed={fearGreed} />
            <p className="fear-greed__guidance">{fearGreed.guidance}</p>
            {fearGreed.error ? <span className="fear-greed__error">取得メモ: {fearGreed.error}</span> : null}
          </div>
        </div>
        {fearGreed.components.length > 0 ? (
          <div className="fear-greed__components" aria-label="構成指標">
            {fearGreed.components.map((component) => (
              <span key={component.name}>
                {component.name}
                <strong>{component.value === null ? "-" : Math.round(component.value)}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function FearGreedGauge({ fearGreed }: { fearGreed: FearGreedDisplay }) {
  const value = fearGreed.value ?? 0;
  const needleAngle = 180 - value * 1.8;
  const needleEnd = polarPoint(260, 246, 184, needleAngle);
  return (
    <div className="fear-gauge" aria-label={`Fear and Greed score ${fearGreed.value ?? "unknown"} of 100`}>
      <svg viewBox="0 0 520 300" role="img">
        <title>CNN Fear and Greed semicircle gauge</title>
        {fearGreedSegments.map((segment) => (
          <g key={segment.label}>
            <path
              className={`fear-gauge__segment ${segment.className}`}
              d={describeArc(260, 246, 210, 180 - segment.start * 1.8, 180 - segment.end * 1.8)}
            />
            <text
              className="fear-gauge__label"
              x={polarPoint(260, 246, 208, 180 - ((segment.start + segment.end) / 2) * 1.8).x}
              y={polarPoint(260, 246, 208, 180 - ((segment.start + segment.end) / 2) * 1.8).y}
              textAnchor="middle"
            >
              {segment.label.split("\n").map((line, index) => (
                <tspan key={line} x={polarPoint(260, 246, 208, 180 - ((segment.start + segment.end) / 2) * 1.8).x} dy={index === 0 ? 0 : 28}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((tick) => {
          const point = polarPoint(260, 246, 144, 180 - tick * 1.8);
          return (
            <text className="fear-gauge__tick" key={tick} x={point.x} y={point.y} textAnchor="middle">
              {tick}
            </text>
          );
        })}
        <line className="fear-gauge__needle" x1="260" y1="246" x2={needleEnd.x} y2={needleEnd.y} />
        <circle className="fear-gauge__hub" cx="260" cy="246" r="70" />
        <text className="fear-gauge__value" x="260" y="246" textAnchor="middle">
          {fearGreed.value === null ? "--" : Math.round(fearGreed.value)}
        </text>
      </svg>
    </div>
  );
}

function FearGreedComparisons({ fearGreed }: { fearGreed: FearGreedDisplay }) {
  const rows = [
    { label: "Previous close", delta: fearGreed.deltas.previousClose },
    { label: "1 week ago", delta: fearGreed.deltas.previousWeek },
    { label: "1 month ago", delta: fearGreed.deltas.previousMonth }
  ];
  return (
    <div className="fear-greed__comparisons" aria-label="Fear and Greed comparisons">
      {rows.map((row) => {
        const score = previousFearGreedScore(fearGreed.value, row.delta);
        return (
          <div className="fear-greed__comparison" key={row.label}>
            <div>
              <span>{row.label}</span>
              <strong>{score === null ? "-" : classifyFearGreed(score)}</strong>
            </div>
            <div className="fear-greed__comparison-score">
              <span>{score === null ? "--" : Math.round(score)}</span>
              <small>{formatSignedPoint(row.delta)}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AllocationDonut({ positions }: { positions: PortfolioPosition[] }) {
  let cursor = 0;
  const slices = positions.map((position, index) => {
    const start = cursor;
    const end = cursor + position.allocation * 3.6;
    cursor = end;
    return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
  });
  const background = positions.length > 0 ? `conic-gradient(${slices.join(", ")})` : "rgba(255,255,255,0.06)";
  return (
    <div className="allocation-donut" style={{ background }} aria-label="保有比率チャート">
      <div>
        <span>Allocation</span>
        <strong>{positions.length}</strong>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  sub
}: {
  icon: typeof BarChart3;
  title: string;
  sub: string;
}) {
  return (
    <div className="section-title">
      <Icon size={18} />
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AlertRow({ row }: { row: WatchRow }) {
  const Icon = row.signal.level === "BUY WATCH" ? TrendingDown : row.signal.level === "HOT" ? TrendingUp : AlertTriangle;
  return (
    <div className="alert-row">
      <Icon size={16} />
      <div>
        <strong>{row.ticker}</strong>
        <span>{row.signal.reason}</span>
      </div>
      <Badge tone={toneForSignal(row.signal.level)}>{row.signal.level}</Badge>
    </div>
  );
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "ok" | "wait" | "danger" | "event" | "hot" | "buy";
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function toneForSignal(level: string): "ok" | "wait" | "danger" | "event" | "hot" | "buy" {
  if (level === "BUY WATCH") return "buy";
  if (level === "HOT") return "hot";
  if (level === "EVENT") return "event";
  if (level === "BROKEN?") return "danger";
  return "wait";
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 1000 ? 0 : 2
  }).format(value);
}

function formatNullableUsd(value: number | null): string {
  return typeof value === "number" ? formatUsd(value) : "-";
}

function formatSignedUsd(value: number): string {
  const formatted = formatUsd(Math.abs(value));
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSignedPoint(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function formatMarketCap(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}T`;
  return `$${value.toFixed(1)}B`;
}

function formatDateTime(value: string): string {
  if (!value) return "未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function valueClass(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "value-neutral";
  return value > 0 ? "value-up" : "value-down";
}

function previousFearGreedScore(current: number | null, delta: number | null): number | null {
  if (typeof current !== "number" || typeof delta !== "number") return null;
  return Math.max(0, Math.min(100, current - delta));
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((cx + radius * Math.cos(radians)).toFixed(2)),
    y: Number((cy - radius * Math.sin(radians)).toFixed(2))
  };
}
