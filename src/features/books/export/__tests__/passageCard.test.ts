import { passageCardLayout, truncateToVisible, PASSAGE_CARD_REFERENCE_WIDTH, PASSAGE_CARD_ASPECT,
  PASSAGE_CARD_PIXELS, PASSAGE_CARD_MAX_GROUPS } from '../passageCard';

it('exports the reference dimensions and budget', () => {
  expect(PASSAGE_CARD_REFERENCE_WIDTH).toBe(360);
  expect(PASSAGE_CARD_ASPECT).toBe(1350 / 1080);
  expect(PASSAGE_CARD_PIXELS).toEqual({ width: 1080, height: 1350 });
  expect(PASSAGE_CARD_MAX_GROUPS).toBe(380);
});

it.each([
  [120, 26, 36, false], [121, 22, 31, false], [240, 22, 31, false],
  [241, 18, 26, false], [380, 18, 26, false], [381, 18, 26, true],
])('lays out %i groups at %i/%i (shortened=%s)', (size, fontSize, lineHeight, shortened) => {
  const result = passageCardLayout('a'.repeat(size));
  expect(result).toEqual({ text: 'a'.repeat(shortened ? 379 : size) + (shortened ? '…' : ''), fontSize, lineHeight, shortened });
});

it('weights each newline as 30 groups', () => {
  expect(passageCardLayout('a'.repeat(89) + '\nb').fontSize).toBe(26);
  expect(passageCardLayout('a'.repeat(90) + '\nb').fontSize).toBe(22);
  expect(passageCardLayout('a'.repeat(348) + '\nbx').shortened).toBe(false);
  expect(passageCardLayout('a'.repeat(348) + '\nbxx').shortened).toBe(true);
  const result = passageCardLayout('a'.repeat(330) + '\n' + 'b'.repeat(60));
  expect(result.text).toBe('a'.repeat(330) + '…');
});

it('normalises CRLF/CR, collapses excess blank lines and trims', () => {
  expect(passageCardLayout('  one\r\n\r\n\r\n two\rthree  ').text).toBe('one\n\n two\nthree');
  expect(passageCardLayout(' \r\n ')).toEqual({ text: '', fontSize: 26, lineHeight: 36, shortened: false });
});

it('cuts at the last whitespace within the final 40 groups', () => {
  expect(passageCardLayout('a'.repeat(350) + ' hello ' + 'b'.repeat(80)).text).toBe('a'.repeat(350) + ' hello…');
  expect(passageCardLayout('a'.repeat(338) + ' ' + 'b'.repeat(80)).text).toBe('a'.repeat(338) + ' ' + 'b'.repeat(40) + '…');
});

it.each(Array.from('.,;:!?-–—'))('removes trailing %s before the ellipsis', punctuation => {
  expect(passageCardLayout('a'.repeat(378) + punctuation + 'bb').text).toBe('a'.repeat(378) + '…');
});

it('adds exactly one ellipsis when the kept prefix already ends in one', () => {
  const result = passageCardLayout('a'.repeat(378) + '…bb');
  expect(result.shortened).toBe(true);
  expect(result.text).toBe('a'.repeat(378) + '…');
  expect(result.text.match(/…/gu)).toHaveLength(1);
});

it.each(['किं', 'ಕೀ'])('never splits a base from its marks in %s', syllable => {
  expect(passageCardLayout(syllable.repeat(380)).shortened).toBe(false);
  expect(passageCardLayout(syllable.repeat(381)).text).toBe(syllable.repeat(379) + '…');
});

describe('truncateToVisible', () => {
  it('cuts at the last word boundary within 40 groups', () => {
    expect(truncateToVisible('one two three four', 'one two thr')).toBe('one two…');
  });

  it('keeps the visible prefix when there is no whitespace', () => {
    expect(truncateToVisible('abcdefghij', 'abcdef')).toBe('abcdef…');
  });

  it.each(Array.from('.,;:!?-–—'))('strips trailing %s', punctuation => {
    expect(truncateToVisible(`hello${punctuation}world`, `hello${punctuation}`)).toBe('hello…');
  });

  it('retains complete Devanagari marks and excludes a partially visible group', () => {
    expect(truncateToVisible('किं'.repeat(6), 'किं'.repeat(3))).toBe('किं'.repeat(3) + '…');
    expect(truncateToVisible('किं'.repeat(6), 'किंक')).toBe('किं…');
  });

  it('cuts CJK without spaces at the visible group boundary', () => {
    expect(truncateToVisible('春風又綠江南岸明月', '春風又綠江南')).toBe('春風又綠江南…');
  });
});
