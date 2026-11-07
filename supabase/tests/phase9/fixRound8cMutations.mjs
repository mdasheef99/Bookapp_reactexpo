// Approved named mutations run against disposable installed definitions only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {value,resetActor} from './finalAttemptSweep8cFixture.mjs';
import {migrationPath} from './databaseHarness.mjs';
export async function mutate(db) {
 const name=process.env.PHASE9_M99_MUTATION;if(!name)return;
 assert.notEqual(process.env.PHASE9_M99_BASELINE,'1');await resetActor(db);
 if(name==='m66-choices-body') {
  const sql=fs.readFileSync(migrationPath('20261007000066_marketplace_phase9_edition_picker_commands.sql'),'utf8');
  const body=sql.slice(sql.indexOf('CREATE FUNCTION public.phase9_owner_candidate_edition_choices_v1'),sql.indexOf('CREATE FUNCTION public.phase9_request_candidate_edition_options_v1'));
  await db.exec(body.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));return;
 }
 const specs={
  'omit-automatic-settlement':['phase9_fail_metadata_job_automatic','PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(', 'PERFORM marketplace_sec.m99_mutant_no_settlement('],
  'omit-explicit-settlement':['phase9_fail_candidate_edition_options_v1','PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(', 'PERFORM marketplace_sec.m99_mutant_no_settlement('],
  'omit-vision-settlement':['phase9_fail_vision_job','PERFORM marketplace_sec.phase9_settle_terminal_usage_v1(', 'PERFORM marketplace_sec.m99_mutant_no_settlement('],
  'unknown-zero':['phase9_settle_terminal_usage_v1',"next_status:='reserved';", "next_status:='released';"],
  'ignore-cost':['phase9_settle_terminal_usage_v1','total_cost:=total_cost+a.calculated_cost_units;','total_cost:=0;'],
  'vision-ignore-cost':['phase9_settle_terminal_usage_v1','total_cost:=total_cost+v.calculated_cost_units;','total_cost:=0;'],
  'rewrite-consumed':['phase9_settle_terminal_usage_v1',"AND status='reserved'", "AND status IN('reserved','consumed','released')"],
  'all-exhausted':['phase9_fail_metadata_job_automatic',"ELSE 'P9_METADATA_TECHNICAL_FAILURE'", "ELSE 'P9_METADATA_ATTEMPTS_EXHAUSTED'"],
  'explicit-all-exhausted':['phase9_fail_candidate_edition_options_v1',"ELSE 'P9_METADATA_TECHNICAL_FAILURE'", "ELSE 'P9_METADATA_ATTEMPTS_EXHAUSTED'"],
  'automatic-never-exhausted':['phase9_fail_metadata_job_automatic',"THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'", "THEN 'P9_METADATA_TECHNICAL_FAILURE'"],
  'explicit-never-exhausted':['phase9_fail_candidate_edition_options_v1',"THEN 'P9_METADATA_ATTEMPTS_EXHAUSTED'", "THEN 'P9_METADATA_TECHNICAL_FAILURE'"],
  'automatic-nontechnical-dead-letter':['phase9_fail_metadata_job_automatic',
   "CASE WHEN v_manual_outcome='technical_failure' THEN 'dead_letter' ELSE 'resolved' END", "'dead_letter'"],
  'explicit-nontechnical-dead-letter':['phase9_fail_candidate_edition_options_v1',
   "CASE WHEN outcome='technical_failure' THEN 'dead_letter' ELSE 'resolved' END", "'dead_letter'"],
  'dashboard-sum':['public.phase9_owner_dashboard_inventory_counts_v1',"'total',count(*)", "'total',sum(quantity_available)"],
  'dashboard-cross-store':['public.phase9_owner_dashboard_inventory_counts_v1','WHERE store_id=v_store','WHERE true'],
  'omit-mutability':['public.phase9_owner_candidate_edition_choices_v1','IF NOT marketplace_sec.phase9_owner_ux_session_mutable(s) THEN','IF false THEN'],
  'choices-no-owner':['public.phase9_owner_candidate_edition_choices_v1',
   's:=marketplace_sec.phase9_owner_ux_assert_session(p_session_id);',
   'SELECT * INTO s FROM public.image_extraction_sessions WHERE id=p_session_id;'],
  'choices-no-candidate-scope':['public.phase9_owner_candidate_edition_choices_v1',
   'WHERE id=p_candidate_id AND session_id=s.id\n  AND store_id=s.store_id;', 'WHERE id=p_candidate_id;'],
  'choices-no-eligibility':['public.phase9_owner_candidate_edition_choices_v1',
   "IF c.state NOT IN('ready','needs_review','possible_duplicate') OR c.committed_inventory_id IS NOT NULL\n  OR c.expires_at<=transaction_timestamp() OR c.review_disposition IN('owner_removed_from_scan','skipped_false_detection')", 'IF false'],
  'choices-projection':['public.phase9_owner_candidate_edition_choices_v1',
   'RETURN marketplace_sec.phase9_edition_choices(c);', "RETURN '{}'::jsonb;"],
  'dashboard-no-capability':['public.phase9_owner_dashboard_inventory_counts_v1',
   'v_store:=marketplace_sec.phase9_owner_store(p_store_id);',
   'SELECT store_id INTO v_store FROM public.store_administrators WHERE user_id=auth.uid() LIMIT 1;'],
  'dashboard-null-fallback':['public.phase9_owner_dashboard_inventory_counts_v1',
   "IF p_store_id IS NULL THEN RAISE EXCEPTION 'P9_REQUEST_INVALID'; END IF;", 'IF false THEN NULL; END IF;'],
  'dashboard-first-store':['public.phase9_owner_dashboard_inventory_counts_v1',
   'v_store:=marketplace_sec.phase9_owner_store(p_store_id);',
   'v_store:=marketplace_sec.phase9_owner_store(NULL);'],
  'all-released':['phase9_settle_terminal_usage_v1',"ELSIF sent THEN next_status:='consumed'; actual_cost:=total_cost;",
   "ELSIF sent THEN next_status:='released'; actual_cost:=0;"],
  'ignore-metadata-lineage':['phase9_settle_terminal_usage_v1',
   'l.job_id IS DISTINCT FROM j.id OR l.store_id IS DISTINCT FROM j.store_id', 'false'],
  'ignore-foreign-call-lineage':['phase9_settle_terminal_usage_v1',
   'x.usage_reservation_id IS DISTINCT FROM r.id', 'false'],
  'ignore-vision-lineage':['phase9_settle_terminal_usage_v1',
   'v.job_id IS DISTINCT FROM j.id OR v.store_id IS DISTINCT FROM j.store_id', 'false'],
  'omit-terminal-check':['phase9_settle_terminal_usage_v1',
   "AND status IN('resolved','dead_letter') AND lease_owner IS NULL AND lease_token_hash IS NULL\n  AND lease_expires_at IS NULL", 'AND true'],
  'vision-generic-unsent':['phase9_settle_terminal_usage_v1',
   "normalized_outcome='media_unavailable'", "normalized_outcome IN('media_unavailable','timeout')"],
  'ignore-vision-current-claim':['phase9_settle_terminal_usage_v1',
   'AND x.claim_attempt_number=j.attempt_count AND ', 'AND '],
  };
 const attributes={
  'choices-volatility':"ALTER FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) STABLE",
  'choices-search-path':"ALTER FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) SET search_path='public'",
  'choices-security':"ALTER FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) SECURITY INVOKER",
  'choices-owner':"ALTER FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) OWNER TO anon",
  'choices-acl':"GRANT EXECUTE ON FUNCTION public.phase9_owner_candidate_edition_choices_v1(uuid,uuid) TO anon",
 };
 if(attributes[name]){await db.exec(attributes[name]);return;}
 if(name==='mark-overwrite') {
  const sql=fs.readFileSync(migrationPath('20260727000014_marketplace_phase9_vision_provider_attempts.sql'),'utf8');
  const body=sql.slice(sql.indexOf('CREATE FUNCTION marketplace_sec.phase9_mark_vision_provider_attempt('),sql.indexOf('CREATE FUNCTION public.phase9_register_vision_provider_attempt('));
  await db.exec(body.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));return;
 }
 if(name.startsWith('helper-grant-')){const role=name.slice('helper-grant-'.length);assert.ok(['PUBLIC','anon','authenticated','service_role'].includes(role));await db.exec('GRANT EXECUTE ON FUNCTION marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text) TO '+role);return;}
 const spec=specs[name];assert.ok(spec,'unknown mutation '+name);
 const fn=spec[0].includes('.')?spec[0]:'marketplace_sec.'+spec[0];
 const body=await value(db,`SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname||'.'||p.proname=$1`,[fn]);
 assert.ok(body.includes(spec[1]),'mutation target missing '+name);
 if(name.endsWith('-settlement'))await db.exec("CREATE FUNCTION marketplace_sec.m99_mutant_no_settlement(uuid,uuid,text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$BEGIN RETURN; END$$");
 await db.exec(body.replaceAll(spec[1],spec[2]));
}
