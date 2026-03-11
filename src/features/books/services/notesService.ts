import { supabase } from '@/lib/supabase';

export type NoteTag = 'quote' | 'reflect' | 'distill' | 'apply';

export interface ReadingNote {
    id: string;
    user_id: string;
    user_book_id: string;
    content: string;
    tag: NoteTag;
    page_number: number | null;
    created_at: string;
    updated_at: string;
}

export const NOTE_TAG_CONFIG: Record<NoteTag, { label: string; icon: string; color: string; bgColor: string; description: string }> = {
    quote: {
        label: 'Quote',
        icon: 'chatbubble-ellipses-outline',
        color: '#0D9488',
        bgColor: 'rgba(13, 148, 136, 0.12)',
        description: 'Passages, excerpts, or favorite lines',
    },
    reflect: {
        label: 'Reflect',
        icon: 'bulb-outline',
        color: '#7C3AED',
        bgColor: 'rgba(124, 58, 237, 0.12)',
        description: 'Personal thoughts, reactions, or questions',
    },
    distill: {
        label: 'Distill',
        icon: 'flask-outline',
        color: '#D97706',
        bgColor: 'rgba(217, 119, 6, 0.12)',
        description: 'Key takeaways, summaries, or core ideas',
    },
    apply: {
        label: 'Apply',
        icon: 'rocket-outline',
        color: '#059669',
        bgColor: 'rgba(5, 150, 105, 0.12)',
        description: 'Actions, habits, or experiments to try',
    },
};

export const notesService = {
    /**
     * Fetch all notes for a specific book, ordered newest first.
     * Optionally filter by tag.
     */
    async getNotesForBook(userBookId: string, tagFilter?: NoteTag): Promise<ReadingNote[]> {
        let query = supabase
            .from('reading_notes')
            .select('*')
            .eq('user_book_id', userBookId)
            .order('created_at', { ascending: false });

        if (tagFilter) {
            query = query.eq('tag', tagFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    /**
     * Get the count of notes for a book (for badge display).
     */
    async getNotesCount(userBookId: string): Promise<number> {
        const { count, error } = await supabase
            .from('reading_notes')
            .select('*', { count: 'exact', head: true })
            .eq('user_book_id', userBookId);

        if (error) throw error;
        return count || 0;
    },

    /**
     * Create a new reading note.
     */
    async createNote(
        userId: string,
        userBookId: string,
        content: string,
        tag: NoteTag,
        pageNumber?: number
    ): Promise<ReadingNote> {
        const { data, error } = await supabase
            .from('reading_notes')
            .insert({
                user_id: userId,
                user_book_id: userBookId,
                content,
                tag,
                page_number: pageNumber || null,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing note.
     */
    async updateNote(
        noteId: string,
        updates: {
            content?: string;
            tag?: NoteTag;
            page_number?: number | null;
        }
    ): Promise<ReadingNote> {
        const { data, error } = await supabase
            .from('reading_notes')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', noteId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a note.
     */
    async deleteNote(noteId: string): Promise<void> {
        const { error } = await supabase
            .from('reading_notes')
            .delete()
            .eq('id', noteId);

        if (error) throw error;
    },
};
