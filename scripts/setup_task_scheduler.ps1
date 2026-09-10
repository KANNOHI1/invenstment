# Register the morning patrol in Windows Task Scheduler (Mon-Sat, JST).
# Run: powershell -ExecutionPolicy Bypass -File scripts\setup_task_scheduler.ps1
# Re-running this reproduces the current live state from scratch (both tasks).
#
# Two tasks, both firing Mon-Sat (Sat reviews the US Friday session, which closes
# Sat JST early morning; Sun has no US session so it is skipped):
#   InvestmentMorningPatrol       07:00  primary. run_patrol.cmd does NOTHING if the
#                                        fixed-session window is already open (its
#                                        in-session cron owns the patrol). No window kill.
#   InvestmentMorningPatrolSafety 07:25  fallback. Passes "safety" to run_patrol.cmd,
#                                        which acts only if latest_prices.json is not
#                                        from today (window closed / rebooted / cron lapsed).
# The action runs cmd.exe /k "run_patrol.cmd" directly. Launching claude through
# PowerShell Start-Process left no transcript on disk, so --resume could not find the
# session the next morning. As a direct child of the console it persists.
# No ExecutionTimeLimit: the interactive session must stay open all day for replies.
# (ASCII only: PowerShell 5.1 misparses UTF-8 without BOM when comments contain Japanese.)
$ErrorActionPreference = "Stop"

$Root = "C:\Users\c6341\Documents\Projects\invenstment"
$RunScript = Join-Path $Root "scripts\run_patrol.cmd"
$User = (whoami)
$Days = "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
# MultipleInstances Parallel: yesterday's window may still be open at fire time; the
# default IgnoreNew would silently skip the new run. run_patrol.cmd decides what to do.
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances Parallel

function Register-PatrolTask($Name, $At, $Arg, $Desc) {
    $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($existing) { Unregister-ScheduledTask -TaskName $Name -Confirm:$false }
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Days -At $At
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $Arg -WorkingDirectory $Root
    Register-ScheduledTask -TaskName $Name -Trigger $trigger -Action $action -Settings $Settings -Principal $Principal -Description $Desc | Out-Null
    $info = Get-ScheduledTaskInfo -TaskName $Name
    Write-Host "$Name  NextRunTime: $($info.NextRunTime)"
}

Register-PatrolTask "InvestmentMorningPatrol" "07:00" "/k `"$RunScript`"" `
    "Morning market patrol (primary). Mon-Sat 07:00 JST. Skips if the fixed-session window is already open; its in-session cron owns the patrol."
Register-PatrolTask "InvestmentMorningPatrolSafety" "07:25" "/k `"$RunScript`" safety" `
    "Morning market patrol (fallback). Mon-Sat 07:25 JST. Runs only if today's patrol has not happened yet."
