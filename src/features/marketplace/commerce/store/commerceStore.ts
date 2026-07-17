import { create } from 'zustand';

interface ReplacementPrompt {
    token: string;
    expectedVersion: number;
}

interface CommerceUiState {
    replacement: ReplacementPrompt | null;
    clarificationDrafts: Record<string, string>;
    deepLinkRequestId: string | null;
    setReplacement: (replacement: ReplacementPrompt | null) => void;
    setClarificationDraft: (requestId: string, value: string) => void;
    setDeepLinkRequestId: (requestId: string | null) => void;
    reset: () => void;
}

const initialState = {
    replacement: null,
    clarificationDrafts: {},
    deepLinkRequestId: null,
};

export const useCommerceStore = create<CommerceUiState>((set) => ({
    ...initialState,
    setReplacement: (replacement) => set({ replacement }),
    setClarificationDraft: (requestId, value) => set((state) => ({
        clarificationDrafts: { ...state.clarificationDrafts, [requestId]: value },
    })),
    setDeepLinkRequestId: (deepLinkRequestId) => set({ deepLinkRequestId }),
    reset: () => set(initialState),
}));
