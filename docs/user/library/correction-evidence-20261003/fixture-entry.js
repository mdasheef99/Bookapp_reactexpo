// Isolated DOM fixture: actual BookList/Picker/filter/appearance code, no auth or business data.
// Theme, typography and cover images are stubbed; this cannot certify native behavior.
import React from 'react';
import { AppRegistry, Pressable, Text, View } from 'react-native';
import { LibraryBookList } from '../../../../src/components/library/LibraryBookList';
import { LibraryBookPicker } from '../../../../src/components/library/LibraryBookPicker';
import { LibraryFilterBar } from '../../../../src/components/library/LibraryFilterBar';
import { LibrarySummary } from '../../../../src/components/library/LibrarySummary';
import { filterLibraryBooks, getLibraryFilterChips, getLibraryFilterLabel } from '../../../../src/features/books/utils/libraryShelf';
import { FixtureTheme } from './fixture-theme';
const h = React.createElement;
const books = Array.from({ length: 1000 }, (_, i) => ({ id: `large-${i}`, ownership: i % 4 === 0 ? 'wishlist' : 'owned',
    reading_status: i % 2 ? 'reading' : 'completed', book: { title: `Book ${i + 1} — ${i % 5 ? 'Duplicate title' : 'A very long title '.repeat(8)}`, authors: i % 3 ? ['Fixture Author'] : null, cover_url: null } }));

function Fixture() {
    const [phase, setPhase] = React.useState('daylight');
    const [filter, setFilter] = React.useState('all');
    const [selection, setSelection] = React.useState('None');
    const [mode, setMode] = React.useState('list');
    const chips = getLibraryFilterChips(books);
    const filtered = React.useMemo(() => filterLibraryBooks(books, filter), [filter]);
    const header = h(View, null,
        h(Text, { style: { color: phase === 'midnight' ? '#f3eada' : '#30291f', fontSize: 18 } }, '1,000-book fixture — actual collection components; effects/fonts/covers mocked'),
        h(LibraryFilterBar, { chips, activeFilter: filter, onChange: setFilter }),
        h(LibrarySummary, { count: filtered.length, activeFilterLabel: getLibraryFilterLabel(chips, filter) }));
    const control = (name, onPress) => h(Pressable, { key: name, accessibilityRole: 'button', onPress,
        style: { minHeight: 44, padding: 8, backgroundColor: '#fffdf8', borderWidth: 1, margin: 2 } }, h(Text, { style: { color: '#30291f' } }, name));
    return h(FixtureTheme.Provider, { value: { phase } }, h(View, { style: { flex: 1, backgroundColor: phase === 'midnight' ? '#211e1a' : '#faf6ee' } },
        h(View, { style: { flexDirection: 'row', flexWrap: 'wrap' } },
            ...['daylight', 'golden', 'midnight'].map((value) => control(value, () => setPhase(value))),
            control(mode === 'list' ? 'Picker fixture' : 'List fixture', () => setMode(mode === 'list' ? 'picker' : 'list'))),
        h(Text, { testID: 'fixture-selection', style: { color: phase === 'midnight' ? '#f3eada' : '#30291f' } }, `Selected: ${selection}`),
        h(View, { style: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 24 } },
            mode === 'list' ? h(LibraryBookList, { books: filtered, activeFilter: filter, activeFilterLabel: getLibraryFilterLabel(chips, filter),
                isRefetching: false, onRefresh: () => {}, onBookPress: (book) => setSelection(book.id), header }) :
                h(View, null, header, h(LibraryBookPicker, { books: filtered, onBookPress: (book) => setSelection(book.id) })))));
}
AppRegistry.registerComponent('LibraryCorrectionFixture', () => Fixture);
AppRegistry.runApplication('LibraryCorrectionFixture', { rootTag: document.getElementById('root') });
