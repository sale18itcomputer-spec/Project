import { openDB, IDBPDatabase } from 'idb';


const DB_NAME = 'limperial-db';
const DB_VERSION = 7; // Fixed keyPath fields (removed trailing dots, fixed pricelist key)

const STORE_CONFIG = {
    projects: { keyPath: 'Pipeline No' },
    companies: { keyPath: 'Company ID' },
    contacts: { keyPath: 'Customer ID' },
    contactLogs: { keyPath: 'Log ID' },
    siteSurveys: { keyPath: 'Site ID' },
    meetings: { keyPath: 'Meeting ID' },
    quotations: { keyPath: 'Quote No' },
    saleOrders: { keyPath: 'SO No' },
    pricelist: { keyPath: 'Code' },
    invoices: { keyPath: 'Inv No' },
    vendors: { keyPath: 'id' },
    vendorPricelist: { keyPath: 'id' },
    purchaseOrders: { keyPath: 'id' },
} as const;

export const STORE_NAMES = Object.keys(STORE_CONFIG) as (keyof typeof STORE_CONFIG)[];
export type StoreName = keyof typeof STORE_CONFIG;

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = () => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, _oldVersion, _newVersion, transaction) {
            STORE_NAMES.forEach(storeName => {
                if (db.objectStoreNames.contains(storeName)) {
                    // Only rebuild if the existing store uses an inline keyPath.
                    // Rebuilding unnecessarily wipes cached data, so we skip it when
                    // the store is already out-of-line (keyPath === null).
                    const store = transaction.objectStore(storeName);
                    if (store.keyPath !== null) {
                        db.deleteObjectStore(storeName);
                        db.createObjectStore(storeName); // Recreate with out-of-line keys
                    }
                    // Already correct — leave it alone.
                } else {
                    // Store doesn't exist yet — create it fresh with out-of-line keys.
                    db.createObjectStore(storeName);
                }
            });
        },
    });
    return dbPromise;
};

export const batchGetStoreData = async (storeNames: readonly StoreName[]): Promise<Partial<Record<StoreName, any[]>>> => {
    try {
        const data: Partial<Record<StoreName, any[]>> = {};
        const db = await initDB();
        const tx = db.transaction(storeNames, 'readonly');
        await Promise.all(storeNames.map(async (name) => {
            data[name] = await tx.objectStore(name).getAll();
        }));
        await tx.done;
        return data;
    } catch (error) {
        console.error("Failed to get data from IndexedDB:", error);
        return {}; // Return empty object on error
    }
};

export const batchSetStoreData = async (data: Partial<Record<StoreName, any[]>>) => {
    try {
        const storeNames = Object.keys(data).filter(name => STORE_NAMES.includes(name as StoreName)) as StoreName[];
        if (storeNames.length === 0) return;

        const db = await initDB();
        const tx = db.transaction(storeNames, 'readwrite');
        await Promise.all(storeNames.map(async (name) => {
            const store = tx.objectStore(name);
            await store.clear();

            const keyPath = STORE_CONFIG[name].keyPath;
            await Promise.all((data[name] || []).map(item => {
                if (item && typeof item === 'object' && keyPath in item) {
                    const key = item[keyPath];
                    // We must provide the key separately now (out-of-line).
                    // Also ensure the key is not null/undefined/empty to avoid errors.
                    if (key !== null && key !== undefined && key !== '') {
                        return store.put(item, key);
                    }
                }
                // If item is invalid or has no key, just skip it.
                return Promise.resolve();
            }));
        }));
        await tx.done;
    } catch (error) {
        console.error("Failed to set data in IndexedDB:", error);
        // This could be a QuotaExceededError or other transaction failures.
    }
};