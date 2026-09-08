# 毎朝の相場観巡回をローカルで起動する（Task Scheduler から呼ばれる）
# 他プロジェクト（ask-anything-local-01/harness/tools/run_weekly.ps1）と同じ方式
$ErrorActionPreference = "Stop"

$Root = "C:\Users\c6341\Documents\Projects\invenstment"
$Stamp = Get-Date -Format "yyyyMMdd_HHmm"
$LogDir = Join-Path $Root "claude_logs\patrol"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$OutPath = Join-Path $LogDir "patrol_$Stamp.md"
$ErrPath = Join-Path $LogDir "patrol_$Stamp.err.log"

Set-Location -LiteralPath $Root
git pull --ff-only 2>&1 | Out-Null

# 区切り線（---）の間だけを指示文として渡す
$Lines = Get-Content -LiteralPath (Join-Path $Root "watchlist\trigger_prompt_v1.md") -Encoding UTF8
$Idx = @(0..($Lines.Count - 1) | Where-Object { $Lines[$_] -eq "---" })
$Prompt = ($Lines[($Idx[0] + 1)..($Idx[1] - 1)] -join "`n")

$Claude = "C:\Users\c6341\AppData\Roaming\npm\claude.cmd"
$StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$StartInfo.FileName = $Claude
$StartInfo.Arguments = "-p --permission-mode bypassPermissions --output-format text"
$StartInfo.WorkingDirectory = $Root
$StartInfo.UseShellExecute = $false
$StartInfo.RedirectStandardInput = $true
$StartInfo.RedirectStandardOutput = $true
$StartInfo.RedirectStandardError = $true
$StartInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$StartInfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8

$Process = [System.Diagnostics.Process]::Start($StartInfo)
$Process.StandardInput.Write($Prompt)
$Process.StandardInput.Close()
$StdOut = $Process.StandardOutput.ReadToEnd()
$StdErr = $Process.StandardError.ReadToEnd()
$Process.WaitForExit()

[System.IO.File]::WriteAllText($OutPath, $StdOut, [System.Text.UTF8Encoding]::new($false))
if ($StdErr) { [System.IO.File]::WriteAllText($ErrPath, $StdErr, [System.Text.UTF8Encoding]::new($false)) }

exit $Process.ExitCode
