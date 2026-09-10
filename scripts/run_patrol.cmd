@echo off
rem Morning patrol launcher. Task Scheduler runs this as: cmd.exe /k "<this file>" [safety]
rem
rem Why a .cmd and not PowerShell Start-Process: a claude session started through
rem PowerShell Start-Process never persisted its transcript, so --resume could not
rem find it the next morning. Started as a direct child of the console cmd, it does.
rem
rem Two modes (2026-09-10):
rem   (no arg) 07:00 - if the fixed session's window is already open, DO NOTHING.
rem                    That window owns the patrol via its own in-session cron job,
rem                    so the report lands in the live conversation and the window
rem                    is never killed out from under the user.
rem   safety   07:25 - only acts if today's patrol never ran (latest_prices.json is
rem                    not from today). Then it takes over, killing a stale window
rem                    if one is in the way. This is what makes losing the in-session
rem                    cron (window closed, reboot, 7-day expiry) cost nothing.
rem
rem Batch gotchas that bit us (do not "simplify" these back):
rem   - No pipes inside for /f '...': ^| is passed through literally. Use .Where({}).
rem   - %date% is "2026/09/10 (木)". Its ) closes an if(...) block early, so every
rem     echo of %date% must sit outside parentheses. Hence the gotos.

set ROOT=C:\Users\c6341\Documents\Projects\invenstment
set SID=36358243-ef8c-4c8b-ba08-30112934c274
set CLAUDE=C:\Users\c6341\AppData\Roaming\npm\claude.cmd
set LOGDIR=%ROOT%\claude_logs\patrol
set PROJ=%USERPROFILE%\.claude\projects\C--Users-c6341-Documents-Projects-invenstment
set MODE=%1

cd /d "%ROOT%"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
git pull --ff-only -q >nul 2>&1

set ALIVE=0
for /f %%A in ('powershell -NoProfile -Command "if (@(Get-CimInstance Win32_Process).Where({ $_.Name -like 'claude*' -and $_.CommandLine -like '*%SID%*' }).Count -gt 0) { 1 } else { 0 }"') do set ALIVE=%%A

if "%MODE%"=="safety" goto safety
if "%ALIVE%"=="1" goto skipalive
goto launch

:skipalive
echo [%date% %time%] skip: window alive, its in-session cron owns the patrol>> "%LOGDIR%\run_patrol.log"
exit /b 0

:safety
set FRESH=0
for /f %%A in ('powershell -NoProfile -Command "if ((Get-Item '%ROOT%\watchlist\latest_prices.json').LastWriteTime.Date -eq (Get-Date).Date) { 1 } else { 0 }"') do set FRESH=%%A
if "%FRESH%"=="1" goto skipfresh
echo [%date% %time%] SAFETY: patrol did not run today, taking over>> "%LOGDIR%\run_patrol.log"
if "%ALIVE%"=="1" powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'claude*' -and $_.CommandLine -like '*%SID%*' } | ForEach-Object { taskkill /PID $_.ParentProcessId /T /F 2>$null | Out-Null }"
goto launch

:skipfresh
echo [%date% %time%] skip: patrol already ran today>> "%LOGDIR%\run_patrol.log"
exit /b 0

:launch
if exist "%PROJ%\%SID%.jsonl" (
  set SESS=--resume %SID%
) else if exist "%PROJ%\%SID%\" (
  set SESS=--resume %SID%
) else (
  set SESS=--session-id %SID%
)

echo [%date% %time%] start %SESS% mode=%MODE%>> "%LOGDIR%\run_patrol.log"
call "%CLAUDE%" %SESS% --dangerously-skip-permissions "Morning patrol. Open watchlist/trigger_prompt_v1.md and execute exactly the instructions between the two --- lines. Write the report in Japanese in this session."
