import fs from 'node:fs';
import path from 'node:path';

const migration =
  '20260809000034_marketplace_phase9_vision_language_hint_correction.sql';
const file = path.join(process.cwd(), 'supabase', 'migrations', migration);
const sql = () => fs.readFileSync(file, 'utf8');

describe('Phase 9 M34 vision language-hint correction', () => {
  it('is forward-only and replaces only the applied persistence function', () => {
    expect(fs.existsSync(file)).toBe(true);
    expect(sql()).toContain('phase9_persist_vision_analysis');
    expect(sql()).not.toMatch(/DROP\s+(?:TABLE|COLUMN|FUNCTION)/i);
    expect(sql()).not.toMatch(/ALTER\s+TABLE/i);
  });

  it('removes selected-language candidate rejection and caps provider authors at five', () => {
    const text = sql();
    expect(text).toContain("jsonb_array_length(v_obs->''author_guesses'')>5");
    expect(text).toContain("IF v_obs->>'detected_language'='und' THEN");
    expect(text).toContain("ELSE v_disposition:='candidate'");
    expect(text).toContain('v_updated ~ v_count_old');
    expect(text).toContain('P9_M34_EXPECTED_M12_DEFINITION_NOT_FOUND');
  });

  it('preserves ownership, security-definer mode, search path and service grant', () => {
    const text = sql();
    expect(text).toContain('SECURITY DEFINER');
    expect(text).toContain("SET search_path TO ''");
    expect(text).toMatch(/ALTER FUNCTION[\s\S]+OWNER TO postgres/i);
    expect(text).toMatch(/REVOKE ALL[\s\S]+FROM PUBLIC,anon,authenticated/i);
    expect(text).toMatch(/GRANT EXECUTE[\s\S]+TO service_role/i);
  });
});
