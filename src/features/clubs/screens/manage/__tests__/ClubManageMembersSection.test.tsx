import type { ComponentProps } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClubManageMembersSection } from '../ClubManageMembersSection';

type Props = ComponentProps<typeof ClubManageMembersSection>;
const member = { user_id: 'reader-1', role: 'member', status: 'active', profile: { display_name: 'Reader One', membership_tier: 'pro' } } as Props['members'][number];
function makeProps(): Props {
    return {
        club: { admin_id: 'admin', access_level: 'all' } as Props['club'],
        members: [member, { ...member, user_id: 'reader-2', profile: { ...member.profile!, display_name: 'Reader Two' } }],
        actions: [], isLoading: false, isActionsLoading: false,
        onToggleRole: jest.fn().mockResolvedValue(undefined), onToggleMute: jest.fn().mockResolvedValue(undefined),
        onCreateAction: jest.fn().mockResolvedValue(undefined), onRemove: jest.fn().mockResolvedValue(undefined), onFeedback: jest.fn(),
    };
}
afterEach(() => jest.restoreAllMocks());
describe('Members visual refresh behavior', () => {
    it('opens one reader at a time and preserves a draft across collapse', () => {
        const view = render(<ClubManageMembersSection {...makeProps()} />);
        expect(view.queryByTestId('toggle-moderator-reader-2')).toBeNull();
        fireEvent.press(view.getByTestId('member-action-muted-reader-1'));
        fireEvent.changeText(view.getByTestId('member-action-reason-reader-1'), 'Keep this draft');
        fireEvent.press(view.getByTestId('manage-member-reader-2'));
        expect(view.queryByTestId('toggle-moderator-reader-1')).toBeNull();
        expect(view.getByTestId('toggle-moderator-reader-2')).toBeOnTheScreen();
        fireEvent.press(view.getByTestId('manage-member-reader-1'));
        expect(view.getByTestId('member-action-reason-reader-1').props.value).toBe('Keep this draft');
    });
    it('explains why an additional Admin membership cannot be managed', () => {
        const props = makeProps();
        props.members = [{ ...member, user_id: 'additional-admin', role: 'admin' }];
        const view = render(<ClubManageMembersSection {...props} />);
        expect(view.getByText('Admin · Active member')).toBeOnTheScreen();
        expect(view.getByText('Club admins cannot be managed here.')).toBeOnTheScreen();
        expect(view.getByTestId('toggle-moderator-additional-admin')).toBeDisabled();
        expect(view.getByTestId('mute-member-additional-admin')).toBeDisabled();
        expect(view.getByTestId('member-action-warned-additional-admin')).toBeDisabled();
        expect(view.getByTestId('member-action-muted-additional-admin')).toBeDisabled();
        expect(view.getByTestId('member-action-banned-additional-admin')).toBeDisabled();
        expect(view.getByTestId('remove-member-additional-admin')).toBeDisabled();
    });
    it('hides and blocks an open moderation draft if a reader becomes an Admin', () => {
        const props = makeProps();
        const view = render(<ClubManageMembersSection {...props} />);
        fireEvent.press(view.getByTestId('member-action-muted-reader-1'));
        fireEvent.changeText(view.getByTestId('member-action-reason-reader-1'), 'Old draft');
        view.rerender(<ClubManageMembersSection {...props} members={[{ ...member, role: 'admin' }]} />);
        expect(view.queryByTestId('member-action-submit-reader-1')).toBeNull();
        expect(view.getByTestId('member-action-muted-reader-1')).toBeDisabled();
        expect(props.onCreateAction).not.toHaveBeenCalled();
    });
    it('defaults timed mute to 24 hours, hides immediate Mute, and restores it on cancel', () => {
        const view = render(<ClubManageMembersSection {...makeProps()} />);
        fireEvent.press(view.getByTestId('member-action-muted-reader-1'));
        expect(view.getByTestId('member-action-duration-reader-1').props.value).toBe('24');
        expect(view.getByText('Whole hours, minimum 1')).toBeOnTheScreen();
        expect(view.queryByTestId('mute-member-reader-1')).toBeNull();
        fireEvent.press(view.getByTestId('member-action-cancel-reader-1'));
        expect(view.getByTestId('mute-member-reader-1')).toBeOnTheScreen();
    });
    it.each(['0', '1.5', 'abc'])('rejects invalid hours %s without a mutation', (hours) => {
        const props = makeProps();
        const view = render(<ClubManageMembersSection {...props} />);
        fireEvent.press(view.getByTestId('member-action-muted-reader-1'));
        fireEvent.changeText(view.getByTestId('member-action-reason-reader-1'), 'Reason');
        fireEvent.changeText(view.getByTestId('member-action-duration-reader-1'), hours);
        fireEvent.press(view.getByTestId('member-action-submit-reader-1'));
        expect(props.onCreateAction).not.toHaveBeenCalled();
        expect(props.onFeedback).toHaveBeenCalledWith({ type: 'error', message: 'Duration must be a whole number of hours.' });
    });
    it.each(['warned', 'muted', 'banned'])('requires a reason for %s', (action) => {
        const props = makeProps();
        const view = render(<ClubManageMembersSection {...props} />);
        fireEvent.press(view.getByTestId(`member-action-${action}-reader-1`));
        fireEvent.press(view.getByTestId('member-action-submit-reader-1'));
        expect(props.onCreateAction).not.toHaveBeenCalled();
    });
    it('submits the unchanged timed-mute payload', async () => {
        const props = makeProps();
        const view = render(<ClubManageMembersSection {...props} />);
        fireEvent.press(view.getByTestId('member-action-muted-reader-1'));
        fireEvent.changeText(view.getByTestId('member-action-reason-reader-1'), '  Spoilers  ');
        fireEvent.press(view.getByTestId('member-action-submit-reader-1'));
        await waitFor(() => expect(props.onCreateAction).toHaveBeenCalledWith(member, 'muted', 'Spoilers', 24));
        expect(view.queryByTestId('member-action-reason-reader-1')).toBeNull();
    });
    it('retains the exact Remove confirmation and does not remove before confirmation', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const props = makeProps();
        const view = render(<ClubManageMembersSection {...props} />);
        fireEvent.press(view.getByTestId('remove-member-reader-1'));
        expect(alert).toHaveBeenCalledWith('Remove member', 'Remove Reader One from this club? They will lose club access immediately.', expect.arrayContaining([expect.objectContaining({ text: 'Cancel' }), expect.objectContaining({ text: 'Remove', style: 'destructive' })]));
        expect(props.onRemove).not.toHaveBeenCalled();
    });
    it('shows only the existing latest three history records', () => {
        const props = makeProps();
        props.actions = [1, 2, 3, 4].map((n) => ({ id: String(n), user_id: 'reader-1', action_type: 'warned', reason: `Reason ${n}` })) as Props['actions'];
        const view = render(<ClubManageMembersSection {...props} />);
        expect(view.getByText('warned · Reason 3')).toBeOnTheScreen();
        expect(view.queryByText('warned · Reason 4')).toBeNull();
    });
});
