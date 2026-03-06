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
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

const normalize = <T,>(items: any[], headers: readonly string[]): T[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  const normalizedItems = items.map(item => {
    const trimmedKeyItem: { [key: string]: any } = {};
    for (const key in item) {
      trimmedKeyItem[key.trim()] = (item as any)[key];
    }
    const normalizedItem = {} as T;
    headers.forEach(header => {
      (normalizedItem as any)[header] = trimmedKeyItem[header] ?? '';
    });
    return normalizedItem;
  });
  return normalizedItems;
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

  const refetchData = useCallback(() => setRefetchCounter(c => c + 1), []);

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [vendorPricelist, setVendorPricelist] = useState<VendorPricelistItem[] | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null);

  // dispatch setters are stable references — no useMemo needed for their functions, but the object itself needs to be stable
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
    purchaseOrders: setPurchaseOrders
  }), []);

  // Real-time subscription setup
  useEffect(() => {
    if (!isAuthenticated) return;

    // Configuration map for Supabase tables to React state
    const tableConfig: {
      [key: string]: {
        setter: React.Dispatch<React.SetStateAction<any[] | null>>,
        headers: readonly string[],
        primaryKey: string
      }
    } = {
      'pipelines': { setter: setProjects, headers: PIPELINE_HEADERS, primaryKey: 'Pipeline No.' },
      'companies': { setter: setCompanies, headers: COMPANY_HEADERS, primaryKey: 'Company ID' },
      'contacts': { setter: setContacts, headers: CONTACT_HEADERS, primaryKey: 'Customer ID' },
      'meeting_logs': { setter: setMeetings, headers: MEETING_HEADERS, primaryKey: 'Meeting ID' },
      'contact_logs': { setter: setContactLogs, headers: CONTACT_LOG_HEADERS, primaryKey: 'Log ID' },
      'site_survey_logs': { setter: setSiteSurveys, headers: SITE_SURVEY_LOG_HEADERS, primaryKey: 'Site ID' },
      'quotations': { setter: setQuotations, headers: QUOTATION_HEADERS, primaryKey: 'Quote No.' },
      'sale_orders': { setter: setSaleOrders, headers: SALE_ORDER_HEADERS, primaryKey: 'SO No.' },
      'pricelist': { setter: setPricelist, headers: PRICELIST_HEADERS, primaryKey: 'Code' },
      'invoices': { setter: setInvoices, headers: INVOICE_HEADERS, primaryKey: 'Inv No.' },
      'vendors': { setter: setVendors, headers: VENDOR_HEADERS, primaryKey: 'id' },
      'vendor_pricelist': { setter: setVendorPricelist, headers: VENDOR_PRICELIST_HEADERS, primaryKey: 'id' },
      'purchase_orders': { setter: setPurchaseOrders, headers: PURCHASE_ORDER_HEADERS, primaryKey: 'id' },
    };

    const channel = supabase.channel('db_changes_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const { table, eventType, new: newRecord, old: oldRecord } = payload;
          const config = tableConfig[table];

          if (!config) return;

          const { setter, headers, primaryKey } = config;

          if (eventType === 'INSERT') {
            const normalizedItem = normalize([newRecord], headers)[0];
            setter(prev => {
              if (!prev) return [normalizedItem];
              if (prev.some(item => item[primaryKey] === normalizedItem[primaryKey])) return prev;
              return [normalizedItem, ...prev];
            });
          } else if (eventType === 'UPDATE') {
            const normalizedItem = normalize([newRecord], headers)[0];
            setter(prev => {
              if (!prev) return [normalizedItem];
              return prev.map(item => item[primaryKey] === normalizedItem[primaryKey] ? normalizedItem : item);
            });
          } else if (eventType === 'DELETE') {
            const deletedId = oldRecord[primaryKey];
            if (deletedId) {
              setter(prev => prev ? prev.filter(item => item[primaryKey] !== deletedId) : prev);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [isAuthenticated, stateSetters]);


  useEffect(() => {
    const clearData = () => {
      Object.values(stateSetters).forEach(setter => setter(null));
    };

    if (!isAuthenticated) {
      setLoading(false);
      clearData();
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      let isDataLoadedFromCache = false;

      try {
        const cachedData = await db.batchGetStoreData(db.STORE_NAMES);
        if (Object.values(cachedData).some(arr => arr && arr.length > 0)) {
          (Object.keys(cachedData) as db.StoreName[]).forEach(storeName => {
            const setter = stateSetters[storeName];
            if (setter) setter(cachedData[storeName]);
          });
          isDataLoadedFromCache = true;
          setLoading(false);
        }
      } catch (dbError) {
        console.error("Failed to load data from IndexedDB:", dbError);
      }

      try {
        // All stores go through the same unified batch-fetch pipeline.
        // storeToSheetMap maps every store to its logical sheet name;
        // sheetToHeadersMap drives normalization for all of them.
        const sheetNames = db.STORE_NAMES
          .map(s => storeToSheetMap[s])
          .filter(name => !!sheetToHeadersMap[name]);

        const freshData = await batchReadRecords<Record<string, any[]>>(sheetNames);
        const normalizedData: Partial<Record<db.StoreName, any[]>> = {};

        for (const sheetName of sheetNames) {
          const storeName = sheetToStoreMap[sheetName] as db.StoreName;
          const data = freshData[sheetName];
          const headers = sheetToHeadersMap[sheetName];
          if (data && headers && storeName && stateSetters[storeName]) {
            const normalized = normalize(data, headers);

            // After normalizing vendor_pricelist, join vendor_name from vendors
            if (storeName === 'vendorPricelist') {
              const currentVendors = (normalizedData['vendors'] as Vendor[] | undefined) || [];
              const withNames = (normalized as VendorPricelistItem[]).map(item => {
                const vendor = currentVendors.find(
                  v => String(v.id || '').toLowerCase() === String(item.vendor_id || '').toLowerCase()
                );
                return { ...item, vendor_name: vendor?.vendor_name ?? 'Unknown Vendor' };
              });
              stateSetters[storeName](withNames);
              normalizedData[storeName] = withNames;
            } else if (storeName === 'purchaseOrders') {
              // Join vendor_name for purchase orders
              const currentVendors = (normalizedData['vendors'] as Vendor[] | undefined) || [];
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
        }

        db.batchSetStoreData(normalizedData);
      } catch (networkError: any) {
        console.error("Failed to fetch data from network:", networkError);
        if (!isDataLoadedFromCache) {
          setError(networkError.message);
        } else {
          console.warn("Could not fetch fresh data. Displaying stale data from cache.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // stateSetters is a plain object literal of stable dispatch refs — excluding to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, refetchCounter]);


  const { activeCompanyNames, activeContactNames, activePipelineIds } = useMemo(() => {
    const activeCompanyNames = new Set<string>();
    const activeContactNames = new Set<string>();
    const activePipelineIds = new Set<string>();

    if (projects) {
      projects.forEach(project => {
        if (project['Company Name']) activeCompanyNames.add(project['Company Name']);
        if (project['Contact Name']) activeContactNames.add(project['Contact Name']);
        if (project['Pipeline No.']) activePipelineIds.add(project['Pipeline No.']);
      });
    }

    return { activeCompanyNames, activeContactNames, activePipelineIds };
  }, [projects]);


  const value = {
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
    error: error || null,
    activeCompanyNames,
    activeContactNames,
    activePipelineIds,
    refetchData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
