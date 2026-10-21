import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PassageCard, PASSAGE_CARD_FIT_TIMEOUT_MS } from '../PassageCard';
import { getLibraryAppearance } from '../../LibraryAppearance';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'midnight' }) }));
jest.mock('../../LibraryTypography', () => ({ useLibraryTypography: () => ({
  serif: 'LibraryGaramondMedium', heading: 'LibraryGaramondSemiBold', body: 'LibraryManrope', label: 'LibraryManropeBold',
}), LIBRARY_TEXT: jest.requireActual('../../LibraryTypography').LIBRARY_TEXT }));

const props = { width: 360, quote: 'A quiet passage', title: 'Walden', author: 'Thoreau', page: 42 };
const quoteText = (ui: ReturnType<typeof render>) => ui.UNSAFE_getAllByType(Text)[0];
function layoutQuote(ui: ReturnType<typeof render>, count: number, line = '字'.repeat(10)) {
  fireEvent(quoteText(ui), 'textLayout', { nativeEvent: {
    lines: Array.from({ length: count }, (_, index) => ({ text: (index === 0 ? '“' : '') + line })),
  } });
}

it('uses daylight colours, library fonts, a small wordmark, and a capturable accessible view', () => {
  const ref = React.createRef<View>();
  const ui = render(<PassageCard ref={ref} {...props} />);
  const colors = getLibraryAppearance('daylight');
  const card = ui.getByRole('image', { name: 'Quote card: A quiet passage. Walden, Thoreau' });
  expect(card.props.collapsable).toBe(false);
  expect(ref.current).toBeTruthy();
  expect(StyleSheet.flatten(card.props.style)).toMatchObject({ width: 360, height: 450, backgroundColor: colors.bgPrimary });
  expect(StyleSheet.flatten(ui.getByText('“A quiet passage”').props.style)).toMatchObject({ color: colors.textPrimary, fontFamily: 'LibraryGaramondMedium', fontSize: 26, lineHeight: 36 });
  expect(StyleSheet.flatten(ui.getByText('Walden').props.style).fontFamily).toBe('LibraryGaramondSemiBold');
  expect(StyleSheet.flatten(ui.getByText('Thoreau · p. 42').props.style)).toMatchObject({ color: colors.textSecondary, fontFamily: 'LibraryManrope' });
  expect(StyleSheet.flatten(ui.getByText('BookConnect').props.style)).toMatchObject({ color: colors.textSecondary, fontFamily: 'LibraryManropeBold' });
  for (const text of ui.UNSAFE_getAllByType(Text)) expect(text.props.allowFontScaling).toBe(false);
});

it('scales the card, all text metrics, padding and gaps by width / 360', () => {
  const ui = render(<PassageCard {...props} />);
  expect(quoteText(ui).props.numberOfLines).toBeUndefined();
  layoutQuote(ui, 1);
  const before = ui.UNSAFE_getAllByType(Text).map(node => StyleSheet.flatten(node.props.style));
  const views = ui.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style));
  const lines = ui.getByText('“A quiet passage”').props.numberOfLines;
  expect(lines).toBeGreaterThan(0);
  ui.rerender(<PassageCard {...props} width={180} />);
  layoutQuote(ui, 1);
  const card = StyleSheet.flatten(ui.getByRole('image').props.style);
  expect(card).toMatchObject({ width: 180, height: 225 });
  ui.UNSAFE_getAllByType(Text).forEach((node, index) => {
    const style = StyleSheet.flatten(node.props.style);
    expect(style.fontSize).toBe(before[index].fontSize / 2);
    expect(style.lineHeight).toBe(before[index].lineHeight / 2);
  });
  ui.UNSAFE_getAllByType(View).forEach((node, index) => {
    const style = StyleSheet.flatten(node.props.style);
    for (const key of ['padding', 'marginTop', 'gap'] as const) {
      if (typeof views[index]?.[key] === 'number') expect(style[key]).toBe(views[index][key] / 2);
    }
  });
  expect(ui.getByText('“A quiet passage”').props.numberOfLines).toBe(lines);
});

it.each([
  ['Thoreau', 42, 'Thoreau · p. 42'], ['Thoreau', null, 'Thoreau'], [null, 42, 'p. 42'], [null, null, null],
])('joins or omits author %s and page %s', (author, page, meta) => {
  const ui = render(<PassageCard {...props} author={author} page={page} />);
  if (meta) expect(ui.getByText(meta)).toBeOnTheScreen();
  else expect(ui.UNSAFE_getAllByType(Text)).toHaveLength(3);
  expect(ui.queryByText(/null|undefined/)).toBeNull();
});

it('keeps the full original quote in the label even when the image is shortened', () => {
  const quote = 'किं'.repeat(381);
  const ui = render(<PassageCard {...props} quote={quote} author={null} />);
  expect(ui.getByRole('image').props.accessibilityLabel).toBe(`Quote card: ${quote}. Walden`);
  expect(ui.getByText(`“${'किं'.repeat(379)}…”`)).toBeOnTheScreen();
  const text = ui.getByText(`“${'किं'.repeat(379)}…”`);
  expect(StyleSheet.flatten(text.props.style)).toMatchObject({ fontSize: 18, lineHeight: 26 });
  expect(text.props.numberOfLines).toBeUndefined();
  layoutQuote(ui, 1);
  expect(quoteText(ui).props.numberOfLines).toBeGreaterThan(0);
});

describe('fit timeout', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('settles on the guess after 2000 ms without a layout event and reports once', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    act(() => { jest.advanceTimersByTime(1999); });
    expect(onFit).not.toHaveBeenCalled();
    expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    act(() => { jest.advanceTimersByTime(1); });
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledWith({ text: props.quote, fontSize: 26, lineHeight: 36, shortened: false });
    const area = ui.UNSAFE_getAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.justifyContent === 'center')!;
    expect(quoteText(ui).props.numberOfLines).toBe(Math.floor(StyleSheet.flatten(area.props.style).height / 36));
    expect(quoteText(ui).props.onTextLayout).toBeUndefined();
    expect(PASSAGE_CARD_FIT_TIMEOUT_MS).toBe(2000);
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it('clears the fallback timer when a layout event settles first', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    expect(jest.getTimerCount()).toBe(1);
    act(() => { jest.advanceTimersByTime(1000); });
    layoutQuote(ui, 2);
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledWith({ text: props.quote, fontSize: 26, lineHeight: 36, shortened: false });
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it('ignores a late layout event after timeout settlement', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    const nativeLayout = quoteText(ui).props.onTextLayout;
    act(() => { jest.advanceTimersByTime(2000); });
    const maxLines = quoteText(ui).props.numberOfLines;
    expect(onFit).toHaveBeenCalledTimes(1);
    act(() => nativeLayout({ nativeEvent: { lines: Array.from({ length: 100 }, () => ({ text: 'overflow' })) } }));
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(quoteText(ui).props.children).toBe('“A quiet passage”');
    expect(StyleSheet.flatten(quoteText(ui).props.style)).toMatchObject({ fontSize: 26, lineHeight: 36 });
    expect(quoteText(ui).props.numberOfLines).toBe(maxLines);
    expect(quoteText(ui).props.onTextLayout).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('restarts the timeout for a new candidate and settles that candidate', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    act(() => { jest.advanceTimersByTime(1000); });
    layoutQuote(ui, 100);
    expect(StyleSheet.flatten(quoteText(ui).props.style)).toMatchObject({ fontSize: 22, lineHeight: 31 });
    expect(jest.getTimerCount()).toBe(1);
    act(() => { jest.advanceTimersByTime(1999); });
    expect(onFit).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledWith({ text: props.quote, fontSize: 22, lineHeight: 31, shortened: false });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears a pending fallback on unmount without reporting a fit', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    expect(jest.getTimerCount()).toBe(1);
    ui.unmount();
    expect(jest.getTimerCount()).toBe(0);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(onFit).not.toHaveBeenCalled();
  });
});

describe('rendered line fitting', () => {
  it('fits first time without a cap and reports once after settling', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    const nativeLayout = quoteText(ui).props.onTextLayout;
    expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    expect(onFit).not.toHaveBeenCalled();
    layoutQuote(ui, 2);
    expect(onFit).toHaveBeenCalledWith({ text: props.quote, fontSize: 26, lineHeight: 36, shortened: false });
    expect(quoteText(ui).props.numberOfLines).toBeGreaterThanOrEqual(2);
    act(() => nativeLayout({ nativeEvent: { lines: [{ text: 'duplicate' }] } }));
    ui.rerender(<PassageCard {...props} onFit={onFit} />);
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it('steps down 26/36 → 22/31 → 18/26 and remeasures without a cap', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    layoutQuote(ui, 100);
    expect(StyleSheet.flatten(quoteText(ui).props.style)).toMatchObject({ fontSize: 22, lineHeight: 31 });
    expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    expect(onFit).not.toHaveBeenCalled();
    layoutQuote(ui, 100);
    expect(StyleSheet.flatten(quoteText(ui).props.style)).toMatchObject({ fontSize: 18, lineHeight: 26 });
    layoutQuote(ui, 1);
    expect(onFit).toHaveBeenCalledWith({ text: props.quote, fontSize: 18, lineHeight: 26, shortened: false });
  });

  it('truncates CJK to the visible floor line texts and reports shortened', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} quote={'字'.repeat(300)} onFit={onFit} />);
    layoutQuote(ui, 50);
    const candidate = String(quoteText(ui).props.children).slice(1, -1);
    const area = ui.UNSAFE_getAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.justifyContent === 'center')!;
    const maxLines = Math.floor(StyleSheet.flatten(area.props.style).height / 26);
    expect(candidate).toBe('字'.repeat(maxLines * 10) + '…');
    expect(onFit).not.toHaveBeenCalled();
    layoutQuote(ui, maxLines);
    expect(onFit).toHaveBeenCalledWith({ text: candidate, fontSize: 18, lineHeight: 26, shortened: true });
    expect(quoteText(ui).props.numberOfLines).toBe(maxLines);
  });

  it('drops more whole groups and measures again if the ellipsis wraps', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} quote={'किं'.repeat(300)} onFit={onFit} />);
    layoutQuote(ui, 50, 'किं'.repeat(10));
    const first = String(quoteText(ui).props.children).slice(1, -1);
    layoutQuote(ui, 50, first);
    const retried = String(quoteText(ui).props.children).slice(1, -1);
    expect(retried.length).toBeLessThan(first.length);
    expect(retried).toMatch(/^(किं)+…$/u);
    expect(onFit).not.toHaveBeenCalled();
    layoutQuote(ui, 1);
    expect(onFit).toHaveBeenCalledWith(expect.objectContaining({ text: retried, shortened: true }));
  });

  it('bounds truncation at 12 iterations and reports the last candidate', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} quote={'字'.repeat(380)} onFit={onFit} />);
    for (let iteration = 0; iteration < 12; iteration++) {
      layoutQuote(ui, 100, '字'.repeat(30));
      expect(onFit).not.toHaveBeenCalled();
      expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    }
    const last = String(quoteText(ui).props.children).slice(1, -1);
    layoutQuote(ui, 100);
    expect(onFit).toHaveBeenCalledTimes(1);
    expect(onFit).toHaveBeenCalledWith(expect.objectContaining({ text: last, shortened: true }));
    expect(quoteText(ui).props.onTextLayout).toBeUndefined();
    expect(quoteText(ui).props.numberOfLines).toBeGreaterThan(0);
  });

  it('renders the supplied preview fit exactly, scaled to width, without measuring', () => {
    const fit = { text: 'Fitted…', fontSize: 22, lineHeight: 31, shortened: true };
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} width={180} fit={fit} onFit={onFit} />);
    expect(quoteText(ui).props.children).toBe('“Fitted…”');
    expect(StyleSheet.flatten(quoteText(ui).props.style)).toMatchObject({ fontSize: 11, lineHeight: 15.5 });
    expect(quoteText(ui).props.onTextLayout).toBeUndefined();
    expect(quoteText(ui).props.numberOfLines).toBeGreaterThan(0);
    expect(onFit).not.toHaveBeenCalled();
  });

  it('shortens many short lines even below the 380-group initial budget', () => {
    const quote = Array.from({ length: 12 }, () => 'a').join('\n');
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} quote={quote} onFit={onFit} />);
    layoutQuote(ui, 12, 'a\n');
    expect(quoteText(ui).props.children).toContain('…');
    layoutQuote(ui, 2);
    expect(onFit).toHaveBeenCalledWith(expect.objectContaining({ shortened: true }));
  });

  it('resets measurement and reports again when quote or width changes', () => {
    const onFit = jest.fn();
    const ui = render(<PassageCard {...props} onFit={onFit} />);
    layoutQuote(ui, 1);
    ui.rerender(<PassageCard {...props} quote="Different" onFit={onFit} />);
    expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    layoutQuote(ui, 1);
    ui.rerender(<PassageCard {...props} quote="Different" width={180} onFit={onFit} />);
    expect(quoteText(ui).props.numberOfLines).toBeUndefined();
    layoutQuote(ui, 1);
    expect(onFit).toHaveBeenCalledTimes(3);
  });
});
