import { fireEvent, render, within } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { EditionOptionList } from '../components/EditionOptionList';
import { MetadataCover } from '../components/MetadataCover';
import type { EditionRow } from '../contracts/ownerEditionPicker';
import { pickerSnapshot } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('expo-image', () => ({ Image: (props: object) => {
  const React = require('react'); const { View } = require('react-native');
  return React.createElement(View, props);
} }));
const rows: EditionRow[] = Array.from({ length: 10 }, (_, ordinal) => ({
  optionId: testUuid(20 + ordinal), ordinal,
  googleBooksUrl: 'https://books.google.com/books?id=duplicate', eligibility: 'eligible',
  metadata: { ...pickerSnapshot, title: 'Duplicate title', authors: ['First author', 'Second author'],
    publishedDate: ordinal === 0 ? '2002-03' : '2002', publisher: 'Publisher',
    isbn13: '9780140328721', coverReference: ordinal === 0
      ? 'https://books.google.com/books/content?id=duplicate&printsec=frontcover' : null },
}));
it('shows five original positions then all ten, preserving duplicate identities and order', () => {
  const onSelect = jest.fn();
  const view = render(<EditionOptionList rows={rows} selectedOptionId={rows[1].optionId} disabled={false} onSelect={onSelect} />);
  expect(view.getAllByTestId(/^edition-row-/).map(node => node.props.testID)).toEqual(rows.slice(0, 5).map(row => `edition-row-${row.optionId}`));
  expect(view.getAllByText('Duplicate title')).toHaveLength(5);
  fireEvent.press(view.getByText('Show all'));
  expect(view.getAllByTestId(/^edition-row-/).map(node => node.props.testID)).toEqual(rows.map(row => `edition-row-${row.optionId}`));
  fireEvent.press(view.getByLabelText('Select result 10: Duplicate title'));
  expect(onSelect).toHaveBeenCalledWith(rows[9]);
  expect(view.getByLabelText('Select result 2: Duplicate title').props.accessibilityState).toMatchObject({ selected: true });
});
it('displays own cover, all authors, supplied date precision, secondary details and validated attribution/link', () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const view = render(<EditionOptionList rows={rows.slice(0, 2)} selectedOptionId={null} disabled={false} onSelect={jest.fn()} />);
  const first = within(view.getByTestId(`edition-row-${rows[0].optionId}`));
  expect(first.getByLabelText('Cover for Duplicate title').props.source.uri).toBe(rows[0].metadata!.coverReference);
  expect(first.getByLabelText('Cover for Duplicate title').props.cachePolicy).toBeUndefined();
  for (const text of ['First author, Second author', 'Published: 2002-03', 'Publisher: Publisher', 'ISBN: 9780140328721', 'Language: en', 'Google Books']) expect(first.getByText(text)).toBeTruthy();
  fireEvent.press(first.getByLabelText('View result 1 on Google Books'));
  expect(open).toHaveBeenCalledWith(rows[0].googleBooksUrl);
  expect(view.getByLabelText('No cover available for Duplicate title')).toBeTruthy();
  fireEvent(view.getByLabelText('Cover for Duplicate title'), 'error');
  expect(view.getAllByLabelText('No cover available for Duplicate title')).toHaveLength(2);
  open.mockRestore();
});
it('keeps ineligible and unavailable positions without unsafe content, and allows a coverless eligible result', () => {
  const onSelect = jest.fn();
  const values: EditionRow[] = [rows[1], { ...rows[2], eligibility: 'ineligible' },
    { ...rows[3], eligibility: 'unavailable', metadata: null, googleBooksUrl: null }];
  const view = render(<EditionOptionList rows={values} selectedOptionId={null} disabled={false} onSelect={onSelect} />);
  fireEvent.press(view.getByLabelText('Select result 2: Duplicate title'));
  expect(onSelect).toHaveBeenCalledWith(values[0]);
  expect(view.getByLabelText('Select result 3: Duplicate title').props.accessibilityState).toMatchObject({ disabled: true });
  const unavailable = within(view.getByTestId(`edition-row-${values[2].optionId}`));
  expect(unavailable.getByText('Result 4 unavailable')).toBeTruthy();
  expect(unavailable.queryByText('Duplicate title')).toBeNull();
  expect(unavailable.queryByText('Google Books')).toBeNull();
});
it('disables selection while shared commands are active and resets expansion for a replacement result set', () => {
  const view = render(<EditionOptionList rows={rows} selectedOptionId={null} disabled onSelect={jest.fn()} />);
  expect(view.getByLabelText('Select result 1: Duplicate title').props.accessibilityState).toMatchObject({ disabled: true });
  fireEvent.press(view.getByText('Show all'));
  view.rerender(<EditionOptionList rows={rows.map(row => ({ ...row, optionId: testUuid(40 + row.ordinal) }))} selectedOptionId={null} disabled={false} onSelect={jest.fn()} />);
  expect(view.getAllByTestId(/^edition-row-/)).toHaveLength(5);
});
it('attributes an Open Library option and opens its own edition URL and cover', () => {
  const open=jest.spyOn(Linking,'openURL').mockResolvedValue(true);
  const row:EditionRow={...rows[0],googleBooksUrl:'https://openlibrary.org/books/OL100M',
    metadata:{...rows[0].metadata!,coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg'}};
  const view=render(<EditionOptionList rows={[row]} selectedOptionId={null} disabled={false} onSelect={jest.fn()} />);
  expect(view.getByText('Open Library')).toBeTruthy();
  expect(view.queryByText('Google Books')).toBeNull();
  expect(view.getByLabelText('Cover for Duplicate title').props.source.uri).toBe(row.metadata!.coverReference);
  expect(view.getByLabelText('Cover for Duplicate title').props.cachePolicy).toBe('none');
  fireEvent.press(view.getByLabelText('View result 1 on Open Library'));
  expect(open).toHaveBeenCalledWith(row.googleBooksUrl);
  open.mockRestore();
});

it('reveals selectable Open Library editions after five unavailable positions and keeps their own cover placeholders',()=>{
 const onSelect=jest.fn();
 const values:EditionRow[]=rows.map((row,ordinal)=>{
  const selectable=ordinal===7||ordinal===8;
  return {...row,eligibility:selectable?'eligible':'unavailable',
   googleBooksUrl:selectable?'https://openlibrary.org/books/OL'+(200+ordinal)+'M':null,
   metadata:selectable?{...row.metadata!,title:'Oliver Twist',coverReference:null,
    authors:ordinal===7?['George Cruikshank','Charles Dickens']:['Charles Dickens','George Cruikshank'],
    publishedDate:ordinal===7?'2022':'2017'}:null};
 });
 const view=render(<EditionOptionList rows={values} selectedOptionId={null} disabled={false} onSelect={onSelect}/>);
 expect(view.getAllByTestId(/^edition-row-/)).toHaveLength(5);
 expect(view.queryByLabelText('Select result 8: Oliver Twist')).toBeNull();
 fireEvent.press(view.getByText('Show all'));
 expect(view.getAllByTestId(/^edition-row-/)).toHaveLength(10);
 const option=within(view.getByTestId('edition-row-'+values[7].optionId));
 expect(option.getByText('George Cruikshank, Charles Dickens')).toBeTruthy();
 expect(option.getByText('Published: 2022')).toBeTruthy();
 expect(option.getByLabelText('No cover available for Oliver Twist')).toBeTruthy();
 expect(option.getByText('Open Library')).toBeTruthy();
 fireEvent.press(option.getByLabelText('Select result 8: Oliver Twist'));
 expect(onSelect).toHaveBeenCalledWith(values[7]);
});

it.each([
  'https://covers.openlibrary.org/b/id/123-M.jpg',
  'https://COVERS.OPENLIBRARY.ORG:443/b/id/123-M.jpg',
])('denies native caching for an Open Library cover and restores the Google default on replacement: %s', reference => {
  const props = { label: 'Current cover', placeholderLabel: 'No current cover', style: { width: 64, height: 96 } };
  const view = render(<MetadataCover {...props} reference={reference} />);
  expect(view.getByLabelText('Current cover').props.cachePolicy).toBe('none');
  view.rerender(<MetadataCover {...props} reference="https://books.google.com/books/content?id=one&printsec=frontcover" />);
  expect(view.getByLabelText('Current cover').props.cachePolicy).toBeUndefined();
  fireEvent(view.getByLabelText('Current cover'), 'error');
  expect(view.getByLabelText('No current cover')).toBeTruthy();
});