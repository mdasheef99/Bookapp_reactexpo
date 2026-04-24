import type { Href } from 'expo-router';

type BackCapableRouter = {
    back: () => void;
    replace: (href: Href) => void;
    canGoBack?: () => boolean;
};

export function navigateBackOrFallback(router: BackCapableRouter, fallbackHref: Href) {
    if (router.canGoBack?.()) {
        router.back();
        return;
    }

    router.replace(fallbackHref);
}
