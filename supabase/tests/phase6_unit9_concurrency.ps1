param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [string]$Psql = 'psql'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$fixture = Join-Path $root 'phase6_unit9_integration.sql'
$cleanup = Join-Path $root 'phase6_unit9_cleanup.sql'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('phase6-unit9-' + [guid]::NewGuid())
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
    if ($wins -ne 1) { throw "$Label expected exactly one winner; exits $($a.ExitCode),$($b.ExitCode)" }
}

try {
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-v' 'fixture_only=true' '-f' $fixture
    if ($LASTEXITCODE -ne 0) { throw 'Unit 9 fixture setup failed' }

    $customer = "BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);"
    Assert-One-Winner 'cancel-vs-accept' `
        ($customer + "SELECT public.accept_confirmed_changes('96000000-0000-0000-0000-000000000001',1,NULL,'race-accept-0001','9b000000-0000-0000-0000-000000000001'); COMMIT;") `
        ($customer + "SELECT public.cancel_order_request('96000000-0000-0000-0000-000000000001',1,'customer_requested','race-cancel-0001','9b000000-0000-0000-0000-000000000002'); COMMIT;")

    $service = "BEGIN; SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true);"
    Assert-One-Winner 'accept-vs-decision-expiry' `
        ($customer + "SELECT public.accept_confirmed_changes('96000000-0000-0000-0000-000000000002',1,NULL,'race-late-accept','9b000000-0000-0000-0000-000000000003'); COMMIT;") `
        ($service + "SELECT public.expire_customer_decision('96000000-0000-0000-0000-000000000002',1,'race-decision-expiry','9b000000-0000-0000-0000-000000000004'); COMMIT;")

    $claimLock = "BEGIN; SELECT id FROM public.store_order_requests WHERE id='96000000-0000-0000-0000-000000000003' FOR UPDATE; SELECT pg_sleep(2); COMMIT;"
    $claim = Start-Psql 'future-claim-lock' $claimLock
    Start-Sleep -Milliseconds 200
    $expiry = Start-Psql 'payment-expiry' ($service + "SELECT public.expire_payment_ready('96000000-0000-0000-0000-000000000003',1,'race-payment-expiry','9b000000-0000-0000-0000-000000000005'); COMMIT;")
    $claim.WaitForExit(); $expiry.WaitForExit()
    if ($claim.ExitCode -ne 0 -or $expiry.ExitCode -ne 0) {
        throw "payment-ready expiry/future-claim boundary failed; exits $($claim.ExitCode),$($expiry.ExitCode)"
    }
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-c' "SELECT CASE WHEN count(*)=1 THEN 1 ELSE 1/0 END FROM public.commerce_transition_log WHERE entity_id='96000000-0000-0000-0000-000000000003' AND command_name='expire_payment_ready';"
    if ($LASTEXITCODE -ne 0) { throw 'payment-ready expiry evidence count failed' }
}
finally {
    & $Psql $DatabaseUrl '-v' 'ON_ERROR_STOP=1' '-f' $cleanup
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
