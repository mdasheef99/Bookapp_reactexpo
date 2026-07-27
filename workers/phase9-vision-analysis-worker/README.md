# Phase 9 fixture vision-analysis worker

Dedicated Node-compatible service boundary for Unit 4/4B. It accepts a worker-only
ingress secret, uses a service-role client for the four M12 RPCs, and keeps both
the recorded fixture adapter and the server-only Gemini adapter behind the same
`p9-vision-v2` analyzer seam. It contains no metadata, inventory, publication, or
client-visible Storage-path integration.

Build with `npm run build:phase9:vision-worker` and start with
`npm run start:phase9:vision-worker`. `server.ts` exposes non-mutating
`GET /health`, local-only `GET /ready`, and authenticated `POST /run`, with one
processing request per instance and graceful `SIGINT`/`SIGTERM`.

Fixture mode remains the compatibility default:
`PHASE9_VISION_FIXTURE_CASE` selects one process-wide allowlisted deployment
fixture. Gemini mode is selected only with `PHASE9_VISION_ANALYZER_MODE=gemini` and
requires server-secret `PHASE9_GEMINI_API_KEY`, configuration-driven
`PHASE9_GEMINI_MODEL_ID`, and bounded `PHASE9_GEMINI_TIMEOUT_MS`. No optional
fallback model is configured or enabled.

The analyzer rebinds every job, correlation, attempt, language, and opaque media
identity from the authoritative request. A server-side resolver verifies the
opaque reference before reading private sanitized bytes; bucket and object paths
do not cross into analyzer requests, normalized results, logs, or errors.
