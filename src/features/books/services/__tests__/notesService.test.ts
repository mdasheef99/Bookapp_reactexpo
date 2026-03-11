/**
 * Unit tests for notesService.ts
 *
 * Tests: getNotesForBook (with/without tag filter), getNotesCount,
 * createNote, updateNote (updated_at), deleteNote, NOTE_TAG_CONFIG validation.
 */
jest.mock('@/lib/supabase');

import { notesService, NOTE_TAG_CONFIG, NoteTag } from '../notesService';
import { supabase } from '@/lib/supabase';

// Helper: create a chainable Supabase query builder mock with custom resolution
function mockQuery(response: Record<string, any>) {
  const builder: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq',
    'order', 'limit', 'single', 'maybeSingle',
  ];
  methods.forEach((m) => { builder[m] = jest.fn(() => builder); });
  builder.then = jest.fn((resolve: any) => resolve(response));
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notesService', () => {
  // ──────────────────── NOTE_TAG_CONFIG ────────────────────
  describe('NOTE_TAG_CONFIG', () => {
    it('has all 4 tag types with required properties', () => {
      const tags: NoteTag[] = ['quote', 'reflect', 'distill', 'apply'];
      tags.forEach((tag) => {
        expect(NOTE_TAG_CONFIG[tag]).toBeDefined();
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('label');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('icon');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('color');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('bgColor');
        expect(NOTE_TAG_CONFIG[tag]).toHaveProperty('description');
      });
    });
  });

  // ──────────────────── getNotesForBook ────────────────────
  describe('getNotesForBook', () => {
    it('queries reading_notes ordered by created_at desc', async () => {
      const notes = [{ id: 'n1', content: 'Note 1' }];
      const builder = mockQuery({ data: notes, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await notesService.getNotesForBook('ub-1');

      expect(supabase.from).toHaveBeenCalledWith('reading_notes');
      expect(builder.eq).toHaveBeenCalledWith('user_book_id', 'ub-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(notes);
    });

    it('applies additional eq filter when tagFilter is provided', async () => {
      const builder = mockQuery({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await notesService.getNotesForBook('ub-1', 'quote');

      // eq should be called twice: once for user_book_id, once for tag
      expect(builder.eq).toHaveBeenCalledWith('user_book_id', 'ub-1');
      expect(builder.eq).toHaveBeenCalledWith('tag', 'quote');
    });

    it('returns empty array when data is null', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await notesService.getNotesForBook('ub-1');
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      const builder = mockQuery({ data: null, error: { message: 'DB err' } });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await expect(notesService.getNotesForBook('ub-1')).rejects.toEqual({ message: 'DB err' });
    });
  });

  // ──────────────────── getNotesCount ────────────────────
  describe('getNotesCount', () => {
    it('returns count for a user book', async () => {
      const builder = mockQuery({ count: 7, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await notesService.getNotesCount('ub-1');

      expect(builder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(7);
    });

    it('returns 0 when count is null', async () => {
      const builder = mockQuery({ count: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await notesService.getNotesCount('ub-1');
      expect(result).toBe(0);
    });
  });

  // ──────────────────── createNote ────────────────────
  describe('createNote', () => {
    it('inserts note with correct fields', async () => {
      const createdNote = { id: 'n1', content: 'Test', tag: 'quote' };
      const builder = mockQuery({ data: createdNote, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await notesService.createNote('u1', 'ub1', 'Test', 'quote', 42);

      expect(builder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        user_book_id: 'ub1',
        content: 'Test',
        tag: 'quote',
        page_number: 42,
      });
      expect(builder.single).toHaveBeenCalled();
      expect(result).toEqual(createdNote);
    });

    it('sets page_number to null when not provided', async () => {
      const builder = mockQuery({ data: { id: 'n1' }, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await notesService.createNote('u1', 'ub1', 'Text', 'reflect');

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ page_number: null }),
      );
    });
  });

  // ──────────────────── updateNote ────────────────────
  describe('updateNote', () => {
    it('adds updated_at timestamp to updates', async () => {
      const builder = mockQuery({ data: { id: 'n1' }, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await notesService.updateNote('n1', { content: 'Updated' });

      const updateArg = builder.update.mock.calls[0][0];
      expect(updateArg.content).toBe('Updated');
      expect(updateArg.updated_at).toBeDefined();
      // Verify it's a valid ISO date string
      expect(new Date(updateArg.updated_at).toISOString()).toBe(updateArg.updated_at);
    });
  });

  // ──────────────────── deleteNote ────────────────────
  describe('deleteNote', () => {
    it('deletes from reading_notes by id', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await notesService.deleteNote('n1');

      expect(supabase.from).toHaveBeenCalledWith('reading_notes');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'n1');
    });

    it('throws on error', async () => {
      const builder = mockQuery({ data: null, error: { message: 'Not found' } });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await expect(notesService.deleteNote('bad-id')).rejects.toEqual({ message: 'Not found' });
    });
  });
});

