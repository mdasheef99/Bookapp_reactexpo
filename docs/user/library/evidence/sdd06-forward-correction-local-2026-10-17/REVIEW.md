# Independent local migration review

Date: 2026-10-17. Reviewer: fresh-context GPT-6 Astra, high reasoning; read-only.
Reviewed SQL SHA-256: 6CE478154716EEAA5AF5FC7D1B2053817E45038FDFD94A813439AC5FAD86A376 (before the bounded fix below).
Scope: new forward migration, forward tests, actual applied SQL, fresh metadata, plan/evidence. No broad review of unrelated dirty files; no external mutation.

## Verdict and findings

No Critical finding. Local handoff required one Important correction:
- Effective table privileges did not detect authenticated column ACLs or grant options. A REFERENCES(content) grant or SELECT WITH GRANT OPTION passed the guard and was silently normalized. Required behavior is abort/preserve for review.
- Parent confirmed the finding. [RED proof](./review-privileges-red.txt) independently exercised four variants: column REFERENCES, table SELECT grant option, helper EXECUTE grant option, column UPDATE grant option. All four were incorrectly accepted before the fix.
- Bounded fix checks the verified explicit table ACL matrix, absence of baseline column ACLs, and function ACLs/grant options before mutation. Fresh MCP confirms twenty table ACL entries without grant options and ten null column ACLs. The fixture now models Supabase's verified default function grants as environment setup, without modifying the immutable applied SQL.
- The final full SQL log records GREEN and complete-suite results. No second reviewer or new broad audit was requested.

Minor (deferred): the final in-transaction catalog check verifies names/roles/counts, trigger binding and function security/search paths, but does not compare every target deparser expression/body or exclude all differently bound/disabled extra triggers. Current DDL is literal, source-reviewed and behaviorally exercised under table locks; exact baseline rejects extra triggers. This is additional postcondition verification, not an observed incorrect target. Documentation now qualifies the dynamic postcondition claim. Exact target readback remains required before eventual release.

## Considered and declined

- Trigger EXECUTE revocation: existing trigger retained; authenticated/trusted role writes prove invocation without direct execution.
- CAS race: actual UPDATE version predicate and blocked second connection are exercised.
- Ownership reassignment/cascades: retained composite FK; no new cascade behavior.
- Whitespace: exact FEFF-including/NEL-excluding set and both CHECKs re-added.
- Saved Pages simplification: bounded preservation canary only, no claim of full behavior.
- Real Auth/PostgREST/native: separate release checks outside this local unit.
- Provisional stale status: parent was updating docs during review.

These scope exclusions remain appropriate; they grant no live acceptance.

## Final author disposition

Important finding fixed through RED/GREEN in the same local unit. The minor verification extension is deferred and disclosed; source/semantic role tests remain the present target evidence. Shared migration application, connected test writes/cleanup, gate enablement and publication remain separately authorized. All four gates false.
