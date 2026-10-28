# Owner B1 / 02b sections 6.2, 11-12: exercise group aggregation without starting PostgreSQL.
param([string]$RunnerPath = (Join-Path $PSScriptRoot 'run-phase9-bookstore-first-postgres.ps1'))
$ErrorActionPreference = 'Stop'
$OnlyGroup = ''
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($RunnerPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw "Runner parse errors: $parseErrors" }
$groupFunction = $ast.Find({ param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-NativeGroup'
}, $true)
if (-not $groupFunction) { throw 'Runner must aggregate native groups through Invoke-NativeGroup' }
. ([scriptblock]::Create($groupFunction.Extent.Text))
$exitAssignment = $ast.Find({ param($node)
  $node -is [Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left.Extent.Text -eq '$exitCode' -and $node.Right.Extent.Text -match 'nativeGroups'
}, $true)
$summaryLoop = $ast.Find({ param($node)
  $node -is [Management.Automation.Language.ForEachStatementAst] -and
    $node.Variable.Extent.Text -eq '$group' -and $node.Condition.Extent.Text -eq '$nativeGroups'
}, $true)
if (-not $exitAssignment -or -not $summaryLoop) { throw 'Missing aggregated exit status or final summary' }

$nativeGroups = [Collections.Generic.List[object]]::new()
$output = @(Invoke-NativeGroup 'all-pass' {
  & node -e 'process.exit(0)'
  if ($LASTEXITCODE -ne 0) { throw 'unexpected native failure' }
  Write-Output 'EXISTING_ACCEPTANCE_PASS'
})
if ($output -notcontains 'EXISTING_ACCEPTANCE_PASS') { throw 'Existing success output was lost' }
if ($nativeGroups.Count -ne 1 -or -not $nativeGroups[0].Passed) { throw 'All-pass group was not recorded' }
. ([scriptblock]::Create($exitAssignment.Extent.Text))
$summary = @(& ([scriptblock]::Create($summaryLoop.Extent.Text)))
if ($exitCode -ne 0 -or ($summary -join ',') -ne 'NATIVE_GROUP all-pass PASS') {
  throw 'All-pass summary/exit semantics changed'
}

$nativeGroups.Clear()
$previousPort = $env:PHASE9_FIRST_SAVE_NATIVE_PORT
$errors = @()
$output = @(& {
  Invoke-NativeGroup 'native-failure' {
    try {
      $env:PHASE9_FIRST_SAVE_NATIVE_PORT = 'fixture-only'
      & node -e 'process.exit(7)'
      if ($LASTEXITCODE -ne 0) { throw 'synthetic native exit 7' }
      Write-Output 'FALSE_PASS'
    } finally { $env:PHASE9_FIRST_SAVE_NATIVE_PORT = $previousPort }
  }
  Invoke-NativeGroup 'exception-failure' { throw 'synthetic group exception' }
  Invoke-NativeGroup 'later-pass' {
    & node -e 'process.exit(0)'
    if ($LASTEXITCODE -ne 0) { throw 'unexpected later failure' }
    Write-Output 'LATER_ACCEPTANCE_PASS'
  }
} 2>&1)
$errors = @($output | Where-Object { $_ -is [Management.Automation.ErrorRecord] })
if ($errors.Count -ne 2) { throw "Expected two visible errors, got $($errors.Count)" }
if ($output -contains 'FALSE_PASS' -or $output -notcontains 'LATER_ACCEPTANCE_PASS') {
  throw 'A failing group hid a later group or printed a false success marker'
}
if (($nativeGroups.Name -join ',') -ne 'native-failure,exception-failure,later-pass' -or
    ($nativeGroups.Passed -join ',') -ne 'False,False,True') { throw 'Group results/order differ' }
if ($env:PHASE9_FIRST_SAVE_NATIVE_PORT -ne $previousPort) { throw 'Group finally did not restore environment' }
. ([scriptblock]::Create($exitAssignment.Extent.Text))
$summary = @(& ([scriptblock]::Create($summaryLoop.Extent.Text)))
if ($exitCode -ne 1 -or ($summary -join ',') -ne
    'NATIVE_GROUP native-failure FAIL,NATIVE_GROUP exception-failure FAIL,NATIVE_GROUP later-pass PASS') {
  throw 'Mixed group summary/exit semantics differ'
}
$OnlyGroup = 'lean-catalogue-local-hook'
$nativeGroups.Clear()
$output = @(& {
  Invoke-NativeGroup 'lean-catalogue-completion' { Write-Output 'UNSELECTED_GROUP_RAN' }
  Invoke-NativeGroup 'lean-catalogue-local-hook' { Write-Output 'SELECTED_GROUP_PASS' }
})
if ($output -contains 'UNSELECTED_GROUP_RAN' -or $output -notcontains 'SELECTED_GROUP_PASS' -or
    $nativeGroups.Count -ne 1 -or $nativeGroups[0].Name -ne $OnlyGroup -or -not $nativeGroups[0].Passed) {
  throw 'OnlyGroup must execute and aggregate only the selected native group'
}
. ([scriptblock]::Create($exitAssignment.Extent.Text))
if ($exitCode -ne 0) { throw 'Selected passing group must exit successfully' }
$nativeGroups.Clear()
$output = @(Invoke-NativeGroup $OnlyGroup { throw 'selected group failure' } 2>&1)
. ([scriptblock]::Create($exitAssignment.Extent.Text))
if ($exitCode -ne 1 -or $nativeGroups.Count -ne 1 -or $nativeGroups[0].Passed -or
    @($output | Where-Object { $_ -is [Management.Automation.ErrorRecord] }).Count -ne 1) {
  throw 'Selected failing group must preserve its error and failing exit status'
}
$nativeGroups.Clear()
$missingGroupGuard = $ast.Find({ param($node)
  $node -is [Management.Automation.Language.IfStatementAst] -and
    $node.Clauses[0].Item1.Extent.Text -eq '$OnlyGroup -and $nativeGroups.Count -eq 0'
}, $true)
if (-not $missingGroupGuard) { throw 'Unavailable OnlyGroup must fail instead of reporting zero-test success' }
$missingGroupError = $null
try { . ([scriptblock]::Create($missingGroupGuard.Extent.Text)) } catch { $missingGroupError = $_ }
if (-not $missingGroupError -or $missingGroupError -notmatch 'unavailable') { throw 'Missing native group must be reported' }
Write-Output 'NATIVE_GROUP_AGGREGATION_TEST_PASS: all-pass, mixed failures, environment restoration, summaries, exit status, OnlyGroup selection/failure/unavailable'
