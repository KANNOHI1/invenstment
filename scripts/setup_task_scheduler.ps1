# Register the morning patrol in Windows Task Scheduler (weekdays 07:00 JST).
# Run: powershell -ExecutionPolicy Bypass -File scripts\setup_task_scheduler.ps1
# The action runs cmd.exe /k "scripts\run_patrol.cmd" directly. Launching claude through
# PowerShell Start-Process left no transcript on disk, so --resume could not find the
# session the next morning. As a direct child of the console it persists.
# No ExecutionTimeLimit: the interactive session must stay open all day for replies.
# (ASCII only: PowerShell 5.1 misparses UTF-8 without BOM when comments contain Japanese.)
$ErrorActionPreference = "Stop"

$TaskName = "InvestmentMorningPatrol"
$Root = "C:\Users\c6341\Documents\Projects\invenstment"
$RunScript = Join-Path $Root "scripts\run_patrol.cmd"
$User = (whoami)

$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($ExistingTask) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 07:00
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/k `"$RunScript`"" -WorkingDirectory $Root
# MultipleInstances Parallel: yesterday's window is still open at 07:00 (the session stays alive for
# replies), and the default IgnoreNew would silently skip the new run. run_patrol.cmd closes the old window itself.
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances Parallel
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Principal $Principal `
    -Description "Morning market patrol. Weekdays 07:00 JST: starts local Claude Code in a fixed session (reachable from the phone via Remote Control)." | Out-Null

$Info = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host "TaskName: $TaskName"
Write-Host "NextRunTime: $($Info.NextRunTime)"
