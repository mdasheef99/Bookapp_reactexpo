param([switch]$ForBuild)
$ErrorActionPreference = 'Stop'
$receiptRoot = $PSScriptRoot
$checkoutRoot = [System.IO.Path]::GetFullPath((Join-Path $receiptRoot '../../../../..'))
Push-Location -LiteralPath $checkoutRoot
try {
  foreach ($temporaryRoute in @('app/(auth)/capture-ocr-proof.tsx','app/(auth)/capture-ocr-proof-v2.tsx','app/(auth)/capture-ocr-proof-v3.tsx')) {
    if (Test-Path -LiteralPath $temporaryRoute) { throw 'Remove the session-owned native diagnostic before manifesting the shipped build.' }
  }
  $source = Get-Content -LiteralPath (Join-Path $receiptRoot 'INITIAL-SOURCE-MANIFEST.json') -Raw | ConvertFrom-Json
  $source.files = @($source.files) + @(
    [pscustomobject]@{ path='src/components/notes/__tests__/CategoryPicker.web-semantics.test.tsx'; sha256=''; status='' }
  )
  $source.branch = (git branch --show-current).Trim()
  $source.head = (git rev-parse HEAD).Trim()
  $source | Add-Member -Force -NotePropertyName recordedUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o'))
  foreach ($sourceFile in $source.files) {
    $sourceFile.sha256 = (Get-FileHash -LiteralPath $sourceFile.path -Algorithm SHA256).Hash
    $sourceFile.status = (git status --short -- $sourceFile.path | Out-String).TrimEnd()
  }
  $source | Add-Member -Force -NotePropertyName contextFiles -NotePropertyValue @(
    @('package.json','package-lock.json','app.config.js','app.json','src/features/books/notes/manualNotesGateway.ts') | ForEach-Object {
      [ordered]@{ path=$_; sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }
    }
  )
  $sourcePath = Join-Path $receiptRoot 'SOURCE-MANIFEST.json'
  $source | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $sourcePath -Encoding UTF8
  if ($ForBuild) {
    $snapshotPath = Join-Path $receiptRoot 'BUNDLE-SOURCE-MANIFEST.json'
    Copy-Item -LiteralPath $sourcePath -Destination $snapshotPath
    $bundleRoot = Join-Path $checkoutRoot '.tmp/sdd06-capture-web/_expo/static/js/web'
    $bundles = @(Get-ChildItem -LiteralPath $bundleRoot -File -Filter '*.js' | ForEach-Object {
      [ordered]@{ path=$_.FullName.Substring($checkoutRoot.Length + 1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash; bytes=$_.Length }
    })
    if (-not $bundles.Count) { throw 'No web export bundle found.' }
    [ordered]@{
      checkout=$checkoutRoot; branch=$source.branch; head=$source.head; recordedUtc=[DateTime]::UtcNow.ToString('o')
      kind='separate local web export after same-session Sol browser corrections'
      sourceManifestPath='docs/user/library/evidence/sdd06-capture-ocr-2026-10-11/BUNDLE-SOURCE-MANIFEST.json'
      sourceManifestSha256=(Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash
      authBypass=$false; temporaryNativeProofRouteRemoved=$true; bundles=$bundles
    } | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $receiptRoot 'BUILD-MANIFEST.json') -Encoding UTF8
  }
  'MANIFEST_REFRESH=PASS'
} finally { Pop-Location }
