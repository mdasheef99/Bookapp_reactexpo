# Phase 9 server contract package

**Status:** WU0A independently reviewed and approved on 2026-07-19

This WU0A package is the server-owned authority for Phase 9 internal contract shapes and pure deterministic policy. It is not an Edge Function endpoint and performs no network, database, storage, provider, or application write.

- `contracts/`: versioned vision, metadata, alias, marketplace, validation, error, provider-reuse, grant-design, and future red-gate contracts.
- `domain/`: strict validation, ISBN, session/Close, duplicate-advice, quantity, publication-idempotency, and fallback helpers.
- `../../__tests__/fixtures/phase9/`: sanitized synthetic recorded fixtures.
- `../../__tests__/phase9_*.test.ts`: executable contract/security evidence.

Authority rules:

- Provider/model data enters only through strict parsers; unknown keys fail closed.
- `store_id`, actor authority, state, retryability, paths, commands, and writes are never accepted from adapter output.
- Mobile DTOs may later consume bounded server projections but must not duplicate or weaken these contracts.
- Future endpoints, migrations, live providers, storage policies, and UI require separately authorized work units.
