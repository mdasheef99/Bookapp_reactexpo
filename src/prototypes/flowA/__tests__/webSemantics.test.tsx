import React from 'react';
import { StatusSegments } from '../components/StatusSegments';
import { DetailRow } from '../components/DetailRow';
import { CoverBlock } from '../components/CoverBlock';
import { NotePassages } from '../components/NotePassages';
import { BookDetailsPrototype } from '../BookDetailsPrototype';
import { TextButton } from '../components/TextButton';
import { FIXTURES } from '../fixtures';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';

// react-dom is installed; this repo does not include its optional type package.
const { renderToStaticMarkup } = require('react-dom/server') as {
    renderToStaticMarkup: (element: React.ReactNode) => string;
};

// Render the installed web implementation locally, without a browser/server.
jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const colors = getLibraryAppearance('daylight');

it('F: writes true/false aria-checked values into RN-web DOM markup', () => {
    const markup = renderToStaticMarkup(<StatusSegments initialStatus="reading" colors={colors} />);
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="Reading status"');
    expect(markup.match(/role="radio"/g)).toHaveLength(3);
    expect(markup.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-checked="false"/g)).toHaveLength(2);
});

it('F: writes expanded state for expandable rows and none for the notes link', () => {
    for (const expanded of [true, false]) {
        const markup = renderToStaticMarkup(<DetailRow id="review" label="Your review" expanded={expanded} colors={colors} onPress={() => {}} />);
        expect(markup).toContain(`aria-expanded="${expanded}"`);
        expect(markup).not.toContain('role="heading"');
    }
    const link = renderToStaticMarkup(<DetailRow id="notes" label="All notes" link colors={colors} onPress={() => {}} />);
    expect(link).toContain('role="link"');
    expect(link).not.toContain('aria-expanded');
});

it('F: writes heading levels for the book and Your notes', () => {
    const book = renderToStaticMarkup(<CoverBlock book={FIXTURES['no-cover'].book} colors={colors} />);
    const notes = renderToStaticMarkup(<NotePassages notes={[]} state="populated" colors={colors} />);
    expect(book).toContain('aria-level="1"');
    expect(book).toContain('role="heading"');
    expect(notes).toContain('aria-level="2"');
    expect(notes).toContain('role="heading"');
});

it('B: writes disabled semantics on the web status group and each radio', () => {
    const markup = renderToStaticMarkup(<StatusSegments initialStatus="reading" colors={colors} disabled />);
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(4);
    expect(markup).not.toContain('tabindex="0"');
});

it('writes disabled semantics and removes the web tab stop for offline removal', () => {
    const markup = renderToStaticMarkup(<TextButton label="Remove from library" colors={colors} disabled onPress={() => {}} />);
    expect(markup).toContain('role="button"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('tabindex="-1"');
});

it('renders empty reviews as web action buttons and redundant ownership as a plain row', () => {
    const markup = renderToStaticMarkup(<BookDetailsPrototype preset="review-absent" phase="daylight" initialOpen="review" />);
    const review = markup.match(/<[^>]+\bdata-testid="fa-row-review"[^>]*>/)![0];
    expect(review).toContain('role="button"');
    expect(review).not.toContain('aria-expanded');
    expect(markup).not.toContain('data-testid="fa-expanded-review"');
    expect(markup).not.toMatch(/>(Public|Private)</);
    const ownership = markup.match(/<[^>]+\bdata-testid="fa-row-ownership"[^>]*>/)![0];
    expect(ownership).not.toMatch(/tabindex|role=|aria-expanded/);
});

it('uses normal word wrapping on the web title, author and visible status labels', () => {
    const cover = renderToStaticMarkup(<CoverBlock book={FIXTURES['no-cover'].book} colors={colors} />);
    const status = renderToStaticMarkup(<StatusSegments initialStatus="reading" colors={colors} />);
    const css = require('react-native-web').StyleSheet.getSheet().textContent as string;
    for (const [markup, label] of [[cover, 'Walden'], [cover, 'Henry David Thoreau'],
        ...['Want to read', 'Reading', 'Finished'].map(label => [status, label])]) {
        // Measurement copies precede the visible labels and have no wrap override.
        const tags = [...markup.matchAll(new RegExp(`<[^>]+class="([^"]+)"[^>]*>${label}<`, 'g'))];
        const classes = tags[tags.length - 1][1].split(' ');
        for (const property of ['overflowWrap', 'wordWrap', 'wordBreak']) {
            const className = classes.find(name => name.startsWith(`r-${property}-`));
            expect(className).toBeDefined();
            const cssProperty = property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
            expect(css).toContain(`.${className}{${cssProperty}:normal;}`);
        }
    }
});
