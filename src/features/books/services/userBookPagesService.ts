import { supabase } from '@/lib/supabase';
import {
    VAULT_WORD_LIMIT,
    getWordCount,
    buildVaultExcerpt,
    capToVaultLimits,
} from '@/features/books/utils/ocrWordCap';

export interface UserBookPage {
    id: string;
    user_id: string;
    user_book_id: string;
    page_number: number;
    content_excerpt: string;
    full_text: string;
    word_count: number;
    created_at: string;
    updated_at: string;
}

function validateVaultInput(fullText: string, pageNumber: number): void {
    const trimmed = fullText.trim();
    if (!trimmed) throw new Error('Page content cannot be empty.');
    if (pageNumber <= 0 || !Number.isInteger(pageNumber)) throw new Error('Page number must be a positive integer.');
}

async function assertPageWordLimitRpc(fullText: string): Promise<void> {
    const { data, error } = await supabase.rpc('check_page_word_limit', { p_text: fullText });
    if (error) throw error;
    if (data === false) throw new Error(`Page exceeds ${VAULT_WORD_LIMIT} words (server check).`);
}

export const userBookPagesService = {
    async getPagesForBook(userBookId: string): Promise<UserBookPage[]> {
        const { data, error } = await supabase
            .from('user_book_pages')
            .select('*')
            .eq('user_book_id', userBookId)
            .order('page_number', { ascending: true });
        if (error) throw error;
        return (data as UserBookPage[]) || [];
    },

    async getPage(userBookId: string, pageNumber: number): Promise<UserBookPage | null> {
        const { data, error } = await supabase
            .from('user_book_pages')
            .select('*')
            .eq('user_book_id', userBookId)
            .eq('page_number', pageNumber)
            .maybeSingle();
        if (error) throw error;
        return data as UserBookPage | null;
    },

    async upsertPage(
        userId: string,
        userBookId: string,
        pageNumber: number,
        fullText: string
    ): Promise<UserBookPage> {
        validateVaultInput(fullText, pageNumber);
        // Fit BOTH vault limits (800 words / 4000 chars) at word boundaries — DB CHECKs stay the hard stop
        const { capped } = capToVaultLimits(fullText.trim());
        const trimmed = capped;
        await assertPageWordLimitRpc(trimmed);

        const excerpt = buildVaultExcerpt(trimmed);
        const wordCount = getWordCount(trimmed);

        const { data, error } = await supabase
            .from('user_book_pages')
            .upsert(
                {
                    user_id: userId,
                    user_book_id: userBookId,
                    page_number: pageNumber,
                    content_excerpt: excerpt,
                    full_text: trimmed,
                    word_count: wordCount,
                },
                { onConflict: 'user_book_id,page_number' }
            )
            .select()
            .single();
        if (error) throw error;
        return data as UserBookPage;
    },

    async deletePage(pageId: string): Promise<void> {
        const { error } = await supabase.from('user_book_pages').delete().eq('id', pageId);
        if (error) throw error;
    },
};
