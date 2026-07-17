param([Parameter(Mandatory=$true)][string]$DatabaseUrl)
$ErrorActionPreference = 'Stop'

function Invoke-Psql([string]$Sql) {
  $output = & psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -Atc $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed" }
  return $output
}
function Assert-NoOverlap([string]$Name, [string[]]$Rows) {
  $duplicates = $Rows | Group-Object | Where-Object Count -gt 1
  if ($duplicates) { throw "$Name returned duplicate task ids" }
}
function Assert-OneRecovery([string]$Name, [string[]]$Rows) {
  if (($Rows | Sort-Object -Unique).Count -ne 1) { throw "$Name did not recover exactly one lease" }
}

$ownerA = [guid]::NewGuid().ToString()
$ownerB = [guid]::NewGuid().ToString()
$claimSql = "select id from public.claim_phase6_tasks('$ownerA',50)"
$jobA = Start-Job -ScriptBlock { param($url,$sql) & psql $url -X -v ON_ERROR_STOP=1 -Atc $sql } -ArgumentList $DatabaseUrl,$claimSql
$jobB = Start-Job -ScriptBlock { param($url,$owner) & psql $url -X -v ON_ERROR_STOP=1 -Atc "select id from public.claim_phase6_tasks('$owner',50)" } -ArgumentList $DatabaseUrl,$ownerB
$rows = @(Receive-Job -Wait $jobA; Receive-Job -Wait $jobB) | Where-Object { $_ }
Assert-NoOverlap 'concurrent-claims' $rows

# Harness fixtures must expire one claimed lease before this recovery assertion.
$recovery = @(Invoke-Psql "select id from public.claim_phase6_tasks('$ownerA',1)")
Assert-OneRecovery 'expired-lease' $recovery
