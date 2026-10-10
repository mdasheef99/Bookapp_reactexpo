-- Task 6 confirmation correction: picker §§6-7 / EP-AC11/19; Unit 6G §§11-14.
-- Owner-authorized local creation only. M65-M69 remain unchanged; no live application.
BEGIN;
ALTER FUNCTION marketplace_sec.phase9_edition_choices(public.image_extraction_candidates)
 RENAME TO phase9_edition_legacy_choices;
CREATE FUNCTION marketplace_sec.phase9_edition_choices(p_candidate public.image_extraction_candidates)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE response jsonb; s public.phase9_candidate_edition_state; confirmed boolean;
BEGIN
 response:=marketplace_sec.phase9_edition_legacy_choices(p_candidate);
 IF jsonb_typeof(response->'selection')='object' THEN
  s:=marketplace_sec.phase9_edition_projection_selection(p_candidate);
  confirmed:=coalesce(s.selection_id::text=response#>>'{selection,selectionId}'
   AND s.selected_at IS NOT NULL AND s.selected_by IS NOT NULL,false);
  response:=jsonb_set(response,'{selection,confirmedByOwner}',to_jsonb(confirmed));
 END IF;
 RETURN response;
END$$;

-- Keep the original command's lock order, actor-bound fingerprint, versions and receipts.
ALTER FUNCTION public.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 SET SCHEMA marketplace_sec;
ALTER FUNCTION marketplace_sec.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 RENAME TO phase9_edition_legacy_select_candidate;
CREATE FUNCTION public.phase9_select_candidate_edition_v1(
 p_session_id uuid,p_candidate_id uuid,p_expected_candidate_version integer,p_expected_metadata_revision integer,
 p_expected_review_version integer,p_source text,p_options_version integer,p_option_id uuid,p_selection_id uuid,
 p_idempotency_key text,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE response jsonb; current_choices jsonb; c public.image_extraction_candidates; confirmed boolean;
BEGIN
 response:=marketplace_sec.phase9_edition_legacy_select_candidate(p_session_id,p_candidate_id,
  p_expected_candidate_version,p_expected_metadata_revision,p_expected_review_version,p_source,
  p_options_version,p_option_id,p_selection_id,p_idempotency_key,p_command_id);
 -- Project current held authority on every reply, including old slim receipts, without rewriting them.
 -- A superseded or query-invalid receipt stays historical and cannot claim current confirmation.
 IF jsonb_typeof(response->'selection')='object' THEN
  c:=marketplace_sec.phase9_edition_assert_owner_candidate(p_session_id,p_candidate_id);
  current_choices:=marketplace_sec.phase9_edition_choices(c);
  confirmed:=coalesce(current_choices#>>'{selection,selectionId}'=response#>>'{selection,selectionId}'
   AND current_choices#>'{selection,confirmedByOwner}'='true'::jsonb,false);
  response:=jsonb_set(response,'{selection,confirmedByOwner}',to_jsonb(confirmed));
 END IF;
 RETURN response;
END$$;

DO $$DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='marketplace_sec' AND p.proname IN
   ('phase9_edition_choices','phase9_edition_legacy_choices','phase9_edition_legacy_select_candidate')
 LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP;
END$$;
ALTER FUNCTION public.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 OWNER TO postgres;
REVOKE ALL ON FUNCTION public.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)
 TO authenticated;
COMMIT;
