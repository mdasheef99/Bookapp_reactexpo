const plugin = require('./index');

// Each flow adds its migrated files; entries are repo-relative paths with forward slashes.
const STRICT_FILES = [
    'app/(tabs)/library/[bookId].tsx',
    'src/components/library/StatusSelector.tsx',
    'src/components/library/OwnershipSelector.tsx',
    'src/components/library/ConditionPicker.tsx',
    'src/components/library/RatingInput.tsx',
    'src/components/library/DeleteBookModal.tsx',
    'src/components/library/VaultPagesList.tsx',
    'src/components/library/bookDetails/BookCover.tsx',
    'src/components/library/bookDetails/ChoiceRadioGroup.tsx',
    'src/components/library/bookDetails/DetailRow.tsx',
    'src/components/library/bookDetails/NotePassages.tsx',
    'src/components/library/bookDetails/bookDetailsTokens.ts',
    'src/components/library/bookDetails/classifyBookLoadError.ts',
    'app/(tabs)/library/notes.tsx',
    'app/(tabs)/library/note.tsx',
    'app/(tabs)/library/note-compose.tsx',
    'src/components/notes/ManualNoteUi.tsx',
    'src/components/notes/NotePassageLink.tsx',
];

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
        const strictPatterns = strictFiles.map(filename => filename.replace(/[()[\]{}*?!+@]/g, '\\$&'));
        config.push({ files: strictPatterns, rules: Object.fromEntries(Object.keys(rules).map(ruleId => [ruleId, 'error'])) });
    }
    if (rawValueAllowFiles.length > 0) {
        config.push({ files: rawValueAllowFiles, rules: { 'book-section/no-raw-style-values': 'off' } });
    }
    return config;
}

module.exports = { createBookSectionConfig, STRICT_FILES, RAW_VALUE_ALLOW_LIST };
