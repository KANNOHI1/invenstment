"""毎朝の相場観巡回: Claude Code セッションを起動し、レポートを Gmail で届ける。

骨格は ask-anything-local-01/harness/tools/harness_weekly.py と同じ
（Task Scheduler → run_patrol.ps1 → op run → 本スクリプト → SMTP 送信）。
違いは「Python で集計する」代わりに「claude -p にツール付きセッションを立てさせる」こと。
"""

from __future__ import annotations

import os
import smtplib
import subprocess
import sys
from datetime import date, datetime
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPT_FILE = ROOT / "watchlist" / "trigger_prompt_v1.md"
LOG_DIR = ROOT / "claude_logs" / "patrol"
DELIVERY_LOG = LOG_DIR / "patrol_delivery.log"
CLAUDE = Path.home() / "AppData" / "Roaming" / "npm" / "claude.cmd"

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
MAIL_FROM = "c63410@gmail.com"
MAIL_TO = "c63410@gmail.com"
TIMEOUT_SEC = 40 * 60


def timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def emit(line: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with DELIVERY_LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    print(line)


def load_prompt() -> str:
    """trigger_prompt_v1.md の区切り線（---）の間だけを指示文として使う。"""
    lines = PROMPT_FILE.read_text(encoding="utf-8").splitlines()
    marks = [i for i, l in enumerate(lines) if l.strip() == "---"]
    if len(marks) < 2:
        raise RuntimeError(f"trigger_prompt_v1.md に区切り線が2本ない: {marks}")
    return "\n".join(lines[marks[0] + 1 : marks[1]]).strip()


# このプロセスは `op run --env-file=...` 経由で起動されるため、環境変数に
# Gmail のアプリパスワードが入っている。一方 claude -p は bypassPermissions で
# 無人実行され、巡回の手順3で調査エージェントが外部のウェブページを読む。
# 環境をそのまま継承させると「読んだページに書かれた指示」で認証情報を
# 持ち出せる経路ができるため、子プロセスには秘密を渡さない。
SECRET_ENV_KEYS = ("GMAIL_APP_PASSWORD",)


def child_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in SECRET_ENV_KEYS:
        env.pop(key, None)
    return env


def run_claude(prompt: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            str(CLAUDE),
            "-p",
            "--permission-mode",
            "bypassPermissions",
            "--output-format",
            "text",
        ],
        cwd=ROOT,
        env=child_env(),
        input=prompt,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=TIMEOUT_SEC,
        check=False,
    )


def send_report(report_text: str, app_password: str, subject_tag: str) -> None:
    message = MIMEText(report_text, "plain", "utf-8")
    message["From"] = MAIL_FROM
    message["To"] = MAIL_TO
    message["Subject"] = f"[invenstment] 相場観レポート{subject_tag} - {date.today().isoformat()}"
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=60) as smtp:
        smtp.starttls()
        smtp.login(MAIL_FROM, app_password.strip())
        smtp.sendmail(MAIL_FROM, [MAIL_TO], message.as_string())


def main() -> int:
    no_send = "--no-send" in sys.argv[1:]
    app_password = os.environ.get("GMAIL_APP_PASSWORD")
    if not app_password and not no_send:
        emit(f"{timestamp()} FAIL missing_env=GMAIL_APP_PASSWORD (run via 'op run --env-file=...')")
        return 2

    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    out_path = LOG_DIR / f"patrol_{stamp}.md"

    subprocess.run(["git", "pull", "--ff-only", "-q"], cwd=ROOT, check=False)

    try:
        prompt = load_prompt()
        result = run_claude(prompt)
    except subprocess.TimeoutExpired:
        emit(f"{timestamp()} FAIL claude_timeout={TIMEOUT_SEC}s")
        return 4
    except Exception as exc:  # noqa: BLE001
        emit(f"{timestamp()} FAIL claude_start={exc.__class__.__name__} {exc}")
        return 4

    report = result.stdout.strip()
    out_path.write_text(report + "\n", encoding="utf-8")
    if result.stderr.strip():
        (LOG_DIR / f"patrol_{stamp}.err.log").write_text(result.stderr, encoding="utf-8")

    tag = "" if result.returncode == 0 and report else "（異常終了）"
    if not report:
        report = f"claude -p が出力を返さなかった。exit={result.returncode}\n\n{result.stderr[-3000:]}"

    if no_send:
        emit(f"{timestamp()} OK no_send exit={result.returncode} size={len(report)} file={out_path.name}")
        return 0 if result.returncode == 0 else 5

    try:
        send_report(report, app_password, tag)
    except (smtplib.SMTPException, OSError) as exc:
        emit(f"{timestamp()} FAIL smtp_error={exc.__class__.__name__} file={out_path.name}")
        return 6

    emit(f"{timestamp()} OK sent exit={result.returncode} size={len(report)} file={out_path.name}")
    return 0 if result.returncode == 0 else 5


if __name__ == "__main__":
    sys.exit(main())
