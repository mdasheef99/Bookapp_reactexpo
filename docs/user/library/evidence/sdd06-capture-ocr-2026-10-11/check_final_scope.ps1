param([switch]$AllowDocumentationUpdates)
$ErrorActionPreference = 'Stop'
$receiptRoot = $PSScriptRoot
$checkoutRoot = [System.IO.Path]::GetFullPath((Join-Path $receiptRoot '../../../../..'))
Push-Location -LiteralPath $checkoutRoot
try {
  $snapshot = Get-Content -LiteralPath (Join-Path $receiptRoot 'BUNDLE-SOURCE-MANIFEST.json') -Raw | ConvertFrom-Json
  $currentRoot = [System.IO.Path]::GetFullPath((git rev-parse --show-toplevel).Trim())
  if ($currentRoot -ne $checkoutRoot -or (git branch --show-current).Trim() -ne $snapshot.branch -or (git rev-parse HEAD).Trim() -ne $snapshot.head) {
    throw 'Checkout, branch or HEAD changed from the verified export.'
  }
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Git index is no longer empty.' }
  $allowedDocs = @(
    'docs/user/library/TRACKER.md', 'docs/user/library/SDD-06-after-book-entry-ui.md', 'docs/user/library/INTERACTION-MAP.md',
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/TRACKER.md',
    'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/trackers/02-implementation-and-verification.md'
  )
  $documentationUpdates = @()
  foreach ($sourceFile in (@($snapshot.files) + @($snapshot.contextFiles))) {
    $currentHash = (Get-FileHash -LiteralPath $sourceFile.path -Algorithm SHA256).Hash
    if ($currentHash -ne $sourceFile.sha256) {
      if ($AllowDocumentationUpdates -and $sourceFile.path -in $allowedDocs) { $documentationUpdates += $sourceFile.path }
      else { throw "Verified source/context changed: $($sourceFile.path)" }
    }
  }
  $gatewaySource = Get-Content -LiteralPath 'src/features/books/notes/manualNotesGateway.ts' -Raw
  $gateNames = @('ownedBookWrites','stableCreateReconciliation','optionalFiveCategories','serverManagedEditVersion')
  foreach ($gateName in $gateNames) { if ($gatewaySource -notmatch ($gateName + ': false')) { throw "Write gate changed: $gateName" } }
  foreach ($temporaryRoute in @('app/(auth)/capture-ocr-proof.tsx','app/(auth)/capture-ocr-proof-v2.tsx','app/(auth)/capture-ocr-proof-v3.tsx')) {
    if (Test-Path -LiteralPath $temporaryRoute) { throw 'Session-owned diagnostic route remains in app source.' }
  }
  $globalStatusChanges = @(git diff --name-only -- 'docs/multi-tenant-bookstore-marketplace/DOC-13-implementation-tracker.md' 'docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md')
  if ($globalStatusChanges.Count) { throw 'Global status/routing documents changed.' }
  $heldReadback = @(
    'docs/user/library/MANUAL-NOTE-PERSISTENCE-PLAN.md', 'docs/user/library/MANUAL-NOTE-FORWARD-CORRECTION-PLAN.md',
    'supabase/migrations/20261010172118_library_manual_note_persistence.sql'
  ) | ForEach-Object { [ordered]@{ path=$_; sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash } }
  if ($heldReadback[-1].sha256 -ne 'EADD4D8A16D87801735EC59A101A95732A59E64E9902A576000B5CF0AAFB291D') {
    throw 'Held original migration differs from its preserved review-ledger hash.'
  }
  $nativeRun = Get-Content -LiteralPath (Join-Path $receiptRoot 'NATIVE-RUN.json') -Raw | ConvertFrom-Json
  foreach ($nativeSource in $nativeRun.source) {
    if ((Get-FileHash -LiteralPath $nativeSource.path -Algorithm SHA256).Hash -ne $nativeSource.sha256) {
      throw "Native diagnostic's source changed: $($nativeSource.path)"
    }
  }
  [ordered]@{
    kind='Final local source/boundary inspection; not persistence or native UI acceptance'
    recordedUtc=[DateTime]::UtcNow.ToString('o'); status='PASS'; branch=$snapshot.branch; head=$snapshot.head
    verifiedSourcePaths=$snapshot.files.Count; verifiedContextPaths=$snapshot.contextFiles.Count
    allowedDocumentationUpdates=$documentationUpdates; fourWriteGatesFalse=$true; indexEmpty=$true
    globalStatusAndRouterUnchanged=$true; temporaryNativeDiagnosticRoutesAbsent=$true
    nativeDiagnosticSourceHashesRetained=$true; heldArtifactReadback=$heldReadback
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $receiptRoot 'FINAL-SCOPE-CHECK.json') -Encoding UTF8
  'FINAL_SCOPE_CHECK=PASS'
} finally { Pop-Location }
