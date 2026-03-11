import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ClubApplicationsScreen from '../ClubApplicationsScreen';

const mockUseClubPublicDetail = jest.fn();
const mockUseClubMembership = jest.fn();
const mockUseClubJoinQuestions = jest.fn();
const mockUseClubApplications = jest.fn();
const mockUseReviewClubApplication = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
    router: { back: jest.fn() },
    useLocalSearchParams: () => ({ clubId: 'club-approval' }),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            bgPrimary: '#FFFFFF', bgCard: '#F8FAFC', bgSecondary: '#EEF2FF', border: '#CBD5E1', accent: '#4F46E5',
            textPrimary: '#0F172A', textSecondary: '#475569', textTertiary: '#94A3B8', accentLight: '#818CF8',
        },
    }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 'moderator-1' } }),
}));
jest.mock('@/features/clubs/hooks/useClubs', () => ({
    useClubPublicDetail: (...args: unknown[]) => mockUseClubPublicDetail(...args),
    useClubMembership: (...args: unknown[]) => mockUseClubMembership(...args),
    useClubJoinQuestions: (...args: unknown[]) => mockUseClubJoinQuestions(...args),
    useClubApplications: (...args: unknown[]) => mockUseClubApplications(...args),
    useReviewClubApplication: (...args: unknown[]) => mockUseReviewClubApplication(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubPublicDetail.mockReturnValue({
        data: { id: 'club-approval', name: 'Approval Circle', club_type: 'approval', admin_id: 'admin-1' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
    });
    mockUseClubMembership.mockReturnValue({ data: { role: 'moderator', status: 'active' }, isLoading: false });
    mockUseClubJoinQuestions.mockReturnValue({ data: [], isLoading: false });
    mockUseClubApplications.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
    mockUseReviewClubApplication.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
});

describe('ClubApplicationsScreen', () => {
    it('renders live array-shaped answer payloads without crashing', () => {
        mockUseClubApplications.mockReturnValue({
            data: [{
                id: 'application-1',
                club_id: 'club-approval',
                user_id: 'reader-1',
                status: 'pending',
                answers: [
                    {
                        questionId: 'question-1',
                        question: 'Why do you want to join this approval club?',
                        answer: 'I want a smaller, discussion-first reading group.',
                    },
                ],
                applicantProfile: { display_name: 'Reader One', city: 'Delhi' },
            }],
            isLoading: false,
            refetch: jest.fn(),
        });

        const { getByText } = render(<ClubApplicationsScreen />);

        expect(getByText('Reader One')).toBeOnTheScreen();
        expect(getByText('Why do you want to join this approval club?')).toBeOnTheScreen();
        expect(getByText('I want a smaller, discussion-first reading group.')).toBeOnTheScreen();
    });

    it('shows a normalized entitlement error when application review is rejected by manager eligibility rules', async () => {
        const mutateAsync = jest.fn().mockRejectedValue(new Error('Only eligible moderators or admins can review applications'));
        mockUseClubApplications.mockReturnValue({
            data: [{
                id: 'application-1',
                club_id: 'club-approval',
                user_id: 'reader-1',
                status: 'pending',
                answers: null,
                applicantProfile: { display_name: 'Reader One', city: 'Delhi' },
            }],
            isLoading: false,
            isError: false,
            error: null,
            refetch: jest.fn(),
        });
        mockUseReviewClubApplication.mockReturnValue({ mutateAsync, isPending: false });

        const { getByTestId, getByText } = render(<ClubApplicationsScreen />);

        fireEvent.press(getByTestId('approve-application-application-1'));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ applicationId: 'application-1', decision: 'approved', declineReason: undefined }));
        expect(getByText('Only eligible Pro/Pro+ moderators or the club admin can review applications for this club.')).toBeOnTheScreen();
    });
});