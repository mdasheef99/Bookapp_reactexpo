const plugin = require('./index');

// Each flow adds its migrated files; entries are repo-relative paths with forward slashes.
const STRICT_FILES = [];

const RAW_VALUE_ALLOW_LIST = [
    'src/components/library/LibraryAppearance.ts',
    'src/components/library/LibraryTypography.tsx',
    'src/components/library/bookClothTexture.ts',
    'src/components/library/cabinetWoodTexture.ts',
    'src/components/library/BookSpine.tsx',
    'src/components/library/LibraryShelf.tsx',
    'src/components/library/LibraryHorizontalShelf.tsx',
    'src/components/library/HorizontalBookVolume.tsx',
    'src/features/books/utils/shelfLayout.ts',
];
// NOTE_TAG_CONFIG (SDD-07 DP-02 allow-list item) lives in src/features/books/services/notesService.ts,
// outside the lint scope, so it needs no entry. If it ever moves into a linted file,
// add that file here with reviewer sign-off.

function createBookSectionConfig({ files, strictFiles, rawValueAllowFiles }) {
    const rules = {
        'book-section/no-raw-style-values': 'warn',
        'book-section/require-accessible-name': 'warn',
        'book-section/no-fabricated-ratings': 'warn',
    };
    const config = [{ files, plugins: { 'book-section': plugin }, rules }];
    if (strictFiles.length > 0) {
        config.push({ files: strictFiles, rules: Object.fromEntries(Object.keys(rules).map(ruleId => [ruleId, 'error'])) });
    }
    if (rawValueAllowFiles.length > 0) {
        config.push({ files: rawValueAllowFiles, rules: { 'book-section/no-raw-style-values': 'off' } });
    }
    return config;
}

module.exports = { createBookSectionConfig, STRICT_FILES, RAW_VALUE_ALLOW_LIST };
