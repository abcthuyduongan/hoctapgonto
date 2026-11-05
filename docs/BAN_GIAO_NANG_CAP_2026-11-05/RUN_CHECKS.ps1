# Local validation helper for the handoff. It does not install, migrate, package or deploy.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRoot,
    [ValidateSet('Baseline','Final')]
    [string]$Mode = 'Baseline'
)

$ErrorActionPreference = 'Stop'
$env:NODE_NO_WARNINGS = '1'
if (Test-Path variable:global:PSNativeCommandUseErrorActionPreference) {
    $global:PSNativeCommandUseErrorActionPreference = $false
}
$taskRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$taskPackagePath = Join-Path $taskRoot 'package.json'
if (-not (Test-Path -LiteralPath $taskPackagePath -PathType Leaf)) {
    throw 'ProjectRoot must contain package.json.'
}
$taskPackage = Get-Content -LiteralPath $taskPackagePath -Raw | ConvertFrom-Json
if ($taskPackage.name -ne 'bao-an-learning') {
    throw 'ProjectRoot is not the expected Bao An Learning project.'
}
$taskNpm = (Get-Command npm.cmd -ErrorAction Stop).Source
$taskPlaywright = Join-Path $taskRoot 'node_modules\.bin\playwright.cmd'
if (-not (Test-Path -LiteralPath $taskPlaywright -PathType Leaf)) {
    throw 'Local Playwright is missing. Review prerequisites and install project dependencies first.'
}
if ($Mode -eq 'Final') {
    if (-not $taskPackage.scripts.'test:map') {
        throw 'Final requires the proposed test:map script to be implemented.'
    }
    if ($taskPackage.scripts.test -notmatch 'test:map') {
        throw 'Final requires npm test to include test:map, as specified by the handoff.'
    }
    if (-not [string]::IsNullOrWhiteSpace($env:BAO_AN_BROWSER_CHANNEL)) {
        throw 'Final requires both configured browsers. Remove the BAO_AN_BROWSER_CHANNEL override first.'
    }
    if (-not [string]::IsNullOrWhiteSpace($env:BAO_AN_STATIC_ROOT)) {
        $taskStaticOverride = (Resolve-Path -LiteralPath $env:BAO_AN_STATIC_ROOT).Path
        $taskExpectedDist = [System.IO.Path]::GetFullPath((Join-Path $taskRoot 'dist'))
        if ($taskStaticOverride.TrimEnd('\','/') -ne $taskExpectedDist.TrimEnd('\','/')) {
            throw 'Final must test this project dist, not a BAO_AN_STATIC_ROOT pointing at another build.'
        }
    }
    $taskMapTests = @(
        'tests/world-map-assets.test.mjs',
        'tests/world-map-domain.test.mjs',
        'tests/world-map-store.test.mjs',
        'tests/world-map-api.test.mjs',
        'tests/world-map-performance.test.mjs',
        'tests/visual/online-worldmap.spec.ts',
        'tests/visual/online-regionmap.spec.ts',
        'tests/visual/online-mapflow.spec.ts',
        'tests/visual/online-mapperformance.spec.ts'
    )
    foreach ($taskTestPath in $taskMapTests) {
        if (-not (Test-Path -LiteralPath (Join-Path $taskRoot $taskTestPath) -PathType Leaf)) {
            throw ('Required map test is missing: ' + $taskTestPath)
        }
    }
}

$taskRunId = [DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$taskLogRoot = Join-Path $taskRoot ('test-results/map-upgrade/' + $taskRunId)
New-Item -ItemType Directory -Path $taskLogRoot -Force | Out-Null
$taskBrowserRoot = Join-Path $taskLogRoot 'browser-output'
$taskOldReportPath = $env:PLAYWRIGHT_JSON_OUTPUT_FILE
$taskResults = [System.Collections.Generic.List[object]]::new()
$taskStartedAt = [DateTimeOffset]::UtcNow.ToString('o')
$taskFailure = $null
$taskBrowserChannel = $env:BAO_AN_BROWSER_CHANNEL

Push-Location -LiteralPath $taskRoot
try {
    $env:PLAYWRIGHT_JSON_OUTPUT_FILE = Join-Path $taskLogRoot 'browser-report.json'
    $taskChecks = @(
        [pscustomobject]@{Name='typecheck'; Program=$taskNpm; Arguments=@('run','typecheck')},
        [pscustomobject]@{Name='test'; Program=$taskNpm; Arguments=@('test')},
        [pscustomobject]@{Name='build'; Program=$taskNpm; Arguments=@('run','build')},
        [pscustomobject]@{Name='assets'; Program=$taskNpm; Arguments=@('run','test:assets')},
        [pscustomobject]@{Name='browser'; Program=$taskPlaywright; Arguments=@('test','--config=playwright.online.config.ts',('--output=' + $taskBrowserRoot),'--reporter=list,json')}
    )
    foreach ($taskCheck in $taskChecks) {
        $taskCommand = $taskCheck.Program
        $taskArguments = $taskCheck.Arguments
        $taskLogFile = Join-Path $taskLogRoot ($taskCheck.Name + '.log')
        $taskStepStarted = [DateTimeOffset]::UtcNow
        Write-Host ('Running ' + $taskCheck.Name + ' in ' + $Mode + ' mode')
        $ErrorActionPreference = 'Continue'
        & $taskCommand @taskArguments 2>&1 | Tee-Object -FilePath $taskLogFile
        $taskExitCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        $taskResults.Add([pscustomobject]@{
            name=$taskCheck.Name
            program=$taskCommand
            arguments=$taskArguments
            exitCode=$taskExitCode
            durationSeconds=([DateTimeOffset]::UtcNow - $taskStepStarted).TotalSeconds
            log=$taskLogFile
        })
        if ($taskExitCode -ne 0) {
            throw ('Check failed: ' + $taskCheck.Name + '. Read ' + $taskLogFile)
        }
    }
} catch {
    $taskFailure = $_.Exception.Message
} finally {
    $taskBuildInfo = $null
    $taskBuildInfoPath = Join-Path $taskRoot 'dist/build-info.json'
    if (Test-Path -LiteralPath $taskBuildInfoPath -PathType Leaf) {
        try { $taskBuildInfo = Get-Content -LiteralPath $taskBuildInfoPath -Raw | ConvertFrom-Json } catch { }
    }
    $taskSummary = [ordered]@{
        mode=$Mode
        startedAtUtc=$taskStartedAt
        finishedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
        browserChannelOverride=$taskBrowserChannel
        checks=$taskResults.ToArray()
        failure=$taskFailure
        buildInfo=$taskBuildInfo
        scope='Local and fixture checks only; not a real-cloud load test or an 80-case completion report.'
    }
    $taskSummary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $taskLogRoot 'run-summary.json') -Encoding utf8
    $env:PLAYWRIGHT_JSON_OUTPUT_FILE = $taskOldReportPath
    Pop-Location
}
Write-Host ('Evidence: ' + $taskLogRoot)
if ($taskFailure) {
    throw $taskFailure
}
