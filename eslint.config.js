// SDD-07 FU-5a: lint is scoped to the book section only; the wider app is not linted yet.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const BOOK_SECTION = [
    'app/(tabs)/library/**/*.{ts,tsx}',
    'src/components/library/**/*.{ts,tsx}',
    'src/components/notes/**/*.{ts,tsx}',
    'src/features/books/notes/**/*.{ts,tsx}',
];

module.exports = defineConfig([
    ...expoConfig.map(config => ({ ...config, files: BOOK_SECTION })),
    { ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'] },
]);
