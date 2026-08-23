-- ============================================================
-- CLUBS REMEDIATION — B01 migration (DRAFT, requires approval)
-- CLUB-BACKEND-01 / PRODUCT-14 — club-banners Storage tightening
-- Project: ahntbtktjjmvfosgkmgn · Branch: feat/clubs-ui-overhaul
--
-- LIVE EVIDENCE (2026-08-22, Supabase MCP read-only):
--   Bucket: club-banners, public=true, 5MB limit,
--           mime: image/jpeg|png|webp
--   6 policies, 3 of which are WIDE OPEN:
--     - "Allow authenticated users to upload" (INSERT, no constraint)
--     - "Allow authenticated users to update" (UPDATE, no constraint)
--     - "Allow authenticated users to read"   (SELECT, no constraint)
--   Plus 3 legacy owner-scoped policies keyed on {uid}/ first folder:
--     club_banners_owner_insert / _update / _public_read variants
--   Existing objects: 2 (aaaaaaaa-...-1/cover.jpg|png)
--
-- NEW MODEL (per PRODUCT-14 decision):
--   Paths are club-owned: {clubId}/cover.<ext>
--   Write access: only ACTIVE ADMINs of that specific club.
--   Read access: public bucket reads stay (banners are public URLs).
--   No pre-creation upload: drafts/ path removed from client;
--   banner upload happens in manage settings after club exists.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Remove ALL existing permissive policies on the bucket
--    (permissive-OR means any single open policy defeats the rest)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to upload objects to bucket_id = club-banners"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update club banners"
  ON storage.objects;
DROP POLICY IF EXISTS "Public read access to club banners"
  ON storage.objects;
-- Legacy owner-scoped set (superseded by club-scoped below)
DROP POLICY IF EXISTS club_banners_owner_insert ON storage.objects;
DROP POLICY IF EXISTS club_banners_owner_update ON storage.objects;
DROP POLICY IF EXISTS club_banners_public_read ON storage.objects;

-- ------------------------------------------------------------
-- 2) Club-scoped policies
--    Helper predicate inline: caller must be an active admin of the
--    club that owns the object's first path folder ({clubId}/*).
--    Uses is_active_eligible_club_manager (existing helper, live-verified).
-- ------------------------------------------------------------

CREATE POLICY "club_banners_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'club-banners'
  AND public.is_active_eligible_club_manager(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
);

CREATE POLICY "club_banners_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'club-banners'
  AND public.is_active_eligible_club_manager(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
)
WITH CHECK (
  bucket_id = 'club-banners'
  AND public.is_active_eligible_club_manager(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
);

CREATE POLICY "club_banners_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'club-banners'
  AND public.is_active_eligible_club_manager(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
);

-- Public read stays: banners are served as public URLs by design.
CREATE POLICY "club_banners_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'club-banners');

COMMIT;

-- ============================================================
-- POST-APPLY READBACK CHECKLIST:
-- [ ] SELECT policyname, cmd FROM pg_policies WHERE tablename='objects'
--     AND schemaname='storage' AND qual/check ILIKE '%club-banners%'
--     → exactly 4 rows as above, zero unconstrained policies
-- [ ] Negative test: non-admin INSERT into {clubId}/ → RLS violation
-- [ ] Positive test: admin INSERT into {ownClubId}/ → success
-- [ ] Public SELECT still works (banner URL loads)
-- [ ] Old draft paths (drafts/*) removed if any exist
-- CLIENT SIDE (same wave, separate commit):
-- [ ] ClubCreateScreen: remove upload-to-drafts flow entirely
-- [ ] ClubManageSettingsSection: already uploads {club.id}/cover.ext ✓
-- ============================================================
