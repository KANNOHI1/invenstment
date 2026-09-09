@echo off
rem Morning patrol launcher. Task Scheduler runs this directly as: cmd.exe /k "<this file>"
rem Why a .cmd and not PowerShell Start-Process: a claude session started through
rem PowerShell Start-Process never persisted its transcript, so --resume could not
rem find it the next morning. Started as a direct child of the console cmd, it does.
rem Same session every morning: first run uses --session-id, later runs --resume.

set ROOT=C:\Users\c6341\Documents\Projects\invenstment
set SID=36358243-ef8c-4c8b-ba08-30112934c274
set CLAUDE=C:\Users\c6341\AppData\Roaming\npm\claude.cmd
set LOGDIR=%ROOT%\claude_logs\patrol
set PROJ=%USERPROFILE%\.claude\projects\C--Users-c6341-Documents-Projects-invenstment

cd /d "%ROOT%"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
git pull --ff-only -q >nul 2>&1

rem Close yesterday's window if it is still open (it holds the same session).
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*%SID%*' -and $_.Name -like 'claude*' } | ForEach-Object { taskkill /PID $_.ParentProcessId /T /F 2>$null | Out-Null }"

if exist "%PROJ%\%SID%.jsonl" (
  set SESS=--resume %SID%
) else if exist "%PROJ%\%SID%\" (
  set SESS=--resume %SID%
) else (
  set SESS=--session-id %SID%
)

echo [%date% %time%] start %SESS%>> "%LOGDIR%\run_patrol.log"
call "%CLAUDE%" %SESS% --dangerously-skip-permissions "Morning patrol. Open watchlist/trigger_prompt_v1.md and execute exactly the instructions between the two --- lines. Write the report in Japanese in this session."
