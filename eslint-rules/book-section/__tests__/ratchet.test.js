const childProcess = require('node:child_process');
const path = require('node:path');
const baseline = require('../ratchet-baseline.json');

const repoRoot = path.resolve(__dirname, '../../..');
const ruleIds = [
    'book-section/no-raw-style-values',
    'book-section/require-accessible-name',
    'book-section/no-fabricated-ratings',
];

describe('book-section warning ratchet', () => {
    it('keeps warnings at or below the reviewed baseline and has no book-section errors', () => {
        expect(Object.keys(baseline.warnings).sort()).toEqual([...ruleIds].sort());
        for (const ruleId of ruleIds) {
            expect(Number.isInteger(baseline.warnings[ruleId])).toBe(true);
            expect(baseline.warnings[ruleId]).toBeGreaterThanOrEqual(0);
        }

        // These four paths must stay in sync with package.json's lint:library script.
        // ESLint 9 does not export bin/eslint.js; resolve it beside the exported package.json.
        const eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js');
        const result = childProcess.spawnSync(process.execPath, [
            eslintBin, '--format', 'json',
            'app/(tabs)/library', 'src/components/library', 'src/components/notes', 'src/features/books/notes',
        ], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

        if (result.status !== 0 && result.status !== 1) {
            throw new Error(`ESLint failed (status ${result.status}): ${result.error || ''}\n${result.stderr}`);
        }

        const results = JSON.parse(result.stdout);
        const messages = results.flatMap(file => file.messages
            .filter(message => message.ruleId?.startsWith('book-section/'))
            .map(message => ({ ...message, file: path.relative(repoRoot, file.filePath).replace(/\\/g, '/') })));
        const counts = {};
        for (const message of messages) {
            counts[message.ruleId] ??= { 1: 0, 2: 0 };
            counts[message.ruleId][message.severity] += 1;
        }

        const errors = messages.filter(message => message.severity === 2);
        if (errors.length) {
            throw new Error(`Book-section errors must be zero; found ${errors.length}:\n${errors
                .map(message => `${message.file}:${message.line} ${message.ruleId}`).join('\n')}`);
        }

        const increases = ruleIds.flatMap(ruleId => {
            const current = counts[ruleId]?.[1] || 0;
            const limit = baseline.warnings[ruleId];
            if (current <= limit) return [];
            const locations = messages.filter(message => message.ruleId === ruleId && message.severity === 1)
                .slice(0, 10).map(message => `${message.file}:${message.line}`).join('\n');
            return [`${ruleId}: current ${current}, baseline ${limit}. First 10 offending file:line:\n${locations}`];
        });
        if (increases.length) throw new Error(increases.join('\n\n'));
        expect(increases).toHaveLength(0);
    }, 180000);
});
