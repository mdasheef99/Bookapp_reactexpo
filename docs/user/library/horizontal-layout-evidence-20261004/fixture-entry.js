// Isolated overflow fixture; actual horizontal component/layout, mocked fonts/images/theme.
// No account/network query. Save uses a synthetic device-only key on port 19010.
import React from 'react';
import { AppRegistry, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryHorizontalShelf } from '../../../../src/components/library/LibraryHorizontalShelf';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { shelfOrderStorageKey, useShelfArrangement } from '../../../../src/features/books/hooks/useShelfArrangement';
import { LibraryArrangeControls } from '../../../../src/components/library/LibraryArrangeControls';
const h = React.createElement;
const books = Array.from({ length: 17 }, (_, i) => ({ id: `fixture-${i + 1}`, ownership: 'owned', reading_status: 'want_to_read',
    book: { title: `Book ${i + 1}`, authors: ['Fixture Author'], page_count: 100 + (i % 6) * 100 } }));
function Fixture() {
    const arrangement = useShelfArrangement('horizontal-fixture', books);
    const [dragging, setDragging] = React.useState(false);
    const [opened, setOpened] = React.useState('');
    return h(GestureHandlerRootView, { style: { flex: 1 } }, h(ScrollView, { showsVerticalScrollIndicator: false, scrollEnabled: !dragging, contentContainerStyle: { padding: 24 } },
        h(View, { style: { width: '100%', maxWidth: 552, alignSelf: 'center' } },
            h(Text, { style: { marginBottom: 12 } }, 'Isolated 17-book horizontal overflow fixture'),
            h(LibraryArrangeControls, { arrangement, bookCount: books.length, dragging, onEnter: arrangement.enter }),
            h(LibraryHorizontalShelf, { books: arrangement.orderedBooks, arrangement, onDraggingChange: setDragging, onBookPress: (book) => setOpened(book.id) }),
            h(Text, { testID: 'fixture-opened-book' }, opened),
            h(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Reset isolated fixture order',
                style: { minHeight: 44, justifyContent: 'center' },
                onPress: () => { void AsyncStorage.removeItem(shelfOrderStorageKey('horizontal-fixture')).then(arrangement.retryRead); } },
                h(Text, {}, 'Reset isolated fixture order')))));
}
AppRegistry.registerComponent('HorizontalFixture', () => Fixture);
AppRegistry.runApplication('HorizontalFixture', { rootTag: document.getElementById('root') });
