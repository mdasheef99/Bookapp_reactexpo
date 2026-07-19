Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$phaseRoot = Split-Path -Parent $PSScriptRoot
$implementationRoot = Split-Path -Parent $phaseRoot
$marketplaceRoot = Split-Path -Parent $implementationRoot
$repoRoot = (Resolve-Path (Join-Path $marketplaceRoot '..\..')).Path

$requiredPhaseFiles = @(
    'README.md',
    'SESSION-START.md',
    'TRACKER.md',
    '00-phase-9-master-sdd.md',
    '01-data-canonical-metadata-sdd.md',
    '02-extraction-enrichment-pipeline-sdd.md',
    '03-owner-review-inventory-commit-sdd.md',
    '04-media-security-privacy-sdd.md',
    '05-marketplace-discovery-display-sdd.md',
    '06-customer-photo-request-extension-sdd.md',
    'supporting/data-dictionary.md',
    'supporting/database-current-vs-target.md',
    'supporting/requirements-traceability.md',
    'supporting/complexity-and-scope-register.md',
    'trackers/01-planning-and-decisions.md',
    'trackers/02-implementation-and-verification.md',
    'work-units/00-contracts-threat-migration-plan.md'
)

$missing = @()
foreach ($relative in $requiredPhaseFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $phaseRoot $relative))) {
        $missing += $relative
    }
}

$requiredGlobal = @(
    (Join-Path $repoRoot 'AGENTS.md'),
    (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md')
)
foreach ($path in $requiredGlobal) {
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $path
    }
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing continuity files:`n" + ($missing -join "`n"))
}

$trackerPath = Join-Path $phaseRoot 'TRACKER.md'
$tracker = [IO.File]::ReadAllText($trackerPath)
$trackerMarkers = @(
    '**Planning status:**',
    '**Implementation status:**',
    '**Current milestone:**',
    '**Active work unit:**',
    '**Next authorized action:**',
    '**Implementation authority:**',
    '**Migration creation/application authority:**'
)
foreach ($marker in $trackerMarkers) {
    if (-not $tracker.Contains($marker)) {
        Write-Error "TRACKER.md is missing required marker: $marker"
    }
}

$active = [IO.File]::ReadAllText((Join-Path $implementationRoot 'ACTIVE.md'))
if (-not $active.Contains('phase-9-image-inventory/SESSION-START.md')) {
    Write-Error 'ACTIVE.md does not route to the Phase 9 session entrypoint.'
}
if (-not $active.Contains('DOC-13-implementation-tracker.md')) {
    Write-Error 'ACTIVE.md does not route to DOC-13.'
}

$doc13 = [IO.File]::ReadAllText((Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
if ($doc13 -notmatch '\| Current phase \| Phase 9:') {
    Write-Error 'DOC-13 does not identify Phase 9 as the current marketplace phase.'
}

$implementationTracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/02-implementation-and-verification.md'))
if (-not $implementationTracker.Contains('**Active work unit:** `0_approved_awaiting_next_authorization`')) {
    Write-Error 'Implementation tracker active work unit disagrees with the approved Work Unit 0 authorization gate.'
}

$workUnitPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00-contracts-threat-migration-plan.md'))
if (-not $workUnitPlan.Contains('**Status:** `approved`')) {
    Write-Error 'Work Unit 0 plan is not marked approved.'
}
if (-not $tracker.Contains('**Active work unit:** `0_approved_awaiting_next_authorization`')) {
    Write-Error 'TRACKER.md does not preserve the post-WU0 authorization gate.'
}

$agents = [IO.File]::ReadAllText((Join-Path $repoRoot 'AGENTS.md'))
if (-not $agents.Contains('phase-9-image-inventory/SESSION-START.md')) {
    Write-Error 'Repository AGENTS.md does not point to the Phase 9 session entrypoint.'
}

$sessionStart = [IO.File]::ReadAllText((Join-Path $phaseRoot 'SESSION-START.md'))
if (-not $sessionStart.Contains('## 6. Documentation update matrix') -or
    -not $sessionStart.Contains('## 8. Mandatory closeout transaction')) {
    Write-Error 'SESSION-START.md is missing its update matrix or closeout transaction.'
}

$master = [IO.File]::ReadAllText((Join-Path $phaseRoot '00-phase-9-master-sdd.md'))
if (-not $master.Contains('Documentation and development-session continuity')) {
    Write-Error 'Master SDD is missing the continuity contract.'
}

$markdownFiles = @(Get-ChildItem -LiteralPath $phaseRoot -Recurse -Filter '*.md')
$extraMarkdownPaths = @(
    (Join-Path $repoRoot 'AGENTS.md'),
    (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $implementationRoot 'README.md'),
    (Join-Path $marketplaceRoot 'README.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md')
)
foreach ($path in $extraMarkdownPaths) {
    $markdownFiles += Get-Item -LiteralPath $path
}

$brokenLinks = @()
foreach ($file in $markdownFiles) {
    $body = [IO.File]::ReadAllText($file.FullName)
    foreach ($match in [regex]::Matches($body, '\]\(([^)]+)\)')) {
        $target = $match.Groups[1].Value.Trim()
        if ($target -match '^(https?://|mailto:|#)') {
            continue
        }
        $target = $target.Split('#')[0]
        if ([string]::IsNullOrWhiteSpace($target)) {
            continue
        }
        $target = [Uri]::UnescapeDataString($target.Trim('<', '>'))
        $resolved = [IO.Path]::GetFullPath((Join-Path $file.DirectoryName $target))
        if (-not (Test-Path -LiteralPath $resolved)) {
            $brokenLinks += "$($file.FullName) -> $($match.Groups[1].Value)"
        }
    }
}
if ($brokenLinks.Count -gt 0) {
    Write-Error ("Broken local links:`n" + ($brokenLinks -join "`n"))
}

$oversized = @()
foreach ($file in (Get-ChildItem -LiteralPath $phaseRoot -Recurse -Filter '*.md')) {
    if ([IO.File]::ReadAllLines($file.FullName).Count -gt 350) {
        $oversized += $file.FullName
    }
}
if ($oversized.Count -gt 0) {
    Write-Error ("Phase 9 documents over 350 lines:`n" + ($oversized -join "`n"))
}

Push-Location $repoRoot
try {
    & git diff --check
    if ($LASTEXITCODE -ne 0) {
        throw 'git diff --check failed.'
    }
}
finally {
    Pop-Location
}

Write-Output "PHASE9_CONTINUITY_CHECK=PASS"
Write-Output "MARKDOWN_FILES_CHECKED=$($markdownFiles.Count)"
Write-Output "REQUIRED_PHASE_FILES=$($requiredPhaseFiles.Count)"
