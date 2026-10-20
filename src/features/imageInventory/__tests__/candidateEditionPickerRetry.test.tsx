import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { CandidateEditionPicker } from '../components/CandidateEditionPicker';
import { useOwnerEditionPicker } from '../queries/ownerEditionPickerQueries';
import { pickerChoices, pickerReview } from '../testing/editionPickerClientFixtures';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('../queries/ownerEditionPickerQueries', () => ({
    useOwnerEditionPicker: jest.fn(),
}));

const retryIdentitySearch = jest.fn();
const retryLookup = jest.fn();

beforeEach(() => jest.clearAllMocks());

it('renders a single Retry search when both searches are retryable', () => {
    (useOwnerEditionPicker as jest.Mock).mockReturnValue({
        choices: { data: undefined, isLoading: false, error: null, refetch: jest.fn() },
        selectEdition: { error: null, isPending: false },
        requestOptions: { error: new Error('lookup uncertain'), isPending: false },
        saveIdentityAndSearch: { data: undefined, error: new Error('save uncertain'), isPending: false },
        identityPending: false, selectionPending: false, lookupPending: false,
        isCommandActive: () => false,
        retryIdentitySearch, retryLookup, retrySelection: jest.fn(),
    });
    const view = render(
        <CandidateEditionPicker identity={{ userId: 'owner-a', storeId: 'store-a' }}
            sessionId="session" candidateId="candidate"
            commandSlot={{ claimSlot: () => null, releaseSlot: jest.fn(), isCommandActive: () => false }}
            disabled={false} onSelection={jest.fn()}>{() => null}</CandidateEditionPicker>,
    );
    expect(view.getAllByText('Retry search')).toHaveLength(1);
    fireEvent.press(view.getByText('Retry search'));
    expect(retryIdentitySearch).toHaveBeenCalledTimes(1);
    expect(retryLookup).not.toHaveBeenCalled();
});

it('retries the latest plain lookup after an earlier identity search did not search', async () => {
    const choices = pickerChoices({ optionsExpiresAt: null, rows: [], lookupStatus: 'idle' });
    const saveIdentityAndSearch = jest.fn().mockResolvedValue({
        detail: candidateDetailFixture(), searched: false,
    });
    const requestOptions = jest.fn().mockRejectedValue(new Error('lookup uncertain'));
    (useOwnerEditionPicker as jest.Mock).mockImplementation(() => ({
        choices: { data: choices, isLoading: false, error: null, refetch: jest.fn() },
        selectEdition: { error: null, isPending: false },
        saveIdentityAndSearch: useMutation({ mutationFn: saveIdentityAndSearch }),
        requestOptions: useMutation({ mutationFn: requestOptions }),
        identityPending: false, selectionPending: false, lookupPending: false,
        isCommandActive: () => false,
        retryIdentitySearch, retryLookup, retrySelection: jest.fn(),
    }));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
    const request = { review: pickerReview, expectedCandidateVersion: 4, expectedMetadataRevision: 7 };
    const picker = (identityChanged: boolean) => (
        <QueryClientProvider client={client}>
            <CandidateEditionPicker identity={{ userId: 'owner-a', storeId: 'store-a' }}
                sessionId={testUuid(1)} candidateId={testUuid(2)}
                commandSlot={{ claimSlot: () => null, releaseSlot: jest.fn(), isCommandActive: () => false }}
                cardDraft={{ identityChanged, request: identityChanged ? request : null }}
                disabled={false} onSelection={jest.fn()}>{() => null}</CandidateEditionPicker>
        </QueryClientProvider>
    );
    const view = render(picker(true));
    try {
        await act(async () => fireEvent.press(view.getByText('Search Books')));
        await waitFor(() => expect(view.getByText('Your card details are saved. Retry search to find editions.')).toBeTruthy());
        expect(saveIdentityAndSearch).toHaveBeenCalledTimes(1);

        view.rerender(picker(false));
        await act(async () => fireEvent.press(view.getByText('Search Books')));
        await waitFor(() => expect(view.getByText('The action could not be confirmed. Your current choice and selling details are preserved.')).toBeTruthy());
        expect(requestOptions).toHaveBeenCalledTimes(1);
        expect(view.getAllByText('Retry search')).toHaveLength(1);
        await act(async () => fireEvent.press(view.getByText('Retry search')));
        expect(retryLookup).toHaveBeenCalledTimes(1);
        expect(retryIdentitySearch).not.toHaveBeenCalled();
    } finally {
        view.unmount();
        client.clear();
    }
});
