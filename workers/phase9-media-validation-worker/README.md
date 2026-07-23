# Phase 9 dedicated media worker

This is a non-Supabase-Edge service entry point. `bootstrap.ts` is the production
composition boundary: it loads the pinned ImageMagick WASM processor and creates
the server-only Supabase service client. Its host injects:

- a strong worker-specific ingress secret, validated as distinct from the Supabase
  service-role key and every configured privileged secret;
- a stable 16–128 character worker ID;
- a server-only Supabase service-role client; and
- the real `MediaProcessor`.

The ingress secret authorizes only this HTTP boundary; it does not create database
authority. The separately injected service-role client owns database/Storage access.
The HTTP body cannot select the lease owner. Every claim receives an opaque token and
attempt number. Both are required for context, source-snapshot binding, failure,
sanitized upload revalidation, and finalization.

The worker rejects animated/multi-frame PNG and WebP. ImageMagick's 64 MP `area`
resource policy is an internal decode/cache working allowance, not the source-image
limit. The processor independently enforces the 16,000,000-pixel ceiling before
decode when headers permit and again after decode.
