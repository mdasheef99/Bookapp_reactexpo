-- Harden Profile / Account data exposure.
--
-- public.user_profiles contains private and entitlement-bearing columns. Keep
-- the base table owner-only through RLS, and expose list/card-safe fields via a
-- dedicated summary table maintained by trigger.

CREATE TABLE IF NOT EXISTS public.profile_public_summaries (
  id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  username text,
  avatar_url text,
  trust_score numeric(3,2),
  city text NOT NULL,
  membership_tier text NOT NULL DEFAULT 'free'
    CHECK (membership_tier IN ('free', 'pro', 'pro_plus')),
  updated_at timestamptz
);

ALTER TABLE public.profile_public_summaries ENABLE ROW LEVEL SECURITY;

INSERT INTO public.profile_public_summaries (
  id,
  user_id,
  display_name,
  username,
  avatar_url,
  trust_score,
  city,
  membership_tier,
  updated_at
)
SELECT
  id,
  user_id,
  display_name,
  username,
  avatar_url,
  trust_score,
  city,
  COALESCE(membership_tier, 'free'),
  updated_at
FROM public.user_profiles
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  display_name = EXCLUDED.display_name,
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  trust_score = EXCLUDED.trust_score,
  city = EXCLUDED.city,
  membership_tier = EXCLUDED.membership_tier,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.sync_profile_public_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.profile_public_summaries
    WHERE id = OLD.id;

    RETURN OLD;
  END IF;

  INSERT INTO public.profile_public_summaries (
    id,
    user_id,
    display_name,
    username,
    avatar_url,
    trust_score,
    city,
    membership_tier,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.display_name,
    NEW.username,
    NEW.avatar_url,
    NEW.trust_score,
    NEW.city,
    COALESCE(NEW.membership_tier, 'free'),
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    trust_score = EXCLUDED.trust_score,
    city = EXCLUDED.city,
    membership_tier = EXCLUDED.membership_tier,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_sync_profile_public_summary ON public.user_profiles;
CREATE TRIGGER trigger_sync_profile_public_summary
AFTER INSERT OR UPDATE OF display_name, username, avatar_url, trust_score, city, membership_tier, updated_at
ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_public_summary();

DROP POLICY IF EXISTS "Profile summaries are publicly readable" ON public.profile_public_summaries;
CREATE POLICY "Profile summaries are publicly readable"
ON public.profile_public_summaries
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE (display_name, username, avatar_url, city, updated_at)
ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO service_role;

REVOKE ALL ON TABLE public.profile_public_summaries FROM PUBLIC;
REVOKE ALL ON TABLE public.profile_public_summaries FROM anon;
REVOKE ALL ON TABLE public.profile_public_summaries FROM authenticated;
GRANT SELECT ON TABLE public.profile_public_summaries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_public_summaries TO service_role;

CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_profiles
  SET trust_score = (
    SELECT AVG(rating)::numeric(3,2)
    FROM public.transaction_ratings
    WHERE to_user_id = NEW.to_user_id
  )
  WHERE user_id = NEW.to_user_id;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_profile_setup(
  p_display_name text,
  p_city text,
  p_referral_code text DEFAULT NULL::text
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text := btrim(COALESCE(p_display_name, ''));
  v_city text := btrim(COALESCE(p_city, ''));
  v_referral_code text := NULLIF(upper(regexp_replace(COALESCE(p_referral_code, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_referral_prefix text := upper(substr(regexp_replace(COALESCE(p_display_name, ''), '[^A-Za-z0-9]', '', 'g') || 'USER', 1, 4));
  v_new_referral_code text;
  v_referrer_id uuid;
  v_profile public.user_profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required'
      USING ERRCODE = '42501';
  END IF;

  IF v_display_name = '' OR v_city = '' THEN
    RAISE EXCEPTION 'Display name and city are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  IF FOUND THEN
    PERFORM public.grant_signup_bonus(v_user_id);
    RETURN v_profile;
  END IF;

  v_new_referral_code := v_referral_prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.user_profiles (
    user_id,
    display_name,
    city,
    referral_code,
    referred_by_code
  )
  VALUES (
    v_user_id,
    v_display_name,
    v_city,
    v_new_referral_code,
    v_referral_code
  )
  RETURNING * INTO v_profile;

  IF v_referral_code IS NOT NULL THEN
    SELECT user_id
    INTO v_referrer_id
    FROM public.user_profiles
    WHERE referral_code = v_referral_code
      AND user_id <> v_user_id;

    IF v_referrer_id IS NOT NULL THEN
      INSERT INTO public.referrals (
        referrer_id,
        referred_id,
        referral_code
      )
      VALUES (
        v_referrer_id,
        v_user_id,
        v_referral_code
      )
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;

  PERFORM public.grant_signup_bonus(v_user_id);

  RETURN v_profile;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_profile_public_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_profile_public_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_public_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_public_summary() TO service_role;

REVOKE ALL ON FUNCTION public.update_trust_score() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_trust_score() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_trust_score() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_trust_score() TO service_role;

REVOKE ALL ON FUNCTION public.complete_profile_setup(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_profile_setup(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_profile_setup(text, text, text) TO authenticated, service_role;
