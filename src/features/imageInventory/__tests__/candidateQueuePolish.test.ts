import { candidateSessionCue } from '../components/CandidateCard';

describe('Phase 9 Unit 6F needs-review queue cues', () => {
    it('uses bounded, locale-safe session dates without leaking route identity', () => {
        expect(candidateSessionCue(
            '2026-07-31T00:00:00.000Z',
            '2026-08-30T00:00:00.000Z',
        )).toBe('Session from Jul 31 · expires Aug 30');
    });
});
