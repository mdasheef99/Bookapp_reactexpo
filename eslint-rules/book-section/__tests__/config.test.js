const fs = require('node:fs');
const path = require('node:path');
const { Linter } = require('eslint');
const { createBookSectionConfig, STRICT_FILES, RAW_VALUE_ALLOW_LIST } = require('../config');

const repoRoot = path.resolve(__dirname, '../../..');
const ruleIds = [
    'book-section/no-raw-style-values',
    'book-section/require-accessible-name',
    'book-section/no-fabricated-ratings',
];
const parserEntry = {
    files: ['src/**/*.tsx'],
    languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
};
const code = "const a = { padding: 12 }; const b = <Pressable />; const c = '(3 reviews)';";
const options = {
    files: ['src/**/*.tsx'],
    strictFiles: ['src/strict.tsx'],
    rawValueAllowFiles: ['src/allowed.tsx'],
};

describe('book-section flat config', () => {
    it.each([
        ['src/strict.tsx', 2],
        ['src/other.tsx', 1],
    ])('sets all three rules in %s to severity %i', (filename, severity) => {
        const linter = new Linter({ configType: 'flat' });
        const messages = linter.verify(code, [parserEntry, ...createBookSectionConfig(options)], { filename });
        expect(messages.map(message => [message.ruleId, message.severity])).toEqual(
            ruleIds.map(ruleId => [ruleId, severity]),
        );
    });

    it('turns off only raw values in an allowed file', () => {
        const linter = new Linter({ configType: 'flat' });
        const messages = linter.verify(code, [parserEntry, ...createBookSectionConfig(options)], { filename: 'src/allowed.tsx' });
        expect(messages.map(message => [message.ruleId, message.severity])).toEqual(
            ruleIds.slice(1).map(ruleId => [ruleId, 1]),
        );
    });

    it('keeps accessible-name and rating errors when a strict file is also allowed', () => {
        const linter = new Linter({ configType: 'flat' });
        const config = createBookSectionConfig({ ...options, rawValueAllowFiles: options.strictFiles });
        const messages = linter.verify(code, [parserEntry, ...config], { filename: 'src/strict.tsx' });
        expect(messages.map(message => [message.ruleId, message.severity])).toEqual(
            ruleIds.slice(1).map(ruleId => [ruleId, 2]),
        );
    });

    it('omits the strict entry when strictFiles is empty', () => {
        const config = createBookSectionConfig({ ...options, strictFiles: [] });
        expect(config).toHaveLength(2);
        for (const entry of config) {
            if (entry.files) expect(entry.files.length).toBeGreaterThan(0);
        }
    });

    it('omits both optional entries when both lists are empty', () => {
        const config = createBookSectionConfig({ ...options, strictFiles: [], rawValueAllowFiles: [] });
        expect(config).toHaveLength(1);
        expect(config[0].files).toEqual(options.files);
    });

    it('exports the strict file list', () => {
        expect(Array.isArray(STRICT_FILES)).toBe(true);
    });

    it('keeps the reviewed nine-file raw-value allow-list exact', () => {
        expect(RAW_VALUE_ALLOW_LIST).toEqual([
            'src/components/library/LibraryAppearance.ts',
            'src/components/library/LibraryTypography.tsx',
            'src/components/library/bookClothTexture.ts',
            'src/components/library/cabinetWoodTexture.ts',
            'src/components/library/BookSpine.tsx',
            'src/components/library/LibraryShelf.tsx',
            'src/components/library/LibraryHorizontalShelf.tsx',
            'src/components/library/HorizontalBookVolume.tsx',
            'src/features/books/utils/shelfLayout.ts',
        ]);
    });

    it.each([...RAW_VALUE_ALLOW_LIST, ...STRICT_FILES])('references an existing file: %s', filename => {
        expect(fs.statSync(path.resolve(repoRoot, filename)).isFile()).toBe(true);
    });
});
