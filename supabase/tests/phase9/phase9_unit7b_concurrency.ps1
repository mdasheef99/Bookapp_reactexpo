param([Parameter(Mandatory=$true)][string]$DatabaseUrl)
$ErrorActionPreference = 'Stop'

function Invoke-Psql([string]$Sql) {
  $output = & psql $DatabaseUrl -X -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
  return ($output -join "`n")
}
function Actor-Sql([string]$Actor, [string]$Sql) {
  return "select set_config('request.jwt.claim.sub','$Actor',false);" +
    "select set_config('request.jwt.claim.role','authenticated',false);" +
    "set role authenticated;$Sql"
}
function Service-Sql([string]$Sql) {
  return "select set_config('request.jwt.claim.sub','',false);" +
    "select set_config('request.jwt.claim.role','service_role',false);" +
    "set role service_role;$Sql"
}
function Start-PsqlJob([string]$Sql) {
  return Start-Job -ScriptBlock {
    param($url,$statement)
    $output = & psql $url -X -v ON_ERROR_STOP=1 -Atc $statement 2>&1
    [pscustomobject]@{ ExitCode=$LASTEXITCODE; Output=($output -join "`n") }
  } -ArgumentList $DatabaseUrl,$Sql
}
function Wait-AdvisorySignal([int]$Key) {
  for ($attempt=0; $attempt -lt 100; $attempt+=1) {
    $held = Invoke-Psql "select count(*) from pg_locks where locktype='advisory'
      and classid=0 and objid=$Key and granted and pid<>pg_backend_pid();"
    if ([int]$held -gt 0) { return }
    Start-Sleep -Milliseconds 25
  }
  throw "advisory signal $Key was not acquired"
}
function Complete-BarrierRace([string]$Name,[int]$Key,[string]$SqlA,[string]$SqlB) {
  $blocker = Start-PsqlJob "begin;select pg_advisory_xact_lock($Key);select pg_sleep(1);commit;"
  Wait-AdvisorySignal $Key
  $a = Start-PsqlJob "begin;select pg_advisory_xact_lock_shared($Key);$SqlA commit;"
  $b = Start-PsqlJob "begin;select pg_advisory_xact_lock_shared($Key);$SqlB commit;"
  $results = @(Receive-Job -Wait $a; Receive-Job -Wait $b)
  $blockerResult = Receive-Job -Wait $blocker
  Remove-Job $a,$b,$blocker -Force
  if ($blockerResult.ExitCode -ne 0 -or $results.Count -ne 2) {
    throw "$Name concurrency barrier failed"
  }
  return $results
}
function Assert-OneSuccess([string]$Name,$Results,[string]$FailurePattern) {
  if (@($Results | Where-Object ExitCode -eq 0).Count -ne 1) {
    throw "$Name did not produce exactly one successful writer: $($Results | ConvertTo-Json -Compress)"
  }
  if (($Results | Where-Object ExitCode -ne 0).Output -notmatch $FailurePattern) {
    throw "$Name returned an unexpected failure: $($Results | ConvertTo-Json -Compress)"
  }
}

$store = '7b000000-0000-4000-8000-000000000001'
$owner = '7b000000-0000-4000-8000-000000000002'
$inventory = '7b000000-0000-4000-8000-000000000003'
$inventoryReplay = '7b000000-0000-4000-8000-000000000004'
$inventoryPause = '7b000000-0000-4000-8000-000000000005'
$job = '7b000000-0000-4000-8000-000000000006'
$commandA = '7b000000-0000-4000-8000-000000000007'
$commandB = '7b000000-0000-4000-8000-000000000008'
$inventoryAuth = '7b000000-0000-4000-8000-000000000009'
$locality = '7b000000-0000-4000-8000-000000000010'
$inventoryLimitA = '7b000000-0000-4000-8000-000000000011'
$inventoryLimitB = '7b000000-0000-4000-8000-000000000012'

Invoke-Psql @"
delete from public.phase9_idempotency_keys where actor_or_service='$owner';
delete from public.marketplace_events where entity_id in ('$inventory','$inventoryReplay','$inventoryPause','$inventoryAuth','$inventoryLimitA','$inventoryLimitB');
delete from public.marketplace_audit_logs where entity_id in ('$inventory','$inventoryReplay','$inventoryPause','$inventoryAuth','$inventoryLimitA','$inventoryLimitB');
delete from public.image_extraction_jobs where store_id='$store';
delete from public.marketplace_book_listings where store_id='$store';
delete from public.store_inventory where store_id='$store';
delete from public.store_administrators where store_id='$store';
delete from public.store_subscriptions where store_id='$store';
delete from public.store_entitlements where store_id='$store';
delete from public.marketplace_policy_config where store_id='$store' or policy_key='marketplace_enabled';
delete from public.stores where id='$store';
delete from public.marketplace_localities where id='$locality';
insert into public.marketplace_localities(id,name,is_pilot_enabled)
values('$locality','Unit 7B Concurrency',true);
insert into public.stores(id,display_name,status,verification_status,setup_status,selling_status,locality_id,city)
values('$store','Unit 7B concurrency','active','approved','complete','allowed','$locality','Pune');
insert into public.store_administrators(store_id,user_id,role,status)
values('$store','$owner','owner','active');
insert into public.store_subscriptions(store_id,status) values('$store','trialing');
insert into public.store_entitlements(store_id,feature_key,limit_value,is_enabled)
values('$store','active_listing_limit',100,true);
insert into public.marketplace_policy_config(
  policy_key,scope_type,store_id,value,value_type,policy_version,is_active,effective_from
) values
('marketplace_enabled','global',null,'true','boolean',1,true,transaction_timestamp()-interval '1 day'),
('commerce.store_allowlisted','store','$store','true','boolean',1,true,transaction_timestamp()-interval '1 day');
insert into public.store_inventory(
  id,store_id,title,authors,language,condition,selling_price_minor,
  quantity_total,quantity_available,visibility_status,publication_status,
  publication_intent_version,version,is_sellable,has_damage,listing_quality_status,
  entry_method,created_by
) values
('$inventory','$store','Version race',array['Author'],'en','good',725,3,3,
 'draft','private',1,1,true,false,'ready','manual','$owner'),
('$inventoryReplay','$store','Replay race',array['Author'],'en','good',725,3,3,
 'draft','private',1,1,true,false,'ready','manual','$owner'),
('$inventoryPause','$store','Pause race',array['Author'],'en','good',725,3,3,
 'draft','publication_failed',2,1,true,false,'ready','manual','$owner'),
('$inventoryAuth','$store','Authorization race',array['Author'],'en','good',725,3,3,
 'draft','publication_failed',2,1,true,false,'ready','manual','$owner'),
('$inventoryLimitA','$store','Limit race A',array['Author'],'en','good',725,3,3,
 'draft','private',1,1,true,false,'ready','manual','$owner'),
('$inventoryLimitB','$store','Limit race B',array['Author'],'en','good',725,3,3,
 'draft','private',1,1,true,false,'ready','manual','$owner');
"@

try {
  # DOC-2 §10.3: store-row serialization makes active-listing admission
  # race-safe across different inventory rows.
  Invoke-Psql "update public.store_entitlements set limit_value=1
    where store_id='$store' and feature_key='active_listing_limit';"
  $limitA = Actor-Sql $owner "select public.phase9_set_publication_state_v2(
    '$inventoryLimitA',1,1,'publish','u7b-limit-race-a01','$commandA');"
  $limitB = Actor-Sql $owner "select public.phase9_set_publication_state_v2(
    '$inventoryLimitB',1,1,'publish','u7b-limit-race-b01','$commandB');"
  $limitRace = Complete-BarrierRace 'U7B active listing limit race' 73001 $limitA $limitB
  Assert-OneSuccess 'U7B active listing limit race' $limitRace 'P9_PUBLICATION_INELIGIBLE'
  if ((Invoke-Psql "select count(*) from public.marketplace_book_listings
    where store_id='$store' and status='active';") -ne '1') {
    throw 'U7B active listing limit admitted more than one listing'
  }
  Invoke-Psql "delete from public.marketplace_book_listings where inventory_id in
    ('$inventoryLimitA','$inventoryLimitB'); update public.store_inventory
    set visibility_status='draft',publication_status='private',publication_intent_version=1
    where id in ('$inventoryLimitA','$inventoryLimitB'); update public.store_entitlements
    set limit_value=100 where store_id='$store' and feature_key='active_listing_limit';"

  # U7B-RT05: both inventory and publication-intent versions are rechecked
  # under the row lock, so equal stale requests cannot both publish.
  $publishA = Actor-Sql $owner "select public.phase9_set_publication_state_v2(
    '$inventory',1,1,'publish','u7b-version-race-a01','$commandA');"
  $publishB = Actor-Sql $owner "select public.phase9_set_publication_state_v2(
    '$inventory',1,1,'publish','u7b-version-race-b01','$commandB');"
  $versionRace = Complete-BarrierRace 'U7B-RT05 dual-version race' 73005 $publishA $publishB
  Assert-OneSuccess 'U7B-RT05 dual-version race' $versionRace 'P9_VERSION_CONFLICT'
  $versionState = Invoke-Psql "select publication_intent_version||'|'||
    (select count(*) from public.marketplace_book_listings l where l.inventory_id=i.id)
    from public.store_inventory i where i.id='$inventory';"
  if ($versionState -ne '2|1') { throw "U7B-RT05 invalid final state $versionState" }

  # U7B-RT07: concurrent response-loss replay blocks on the idempotency row,
  # returns the same canonical response twice, and creates one business effect.
  $exact = Actor-Sql $owner "select public.phase9_set_publication_state_v2(
    '$inventoryReplay',1,1,'publish','u7b-exact-replay-01','$commandA');"
  $replayRace = Complete-BarrierRace 'U7B-RT07 exact replay race' 73007 $exact $exact
  if ((@($replayRace | Where-Object ExitCode -ne 0).Count -ne 0) -or
      (($replayRace.Output | Sort-Object -Unique).Count -ne 1)) {
    throw "U7B-RT07 replay was not canonical: $($replayRace | ConvertTo-Json -Compress)"
  }
  $effects = Invoke-Psql "select
    (select count(*) from public.marketplace_book_listings where inventory_id='$inventoryReplay')||'|'||
    (select count(*) from public.marketplace_audit_logs where entity_id='$inventoryReplay')||'|'||
    (select count(*) from public.marketplace_events where entity_id='$inventoryReplay');"
  if ($effects -ne '1|1|1') { throw "U7B-RT07 duplicated effects $effects" }

  # U7B-RT12: claim intent 2, then commit pause intent 3 while the worker is
  # waiting. The stale leased worker must fail after the Owner lock releases.
  Invoke-Psql "insert into public.image_extraction_jobs(
    id,store_id,entity_type,entity_id,job_kind,status,dedupe_key,operation_version
  ) values('$job','$store','store_inventory','$inventoryPause','publication_retry',
    'open','publication_retry:${inventoryPause}:2','2');"
  $claimJson = Invoke-Psql (Service-Sql "select row_to_json(c) from
    public.claim_phase9_publication_jobs(1,'publication-worker-race-01') c;")
  $claim = $claimJson.Split("`n")[-1] | ConvertFrom-Json
  if ($claim.job_id -ne $job -or -not $claim.lease_token) { throw 'U7B-RT12 claim failed' }
  $pause = Actor-Sql $owner "begin;select public.phase9_set_publication_state_v2(
    '$inventoryPause',1,2,'pause','u7b-pause-race-0001','$commandB');select pg_sleep(1);commit;"
  $pauseJob = Start-PsqlJob $pause
  Start-Sleep -Milliseconds 200
  $workerSql = Service-Sql "select public.phase9_retry_publication_worker_v1(
    '$inventoryPause',2,'$job','$($claim.lease_token)',1,'publication-worker-race-01',
    'u7b-worker-race-0001','$commandA');"
  $workerJob = Start-PsqlJob $workerSql
  $pauseResult = Receive-Job -Wait $pauseJob
  $workerResult = Receive-Job -Wait $workerJob
  Remove-Job $pauseJob,$workerJob -Force
  if (($pauseResult.ExitCode -ne 0) -or ($workerResult.ExitCode -eq 0) -or
      ($workerResult.Output -notmatch 'P9_(STATE|VERSION)_CONFLICT')) {
    throw "U7B-RT12 stale leased worker was not fenced: $($pauseResult,$workerResult | ConvertTo-Json -Compress)"
  }
  $pauseState = Invoke-Psql "select visibility_status||'|'||publication_intent_version||'|'||
    (select count(*) from public.marketplace_book_listings where inventory_id='$inventoryPause'
      and status='active')
    from public.store_inventory where id='$inventoryPause';"
  if ($pauseState -ne 'paused|3|0') { throw "U7B-RT12 invalid final state $pauseState" }

  # U7B owner retry reauthorization: the caller passes the pre-lock check, then
  # loses active membership while waiting for the inventory lock. The under-lock
  # check must reject before eligibility/projection/idempotency effects.
  $authBlocker = Start-PsqlJob "begin;select * from public.store_inventory
    where id='$inventoryAuth' for update;select pg_advisory_xact_lock(73013);
    select pg_sleep(1);update public.store_administrators set status='inactive'
    where store_id='$store' and user_id='$owner';commit;"
  Wait-AdvisorySignal 73013
  $authRetry = Start-PsqlJob (Actor-Sql $owner "select public.phase9_retry_publication_owner_v1(
    '$inventoryAuth',2,'u7b-owner-auth-race-01','$commandA');")
  $authBlockerResult = Receive-Job -Wait $authBlocker
  $authRetryResult = Receive-Job -Wait $authRetry
  Remove-Job $authBlocker,$authRetry -Force
  if ($authBlockerResult.ExitCode -ne 0 -or $authRetryResult.ExitCode -eq 0 -or
      $authRetryResult.Output -notmatch 'P9_OWNER_NOT_AUTHORIZED') {
    throw "U7B owner retry did not reauthorize under lock: $($authBlockerResult,$authRetryResult | ConvertTo-Json -Compress)"
  }
  $authEffects = Invoke-Psql "select
    (select count(*) from public.marketplace_book_listings where inventory_id='$inventoryAuth')||'|'||
    (select count(*) from public.marketplace_audit_logs where entity_id='$inventoryAuth')||'|'||
    (select count(*) from public.marketplace_events where entity_id='$inventoryAuth')||'|'||
    (select count(*) from public.phase9_idempotency_keys where idempotency_key='u7b-owner-auth-race-01');"
  if ($authEffects -ne '0|0|0|0') { throw "U7B owner authorization race left effects $authEffects" }
  Invoke-Psql "update public.store_administrators set status='active'
    where store_id='$store' and user_id='$owner';"

  Write-Output 'U7B PostgreSQL concurrency: active-listing admission, RT05, RT07, RT12, owner retry reauthorization passed.'
}
finally {
  Invoke-Psql @"
delete from public.phase9_idempotency_keys where actor_or_service='$owner';
delete from public.marketplace_events where entity_id in ('$inventory','$inventoryReplay','$inventoryPause','$inventoryAuth','$inventoryLimitA','$inventoryLimitB');
delete from public.marketplace_audit_logs where entity_id in ('$inventory','$inventoryReplay','$inventoryPause','$inventoryAuth','$inventoryLimitA','$inventoryLimitB');
delete from public.image_extraction_jobs where store_id='$store';
delete from public.marketplace_book_listings where store_id='$store';
delete from public.store_inventory where store_id='$store';
delete from public.store_administrators where store_id='$store';
delete from public.stores where id='$store';
"@
}
