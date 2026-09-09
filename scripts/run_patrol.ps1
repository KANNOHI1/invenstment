# 毎朝の相場観巡回（Task Scheduler から呼ばれる）
# 対話モードの claude を固定セッションで起動する。remoteControlAtStartup=true により
# セッションは Remote Control に自動で載り、claude.ai/code とスマホアプリから開いて返信できる。
# 毎朝同じセッションに追記する（初回は --session-id、2回目以降は --resume）。
$ErrorActionPreference = "Stop"

$Root = "C:\Users\c6341\Documents\Projects\invenstment"
$SessionId = "36358243-ef8c-4c8b-ba08-30112934c274"
$Claude = "C:\Users\c6341\AppData\Roaming\npm\claude.cmd"
$LogDir = Join-Path $Root "claude_logs\patrol"
$PidFile = Join-Path $LogDir "patrol.pid"
$RunLog = Join-Path $LogDir "run_patrol.log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Set-Location -LiteralPath $Root
git pull --ff-only -q 2>&1 | Out-Null

# 前回起動したウィンドウが残っていれば閉じる（同じセッションを二重に開かない）
if (Test-Path $PidFile) {
    $old = Get-Content -LiteralPath $PidFile | Select-Object -First 1
    if ($old -match '^\d+$') { cmd /c "taskkill /PID $old /T /F >nul 2>&1" }
    Remove-Item -LiteralPath $PidFile -Force
}

# 対話セッションはフラット .jsonl ではなくディレクトリで保存される。
# どちらか一方でも既存なら「作成済み」とみなして --resume（同じ会話に追記）する。
$ProjDir = Join-Path $env:USERPROFILE ".claude\projects\C--Users-c6341-Documents-Projects-invenstment"
$Jsonl = Join-Path $ProjDir "$SessionId.jsonl"
$SessDir = Join-Path $ProjDir $SessionId
if ((Test-Path $Jsonl) -or (Test-Path $SessDir)) { $SessArg = "--resume $SessionId" } else { $SessArg = "--session-id $SessionId" }

# 指示の正は watchlist/trigger_prompt_v1.md（ASCII だけで渡し、文字化けを避ける）
$Prompt = "Morning patrol. Open watchlist/trigger_prompt_v1.md and execute exactly the instructions between the two --- lines. Write the report in Japanese in this session."

$CmdLine = "/k cd /d `"$Root`" && `"$Claude`" $SessArg --dangerously-skip-permissions `"$Prompt`""
$Proc = Start-Process -FilePath "cmd.exe" -ArgumentList $CmdLine -WorkingDirectory $Root -PassThru
Set-Content -LiteralPath $PidFile -Value $Proc.Id -Encoding ASCII
Add-Content -LiteralPath $RunLog -Encoding UTF8 -Value ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] started pid=" + $Proc.Id + " " + $SessArg)
