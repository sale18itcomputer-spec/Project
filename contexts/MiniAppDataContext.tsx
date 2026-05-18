'use client';

import React, { useContext, useState, useCallback, useRef, useMemo } from 'react';
import { batchReadRecords } from '../services/api';
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
// Use the REAL DataContext object from DataContext.tsx so that useData() from
// DataContext.tsx resolves correctly inside the miniapp — no duplicate context.
import { DataContext } from './DataContext';

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
            const storeNames = toFetch.map(s => sheetToStoreMap[s]).filter(Boolean) as db.StoreName[];
            const cached = await db.batchGetStoreData(storeNames).catch(() => ({} as any));
            storeNames.forEach(store => {
                if (cached[store]?.length > 0) stateSetters[store](cached[store]);
            });
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
        deliveryOrders, setDeliveryOrders,
        receipts, setReceipts,
        vendors, setVendors,
        vendorPricelist, setVendorPricelist,
        purchaseOrders, setPurchaseOrders,
        loading, error,
        activeCompanyNames, activeContactNames, activePipelineIds,
        refetchData, fetchModule, refetchModule,
    };

    // Provide into the REAL DataContext so useData() from DataContext.tsx
    // resolves correctly in shared dashboard components (QuotationDashboard etc.)
    return <DataContext.Provider value={value as any}>{children}</DataContext.Provider>;
}

// useData for miniapp-specific components that import from MiniAppDataContext directly
export const useData = () => {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useData must be used within MiniAppDataProvider');
    return ctx;
};
