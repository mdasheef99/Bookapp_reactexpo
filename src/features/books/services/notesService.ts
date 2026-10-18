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
