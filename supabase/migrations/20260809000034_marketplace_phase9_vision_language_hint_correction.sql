-- Phase 9 forward correction: selected language is a hint, not a candidate gate.
BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_author_limit_old constant text :=
    'jsonb_array_length(v_obs->''author_guesses'')>20';
  v_author_limit_new constant text :=
    'jsonb_array_length(v_obs->''author_guesses'')>5';
  v_count_old constant text := $pattern$
    IF\s+v_obs->>'detected_language'='und'\s+OR\s+split_part\(lower\(v_obs->>'detected_language'\),'-',1\)\s*<>\s*split_part\(lower\(v_session\.selected_language\),'-',1\)\s+THEN\s+v_language_skip_count:=v_language_skip_count\+1;\s+ELSIF\s+v_obs->'title_guess'='null'::jsonb\s+THEN\s+v_identity_skip_count:=v_identity_skip_count\+1;\s+ELSE\s+v_candidate_count:=v_candidate_count\+1;\s+END IF;$pattern$;
  v_count_new constant text := $new$
    IF v_obs->>'detected_language'='und' THEN
      v_language_skip_count:=v_language_skip_count+1;
    ELSIF v_obs->'title_guess'='null'::jsonb THEN
      v_identity_skip_count:=v_identity_skip_count+1;
    ELSE
      v_candidate_count:=v_candidate_count+1;
    END IF;$new$;
  v_disposition_old constant text := $pattern$
    IF\s+v_obs->>'detected_language'='und'\s+THEN\s+v_disposition:='unknown_language';\s+ELSIF\s+split_part\(lower\(v_obs->>'detected_language'\),'-',1\)\s*<>\s*split_part\(lower\(v_session\.selected_language\),'-',1\)\s+THEN\s+v_disposition:='language_mismatch';\s+ELSIF\s+v_obs->'title_guess'='null'::jsonb\s+THEN\s+v_disposition:='identity_insufficient';\s+ELSE\s+v_disposition:='candidate';\s+v_candidate_count:=v_candidate_count\+1;\s+END IF;$pattern$;
  v_disposition_new constant text := $new$
    IF v_obs->>'detected_language'='und' THEN v_disposition:='unknown_language';
    ELSIF v_obs->'title_guess'='null'::jsonb THEN v_disposition:='identity_insufficient';
    ELSE v_disposition:='candidate'; v_candidate_count:=v_candidate_count+1;
    END IF;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'marketplace_sec.phase9_persist_vision_analysis(uuid,text,text,integer,jsonb)'::regprocedure
  ) INTO v_definition;

  IF position(v_author_limit_old IN v_definition)=0
    OR v_definition !~ v_count_old
    OR v_definition !~ v_disposition_old THEN
    RAISE EXCEPTION 'P9_M34_EXPECTED_M12_DEFINITION_NOT_FOUND';
  END IF;

  v_updated:=replace(v_definition,v_author_limit_old,v_author_limit_new);
  v_updated:=regexp_replace(v_updated,v_count_old,v_count_new);
  v_updated:=regexp_replace(v_updated,v_disposition_old,v_disposition_new);

  IF v_updated=v_definition
    OR position(v_author_limit_old IN v_updated)>0
    OR v_updated ~ v_count_old
    OR v_updated ~ v_disposition_old THEN
    RAISE EXCEPTION 'P9_M34_FUNCTION_REWRITE_FAILED';
  END IF;

  EXECUTE v_updated;
END
$migration$;

ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  uuid,text,text,integer,jsonb
) SECURITY DEFINER;
ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  uuid,text,text,integer,jsonb
) SET search_path TO '';
ALTER FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  uuid,text,text,integer,jsonb
) OWNER TO postgres;

REVOKE ALL ON FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  uuid,text,text,integer,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_persist_vision_analysis(
  uuid,text,text,integer,jsonb
) TO service_role;

COMMIT;
