'use client';

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { batchReadRecords, setApiMode, resolveTableByBase } from '../services/api';
import { supabase } from '../lib/supabase';
import { useB2B } from './B2BContext';
import {
  PipelineProject, Company, Contact, ContactLog, SiteSurveyLog, Meeting,
  Quotation, SaleOrder, PricelistItem, Invoice, DeliveryOrder, Receipt,
  Vendor, VendorPricelistItem, PurchaseOrder, InventoryItem
} from '../types';
import {
  PIPELINE_HEADERS, COMPANY_HEADERS, CONTACT_HEADERS, CONTACT_LOG_HEADERS,
  SITE_SURVEY_LOG_HEADERS, MEETING_HEADERS, QUOTATION_HEADERS, SALE_ORDER_HEADERS,
  PRICELIST_HEADERS, INVOICE_HEADERS, DELIVERY_ORDER_HEADERS, RECEIPT_HEADERS,
  VENDOR_HEADERS, VENDOR_PRICELIST_HEADERS, PURCHASE_ORDER_HEADERS, INVENTORY_HEADERS
} from '../schemas';
import { useAuth } from './AuthContext';
import * as db from '../utils/db';
import { withTimeout, isTimeoutError } from '../utils/promise';

// 30s gives slow/distant networks headroom for paginated reads (large tables
// can need several Supabase round-trips). Recoverable — cache continues to
// serve the UI while the next navigation retries.
const NETWORK_TIMEOUT_MS = 30000;
const IDB_TIMEOUT_MS = 3000;

const CRITICAL_SHEETS = [
  // Core CRM tables — needed by every page's header/sidebar
  'Pipelines',
  'Company List',
  'Contact_List',
  // Dashboard metric cards need these immediately; fetching them here runs all
  // 5 tables in parallel during boot instead of waiting for a second round-trip
  // after the Dashboard component mounts and calls fetchModule().
  'Quotations',
  'Sale Orders',
] as const;

const LAZY_SHEETS = [
  // Critical sheets are also fetchable on demand so pages can revalidate them
  // on navigation — without this, they would only refresh via realtime or a
  // full page reload, and a missed realtime event would hide new rows.
  'Pipelines',
  'Company List',
  'Contact_List',
  'Contact_Logs',
  'Site_Survey_Logs',
  'Meeting_Logs',
  'Quotations',
  'Sale Orders',
  'Raw',
  'Invoices',
  'Delivery Orders',
  'Receipts',
  'Vendors',
  'Vendor Pricelist',
  'Purchase Orders',
  'Inventory',
] as const;

type LazySheet = typeof LAZY_SHEETS[number];

interface DataContextProps {
  projects: PipelineProject[] | null;
  setProjects: React.Dispatch<React.SetStateAction<PipelineProject[] | null>>;
  companies: Company[] | null;
  setCompanies: React.Dispatch<React.SetStateAction<Company[] | null>>;
  contacts: Contact[] | null;
  setContacts: React.Dispatch<React.SetStateAction<Contact[] | null>>;
  contactLogs: ContactLog[] | null;
  setContactLogs: React.Dispatch<React.SetStateAction<ContactLog[] | null>>;
  siteSurveys: SiteSurveyLog[] | null;
  setSiteSurveys: React.Dispatch<React.SetStateAction<SiteSurveyLog[] | null>>;
  meetings: Meeting[] | null;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[] | null>>;
  quotations: Quotation[] | null;
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[] | null>>;
  saleOrders: SaleOrder[] | null;
  setSaleOrders: React.Dispatch<React.SetStateAction<SaleOrder[] | null>>;
  pricelist: PricelistItem[] | null;
  setPricelist: React.Dispatch<React.SetStateAction<PricelistItem[] | null>>;
  invoices: Invoice[] | null;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[] | null>>;
  deliveryOrders: DeliveryOrder[] | null;
  setDeliveryOrders: React.Dispatch<React.SetStateAction<DeliveryOrder[] | null>>;
  receipts: Receipt[] | null;
  setReceipts: React.Dispatch<React.SetStateAction<Receipt[] | null>>;
  vendors: Vendor[] | null;
  setVendors: React.Dispatch<React.SetStateAction<Vendor[] | null>>;
  vendorPricelist: VendorPricelistItem[] | null;
  setVendorPricelist: React.Dispatch<React.SetStateAction<VendorPricelistItem[] | null>>;
  purchaseOrders: PurchaseOrder[] | null;
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[] | null>>;
  inventoryItems: InventoryItem[] | null;
  setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[] | null>>;
  loading: boolean;
  error: string | null;
  activeCompanyNames: Set<string>;
  activeContactNames: Set<string>;
  activePipelineIds: Set<string>;
  refetchData: () => void;
  fetchModule: (...sheets: LazySheet[]) => Promise<void>;
  refetchModule: (...sheets: LazySheet[]) => void;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);
export { DataContext };

// ── normalize ─────────────────────────────────────────────────────────────────
// Trims all key whitespace AND strips trailing dots that existed in old schemas
// (e.g. "Pipeline No." → "Pipeline No", "Quote No." → "Quote No").
// This means data already stored in Supabase with old column names will still
// map correctly to TypeScript types until the DB migration is applied.
const normalize = <T,>(items: any[], headers: readonly string[]): T[] => {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    // Build a lookup with both trimmed and dot-stripped keys
    const lookup: Record<string, any> = {};
    for (const rawKey in item) {
      const clean = rawKey.trim().replace(/\.$/, '');
      lookup[clean] = item[rawKey];
      // Also preserve the exact trimmed key (no dot stripping) as fallback
      lookup[rawKey.trim()] = item[rawKey];
    }
    const out = {} as T;
    headers.forEach(header => {
      (out as any)[header] = lookup[header] ?? '';
    });
    return out;
  });
};

const storeToSheetMap: Record<db.StoreName, string> = {
  projects:       'Pipelines',
  companies:      'Company List',
  contacts:       'Contact_List',
  contactLogs:    'Contact_Logs',
  siteSurveys:    'Site_Survey_Logs',
  meetings:       'Meeting_Logs',
  quotations:     'Quotations',
  saleOrders:     'Sale Orders',
  pricelist:      'Raw',
  invoices:       'Invoices',
  deliveryOrders: 'Delivery Orders',
  receipts:       'Receipts',
  vendors:        'Vendors',
  vendorPricelist:'Vendor Pricelist',
  purchaseOrders: 'Purchase Orders',
  inventory:      'Inventory',
};

const sheetToStoreMap = Object.fromEntries(
  Object.entries(storeToSheetMap).map(([k, v]) => [v, k])
);

const sheetToHeadersMap: Record<string, readonly string[]> = {
  'Pipelines':        PIPELINE_HEADERS,
  'Company List':     COMPANY_HEADERS,
  'Contact_List':     CONTACT_HEADERS,
  'Contact_Logs':     CONTACT_LOG_HEADERS,
  'Site_Survey_Logs': SITE_SURVEY_LOG_HEADERS,
  'Meeting_Logs':     MEETING_HEADERS,
  'Quotations':       QUOTATION_HEADERS,
  'Sale Orders':      SALE_ORDER_HEADERS,
  'Raw':              PRICELIST_HEADERS,
  'Invoices':         INVOICE_HEADERS,
  'Delivery Orders':  DELIVERY_ORDER_HEADERS,
  'Receipts':         RECEIPT_HEADERS,
  'Vendors':          VENDOR_HEADERS,
  'Vendor Pricelist': VENDOR_PRICELIST_HEADERS,
  'Purchase Orders':  PURCHASE_ORDER_HEADERS,
  'Inventory':        INVENTORY_HEADERS,
};

// ── DataProvider ──────────────────────────────────────────────────────────────

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refetchCounter, setRefetchCounter] = useState(0);
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { isB2B } = useB2B();

  // Keep the service-layer table routing in sync with the current mode.
  // useLayoutEffect runs synchronously after commit but BEFORE the browser
  // paints, and crucially before any useEffect on the same render — which
  // means setApiMode is in place before the realtime/boot-fetch useEffects
  // observe the new mode. Calling this during render (the previous approach)
  // is a side effect that React 19 concurrent rendering may invoke multiple
  // times or discard, which caused subtle mode-routing races. The legacy
  // write call sites that rely on the singleton execute on user click events
  // — long after this effect has settled — so the timing is safe.
  useLayoutEffect(() => {
    setApiMode(isB2B ? 'B2B' : 'B2C');
  }, [isB2B]);

  // isB2BRef mirrors isB2B so fetchModule can read the current mode at
  // call-time without holding isB2B in its useCallback dep array.
  // Keeping isB2B OUT of fetchModule's deps is the key fix: it prevents
  // fetchModule's reference from changing the moment isB2B flips (which
  // would race against the async db.clearAllStores and read stale cached
  // rows from IDB). fetchModule's reference now only changes when
  // refetchCounter bumps — which happens in the .finally of clearAllStores,
  // so IDB is guaranteed clean by the time any consumer re-fires fetchModule.
  const isB2BRef = useRef(isB2B);
  useEffect(() => { isB2BRef.current = isB2B; }, [isB2B]);

  // Tracks which lazy modules have ever been served from IDB cache in this
  // session. We only hit the IDB cache the FIRST time a module is requested —
  // every subsequent fetchModule() call always re-validates from the network
  // so newly-inserted rows show up on navigation (stale-while-revalidate).
  const idbPrimedRef = useRef(new Set<LazySheet>());
  // Dedupes concurrent fetchModule() calls for the same sheet so React StrictMode
  // double-invocation or rapid navigation does not fire two network requests in parallel.
  const inFlightModulesRef = useRef(new Map<LazySheet, Promise<void>>());
  useEffect(() => {
    idbPrimedRef.current.clear();
    inFlightModulesRef.current.clear();
  }, [refetchCounter]);

  const refetchData = useCallback(() => {
    idbPrimedRef.current.clear();
    inFlightModulesRef.current.clear();
    setRefetchCounter(c => c + 1);
  }, []);

  const [projects,       setProjects]       = useState<PipelineProject[] | null>(null);
  const [companies,      setCompanies]      = useState<Company[] | null>(null);
  const [contacts,       setContacts]       = useState<Contact[] | null>(null);
  const [contactLogs,    setContactLogs]    = useState<ContactLog[] | null>(null);
  const [siteSurveys,    setSiteSurveys]    = useState<SiteSurveyLog[] | null>(null);
  const [meetings,       setMeetings]       = useState<Meeting[] | null>(null);
  const [quotations,     setQuotations]     = useState<Quotation[] | null>(null);
  const [saleOrders,     setSaleOrders]     = useState<SaleOrder[] | null>(null);
  const [pricelist,      setPricelist]      = useState<PricelistItem[] | null>(null);
  const [invoices,       setInvoices]       = useState<Invoice[] | null>(null);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[] | null>(null);
  const [receipts,       setReceipts]       = useState<Receipt[] | null>(null);
  const [vendors,        setVendors]        = useState<Vendor[] | null>(null);
  const [vendorPricelist,setVendorPricelist]= useState<VendorPricelistItem[] | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[] | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const stateSetters = useMemo<Record<db.StoreName, React.Dispatch<React.SetStateAction<any>>>>(() => ({
    projects:       setProjects,
    companies:      setCompanies,
    contacts:       setContacts,
    contactLogs:    setContactLogs,
    siteSurveys:    setSiteSurveys,
    meetings:       setMeetings,
    quotations:     setQuotations,
    saleOrders:     setSaleOrders,
    pricelist:      setPricelist,
    invoices:       setInvoices,
    deliveryOrders: setDeliveryOrders,
    receipts:       setReceipts,
    vendors:        setVendors,
    vendorPricelist:setVendorPricelist,
    purchaseOrders: setPurchaseOrders,
    inventory:      setInventoryItems,
  }), []);

  const vendorsRef = useRef<Vendor[] | null>(null);
  useEffect(() => { vendorsRef.current = vendors; }, [vendors]);

  // Mode-generation counter. Every B2B↔B2C flip bumps this. Async fetches
  // started before the flip capture the old value and check it before applying
  // their data — without this guard, an in-flight B2C fetch can complete AFTER
  // the new B2B fetch and overwrite state with B2C rows (this is what caused
  // "B2B mode showing B2C data" — the slower fetch wins the race).
  const modeGenerationRef = useRef(0);

  // Mode switch handler — when the user toggles B2B ↔ B2C, the in-memory state
  // and IDB cache both contain data from the OLD mode. Clear both so the next
  // fetch lands on the new mode's tables with no leakage from the previous mode.
  // The prevModeRef guard skips the initial render (no flip happened yet) AND
  // makes the effect idempotent under React StrictMode's double-invoke in dev:
  // the second invoke sees prevModeRef.current === isB2B and exits early, so
  // clearAllStores is only fired once per actual mode flip.
  //
  // IMPORTANT: do NOT use a cancellation flag with a cleanup function here.
  // StrictMode runs (effect → cleanup → effect) on every effect, so a cleanup
  // that sets `cancelled = true` would prevent setRefetchCounter from EVER
  // firing — the .finally callback would run after the synthetic cleanup,
  // see cancelled=true, and skip the bump. That leaves state cleared but
  // never repopulated, locking the whole app on a loading skeleton.
  const prevModeRef = useRef<boolean>(isB2B);
  useEffect(() => {
    if (prevModeRef.current === isB2B) return;
    prevModeRef.current = isB2B;

    // Bump the generation BEFORE clearing state — any in-flight fetch that
    // captured the previous generation will discard its result on completion.
    modeGenerationRef.current += 1;

    // Wipe React state immediately so dashboards stop showing old-mode rows.
    Object.values(stateSetters).forEach(setter => setter(null));
    idbPrimedRef.current.clear();
    inFlightModulesRef.current.clear();

    // Await the IDB cache clear BEFORE bumping refetchCounter — otherwise the
    // next boot fetch races the clear and reads stale wrong-mode rows from
    // cache, briefly displaying B2C data inside a B2B session (or vice versa).
    db.clearAllStores()
      .catch(err => console.warn('[DataContext] clearAllStores failed:', err))
      .finally(() => {
        setRefetchCounter(c => c + 1);
      });
  }, [isB2B, stateSetters]);

  const applyNormalizedData = useCallback((
    sheetNames: string[],
    freshData: Record<string, any[]>,
    fetchGen: number,
  ) => {
    const normalizedData: Partial<Record<db.StoreName, any[]>> = {};

    for (const sheetName of sheetNames) {
      const storeName = sheetToStoreMap[sheetName] as db.StoreName;
      const data = freshData[sheetName];
      const headers = sheetToHeadersMap[sheetName];
      if (!data || !headers || !storeName || !stateSetters[storeName]) continue;

      const normalized = normalize(data, headers);

      if (storeName === 'vendorPricelist') {
        const currentVendors = (normalizedData['vendors'] as Vendor[] | undefined) ?? vendorsRef.current ?? [];
        const withNames = (normalized as VendorPricelistItem[]).map(item => {
          const vendor = currentVendors.find(v =>
            String(v.id ?? '').toLowerCase() === String(item.vendor_id ?? '').toLowerCase()
          );
          return { ...item, vendor_name: vendor?.vendor_name ?? 'Unknown Vendor' };
        });
        stateSetters[storeName](withNames);
        normalizedData[storeName] = withNames;
      } else if (storeName === 'purchaseOrders') {
        const currentVendors = (normalizedData['vendors'] as Vendor[] | undefined) ?? vendorsRef.current ?? [];
        const pos = (normalized as PurchaseOrder[]).map(po => {
          const vendor = currentVendors.find(v => v.id === po.vendor_id);
          return { ...po, vendor_name: po.vendor_name || vendor?.vendor_name || '' };
        });
        stateSetters[storeName](pos);
        normalizedData[storeName] = pos;
      } else {
        stateSetters[storeName](normalized);
        normalizedData[storeName] = normalized;
      }
    }

    // Guard the IDB write with the fetch generation.
    // applyNormalizedData is called synchronously after a stale check, so
    // fetchGen === modeGenerationRef.current is true at this moment. But
    // batchSetStoreData is async — it enqueues an IDB readwrite transaction
    // that executes later. If a mode switch fires between here and the actual
    // IDB write, clearAllStores will have enqueued its own transaction AFTER
    // ours (IDB serialises readwrite transactions in start order), so it will
    // clear our data. We perform a second generation check inside the callback
    // so we can skip the write entirely if a new mode switch already happened —
    // this prevents a B2C write from racing a B2B clearAllStores in the rare
    // scenario where modeGenerationRef is bumped before the IDB layer drains.
    const capturedGen = fetchGen;
    if (capturedGen === modeGenerationRef.current) {
      db.batchSetStoreData(normalizedData)
        .then(() => {
          // Post-write guard: if the mode flipped while the transaction was
          // executing, clear IDB again so the stale rows aren't served on the
          // next fetchModule call.
          if (capturedGen !== modeGenerationRef.current) {
            db.clearAllStores().catch(console.error);
          }
        })
        .catch(console.error);
    }
  }, [stateSetters]);

  // ── Real-time subscription ───────────────────────────────────────────────────
  // Re-subscribes whenever the user toggles B2B ↔ B2C so the channel listens
  // to the right physical table set (b2b_* tables in B2B mode, base tables in
  // B2C). The dep on isB2B triggers the cleanup → resubscribe cycle.
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;

    // Each entry maps a BASE table name → state setter. We expand it below
    // into a mode-resolved tableConfig (base or b2b_* depending on isB2B).
    const baseConfig: Array<{
      base: string;
      setter: React.Dispatch<React.SetStateAction<any[] | null>>;
      headers: readonly string[];
      primaryKey: string;
    }> = [
      { base: 'pipelines',        setter: setProjects,        headers: PIPELINE_HEADERS,         primaryKey: 'Pipeline No' },
      { base: 'companies',        setter: setCompanies,       headers: COMPANY_HEADERS,          primaryKey: 'Company ID' },
      { base: 'contacts',         setter: setContacts,        headers: CONTACT_HEADERS,          primaryKey: 'Customer ID' },
      { base: 'meeting_logs',     setter: setMeetings,        headers: MEETING_HEADERS,          primaryKey: 'Meeting ID' },
      { base: 'contact_logs',     setter: setContactLogs,     headers: CONTACT_LOG_HEADERS,      primaryKey: 'Log ID' },
      { base: 'site_survey_logs', setter: setSiteSurveys,     headers: SITE_SURVEY_LOG_HEADERS,  primaryKey: 'Site ID' },
      { base: 'quotations',       setter: setQuotations,      headers: QUOTATION_HEADERS,        primaryKey: 'Quote No' },
      { base: 'sale_orders',      setter: setSaleOrders,      headers: SALE_ORDER_HEADERS,       primaryKey: 'SO No' },
      { base: 'pricelist',        setter: setPricelist,       headers: PRICELIST_HEADERS,        primaryKey: 'Code' },
      { base: 'invoices',         setter: setInvoices,        headers: INVOICE_HEADERS,          primaryKey: 'Inv No' },
      { base: 'delivery_orders',  setter: setDeliveryOrders,  headers: DELIVERY_ORDER_HEADERS,   primaryKey: 'DO No' },
      { base: 'receipts',         setter: setReceipts,        headers: RECEIPT_HEADERS,          primaryKey: 'RV No' },
      { base: 'vendors',          setter: setVendors,         headers: VENDOR_HEADERS,           primaryKey: 'id' },
      { base: 'vendor_pricelist', setter: setVendorPricelist, headers: VENDOR_PRICELIST_HEADERS, primaryKey: 'id' },
      { base: 'purchase_orders',  setter: setPurchaseOrders,  headers: PURCHASE_ORDER_HEADERS,   primaryKey: 'id' },
      { base: 'inventory',        setter: setInventoryItems,  headers: INVENTORY_HEADERS,        primaryKey: 'id' },
    ];

    // Resolve each base table to its mode-specific physical table name. Keys
    // become e.g. `b2b_invoices` in B2B mode, `invoices` in B2C. isB2B is
    // passed explicitly so the resolution doesn't depend on the module-level
    // singleton being in sync at the moment this effect fires.
    const tableConfig: Record<string, {
      setter: React.Dispatch<React.SetStateAction<any[] | null>>;
      headers: readonly string[];
      primaryKey: string;
    }> = {};
    for (const cfg of baseConfig) {
      const resolved = resolveTableByBase(cfg.base, isB2B);
      tableConfig[resolved] = { setter: cfg.setter, headers: cfg.headers, primaryKey: cfg.primaryKey };
    }

    const channelId = `db_changes_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

    const channel = supabase!
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        const config = tableConfig[table];
        if (!config) return;

        const { setter, headers, primaryKey } = config;

        if (eventType === 'INSERT') {
          const item = normalize([newRecord], headers)[0];
          setter(prev => {
            if (!prev) return [item];
            // Deduplicate: skip if already present (can happen on optimistic updates)
            if (prev.some(r => r[primaryKey] === item[primaryKey])) return prev;
            return [item, ...prev];
          });

        } else if (eventType === 'UPDATE') {
          const item = normalize([newRecord], headers)[0];
          setter(prev =>
            prev
              ? prev.map(r => r[primaryKey] === item[primaryKey] ? item : r)
              : [item]
          );

        } else if (eventType === 'DELETE') {
          // REPLICA IDENTITY FULL ensures oldRecord has the primary key
          const deletedId = oldRecord?.[primaryKey];
          if (deletedId !== undefined && deletedId !== null && deletedId !== '') {
            setter(prev => prev ? prev.filter(r => r[primaryKey] !== deletedId) : prev);
          }
        }
      })
      .subscribe((status) => {
        // CHANNEL_ERROR / TIMED_OUT / CLOSED are recoverable — Supabase
        // auto-reconnects. They get triggered when the channel is rapidly
        // torn down and re-subscribed (e.g. on rapid B2B↔B2C toggles, or
        // during Next.js dev HMR). Logged as warn so the dev overlay stays
        // clean. SUBSCRIBED is the success state and we just silence it.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[DataContext] Realtime status: ${status} (auto-reconnect in progress)`);
        }
      });

    return () => { supabase!.removeChannel(channel); };
  // isB2B is in the deps so the subscription tears down and re-subscribes on
  // mode flip, pointing at the correct b2b_* or base table set.
  }, [isAuthenticated, isAuthLoading, stateSetters, isB2B]);

  // ── Boot fetch — critical tables ─────────────────────────────────────────────
  useEffect(() => {
    const clearData = () => Object.values(stateSetters).forEach(setter => setter(null));

    if (isAuthLoading) {
      setLoading(true);
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      clearData();
      return;
    }

    const loadCriticalData = async () => {
      // Capture mode + generation at the start of this fetch. The mode is
      // passed EXPLICITLY to batchReadRecords so there's no reliance on the
      // module-level singleton in services/api — that singleton can lag
      // behind React renders during HMR / concurrent rendering / strict-mode
      // double-invocation, which is how B2C data was leaking into B2B mode.
      // Use isB2BRef.current (not the closure value) so this always reads the
      // latest mode — same pattern as fetchModule — in case the mode was
      // restored from localStorage between the effect scheduling and running.
      const fetchIsB2B = isB2BRef.current;
      const fetchGen = modeGenerationRef.current;
      const isStale = () => fetchGen !== modeGenerationRef.current;

      setLoading(true);
      setError(null);
      let loadedFromCache = false;

      try {
        // Try IndexedDB cache first
        try {
          const criticalStoreNames = CRITICAL_SHEETS.map(s => sheetToStoreMap[s]) as db.StoreName[];
          const cachedData = await withTimeout(
            db.batchGetStoreData(criticalStoreNames),
            IDB_TIMEOUT_MS,
            'IndexedDB read timed out',
          );
          if (isStale()) return;
          if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
            criticalStoreNames.forEach(name => {
              if (stateSetters[name]) stateSetters[name](cachedData[name]);
            });
            loadedFromCache = true;
          }
        } catch (dbErr) {
          console.warn('[DataContext] IndexedDB read failed:', dbErr);
        }

        if (isStale()) return;

        // Always fetch fresh from Supabase
        try {
          const freshData = await withTimeout(
            batchReadRecords<Record<string, any[]>>([...CRITICAL_SHEETS], fetchIsB2B),
            NETWORK_TIMEOUT_MS,
            'Critical data network timeout',
          );
          if (isStale()) return; // mode flipped while we were waiting — drop the result
          applyNormalizedData([...CRITICAL_SHEETS], freshData, fetchGen);
        } catch (netErr: any) {
          if (isStale()) return;
          // Timeouts are expected on slow networks — log as warn so they don't
          // trigger the Next.js dev error overlay. Cache continues to serve UI.
          if (isTimeoutError(netErr)) {
            console.warn('[DataContext] Critical data fetch timed out — using cached data.');
          } else {
            console.error('[DataContext] Critical data fetch failed:', netErr);
          }
          if (!loadedFromCache) setError(netErr.message);
        }
      } finally {
        // Always unblock the loading flag, even when a stale-check fired early.
        // Previously the IDB stale return (before the network try-finally) and
        // the between-blocks stale return had NO finally, leaving loading=true
        // permanently until the next refetchCounter bump. With this outer
        // finally, setLoading(false) is guaranteed on every exit path.
        //
        // When stale: the mode-switch effect is already clearing IDB and will
        // bump refetchCounter → set loading=true again in the next tick, so the
        // brief loading=false flash here is invisible to the user.
        setLoading(false);
      }
    };

    loadCriticalData();
  }, [isAuthenticated, isAuthLoading, refetchCounter]);

  // ── fetchModule — on-demand lazy loading ─────────────────────────────────────
  // Kept for backwards compatibility — every fetchModule() call now revalidates
  // from the network, so callers no longer need refetchModule() to bust a cache.
  const refetchModule = useCallback((...sheets: LazySheet[]) => {
    sheets.forEach(s => {
      idbPrimedRef.current.delete(s);
      inFlightModulesRef.current.delete(s);
    });
  }, []);

  const fetchModule = useCallback(async (...sheets: LazySheet[]) => {
    // Stale-while-revalidate: ALWAYS hit the network so newly-inserted rows
    // appear on navigation. Only the IDB cache priming is gated so we don't
    // overwrite a fresh in-memory state with older cached rows.
    const toFetch: LazySheet[] = [];
    const awaiting: Promise<void>[] = [];
    for (const s of sheets) {
      const existing = inFlightModulesRef.current.get(s);
      if (existing) { awaiting.push(existing); continue; }
      toFetch.push(s);
    }
    if (toFetch.length === 0) {
      if (awaiting.length > 0) await Promise.all(awaiting).catch(() => {});
      return;
    }

    // Capture the mode + generation at the start of this lazy fetch. The
    // mode is passed EXPLICITLY to batchReadRecords below so the read can't
    // be redirected to the wrong table by an out-of-sync API singleton.
    // The generation guard then discards the result if the user toggled
    // modes while the fetch was in flight.
    // isB2BRef.current (not the closure value) is used so this callback can
    // always read the latest mode without holding isB2B as a dep — see the
    // comment on isB2BRef above for the full race-condition explanation.
    const fetchIsB2B = isB2BRef.current;
    const fetchGen = modeGenerationRef.current;
    const isStale = () => fetchGen !== modeGenerationRef.current;

    const run = (async () => {
      // Prime UI from IDB only the FIRST time per session — avoids the cached
      // 500 rows briefly clobbering 501 fresh rows on a subsequent navigation.
      const idbCandidates = toFetch.filter(s => !idbPrimedRef.current.has(s));
      if (idbCandidates.length > 0) {
        try {
          const storeNames = idbCandidates.map(s => sheetToStoreMap[s]) as db.StoreName[];
          const cachedData = await withTimeout(
            db.batchGetStoreData(storeNames),
            IDB_TIMEOUT_MS,
            'IDB lazy read timed out',
          );
          if (isStale()) return;
          storeNames.forEach(name => {
            const cached = cachedData[name];
            if (!stateSetters[name] || !cached || cached.length === 0) return;
            // Functional setter: only apply cache when state is still empty.
            // Prevents older IDB rows from overwriting fresher in-memory state
            // populated by the auth-time boot fetch or realtime subscription.
            stateSetters[name](prev => (prev === null || prev.length === 0) ? cached : prev);
          });
          idbCandidates.forEach(s => idbPrimedRef.current.add(s));
        } catch (dbErr) {
          console.warn('[DataContext] Lazy IDB read failed:', dbErr);
        }
      }

      if (isStale()) return;

      // Network fetch with timeout — always runs to revalidate state.
      try {
        const freshData = await withTimeout(
          batchReadRecords<Record<string, any[]>>(toFetch, fetchIsB2B),
          NETWORK_TIMEOUT_MS,
          `Network timeout loading ${toFetch.join(', ')}`,
        );
        if (isStale()) return; // mode flipped during fetch — drop the result
        applyNormalizedData(toFetch, freshData, fetchGen);
      } catch (netErr: any) {
        if (isStale()) return;
        // Timeouts are recoverable — cache continues to serve the UI and the
        // next navigation will retry. Logged as warn so the dev overlay stays
        // clean. Real failures still log as error.
        if (isTimeoutError(netErr)) {
          console.warn(`[DataContext] Lazy fetch timed out (${toFetch.join(', ')}) — using cached data.`);
        } else {
          console.error('[DataContext] Lazy fetch failed:', netErr);
        }
      }
    })();

    toFetch.forEach(s => inFlightModulesRef.current.set(s, run));
    try {
      await Promise.all([run, ...awaiting]);
    } finally {
      toFetch.forEach(s => {
        if (inFlightModulesRef.current.get(s) === run) {
          inFlightModulesRef.current.delete(s);
        }
      });
    }
  // refetchCounter (NOT isB2B) is in the deps so fetchModule's reference
  // only changes AFTER db.clearAllStores() has finished — clearAllStores
  // resolves → .finally bumps refetchCounter → new fetchModule reference.
  //
  // Previously isB2B was in the deps, which caused the reference to change
  // the instant the mode flipped. Dashboard's useEffect([fetchModule]) would
  // fire immediately, BEFORE clearAllStores finished, read stale B2C rows
  // from IDB (because state was null / just cleared), and display them.
  //
  // With refetchCounter as the gate: by the time pages re-fire fetchModule,
  // IDB is already empty and isB2BRef.current holds the new mode — both
  // correct-mode cache reads and network fetches land on the right tables.
  }, [stateSetters, applyNormalizedData, refetchCounter]);

  // ── Derived sets ─────────────────────────────────────────────────────────────
  const { activeCompanyNames, activeContactNames, activePipelineIds } = useMemo(() => {
    const activeCompanyNames = new Set<string>();
    const activeContactNames = new Set<string>();
    const activePipelineIds  = new Set<string>();
    projects?.forEach(p => {
      if (p['Company Name']) activeCompanyNames.add(p['Company Name']);
      if (p['Contact Name']) activeContactNames.add(p['Contact Name']);
      if (p['Pipeline No'])  activePipelineIds.add(p['Pipeline No']);
    });
    return { activeCompanyNames, activeContactNames, activePipelineIds };
  }, [projects]);

  const value: DataContextProps = {
    projects,       setProjects,
    companies,      setCompanies,
    contacts,       setContacts,
    contactLogs,    setContactLogs,
    siteSurveys,    setSiteSurveys,
    meetings,       setMeetings,
    quotations,     setQuotations,
    saleOrders,     setSaleOrders,
    pricelist,      setPricelist,
    invoices,       setInvoices,
    deliveryOrders, setDeliveryOrders,
    receipts,       setReceipts,
    vendors,        setVendors,
    vendorPricelist,setVendorPricelist,
    purchaseOrders, setPurchaseOrders,
    inventoryItems, setInventoryItems,
    loading, error,
    activeCompanyNames, activeContactNames, activePipelineIds,
    refetchData, fetchModule, refetchModule,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
