import React from 'react';
import { readFileSync } from 'fs';
import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { getLibraryAppearance, LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import {
  BookButton, BookEmpty, BookError, BookLoading, BookOffline,
  type BookErrorKind, type BookLoadingVariant,
} from '@/components/library/ui';

const PHASES = ['daylight', 'golden', 'midnight'] as const;
let mockPhase: (typeof PHASES)[number] = 'daylight';
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));

const LOADING_VARIANTS: (BookLoadingVariant | undefined)[] = [undefined, 'list', 'details', 'note'];
const ERROR_CASES: { kind: BookErrorKind; title: string; message: string }[] = [
  { kind: 'server', title: "Couldn't load your notes.", message: 'Something went wrong on our side. Please try again.' },
  { kind: 'offline', title: "You're offline.", message: 'Reconnect to the internet to load your notes, then try again.' },
  { kind: 'notFound', title: "We can't find your notes.", message: 'It may have been removed.' },
];

it('exports all four state components through the UI index', () => {
  expect(typeof BookLoading).toBe('function');
  expect(typeof BookEmpty).toBe('function');
  expect(typeof BookError).toBe('function');
  expect(typeof BookOffline).toBe('function');
});

describe.each(PHASES)('BookStates in %s', phase => {
  beforeEach(() => { mockPhase = phase; });

  describe.each(LOADING_VARIANTS)('BookLoading variant %s', variant => {
    it.each([undefined, 'Fetching your notes'])('announces label %s once and hides all visual children', label => {
      const colors = getLibraryAppearance(phase);
      const tree = render(<BookLoading variant={variant} label={label} />);
      const status = tree.getByRole('status');
      expect(status.props.role).toBe('status');
      expect(status.props.accessible).toBe(true);
      expect(status.props.accessibilityLiveRegion).toBe('polite');
      expect(status.props.accessibilityLabel).toBe(label ?? 'Loading');
      expect(tree.getAllByRole('status')).toHaveLength(1);
      const views = tree.UNSAFE_getAllByType(View);
      const hidden = views.filter(view => view.props.importantForAccessibility === 'no-hide-descendants');
      expect(hidden).toHaveLength(1);
      expect(hidden[0].props.accessible).toBe(false);
      expect(hidden[0].props['aria-hidden']).toBe(true);
      expect(StyleSheet.flatten(status.props.style)).toMatchObject({
        width: '100%', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: LIBRARY_SPACING.lg, gap: LIBRARY_SPACING.md,
      });
      expect(StyleSheet.flatten(status.props.style).backgroundColor).toBeUndefined();
      expect(StyleSheet.flatten(hidden[0].props.style).backgroundColor).toBeUndefined();
      const spinners = tree.UNSAFE_queryAllByType(ActivityIndicator);
      expect(spinners).toHaveLength(variant === undefined ? 1 : 0);
      if (variant === undefined) {
        expect(spinners[0].props.size).toBe('large');
        expect(spinners[0].props.color).toBe(colors.accent);
        expect(hidden[0].findAllByType(ActivityIndicator)).toHaveLength(1);
      } else {
        const painted = (list: { props: ViewProps }[]) => list.filter(view => StyleSheet.flatten(view.props.style)?.backgroundColor !== undefined);
        const insideHidden = painted(hidden[0].findAllByType(View));
        expect(insideHidden.length).toBeGreaterThan(0);
        expect(insideHidden).toHaveLength(painted(views).length);
      }
      expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    });
  });

  it.each(['list', 'details', 'note'] as const)('renders the static %s skeleton geometry and phase colours', variant => {
    const colors = getLibraryAppearance(phase);
    const tree = render(<BookLoading variant={variant} />);
    const views = tree.UNSAFE_getAllByType(View);
    const blocks = views.map(view => StyleSheet.flatten(view.props.style) ?? {})
      .filter(style => style.backgroundColor !== undefined);
    const covers = blocks.filter(style => style.width === LIBRARY_SPACING.xxl);
    expect(covers).toHaveLength(variant === 'list' ? 5 : variant === 'details' ? 1 : 0);
    for (const cover of covers) {
      expect(cover).toMatchObject({
        height: LIBRARY_SPACING.xxl + LIBRARY_SPACING.lg,
        borderRadius: LIBRARY_RADIUS.control, backgroundColor: colors.coverPlaceholder,
      });
    }
    const bars = blocks.filter(style => style.width !== LIBRARY_SPACING.xxl);
    const expectedBars = variant === 'list'
      ? Array.from({ length: 5 }, () => [
        { width: '90%', height: LIBRARY_TEXT.heading.lineHeight },
        { width: '60%', height: LIBRARY_TEXT.body.lineHeight },
      ]).flat()
      : variant === 'details'
        ? [
          { width: '90%', height: LIBRARY_TEXT.heading.lineHeight },
          { width: '70%', height: LIBRARY_TEXT.body.lineHeight },
          { width: '100%', height: MIN_TARGET },
          ...['100%', '95%', '60%'].map(width => ({ width, height: LIBRARY_TEXT.body.lineHeight })),
        ]
        : [
          { width: '70%', height: LIBRARY_TEXT.heading.lineHeight },
          ...['100%', '96%', '100%', '92%', '55%'].map(width => ({ width, height: LIBRARY_TEXT.body.lineHeight })),
        ];
    expect(bars).toHaveLength(expectedBars.length);
    bars.forEach((bar, index) => {
      expect(bar).toMatchObject({ ...expectedBars[index], backgroundColor: colors.bgSecondary, borderRadius: LIBRARY_RADIUS.control });
    });
    const rows = tree.queryAllByTestId('book-loading-row', { includeHiddenElements: true });
    expect(rows).toHaveLength(variant === 'list' ? 5 : 0);
    const hidden = views.find(view => view.props.importantForAccessibility === 'no-hide-descendants')!;
    expect(hidden.findAllByType(View).filter((view: { props: ViewProps }) => view.props.testID === 'book-loading-row')).toHaveLength(variant === 'list' ? 5 : 0);
    expect(StyleSheet.flatten(hidden.props.style).gap).toBe(LIBRARY_SPACING.md);
    for (const row of rows) {
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', gap: LIBRARY_SPACING.md });
    }
    const lines = tree.queryAllByTestId('book-loading-line', { includeHiddenElements: true });
    expect(lines).toHaveLength(variant === 'note' ? 5 : 0);
    lines.forEach((line, index) => {
      expect(StyleSheet.flatten(line.props.style)).toMatchObject({
        ...expectedBars[index + 1], backgroundColor: colors.bgSecondary,
      });
    });
  });

  it('renders caller-supplied empty copy with heading/body styles and a polite live region', () => {
    const colors = getLibraryAppearance(phase);
    const tree = render(<BookEmpty title="A custom shelf" message="A custom explanation" />);
    const title = tree.getByRole('header');
    expect(title.props.children).toBe('A custom shelf');
    expect(StyleSheet.flatten(title.props.style)).toEqual({ ...LIBRARY_TEXT.heading, textAlign: 'center', color: colors.textPrimary });
    expect(StyleSheet.flatten(tree.getByText('A custom explanation').props.style)).toEqual({
      ...LIBRARY_TEXT.body, textAlign: 'center', color: colors.textSecondary,
    });
    expect(tree.UNSAFE_getAllByType(Text)).toHaveLength(2);
    expect(tree.UNSAFE_getAllByType(View)[0].props.accessibilityLiveRegion).toBe('polite');
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
  });

  it('omits an absent empty message and never invents an action for missing or partial action props', () => {
    const tree = render(<BookEmpty title="Only this title" />);
    expect(tree.UNSAFE_getAllByType(Text)).toHaveLength(1);
    expect(tree.getByRole('header').props.children).toBe('Only this title');
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    tree.rerender(<BookEmpty title="Only this title" actionLabel="Add a book" />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    tree.rerender(<BookEmpty title="Only this title" onAction={jest.fn()} />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
  });

  it.each([undefined, 'secondary'] as const)('uses the empty action variant %s and invokes its callback once', actionVariant => {
    const onAction = jest.fn();
    const tree = render(<BookEmpty title="Custom title" actionLabel="Custom action" actionVariant={actionVariant} onAction={onAction} />);
    const buttons = tree.UNSAFE_getAllByType(BookButton);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.variant).toBe(actionVariant ?? 'primary');
    expect(buttons[0].props.label).toBe('Custom action');
    expect(buttons[0].props.onPress).toBe(onAction);
    fireEvent.press(tree.getByRole('button', { name: 'Custom action' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it.each(ERROR_CASES)('renders exact neutral $kind copy with alert semantics and no unsolicited action', ({ kind, title, message }) => {
    const colors = getLibraryAppearance(phase);
    const tree = render(<BookError kind={kind} subject="your notes" />);
    const container = tree.UNSAFE_getAllByType(View)[0];
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessibilityLiveRegion).toBe('polite');
    expect(tree.getByRole('header').props.children).toBe(title);
    expect(tree.getByText(message).props.children).toBe(message);
    expect(StyleSheet.flatten(tree.getByRole('header').props.style)).toEqual({
      ...LIBRARY_TEXT.heading, textAlign: 'center', color: colors.textPrimary,
    });
    expect(StyleSheet.flatten(tree.getByText(message).props.style)).toEqual({
      ...LIBRARY_TEXT.body, textAlign: 'center', color: colors.textSecondary,
    });
    expect(tree.UNSAFE_getAllByType(Text)).toHaveLength(2);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
  });

  it('keeps the rendered titles and messages pairwise distinct across error kinds', () => {
    const tree = render(<BookError kind="server" subject="this book" />);
    const titles: string[] = [];
    const messages: string[] = [];
    for (const { kind } of ERROR_CASES) {
      tree.rerender(<BookError kind={kind} subject="this book" />);
      titles.push(tree.getByRole('header').props.children);
      messages.push(tree.UNSAFE_getAllByType(Text)[1].props.children);
    }
    expect(new Set(titles).size).toBe(3);
    expect(new Set(messages).size).toBe(3);
    expect(titles).toEqual(["Couldn't load this book.", "You're offline.", "We can't find this book."]);
    expect(messages[1]).toBe('Reconnect to the internet to load this book, then try again.');
  });

  it.each(['server', 'offline'] as const)('offers one primary retry for %s and ignores back props', kind => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    const tree = render(<BookError kind={kind} subject="this book" onRetry={onRetry} backLabel="Back to Library" onBack={onBack} />);
    const buttons = tree.UNSAFE_getAllByType(BookButton);
    expect(buttons).toHaveLength(1);
    expect(buttons.filter(button => button.props.variant === 'primary')).toHaveLength(1);
    expect(buttons[0].props.label).toBe('Try again');
    expect(buttons[0].props.onPress).toBe(onRetry);
    fireEvent.press(tree.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    tree.rerender(<BookError kind={kind} subject="this book" backLabel="Back to Library" onBack={onBack} />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
  });

  it('never retries notFound and only renders Back when both back props are supplied', () => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    const tree = render(<BookError kind="notFound" subject="this book" onRetry={onRetry} />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    tree.rerender(<BookError kind="notFound" subject="this book" onRetry={onRetry} backLabel="Back to Library" />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    tree.rerender(<BookError kind="notFound" subject="this book" onRetry={onRetry} onBack={onBack} />);
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
    tree.rerender(<BookError kind="notFound" subject="this book" onRetry={onRetry} backLabel="Back to Library" onBack={onBack} />);
    const buttons = tree.UNSAFE_getAllByType(BookButton);
    expect(buttons).toHaveLength(1);
    expect(buttons.filter(button => button.props.variant === 'primary')).toHaveLength(1);
    expect(buttons[0].props.label).toBe('Back to Library');
    expect(buttons[0].props.onPress).toBe(onBack);
    expect(tree.queryByRole('button', { name: 'Try again' })).toBeNull();
    fireEvent.press(tree.getByRole('button', { name: 'Back to Library' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Custom offline notice'])('renders offline message %s as an in-flow informational status', message => {
    const colors = getLibraryAppearance(phase);
    const tree = render(<BookOffline message={message} />);
    const box = tree.UNSAFE_getAllByType(View)[0];
    expect(box.props.role).toBe('status');
    expect(box.props.role).not.toBe('alert');
    expect(box.props.accessibilityRole).not.toBe('alert');
    expect(box.props.accessibilityLiveRegion).toBe('polite');
    const style = StyleSheet.flatten(box.props.style);
    expect(style).toMatchObject({ backgroundColor: colors.infoSurface, borderRadius: LIBRARY_RADIUS.control, padding: LIBRARY_SPACING.md });
    expect(style.position).not.toBe('absolute');
    const text = tree.getByText(message ?? "You're offline. Some things may not load or save until you reconnect.");
    expect(text.props.children).toBe(message ?? "You're offline. Some things may not load or save until you reconnect.");
    expect(StyleSheet.flatten(text.props.style)).toEqual({ ...LIBRARY_TEXT.body, textAlign: 'center', color: colors.info });
    expect(tree.UNSAFE_queryAllByType(BookButton)).toHaveLength(0);
  });
});

it('contains no hex or rgb colour literals in BookStates source', () => {
  const source = readFileSync(require.resolve('../BookStates'), 'utf8');
  expect(source).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\s*\(/i);
});
