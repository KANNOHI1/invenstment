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
import Link from "next/link";
import { getDashboardData, type WatchRow } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ROMANCE ALLOCATION COMMAND</p>
          <h1>ロマン枠 作戦司令室</h1>
        </div>
        <div className="topbar__status">
          <span>市場データ</span>
          <strong>{formatDateTime(data.marketUpdatedAt)}</strong>
        </div>
      </header>

      <section id="home" className="section hero-grid">
        <article className="panel hero-panel">
          <div className="panel__header">
            <span className="section-label">Portfolio</span>
            <span className={valueClass(data.portfolio.totalProfitLoss)}>
              {formatSignedUsd(data.portfolio.totalProfitLoss)} / {formatPercent(data.portfolio.totalProfitLossRate)}
            </span>
          </div>
          <div className="hero-number">{formatUsd(data.portfolio.totalValue)}</div>
          <div className="hero-subgrid">
            <Metric label="投下元本" value={formatUsd(data.portfolio.totalCost)} />
            <Metric
              label="最大保有"
              value={firstPosition ? `${firstPosition.ticker} ${formatPercent(firstPosition.allocation)}` : "-"}
            />
            <Metric label="保有銘柄" value={`${data.portfolio.positions.length}銘柄`} />
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
          {data.portfolio.positions.map((position) => (
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
              <div className="position-card__value">{formatUsd(position.marketValue)}</div>
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
              <div className="allocation-bar">
                <span style={{ width: `${Math.max(4, position.allocation)}%` }} />
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
                        <Link href={`/memo?path=${encodeURIComponent(row.memoPath)}`}>memo</Link>
                      ) : null}
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
                  <Link href={`/memo?path=${encodeURIComponent(event.memoPath)}`}>memo</Link>
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
            <Link className="memo-card" href={`/memo?path=${encodeURIComponent(memo.path)}`} key={memo.path}>
              <span>{memo.group}</span>
              <strong>{memo.title}</strong>
              <small>{memo.path}</small>
            </Link>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <RefreshCw size={15} />
          <span>価格更新: dashboardで `npm run market:update`</span>
        </div>
        <span>positions.local.json と market.local.json はgitignore対象</span>
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
