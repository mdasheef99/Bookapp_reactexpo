const CLUB_ORIGINS = ['clubs', 'my-clubs', 'archived', 'invitations', 'authors'] as const;

export function clubOrigin(value: unknown): string | undefined {
    return typeof value === 'string' && CLUB_ORIGINS.some(origin => origin === value) ? value : undefined;
}

// Keep the directory origin separate from editor/picker returnTo destinations.
export function withClubOrigin(href: string, value: unknown): string {
    const origin = clubOrigin(value);
    return origin ? `${href}${href.includes('?') ? '&' : '?'}clubOrigin=${origin}` : href;
}

export function clubDirectoryHref(value: unknown): string {
    switch (clubOrigin(value)) {
        case 'my-clubs': return '/(tabs)/clubs?scope=mine';
        case 'archived': return '/(tabs)/clubs?scope=archived';
        case 'invitations': return '/(tabs)/clubs/invitations';
        case 'authors': return '/(tabs)/clubs/authors';
        default: return '/(tabs)/clubs';
    }
}

export function clubHomeHref(clubId: string, value: unknown, query = ''): string {
    const origin = clubOrigin(value);
    const params = [query, origin ? `returnTo=${origin}` : ''].filter(Boolean).join('&');
    return `/clubs/${clubId}${params ? `?${params}` : ''}`;
}
