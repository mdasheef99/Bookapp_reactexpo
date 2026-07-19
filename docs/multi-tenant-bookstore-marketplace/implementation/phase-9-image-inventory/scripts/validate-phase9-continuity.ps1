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
    'work-units/00-contracts-threat-migration-plan.md',
    'work-units/00b-backend-api-technical-design-plan.md'
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
if (-not $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `wu0b_definition_complete_needs_review`')) {
    Write-Error 'DOC-13 does not identify the WU0B definition-review milestone.'
}
if (-not $doc13.Contains('Authorize an independent review of the WU0B definition documents only.')) {
    Write-Error 'DOC-13 does not preserve independent WU0B-definition review as the next action.'
}

$implementationTracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/02-implementation-and-verification.md'))
if (-not $implementationTracker.Contains('**Status:** `wu0b_definition_complete_needs_review`') -or
    -not $implementationTracker.Contains('**Active work unit:** `0b_definition_complete_needs_review`')) {
    Write-Error 'Implementation tracker does not identify the WU0B definition-review milestone.'
}
if ($implementationTracker -notmatch '(?m)^\| 0A \|.*\| `approved_complete` \|') {
    Write-Error 'Implementation tracker no longer preserves WU0A approved-complete evidence.'
}
if ($implementationTracker -notmatch '(?m)^\| 0B \|.*\| `definition_complete_needs_review` \|.*implementation remains separately unauthorized') {
    Write-Error 'Implementation tracker does not keep WU0B definition completion separate from implementation authority.'
}
$wu0aIndex = $implementationTracker.IndexOf('| 0A |')
$wu0bIndex = $implementationTracker.IndexOf('| 0B |')
$unit1Index = $implementationTracker.IndexOf('| 1 |')
if ($wu0aIndex -lt 0 -or $wu0bIndex -le $wu0aIndex -or $unit1Index -le $wu0bIndex) {
    Write-Error 'Implementation tracker must route WU0A to WU0B to Unit 1 in order.'
}

$workUnitPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00-contracts-threat-migration-plan.md'))
if (-not $workUnitPlan.Contains('**Status:** `approved`')) {
    Write-Error 'Work Unit 0 plan is not marked approved.'
}
$wu0bPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00b-backend-api-technical-design-plan.md'))
if (-not $wu0bPlan.Contains('**Definition status:** `definition_complete_needs_review`') -or
    -not $wu0bPlan.Contains('**Authority:** planning document only; WU0B technical-design implementation is not authorized') -or
    -not $wu0bPlan.Contains('**Runtime/migration/external authority:** none')) {
    Write-Error 'WU0B definition status or non-authority boundary is missing.'
}
if (-not $tracker.Contains('**Implementation status:** `wu0b_definition_complete_needs_review`') -or
    -not $tracker.Contains('**Active work unit:** `0b_definition_complete_needs_review`') -or
    -not $tracker.Contains('**Next authorized action:** independent review of the WU0B definition documents only') -or
    -not $tracker.Contains('**Migration creation/application authority:** `not_granted`')) {
    Write-Error 'TRACKER.md does not preserve the WU0B definition-review and migration authorization gates.'
}
if (-not $tracker.Contains('WU0B technical-design implementation is unauthorized') -or
    $tracker.Contains('WU0B technical-design implementation is complete') -or
    $tracker.Contains('WU0B independently approved')) {
    Write-Error 'TRACKER.md incorrectly represents WU0B implementation or independent-review status.'
}
$nextActionCount = [regex]::Matches($tracker, '(?m)^\*\*Next authorized action:\*\*').Count
if ($nextActionCount -ne 1) {
    Write-Error "TRACKER.md must contain exactly one next-action marker; found $nextActionCount."
}
if (-not $wu0bPlan.Contains('5. Migration-file creation.') -or
    -not $wu0bPlan.Contains('7. Live migration application after another exact-project readback.') -or
    -not $wu0bPlan.Contains('Migration-file creation and live application must never share one authorization.')) {
    Write-Error 'WU0B definition does not keep migration creation and application separately gated.'
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
if (-not $sessionStart.Contains('| 0B Backend/API technical design (only if authorized)') -or
    -not $sessionStart.Contains('00b-backend-api-technical-design-plan.md')) {
    Write-Error 'SESSION-START.md does not route the WU0B definition.'
}

$phaseReadme = [IO.File]::ReadAllText((Join-Path $phaseRoot 'README.md'))
if (-not $phaseReadme.Contains('**Status:** `wu0b_definition_complete_needs_review`') -or
    -not $phaseReadme.Contains('WU0B definition complete and awaiting independent review') -or
    -not $phaseReadme.Contains('WU0B/product/runtime implementation not started')) {
    Write-Error 'Phase 9 README disagrees with the WU0B definition-review milestone.'
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
