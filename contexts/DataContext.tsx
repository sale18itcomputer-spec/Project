'use client';

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { batchReadRecords } from '../services/api';
import { supabase } from '../lib/supabase';
import {
  PipelineProject, Company, Contact, ContactLog, SiteSurveyLog, Meeting,
  Quotation, SaleOrder, PricelistItem, Invoice, DeliveryOrder, Receipt,
  Vendor, VendorPricelistItem, PurchaseOrder
} from '../types';
import {
  PIPELINE_HEADERS, COMPANY_HEADERS, CONTACT_HEADERS, CONTACT_LOG_HEADERS,
  SITE_SURVEY_LOG_HEADERS, MEETING_HEADERS, QUOTATION_HEADERS, SALE_ORDER_HEADERS,
  PRICELIST_HEADERS, INVOICE_HEADERS, DELIVERY_ORDER_HEADERS, RECEIPT_HEADERS,
  VENDOR_HEADERS, VENDOR_PRICELIST_HEADERS, PURCHASE_ORDER_HEADERS
} from '../schemas';
import { useAuth } from './AuthContext';
import * as db from '../utils/db';

const CRITICAL_SHEETS = [
  'Pipelines',
  'Company List',
  'Contact_List',
] as const;

const LAZY_SHEETS = [
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
};

// ── DataProvider ──────────────────────────────────────────────────────────────

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refetchCounter, setRefetchCounter] = useState(0);
  const { isAuthenticated, isAuthLoading } = useAuth();

  const fetchedModulesRef = useRef(new Set<LazySheet>());
  useEffect(() => { fetchedModulesRef.current.clear(); }, [refetchCounter]);

  const refetchData = useCallback(() => {
    fetchedModulesRef.current.clear();
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
  }), []);

  const vendorsRef = useRef<Vendor[] | null>(null);
  useEffect(() => { vendorsRef.current = vendors; }, [vendors]);

  const applyNormalizedData = useCallback((sheetNames: string[], freshData: Record<string, any[]>) => {
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

    db.batchSetStoreData(normalizedData).catch(console.error);
  }, [stateSetters]);

  // ── Real-time subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;

    // Map Supabase table names → { setter, headers, primaryKey }
    // All 15 data tables are covered — including the 6 that were missing before.
    const tableConfig: Record<string, {
      setter: React.Dispatch<React.SetStateAction<any[] | null>>;
      headers: readonly string[];
      primaryKey: string;
    }> = {
      pipelines:        { setter: setProjects,        headers: PIPELINE_HEADERS,         primaryKey: 'Pipeline No' },
      companies:        { setter: setCompanies,       headers: COMPANY_HEADERS,          primaryKey: 'Company ID' },
      contacts:         { setter: setContacts,        headers: CONTACT_HEADERS,          primaryKey: 'Customer ID' },
      meeting_logs:     { setter: setMeetings,        headers: MEETING_HEADERS,          primaryKey: 'Meeting ID' },
      contact_logs:     { setter: setContactLogs,     headers: CONTACT_LOG_HEADERS,      primaryKey: 'Log ID' },
      site_survey_logs: { setter: setSiteSurveys,     headers: SITE_SURVEY_LOG_HEADERS,  primaryKey: 'Site ID' },
      quotations:       { setter: setQuotations,      headers: QUOTATION_HEADERS,        primaryKey: 'Quote No' },
      sale_orders:      { setter: setSaleOrders,      headers: SALE_ORDER_HEADERS,       primaryKey: 'SO No' },
      pricelist:        { setter: setPricelist,       headers: PRICELIST_HEADERS,        primaryKey: 'Code' },
      invoices:         { setter: setInvoices,        headers: INVOICE_HEADERS,          primaryKey: 'Inv No' },
      delivery_orders:  { setter: setDeliveryOrders,  headers: DELIVERY_ORDER_HEADERS,   primaryKey: 'DO No' },
      receipts:         { setter: setReceipts,        headers: RECEIPT_HEADERS,          primaryKey: 'RV No' },
      vendors:          { setter: setVendors,         headers: VENDOR_HEADERS,           primaryKey: 'id' },
      vendor_pricelist: { setter: setVendorPricelist, headers: VENDOR_PRICELIST_HEADERS, primaryKey: 'id' },
      purchase_orders:  { setter: setPurchaseOrders,  headers: PURCHASE_ORDER_HEADERS,   primaryKey: 'id' },
    };

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
        if (status === 'CHANNEL_ERROR') {
          console.error('[DataContext] Realtime channel error — check Supabase dashboard');
        }
      });

    return () => { supabase!.removeChannel(channel); };
  }, [isAuthenticated, isAuthLoading, stateSetters]);

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
      setLoading(true);
      setError(null);
      let loadedFromCache = false;

      // Try IndexedDB cache first (3-second timeout)
      try {
        const criticalStoreNames = CRITICAL_SHEETS.map(s => sheetToStoreMap[s]) as db.StoreName[];
        const cachedData = await Promise.race([
          db.batchGetStoreData(criticalStoreNames),
          new Promise<Partial<Record<db.StoreName, any[]>>>(
            (_, reject) => setTimeout(() => reject(new Error('IndexedDB timeout')), 3000)
          ),
        ]);
        if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
          criticalStoreNames.forEach(name => {
            if (stateSetters[name]) stateSetters[name](cachedData[name]);
          });
          loadedFromCache = true;
        }
      } catch (dbErr) {
        console.warn('[DataContext] IndexedDB read failed:', dbErr);
      }

      // Always fetch fresh from Supabase
      try {
        const freshData = await Promise.race([
          batchReadRecords<Record<string, any[]>>([...CRITICAL_SHEETS]),
          new Promise<Record<string, any[]>>(
            (_, reject) => setTimeout(() => reject(new Error('Network timeout')), 15000)
          ),
        ]);
        applyNormalizedData([...CRITICAL_SHEETS], freshData);
      } catch (netErr: any) {
        console.error('[DataContext] Critical data fetch failed:', netErr);
        if (!loadedFromCache) setError(netErr.message);
        else console.warn('[DataContext] Displaying stale cached data — network unavailable');
      } finally {
        setLoading(false);
      }
    };

    loadCriticalData();
  }, [isAuthenticated, isAuthLoading, refetchCounter]);

  // ── fetchModule — on-demand lazy loading ─────────────────────────────────────
  const refetchModule = useCallback((...sheets: LazySheet[]) => {
    sheets.forEach(s => fetchedModulesRef.current.delete(s));
  }, []);

  const fetchModule = useCallback(async (...sheets: LazySheet[]) => {
    const toFetch = sheets.filter(s => !fetchedModulesRef.current.has(s));
    if (toFetch.length === 0) return;

    toFetch.forEach(s => fetchedModulesRef.current.add(s));

    // Serve stale cache immediately while the network request is in flight
    try {
      const storeNames = toFetch.map(s => sheetToStoreMap[s]) as db.StoreName[];
      const cachedData = await Promise.race([
        db.batchGetStoreData(storeNames),
        new Promise<Partial<Record<db.StoreName, any[]>>>(
          (_, reject) => setTimeout(() => reject(new Error('IDB lazy timeout')), 3000)
        ),
      ]);
      if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
        storeNames.forEach(name => {
          if (stateSetters[name] && (cachedData[name]?.length ?? 0) > 0) {
            stateSetters[name](cachedData[name]);
          }
        });
      }
    } catch (dbErr) {
      console.warn('[DataContext] Lazy IDB read failed:', dbErr);
    }

    // Network fetch
    try {
      const freshData = await batchReadRecords<Record<string, any[]>>(toFetch);
      applyNormalizedData(toFetch, freshData);
    } catch (netErr: any) {
      console.error('[DataContext] Lazy fetch failed:', netErr);
    }
  }, [stateSetters, applyNormalizedData]);

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
