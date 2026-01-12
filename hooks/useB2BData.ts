import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useB2B } from '../contexts/B2BContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { Company, PipelineProject, Quotation } from '../types';
import { COMPANY_HEADERS, PIPELINE_HEADERS, QUOTATION_HEADERS } from '../schemas';

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

/**
 * Hook that provides B2B-aware data
 * Returns B2B data when in B2B mode, B2C data otherwise
 */
export const useB2BData = () => {
    const { isB2B } = useB2B();
    const b2cData = useData();

    // B2B-specific state
    const [b2bCompanies, setB2bCompanies] = useState<Company[] | null>(null);
    const [b2bProjects, setB2bProjects] = useState<PipelineProject[] | null>(null);
    const [b2bQuotations, setB2bQuotations] = useState<Quotation[] | null>(null);
    const [b2bLoading, setB2bLoading] = useState(false);
    const [b2bError, setB2bError] = useState<string | null>(null);

    // Load B2B data when in B2B mode
    useEffect(() => {
        if (!isB2B) {
            // Clear B2B data when switching to B2C
            setB2bCompanies(null);
            setB2bProjects(null);
            setB2bQuotations(null);
            return;
        }

        const loadB2BData = async () => {
            setB2bLoading(true);
            setB2bError(null);

            try {
                // Fetch B2B companies
                const { data: companiesData, error: companiesError } = await supabase
                    .from('b2b_companies')
                    .select('*');

                if (companiesError) throw companiesError;
                setB2bCompanies(normalize<Company>(companiesData || [], COMPANY_HEADERS));

                // Fetch B2B pipelines
                const { data: pipelinesData, error: pipelinesError } = await supabase
                    .from('b2b_pipelines')
                    .select('*');

                if (pipelinesError) throw pipelinesError;
                setB2bProjects(normalize<PipelineProject>(pipelinesData || [], PIPELINE_HEADERS));

                // Fetch B2B quotations
                const { data: quotationsData, error: quotationsError } = await supabase
                    .from('b2b_quotations')
                    .select('*');

                if (quotationsError) throw quotationsError;
                setB2bQuotations(normalize<Quotation>(quotationsData || [], QUOTATION_HEADERS));

            } catch (error: any) {
                console.error('Failed to load B2B data:', error);
                setB2bError(error.message);
            } finally {
                setB2bLoading(false);
            }
        };

        loadB2BData();
    }, [isB2B]);

    // Set up real-time subscriptions for B2B tables
    useEffect(() => {
        if (!isB2B) return;

        const channel = supabase.channel('b2b_changes_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_companies' },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const normalizedItem = normalize<Company>([newRecord], COMPANY_HEADERS)[0];
                        setB2bCompanies(prev => prev ? [normalizedItem, ...prev] : [normalizedItem]);
                    } else if (eventType === 'UPDATE') {
                        const normalizedItem = normalize<Company>([newRecord], COMPANY_HEADERS)[0];
                        setB2bCompanies(prev =>
                            prev ? prev.map(item => item['Company ID'] === normalizedItem['Company ID'] ? normalizedItem : item) : [normalizedItem]
                        );
                    } else if (eventType === 'DELETE') {
                        setB2bCompanies(prev => prev ? prev.filter(item => item['Company ID'] !== oldRecord['Company ID']) : prev);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_pipelines' },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const normalizedItem = normalize<PipelineProject>([newRecord], PIPELINE_HEADERS)[0];
                        setB2bProjects(prev => prev ? [normalizedItem, ...prev] : [normalizedItem]);
                    } else if (eventType === 'UPDATE') {
                        const normalizedItem = normalize<PipelineProject>([newRecord], PIPELINE_HEADERS)[0];
                        setB2bProjects(prev =>
                            prev ? prev.map(item => item['Pipeline No.'] === normalizedItem['Pipeline No.'] ? normalizedItem : item) : [normalizedItem]
                        );
                    } else if (eventType === 'DELETE') {
                        setB2bProjects(prev => prev ? prev.filter(item => item['Pipeline No.'] !== oldRecord['Pipeline No.']) : prev);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'b2b_quotations' },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    if (eventType === 'INSERT') {
                        const normalizedItem = normalize<Quotation>([newRecord], QUOTATION_HEADERS)[0];
                        setB2bQuotations(prev => prev ? [normalizedItem, ...prev] : [normalizedItem]);
                    } else if (eventType === 'UPDATE') {
                        const normalizedItem = normalize<Quotation>([newRecord], QUOTATION_HEADERS)[0];
                        setB2bQuotations(prev =>
                            prev ? prev.map(item => item['Quote No.'] === normalizedItem['Quote No.'] ? normalizedItem : item) : [normalizedItem]
                        );
                    } else if (eventType === 'DELETE') {
                        setB2bQuotations(prev => prev ? prev.filter(item => item['Quote No.'] !== oldRecord['Quote No.']) : prev);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isB2B]);

    // Return B2B or B2C data based on mode
    return useMemo(() => {
        if (isB2B) {
            return {
                ...b2cData,
                companies: b2bCompanies,
                projects: b2bProjects,
                quotations: b2bQuotations,
                loading: b2cData.loading || b2bLoading,
                error: b2cData.error || b2bError,
                // For B2B, we don't have separate setters exposed yet
                // You can add them if needed for direct manipulation
            };
        }
        return b2cData;
    }, [isB2B, b2cData, b2bCompanies, b2bProjects, b2bQuotations, b2bLoading, b2bError]);
};
