'use client';

import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { batchReadRecords } from '../services/api';
import { supabase } from '../lib/supabase';
import {
  PipelineProject,
  Company,
  Contact,
  ContactLog,
  SiteSurveyLog,
  Meeting,
  Quotation,
  SaleOrder,
  PricelistItem,
  Invoice,
  Vendor,
  VendorPricelistItem,
  PurchaseOrder
} from '../types';
import {
  PIPELINE_HEADERS,
  COMPANY_HEADERS,
  CONTACT_HEADERS,
  CONTACT_LOG_HEADERS,
  SITE_SURVEY_LOG_HEADERS,
  MEETING_HEADERS,
  QUOTATION_HEADERS,
  SALE_ORDER_HEADERS,
  PRICELIST_HEADERS,
  INVOICE_HEADERS,
  VENDOR_HEADERS,
  VENDOR_PRICELIST_HEADERS,
  PURCHASE_ORDER_HEADERS
} from '../schemas';
import { useAuth } from './AuthContext';
import * as db from '../utils/db';

// ---------------------------------------------------------------------------
// Fetch strategy
//
// CRITICAL tables are fetched immediately on login — they're needed by the
// dashboard and sidebar counts.
//
// LAZY tables are fetched only when explicitly requested via `fetchModule()`.
// They may still be served from IndexedDB cache on first call, so the UI
// stays responsive while the network request completes in the background.
// ---------------------------------------------------------------------------
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
  'Vendors',
  'Vendor Pricelist',
  'Purchase Orders',
] as const;

type LazySheet = typeof LAZY_SHEETS[number];

// Which modules have been fetched this session (avoids duplicate network hits)
const fetchedModules = new Set<LazySheet>();

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
  /** Call this inside a module page to ensure its data is fetched. */
  fetchModule: (...sheets: LazySheet[]) => Promise<void>;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

const normalize = <T,>(items: any[], headers: readonly string[]): T[] => {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    const trimmedKeyItem: Record<string, any> = {};
    for (const key in item) {
      trimmedKeyItem[key.trim()] = item[key];
    }
    const normalizedItem = {} as T;
    headers.forEach(header => {
      (normalizedItem as any)[header] = trimmedKeyItem[header] ?? '';
    });
    return normalizedItem;
  });
};

const storeToSheetMap: Record<db.StoreName, string> = {
  projects: 'Pipelines',
  companies: 'Company List',
  contacts: 'Contact_List',
  contactLogs: 'Contact_Logs',
  siteSurveys: 'Site_Survey_Logs',
  meetings: 'Meeting_Logs',
  quotations: 'Quotations',
  saleOrders: 'Sale Orders',
  pricelist: 'Raw',
  invoices: 'Invoices',
  vendors: 'Vendors',
  vendorPricelist: 'Vendor Pricelist',
  purchaseOrders: 'Purchase Orders',
};

const sheetToStoreMap = Object.fromEntries(Object.entries(storeToSheetMap).map(([k, v]) => [v, k]));

const sheetToHeadersMap: Record<string, readonly string[]> = {
  'Pipelines': PIPELINE_HEADERS,
  'Company List': COMPANY_HEADERS,
  'Contact_List': CONTACT_HEADERS,
  'Contact_Logs': CONTACT_LOG_HEADERS,
  'Site_Survey_Logs': SITE_SURVEY_LOG_HEADERS,
  'Meeting_Logs': MEETING_HEADERS,
  'Quotations': QUOTATION_HEADERS,
  'Sale Orders': SALE_ORDER_HEADERS,
  'Raw': PRICELIST_HEADERS,
  'Invoices': INVOICE_HEADERS,
  'Vendors': VENDOR_HEADERS,
  'Vendor Pricelist': VENDOR_PRICELIST_HEADERS,
  'Purchase Orders': PURCHASE_ORDER_HEADERS,
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refetchCounter, setRefetchCounter] = useState(0);
  const { isAuthenticated } = useAuth();

  const refetchData = useCallback(() => {
    fetchedModules.clear();
    setRefetchCounter(c => c + 1);
  }, []);

  const [projects, setProjects] = useState<PipelineProject[] | null>(null);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactLogs, setContactLogs] = useState<ContactLog[] | null>(null);
  const [siteSurveys, setSiteSurveys] = useState<SiteSurveyLog[] | null>(null);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[] | null>(null);
  const [pricelist, setPricelist] = useState<PricelistItem[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [vendorPricelist, setVendorPricelist] = useState<VendorPricelistItem[] | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stateSetters = useMemo<Record<db.StoreName, React.Dispatch<React.SetStateAction<any>>>>(() => ({
    projects: setProjects,
    companies: setCompanies,
    contacts: setContacts,
    contactLogs: setContactLogs,
    siteSurveys: setSiteSurveys,
    meetings: setMeetings,
    quotations: setQuotations,
    saleOrders: setSaleOrders,
    pricelist: setPricelist,
    invoices: setInvoices,
    vendors: setVendors,
    vendorPricelist: setVendorPricelist,
    purchaseOrders: setPurchaseOrders,
  }), []);

  // ---------------------------------------------------------------------------
  // Core normalise-and-store helper (shared by boot fetch and lazy fetch)
  // ---------------------------------------------------------------------------
  // vendorsRef gives applyNormalizedData access to the latest vendors state
  // without making it a dependency (which would cause unnecessary re-renders).
  const vendorsRef = React.useRef<Vendor[] | null>(null);
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
        // Prefer vendors fetched in the same batch; fall back to current state
        const currentVendors =
          (normalizedData['vendors'] as Vendor[] | undefined) ??
          vendorsRef.current ??
          [];
        const withNames = (normalized as VendorPricelistItem[]).map(item => {
          const vendor = currentVendors.find(
            v => String(v.id || '').toLowerCase() === String(item.vendor_id || '').toLowerCase()
          );
          return { ...item, vendor_name: vendor?.vendor_name ?? 'Unknown Vendor' };
        });
        stateSetters[storeName](withNames);
        normalizedData[storeName] = withNames;
      } else if (storeName === 'purchaseOrders') {
        // Prefer vendors fetched in the same batch; fall back to current state
        const currentVendors =
          (normalizedData['vendors'] as Vendor[] | undefined) ??
          vendorsRef.current ??
          [];
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

  // ---------------------------------------------------------------------------
  // Real-time subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    const tableConfig: Record<string, {
      setter: React.Dispatch<React.SetStateAction<any[] | null>>;
      headers: readonly string[];
      primaryKey: string;
    }> = {
      pipelines:        { setter: setProjects,       headers: PIPELINE_HEADERS,        primaryKey: 'Pipeline No' },
      companies:        { setter: setCompanies,      headers: COMPANY_HEADERS,         primaryKey: 'Company ID' },
      contacts:         { setter: setContacts,       headers: CONTACT_HEADERS,         primaryKey: 'Customer ID' },
      meeting_logs:     { setter: setMeetings,       headers: MEETING_HEADERS,         primaryKey: 'Meeting ID' },
      contact_logs:     { setter: setContactLogs,    headers: CONTACT_LOG_HEADERS,     primaryKey: 'Log ID' },
      site_survey_logs: { setter: setSiteSurveys,    headers: SITE_SURVEY_LOG_HEADERS, primaryKey: 'Site ID' },
      quotations:       { setter: setQuotations,     headers: QUOTATION_HEADERS,       primaryKey: 'Quote No' },
      sale_orders:      { setter: setSaleOrders,     headers: SALE_ORDER_HEADERS,      primaryKey: 'SO No' },
      pricelist:        { setter: setPricelist,      headers: PRICELIST_HEADERS,       primaryKey: 'Code' },
      invoices:         { setter: setInvoices,       headers: INVOICE_HEADERS,         primaryKey: 'Inv No' },
      vendors:          { setter: setVendors,        headers: VENDOR_HEADERS,          primaryKey: 'id' },
      vendor_pricelist: { setter: setVendorPricelist, headers: VENDOR_PRICELIST_HEADERS, primaryKey: 'id' },
      purchase_orders:  { setter: setPurchaseOrders, headers: PURCHASE_ORDER_HEADERS,  primaryKey: 'id' },
    };

    // Unique channel name avoids conflicts between browser tabs
    const channelName = `db_changes_${crypto.randomUUID()}`;
    const channel = supabase!.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        const config = tableConfig[table];
        if (!config) return;

        const { setter, headers, primaryKey } = config;

        if (eventType === 'INSERT') {
          const item = normalize([newRecord], headers)[0];
          setter(prev => {
            if (!prev) return [item];
            if (prev.some(r => r[primaryKey] === item[primaryKey])) return prev;
            return [item, ...prev];
          });
        } else if (eventType === 'UPDATE') {
          const item = normalize([newRecord], headers)[0];
          setter(prev => prev
            ? prev.map(r => r[primaryKey] === item[primaryKey] ? item : r)
            : [item]
          );
        } else if (eventType === 'DELETE') {
          const deletedId = oldRecord[primaryKey];
          if (deletedId) setter(prev => prev ? prev.filter(r => r[primaryKey] !== deletedId) : prev);
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [isAuthenticated, stateSetters]);

  // ---------------------------------------------------------------------------
  // Boot fetch — critical tables only
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const clearData = () => Object.values(stateSetters).forEach(setter => setter(null));

    if (!isAuthenticated) {
      setLoading(false);
      clearData();
      return;
    }

    const loadCriticalData = async () => {
      setLoading(true);
      setError(null);
      let loadedFromCache = false;

      // 1. Serve cache immediately so the UI isn't blank
      try {
        const criticalStoreNames = CRITICAL_SHEETS.map(s => sheetToStoreMap[s]) as db.StoreName[];
        const cachedData = await db.batchGetStoreData(criticalStoreNames);
        if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
          criticalStoreNames.forEach(storeName => {
            if (stateSetters[storeName]) stateSetters[storeName](cachedData[storeName]);
          });
          loadedFromCache = true;
          setLoading(false);
        }
      } catch (dbError) {
        console.error('[DataContext] Failed to load cache from IndexedDB:', dbError);
      }

      // 2. Fetch fresh data from network for critical tables
      try {
        const freshData = await batchReadRecords<Record<string, any[]>>([...CRITICAL_SHEETS]);
        applyNormalizedData([...CRITICAL_SHEETS], freshData);
      } catch (networkError: any) {
        console.error('[DataContext] Failed to fetch critical data:', networkError);
        if (!loadedFromCache) setError(networkError.message);
        else console.warn('[DataContext] Displaying stale cached data — network unavailable.');
      } finally {
        setLoading(false);
      }
    };

    loadCriticalData();
     
  }, [isAuthenticated, refetchCounter]);

  // ---------------------------------------------------------------------------
  // fetchModule — called by individual module pages for lazy data
  // ---------------------------------------------------------------------------
  const fetchModule = useCallback(async (...sheets: LazySheet[]) => {
    const toFetch = sheets.filter(s => !fetchedModules.has(s));
    if (toFetch.length === 0) return;

    toFetch.forEach(s => fetchedModules.add(s));

    // Serve from IndexedDB cache first
    try {
      const storeNames = toFetch.map(s => sheetToStoreMap[s]) as db.StoreName[];
      const cachedData = await db.batchGetStoreData(storeNames);
      if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
        storeNames.forEach(storeName => {
          if (stateSetters[storeName] && cachedData[storeName]?.length > 0) {
            stateSetters[storeName](cachedData[storeName]);
          }
        });
      }
    } catch (dbError) {
      console.error('[DataContext] Cache read failed for lazy modules:', dbError);
    }

    // Fetch fresh from network
    try {
      const freshData = await batchReadRecords<Record<string, any[]>>(toFetch);
      applyNormalizedData(toFetch, freshData);
    } catch (networkError: any) {
      console.error('[DataContext] Failed to fetch lazy module data:', networkError);
    }
  }, [stateSetters, applyNormalizedData]);

  // ---------------------------------------------------------------------------
  // Derived sets from pipeline data (memoised)
  // ---------------------------------------------------------------------------
  const { activeCompanyNames, activeContactNames, activePipelineIds } = useMemo(() => {
    const activeCompanyNames = new Set<string>();
    const activeContactNames = new Set<string>();
    const activePipelineIds = new Set<string>();

    projects?.forEach(project => {
      if (project['Company Name']) activeCompanyNames.add(project['Company Name']);
      if (project['Contact Name']) activeContactNames.add(project['Contact Name']);
      if (project['Pipeline No']) activePipelineIds.add(project['Pipeline No']);
    });

    return { activeCompanyNames, activeContactNames, activePipelineIds };
  }, [projects]);

  const value: DataContextProps = {
    projects, setProjects,
    companies, setCompanies,
    contacts, setContacts,
    contactLogs, setContactLogs,
    siteSurveys, setSiteSurveys,
    meetings, setMeetings,
    quotations, setQuotations,
    saleOrders, setSaleOrders,
    pricelist, setPricelist,
    invoices, setInvoices,
    vendors, setVendors,
    vendorPricelist, setVendorPricelist,
    purchaseOrders, setPurchaseOrders,
    loading,
    error,
    activeCompanyNames,
    activeContactNames,
    activePipelineIds,
    refetchData,
    fetchModule,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
