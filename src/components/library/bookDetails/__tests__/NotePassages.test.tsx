import React from 'react';
import { render } from '@testing-library/react-native';
import { NotePassages } from '../NotePassages';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));

describe('Flow A fix round 1 note announcements', () => {
  it.each([
    { state: 'no data', notes: undefined, message: "Couldn't load your notes." },
    { state: 'empty data', notes: [], message: "Couldn't refresh notes." },
    { state: 'populated data', notes: [{ id: 'n1', content: 'Kept passage', created_at: '2026-10-14', tag: null, page_number: null } as ManualNote], message: "Couldn't refresh notes." },
  ])('R10 announces errors politely with $state', ({ notes, message }) => {
    const ui = render(<NotePassages notes={notes} isPending={false} isError onRetry={jest.fn()} />);
    expect(ui.getByText(message).props.accessibilityLiveRegion).toBe('polite');
  });
});
