import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarketplaceBookCondition, StoreInventoryItem } from '../types';
import { storeInventoryService } from '../services/storeInventoryService';

const DEFAULT_CONDITION: MarketplaceBookCondition = 'good';

export function toMinorUnits(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100);
}

export function toQuantity(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
}

export function rupeesFromMinor(value: number) {
    return Math.round(value / 100);
}

export function useStoreInventory(storeId: string | null) {
    const [items, setItems] = useState<StoreInventoryItem[]>([]);
    const [duplicates, setDuplicates] = useState<StoreInventoryItem[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [conditionFilter, setConditionFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [quantityFilter, setQuantityFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [editingItem, setEditingItem] = useState<StoreInventoryItem | null>(null);
    const [editValues, setEditValues] = useState<Record<string, { price: string; quantity: string }>>({});
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredItems = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return items.filter((item) => {
            if (q.trim()) {
                const titleMatch = item.title.toLowerCase().includes(q);
                const isbn10Match = item.isbn_10?.includes(searchQuery) ?? false;
                const isbn13Match = item.isbn_13?.includes(searchQuery) ?? false;
                const authorMatch = item.authors?.some((a) => a.toLowerCase().includes(q)) ?? false;
                if (!titleMatch && !isbn10Match && !isbn13Match && !authorMatch) return false;
            }
            if (conditionFilter !== 'all' && item.condition !== conditionFilter) return false;
            if (statusFilter !== 'all' && item.visibility_status !== statusFilter) return false;
            if (sourceFilter !== 'all' && (item.entry_method ?? 'manual') !== sourceFilter) return false;
            if (quantityFilter === 'low_stock' && item.quantity_available !== 1) return false;
            if (quantityFilter === 'out_of_stock' && item.quantity_available !== 0) return false;
            if (quantityFilter === 'available' && item.quantity_available <= 1) return false;
            if (dateFilter !== 'all' && item.created_at) {
                const created = new Date(item.created_at).getTime();
                const now = Date.now();
                if (dateFilter === 'last_7_days' && now - created > 7 * 24 * 60 * 60 * 1000) return false;
                if (dateFilter === 'last_30_days' && now - created > 30 * 24 * 60 * 60 * 1000) return false;
            }
            return true;
        });
    }, [conditionFilter, dateFilter, items, quantityFilter, searchQuery, sourceFilter, statusFilter]);

    const loadItems = useCallback(async () => {
        if (!storeId) return;
        storeInventoryService.listStoreInventory(storeId).then(setItems).catch(() => undefined);
    }, [storeId]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const checkDuplicates = useCallback(
        async (isbn13: string, title: string, author: string) => {
            if (!storeId) return;
            const matches = await storeInventoryService.findPotentialDuplicates({
                storeId,
                isbn13,
                title,
                authors: author ? [author] : [],
            });
            setDuplicates(matches);
        },
        [storeId],
    );

    const saveDraft = useCallback(
        async (input: {
            title: string;
            author: string;
            isbn13: string;
            price: string;
            quantity: string;
            condition: MarketplaceBookCondition;
            publicNotes: string;
            shelfLocation: string;
        }) => {
            if (!storeId) return false;
            setIsSaving(true);
            setMessage(null);
            try {
                await storeInventoryService.createManualInventoryItem({
                    storeId,
                    title: input.title,
                    authors: input.author ? [input.author] : [],
                    isbn13: input.isbn13 || null,
                    condition: input.condition,
                    quantityAvailable: toQuantity(input.quantity),
                    sellingPriceMinor: toMinorUnits(input.price),
                    publicNotes: input.publicNotes || null,
                    shelfLocation: input.shelfLocation || null,
                    visibilityStatus: 'draft',
                });
                setMessage('Inventory draft saved.');
                await loadItems();
                setDuplicates([]);
                return true;
            } catch {
                setMessage('Could not save inventory draft.');
                return false;
            } finally {
                setIsSaving(false);
            }
        },
        [storeId, loadItems],
    );

    const publishItem = useCallback(
        async (inventoryId: string) => {
            if (!storeId) return;
            setMessage(null);
            try {
                await storeInventoryService.publishInventoryItem({ storeId, inventoryId });
                setMessage('Inventory published.');
                await loadItems();
            } catch {
                setMessage('Could not publish inventory item.');
            }
        },
        [storeId, loadItems],
    );

    const pauseItem = useCallback(
        async (inventoryId: string) => {
            if (!storeId) return;
            setMessage(null);
            try {
                await storeInventoryService.pauseInventoryItem({ storeId, inventoryId });
                setMessage('Inventory paused.');
                await loadItems();
            } catch {
                setMessage('Could not pause inventory item.');
            }
        },
        [storeId, loadItems],
    );

    const saveItemEdits = useCallback(
        async (inventoryId: string, price: string, quantity: string) => {
            if (!storeId) return;
            setMessage(null);
            try {
                await storeInventoryService.updateInventoryItem({
                    storeId,
                    inventoryId,
                    sellingPriceMinor: toMinorUnits(price),
                    quantityAvailable: toQuantity(quantity),
                });
                setMessage('Inventory updated.');
                await loadItems();
            } catch {
                setMessage('Could not update inventory item.');
            }
        },
        [storeId, loadItems],
    );

    const saveModalEdits = useCallback(
        async (input: {
            inventoryId: string;
            condition: MarketplaceBookCondition;
            publicNotes: string;
            shelfLocation: string;
        }) => {
            if (!storeId) return;
            setMessage(null);
            try {
                await storeInventoryService.updateInventoryItem({
                    storeId,
                    inventoryId: input.inventoryId,
                    condition: input.condition,
                    publicNotes: input.publicNotes || null,
                    shelfLocation: input.shelfLocation || null,
                });
                setMessage('Inventory updated.');
                await loadItems();
                setEditingItem(null);
            } catch {
                setMessage('Could not update inventory item.');
            }
        },
        [storeId, loadItems],
    );

    const openEditModal = useCallback((item: StoreInventoryItem) => {
        setEditingItem(item);
    }, []);

    const closeEditModal = useCallback(() => {
        setEditingItem(null);
    }, []);

    const updateEditValue = useCallback((item: StoreInventoryItem, key: 'price' | 'quantity', value: string) => {
        setEditValues((current) => ({
            ...current,
            [item.id]: {
                price: current[item.id]?.price ?? String(rupeesFromMinor(item.selling_price_minor)),
                quantity: current[item.id]?.quantity ?? String(item.quantity_available),
                [key]: value,
            },
        }));
    }, []);

    const toggleSelection = useCallback((item: StoreInventoryItem) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(item.id)) {
                next.delete(item.id);
            } else {
                next.add(item.id);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }, [filteredItems]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const bulkPublish = useCallback(async () => {
        if (!storeId || selectedIds.size === 0) return;
        setMessage(null);
        let successCount = 0;
        let failCount = 0;
        for (const inventoryId of selectedIds) {
            try {
                await storeInventoryService.publishInventoryItem({ storeId, inventoryId });
                successCount++;
            } catch {
                failCount++;
            }
        }
        if (failCount === 0) {
            setMessage(`Published ${successCount} item(s).`);
        } else {
            setMessage(`Published ${successCount}, failed ${failCount}.`);
        }
        setSelectedIds(new Set());
        await loadItems();
    }, [storeId, selectedIds, loadItems]);

    const bulkPause = useCallback(async () => {
        if (!storeId || selectedIds.size === 0) return;
        setMessage(null);
        let successCount = 0;
        let failCount = 0;
        for (const inventoryId of selectedIds) {
            try {
                await storeInventoryService.pauseInventoryItem({ storeId, inventoryId });
                successCount++;
            } catch {
                failCount++;
            }
        }
        if (failCount === 0) {
            setMessage(`Paused ${successCount} item(s).`);
        } else {
            setMessage(`Paused ${successCount}, failed ${failCount}.`);
        }
        setSelectedIds(new Set());
        await loadItems();
    }, [storeId, selectedIds, loadItems]);

    return {
        items,
        filteredItems,
        duplicates,
        message,
        isSaving,
        searchQuery,
        conditionFilter,
        statusFilter,
        quantityFilter,
        sourceFilter,
        dateFilter,
        editingItem,
        editValues,
        selectedIds,
        setSearchQuery,
        setConditionFilter,
        setStatusFilter,
        setQuantityFilter,
        setSourceFilter,
        setDateFilter,
        setMessage,
        loadItems,
        checkDuplicates,
        saveDraft,
        publishItem,
        pauseItem,
        saveItemEdits,
        saveModalEdits,
        openEditModal,
        closeEditModal,
        updateEditValue,
        toggleSelection,
        selectAll,
        clearSelection,
        bulkPublish,
        bulkPause,
    };
}
