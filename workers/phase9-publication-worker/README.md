# Phase 9 publication retry worker

This dedicated service consumes only `publication_retry` jobs. The database
claim supplies a job ID, opaque lease token, lease expiry, intent version, and
attempt number. Every completion or failure call repeats that identity so an
expired, superseded, cross-kind, or stolen lease cannot mutate publication.

Build with `npm run build:phase9:publication-worker` and start with
`npm run start:phase9:publication-worker`. The HTTP service exposes `GET
/health`, local-only `GET /ready`, and authenticated `POST /run`. Runtime
configuration uses `PHASE9_PUBLICATION_WORKER_ID` and
`PHASE9_PUBLICATION_WORKER_INGRESS_TOKEN`; the service-role key remains
server-only. Deploy/apply commands are intentionally outside this local unit.
