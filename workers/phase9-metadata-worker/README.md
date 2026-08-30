# Phase 9 Metadata Worker

This service exposes authenticated manual `POST /run`, plus non-mutating
`GET /health` and `GET /ready`. It claims bounded candidate-scoped metadata jobs,
loads fenced database context, runs local/cache/provider-neutral routing, and
persists fenced outcomes. It does not schedule itself and contains no secondary
provider implementation.

The metadata endpoint accepts a run budget from 1 through 15. A run keeps at
most three jobs active, claims only enough jobs to fill available slots, and
refills a slot when one job finishes. Each job makes its own provider request;
unrelated books are never combined into one Google Books request. Per-book
outcomes are returned in claim order, while persisted database state remains
authoritative. The HTTP service itself remains single-invocation
(`PHASE9_WORKER_CONCURRENCY=1`).

Build and run with `npm run build:phase9:metadata-worker` and
`npm run start:phase9:metadata-worker`. Provider calls remain separately gated.

## Local process-only configuration

The worker reads configuration only from its child-process environment. Do not
put server or provider credentials in the repository `.env`, command arguments,
logs, snapshots, or documentation. Supply them from an operator-controlled
secret prompt/store to the child process, then clear the parent-process values
when the worker exits. Use a separate, minimal environment for the invoker so its
`PHASE9_METADATA_WORKER_URL` does not enter the worker's strict startup allowlist.

The worker requires `SUPABASE_URL` with the exact origin
`https://ahntbtktjjmvfosgkmgn.supabase.co`, the matching service-role credential,
`PHASE9_METADATA_WORKER_ID`, `PHASE9_METADATA_WORKER_INGRESS_TOKEN`,
`PHASE9_WORKER_HOST`, `PHASE9_WORKER_PORT`, `PHASE9_WORKER_CONCURRENCY=1`, and,
for real provider mode, `PHASE9_METADATA_PROVIDER_MODE=google_books` plus
`PHASE9_GOOGLE_BOOKS_API_KEY`, `PHASE9_GOOGLE_BOOKS_TIMEOUT_MS`, and
`PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES`. Metadata has no peer worker and does
not accept `PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256`; the media/vision mutual
peer-distinctness requirement remains unchanged.

On Windows, use a dedicated terminal and hidden prompts rather than literal
secret assignments that enter shell history. This pattern keeps values scoped to
the current PowerShell process and clears them when the worker stops:

```powershell
function Read-ProcessSecret([string] $Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
  $env:SUPABASE_URL = 'https://ahntbtktjjmvfosgkmgn.supabase.co'
  $env:SUPABASE_SERVICE_ROLE_KEY = Read-ProcessSecret 'Service-role credential'
  $env:PHASE9_METADATA_WORKER_ID = 'metadata-worker-local-0001'
  $env:PHASE9_METADATA_WORKER_INGRESS_TOKEN = Read-ProcessSecret 'Metadata ingress token'
  $env:PHASE9_WORKER_HOST = '127.0.0.1'
  $env:PHASE9_WORKER_PORT = '8093'
  $env:PHASE9_WORKER_CONCURRENCY = '1'
  $env:PHASE9_METADATA_PROVIDER_MODE = 'google_books'
  $env:PHASE9_GOOGLE_BOOKS_API_KEY = Read-ProcessSecret 'Google Books API key'
  $env:PHASE9_GOOGLE_BOOKS_TIMEOUT_MS = '10000'
  $env:PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES = '262144'
  npm run start:phase9:metadata-worker
} finally {
  @(
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'PHASE9_METADATA_WORKER_ID', 'PHASE9_METADATA_WORKER_INGRESS_TOKEN',
    'PHASE9_WORKER_HOST', 'PHASE9_WORKER_PORT', 'PHASE9_WORKER_CONCURRENCY',
    'PHASE9_METADATA_PROVIDER_MODE', 'PHASE9_GOOGLE_BOOKS_API_KEY',
    'PHASE9_GOOGLE_BOOKS_TIMEOUT_MS', 'PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES'
  ) | ForEach-Object { Remove-Item "Env:$_" -ErrorAction SilentlyContinue }
}
```

Do not run that privileged procedure when the service-role credential does not
belong to the approved project. For invocation, open a separate minimal terminal,
set the local URL, obtain only the ingress token through the same hidden-prompt
helper, run the command below, and clear both variables afterward.

Before any privileged start, independently verify the exact Supabase project
through the approved operator control plane. A credential-only adapter smoke can
instantiate `GoogleBooksAdapter` directly and must not start this worker or use a
Supabase credential.

Manual claims use:

```text
npm run invoke:phase9:worker -- metadata
```

The invoker environment contains only `PHASE9_METADATA_WORKER_URL`, the matching
ingress token, and optional bounded batch/timeout variables. It cannot select a
candidate, store, session, query, provider record, lease, or attempt.
