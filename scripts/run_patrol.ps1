# 毎朝の相場観巡回（Task Scheduler から呼ばれる）
# ask-anything-local-01/harness/tools/run_weekly.ps1 と同じ骨格:
#   op run --env-file → python → SMTP 送信。秘密は 1Password から注入し、ファイルには置かない。
$ErrorActionPreference = "Stop"

$Root = "C:\Users\c6341\Documents\Projects\invenstment"
$LogDir = Join-Path $Root "claude_logs\patrol"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogPath = Join-Path $LogDir "run_patrol.stderr.log"

# GMAIL_APP_PASSWORD の参照は ClaudeHarnessWeekly と同じ env ファイルを共用する（秘密の正は1箇所）
$EnvFile = "C:\Users\c6341\Documents\Projects\ask-anything-local-01\harness\tools\harness_secrets.env"

Set-Location -LiteralPath $Root

$StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$StartInfo.FileName = "C:\Users\c6341\AppData\Local\Programs\op\op.exe"
$StartInfo.Arguments = "run --env-file=`"$EnvFile`" -- python scripts\patrol_daily.py $args"
$StartInfo.WorkingDirectory = $Root
$StartInfo.UseShellExecute = $false
$StartInfo.RedirectStandardError = $true

$Process = [System.Diagnostics.Process]::Start($StartInfo)
$StdErr = $Process.StandardError.ReadToEnd()
$Process.WaitForExit()

if ($StdErr) {
    Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] " + $StdErr.TrimEnd())
}

exit $Process.ExitCode
