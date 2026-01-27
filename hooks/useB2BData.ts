import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useB2B } from '../contexts/B2BContext';

/**
 * Hook that provides B2B-aware data
 * Returns B2B data when in B2B mode, B2C data otherwise
 * 
 * REFACTORED: Now delegates state and subscriptions to B2BContext
 * to prevent duplicate Realtime channel connections.
 */
export const useB2BData = () => {
    // Get everything from B2B Context
    const {
        isB2B,
        companies: b2bCompanies,
        projects: b2bProjects,
        quotations: b2bQuotations,
        loading: b2bLoading,
        error: b2bError,
        setCompanies: setB2bCompanies,
        setProjects: setB2bProjects,
        setQuotations: setB2bQuotations
    } = useB2B();

    // Get B2C data
    const b2cData = useData();

    // Return B2B or B2C data based on mode
    return useMemo(() => {
        if (isB2B) {
            return {
                ...b2cData,
                // Override with B2B data
                companies: b2bCompanies,
                projects: b2bProjects,
                quotations: b2bQuotations,

                loading: b2cData.loading || b2bLoading,
                error: b2cData.error || b2bError,

                // B2B-specific setters
                setCompanies: setB2bCompanies,
                setProjects: setB2bProjects,
                setQuotations: setB2bQuotations,
                isB2B: true,
            };
        }
        return { ...b2cData, isB2B: false };
    }, [
        isB2B,
        b2cData,
        b2bCompanies,
        b2bProjects,
        b2bQuotations,
        b2bLoading,
        b2bError,
        setB2bCompanies,
        setB2bProjects,
        setB2bQuotations
    ]);
};
