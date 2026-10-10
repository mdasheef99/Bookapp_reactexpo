-- PRE-010 club_members lead-policy reconciliation (companion to REC-1).
-- REC-1 converts role lead -> admin but does not remove the 008-era
-- replay-only policy below, which references the obsolete role='lead'
-- and self-queries club_members (SQLSTATE 42P17 under RLS).
-- Plain DROP (no IF EXISTS): 008 unconditionally creates this policy,
-- so it MUST exist at this historical boundary; replay fails loudly otherwise.
-- No replacement: the final four-policy model is owned by 010 / 011 / 013.

BEGIN;

DROP POLICY "Club leads can manage members"
ON public.club_members;

COMMIT;
