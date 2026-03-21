'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { Company, PipelineProject, Quotation } from '../types';
import { COMPANY_HEADERS, PIPELINE_HEADERS, QUOTATION_HEADERS } from '../schemas';

type BusinessMode = 'B2C' | 'B2B';

interface B2BContextType {
    mode: BusinessMode;
    setMode: (mode: BusinessMode) => void;
    toggleMode: () => void;
    isB2B: boolean;
    canAccessB2B: boolean;
    b2bTheme: 'light' | 'dark';
    toggleB2BTheme: () => void;

    // Data
    companies: Company[] | null;
    projects: PipelineProject[] | null;
    quotations: Quotation[] | null;
    loading: boolean;
    error: string | null;

    // Setters
    setCompanies: React.Dispatch<React.SetStateAction<Company[] | null>>;
    setProjects: React.Dispatch<React.SetStateAction<PipelineProject[] | null>>;
    setQuotations: React.Dispatch<React.SetStateAction<Quotation[] | null>>;
    refreshB2BData: () => Promise<void>;
}

const B2BContext = createContext<B2BContextType | undefined>(undefined);

const STORAGE_KEY = 'limperial-business-mode';
const THEME_STORAGE_KEY = 'limperial-b2b-theme';

const normalize = <T,>(items: any[], headers: readonly string[]): T[] => {
    if (!Array.isArray(items)) {
        return [];
    }
    return items.map(item => {
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
};

export const B2BProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.Role === 'Admin';

    const [mode, setModeState] = useState<BusinessMode>(() => {
        if (!isAdmin) return 'B2C';
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return (saved === 'B2B' || saved === 'B2C') ? saved : 'B2C';
        } catch {
            return 'B2C';
        }
    });

    const [b2bTheme, setB2BThemeState] = useState<'light' | 'dark'>(() => {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            return (saved === 'light' || saved === 'dark') ? saved : 'dark';
        } catch {
            return 'dark';
        }
    });

    // B2B Data State
    const [companies, setCompanies] = useState<Company[] | null>(null);
    const [projects, setProjects] = useState<PipelineProject[] | null>(null);
    const [quotations, setQuotations] = useState<Quotation[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Force B2C for non-admins
    useEffect(() => {
        if (!isAdmin && mode === 'B2B') {
            setModeState('B2C');
            try { localStorage.setItem(STORAGE_KEY, 'B2C'); } catch { }
        }
    }, [isAdmin, mode]);

    const setMode = (newMode: BusinessMode) => {
        if (newMode === 'B2B' && !isAdmin) {
            console.warn('Only admin users can access B2B mode');
            return;
        }
        setModeState(newMode);
        try { localStorage.setItem(STORAGE_KEY, newMode); } catch { }
    };

    const toggleMode = () => {
        if (!isAdmin) return;
        setMode(mode === 'B2C' ? 'B2B' : 'B2C');
    };

    const toggleB2BTheme = () => {
        // B2B theme is now controlled by the unified ThemeProvider;
        // this is a no-op kept for API compatibility
    };

    const isB2B = mode === 'B2B';

    // B2B no longer applies its own dark class — ThemeProvider owns that
    useEffect(() => {
        document.documentElement.classList.remove('b2b-dark');
    }, [isB2B]);

    // Data Fetching Logic
    const loadB2BData = useCallback(async () => {
        if (!isB2B) {
            setCompanies(null);
            setProjects(null);
            setQuotations(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [companiesRes, pipelinesRes, quotationsRes] = await Promise.all([
                supabase.from('b2b_companies').select('*'),
                supabase.from('b2b_pipelines').select('*'),
                supabase.from('b2b_quotations').select('*')
            ]);

            if (companiesRes.error) throw companiesRes.error;
            if (pipelinesRes.error) throw pipelinesRes.error;
            if (quotationsRes.error) throw quotationsRes.error;

            setCompanies(normalize<Company>(companiesRes.data || [], COMPANY_HEADERS));
            setProjects(normalize<PipelineProject>(pipelinesRes.data || [], PIPELINE_HEADERS));
            setQuotations(normalize<Quotation>(quotationsRes.data || [], QUOTATION_HEADERS));

        } catch (err: any) {
            console.error('Failed to load B2B data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [isB2B]);

    // Initial Load
    useEffect(() => {
        loadB2BData();
    }, [loadB2BData]);

    // Real-time Subscription (Single Global Subscription)
    useEffect(() => {
        if (!isB2B) return;

        console.log('🔵 [B2BContext] Setting up global real-time subscription...');

        const channel = supabase.channel(`b2b_global_changes_${crypto.randomUUID()}`) // Namespaced per tab to avoid multi-tab conflicts
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_companies' },
                (payload) => {
                    console.log('🟢 [B2BContext] Company update:', payload.eventType);
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const item = normalize<Company>([newRecord], COMPANY_HEADERS)[0];
                        setCompanies(prev => {
                            if (!prev) return [item];
                            const exists = prev.some(i => i['Company ID'] === item['Company ID']);
                            return exists ? prev.map(i => i['Company ID'] === item['Company ID'] ? item : i) : [item, ...prev];
                        });
                    } else if (eventType === 'UPDATE') {
                        const item = normalize<Company>([newRecord], COMPANY_HEADERS)[0];
                        setCompanies(prev => prev ? prev.map(i => i['Company ID'] === item['Company ID'] ? item : i) : [item]);
                    } else if (eventType === 'DELETE') {
                        // Assuming REPLICA IDENTITY FULL is set, otherwise oldRecord only has PK
                        if (oldRecord && oldRecord['Company ID']) {
                            setCompanies(prev => prev ? prev.filter(i => i['Company ID'] !== oldRecord['Company ID']) : prev);
                        } else {
                            // Fallback: If REPLICA IDENTITY FULL is missing, we might only get 'id' if that's the internal PK. 
                            // But our PK is 'Company ID'. So oldRecord should have it.
                            console.warn('DELETE event received but "Company ID" missing in oldRecord', oldRecord);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_pipelines' },
                (payload) => {
                    console.log('🟢 [B2BContext] Pipeline update:', payload.eventType);
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const item = normalize<PipelineProject>([newRecord], PIPELINE_HEADERS)[0];
                        setProjects(prev => {
                            if (!prev) return [item];
                            const exists = prev.some(i => i['Pipeline No'] === item['Pipeline No']);
                            return exists ? prev.map(i => i['Pipeline No'] === item['Pipeline No'] ? item : i) : [item, ...prev];
                        });
                    } else if (eventType === 'UPDATE') {
                        const item = normalize<PipelineProject>([newRecord], PIPELINE_HEADERS)[0];
                        setProjects(prev => prev ? prev.map(i => i['Pipeline No'] === item['Pipeline No'] ? item : i) : [item]);
                    } else if (eventType === 'DELETE') {
                        if (oldRecord && oldRecord['Pipeline No']) {
                            setProjects(prev => prev ? prev.filter(i => i['Pipeline No'] !== oldRecord['Pipeline No']) : prev);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_quotations' },
                (payload) => {
                    console.log('🟢 [B2BContext] Quotation update:', payload.eventType);
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const item = normalize<Quotation>([newRecord], QUOTATION_HEADERS)[0];
                        setQuotations(prev => {
                            if (!prev) return [item];
                            const exists = prev.some(i => i['Quote No'] === item['Quote No']);
                            return exists ? prev.map(i => i['Quote No'] === item['Quote No'] ? item : i) : [item, ...prev];
                        });
                    } else if (eventType === 'UPDATE') {
                        const item = normalize<Quotation>([newRecord], QUOTATION_HEADERS)[0];
                        setQuotations(prev => prev ? prev.map(i => i['Quote No'] === item['Quote No'] ? item : i) : [item]);
                    } else if (eventType === 'DELETE') {
                        if (oldRecord && oldRecord['Quote No']) {
                            setQuotations(prev => prev ? prev.filter(i => i['Quote No'] !== oldRecord['Quote No']) : prev);
                        }
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ [B2BContext] Real-time active!');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ [B2BContext] Subscription error:', err);
                }
            });

        return () => {
            console.log('🔴 [B2BContext] Cleaning up subscription...');
            supabase.removeChannel(channel);
        };
    }, [isB2B]);

    return (
        <B2BContext.Provider value={{
            mode, setMode, toggleMode, isB2B, canAccessB2B: isAdmin,
            b2bTheme, toggleB2BTheme,
            companies, setCompanies,
            projects, setProjects,
            quotations, setQuotations,
            loading, error,
            refreshB2BData: loadB2BData
        }}>
            {children}
        </B2BContext.Provider>
    );
};

export const useB2B = () => {
    const context = useContext(B2BContext);
    if (context === undefined) {
        throw new Error('useB2B must be used within a B2BProvider');
    }
    return context;
};

