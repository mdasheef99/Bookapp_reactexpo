import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import { ReadingTimeline } from '../ReadingTimeline';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { ManualNote } from '@/features/books/notes/manualNoteContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  manualNotesGateway: { list: jest.fn() },
}));

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: '2026-10-01',
    ended_on: '2026-10-20',
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

function baseNote(overrides: Partial<ManualNote> = {}): ManualNote {
  return {
    id: 'note-1',
    user_id: 'actor',
    user_book_id: 'book-1',
    content: 'First line\nSecond line',
    tag: 'reflect',
    page_number: null,
    created_at: '2026-10-02T12:00:00.000Z',
    updated_at: null,
    ...overrides,
  };
}

function renderTimeline(props: Partial<React.ComponentProps<typeof ReadingTimeline>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <ReadingTimeline
        actorId="actor"
        userBookId="book-1"
        reads={[baseRead()]}
        notes={[baseNote()]}
        timeZone="UTC"
        onOpenNotes={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReadingTimeline', () => {
  it('shows the newest read first and switches with the selector', async () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-09-01', ended_on: '2026-09-10' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-01', ended_on: '2026-10-20' }),
    ];
    const notes = [
      baseNote({ id: 'n1', created_at: '2026-09-02T12:00:00.000Z', content: 'Older read note' }),
      baseNote({ id: 'n2', created_at: '2026-10-12T12:00:00.000Z', content: 'Newer read note' }),
    ];
    const onOpenNotes = jest.fn();
    const ui = renderTimeline({ reads, notes, onOpenNotes });
    try {
      expect(await ui.findByTestId('library-timeline-read-read-2')).toBeOnTheScreen();
      expect(ui.getByTestId('library-timeline-note-n2')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-timeline-note-n1')).toBeNull();
      fireEvent.press(ui.getByTestId('library-timeline-select-read-1'));
      expect(await ui.findByTestId('library-timeline-read-read-1')).toBeOnTheScreen();
      expect(ui.getByTestId('library-timeline-note-n1')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows at most 5 notes then All notes', async () => {
    const reads = [baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-20' })];
    const notes = Array.from({ length: 6 }, (_, index) =>
      baseNote({ id: `n${index}`, created_at: `2026-10-${String(10 + index).padStart(2, '0')}T12:00:00.000Z`, content: `Note ${index}` }),
    );
    const onOpenNotes = jest.fn();
    const ui = renderTimeline({ reads, notes, onOpenNotes });
    try {
      expect(await ui.findByTestId('library-timeline-read-read-1')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-timeline-note-n0')).toBeNull();
      expect(ui.getByTestId('library-timeline-note-n5')).toBeOnTheScreen();
      const all = await ui.findByTestId('library-timeline-all-notes-read-1');
      fireEvent.press(all);
      expect(onOpenNotes).toHaveBeenCalledWith('read-1');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders finished and stopped wording with dates', async () => {
    const finished = renderTimeline({
      reads: [baseRead({ id: 'read-1', outcome: 'finished', started_on: '2026-10-01', ended_on: '2026-10-20' })],
      notes: [],
    });
    try {
      expect(await finished.findByTestId('library-timeline-start-read-1')).toHaveTextContent(/Started/);
      expect(finished.getByTestId('library-timeline-end-read-1')).toHaveTextContent(/Finished/);
    } finally {
      finished.unmount();
      finished.client.clear();
    }

    const stopped = renderTimeline({
      reads: [baseRead({ id: 'read-1', outcome: 'did_not_finish', started_on: '2026-10-01', ended_on: '2026-10-12' })],
      notes: [],
    });
    try {
      expect(await stopped.findByTestId('library-timeline-end-read-1')).toHaveTextContent(/Stopped/);
    } finally {
      stopped.unmount();
      stopped.client.clear();
    }
  });

  it('shows Start date unknown and Other notes', async () => {
    const reads = [baseRead({ id: 'read-1', started_on: null, started_at: null, start_unknown: true, ended_on: '2026-10-20' })];
    const notes = [baseNote({ id: 'other', created_at: '2026-10-25T12:00:00.000Z', content: 'Outside every read' })];
    const ui = renderTimeline({ reads, notes });
    try {
      expect(await ui.findByTestId('library-timeline-start-read-1')).toHaveTextContent(/Start date unknown/);
      expect(await ui.findByTestId('library-timeline-other-notes')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('cuts a long note preview with an ellipsis and without a line cap', async () => {
    const long = `${'a'.repeat(200)} second line`;
    const ui = renderTimeline({ notes: [baseNote({ content: long })] });
    try {
      const note = await ui.findByTestId('library-timeline-note-note-1');
      expect(note).toHaveTextContent(/…/);
      expect(note).not.toHaveTextContent(/second line/);
      const preview = ui.UNSAFE_root.findAll(
        (node: any) => typeof node.type === 'string' && node.props.testID === undefined && typeof node.props.children === 'string' && node.props.children.includes('a'.repeat(10)),
      );
      for (const node of preview) {
        expect(node.props.numberOfLines).toBeUndefined();
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('exposes the selected read in the accessible label', async () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-09-01', ended_on: '2026-09-10' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-01', ended_on: '2026-10-20' }),
    ];
    const ui = renderTimeline({ reads, notes: [] });
    try {
      const selected = await ui.findByTestId('library-timeline-select-read-2');
      expect(selected.props.accessibilityLabel).toMatch(/Read 2, showing/);
      expect(selected.props.accessibilityState.selected).toBe(true);
      const other = ui.getByTestId('library-timeline-select-read-1');
      expect(other.props.accessibilityLabel).not.toMatch(/showing/);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
