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
function Start-PsqlJob([string]$Sql) {
  return Start-Job -ScriptBlock {
    param($url,$statement)
    $output = & psql $url -X -v ON_ERROR_STOP=1 -Atc $statement 2>&1
    [pscustomobject]@{ ExitCode=$LASTEXITCODE; Output=($output -join "`n") }
  } -ArgumentList $DatabaseUrl,$Sql
}
function Complete-Race([string]$Name, [string]$SqlA, [string]$SqlB) {
  $a = Start-PsqlJob $SqlA
  $b = Start-PsqlJob $SqlB
  $results = @(Receive-Job -Wait $a; Receive-Job -Wait $b)
  Remove-Job $a,$b -Force
  if ($results.Count -ne 2) { throw "$Name did not return two connection results" }
  return $results
}
function Wait-AdvisorySignal([int]$Key) {
  for ($attempt = 0; $attempt -lt 100; $attempt += 1) {
    $held = Invoke-Psql "select count(*) from pg_locks
      where locktype='advisory' and classid=0 and objid=$Key
        and granted and pid<>pg_backend_pid();"
    if ([int]$held -gt 0) { return }
    Start-Sleep -Milliseconds 25
  }
  throw "advisory signal $Key was not acquired"
}
function Complete-BarrierRace(
  [string]$Name, [int]$Key, [string]$SqlA, [string]$SqlB
) {
  $blocker = Start-PsqlJob "begin; select pg_advisory_xact_lock($Key);
    select pg_sleep(1); commit;"
  Wait-AdvisorySignal $Key
  $a = Start-PsqlJob "begin; select pg_advisory_xact_lock_shared($Key);$SqlA commit;"
  $b = Start-PsqlJob "begin; select pg_advisory_xact_lock_shared($Key);$SqlB commit;"
  $results = @(Receive-Job -Wait $a; Receive-Job -Wait $b)
  $blockerResult = Receive-Job -Wait $blocker
  Remove-Job $a,$b,$blocker -Force
  if ($blockerResult.ExitCode -ne 0) {
    throw "$Name barrier failed: $($blockerResult | ConvertTo-Json -Compress)"
  }
  if ($results.Count -ne 2) { throw "$Name did not return two connection results" }
  return $results
}
function Assert-OneSuccess([string]$Name, $Results, [string]$FailurePattern) {
  if (@($Results | Where-Object ExitCode -eq 0).Count -ne 1) {
    throw "$Name did not produce exactly one successful writer: $($Results | ConvertTo-Json -Compress)"
  }
  $failure = ($Results | Where-Object ExitCode -ne 0).Output
  if ($failure -notmatch $FailurePattern) {
    throw "$Name returned unexpected failure: $failure"
  }
}

$store = '99000000-0000-0000-0000-000000000001'
$owner = '99100000-0000-0000-0000-000000000001'
$session = '99200000-0000-0000-0000-000000000001'
$candidate = '99300000-0000-0000-0000-000000000001'
$candidate2 = '99300000-0000-0000-0000-000000000002'
$commandA = '99400000-0000-4000-8000-000000000001'
$commandB = '99400000-0000-4000-8000-000000000002'
$mediaSha = 'f' * 64
$review = '{"originalTitle":"Concurrent Book","authors":["Author"],"originalLanguage":"en","script":"Latn","metadataChoice":{"mode":"manual","selectionId":null},"quantity":1,"priceMinor":0,"baseCondition":"good","damageDisclosure":{"hasDamage":false,"damageTypes":[],"damageNote":null,"isSellable":true,"completeReadableSafe":true},"shelfLocation":"A1","notes":{"publicNote":null,"internalNote":null},"publicationIntent":"private","duplicateIntent":null,"originalFieldConfirmation":{"title":true,"authors":[true]},"candidateDisposition":"reviewed"}'
$reviewBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($review))
$reviewSql = "convert_from(decode('$reviewBase64','base64'),'UTF8')::jsonb"

Invoke-Psql @"
delete from public.phase9_idempotency_keys
where actor_or_service='$owner' and operation in ('U6C01','U6C02');
delete from public.image_extraction_candidates where session_id='$session';
delete from public.image_extraction_inputs where session_id='$session';
delete from public.media_assets where session_id='$session';
delete from public.image_extraction_sessions where id='$session';
delete from public.store_administrators where store_id='$store';
delete from public.stores where id='$store';
insert into public.stores(id,display_name) values('$store','Unit 6A concurrency');
insert into public.store_administrators(store_id,user_id,role,status)
values('$store','$owner','owner','active');
insert into public.image_extraction_sessions(
  id,store_id,created_by,status,selected_language,default_condition,
  default_location,default_quantity,default_publication)
values('$session','$store','$owner','active','en','good','A1',1,'private');
insert into public.image_extraction_candidates(
  id,session_id,store_id,candidate_index,observed_title,observed_authors,
  observed_language,state,metadata_revision)
values
('$candidate','$session','$store',1,'Observed',array['Author'],'en','needs_review',1),
('$candidate2','$session','$store',2,'Observed 2',array['Author'],'en','needs_review',1);
"@

try {
  # Two writers with one expected candidate version: one update, one stale.
  $writerA = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
    '$session','$candidate',1,1,$reviewSql,'concurrent-writer-01','$commandA');"
  $writerB = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
    '$session','$candidate',1,1,jsonb_set($reviewSql,'{originalTitle}',to_jsonb('Other'::text)),
    'concurrent-writer-02','$commandB');"
  $writerRace = Complete-BarrierRace 'candidate-version-race' 62001 $writerA $writerB
  Assert-OneSuccess 'candidate-version-race' $writerRace 'P9_CANDIDATE_VERSION_CONFLICT'

  # Concurrent exact retry returns the one canonical result twice.
  $exact = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
    '$session','$candidate2',1,1,$reviewSql,'concurrent-replay-01','$commandA');"
  $replayRace = Complete-BarrierRace 'exact-replay-race' 62002 $exact $exact
  if (@($replayRace | Where-Object ExitCode -ne 0).Count -ne 0) {
    throw "exact-replay-race failed: $($replayRace | ConvertTo-Json -Compress)"
  }
  if (($replayRace.Output | Sort-Object -Unique).Count -ne 1) {
    throw 'exact-replay-race did not return byte-identical responses'
  }

  # Same key with changed canonical request cannot become a second effect.
  Invoke-Psql "update public.image_extraction_candidates set
    owner_review_snapshot=null,review_disposition=null,review_ready=false,
    review_version=null,state='needs_review',version=1 where id='$candidate2';
    delete from public.phase9_idempotency_keys where actor_or_service='$owner'
      and operation='U6C01' and idempotency_key='concurrent-replay-01';"
  $changed = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
    '$session','$candidate2',1,1,jsonb_set($reviewSql,'{originalTitle}',to_jsonb('Changed'::text)),
    'concurrent-replay-01','$commandA');"
  $mismatchRace = Complete-BarrierRace 'changed-replay-race' 62003 $exact $changed
  Assert-OneSuccess 'changed-replay-race' $mismatchRace 'P9_IDEMPOTENCY_MISMATCH'

  # A metadata revision writer holds the candidate lock; the stale review must
  # observe the post-lock revision and fail without overwriting the snapshot.
  Invoke-Psql "update public.image_extraction_candidates set
    owner_review_snapshot=null,review_disposition=null,review_ready=false,
    review_version=null,state='needs_review',version=1,metadata_revision=1
    where id='$candidate2';
    delete from public.phase9_idempotency_keys where actor_or_service='$owner'
      and operation='U6C01' and idempotency_key='metadata-race-0001';"
  $metadataWriter = "begin; select id from public.image_extraction_candidates
    where id='$candidate2' for update; select pg_advisory_xact_lock(62004);
    select pg_sleep(1);
    update public.image_extraction_candidates set metadata_revision=2
    where id='$candidate2'; commit;"
  $staleMetadata = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
      '$session','$candidate2',1,1,$reviewSql,
      'metadata-race-0001','$commandA');"
  $metadataJob = Start-PsqlJob $metadataWriter
  Wait-AdvisorySignal 62004
  $staleJob = Start-PsqlJob $staleMetadata
  $metadataRace = @(Receive-Job -Wait $metadataJob; Receive-Job -Wait $staleJob)
  Remove-Job $metadataJob,$staleJob -Force
  if (($metadataRace.Output -join "`n") -notmatch 'P9_VERSION_CONFLICT') {
    throw "metadata-revision-race did not fence the stale review: $($metadataRace | ConvertTo-Json -Compress)"
  }

  # Close races a review and leaves only closed + reviewed staged state.
  Invoke-Psql "update public.image_extraction_candidates set
    owner_review_snapshot=null,review_disposition=null,review_ready=false,
    review_version=null,state='needs_review',version=1,metadata_revision=1
    where id='$candidate2';
    update public.image_extraction_sessions set status='active',version=1,
      closed_at=null where id='$session';
    delete from public.phase9_idempotency_keys where actor_or_service='$owner'
      and operation in ('U6C01','U6C02');"
  $reviewRaceSql = Actor-Sql $owner "select public.phase9_update_candidate_review_v2(
    '$session','$candidate2',1,1,$reviewSql,'close-review-race-01','$commandA');"
  $closeRaceSql = Actor-Sql $owner "select public.phase9_close_session_v2(
    '$session',1,'close-review-race-02','$commandB');"
  $closeReview = Complete-BarrierRace 'close-review-race' 62005 $reviewRaceSql $closeRaceSql
  if (($closeReview | Where-Object ExitCode -ne 0).Count -ne 0) {
    throw 'close-review-race did not preserve both permitted operations'
  }
  $final = Invoke-Psql "select status||'|'||c.state||'|'||
    coalesce(c.review_disposition,'') from public.image_extraction_sessions s
    join public.image_extraction_candidates c on c.session_id=s.id
    where s.id='$session' and c.id='$candidate2';"
  if ($final -ne 'closed|ready|reviewed') { throw "unexpected close/review result $final" }

  # Two distinct Close commands with the same expected version serialize to one
  # close and one safe stale/state conflict; the session advances only once.
  Invoke-Psql "update public.image_extraction_sessions set status='active',version=1,
    closed_at=null where id='$session';
    delete from public.phase9_idempotency_keys where actor_or_service='$owner'
      and operation='U6C02';"
  $closeA = Actor-Sql $owner "select public.phase9_close_session_v2(
    '$session',1,'concurrent-close-a01','$commandA');"
  $closeB = Actor-Sql $owner "select public.phase9_close_session_v2(
    '$session',1,'concurrent-close-b01','$commandB');"
  $closeRace = Complete-BarrierRace 'stale-close-race' 62006 $closeA $closeB
  Assert-OneSuccess 'stale-close-race' $closeRace 'P9_(VERSION|STATE)_CONFLICT'
  $closedVersion = Invoke-Psql "select status||'|'||version
    from public.image_extraction_sessions where id='$session';"
  if ($closedVersion -ne 'closed|2') {
    throw "stale-close-race advanced session incorrectly: $closedVersion"
  }

  # Close and upload completion share the session row lock. Exactly one wins,
  # and a closed session can never contain the newly inserted nonterminal input.
  Invoke-Psql "update public.image_extraction_sessions set status='active',version=1,
    closed_at=null where id='$session';
    delete from public.phase9_idempotency_keys where actor_or_service='$owner'
      and operation='U6C02';
    insert into public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
      detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    values('99600000-0000-0000-0000-000000000002','$store','$owner',
      'scan_input','private_scan','unit6a-concurrency','$session/close-race-input',
      '$mediaSha','image/webp',1,1,1,'$session','phase9_scan_input','approved');"
  $closeInputClose = Actor-Sql $owner "select public.phase9_close_session_v2(
    '$session',1,'close-input-race-01','$commandA');"
  $closeInputInsert = "insert into public.image_extraction_inputs(
    id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    values('99500000-0000-0000-0000-000000000002','$session','$store',
      '99600000-0000-0000-0000-000000000002','camera','uploaded',
      'close-race-input','v1');"
  $closeInputRace = Complete-BarrierRace 'close-input-race' 62007 $closeInputClose $closeInputInsert
  Assert-OneSuccess 'close-input-race' $closeInputRace 'P9_STATE_CONFLICT'
  $phantom = Invoke-Psql "select count(*) from public.image_extraction_sessions s
    join public.image_extraction_inputs i on i.session_id=s.id
    where s.id='$session' and s.status='closed'
      and i.state not in ('ready','failed','skipped');"
  if ($phantom -ne '0') { throw 'close-input-race produced a phantom nonterminal input' }
  Invoke-Psql "delete from public.image_extraction_inputs
    where id='99500000-0000-0000-0000-000000000002';
    delete from public.media_assets
    where id='99600000-0000-0000-0000-000000000002';"

  # Readiness is one self-consistent snapshot while an input becomes terminal.
  Invoke-Psql "update public.image_extraction_sessions set status='active',version=1,
    closed_at=null where id='$session';
    insert into public.media_assets(
      id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
      detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    values('99600000-0000-0000-0000-000000000001','$store','$owner',
      'scan_input','private_scan','unit6a-concurrency','$session/input',
      '$mediaSha','image/webp',1,1,1,'$session','phase9_scan_input','approved');
    insert into public.image_extraction_inputs(
      id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    values('99500000-0000-0000-0000-000000000001','$session','$store',
      '99600000-0000-0000-0000-000000000001','camera','processing',
      'concurrency-input','v1');"
  $inputWriter = "begin; select id from public.image_extraction_inputs
    where id='99500000-0000-0000-0000-000000000001' for update;
    select pg_sleep(1); update public.image_extraction_inputs set state='ready'
    where id='99500000-0000-0000-0000-000000000001'; commit;"
  $readinessReader = Actor-Sql $owner "select pg_sleep(0.1);
    select public.phase9_owner_session_readiness_v1('$session');"
  $snapshotRace = Complete-Race 'readiness-snapshot-race' $inputWriter $readinessReader
  $readiness = ($snapshotRace | Where-Object {
    $_.Output -match '"allInputsTerminal"'
  }).Output
  if (-not $readiness) { throw 'readiness-snapshot-race returned no readiness envelope' }
  if ($readiness -match '"allInputsTerminal": true' -and
      $readiness -notmatch '"input_processing": 0') {
    throw 'terminal readiness snapshot retained an input blocker'
  }
  if ($readiness -match '"allInputsTerminal": false' -and
      $readiness -notmatch '"input_processing": 1') {
    throw 'nonterminal readiness snapshot omitted its input blocker'
  }
}
finally {
  Invoke-Psql @"
delete from public.phase9_idempotency_keys
where actor_or_service='$owner' and operation in ('U6C01','U6C02');
delete from public.image_extraction_candidates where session_id='$session';
delete from public.image_extraction_inputs where session_id='$session';
delete from public.media_assets where session_id='$session';
delete from public.image_extraction_sessions where id='$session';
delete from public.store_administrators where store_id='$store';
delete from public.stores where id='$store';
"@
}
