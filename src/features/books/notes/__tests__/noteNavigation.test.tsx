/** Actual React Navigation StackRouter state transitions with a simulated Expo imperative adapter; not device proof. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StackActions, StackRouter } from '@react-navigation/routers';
import NotesScreen from '../../../../../app/(tabs)/library/notes';
import { noteRouteContext, registerNoteContext, returnFromNote, returnToSavedReader } from '../noteNavigation';

const mockReducer = StackRouter({ initialRouteName: '[bookId]' });
const mockOptions = { routeNames: ['[bookId]', 'notes', 'note', 'note-compose'], routeParamList: {}, routeGetIdList: {} };
let mockState: any;
let mockId = 0;
function mockDispatch(action: any) { mockState = mockReducer.getStateForAction(mockState, action, mockOptions) ?? mockState; }
function mockReplace(href: any) { const name = href.pathname.split('/').at(-1); mockDispatch(StackActions.replace(name, href.params)); }
const mockRouter = { back: jest.fn(() => mockDispatch({ type: 'GO_BACK' })), dismiss: jest.fn((count: number) => mockDispatch(StackActions.pop(count))), replace: jest.fn(mockReplace), canGoBack: () => mockState.index > 0 };
const mockNavigation = { getState: () => mockState };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockState.routes[mockState.index].params, useRouter: () => mockRouter, useNavigation: () => mockNavigation }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `context-${++mockId}` }));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteContext: () => ({ actorId: 'actor', book: { data: { id: 'book', title: 'Selected book' }, isPending: false, isError: false } }), useNoteOperations: () => [] }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isPending: false, isError: false }) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: { textPrimary: '#111', textSecondary: '#444', bgPrimary: '#FFF', bgCard: '#FFF', accent: '#24543C', error: '#B42318', border: '#819283' } }) }));
function push(name: string, params: Record<string, string>) { mockDispatch(StackActions.push(name, params)); }
beforeEach(() => {
  jest.clearAllMocks(); mockState = mockReducer.getInitialState(mockOptions); mockState.routes[0].params = { bookId: 'book' };
});
it('returns Book Details → Notes → Back to the retained book without duplicating it', () => {
  const bookKey = mockState.routes[0].key; push('notes', { userBookId: 'book' });
  render(<NotesScreen />); fireEvent.press(screen.getByRole('button', { name: 'Back to Book details' }));
  expect(mockState.routes).toHaveLength(1); expect(mockState.routes[0].key).toBe(bookKey); expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('returns a preview-origin pending edit reader past its Notes re-entry to the retained Book Details', () => {
  const bookKey = mockState.routes[0].key; push('notes', { userBookId: 'book' }); push('note', { bookId: 'book', noteId: 'note' });
  const context = noteRouteContext(registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }), 'actor', 'book');
  (returnFromNote as any)(mockRouter, context, mockNavigation);
  expect(mockState.routes).toHaveLength(1); expect(mockState.routes[0].key).toBe(bookKey); expect(mockRouter.dismiss).toHaveBeenCalledWith(2);
});
it('returns a collection reader to the same retained collection route', () => {
  push('notes', { userBookId: 'book' }); const key = mockState.routes[1].key; push('note', { bookId: 'book', noteId: 'note' });
  const context = noteRouteContext(registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'collection', canBack: true }), 'actor', 'book');
  (returnFromNote as any)(mockRouter, context, mockNavigation);
  expect(mockState.routes).toHaveLength(2); expect(mockState.routes[1].key).toBe(key);
});
it('uses a selected-book fallback when the preceding Book Details belongs to another book', () => {
  mockState.routes[0].params = { bookId: 'other-book' }; push('note', { bookId: 'book', noteId: 'note' });
  const context = noteRouteContext(registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }), 'actor', 'book');
  (returnFromNote as any)(mockRouter, context, mockNavigation);
  expect(mockState.routes.at(-1)).toMatchObject({ name: '[bookId]', params: { bookId: 'book' } }); expect(mockRouter.back).not.toHaveBeenCalled();
});
it('uses a safe fallback when navigation state is unavailable', () => {
  const context = noteRouteContext(registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true }), 'actor', 'book');
  (returnFromNote as any)(mockRouter, context, { getState: () => undefined });
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/(tabs)/library/[bookId]', params: { bookId: 'book' } }); expect(mockRouter.back).not.toHaveBeenCalled();
});
it('returns an edit to its exact original reader without limiting normal browsing of other readers', () => {
  push('note', { bookId: 'book', noteId: 'note' }); const originalKey = mockState.routes.at(-1).key;
  push('notes', { userBookId: 'book' }); push('note', { bookId: 'book', noteId: 'note' }); push('note-compose', { bookId: 'book' });
  const context = noteRouteContext(registerNoteContext({ actorId: 'actor', bookId: 'book', origin: 'book', canBack: true, readerKey: originalKey }), 'actor', 'book');
  returnToSavedReader(mockRouter as any, mockNavigation, context, 'note');
  expect(mockState.routes).toHaveLength(2); expect(mockState.routes.at(-1).key).toBe(originalKey); expect(mockRouter.dismiss).toHaveBeenCalledWith(3);
});
