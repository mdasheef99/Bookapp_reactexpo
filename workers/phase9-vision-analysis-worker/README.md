# Phase 9 fixture vision-analysis worker

Dedicated Node-compatible service boundary for Unit 4. It accepts a worker-only
ingress secret, uses a service-role client for the four M12 RPCs, and analyzes
only recorded `p9-vision-v2` fixtures selected by opaque sanitized-media
references. It contains no real provider, metadata, inventory, publication, or
Storage-path integration.

Build with `npm run build:phase9:vision-worker` and start with
`npm run start:phase9:vision-worker`. `server.ts` exposes non-mutating
`GET /health`, local-only `GET /ready`, and authenticated `POST /run`, with one
processing request per instance and graceful `SIGINT`/`SIGTERM`.

`PHASE9_VISION_FIXTURE_CASE` selects one process-wide allowlisted deployment
fixture. The analyzer rebinds every job, correlation, attempt, language, and opaque
media identity from the authoritative request; tenant data and Storage paths cannot
select fixture content.
