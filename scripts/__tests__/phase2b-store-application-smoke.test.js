const fs = require('fs');
const path = require('path');

describe('Phase 2B store application smoke script', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'smoke-phase2b-store-application.js');
  const packagePath = path.join(process.cwd(), 'package.json');

  it('documents required auth env vars and never requires service-role credentials', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    expect(packageJson.scripts['smoke:phase2b:store-application']).toBe('node scripts/smoke-phase2b-store-application.js');
    expect(source).toContain('PHASE2B_TEST_USER_EMAIL');
    expect(source).toContain('PHASE2B_TEST_USER_PASSWORD');
    expect(source).toContain('PHASE2B_CROSS_TENANT_STORE_ID');
    expect(source).toContain('PHASE2B_PILOT_LOCALITY_ID');
    expect(source).toContain("functions.invoke('store-application'");
    expect(source).toContain("type: 'start_or_resume'");
    expect(source).toContain("type: 'save_draft'");
    expect(source).toContain("type: 'submit'");
    expect(source).toContain("type: 'record_document'");
    expect(source).not.toContain('SERVICE_ROLE');
  });
});
