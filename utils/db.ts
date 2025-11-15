import { openDB, IDBPDatabase } from 'idb';
import {
    PipelineProject, Company, Contact, ContactLog, SiteSurveyLog, Meeting,
    Quotation, SaleOrder, PricelistItem
} from '../types';

const DB_NAME = 'limperial-db';
const DB_VERSION = 3; // Incremented version to trigger upgrade

const STORE_CONFIG = {
    projects: { keyPath: 'Pipeline No.' },
    companies: { keyPath: 'Company ID' },
    contacts: { keyPath: 'Customer ID' },
    contactLogs: { keyPath: 'Log ID' },
    siteSurveys: { keyPath: 'Site ID' },
    meetings: { keyPath: 'Meeting ID' },
    quotations: { keyPath: 'Quote No.' },
    saleOrders: { keyPath: 'SO No.' },
    pricelist: { keyPath: 'Item Code' },
} as const;

export const STORE_NAMES = Object.keys(STORE_CONFIG) as (keyof typeof STORE_CONFIG)[];
export type StoreName = keyof typeof STORE_CONFIG;

let dbPromise: Promise<IDBPDatabase> | null = null;

const initDB = () => {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            STORE_NAMES.forEach(storeName => {
                // If the store exists from a previous version, we need to check if it has a keyPath.
                // If it does, we must delete and recreate it to switch to out-of-line keys.
                if (db.objectStoreNames.contains(storeName)) {
                    // This is a simple migration: if upgrading from a version that had keyPaths,
                    // we just rebuild the store. transaction.objectStore() is needed to inspect.
                    const store = transaction.objectStore(storeName);
                    if (store.keyPath) {
                        db.deleteObjectStore(storeName);
                        db.createObjectStore(storeName); // Recreate without keyPath
                    }
                } else {
                    // If the store doesn't exist, create it fresh without a keyPath.
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
                    if (key !== null && key !== undefined && key !== '') {
                        return store.put(item, key);
                    }
                }
                return Promise.resolve();
            }));
        }));
        await tx.done;
    } catch (error) {
        console.error("Failed to set data in IndexedDB:", error);
        // This could be a QuotaExceededError or other transaction failures.
    }
};
