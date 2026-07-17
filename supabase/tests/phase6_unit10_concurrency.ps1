param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [string]$Psql = 'psql'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$unit9Fixture = Join-Path $root 'phase6_unit9_integration.sql'
$unit10Fixture = Join-Path $root 'phase6_unit10_integration.sql'
$cleanup = Join-Path $root 'phase6_unit10_cleanup.sql'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('phase6-unit10-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null

function Start-Psql([string]$Name, [string]$Sql) {
    $stdout = Join-Path $temp ($Name + '.out')
    $stderr = Join-Path $temp ($Name + '.err')
    Start-Process -FilePath $Psql -WindowStyle Hidden -PassThru `
        -ArgumentList @($DatabaseUrl, '-v', 'ON_ERROR_STOP=1', '-c', $Sql) `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
function Assert-One-Winner([string]$Label, [string]$First, [string]$Second) {
    $a = Start-Psql ($Label + '-a') $First
    $b = Start-Psql ($Label + '-b') $Second
    $a.WaitForExit(); $b.WaitForExit()
    $wins = (@($a.ExitCode, $b.ExitCode) | Where-Object { $_ -eq 0 }).Count
    if ($wins -ne 1) { throw "$Label expected one winner; exits $($a.ExitCode),$($b.ExitCode)" }
}

try {
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-v' 'fixture_only=true' '-f' $unit9Fixture
    if ($LASTEXITCODE -ne 0) { throw 'Unit 9 fixture setup failed' }
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-v' 'fixture_only=true' '-f' $unit10Fixture
    if ($LASTEXITCODE -ne 0) { throw 'Unit 10 fixture setup failed' }

    $service = "BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true);"
    $customer = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);"
    Assert-One-Winner 'pause-vs-accept' `
        ($service + "SELECT public.pause_for_emergency_closure('96000000-0000-0000-0000-000000000001',1,'9c000000-0000-0000-0000-000000000001','race-pause-accept','9e000000-0000-0000-0000-000000000001'); COMMIT;") `
        ($customer + "SELECT public.accept_confirmed_changes('96000000-0000-0000-0000-000000000001',1,NULL,'race-accept-pause','9e000000-0000-0000-0000-000000000002'); COMMIT;")

    Assert-One-Winner 'pause-vs-expiry' `
        ($service + "SELECT public.pause_for_emergency_closure('96000000-0000-0000-0000-000000000002',1,'9c000000-0000-0000-0000-000000000001','race-pause-expiry','9e000000-0000-0000-0000-000000000003'); COMMIT;") `
        ($service + "SELECT public.expire_customer_decision('96000000-0000-0000-0000-000000000002',1,'race-expiry-pause','9e000000-0000-0000-0000-000000000004'); COMMIT;")

    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-c' "SELECT CASE WHEN quantity_available+quantity_reserved=quantity_total THEN 1 ELSE 1/0 END FROM public.store_inventory WHERE id IN ('93000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002');"
    if ($LASTEXITCODE -ne 0) { throw 'closure race caused inventory drift' }
}
finally {
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-f' $cleanup
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
