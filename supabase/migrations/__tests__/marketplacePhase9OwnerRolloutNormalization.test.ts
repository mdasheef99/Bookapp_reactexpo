import fs from 'fs';
import path from 'path';

const migration = (number: number, suffix: string) => path.join(
  process.cwd(),
  'supabase',
  'migrations',
  `202607290000${number}_${suffix}.sql`,
);
const m24 = migration(24, 'marketplace_phase9_owner_variant_decisions');
const m25 = migration(25, 'marketplace_phase9_owner_variant_corrections');
const m26 = migration(26, 'marketplace_phase9_variant_benchmark_rollout');
const m27 = migration(27, 'marketplace_phase9_exact_rollout_activation');
const m28 = migration(28, 'marketplace_phase9_variant_benchmark_evidence_read');
const read = (file: string) => fs.readFileSync(file, 'utf8');

describe('Phase 9 Unit 5C-5/5C-6 normalized migration sequence', () => {
  it('contains the coherent M24-M28 candidate migration sequence', () => {
    expect([m24, m25, m26, m27, m28].every(fs.existsSync)).toBe(true);
    expect(fs.existsSync(migration(
      28, 'marketplace_phase9_rollout_evidence_correction',
    ))).toBe(false);
    expect(fs.existsSync(migration(
      29, 'marketplace_phase9_owner_policy_readback',
    ))).toBe(false);
  });

  it('keeps lifecycle fencing and Owner-origin transitions in M24/M25', () => {
    const owner = read(m24);
    const correction = read(m25);
    expect(owner).toContain(
      'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_candidate_variant_refresh',
    );
    expect(owner).toMatch(
      /status='stale'[\s\S]*lifecycle_version=lifecycle_version\+1/i,
    );
    expect(owner).toContain('actor_user_id=v_actor');
    expect(owner).toContain('marketplace_sec.phase9_is_store_owner(p_store_id)');
    expect(owner).not.toContain('marketplace_sec.is_store_admin(p_store_id)');
    expect(correction).toContain("'owner_correction'");
    expect(correction).toContain("IF v_source.status='rejected'");
    expect(correction).toContain('v_source.lifecycle_version<>p_expected_version');
  });

  it('locks the candidate before the source proposal and derives evidence afterward', () => {
    const correction = read(m25);
    const replacement = correction.slice(
      correction.indexOf('CREATE FUNCTION public.phase9_owner_replace_search_variant'),
      correction.indexOf('ALTER FUNCTION public.phase9_owner_replace_search_variant'),
    );
    const resolveCandidate = replacement.indexOf(
      'SELECT source.candidate_id INTO v_candidate_id',
    );
    const lockCandidate = replacement.indexOf(
      'WHERE id=v_candidate_id AND store_id=p_store_id FOR SHARE',
    );
    const lockProposal = replacement.indexOf(
      'WHERE id=p_source_proposal_id FOR UPDATE',
    );
    const deriveEvidence = replacement.indexOf(
      'v_confirmed:=marketplace_sec.phase9_confirmed_variant_source',
    );
    expect(resolveCandidate).toBeGreaterThan(-1);
    expect(lockCandidate).toBeGreaterThan(resolveCandidate);
    expect(lockProposal).toBeGreaterThan(lockCandidate);
    expect(deriveEvidence).toBeGreaterThan(lockProposal);
  });

  it('keeps platform evidence reads isolated in M28', () => {
    const sql = read(m28);
    expect(sql).toContain('phase9_platform_search_variant_benchmark_summary');
    expect(sql).toContain('phase9_platform_search_variant_benchmark_evidence');
    expect(sql).toContain("SET search_path=''");
    expect(sql).toContain("marketplace_sec.has_platform_role(ARRAY['platform_admin'])");
    expect(sql).not.toContain('phase9_record_search_variant_benchmark');
    expect(sql).not.toContain('phase9_review_search_variant_benchmark');
    expect(sql).not.toContain('phase9_set_search_variant_language_rollout');
  });

  it('leaves candidate-driven stale materialization to the M22 update trigger', () => {
    const owner = read(m24);
    const staleBranch = owner.slice(
      owner.indexOf("SET status='stale'"),
      owner.indexOf('ELSIF NEW.committed_inventory_id'),
    );
    const committedBranch = owner.slice(
      owner.indexOf('ELSIF NEW.committed_inventory_id'),
      owner.indexOf('END IF;', owner.indexOf('ELSIF NEW.committed_inventory_id')),
    );
    expect(staleBranch).not.toContain(
      'phase9_materialize_search_variant(v_proposal.id)',
    );
    expect(committedBranch).toContain(
      'phase9_materialize_search_variant(v_proposal.id)',
    );
  });

  it('keeps benchmark evidence and legal review state independently executable in M26', () => {
    const sql = read(m26);
    expect(sql).toContain(
      'review_order bigint GENERATED ALWAYS AS IDENTITY UNIQUE',
    );
    expect(sql).toContain('execution_id,action,actor_user_id,reason,note,prior_review_id');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('complete_count>=100');
    expect(sql).toContain('P9_BENCHMARK_COUNT_MISMATCH');
    expect(sql).toContain('P9_BENCHMARK_ITEM_SET_MISMATCH');
    expect(sql).toContain('P9_REVIEW_TRANSITION_INVALID');
    expect(sql).toContain(
      'phase9_benchmark_review_is_effective_approval',
    );
    expect(sql).toContain('phase9_trusted_benchmark_result');
    expect(sql).toContain('result_canonicalization_version');
    expect(sql).toContain('P9_BENCHMARK_RESULT_IDENTITY_MISMATCH');
    expect(sql).toContain('ORDER BY latest.review_order DESC,latest.id DESC');
    expect(sql).not.toContain('phase9_search_variant_language_rollouts');
    expect(sql).not.toContain('phase9_search_variant_rollout_audit');
    expect(sql).not.toContain('phase9_search_variant_automatic_activation_allowed');
    expect(sql.trimEnd().split(/\r?\n/u).length).toBeLessThanOrEqual(500);
  });

  it('owns rollout governance before exact fail-closed activation in M27', () => {
    const sql = read(m27);
    expect(sql).toContain('CREATE TABLE public.phase9_search_variant_language_rollouts');
    expect(sql).toContain('CREATE TABLE public.phase9_search_variant_rollout_audit');
    expect(sql).toContain('v_audit.actor_user_id<>v_actor');
    expect(sql).toContain('resulting_policy_version');
    expect(sql).toContain(
      'marketplace_sec.phase9_variant_activation_denial_reason',
    );
    expect(sql).toContain("'rollout_not_configured'");
    expect(sql).toContain("'automatic_activation_disabled'");
    expect(sql).toContain("'rollout_evidence_invalid'");
    expect(sql).toContain("'exact_approved_rollout_v1'");
    expect(sql).toContain(
      'public.phase9_search_variant_automatic_activation_allowed',
    );
    expect(sql.indexOf('CREATE TABLE public.phase9_search_variant_language_rollouts'))
      .toBeLessThan(sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.phase9_reconcile_search_variants',
      ));
    expect(sql).not.toContain('test_allow_v1');
    expect(sql.trimEnd().split(/\r?\n/u).length).toBeLessThanOrEqual(400);
  });
});
