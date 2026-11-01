# SESSION-START §8: validate the recorded local set without weakening its guard.
$ErrorActionPreference = 'Stop'
$phaseRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../../..')).Path
$tracker = [IO.File]::ReadAllText((Join-Path $phaseRoot 'TRACKER.md'))

# The real checkout is the positive case; the validator's own arrays feed the
# negative cases so these exercise its actual implementation and current list.
. (Join-Path $PSScriptRoot 'validate-phase9-migration-set.ps1') `
    -repoRoot $repoRoot -phaseRoot $phaseRoot -tracker $tracker

function Assert-MigrationSetRefused([string]$name, [scriptblock]$probe) {
    try { & $probe } catch {
        if ($_.Exception.Message -notlike 'PHASE9_MIGRATION_SET_INVALID*') { throw }
        Write-Output "PASS $name"
        return
    }
    throw "Migration set guard accepted $name"
}

$allNames = @($phase9Migrations.Name)
$unknown = '20991010000093_marketplace_phase9_unapproved.sql'
Assert-MigrationSetRefused 'unexpected migration' {
    Assert-Phase9MigrationSet -ExpectedNames $expectedMigrationNames -ActualNames $actualMigrationNames `
        -AllNames @($allNames + $unknown) -DraftNames $draftMigrationNames
}
Assert-MigrationSetRefused 'missing migration' {
    Assert-Phase9MigrationSet -ExpectedNames $expectedMigrationNames -ActualNames @($actualMigrationNames | Select-Object -Skip 1) `
        -AllNames @($allNames | Select-Object -Skip 1) -DraftNames $draftMigrationNames
}
$duplicate = '20991010000092_marketplace_phase9_duplicate.sql'
Assert-MigrationSetRefused 'duplicate migration number' {
    Assert-Phase9MigrationSet -ExpectedNames @($expectedMigrationNames + $duplicate) `
        -ActualNames @($actualMigrationNames + $duplicate) -AllNames @($allNames + $duplicate) `
        -DraftNames @($draftMigrationNames + $duplicate)
}
$malformed = 'bad_marketplace_phase9.sql'
Assert-MigrationSetRefused 'malformed migration name' {
    Assert-Phase9MigrationSet -ExpectedNames @($expectedMigrationNames + $malformed) `
        -ActualNames @($actualMigrationNames + $malformed) -AllNames @($allNames + $malformed) `
        -DraftNames @($draftMigrationNames + $malformed)
}
Write-Output 'PASS current migration set'
