'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { batchReadRecords } from '../services/api';
import { supabase } from '../lib/supabase';
import {
    Quotation, SaleOrder, PricelistItem, Invoice, DeliveryOrder, Receipt,
    Company, Contact, PurchaseOrder, Vendor, VendorPricelistItem,
    PipelineProject, ContactLog, SiteSurveyLog, Meeting
} from '../types';
import {
    QUOTATION_HEADERS, SALE_ORDER_HEADERS, PRICELIST_HEADERS, INVOICE_HEADERS,
    DELIVERY_ORDER_HEADERS, RECEIPT_HEADERS, COMPANY_HEADERS, CONTACT_HEADERS,
    PURCHASE_ORDER_HEADERS, VENDOR_HEADERS, VENDOR_PRICELIST_HEADERS,
    PIPELINE_HEADERS, CONTACT_LOG_HEADERS, SITE_SURVEY_LOG_HEADERS, MEETING_HEADERS
} from '../schemas';
import * as db from '../utils/db';

// Re-export same shape as DataContext so existing dashboard components work unchanged
interface MiniAppDataContextProps {
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
    fetchModule: (...sheets: string[]) => Promise<void>;
    refetchModule: (...sheets: string[]) => void;
}

// Use the same DataContext key so useData() works unchanged in dashboard components
const DataContext = createContext<MiniAppDataContextProps | undefined>(undefined);

const normalize = <T,>(items: any[], headers: readonly string[]): T[] => {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        const trimmed: Record<string, any> = {};
        for (const key in item) trimmed[key.trim()] = item[key];
        const out = {} as T;
        headers.forEach(h => { (out as any)[h] = trimmed[h] ?? ''; });
        return out;
    });
};

const sheetToStoreMap: Record<string, db.StoreName> = {
    'Pipelines': 'projects',
    'Company List': 'companies',
    'Contact_List': 'contacts',
    'Contact_Logs': 'contactLogs',
    'Site_Survey_Logs': 'siteSurveys',
    'Meeting_Logs': 'meetings',
    'Quotations': 'quotations',
    'Sale Orders': 'saleOrders',
    'Raw': 'pricelist',
    'Invoices': 'invoices',
    'Delivery Orders': 'deliveryOrders',
    'Receipts': 'receipts',
    'Vendors': 'vendors',
    'Vendor Pricelist': 'vendorPricelist',
    'Purchase Orders': 'purchaseOrders',
};

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
    'Delivery Orders': DELIVERY_ORDER_HEADERS,
    'Receipts': RECEIPT_HEADERS,
    'Vendors': VENDOR_HEADERS,
    'Vendor Pricelist': VENDOR_PRICELIST_HEADERS,
    'Purchase Orders': PURCHASE_ORDER_HEADERS,
};

export default function MiniAppDataProvider({ children }: { children: React.ReactNode }) {
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
    const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[] | null>(null);
    const [receipts, setReceipts] = useState<Receipt[] | null>(null);
    const [vendors, setVendors] = useState<Vendor[] | null>(null);
    const [vendorPricelist, setVendorPricelist] = useState<VendorPricelistItem[] | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetchedRef = useRef(new Set<string>());

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
        deliveryOrders: setDeliveryOrders,
        receipts: setReceipts,
        vendors: setVendors,
        vendorPricelist: setVendorPricelist,
        purchaseOrders: setPurchaseOrders,
    }), []);

    const applyData = useCallback((sheetNames: string[], freshData: Record<string, any[]>) => {
        for (const sheet of sheetNames) {
            const store = sheetToStoreMap[sheet] as db.StoreName;
            const headers = sheetToHeadersMap[sheet];
            const data = freshData[sheet];
            if (!data || !headers || !store || !stateSetters[store]) continue;
            stateSetters[store](normalize(data, headers));
        }
    }, [stateSetters]);

    const fetchModule = useCallback(async (...sheets: string[]) => {
        const toFetch = sheets.filter(s => !fetchedRef.current.has(s));
        if (toFetch.length === 0) return;
        toFetch.forEach(s => fetchedRef.current.add(s));
        setLoading(true);
        try {
            // Try cache first
            const storeNames = toFetch.map(s => sheetToStoreMap[s]).filter(Boolean) as db.StoreName[];
            const cached = await db.batchGetStoreData(storeNames).catch(() => ({} as any));
            storeNames.forEach(store => {
                if (cached[store]?.length > 0) stateSetters[store](cached[store]);
            });
            // Then fetch fresh
            const fresh = await batchReadRecords<Record<string, any[]>>(toFetch);
            applyData(toFetch, fresh);
        } catch (err: any) {
            console.error('[MiniAppData] fetchModule error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [stateSetters, applyData]);

    const refetchModule = useCallback((...sheets: string[]) => {
        sheets.forEach(s => fetchedRef.current.delete(s));
    }, []);

    const refetchData = useCallback(() => {
        fetchedRef.current.clear();
    }, []);

    const { activeCompanyNames, activeContactNames, activePipelineIds } = useMemo(() => {
        const activeCompanyNames = new Set<string>();
        const activeContactNames = new Set<string>();
        const activePipelineIds = new Set<string>();
        projects?.forEach(p => {
            if (p['Company Name']) activeCompanyNames.add(p['Company Name']);
            if (p['Contact Name']) activeContactNames.add(p['Contact Name']);
            if (p['Pipeline No']) activePipelineIds.add(p['Pipeline No']);
        });
        return { activeCompanyNames, activeContactNames, activePipelineIds };
    }, [projects]);

    const value: MiniAppDataContextProps = {
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
        deliveryOrders, setDeliveryOrders,
        receipts, setReceipts,
        vendors, setVendors,
        vendorPricelist, setVendorPricelist,
        purchaseOrders, setPurchaseOrders,
        loading, error,
        activeCompanyNames, activeContactNames, activePipelineIds,
        refetchData, fetchModule, refetchModule,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within MiniAppDataProvider');
    return ctx;
};
