import type { Href } from 'expo-router';

type BackCapableRouter = {
    back?: () => void;
    replace: (href: Href) => void;
    canGoBack?: () => boolean;
};

export function navigateBackOrFallback(router: BackCapableRouter, fallbackHref: Href) {
    // Tab history can point at another section, so section back buttons use an explicit destination.
    router.replace(fallbackHref);
}
