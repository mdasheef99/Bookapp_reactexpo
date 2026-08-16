export const storeViewRoutes = {
    root: () => '/(store-owner)/store-view' as const,
    detail: (inventoryId: string) => ({
        pathname: '/(store-owner)/store-view/[inventoryId]' as const,
        params: { inventoryId },
    }),
};
