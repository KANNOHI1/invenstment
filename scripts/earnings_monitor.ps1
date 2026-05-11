param(
    [string]$ConfigPath = "watchlist\earnings_monitor_schedule_2026-05-11.json",
    [string]$OutputDir = "research\00_earnings_monitor",
    [int]$LookbackDays = 1,
    [int]$LookaheadDays = 7,
    [int]$IntervalMinutes = 30,
    [switch]$Once
)

$ErrorActionPreference = "Stop"

function Get-TextHash {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $hashBytes = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return $null
    }
    $raw = Get-Content -Raw -Encoding UTF8 $Path
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }
    return $raw | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [string]$Path,
        [object]$Value
    )
    $json = $Value | ConvertTo-Json -Depth 20
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Fetch-Url {
    param([string]$Url)
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($null -ne $curl) {
        $curlOutput = & curl.exe -L --silent --show-error --max-time 30 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) invenstment-earnings-monitor/1.0" $Url 2>&1
        $curlExit = $LASTEXITCODE
        $curlText = ($curlOutput | Out-String)
        if ($curlExit -eq 0 -and -not [string]::IsNullOrWhiteSpace($curlText)) {
            return $curlText
        }
    }

    $headers = @{
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) invenstment-earnings-monitor/1.0"
        "Accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    $response = Invoke-WebRequest -Uri $Url -Headers $headers -TimeoutSec 25 -MaximumRedirection 5
    return [string]$response.Content
}

function Get-StateMap {
    param($State)
    $map = @{}
    if ($null -eq $State -or $null -eq $State.sources) {
        return $map
    }
    foreach ($source in $State.sources.PSObject.Properties) {
        $map[$source.Name] = $source.Value
    }
    return $map
}

function Convert-ToMonitorRow {
    param(
        [object]$Event,
        [string]$CheckStatus,
        [string]$Signal,
        [string]$Detail
    )
    return [pscustomobject]@{
        ticker = [string]$Event.ticker
        expected_date = [string]$Event.expected_date
        expected_time = [string]$Event.expected_time
        priority = [string]$Event.priority
        hill = [string]$Event.hill
        status = $CheckStatus
        signal = $Signal
        detail = $Detail
    }
}

function Write-StatusMarkdown {
    param(
        [string]$Path,
        [object[]]$Rows,
        [object[]]$Alerts,
        [datetime]$Now
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# Earnings Monitor Status")
    $lines.Add("")
    $lines.Add("- Last checked: $($Now.ToString("yyyy-MM-dd HH:mm:ss zzz"))")
    $lines.Add("- Method: poll configured official IR/news pages near scheduled earnings dates and detect page changes/results keywords")
    $lines.Add("- Note: this is an alerting aid. Final judgment still requires reading the official release.")
    $lines.Add("")
    $lines.Add("## Watch Targets")
    $lines.Add("")
    $lines.Add("| Ticker | Expected date | Time | Priority | Hill | Status | Signal | Detail |")
    $lines.Add("| --- | --- | --- | --- | --- | --- | --- | --- |")
    foreach ($row in $Rows) {
        $lines.Add("| $($row.ticker) | $($row.expected_date) | $($row.expected_time) | $($row.priority) | $($row.hill) | $($row.status) | $($row.signal) | $($row.detail) |")
    }
    $lines.Add("")
    $lines.Add("## Alerts")
    $lines.Add("")
    if ($Alerts.Count -eq 0) {
        $lines.Add("- No new alerts in this run")
    } else {
        foreach ($alert in $Alerts) {
            $lines.Add("- $($alert.timestamp) [$($alert.ticker)] $($alert.label): $($alert.message)")
        }
    }
    Set-Content -Path $Path -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
}

$root = (Get-Location).Path
$configFullPath = Join-Path $root $ConfigPath
$outputFullPath = Join-Path $root $OutputDir
$rawDir = Join-Path $outputFullPath "raw"
$statePath = Join-Path $outputFullPath "earnings_monitor_state.json"
$statusPath = Join-Path $outputFullPath "earnings_monitor_status.md"

New-Item -ItemType Directory -Force $outputFullPath | Out-Null
New-Item -ItemType Directory -Force $rawDir | Out-Null

do {
    $now = Get-Date
    $config = Read-JsonFile $configFullPath
    if ($null -eq $config) {
        throw "Config not found or empty: $configFullPath"
    }

    $state = Read-JsonFile $statePath
    $stateMap = Get-StateMap $state
    $newState = [ordered]@{
        updated_at = $now.ToString("o")
        sources = [ordered]@{}
    }
    $rows = New-Object System.Collections.Generic.List[object]
    $alerts = New-Object System.Collections.Generic.List[object]
    $rawDateDir = Join-Path $rawDir $now.ToString("yyyyMMdd")
    New-Item -ItemType Directory -Force $rawDateDir | Out-Null

    foreach ($event in $config.events) {
        $expected = [datetime]::ParseExact([string]$event.expected_date, "yyyy-MM-dd", $null)
        $daysFromExpected = ($expected.Date - $now.Date).Days
        $inWindow = ($daysFromExpected -le $LookaheadDays -and $daysFromExpected -ge (-1 * $LookbackDays))
        if (-not $inWindow) {
            $rows.Add((Convert-ToMonitorRow $event "skip" "outside_window" "outside polling window"))
            continue
        }

        $eventSignals = New-Object System.Collections.Generic.List[string]
        $eventDetails = New-Object System.Collections.Generic.List[string]

        foreach ($source in $event.sources) {
            $key = "$($event.ticker)|$($source.label)|$($source.url)"
            try {
                $content = Fetch-Url ([string]$source.url)
                $hash = Get-TextHash $content
                $previous = $null
                if ($stateMap.ContainsKey($key)) {
                    $previous = $stateMap[$key]
                }

                $changed = ($null -eq $previous -or [string]$previous.hash -ne $hash)
                $lower = $content.ToLowerInvariant()
                $hasResultsKeyword = (
                    $lower.Contains("financial results") -or
                    $lower.Contains("earnings") -or
                    $lower.Contains("quarterly results") -or
                    $lower.Contains("financial result")
                )

                if ($changed) {
                    $safeTicker = ([string]$event.ticker) -replace "[^A-Za-z0-9_-]", "_"
                    $safeLabel = ([string]$source.label) -replace "[^A-Za-z0-9_-]", "_"
                    $fileName = "$safeTicker`_$safeLabel`_$($hash.Substring(0, 12)).html"
                    $rawPath = Join-Path $rawDateDir $fileName
                    Set-Content -Path $rawPath -Value $content -Encoding UTF8
                    $eventSignals.Add("changed")
                    $eventDetails.Add("$($source.label) updated")
                    $alerts.Add([pscustomobject]@{
                        timestamp = $now.ToString("yyyy-MM-dd HH:mm:ss")
                        ticker = [string]$event.ticker
                        label = [string]$source.label
                        message = "page changed. raw: $rawPath"
                    })
                }

                if ($daysFromExpected -le 0 -and $hasResultsKeyword) {
                    $eventSignals.Add("results_keyword")
                    $eventDetails.Add("$($source.label) has results keyword")
                }

                $newState.sources[$key] = [ordered]@{
                    hash = $hash
                    last_checked_at = $now.ToString("o")
                    last_success_at = $now.ToString("o")
                    url = [string]$source.url
                }
            } catch {
                $eventSignals.Add("fetch_error")
                $eventDetails.Add("$($source.label): $($_.Exception.Message)")
                $newState.sources[$key] = [ordered]@{
                    hash = if ($stateMap.ContainsKey($key)) { [string]$stateMap[$key].hash } else { "" }
                    last_checked_at = $now.ToString("o")
                    last_error = $_.Exception.Message
                    url = [string]$source.url
                }
            }
        }

        $signal = if ($eventSignals.Count -eq 0) { "no_change" } else { (($eventSignals | Select-Object -Unique) -join ", ") }
        $detail = if ($eventDetails.Count -eq 0) { "no change" } else { (($eventDetails | Select-Object -Unique) -join "; ") }
        $rows.Add((Convert-ToMonitorRow $event "checked" $signal $detail))
    }

    Write-JsonFile $statePath $newState
    Write-StatusMarkdown $statusPath $rows.ToArray() $alerts.ToArray() $now
    Write-Host "Wrote $statusPath"

    if (-not $Once) {
        Start-Sleep -Seconds ($IntervalMinutes * 60)
    }
} while (-not $Once)
