# 相場観レポート（定期巡回）を Windows Task Scheduler に登録する。平日 JST 7:00。
# 実行: powershell -ExecutionPolicy Bypass -File scripts\setup_task_scheduler.ps1
$ErrorActionPreference = "Stop"

$TaskName = "InvestmentMorningPatrol"
$RunScript = "C:\Users\c6341\Documents\Projects\invenstment\scripts\run_patrol.ps1"
$User = (whoami)

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 07:00
$Action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$RunScript`""
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 40)
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Principal $Principal `
    -Description "相場観レポート（定期巡回）。平日 JST 7:00 にローカル Claude Code を固定セッションで起動する（Remote Control 経由でスマホから開ける）。"

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "TaskName: $TaskName"
Write-Host "NextRunTime: $($Info.NextRunTime)"
