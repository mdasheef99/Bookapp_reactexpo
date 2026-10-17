jest.mock('@/lib/supabase');

import { userBookPagesService } from '../userBookPagesService';
import { supabase } from '@/lib/supabase';

function mockQuery(response: Record<string, any>) {
    const builder: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'limit', 'single', 'maybeSingle', 'from', 'rpc'];
    methods.forEach((m) => { builder[m] = jest.fn(() => builder); });
    builder.then = jest.fn((resolve: any) => resolve(response));
    return builder;
}

beforeEach(() => jest.clearAllMocks());

describe('userBookPagesService', () => {
    describe('upsertPage', () => {
        it('rejects empty content client-side without RPC', async () => {
            await expect(userBookPagesService.upsertPage('u1', 'ub1', 1, '   ')).rejects.toThrow('cannot be empty');
            expect(supabase.rpc).not.toHaveBeenCalled();
        });

        it('rejects invalid page_number', async () => {
            await expect(userBookPagesService.upsertPage('u1', 'ub1', 0, 'hello')).rejects.toThrow('Page number');
        });

        it('caps over-limit content to vault limits instead of throwing', async () => {
            const builder = mockQuery({ data: { id: 'p1' }, error: null });
            (supabase.from as jest.Mock).mockReturnValueOnce(builder);
            (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

            // 4001 chars, single "word" — must be trimmed to exactly 4000 chars
            const longChars = 'a'.repeat(4001);
            await userBookPagesService.upsertPage('u1', 'ub1', 1, longChars);
            let call = (builder.upsert as jest.Mock).mock.calls[0][0];
            expect(call.full_text.length).toBe(4000);

            // 801 words — must be trimmed to exactly 800 words
            const builder2 = mockQuery({ data: { id: 'p2' }, error: null });
            (supabase.from as jest.Mock).mockReturnValueOnce(builder2);
            (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
            const over = Array.from({ length: 801 }, (_, i) => `w${i}`).join(' ');
            await userBookPagesService.upsertPage('u1', 'ub1', 1, over);
            call = (builder2.upsert as jest.Mock).mock.calls[0][0];
            expect(call.word_count).toBe(800);
        });

        it('calls RPC check_page_word_limit and upserts on success', async () => {
            const builder = mockQuery({ data: { id: 'p1' }, error: null });
            (supabase.from as jest.Mock).mockReturnValueOnce(builder);
            (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

            const text = 'hello world page one';
            const result = await userBookPagesService.upsertPage('u1', 'ub1', 2, text);

            expect(supabase.rpc).toHaveBeenCalledWith('check_page_word_limit', { p_text: text });
            expect(builder.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 'u1',
                    user_book_id: 'ub1',
                    page_number: 2,
                    full_text: text,
                    content_excerpt: text,
                    word_count: 4,
                }),
                { onConflict: 'user_book_id,page_number' }
            );
            expect(result).toEqual({ id: 'p1' });
        });

        it('truncates excerpt to 800 when full_text <4000 but excerpt would exceed', async () => {
            const builder = mockQuery({ data: { id: 'p1' }, error: null });
            (supabase.from as jest.Mock).mockReturnValueOnce(builder);
            (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
            const long = 'a'.repeat(900);
            await userBookPagesService.upsertPage('u1', 'ub1', 1, long);
            const call = (builder.upsert as jest.Mock).mock.calls[0][0];
            expect(call.content_excerpt.length).toBe(800);
            expect(call.full_text.length).toBe(900);
        });

        it('throws when RPC returns false (server 800w reject)', async () => {
            (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });
            await expect(userBookPagesService.upsertPage('u1', 'ub1', 1, 'hello world')).rejects.toThrow('server check');
        });
    });

    describe('getPagesForBook', () => {
        it('queries ordered by page_number', async () => {
            const builder = mockQuery({ data: [{ id: 'p1' }], error: null });
            (supabase.from as jest.Mock).mockReturnValueOnce(builder);
            const res = await userBookPagesService.getPagesForBook('ub1');
            expect(supabase.from).toHaveBeenCalledWith('user_book_pages');
            expect(builder.eq).toHaveBeenCalledWith('user_book_id', 'ub1');
            expect(builder.order).toHaveBeenCalledWith('page_number', { ascending: true });
            expect(res).toEqual([{ id: 'p1' }]);
        });
    });
});
