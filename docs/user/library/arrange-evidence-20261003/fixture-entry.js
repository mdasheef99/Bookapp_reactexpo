// Isolated 80-book Arrange fixture. Actual order/storage, gestures and Shelf code;
// theme, typography, icons and image rendering stubbed. No auth/database access.
import React from 'react';
import { AppRegistry, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LibraryShelf } from '../../../../src/components/library/LibraryShelf';
import { LibraryArrangeControls } from '../../../../src/components/library/LibraryArrangeControls';
import { useShelfArrangement } from '../../../../src/features/books/hooks/useShelfArrangement';
import { FixtureTheme } from './fixture-theme';
const h = React.createElement;
const books = Array.from({ length: 80 }, (_, i) => ({ id: `arrange-${i + 1}`, ownership: 'owned', reading_status: 'to_read',
    book: { title: `Book ${i + 1}`, authors: ['Fixture Author'], page_count: 100 + (i % 6) * 100 } }));
function Fixture() {
    const arrangement = useShelfArrangement('isolated-arrange-fixture', books);
    const [dragging, setDragging] = React.useState(false);
    return h(GestureHandlerRootView, { style: { flex: 1 } }, h(FixtureTheme.Provider, { value: { phase: 'daylight' } },
        h(ScrollView, { scrollEnabled: !dragging, contentContainerStyle: { padding: 24 } },
            h(View, { style: { width: '100%', maxWidth: 552, alignSelf: 'center' } },
                h(Text, { style: { fontSize: 15, marginBottom: 12 } }, 'Isolated 80-book Arrange fixture — real components; theme/fonts/images stubbed'),
                h(LibraryArrangeControls, { arrangement, onEnter: arrangement.enter, bookCount: books.length, dragging }),
                h(LibraryShelf, { books: arrangement.orderedBooks, onBookPress: () => {}, arrangement, onDraggingChange: setDragging }),
                h(Text, { testID: 'fixture-order', style: { marginTop: 20 } }, arrangement.order.join(','))))));
}
AppRegistry.registerComponent('LibraryArrangeFixture', () => Fixture);
AppRegistry.runApplication('LibraryArrangeFixture', { rootTag: document.getElementById('root') });
