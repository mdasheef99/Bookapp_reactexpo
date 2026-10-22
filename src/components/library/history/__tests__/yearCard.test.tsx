import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { YearCard } from '../YearCard';
import { YearCardPreview } from '../YearCardPreview';
import { captureCardPng, releaseCardCapture } from '@/features/books/export/captureCard';
import { deliverImageFile } from '@/features/books/export/deliver';
import { buildFileName } from '@/features/books/export/fileName';

jest.mock('@/features/books/export/captureCard', () => ({
  captureCardPng: jest.fn(),
  releaseCardCapture: jest.fn(),
}));
jest.mock('@/features/books/export/deliver', () => ({
  deliverImageFile: jest.fn(),
  ExportUnavailableError: class ExportUnavailableError extends Error {},
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
let mockSerif = 'LibraryGaramondMedium';
jest.mock('../../LibraryTypography', () => ({
  ...jest.requireActual('../../LibraryTypography'),
  useLibraryTypography: () => ({
    serif: mockSerif,
    heading: 'LibraryGaramondSemiBold',
    body: 'LibraryManrope',
    label: 'LibraryManropeBold',
  }),
}));

const capture = jest.mocked(captureCardPng);
const deliver = jest.mocked(deliverImageFile);

const quotes = [
  { id: 'q-old', content: 'Older line.', created_at: '2026-01-01T10:00:00.000Z', user_book_id: 'book-a' },
  { id: 'q-new', content: 'Newest line.', created_at: '2026-06-01T10:00:00.000Z', user_book_id: 'book-b' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockSerif = 'LibraryGaramondMedium';
  jest.useFakeTimers().setSystemTime(new Date('2026-10-21T12:00:00Z'));
  capture.mockResolvedValue('file:///capture.png');
  deliver.mockResolvedValue('shared');
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('YearCard (H-18)', () => {
  it('titles the current year "so far" and a past year without it', () => {
    const currentYear = new Date().getFullYear();
    const current = render(<YearCard width={360} year={currentYear} books={5} pages={1200} quote={null} />);
    try {
      expect(current.getByText(`Your ${currentYear} so far`)).toBeOnTheScreen();
    } finally {
      current.unmount();
    }
    const past = render(<YearCard width={360} year={2000} books={5} pages={1200} quote={null} />);
    try {
      expect(past.getByText('Your 2000')).toBeOnTheScreen();
    } finally {
      past.unmount();
    }
  });

  it('shows year, books, pages, the quote and the BookConnect footer', () => {
    const ui = render(<YearCard width={360} year={2025} books={5} pages={1200} quote="A line." />);
    try {
      expect(ui.getByText('Your 2025')).toBeOnTheScreen();
      expect(ui.getByTestId('library-year-card-stats')).toHaveTextContent('5 books finished · 1200 pages read');
      expect(ui.getByTestId('library-year-card-quote')).toBeOnTheScreen();
      expect(ui.getByText('BookConnect')).toBeOnTheScreen();
    } finally {
      ui.unmount();
    }
  });
});

describe('YearCardPreview (H-18)', () => {
  function setup() {
    const onClose = jest.fn();
    const ui = render(
      <YearCardPreview visible year={2026} books={5} pages={1200} quotes={quotes} onClose={onClose} />,
    );
    return { ...ui, onClose };
  }

  it('renders nothing when not visible', () => {
    const ui = render(
      <YearCardPreview visible={false} year={2026} books={5} pages={1200} quotes={quotes} onClose={() => {}} />,
    );
    try {
      expect(ui.queryByTestId('library-year-card')).toBeNull();
    } finally {
      ui.unmount();
    }
  });

  it('defaults to the newest quote of the year and lets the reader pick another', () => {
    const ui = setup();
    try {
      expect(ui.getByTestId('library-year-card-quote')).toHaveTextContent('“Newest line.”');
      fireEvent.press(ui.getByTestId('library-year-card-quote-q-old'));
      expect(ui.getByTestId('library-year-card-quote')).toHaveTextContent('“Older line.”');
    } finally {
      ui.unmount();
    }
  });

  it('previews before sharing through capture + deliver', async () => {
    const ui = setup();
    try {
      expect(ui.getByTestId('library-year-card')).toBeOnTheScreen();
      expect(capture).not.toHaveBeenCalled();
      fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
      await ui.findByText('Share year card as image');
      expect(capture).toHaveBeenCalledTimes(1);
      expect(deliver).toHaveBeenCalledTimes(1);
      const args = deliver.mock.calls[0][0] as { fileName: string; sourceUri: string };
      expect(args.sourceUri).toBe('file:///capture.png');
      // `buildFileName` year-png kind: single year, no doubled year.
      expect(args.fileName).toMatch(/^bookconnect-year-\d{4}-\d{2}-\d{2}\.png$/);
      expect(args.fileName).not.toContain('2026-2026');
      expect(args.fileName).toBe(buildFileName('year-png', { kind: 'all' }, new Date('2026-10-21T12:00:00Z')));
      expect(ui.onClose).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
    }
  });

  it('keeps Share disabled until the library serif loads', () => {
    mockSerif = 'serif';
    const ui = setup();
    try {
      expect(ui.getByRole('button', { name: 'Share image' })).toBeDisabled();
    } finally {
      ui.unmount();
    }
  });
});
