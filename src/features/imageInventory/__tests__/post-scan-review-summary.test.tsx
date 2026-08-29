import { render } from '@testing-library/react-native';
import { PostScanReviewSummary } from '../components/post-scan-review-summary';

describe('Phase 9 post-scan review summary', () => {
    it('separates lifetime detection from the active cards shown below', () => {
        const screen = render(
            <PostScanReviewSummary
                sessionStatus="active"
                inputCount={1}
                visibleCount={3}
                batchLabel="Front table"
                counts={{
                    detected: 7,
                    processing: 1,
                    needsAttention: 2,
                    reviewReadySaved: 3,
                    committed: 1,
                    ownerRemoved: 1,
                    falseDetections: 0,
                }}
            />,
        );

        expect(screen.getByText('Review scanned books')).toBeTruthy();
        expect(screen.getByText('Processing scan')).toBeTruthy();
        expect(screen.getByText('7')).toBeTruthy();
        expect(screen.getByText('Detected')).toBeTruthy();
        expect(screen.getAllByText('3')).toHaveLength(2);
        expect(screen.getByText('In review')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Need review')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByText('Added')).toBeTruthy();
        expect(screen.getByText(/Detected is the session total/u)).toBeTruthy();
        expect(screen.getByText('One image · Up to 15 books')).toBeTruthy();
        expect(screen.getByText('Front table')).toBeTruthy();
    });

    it('labels closed sessions as read-only without manufacturing mutation authority', () => {
        const screen = render(
            <PostScanReviewSummary
                sessionStatus="closed"
                inputCount={1}
                visibleCount={2}
                batchLabel={null}
                counts={{
                    detected: 2,
                    processing: 0,
                    needsAttention: 0,
                    reviewReadySaved: 2,
                    committed: 0,
                    ownerRemoved: 0,
                    falseDetections: 0,
                }}
            />,
        );

        expect(screen.getByText('Closed · Read only')).toBeTruthy();
    });
});
