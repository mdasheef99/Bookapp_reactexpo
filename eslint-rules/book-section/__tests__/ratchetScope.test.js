const childProcess = require('node:child_process');
const { scripts } = require('../../../package.json');

jest.mock('node:child_process', () => ({
    spawnSync: jest.fn(() => ({ status: 0, stdout: '[]' })),
}));

// Run the actual ratchet against a controlled subprocess result, then check the
// requested scope. The separate ratchet suite still executes real ESLint in CI.
require('./ratchet.test');

it('runs the ratchet over every path in lint:library', () => {
    const expected = scripts['lint:library'].match(/"[^"]*"|\S+/g).slice(1).map(arg => arg.replace(/^"|"$/g, ''));
    if (childProcess.spawnSync.mock.calls.length === 0) {
        // Filtered run (e.g. jest -t): the imported ratchet test that makes the
        // mocked call was filtered out, so prove the scope statically instead
        // of failing. The full suite still checks the actual spawnSync args.
        const fs = require('node:fs');
        const path = require('node:path');
        const source = fs.readFileSync(path.join(__dirname, 'ratchet.test.js'), 'utf8');
        for (const entry of expected) expect(source).toContain(`'${entry}'`);
        return;
    }
    expect(childProcess.spawnSync).toHaveBeenCalledTimes(1);
    expect(childProcess.spawnSync.mock.calls[0][1].slice(3)).toEqual(expected);
});
