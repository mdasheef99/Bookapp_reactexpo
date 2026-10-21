// SDD-07 FU-5a: lint is scoped to the book section only; the wider app is not linted yet.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const { createBookSectionConfig, STRICT_FILES, RAW_VALUE_ALLOW_LIST } = require('./eslint-rules/book-section/config');

const BOOK_SECTION = [
    'app/(tabs)/library/**/*.{ts,tsx}',
    'src/components/library/**/*.{ts,tsx}',
    'src/components/notes/**/*.{ts,tsx}',
    'src/features/books/notes/**/*.{ts,tsx}',
    'src/features/books/utils/searchErrorCopy.ts',
    'src/features/books/utils/searchPresentation.ts',
    'src/features/books/hooks/useSearchBookActions.ts',
];

module.exports = defineConfig([
    ...expoConfig.map(config => ({ ...config, files: BOOK_SECTION })),
    { ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'] },
    ...createBookSectionConfig({ files: BOOK_SECTION, strictFiles: STRICT_FILES, rawValueAllowFiles: RAW_VALUE_ALLOW_LIST }),
]);
