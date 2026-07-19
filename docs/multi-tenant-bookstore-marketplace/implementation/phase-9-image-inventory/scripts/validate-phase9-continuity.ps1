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
    'work-units/00b-backend-api-technical-design-plan.md',
    'work-units/00b-technical-design/00-overview-authority-and-file-map.md',
    'work-units/00b-technical-design/01-command-query-and-dto-catalogue.md',
    'work-units/00b-technical-design/02-authorization-tenancy-and-privacy.md',
    'work-units/00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    'work-units/00b-technical-design/04-jobs-providers-and-media-boundaries.md',
    'work-units/00b-technical-design/05-marketplace-and-request-photo-design.md',
    'work-units/00b-technical-design/06-red-tests-acceptance-and-handoff.md'
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
if (-not $active.Contains('**Current work-unit plan:** [Work Unit 0B backend/API technical-design definition](./phase-9-image-inventory/work-units/00b-backend-api-technical-design-plan.md)')) {
    Write-Error 'ACTIVE.md does not route to the current WU0B definition.'
}

$doc13 = [IO.File]::ReadAllText((Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
if ($doc13 -notmatch '\| Current phase \| Phase 9:') {
    Write-Error 'DOC-13 does not identify Phase 9 as the current marketplace phase.'
}
if (-not $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `wu0b_implementation_complete_needs_independent_review`')) {
    Write-Error 'DOC-13 does not identify the completed WU0B technical-design review milestone.'
}
if (-not $doc13.Contains('| Next recommended task | Authorize an independent review of the completed WU0B technical-design artifacts only. Supabase audit, database/migration design, migration creation/testing/application, providers, Storage, runtime/UI, and Phase 7/8 behavior remain unauthorized. |')) {
    Write-Error 'DOC-13 does not preserve independent WU0B review as the sole next action.'
}

$implementationTracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/02-implementation-and-verification.md'))
if ($implementationTracker -notmatch '(?m)^\*\*Status:\*\* `wu0b_implementation_complete_needs_independent_review`\r?$' -or
    $implementationTracker -notmatch '(?m)^\*\*Active work unit:\*\* `0b_implementation_complete_needs_independent_review`\r?$') {
    Write-Error 'Implementation tracker does not identify the completed WU0B technical-design review milestone.'
}
if ($implementationTracker -notmatch '(?m)^\| 0A \|.*\| `approved_complete` \|') {
    Write-Error 'Implementation tracker no longer preserves WU0A approved-complete evidence.'
}
if ($implementationTracker -notmatch '(?m)^\| 0B \|.*\| `implementation_complete_needs_review` \|.*independent review next;.*no Supabase query') {
    Write-Error 'Implementation tracker does not keep WU0B completion separate from independent approval and later authority.'
}
if (-not $implementationTracker.Contains('`definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`')) {
    Write-Error 'Implementation tracker omits the intermediate definition-approved authorization gate.'
}
$wu0Index = $implementationTracker.IndexOf('| 0 |')
$wu0aIndex = $implementationTracker.IndexOf('| 0A |')
$wu0bIndex = $implementationTracker.IndexOf('| 0B |')
$unit1Index = $implementationTracker.IndexOf('| 1 |')
if ($wu0Index -lt 0 -or $wu0aIndex -le $wu0Index -or $wu0bIndex -le $wu0aIndex -or $unit1Index -le $wu0bIndex) {
    Write-Error 'Implementation tracker must route WU0 to WU0A to WU0B to Unit 1 in order.'
}

$workUnitPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00-contracts-threat-migration-plan.md'))
if (-not $workUnitPlan.Contains('**Status:** `approved`') -or
    -not $workUnitPlan.Contains('**Authority:** approved Phase 9 planning baseline; planning only') -or
    -not $workUnitPlan.Contains('**Implementation:** not started') -or
    -not $workUnitPlan.Contains('**Migration-file creation/application:** not authorized')) {
    Write-Error 'Work Unit 0 approval or non-authority integrity markers are missing.'
}
$wu0bPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00b-backend-api-technical-design-plan.md'))
if (-not $wu0bPlan.Contains('**Definition status:** `definition_independently_approved`') -or
    -not $wu0bPlan.Contains('**Implementation status:** `implementation_complete_needs_review`') -or
    -not $wu0bPlan.Contains('**Definition review:** `approved` on 2026-07-20 after correction verification') -or
    -not $wu0bPlan.Contains('**Authority:** documentation-only technical design; no runtime or database authority') -or
    -not $wu0bPlan.Contains('**Runtime/migration/Supabase/provider/storage/UI authority:** none')) {
    Write-Error 'WU0B router status or non-authority boundary is missing.'
}
$artifactRelativePaths = @(
    '00b-technical-design/00-overview-authority-and-file-map.md',
    '00b-technical-design/01-command-query-and-dto-catalogue.md',
    '00b-technical-design/02-authorization-tenancy-and-privacy.md',
    '00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md',
    '00b-technical-design/05-marketplace-and-request-photo-design.md',
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md'
)
$artifactBodies = @{}
foreach ($relative in $artifactRelativePaths) {
    if (-not $wu0bPlan.Contains("./$relative")) {
        Write-Error "WU0B router does not link required artifact: $relative"
    }
    $artifactBodies[$relative] = [IO.File]::ReadAllText((Join-Path $phaseRoot "work-units/$relative"))
}
if ($tracker -notmatch '(?m)^\*\*Implementation status:\*\* `wu0b_implementation_complete_needs_independent_review`;.*documentation-only\r?$' -or
    $tracker -notmatch '(?m)^\*\*Active work unit:\*\* `0b_implementation_complete_needs_independent_review`\r?$' -or
    $tracker -notmatch '(?m)^\*\*Next authorized action:\*\* independent review of the completed WU0B technical-design artifacts only\r?$' -or
    $tracker -notmatch '(?m)^\*\*Migration creation/application authority:\*\* `not_granted`\r?$') {
    Write-Error 'TRACKER.md does not preserve the WU0B independent-review and migration authorization gates.'
}
if ($tracker.Contains('WU0B implementation independently approved') -or
    $tracker -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|product/runtime implementation) (?:is|are) authorized\b') {
    Write-Error 'TRACKER.md incorrectly represents WU0B independent approval or a later authorization.'
}
$nextActionCount = [regex]::Matches($tracker, '(?m)^\*\*Next authorized action:\*\*').Count
if ($nextActionCount -ne 1) {
    Write-Error "TRACKER.md must contain exactly one next-action marker; found $nextActionCount."
}
$catalogue = $artifactBodies['00b-technical-design/01-command-query-and-dto-catalogue.md']
$commandIds = @([regex]::Matches($catalogue, '\bC(?:0[1-9]|1[0-9]|2[0-6])\b') | ForEach-Object Value | Sort-Object -Unique)
$queryIds = @([regex]::Matches($catalogue, '\bQ(?:0[1-9]|1[01])\b') | ForEach-Object Value | Sort-Object -Unique)
if ($commandIds.Count -ne 26 -or $queryIds.Count -ne 11) {
    Write-Error "WU0B catalogue coverage mismatch: commands=$($commandIds.Count), queries=$($queryIds.Count)."
}
$requiredCategoryChecks = @{
    '00b-technical-design/00-overview-authority-and-file-map.md' = @('## 4. Internal component boundary map', '## 5. Exact proposed later implementation file allowlist', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN')
    '00b-technical-design/01-command-query-and-dto-catalogue.md' = @('## 2. Command catalogue', '## 3. Query catalogue', '## 4. DTO projection inventory', '## 5. Stable error-to-HTTP catalogue', '## 6. Rate and abuse classes')
    '00b-technical-design/02-authorization-tenancy-and-privacy.md' = @('## 2. Actor and tenancy matrix', '## 4. Grant design target', '## 6. Event and telemetry positive allowlist', '## 7. Forbidden-field matrix')
    '00b-technical-design/03-state-transactions-idempotency-and-publication.md' = @('## 1. State ownership', '## 2. Transaction boundaries', '## 3. Optimistic concurrency and idempotency', 'committed_publication_failed')
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md' = @('## 1. Persistent job contract', 'FOR UPDATE SKIP LOCKED', '## 4. Adapter interfaces', '## 5. Media validation and capability boundaries')
    '00b-technical-design/05-marketplace-and-request-photo-design.md' = @('Q07 is a service-internal matching stage', 'Q08 consumes', '## 5. Request-photo aggregate', '## 9. Explicit Phase 7/8 exclusions')
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md' = @('## 1. Red-test mapping', 'implementation_complete_needs_review', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN', 'Authorize an independent review of the completed WU0B technical-design artifacts only.')
}
foreach ($relative in $requiredCategoryChecks.Keys) {
    foreach ($marker in $requiredCategoryChecks[$relative]) {
        if (-not $artifactBodies[$relative].Contains($marker)) {
            Write-Error "WU0B artifact $relative is missing required category marker: $marker"
        }
    }
}
$allWu0bText = $wu0bPlan + "`n" + (($artifactBodies.Values) -join "`n")
if ($allWu0bText -match '(?im)^\*\*(?:Status|Implementation status):\*\* `independently_approved`\s*$' -or
    $allWu0bText -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|runtime implementation) (?:is|are) authorized\b' -or
    $allWu0bText -match '(?i)\bMigration(?:-file)? creation and (?:live )?(?:migration )?application (?:are|is)\s+(?:jointly |together )?authorized\b') {
    Write-Error 'WU0B artifacts contain contradictory independent approval or later authority.'
}
$laterGates = @(
    '1. Independent WU0B technical-design review.',
    '2. Fresh exact-project read-only Supabase schema/security/storage audit.',
    '3. Exact database and migration design.',
    '4. Migration-file creation.',
    '5. Isolated migration testing.',
    '6. Live migration application after separate authorization and another exact-project readback.',
    '7. Fixture-backed runtime slices under separate runtime authorization.'
)
$previousGateIndex = -1
foreach ($gate in $laterGates) {
    $gateIndex = $wu0bPlan.IndexOf($gate)
    if ($gateIndex -le $previousGateIndex) {
        Write-Error "WU0B definition is missing or misorders later gate: $gate"
    }
    $previousGateIndex = $gateIndex
}
if (-not $wu0bPlan.Contains('Migration creation and live application can never share one authorization.')) {
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
if (-not $sessionStart.Contains('| 0B Backend/API technical design or review (only if authorized)') -or
    -not $sessionStart.Contains('00b-backend-api-technical-design-plan.md') -or
    -not $sessionStart.Contains('all seven linked `00b-technical-design/` artifacts')) {
    Write-Error 'SESSION-START.md does not route the WU0B authority and artifact set.'
}

$phaseReadme = [IO.File]::ReadAllText((Join-Path $phaseRoot 'README.md'))
if (-not $phaseReadme.Contains('**Status:** `wu0b_implementation_complete_needs_independent_review`') -or
    -not $phaseReadme.Contains('WU0B documentation-only technical design complete and awaiting independent review') -or
    -not $phaseReadme.Contains('product/runtime implementation not started')) {
    Write-Error 'Phase 9 README disagrees with the completed WU0B technical-design review milestone.'
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
