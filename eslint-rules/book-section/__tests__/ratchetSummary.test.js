const path = require('node:path');
const { summarizeRatchet } = require('../ratchetSummary');

const repoRoot = path.resolve(__dirname, '../../..');
const file = (name, messages) => ({ filePath: path.join(repoRoot, name), messages });

describe('book-section ratchet summary', () => {
    it('counts book-section warnings across files and normalizes their locations', () => {
        const summary = summarizeRatchet([
            file('src/first.tsx', [
                { ruleId: 'book-section/no-raw-style-values', severity: 1, line: 3, message: 'Raw value' },
                { ruleId: 'book-section/require-accessible-name', severity: 1, line: 5, message: 'Missing name' },
            ]),
            file('src/second.tsx', [
                { ruleId: 'book-section/no-raw-style-values', severity: 1, line: 8, message: 'Raw value' },
            ]),
        ], repoRoot);

        expect(summary.counts).toEqual({
            'book-section/no-raw-style-values': { 1: 2, 2: 0 },
            'book-section/require-accessible-name': { 1: 1, 2: 0 },
        });
        expect(summary.messages.map(({ file, line }) => `${file}:${line}`)).toEqual([
            'src/first.tsx:3', 'src/first.tsx:5', 'src/second.tsx:8',
        ]);
    });

    it('fails with every fatal diagnostic even when no book-section messages exist', () => {
        expect(() => summarizeRatchet([
            file('src/first.tsx', [
                { ruleId: null, fatal: true, severity: 2, line: 4, message: 'Parsing error: Unexpected token' },
            ]),
            file('src/second.tsx', [
                { ruleId: null, fatal: true, severity: 2, line: 9, message: 'Parsing error: Unterminated string' },
            ]),
        ], repoRoot)).toThrow(
            'Fatal ESLint diagnostics must be zero; found 2:\n' +
            'src/first.tsx:4 Parsing error: Unexpected token\n' +
            'src/second.tsx:9 Parsing error: Unterminated string',
        );
    });

    it('ignores non-fatal severity-2 diagnostics from other rules', () => {
        expect(summarizeRatchet([
            file('src/first.tsx', [
                { ruleId: 'import/no-unresolved', fatal: false, severity: 2, line: 1, message: 'Unresolved import' },
                { ruleId: null, severity: 2, line: 2, message: 'Non-fatal diagnostic' },
            ]),
        ], repoRoot)).toEqual({ counts: {}, messages: [] });
    });

    it('fails on a book-section severity-2 diagnostic', () => {
        expect(() => summarizeRatchet([
            file('src/first.tsx', [
                { ruleId: 'book-section/no-fabricated-ratings', severity: 2, line: 7, message: 'Fabricated rating' },
            ]),
        ], repoRoot)).toThrow(
            'Book-section errors must be zero; found 1:\nsrc/first.tsx:7 book-section/no-fabricated-ratings',
        );
    });
});
