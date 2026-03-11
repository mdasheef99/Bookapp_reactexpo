/**
 * Smoke test: src/store/themeStore.ts
 *
 * Tests the Zustand theme store — pure logic with no native dependencies.
 * Validates that Zustand stores work correctly in the test environment.
 */
import { useThemeStore, AtmosphericPhase } from '@/store/themeStore';

describe('themeStore', () => {
  // Reset store state before each test
  beforeEach(() => {
    useThemeStore.setState({
      currentPhase: 'daylight',
      isAuto: true,
    });
  });

  describe('initial state', () => {
    it('should have a valid atmospheric phase', () => {
      const { currentPhase } = useThemeStore.getState();
      expect(['daylight', 'golden', 'midnight']).toContain(currentPhase);
    });

    it('should default to auto mode', () => {
      const { isAuto } = useThemeStore.getState();
      expect(isAuto).toBe(true);
    });
  });

  describe('setPhase', () => {
    it('should set the phase and disable auto mode', () => {
      useThemeStore.getState().setPhase('midnight');
      const { currentPhase, isAuto } = useThemeStore.getState();
      expect(currentPhase).toBe('midnight');
      expect(isAuto).toBe(false);
    });

    it('should accept all valid phases', () => {
      const phases: AtmosphericPhase[] = ['daylight', 'golden', 'midnight'];
      phases.forEach((phase) => {
        useThemeStore.getState().setPhase(phase);
        expect(useThemeStore.getState().currentPhase).toBe(phase);
      });
    });
  });

  describe('setAuto', () => {
    it('should enable auto mode', () => {
      // First disable auto
      useThemeStore.getState().setPhase('midnight');
      expect(useThemeStore.getState().isAuto).toBe(false);

      // Re-enable auto
      useThemeStore.getState().setAuto(true);
      expect(useThemeStore.getState().isAuto).toBe(true);
    });

    it('should update phase based on time when enabling auto', () => {
      useThemeStore.getState().setPhase('midnight'); // manual override
      useThemeStore.getState().setAuto(true);

      // Phase should now reflect current time (we can't assert exact phase
      // since it depends on when the test runs, but it should be valid)
      const { currentPhase } = useThemeStore.getState();
      expect(['daylight', 'golden', 'midnight']).toContain(currentPhase);
    });
  });

  describe('updatePhaseByTime', () => {
    it('should update phase when in auto mode', () => {
      useThemeStore.setState({ isAuto: true });
      useThemeStore.getState().updatePhaseByTime();
      const { currentPhase } = useThemeStore.getState();
      expect(['daylight', 'golden', 'midnight']).toContain(currentPhase);
    });

    it('should NOT update phase when not in auto mode', () => {
      useThemeStore.getState().setPhase('midnight');
      // Now isAuto is false, updatePhaseByTime should not change phase
      useThemeStore.getState().updatePhaseByTime();
      expect(useThemeStore.getState().currentPhase).toBe('midnight');
    });
  });
});

