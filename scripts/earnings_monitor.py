#!/usr/bin/env python3
"""Poll configured earnings/event sources and write a local status file.

This script is intentionally dependency-free so it can run in GitHub Actions.
It is an alerting aid, not a replacement for reading the official release.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request


RESULT_KEYWORDS = (
    "financial results",
    "earnings",
    "quarterly results",
    "reports first quarter",
    "reports second quarter",
    "reports third quarter",
    "reports fourth quarter",
    "決算",
)

EVENT_KEYWORDS = (
    "investor day",
    "presentation",
    "webcast",
    "イベント",
)


def read_json(path: pathlib.Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: pathlib.Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_url(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 earnings-monitor/1.0 local-research",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    return raw.decode("utf-8", errors="replace")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value).strip("_") or "source"


def in_window(expected_date: str, today: dt.date, lookback: int, lookahead: int) -> bool:
    expected = dt.date.fromisoformat(expected_date)
    delta = (expected - today).days
    return -lookback <= delta <= lookahead


def has_result_keyword(content: str) -> bool:
    lower = content.lower()
    return any(keyword in lower for keyword in RESULT_KEYWORDS)


def has_event_keyword(content: str) -> bool:
    lower = content.lower()
    return any(keyword in lower for keyword in EVENT_KEYWORDS)


def write_status(path: pathlib.Path, rows: list[dict], alerts: list[dict], now: dt.datetime) -> None:
    lines: list[str] = []
    lines.append("# 決算/イベント自動監視ステータス")
    lines.append("")
    lines.append(f"- 最終確認: {now.isoformat(timespec='seconds')}")
    lines.append("- 監視方式: GitHub Actionsまたはローカル実行で、予定日周辺の公式IR/ニュース/イベントページを巡回")
    lines.append("- 注意: 自動検出は一次確認の補助。最終判断は公式リリース本文を読んで反映する")
    lines.append("")
    lines.append("## 監視対象")
    lines.append("")
    lines.append("| 銘柄 | 種別 | 予定日 | 時刻 | 優先度 | 山 | 状態 | シグナル | 詳細 |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for row in rows:
        values = [
            row["ticker"],
            row.get("kind", "earnings"),
            row["expected_date"],
            row.get("expected_time", ""),
            row.get("priority", ""),
            row.get("hill", ""),
            row["status"],
            row["signal"],
            row["detail"],
        ]
        escaped = [html.escape(str(value)).replace("|", "\\|") for value in values]
        lines.append("| " + " | ".join(escaped) + " |")
    lines.append("")
    lines.append("## 検出ログ")
    lines.append("")
    if not alerts:
        lines.append("- 今回の巡回で新規アラートなし")
    else:
        for alert in alerts:
            lines.append(
                f"- {alert['timestamp']} `{alert['ticker']}` {alert['label']}: {alert['message']}"
            )
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def run(args: argparse.Namespace) -> int:
    root = pathlib.Path.cwd()
    config_path = root / args.config
    output_dir = root / args.output_dir
    raw_dir = output_dir / "raw"
    state_path = output_dir / "earnings_monitor_state.json"
    status_path = output_dir / "earnings_monitor_status.md"
    alerts_path = output_dir / "earnings_monitor_alerts.json"

    config = read_json(config_path)
    if "events" not in config:
        raise SystemExit(f"Config has no events: {config_path}")

    now = dt.datetime.now().astimezone()
    today = now.date()
    state = read_json(state_path)
    previous_sources = state.get("sources", {})
    new_state: dict = {"updated_at": now.isoformat(), "sources": {}}
    rows: list[dict] = []
    alerts: list[dict] = []
    raw_today = raw_dir / today.strftime("%Y%m%d")
    raw_today.mkdir(parents=True, exist_ok=True)

    for event in config["events"]:
        if not in_window(event["expected_date"], today, args.lookback_days, args.lookahead_days):
            rows.append(
                {
                    "ticker": event["ticker"],
                    "kind": event.get("kind", "earnings"),
                    "expected_date": event["expected_date"],
                    "expected_time": event.get("expected_time", ""),
                    "priority": event.get("priority", ""),
                    "hill": event.get("hill", ""),
                    "status": "skip",
                    "signal": "outside_window",
                    "detail": "巡回対象期間外",
                }
            )
            continue

        signals: list[str] = []
        details: list[str] = []
        for source in event.get("sources", []):
            key = f"{event['ticker']}|{source['label']}|{source['url']}"
            try:
                content = fetch_url(source["url"], timeout=args.timeout)
                digest = sha256_text(content)
                previous = previous_sources.get(key, {})
                changed = previous.get("hash") != digest

                if changed:
                    filename = (
                        f"{safe_name(event['ticker'])}_{safe_name(source['label'])}_{digest[:12]}.html"
                    )
                    raw_path = raw_today / filename
                    signals.append("changed")
                    details.append(f"{source['label']} updated")
                    if args.save_raw:
                        raw_path.write_text(content, encoding="utf-8")
                        message = f"ページ変化を検出。raw: {raw_path}"
                    else:
                        message = f"ページ変化を検出。source: {source['url']}"
                    alerts.append(
                        {
                            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                            "ticker": event["ticker"],
                            "kind": event.get("kind", "earnings"),
                            "expected_date": event["expected_date"],
                            "expected_time": event.get("expected_time", ""),
                            "priority": event.get("priority", ""),
                            "hill": event.get("hill", ""),
                            "signal": "changed",
                            "label": source["label"],
                            "source_url": source["url"],
                            "message": message,
                        }
                    )

                expected = dt.date.fromisoformat(event["expected_date"])
                kind = event.get("kind", "earnings")
                if kind == "earnings":
                    keyword_signal = "results_keyword"
                    keyword_detail = "results keyword"
                    keyword_message = "決算関連キーワードを検出"
                    keyword_found = has_result_keyword(content)
                else:
                    keyword_signal = "event_keyword"
                    keyword_detail = "event keyword"
                    keyword_message = "イベント関連キーワードを検出"
                    keyword_found = has_event_keyword(content)

                if expected <= today and keyword_found:
                    signals.append(keyword_signal)
                    details.append(f"{source['label']} has {keyword_detail}")
                    alerts.append(
                        {
                            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
                            "ticker": event["ticker"],
                            "kind": event.get("kind", "earnings"),
                            "expected_date": event["expected_date"],
                            "expected_time": event.get("expected_time", ""),
                            "priority": event.get("priority", ""),
                            "hill": event.get("hill", ""),
                            "signal": keyword_signal,
                            "label": source["label"],
                            "source_url": source["url"],
                            "message": f"{keyword_message}。source: {source['url']}",
                        }
                    )

                new_state["sources"][key] = {
                    "hash": digest,
                    "last_checked_at": now.isoformat(),
                    "last_success_at": now.isoformat(),
                    "url": source["url"],
                }
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                signals.append("fetch_error")
                details.append(f"{source['label']}: {exc}")
                new_state["sources"][key] = {
                    "hash": previous_sources.get(key, {}).get("hash", ""),
                    "last_checked_at": now.isoformat(),
                    "last_error": str(exc),
                    "url": source["url"],
                }

        rows.append(
            {
                "ticker": event["ticker"],
                "kind": event.get("kind", "earnings"),
                "expected_date": event["expected_date"],
                "expected_time": event.get("expected_time", ""),
                "priority": event.get("priority", ""),
                "hill": event.get("hill", ""),
                "status": "checked",
                "signal": ", ".join(sorted(set(signals))) if signals else "no_change",
                "detail": "; ".join(dict.fromkeys(details)) if details else "変化なし",
            }
        )

    write_json(state_path, new_state)
    write_json(alerts_path, {"updated_at": now.isoformat(), "alerts": alerts})
    write_status(status_path, rows, alerts, now)
    print(f"Wrote {status_path}")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="watchlist/earnings_monitor_schedule_2026-05-11.json")
    parser.add_argument("--output-dir", default="research/00_earnings_monitor")
    parser.add_argument("--lookback-days", type=int, default=1)
    parser.add_argument("--lookahead-days", type=int, default=20)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--save-raw", action="store_true", help="Save changed source HTML under output-dir/raw")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(run(parse_args(sys.argv[1:])))
