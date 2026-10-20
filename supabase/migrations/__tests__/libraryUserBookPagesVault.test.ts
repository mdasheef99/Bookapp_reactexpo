import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260820064258_library_user_book_pages_vault.sql'),
    'utf8'
);

describe('SDD-03 user_book_pages vault migration', () => {
    it('creates table with required columns and limits 800/4000/800', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.user_book_pages');
        expect(migration).toContain('user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE');
        expect(migration).toContain('user_book_id uuid NOT NULL REFERENCES public.user_books(id) ON DELETE CASCADE');
        expect(migration).toContain('page_number integer NOT NULL CHECK (page_number > 0)');
        expect(migration).toContain('content_excerpt text NOT NULL CHECK (char_length(content_excerpt) <= 800)');
        expect(migration).toContain('full_text text NOT NULL CHECK (char_length(full_text) <= 4000)');
        expect(migration).toContain('word_count integer NOT NULL CHECK (word_count >= 0 AND word_count <= 800)');
        expect(migration).toContain('UNIQUE (user_book_id, page_number)');
    });

    it('enables RLS and creates 4 owner policies auth.uid()=user_id', () => {
        expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
        expect(migration).toContain('"Users can view own pages"');
        expect(migration).toContain('"Users can insert own pages"');
        expect(migration).toContain('"Users can update own pages"');
        expect(migration).toContain('"Users can delete own pages"');
        expect(migration.match(/auth\.uid\(\) = user_id/g)!.length).toBeGreaterThanOrEqual(4);
    });

    it('creates indexes on user_id, user_book_id, (user_book_id,page_number)', () => {
        expect(migration).toContain('idx_user_book_pages_user_id');
        expect(migration).toContain('idx_user_book_pages_user_book_id');
        expect(migration).toContain('idx_user_book_pages_book_page');
    });

    it('creates RPC check_note_word_limit 500 and check_page_word_limit 800', () => {
        expect(migration).toContain('check_note_word_limit');
        expect(migration).toContain('<= 500');
        expect(migration).toContain('check_page_word_limit');
        expect(migration).toContain('<= 800');
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.check_note_word_limit');
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.check_page_word_limit');
    });

    it('has updated_at trigger', () => {
        expect(migration).toContain('set_user_book_pages_updated_at');
        expect(migration).toContain('trg_user_book_pages_updated_at');
    });

    it('has no marketplace touch', () => {
        expect(migration).not.toContain('store_inventory');
        expect(migration).not.toContain('marketplace_book_listings');
    });
});
