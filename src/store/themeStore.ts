import { create } from 'zustand';

export type AtmosphericPhase = 'daylight' | 'golden' | 'midnight';

interface ThemeState {
    currentPhase: AtmosphericPhase;
    isAuto: boolean;
    setPhase: (phase: AtmosphericPhase) => void;
    setAuto: (isAuto: boolean) => void;
    updatePhaseByTime: () => void;
}

const getPhaseFromTime = (): AtmosphericPhase => {
    const hour = new Date().getHours();
    // Daylight: 5 AM - 5 PM (17:00)
    if (hour >= 5 && hour < 17) return 'daylight';
    // Golden Hour: 5 PM - 8 PM (20:00)
    if (hour >= 17 && hour < 20) return 'golden';
    // Midnight: 8 PM - 5 AM
    return 'midnight';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
    currentPhase: getPhaseFromTime(),
    isAuto: true,

    setPhase: (phase) => {
        set({ currentPhase: phase, isAuto: false });
    },

    setAuto: (isAuto) => {
        set({ isAuto });
        if (isAuto) {
            set({ currentPhase: getPhaseFromTime() });
        }
    },

    updatePhaseByTime: () => {
        const { isAuto } = get();
        if (isAuto) {
            const newPhase = getPhaseFromTime();
            const { currentPhase } = get();
            if (newPhase !== currentPhase) {
                set({ currentPhase: newPhase });
            }
        }
    },
}));
