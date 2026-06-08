import { openDB, IDBPDatabase } from 'idb';

const DB_NAME    = 'limperial-db';
const DB_VERSION = 13; // Bumped: added serialNumbers, serviceTickets, pdiRecords, spareParts stores

// keyPath must match the primary key field used in each TypeScript type
const STORE_CONFIG = {
    projects:         { keyPath: 'Pipeline No' },
    companies:        { keyPath: 'Company ID' },
    contacts:         { keyPath: 'Customer ID' },
    contactLogs:      { keyPath: 'Log ID' },
    siteSurveys:      { keyPath: 'Site ID' },
    meetings:         { keyPath: 'Meeting ID' },
    quotations:       { keyPath: 'Quote No' },
    saleOrders:       { keyPath: 'SO No' },
    pricelist:        { keyPath: 'Code' },
    invoices:         { keyPath: 'Inv No' },
    deliveryOrders:   { keyPath: 'DO No' },
    receipts:         { keyPath: 'RV No' },
    vendors:          { keyPath: 'id' },
    vendorPricelist:  { keyPath: 'id' },
    purchaseOrders:   { keyPath: 'id' },
    inventory:        { keyPath: 'id' },
    productInquiries: { keyPath: 'id' },
    serialNumbers:    { keyPath: 'id' },
    serviceTickets:   { keyPath: 'id' },
    pdiRecords:       { keyPath: 'id' },
    spareParts:       { keyPath: 'id' },
} as const;

export const STORE_NAMES = Object.keys(STORE_CONFIG) as (keyof typeof STORE_CONFIG)[];
export type StoreName = keyof typeof STORE_CONFIG;

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, _oldVersion, _newVersion, tx) {
            STORE_NAMES.forEach(name => {
                // Re-create store only if keyPath changed (safe via delete+create)
                if (db.objectStoreNames.contains(name)) {
                    const store = tx.objectStore(name);
                    // IDBObjectStore.keyPath is null when it was created without one.
                    // We always create stores without a keyPath (using explicit keys),
                    // so no rebuild is needed — just leave existing stores alone.
                    void store; // satisfy lint
                } else {
                    // No keyPath — we supply explicit keys in put() calls
                    db.createObjectStore(name);
                }
            });
        },
        blocked(_current, _blocked) {
            console.warn('[IDB] Connection blocked — older tab holding the lock');
        },
        blocking(_current, _blocked) {
            console.warn('[IDB] This tab is blocking a newer version — closing');
            dbPromise?.then(d => d.close());
            dbPromise = null;
        },
        terminated() {
            console.warn('[IDB] Connection terminated unexpectedly');
            dbPromise = null;
        },
    });

    return dbPromise;
};

// ── Read ──────────────────────────────────────────────────────────────────────

export const batchGetStoreData = async (
    storeNames: readonly StoreName[]
): Promise<Partial<Record<StoreName, any[]>>> => {
    try {
        const data: Partial<Record<StoreName, any[]>> = {};
        const db = await initDB();
        const tx = db.transaction(storeNames as StoreName[], 'readonly');
        await Promise.all(storeNames.map(async (name) => {
            data[name] = await tx.objectStore(name).getAll();
        }));
        await tx.done;
        return data;
    } catch (err) {
        console.error('[IDB] batchGetStoreData failed:', err);
        return {};
    }
};

// ── Write ─────────────────────────────────────────────────────────────────────

export const batchSetStoreData = async (data: Partial<Record<StoreName, any[]>>) => {
    try {
        const storeNames = Object.keys(data).filter(
            name => STORE_NAMES.includes(name as StoreName)
        ) as StoreName[];

        if (storeNames.length === 0) return;

        const db = await initDB();
        const tx = db.transaction(storeNames, 'readwrite');

        await Promise.all(storeNames.map(async (name) => {
            const store     = tx.objectStore(name);
            const keyPath   = STORE_CONFIG[name].keyPath;
            const records   = data[name] ?? [];

            await store.clear();

            // Use Promise.allSettled so one bad record doesn't abort the whole batch
            await Promise.allSettled(records.map(item => {
                if (!item || typeof item !== 'object') return Promise.resolve();

                const key = item[keyPath];
                // Skip records with missing/empty primary keys — they cannot be
                // retrieved by key later and would corrupt the store
                if (key === null || key === undefined || key === '') {
                    console.warn(`[IDB] Skipping record with empty "${keyPath}" in store "${name}"`, item);
                    return Promise.resolve();
                }

                return store.put(item, String(key));
            }));
        }));

        await tx.done;
    } catch (err) {
        console.error('[IDB] batchSetStoreData failed:', err);
    }
};

// ── Single-record helpers (used by optimistic updates) ────────────────────────

export const setStoreItem = async (storeName: StoreName, item: any): Promise<void> => {
    try {
        const keyPath = STORE_CONFIG[storeName].keyPath;
        const key = item?.[keyPath];
        if (!key) return;

        const db = await initDB();
        await db.put(storeName, item, String(key));
    } catch (err) {
        console.error(`[IDB] setStoreItem failed for "${storeName}":`, err);
    }
};

export const deleteStoreItem = async (storeName: StoreName, key: string): Promise<void> => {
    try {
        const db = await initDB();
        await db.delete(storeName, key);
    } catch (err) {
        console.error(`[IDB] deleteStoreItem failed for "${storeName}":`, err);
    }
};

/**
 * Clears every cached store. Called when B2B/B2C mode is toggled so we never
 * serve the wrong-mode rows from cache on the next boot or navigation. The
 * IDB cache is shared by both modes; rather than maintaining two parallel
 * store sets, we wipe and refetch on the (rare) mode flip.
 */
export const clearAllStores = async (): Promise<void> => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAMES as StoreName[], 'readwrite');
        await Promise.all(STORE_NAMES.map(name => tx.objectStore(name).clear()));
        await tx.done;
    } catch (err) {
        console.error('[IDB] clearAllStores failed:', err);
    }
};
