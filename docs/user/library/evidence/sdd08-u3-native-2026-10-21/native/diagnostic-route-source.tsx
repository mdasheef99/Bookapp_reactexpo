import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { buildFileName } from '@/features/books/export/fileName';
import { formatExportDate } from '@/features/books/export/dates';
import { buildLibraryCsv } from '@/features/books/export/libraryCsv';
import { buildNotesMarkdown } from '@/features/books/export/notesMarkdown';
import { buildNotesPrintHtml } from '@/features/books/export/notesPrintHtml';
import { deliverPdfFile, deliverTextFile } from '@/features/books/export/deliver';
import type { ExportLibraryRow, ExportNotesBook } from '@/features/books/export/types';

const OPTS = { timeZone: 'Asia/Kolkata' };
const D = new Date('2026-10-03T20:00:00Z');
const row = (title: string): ExportLibraryRow => ({
  reading_status: 'reading', ownership: 'owned', condition: null, rating: 4, review: null, review_is_public: null,
  created_at: '2026-10-03T20:00:00Z', completed_at: null,
  book: { title, authors: ['Test Author'], isbn_13: null, isbn_10: null, publisher: null, published_date: null, page_count: 100 },
});
const ROWS = [row('=HYPERLINK("x")'), row('किताब की कहानी'), row('ಪುಸ್ತಕ ಕಥೆ')];
const BOOK: ExportNotesBook = {
  title: 'किताब की कहानी / ಪುಸ್ತಕ ಕಥೆ', authors: ['Test Author'],
  notes: [
    { content: 'यह एक हिंदी नोट है। किताब की कहानी बहुत सुंदर है।', tag: 'reflect', page_number: 12, created_at: '2026-10-03T20:00:00Z', updated_at: null },
    { content: 'ಇದು ಕನ್ನಡ ಟಿಪ್ಪಣಿ. ಪುಸ್ತಕ ಕಥೆ ತುಂಬಾ ಸುಂದರವಾಗಿದೆ.', tag: 'quote', page_number: 30, created_at: '2026-10-03T20:00:00Z', updated_at: null },
  ],
};
const TITLES = ['Walden', 'Café Society', 'किताब की कहानी', 'ಪುಸ್ತಕ ಕಥೆ', '𠮷'.repeat(61)];
const FACTS = [
  ...TITLES.map(t => { const n = buildFileName('notes-md', { kind: 'book', title: t }, D, OPTS); return `${JSON.stringify(t.length > 20 ? t.slice(0, 8) + '..(len ' + Array.from(t).length + ')' : t)} -> ${n} (slugchars ${Array.from(n.replace(/^bookconnect-notes-/, '').replace(/-2026-10-04\.md$/, '')).length})`; }),
  `formatExportDate -> ${formatExportDate(D, OPTS)}`,
];

export default function NativeExportProof() {
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog(l => [...l, s]);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    add(`${label}: started`);
    try { add(`${label}: resolved ${JSON.stringify(await fn())}`); }
    catch (e) { add(`${label}: ERROR ${(e as Error).name}: ${(e as Error).message}`); }
  };
  const csv = () => deliverTextFile({ fileName: buildFileName('library-csv', { kind: 'all' }, D, OPTS), mimeType: 'text/csv;charset=utf-8', text: buildLibraryCsv(ROWS, OPTS).text });
  const md = () => deliverTextFile({ fileName: buildFileName('notes-md', { kind: 'book', title: BOOK.title }, D, OPTS), mimeType: 'text/markdown;charset=utf-8', text: buildNotesMarkdown([BOOK], OPTS) });
  const pdf = () => deliverPdfFile({ fileName: buildFileName('notes-pdf', { kind: 'book', title: BOOK.title }, D, OPTS), html: buildNotesPrintHtml([BOOK], OPTS) });
  const Btn = ({ id, label, onPress }: { id: string; label: string; onPress: () => void }) => (
    <TouchableOpacity testID={id} accessibilityLabel={id} onPress={onPress} style={{ backgroundColor: '#246', padding: 12, margin: 4 }}>
      <Text style={{ color: '#fff' }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff', paddingTop: 40 }}>
      <View style={{ padding: 8 }}>
        <Text style={{ fontWeight: 'bold', color: '#000' }}>Hermes facts</Text>
        {FACTS.map((f, i) => <Text key={i} style={{ color: '#000', fontSize: 11 }}>{f}</Text>)}
        <Btn id="btn-csv" label="CSV" onPress={() => void run('CSV', csv)} />
        <Btn id="btn-md" label="MD" onPress={() => void run('MD', md)} />
        <Btn id="btn-pdf" label="PDF" onPress={() => void run('PDF', pdf)} />
        <Btn id="btn-rapid" label="RAPID x2 CSV" onPress={() => { void run('RAPID-A', csv); void run('RAPID-B', csv); }} />
        {log.map((l, i) => <Text key={i} style={{ color: '#000', fontSize: 12 }}>{l}</Text>)}
      </View>
    </ScrollView>
  );
}
