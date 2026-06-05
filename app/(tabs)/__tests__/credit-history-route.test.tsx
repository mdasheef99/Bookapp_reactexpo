import CreditHistoryRoute from '../credit-history';

describe('top-level credit history route', () => {
    it('reuses the profile credit history screen', () => {
        expect(CreditHistoryRoute).toBeTruthy();
    });
});
