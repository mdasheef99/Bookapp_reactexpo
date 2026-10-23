const fs = require('node:fs');
const path = require('node:path');
const { ESLint, Linter } = require('eslint');
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

    it('keeps the reviewed Flow A, Flow B, C1, D1 and D2 strict file list exact and ordered', () => {
        expect(STRICT_FILES).toEqual([
            'app/(tabs)/library/search.tsx',
            'src/features/books/utils/searchErrorCopy.ts',
            'src/features/books/utils/searchPresentation.ts',
            'src/features/books/hooks/useSearchBookActions.ts',
            'src/components/library/search/BookCard.tsx',
            'src/components/library/search/FilterModal.tsx',
            'src/components/library/search/GenreTag.tsx',
            'src/components/library/search/InLibraryBadge.tsx',
            'src/components/library/search/ManualEntryModal.tsx',
            'src/components/library/search/PriceBadge.tsx',
            'src/components/library/search/RatingStars.tsx',
            'src/components/library/search/RecentSearches.tsx',
            'src/components/library/search/SearchSuggestions.tsx',
            'src/components/library/search/SearchStates.tsx',
            'src/components/library/search/SearchResultsHeader.tsx',
            'src/components/library/search/SortModal.tsx',
            'src/components/library/search/SwipeableBookCard.tsx',
            'src/components/library/search/WishlistButton.tsx',
            'app/(tabs)/library/index.tsx',
            'src/components/library/LibraryBookThumb.tsx',
            'src/components/library/LibraryBookList.tsx',
            'src/components/library/LibraryHeader.tsx',
            'src/components/library/LibraryFilterBar.tsx',
            'src/components/library/LibrarySummary.tsx',
            'src/components/library/index.ts',
            'app/(tabs)/library/[bookId].tsx',
            'src/components/library/StatusSelector.tsx',
            'src/components/library/OwnershipSelector.tsx',
            'src/components/library/ConditionPicker.tsx',
            'src/components/library/RatingInput.tsx',
            'src/components/library/DeleteBookModal.tsx',
            'src/components/library/export/ExportNotesDialog.tsx',
            'src/components/library/export/PassageCard.tsx',
            'src/components/library/export/PassageCardPreview.tsx',
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
            'src/components/notes/NoteCrop.tsx',
            'src/components/notes/NotePassageLink.tsx',
            'src/features/books/notes/noteSearch.ts',
            'src/components/notes/NoteSearchField.tsx',
            'app/(tabs)/library/notes-swipe.tsx',
            'src/features/books/notes/noteDeck.ts',
            'src/features/books/notes/noteSwipeConstants.ts',
            'src/features/books/notes/noteDeckCache.ts',
            'src/features/books/notes/useNoteDeck.ts',
            'src/components/library/notes-swipe/useNoteSwipeMotion.ts',
            'src/components/library/notes-swipe/NoteSwipeCard.tsx',
            'src/components/library/notes-swipe/NoteSwipeStack.tsx',
            'src/components/library/notes-swipe/NoteFullNoteSheet.tsx',
            'src/components/library/notes-swipe/NoteSwipeHomeTile.tsx',
            'src/components/library/notes-swipe/NoteDeckChips.tsx',
            'src/components/library/notes-swipe/NoteOrderMenu.tsx',
        ]);
    });

    it('resolves the real eslint.config.js to errors for every exact strict path and warnings elsewhere', async () => {
        let eslint = new ESLint({ cwd: repoRoot });
        try {
            await eslint.calculateConfigForFile(path.join(repoRoot, STRICT_FILES[0]));
        } catch (error) {
            // Jest's VM may forbid dynamic imports. Still evaluate the real flat config
            // and all its file patterns; never replace it with a test-only config.
            if (error.code !== 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG') throw error;
            eslint = new ESLint({ cwd: repoRoot, overrideConfigFile: true,
                overrideConfig: require(path.join(repoRoot, 'eslint.config.js')) });
        }
        const filenames = [...STRICT_FILES, 'src/components/library/LibraryBookPicker.tsx'];
        for (const filename of filenames) {
            const { rules } = await eslint.calculateConfigForFile(path.join(repoRoot, filename));
            for (const ruleId of ruleIds) {
                const severity = rules[ruleId][0];
                expect([filename, ruleId, severity === 'error' ? 2 : severity === 'warn' ? 1 : severity]).toEqual([
                    filename, ruleId, STRICT_FILES.includes(filename) ? 2 : 1,
                ]);
            }
        }
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
