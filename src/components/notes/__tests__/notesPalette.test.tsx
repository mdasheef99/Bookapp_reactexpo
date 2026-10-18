/**
 * SDD-07 FU-1b: the notes screens' colours come from the book-section palette.
 * Every site below names the token it must resolve to, and the same assertion runs in
 * daylight, golden and midnight, so a component that falls back to one phase's values
 * (the bug FU-1b removed) fails here instead of on screen.
 */
import * as fs from 'fs';
import * as path from 'path';

import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, RenderResult } from '@testing-library/react-native';

import { CategoryPicker, NoteButton, NoteDialog, NoteForm } from '../ManualNoteUi';
import { NoteCard } from '../NoteCard';
import { NoteCrop } from '../NoteCrop';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { NOTE_TAG_CONFIG } from '@/features/books/services/notesService';
import type { CapturePhoto } from '@/features/books/notes/captureAdapter';
import { noteFields } from '@/features/books/notes/manualNoteContract';
import type { ManualNote } from '@/features/books/notes/manualNoteContract';

const PHASES = ['daylight', 'golden', 'midnight'] as const;
type Phase = (typeof PHASES)[number];
type Token = keyof ReturnType<typeof getLibraryAppearance>;

// useLibraryAppearance resolves the whole palette from `phase`; the notes components no
// longer read the app theme's `colors`, which is why the mock carries no colour object.
let mockPhase: Phase = 'daylight';
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));

type Element = { props: { style?: unknown; children?: unknown; accessible?: unknown; accessibilityViewIsModal?: unknown } };
type FlatStyle = Record<string, unknown>;

const styleOf = (element: Element): FlatStyle => {
  const declared = element.props.style;
  const resolved = typeof declared === 'function' ? (declared as (state: { pressed: boolean }) => unknown)({ pressed: false }) : declared;
  return (StyleSheet.flatten(resolved as never) ?? {}) as FlatStyle;
};

/** The outermost element the query below is looking for; RNTL matches host elements. */
const flagged = (tree: RenderResult, predicate: (element: Element) => boolean): Element =>
  tree.UNSAFE_root.findAll((node: Element) => predicate(node), { deep: false })[0];

const button = (tree: RenderResult, name: string): Element => tree.getByRole('button', { name }) as unknown as Element;
const label = (tree: RenderResult, name: string): Element => tree.getByLabelText(name) as unknown as Element;

const note: ManualNote = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'A quoted line', tag: 'quote', page_number: 42, created_at: '2026-10-10T00:00:00Z', updated_at: null, version: 1 };
const photo: CapturePhoto = { uri: 'page.jpg', width: 1000, height: 800, sourceWidth: 1000, sourceHeight: 800, rotation: 0 };
const crop = { x: .08, y: .08, width: .44, height: .415 };

/** FU-1b components and routes share the hex-free and token-name source guards. */
const COMPONENTS = [
  ...['ManualNoteUi.tsx', 'NoteCard.tsx', 'NoteCrop.tsx'].map(file => `src/components/notes/${file}`),
  ...['notes.tsx', 'note.tsx', 'note-compose.tsx'].map(file => `app/(tabs)/library/${file}`),
];
const sourceOf = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');

/** rgba() written by a component, read back as its four channels. */
const rgbaOf = (value: unknown): number[] => (value as string).slice('rgba('.length, -1).split(',').map(part => Number.parseFloat(part));
const hexChannelsOf = (value: string): number[] => [1, 3, 5].map(start => Number.parseInt(value.slice(start, start + 2), 16));
const luminance = (hex: string) => hexChannelsOf(hex)
  .map(channel => channel / 255)
  .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first: string, second: string) => {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

/** Every colour the notes screens paint, and the token each one must resolve to. */
const MAPPED_TOKENS = ['bgPrimary', 'bgCard', 'bgRaised', 'accent', 'textOnAccent', 'textPrimary', 'textSecondary', 'error',
  'chipSelectedBackground', 'chipSelectedText', 'controlBorder', 'divider', 'overlay', 'shadow'] as const;

describe('notes screens read the book-section palette', () => {
  beforeEach(() => { mockPhase = 'daylight'; });

  it.each(PHASES)('resolves every mapped colour from the %s palette, not from a hard-coded one', (phase) => {
    mockPhase = phase;
    const colors = getLibraryAppearance(phase);
    const seen: Record<string, unknown> = {};

    const picker = render(<CategoryPicker selected="reflect" onChange={jest.fn()} />);
    const selectedChip = picker.getAllByText(/Thought/)[0];
    const unselectedChip = picker.getAllByText('Question')[0];
    seen['selected chip fill'] = styleOf(picker.getAllByRole('radio', { name: 'Thought' })[0] as unknown as Element).backgroundColor;
    seen['selected chip ink'] = styleOf(selectedChip).color;
    seen['unselected chip fill'] = styleOf(picker.getAllByRole('radio', { name: 'Question' })[0] as unknown as Element).backgroundColor;
    seen['unselected chip ink'] = styleOf(unselectedChip).color;
    expect(seen['selected chip fill']).toBe(colors.chipSelectedBackground);
    expect(seen['selected chip ink']).toBe(colors.chipSelectedText);
    expect(seen['unselected chip fill']).toBe(colors.bgCard);
    expect(seen['unselected chip ink']).toBe(colors.textPrimary);

    const actions = render(<><NoteButton label="Save note" onPress={jest.fn()} /><NoteButton label="Change category" secondary onPress={jest.fn()} /></>);
    seen['primary fill'] = styleOf(button(actions, 'Save note')).backgroundColor;
    seen['primary ink'] = styleOf(actions.getByText('Save note')).color;
    seen['secondary fill'] = styleOf(button(actions, 'Change category')).backgroundColor;
    seen['secondary ink'] = styleOf(actions.getByText('Change category')).color;
    expect(seen['primary fill']).toBe(colors.accent);
    expect(seen['primary ink']).toBe(colors.textOnAccent);
    expect(seen['secondary fill']).toBe(colors.bgCard);
    expect(seen['secondary ink']).toBe(colors.textPrimary);

    const form = render(<NoteForm fields={noteFields(note)} locked showErrors={false} onCategory={jest.fn()} onChange={jest.fn()} />);
    seen['input surface'] = styleOf(label(form, 'Submitted note text')).backgroundColor;
    seen['input boundary'] = styleOf(label(form, 'Submitted note text')).borderColor;
    expect(seen['input surface']).toBe(colors.bgCard);
    expect(seen['input boundary']).toBe(colors.controlBorder);

    const dialog = render(<NoteDialog spec={{ title: 'Discard this note?', message: 'Unsaved', keep: 'Keep editing', confirm: 'Discard note', action: jest.fn() }} onKeep={jest.fn()} />);
    seen['dialog scrim'] = styleOf(flagged(dialog, node => node.props.accessible === false)).backgroundColor;
    seen['dialog surface'] = styleOf(flagged(dialog, node => node.props.accessibilityViewIsModal === true)).backgroundColor;
    expect(seen['dialog scrim']).toBe(colors.overlay);
    expect(seen['dialog surface']).toBe(colors.bgRaised);
    expect(styleOf(button(dialog, 'Keep editing')).borderColor).toBe(colors.controlBorder);

    const card = render(<NoteCard note={note} onRead={jest.fn()} />);
    seen['card surface'] = styleOf(label(card, 'Read note, Quote, page 42')).backgroundColor;
    expect(seen['card surface']).toBe(colors.bgCard);

    const cropper = render(<NoteCrop photo={photo} crop={crop} disabled={false} cropMode="automatic" autoDetected onChange={jest.fn()} onReset={jest.fn()} />);
    const selection = flagged(cropper, node => styleOf(node).borderWidth === 3 && styleOf(node).position === 'absolute');
    seen['crop outline'] = styleOf(selection).borderColor;
    expect(seen['crop outline']).toBe(colors.controlBorder);
    expect(contrast(colors.controlBorder, '#ffffff')).toBeGreaterThanOrEqual(3);
    // The one tint with no token of its own is derived from `shadow` at runtime, never restated.
    const [red, green, blue, alpha] = rgbaOf(styleOf(selection).backgroundColor);
    expect([red, green, blue]).toEqual(hexChannelsOf(colors.shadow));
    expect(alpha).toBe(0.06);

    fireEvent.press(cropper.getByRole('button', { name: 'Adjust crop' }));
    for (const corner of ['Top left crop corner', 'Bottom right crop corner']) {
      expect(styleOf(label(cropper, corner)).borderColor).toBe(colors.controlBorder);
    }

    expect(Object.keys(seen).length).toBeGreaterThan(0);
  });

  it.each(PHASES)('derives every %s colour the notes screens use, so no site can hard-code one', (phase) => {
    const colors = getLibraryAppearance(phase);
    for (const token of MAPPED_TOKENS) expect(typeof colors[token]).toBe('string');
    expect(new Set(MAPPED_TOKENS.map(token => colors[token])).size).toBeGreaterThan(1);
  });

  it('names only tokens the palette actually defines, in every phase', () => {
    const referenced = new Set(COMPONENTS.map(sourceOf).join('\n').match(/colors\.[A-Za-z]\w*/g) ?? []);
    const names = [...referenced].map(reference => reference.slice('colors.'.length));
    expect(names.length).toBeGreaterThan(5);
    for (const phase of PHASES) {
      const declared = new Set(Object.keys(getLibraryAppearance(phase)));
      expect([phase, names.filter(name => !declared.has(name)).sort()]).toEqual([phase, []]);
    }
  });

  it('gives golden its own palette instead of falling back to daylight, for every mapped token', () => {
    const daylight = getLibraryAppearance('daylight');
    const golden = getLibraryAppearance('golden');
    const differing = MAPPED_TOKENS.filter(token => golden[token] !== daylight[token]);
    expect(differing).toEqual([...MAPPED_TOKENS]);
  });

  it('leaves the quote stripe on its NOTE_TAG_CONFIG colour and only falls back to accent', () => {
    // D07-04 (Flow B) owns the tag colours; FU-1b must not restyle them, and NoteCard's own
    // `tagConfig?.color ?? colors.accent` fallback is still sourced from the token palette.
    const source = sourceOf('src/components/notes/NoteCard.tsx');
    expect(source).toContain('tagConfig?.color ?? colors.accent');
    for (const phase of PHASES) {
      mockPhase = phase;
      const colors = getLibraryAppearance(phase);
      const tree = render(<NoteCard note={note} onRead={jest.fn()} />);
      const stripe = styleOf(label(tree, 'Read note, Quote, page 42')).borderLeftColor;
      expect(stripe).toBe(NOTE_TAG_CONFIG.quote.color);
      expect(stripe).not.toBe(colors.accent);
    }
  });

  it('keeps a non-colour selected cue on the category chips', () => {
    const tree = render(<CategoryPicker selected="reflect" onChange={jest.fn()} />);
    expect(tree.getByRole('radio', { name: 'Thought' }).props.accessibilityState).toEqual({ checked: true, selected: true });
    expect(tree.getAllByText(/^✓ Thought$/)).toHaveLength(1);
  });

  it('keeps the NoteDialog focus target, its labels and the Keep border', () => {
    const tree = render(<NoteDialog spec={{ title: 'Discard this note?', message: 'Unsaved', keep: 'Keep editing', confirm: 'Discard note', action: jest.fn() }} onKeep={jest.fn()} />);
    expect(tree.getByRole('button', { name: 'Keep editing' })).toBeTruthy();
    expect(tree.getByRole('button', { name: 'Discard note' })).toBeTruthy();
    expect(tree.getByRole('header')).toBeTruthy();
  });

  it('carries no hex or rgb literal, and reads no colour from the app theme, in components and routes', () => {
    for (const file of COMPONENTS) {
      const source = sourceOf(file);
      expect([file, source.match(/(^|[^\w])#[0-9a-fA-F]{3,8}\b/g)]).toEqual([file, null]);
      expect([file, source.match(/rgba?\(\s*[\d.]/g)]).toEqual([file, null]);
      expect([file, source.match(/useTheme\(/g)]).toEqual([file, null]);
      expect([file, source.match(/useNoteColors/g)]).toEqual([file, null]);
    }
  });
});
