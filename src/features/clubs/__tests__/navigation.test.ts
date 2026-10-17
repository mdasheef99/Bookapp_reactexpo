import { clubDirectoryHref, clubHomeHref, clubOrigin, withClubOrigin } from '../navigation';

describe('Clubs directory-origin chains', () => {
    it.each(['clubs', 'my-clubs', 'archived', 'invitations', 'authors'])('preserves %s through editor/picker/Manage/Home', origin => {
        const editor = withClubOrigin('/clubs/c/events/create?returnTo=manage&manageTab=events', origin);
        const editorParams = new URLSearchParams(editor.split('?')[1]);
        expect(editorParams.get('returnTo')).toBe('manage');
        expect(editorParams.get('manageTab')).toBe('events');
        const picker = withClubOrigin('/clubs/c/venues?returnTo=event-editor&draft=%7B%22title%22%3A%22Test%22%7D', editorParams.get('clubOrigin'));
        const pickerParams = new URLSearchParams(picker.split('?')[1]);
        expect(JSON.parse(pickerParams.get('draft')!)).toEqual({ title: 'Test' });
        expect(pickerParams.get('returnTo')).toBe('event-editor');
        expect(clubHomeHref('c', pickerParams.get('clubOrigin'))).toBe(`/clubs/c?returnTo=${origin}`);
        expect(clubHomeHref('c', origin, 'tab=nominations')).toBe(`/clubs/c?tab=nominations&returnTo=${origin}`);
    });

    it.each([undefined, null, '', 'https://example.com', 'manage', ['my-clubs']])('rejects unrecognized origin %p', value => {
        expect(clubOrigin(value)).toBeUndefined();
        expect(withClubOrigin('/clubs/c/events?tab=x', value)).toBe('/clubs/c/events?tab=x');
        expect(clubHomeHref('c', value)).toBe('/clubs/c');
    });

    it.each([
        ['clubs', '/(tabs)/clubs'],
        ['my-clubs', '/(tabs)/clubs?scope=mine'],
        ['archived', '/(tabs)/clubs?scope=archived'],
        ['invitations', '/(tabs)/clubs/invitations'],
        ['authors', '/(tabs)/clubs/authors'],
        [undefined, '/(tabs)/clubs'],
    ])('maps directory origin %s to its return route', (origin, expectedHref) => {
        expect(clubDirectoryHref(origin)).toBe(expectedHref);
    });
});
