import type { ComponentProps } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClubManageApplicationsSection } from '../ClubManageApplicationsSection';

type Props = ComponentProps<typeof ClubManageApplicationsSection>;
afterEach(() => jest.restoreAllMocks());
describe('Applications list presentation', () => {
    it.each(['Approve', 'Decline'] as const)('retains %s confirmation and payload', async (label) => {
        const onReview = jest.fn().mockResolvedValue(undefined);
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const view = render(<ClubManageApplicationsSection applications={[{ id: 'app-1', created_at: null, answers: [{ question: 'Why join?', answer: null }], applicantProfile: { display_name: 'Reader One' } } as unknown as Props['applications'][number]]} isLoading={false} onReview={onReview} onFeedback={jest.fn()} />);
        expect(view.getByText('No answer submitted.')).toBeOnTheScreen();
        fireEvent.press(view.getByText(label));
        expect(onReview).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith(`${label} application`, `${label} Reader One's application to join this club?`, expect.any(Array));
        const buttons = alert.mock.calls[0][2]!;
        await act(async () => { await buttons.find((button) => button.text === label)!.onPress!(); });
        await waitFor(() => expect(onReview).toHaveBeenCalledWith('app-1', label === 'Approve' ? 'approve' : 'decline'));
    });
});
