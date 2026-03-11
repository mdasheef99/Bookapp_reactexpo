import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

export const useAtmosphericTheme = () => {
    const { currentPhase, updatePhaseByTime } = useThemeStore();

    useEffect(() => {
        // Initial check
        updatePhaseByTime();

        // Check every minute
        const interval = setInterval(() => {
            updatePhaseByTime();
        }, 60000); // 60 seconds

        return () => clearInterval(interval);
    }, [updatePhaseByTime]);

    return currentPhase;
};
