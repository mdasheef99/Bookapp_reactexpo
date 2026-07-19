# Phase 9 sanitized contract fixtures

These fixtures are synthetic, consent-free contract examples. They contain no image bytes, signed URLs, credentials, store/customer identifiers, raw provider payloads, or production responses. They are deterministic CI inputs only and must not be presented as model accuracy evidence.

- `visionFixtures.ts`: one, fifteen, over-limit, empty, wrong-language, repeated-spine, malformed, oversized, injection, and unknown-authority-field envelopes.
- `metadataFixtures.ts`: two deliberately distinct coherent edition records plus a no-match outcome; tests select one record and never merge their fields.
- `aliasFixtures.ts`: synthetic Devanagari title aliases demonstrating original-script authority, bounded automated proposals, and official/Owner-verified coexistence.

Fixture provenance: manually authored for WU0A against `p9-contract-v1`; sanitized on creation; no external provider or network call.
