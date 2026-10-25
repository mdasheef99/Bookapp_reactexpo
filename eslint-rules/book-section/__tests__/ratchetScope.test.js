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
    expect(childProcess.spawnSync).toHaveBeenCalledTimes(1);
    expect(childProcess.spawnSync.mock.calls[0][1].slice(3)).toEqual(expected);
});
