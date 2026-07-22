param(
    [switch]$RunSemanticNegativeProbes
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Get-Wu0bSemanticStateErrors {
    param([hashtable]$Bodies)
    $errors = [System.Collections.Generic.List[string]]::new()
    $claimRules = @(
        @{ Name = 'session'; Domain = 'session'; Allowed = @('active', 'closing', 'closed', 'expired') },
        @{ Name = 'image-input'; Domain = '(?:image_input|input)'; Allowed = @('uploaded', 'validating', 'queued', 'processing', 'ready', 'failed', 'skipped') },
        @{ Name = 'candidate'; Domain = 'candidate'; Allowed = @('processing', 'ready', 'needs_review', 'possible_duplicate', 'failed', 'commit_in_progress', 'committed') },
        @{ Name = 'request-photo'; Domain = '(?:request_photo|photo)'; Allowed = @('none', 'requested', 'uploading', 'provided', 'accepted', 'declined', 'unfulfilled', 'expired') },
        @{ Name = 'hold'; Domain = 'holds?'; Allowed = @('active', 'released', 'converted_to_sale') }
    )
    foreach ($relative in $Bodies.Keys) {
        $lineNumber = 0
        foreach ($line in ($Bodies[$relative] -split "`r?`n")) {
            $lineNumber++
            $compact = ($line.ToLowerInvariant() -replace '[^a-z0-9]', '')
            $semantic = $line.ToLowerInvariant().Replace(([string][char]0x2192), ' arrow ') -replace "'s\b", '' -replace '->', ' arrow ' -replace '=', ' equals ' -replace ':', ' colon ' -replace 'is[\s-]*persisted[\s-]*as', 'is persisted as' -replace 'persisted[\s-]*as', 'persisted as' -replace 'request[\s-]*photo', 'request_photo' -replace 'image[\s-]*input', 'image_input' -replace '[^a-z0-9_]+', ' ' -replace '\s+', ' '
            if ($compact -match '(?:notrequested|unrequested|pendingrequest)') { $errors.Add("PHOTO_UNKNOWN_STATE:${relative}:$lineNumber") }
            if ($line -match '(?i)skipped_false_detection' -and $line -notmatch '(?i)review disposition.*not (?:a )?candidate state') { $errors.Add("CANDIDATE_DISPOSITION_AS_STATE:${relative}:$lineNumber") }
            foreach ($rule in $claimRules) {
                $context = '(?:(?:state|status|workflow|lifecycle)\s+){0,2}'; $allowed = $rule.Allowed -join '|'
                $patterns = @(
                    "\b$($rule.Domain)\b\s+$context(?:is\s+)?persisted\s+as\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:becomes)\s+([a-z_]+)",
                    "\b$($rule.Domain)\b\s+$context(?:advances|transitions)\s+(?:to|into)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:(?:advances|transitions)\s+)?from\s+(?:$allowed)\s+(?:to|into|arrow)\s+([a-z_]+)",
                    "\b$($rule.Domain)\b\s+(?:(?:persisted\s+)?(?:state|status|workflow|lifecycle)\s+)+(?:is|equals|colon)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+${context}terminal(?:\s+(?:state|status|outcome))?\s+(?:is|becomes)\s+([a-z_]+)", "\b$($rule.Domain)\b\s+$context(?:(?:colon|equals)\s+)?(?:$allowed)\s+arrow\s+([a-z_]+)"
                )
                foreach ($pattern in $patterns) { foreach ($match in [regex]::Matches($semantic, $pattern)) {
                    $value = $match.Groups[1].Value.ToLowerInvariant(); if ($value -notin $rule.Allowed) { $errors.Add("UNKNOWN_$($rule.Name.ToUpperInvariant().Replace('-', '_'))_STATE:${value}:${relative}:$lineNumber") }
                } }
            }
        }
    }
    return $errors
}
$phaseRoot = Split-Path -Parent $PSScriptRoot
$implementationRoot = Split-Path -Parent $phaseRoot
$marketplaceRoot = Split-Path -Parent $implementationRoot
$repoRoot = (Resolve-Path (Join-Path $marketplaceRoot '..\..')).Path
$requiredPhaseFiles = @(
    'README.md', 'SESSION-START.md', 'TRACKER.md', '00-phase-9-master-sdd.md',
    '01-data-canonical-metadata-sdd.md', '02-extraction-enrichment-pipeline-sdd.md',
    '03-owner-review-inventory-commit-sdd.md', '04-media-security-privacy-sdd.md',
    '05-marketplace-discovery-display-sdd.md', '06-customer-photo-request-extension-sdd.md',
    'supporting/data-dictionary.md', 'supporting/database-current-vs-target.md',
    'supporting/requirements-traceability.md', 'supporting/complexity-and-scope-register.md',
    'trackers/01-planning-and-decisions.md', 'trackers/02-implementation-and-verification.md',
    'work-units/00-contracts-threat-migration-plan.md', 'work-units/00b-backend-api-technical-design-plan.md',
    'work-units/00b-technical-design/00-overview-authority-and-file-map.md', 'work-units/00b-technical-design/01-command-query-and-dto-catalogue.md',
    'work-units/00b-technical-design/02-authorization-tenancy-and-privacy.md', 'work-units/00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    'work-units/00b-technical-design/04-jobs-providers-and-media-boundaries.md', 'work-units/00b-technical-design/05-marketplace-and-request-photo-design.md',
    'work-units/00b-technical-design/06-red-tests-acceptance-and-handoff.md',
    'work-units/01-package1-live-audit.md', 'work-units/01-package1-database-design.md'
)
$missing = @()
foreach ($relative in $requiredPhaseFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $phaseRoot $relative))) {
        $missing += $relative
    }
}
$requiredGlobal = @((Join-Path $repoRoot 'AGENTS.md'), (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
foreach ($path in $requiredGlobal) {
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $path
    }
}
if ($missing.Count -gt 0) { Write-Error ("Missing continuity files:`n" + ($missing -join "`n")) }
$trackerPath = Join-Path $phaseRoot 'TRACKER.md'
$tracker = [IO.File]::ReadAllText($trackerPath)
$trackerMarkers = @(
    '**Planning status:**', '**Implementation status:**', '**Current milestone:**', '**Active work unit:**',
    '**Next authorized action:**', '**Implementation authority:**',
    '**Migration creation/application authority:**'
)
foreach ($marker in $trackerMarkers) {
    if (-not $tracker.Contains($marker)) {
        Write-Error "TRACKER.md is missing required marker: $marker"
    }
}
$active = [IO.File]::ReadAllText((Join-Path $implementationRoot 'ACTIVE.md'))
if (-not $active.Contains('phase-9-image-inventory/SESSION-START.md')) { Write-Error 'ACTIVE.md does not route to the Phase 9 session entrypoint.' }
if (-not $active.Contains('DOC-13-implementation-tracker.md')) { Write-Error 'ACTIVE.md does not route to DOC-13.' }
if (-not $active.Contains('phase-9-image-inventory/work-units/01-package1-database-design.md') -or
    -not $active.Contains('implemented locally as independently approved M01-M08 and not applied')) { Write-Error 'ACTIVE.md does not route to the approved, unapplied Package 1 checkpoint.' }
$doc13 = [IO.File]::ReadAllText((Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
if ($doc13 -notmatch '\| Current phase \| Phase 9:') { Write-Error 'DOC-13 does not identify Phase 9 as the current marketplace phase.' }
if (-not $doc13.Contains('| Phase 9: Image-to-LLM Inventory | `package1_m01_m08_independently_approved_not_applied`')) { Write-Error 'DOC-13 does not identify the independently approved, unapplied M01-M08 milestone.' }
if (-not $doc13.Contains('| Next recommended task | Await separate authorization for exact-project M01-M08 live preflight/application. M09 remains a separately reviewed live-data gate; providers, runtime/UI, and Phase 7/8 behavior remain unauthorized. |')) { Write-Error 'DOC-13 does not preserve the separate live-application and M09 authorization gates.' }
$implementationTracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'trackers/02-implementation-and-verification.md'))
if ($implementationTracker -notmatch '(?m)^\*\*Status:\*\* `package1_m01_m08_independently_approved_not_applied`\r?$' -or
    $implementationTracker -notmatch '(?m)^\*\*Active work unit:\*\* `package1_m01_m08_independently_approved_not_applied`\r?$') {
    Write-Error 'Implementation tracker does not identify the independently approved, unapplied M01-M08 milestone.'
}
if ($implementationTracker -notmatch '(?m)^\| 0A \|.*\| `approved_complete` \|') { Write-Error 'Implementation tracker no longer preserves WU0A approved-complete evidence.' }
if ($implementationTracker -notmatch '(?m)^\| 0B \|.*\| `independently_approved` \|.*Risk-Based Phase 9 SDD analysis next;.*no Supabase query') { Write-Error 'Implementation tracker does not preserve WU0B approval and later-authority separation.' }
if (-not $implementationTracker.Contains('`definition_independently_approved_awaiting_implementation_authorization`, `implementation_authorized`')) { Write-Error 'Implementation tracker omits the intermediate definition-approved authorization gate.' }
$wu0Index = $implementationTracker.IndexOf('| 0 |')
$wu0aIndex = $implementationTracker.IndexOf('| 0A |')
$wu0bIndex = $implementationTracker.IndexOf('| 0B |')
$unit1Index = $implementationTracker.IndexOf('| 1 |')
if ($wu0Index -lt 0 -or $wu0aIndex -le $wu0Index -or $wu0bIndex -le $wu0aIndex -or $unit1Index -le $wu0bIndex) { Write-Error 'Implementation tracker must route WU0 to WU0A to WU0B to Unit 1 in order.' }
$workUnitPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00-contracts-threat-migration-plan.md'))
if (-not $workUnitPlan.Contains('**Status:** `approved`') -or
    -not $workUnitPlan.Contains('**Authority:** approved Phase 9 planning baseline; planning only') -or
    -not $workUnitPlan.Contains('**Implementation:** not started') -or
    -not $workUnitPlan.Contains('**Migration-file creation/application:** not authorized')) {
    Write-Error 'Work Unit 0 approval or non-authority integrity markers are missing.'
}
$wu0bPlan = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/00b-backend-api-technical-design-plan.md'))
if (-not $wu0bPlan.Contains('**Definition status:** `definition_independently_approved`') -or
    -not $wu0bPlan.Contains('**Implementation status:** `independently_approved`') -or
    -not $wu0bPlan.Contains('**Definition review:** `approved` on 2026-07-20 after correction verification') -or
    -not $wu0bPlan.Contains('**Authority:** documentation-only technical design; no runtime or database authority') -or
    -not $wu0bPlan.Contains('**Runtime/migration/Supabase/provider/storage/UI authority:** none')) {
    Write-Error 'WU0B router status or non-authority boundary is missing.'
}
$artifactRelativePaths = @(
    '00b-technical-design/00-overview-authority-and-file-map.md', '00b-technical-design/01-command-query-and-dto-catalogue.md',
    '00b-technical-design/02-authorization-tenancy-and-privacy.md', '00b-technical-design/03-state-transactions-idempotency-and-publication.md',
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md', '00b-technical-design/05-marketplace-and-request-photo-design.md',
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md'
)
$artifactBodies = @{}
foreach ($relative in $artifactRelativePaths) {
    if (-not $wu0bPlan.Contains("./$relative")) {
        Write-Error "WU0B router does not link required artifact: $relative"
    }
    $artifactBodies[$relative] = [IO.File]::ReadAllText((Join-Path $phaseRoot "work-units/$relative"))
}
if ($tracker -notmatch '(?m)^\*\*Implementation status:\*\* `package1_m01_m08_independently_approved_not_applied`;.*documentation-only\r?$' -or
    $tracker -notmatch '(?m)^\*\*Active work unit:\*\* `package1_m01_m08_independently_approved_not_applied`\r?$' -or
    $tracker -notmatch '(?m)^\*\*Next authorized action:\*\* none; await separate authorization for exact-project M01-M08 live preflight/application; M09 remains independently gated\r?$' -or
    $tracker -notmatch '(?m)^\*\*Migration creation/application authority:\*\* `m01_m08_created_local_only`; live application and M09 not granted\r?$') {
    Write-Error 'TRACKER.md does not preserve the M01-M08 review and live-application gates.'
}
$packageAudit = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/01-package1-live-audit.md'))
$packageDesign = [IO.File]::ReadAllText((Join-Path $phaseRoot 'work-units/01-package1-database-design.md'))
if (-not $packageDesign.Contains('temporary compatibility CHECKs accepting the union') -or
    -not $packageDesign.Contains('phase9_upload_capabilities') -or
    -not $packageDesign.Contains('no direct base-table SELECT or DML') -or
    -not $packageDesign.Contains('unique constraint `(store_id, job_id, cost_kind, policy_version)`') -or
    -not $packageDesign.Contains('Add `image_extraction_inputs.media_asset_id -> media_assets(id)`') -or
    -not $packageDesign.Contains('Separately reviewed gate, not one of the eight additive Phase 9 groups:')) {
    Write-Error 'Package 1 design is missing one or more required six-finding correction markers.'
}
if (-not $packageAudit.Contains('C02/C03, C15/C16 and C20/C21') -or
    -not $packageAudit.Contains('M09 preflight fails on any violating row') -or
    -not $packageAudit.Contains('cannot directly read or mutate private Phase 9 base tables')) {
    Write-Error 'Package 1 audit gap/test plan is missing required correction coverage.'
}
$migrationNames = @(
    '20260722000001_marketplace_phase9_catalogue_metadata_expand.sql',
    '20260722000002_marketplace_phase9_extraction_persistence.sql',
    '20260722000003_marketplace_phase9_media_registry.sql',
    '20260722000004_marketplace_phase9_condition_damage_transition.sql',
    '20260722000005_marketplace_phase9_controlled_inventory_commands.sql',
    '20260722000006_marketplace_phase9_storage_boundaries.sql',
    '20260722000007_marketplace_phase9_public_projection_search.sql',
    '20260722000008_marketplace_phase9_request_photo_seam.sql'
)
foreach ($name in $migrationNames) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "supabase/migrations/$name"))) { Write-Error "Missing approved Phase 9 migration: $name" }
}
$phase9Migrations = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'supabase/migrations') -Filter '*marketplace_phase9*.sql')
if ($phase9Migrations.Count -ne 8 -or $phase9Migrations.Name -match '000009|quantity.*validat') { Write-Error 'Phase 9 migration set must contain exactly M01-M08 and no M09.' }
foreach ($relative in @('supabase/tests/phase9/phase6_baseline.sql','supabase/tests/phase9/databaseHarness.mjs',
    'supabase/tests/phase9/phase9Database.integration.test.mjs','supabase/migrations/__tests__/marketplacePhase9DatabaseFoundation.test.ts')) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $relative))) { Write-Error "Missing Phase 9 migration test harness file: $relative" }
}
$packageJson = [IO.File]::ReadAllText((Join-Path $repoRoot 'package.json'))
if (-not $packageJson.Contains('"test:phase9:db"')) { Write-Error 'package.json does not expose the isolated Phase 9 database suite.' }
if ($tracker -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|product/runtime implementation) (?:is|are) authorized\b') {
    Write-Error 'TRACKER.md incorrectly represents a later authorization.'
}
$nextActionCount = [regex]::Matches($tracker, '(?m)^\*\*Next authorized action:\*\*').Count
if ($nextActionCount -ne 1) { Write-Error "TRACKER.md must contain exactly one next-action marker; found $nextActionCount." }
$catalogue = $artifactBodies['00b-technical-design/01-command-query-and-dto-catalogue.md']
$commandIds = @([regex]::Matches($catalogue, '\bC(?:0[1-9]|[12][0-9]|30)\b') | ForEach-Object Value | Sort-Object -Unique)
$queryIds = @([regex]::Matches($catalogue, '\bQ(?:0[1-9]|1[01])\b') | ForEach-Object Value | Sort-Object -Unique)
if ($commandIds.Count -ne 30 -or $queryIds.Count -ne 11) { Write-Error "WU0B catalogue coverage mismatch: commands=$($commandIds.Count), queries=$($queryIds.Count)." }
$requiredCategoryChecks = @{
    '00b-technical-design/00-overview-authority-and-file-map.md' = @('## 4. Internal component boundary map', '## 5. Exact proposed later implementation file allowlist', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN')
    '00b-technical-design/01-command-query-and-dto-catalogue.md' = @('## 2. Command catalogue', '## 3. Query catalogue', '## 4. Per-operation boundary and traceability', '## 5. Requirement-to-operation traceability', '## 6. DTO projection inventory', '## 7. Stable error-to-HTTP catalogue', '## 8. Rate and abuse classes')
    '00b-technical-design/02-authorization-tenancy-and-privacy.md' = @('## 2. Actor and tenancy matrix', '## 4. Grant design target', '## 6. Event and telemetry positive allowlist', '## 7. Forbidden-field matrix')
    '00b-technical-design/03-state-transactions-idempotency-and-publication.md' = @('## 1. Authoritative persisted-state mapping', '## 2. Authoritative transition matrix', '## 3. Transaction boundaries', '## 4. Optimistic concurrency and idempotency', 'committed_publication_failed')
    '00b-technical-design/04-jobs-providers-and-media-boundaries.md' = @('## 1. Persistent job contract', 'FOR UPDATE SKIP LOCKED', '## 4. Adapter interfaces', '## 5. Media validation and capability boundaries')
    '00b-technical-design/05-marketplace-and-request-photo-design.md' = @('Q07 is a service-internal matching stage', 'Q08 consumes', '## 5. Request-photo aggregate', '## 9. Explicit Phase 7/8 exclusions')
    '00b-technical-design/06-red-tests-acceptance-and-handoff.md' = @('## 1. Red-test mapping', 'independently_approved', 'DB_AUDIT_REQUIRED_BEFORE_DATABASE_DESIGN', 'Perform the consolidated Risk-Based Phase 9 SDD analysis in a new session.')
}
$photoDesign = $artifactBodies['00b-technical-design/05-marketplace-and-request-photo-design.md']
$ownerConfirmationIndex = $photoDesign.IndexOf('C28 Owner confirms item; C30 creates/refreshes soft hold')
$customerAcceptanceIndex = $photoDesign.IndexOf('C17 accept or C18 decline')
if ($ownerConfirmationIndex -lt 0 -or $customerAcceptanceIndex -le $ownerConfirmationIndex -or
    -not $photoDesign.Contains('active unexpired matching soft hold') -or
    -not $photoDesign.Contains('Customer acceptance before Owner confirmation')) {
    Write-Error 'WU0B request-photo flow does not enforce Owner confirmation and an active soft hold before customer acceptance.'
}
$stateDesign = $artifactBodies['00b-technical-design/03-state-transactions-idempotency-and-publication.md']
$requiredPersistedStateMarkers = @(
    '| Session | `active`, `closing`, `closed`, `expired` |',
    '| Image input | `uploaded`, `validating`, `queued`, `processing`, `ready`, `failed`, `skipped` |',
    '| Candidate | `processing`, `ready`, `needs_review`, `possible_duplicate`, `failed`, `commit_in_progress`, `committed` |',
    '| Request photo | Owning Photo SDD values: `none`, `requested`, `uploading`, `provided`, `accepted`, `declined`, `unfulfilled`, `expired` |'
)
foreach ($marker in $requiredPersistedStateMarkers) {
    if (-not $stateDesign.Contains($marker)) {
        Write-Error "WU0B persisted-state mapping conflicts with or omits the Master/owning SDD marker: $marker"
    }
}
$semanticStateErrors = @(Get-Wu0bSemanticStateErrors -Bodies $artifactBodies)
if ($semanticStateErrors.Count -gt 0) { Write-Error "WU0B contains contradictory or unknown persisted-state claims: $($semanticStateErrors -join ', ')" }
$requiredHoldMarker = '| Holds | Phase 6 `hold_type=''soft''|''firm''`; persisted status is `active`, `released`, or `converted_to_sale` |'
if (-not $stateDesign.Contains($requiredHoldMarker)) { Write-Error 'WU0B hold mapping omits the exact Phase 6 persisted statuses.' }
if ($RunSemanticNegativeProbes) {
    $probeDomains = @(
        @{ D='session'; A='active'; X='archived'; E='UNKNOWN_SESSION_STATE' }, @{ D='input'; A='ready'; X='discarded'; E='UNKNOWN_IMAGE_INPUT_STATE' },
        @{ D='candidate'; A='ready'; X='archived'; E='UNKNOWN_CANDIDATE_STATE' }, @{ D='request-photo'; A='provided'; X='abandoned'; E='UNKNOWN_REQUEST_PHOTO_STATE' },
        @{ D='hold'; A='active'; X='expired'; E='UNKNOWN_HOLD_STATE' }
    )
    $probeForms = @('{D} persisted as {X}', '{D} persisted-as {X}', '{D} is-persisted-as {X}', '{D} becomes {X}', '{D} advances to {X}', '{D} advances into {X}', '{D} transitions to {X}', '{D} from {A} to {X}', '{D} from {A} into {X}', '{D} state: {A} -> {X}', '{D} (`{A}`) -> `{X}`', '{D} terminal is {X}', '{D} state is {X}', '{D} status is {X}', '{D} workflow is {X}', '{D} lifecycle is {X}', "{D}'s persisted state is {X}", '{D} from {A} -> {X}', '{D} from ({A}) -> ({X})', '{D} state = {X}', '{D} state: {X}')
    $probeCount = 0; $probeRelative = '00b-technical-design/03-state-transactions-idempotency-and-publication.md'
    foreach ($domain in $probeDomains) { foreach ($form in $probeForms) {
        $probeText = $form.Replace('{D}', $domain.D).Replace('{A}', $domain.A).Replace('{X}', $domain.X); $probeErrors = @(Get-Wu0bSemanticStateErrors -Bodies @{ $probeRelative = $probeText })
        if (($probeErrors -join '|') -notmatch $domain.E) { Write-Error "WU0B semantic matrix probe failed: $probeText" }; $probeCount++
    } }
    foreach ($special in @(@{ T='Request-photo status becomes unrequested'; E='PHOTO_UNKNOWN_STATE|UNKNOWN_REQUEST_PHOTO_STATE' }, @{ T='Candidate terminal status becomes skipped_false_detection'; E='CANDIDATE_DISPOSITION_AS_STATE|UNKNOWN_CANDIDATE_STATE' })) {
        if ((@(Get-Wu0bSemanticStateErrors -Bodies @{ $probeRelative = $special.T }) -join '|') -notmatch $special.E) { Write-Error "WU0B semantic special probe failed: $($special.T)" }; $probeCount++
    }
    Write-Output "SEMANTIC_NEGATIVE_MATRIX=PASS cases=$probeCount"
}
$boundaryStart = $catalogue.IndexOf('## 4. Per-operation boundary and traceability')
$boundaryEnd = $catalogue.IndexOf('## 5. Requirement-to-operation traceability')
if ($boundaryStart -lt 0 -or $boundaryEnd -le $boundaryStart) { Write-Error 'WU0B per-operation boundary section is missing.' }
$boundarySection = $catalogue.Substring($boundaryStart, $boundaryEnd - $boundaryStart)
$boundaryCodes = 'OE|CE|AE|PE|IE|RPC|WH|MQ'
foreach ($id in @($commandIds + $queryIds)) {
    $escapedId = [regex]::Escape($id)
    $row = [regex]::Match($boundarySection, "(?m)^\| $escapedId .*\|\r?$").Value
    $primaryBoundaryCount = @([regex]::Matches($row, "\| (?:$boundaryCodes);")).Count
    if ([string]::IsNullOrWhiteSpace($row) -or $primaryBoundaryCount -ne 1 -or
        $row -notmatch '(MAS|DAT|EXT|REV|MED|MKT|PHO)-' -or
        $row -notmatch '; [VAEGMRP/]+;' -or $row -notmatch 'RT-[A-Z0-9-]+' -or $row -notmatch '; U(?:[1-9]|10|11)') {
        Write-Error "WU0B operation $id lacks a selected boundary, SDD/WU0A trace, red test, or future unit."
    }
}
$c12BoundaryRow = [regex]::Match($boundarySection, '(?m)^\| C12 .*\|\r?$').Value
$q11BoundaryRow = [regex]::Match($boundarySection, '(?m)^\| Q11 .*\|\r?$').Value
if ($c12BoundaryRow -notmatch '\| AE;' -or $c12BoundaryRow -notmatch 'Owner path:' -or
    $c12BoundaryRow -notmatch 'worker path:' -or $c12BoundaryRow -notmatch 'mixed/unknown denied' -or
    $c12BoundaryRow -notmatch 'image-inventory-publication-retry/index\.ts' -or $c12BoundaryRow -notmatch 'one shared publication-retry service') {
    Write-Error 'WU0B C12 does not define one shared boundary with closed Owner and claimed-worker authorization paths.'
}
if ($q11BoundaryRow -notmatch '\| AE;' -or $q11BoundaryRow -notmatch 'Customer path:' -or
    $q11BoundaryRow -notmatch 'Owner path:' -or $q11BoundaryRow -notmatch 'mixed/unknown denied') {
    Write-Error 'WU0B Q11 does not define one shared boundary with separate customer and Owner authorization/projection paths.'
}
$overviewDesign = $artifactBodies['00b-technical-design/00-overview-authority-and-file-map.md']
if ($overviewDesign -notmatch 'C12 shared publication-retry boundary.*image-inventory-publication-retry/index\.ts' -or
    $overviewDesign -notmatch 'Owner and worker boundaries do not implement C12') {
    Write-Error 'WU0B exact future-file map does not assign C12 to one dedicated shared boundary.'
}
if ($RunSemanticNegativeProbes) {
    if ($c12BoundaryRow.Replace('image-inventory-publication-retry/index.ts', 'image-inventory-owner/index.ts') -match 'image-inventory-publication-retry/index\.ts') { Write-Error 'C12 boundary-owner negative probe failed.' }
    if ($overviewDesign.Replace('Owner and worker boundaries do not implement C12', 'Owner and worker boundaries may implement C12') -match 'Owner and worker boundaries do not implement C12') { Write-Error 'C12 duplicate-owner negative probe failed.' }
    Write-Output 'BOUNDARY_NEGATIVE_PROBE_C12_EXACT_OWNER=PASS'; Write-Output 'BOUNDARY_NEGATIVE_PROBE_C12_NO_DUPLICATION=PASS'
}
$redDesign = $artifactBodies['00b-technical-design/06-red-tests-acceptance-and-handoff.md']
$redRows = @([regex]::Matches($redDesign, '(?m)^\| RT-[A-Z0-9-]+ \|.*\|\r?$') | ForEach-Object Value)
foreach ($row in $redRows) {
    if ($row -notmatch '(MAS|DAT|EXT|REV|MED|MKT|PHO)-|DOC-6 §' -or
        $row -notmatch '\| U(?:[1-9]|10|11)(?:/U(?:[1-9]|10|11))* \|\r?$') {
        Write-Error "WU0B red-test row lacks an owning SDD requirement or future implementation unit: $row"
    }
}
$referencedRedIds = @([regex]::Matches($boundarySection, 'RT-[A-Z0-9-]+') | ForEach-Object Value | Sort-Object -Unique)
$definedRedIds = @($redRows | ForEach-Object { [regex]::Match($_, 'RT-[A-Z0-9-]+').Value } | Sort-Object -Unique)
$missingRedOwners = @($referencedRedIds | Where-Object { $_ -notin $definedRedIds })
if ($missingRedOwners.Count -gt 0) { Write-Error "WU0B operation red tests lack detailed ownership rows: $($missingRedOwners -join ', ')." }
foreach ($relative in $requiredCategoryChecks.Keys) {
    if ($artifactBodies[$relative] -notmatch '(?m)^\*\*Status:\*\* `independently_approved`\r?$') { Write-Error "WU0B artifact $relative is not independently approved." }
    foreach ($marker in $requiredCategoryChecks[$relative]) {
        if (-not $artifactBodies[$relative].Contains($marker)) {
            Write-Error "WU0B artifact $relative is missing required category marker: $marker"
        }
    }
}
$allWu0bText = $wu0bPlan + "`n" + (($artifactBodies.Values) -join "`n")
if ($allWu0bText -match '(?im)^\*\*(?:Status|Implementation status):\*\* `implementation_complete_needs_review`\s*$' -or
    $allWu0bText -match '(?i)\b(?:Supabase audit|migration-file creation|live migration application|runtime implementation) (?:is|are) authorized\b' -or
    $allWu0bText -match '(?i)\bMigration(?:-file)? creation and (?:live )?(?:migration )?application (?:are|is)\s+(?:jointly |together )?authorized\b') {
    Write-Error 'WU0B artifacts contain a stale review status or later authority.'
}
$laterGates = @(
    '1. Independent WU0B technical-design review - complete 2026-07-22.', '2. Fresh exact-project read-only Supabase schema/security/storage audit.',
    '3. Exact database and migration design.', '4. Migration-file creation.', '5. Isolated migration testing.',
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
if (-not $wu0bPlan.Contains('Migration creation and live application can never share one authorization.')) { Write-Error 'WU0B definition does not keep migration creation and application separately gated.' }
$agents = [IO.File]::ReadAllText((Join-Path $repoRoot 'AGENTS.md'))
if (-not $agents.Contains('phase-9-image-inventory/SESSION-START.md')) { Write-Error 'Repository AGENTS.md does not point to the Phase 9 session entrypoint.' }
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
if (-not $phaseReadme.Contains('**Status:** `package1_m01_m08_independently_approved_not_applied`') -or
    -not $phaseReadme.Contains('M01-M08 and their isolated database/security harness are locally complete') -or
    -not $phaseReadme.Contains('none was applied to connected Supabase')) {
    Write-Error 'Phase 9 README disagrees with the independently approved, unapplied M01-M08 milestone.'
}
$master = [IO.File]::ReadAllText((Join-Path $phaseRoot '00-phase-9-master-sdd.md'))
if (-not $master.Contains('Documentation and development-session continuity')) { Write-Error 'Master SDD is missing the continuity contract.' }

$markdownFiles = @(Get-ChildItem -LiteralPath $phaseRoot -Recurse -Filter '*.md')
$extraMarkdownPaths = @((Join-Path $repoRoot 'AGENTS.md'), (Join-Path $implementationRoot 'ACTIVE.md'),
    (Join-Path $implementationRoot 'README.md'), (Join-Path $marketplaceRoot 'README.md'),
    (Join-Path $marketplaceRoot 'DOC-13-implementation-tracker.md'))
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
if ($brokenLinks.Count -gt 0) { Write-Error ("Broken local links:`n" + ($brokenLinks -join "`n")) }

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
