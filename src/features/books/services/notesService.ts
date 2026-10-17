import { supabase } from '@/lib/supabase';
import { getWordCount, NOTE_WORD_LIMIT, capWords } from '@/features/books/utils/ocrWordCap';
import type { NoteCategory } from '@/features/books/notes/manualNoteContract';

export type NoteTag = NoteCategory;

export interface ReadingNote {
    id: string;
    user_id: string;
    user_book_id: string;
    content: string;
    tag: NoteTag | null;
    page_number: number | null;
    created_at: string;
    updated_at: string;
    version?: number;
    last_operation_id?: string | null;
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
        label: 'Thought',
        icon: 'bulb-outline',
        color: '#7C3AED',
        bgColor: 'rgba(124, 58, 237, 0.12)',
        description: 'Your reactions, interpretations, or connections',
    },
    distill: {
        label: 'Takeaway',
        icon: 'flask-outline',
        color: '#D97706',
        bgColor: 'rgba(217, 119, 6, 0.12)',
        description: 'An important idea in your own words',
    },
    apply: {
        label: 'Action',
        icon: 'rocket-outline',
        color: '#059669',
        bgColor: 'rgba(5, 150, 105, 0.12)',
        description: 'Something you want to try or put into practice',
    },
    question: {
        label: 'Question',
        icon: 'help-circle-outline',
        color: '#6366F1',
        bgColor: 'rgba(99, 102, 241, 0.12)',
        description: 'Something you want to understand or explore',
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
     * Create a new reading note. Enforces SDD-03 500w cap client + RPC.
     */
    async createNote(
        userId: string,
        userBookId: string,
        content: string,
        tag: NoteTag | null,
        pageNumber?: number
    ): Promise<ReadingNote> {
        const trimmed = content.trim();
        if (!trimmed) throw new Error('Note content cannot be empty.');
        if (getWordCount(trimmed) > NOTE_WORD_LIMIT) {
            throw new Error(`Note exceeds ${NOTE_WORD_LIMIT} words.`);
        }
        // Server re-check via RPC (no trust client alone)
        const { data: rpcOk, error: rpcError } = await supabase.rpc('check_note_word_limit', {
            p_content: trimmed,
        });
        if (rpcError) throw rpcError;
        if (rpcOk === false) throw new Error(`Note exceeds ${NOTE_WORD_LIMIT} words (server check).`);

        const { data, error } = await supabase
            .from('reading_notes')
            .insert({
                user_id: userId,
                user_book_id: userBookId,
                content: trimmed,
                tag,
                page_number: pageNumber || null,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing note. Caps content at 500w if content is being updated.
     */
    async updateNote(
        noteId: string,
        updates: {
            content?: string;
            tag?: NoteTag | null;
            page_number?: number | null;
        }
    ): Promise<ReadingNote> {
        if (updates.content !== undefined) {
            const trimmed = updates.content.trim();
            if (!trimmed) throw new Error('Note content cannot be empty.');
            if (getWordCount(trimmed) > NOTE_WORD_LIMIT) {
                throw new Error(`Note exceeds ${NOTE_WORD_LIMIT} words.`);
            }
            const { data: rpcOk, error: rpcError } = await supabase.rpc('check_note_word_limit', {
                p_content: trimmed,
            });
            if (rpcError) throw rpcError;
            if (rpcOk === false) throw new Error(`Note exceeds ${NOTE_WORD_LIMIT} words (server check).`);
            updates = { ...updates, content: trimmed };
        }
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
