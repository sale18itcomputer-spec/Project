import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useB2B } from '../contexts/B2BContext';

/**
 * Hook that provides B2B-aware data.
 * Returns B2B data when in B2B mode, B2C data otherwise.
 *
 * In the miniapp, MiniAppDataProvider provides into the real DataContext,
 * so useData() resolves correctly without DataProvider being mounted.
 */
export const useB2BData = () => {
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

    const b2cData = useData();

    return useMemo(() => {
        if (isB2B) {
            return {
                ...b2cData,
                companies: b2bCompanies,
                projects: b2bProjects,
                quotations: b2bQuotations,
                loading: b2cData.loading || b2bLoading,
                error: b2cData.error || b2bError,
                setCompanies: setB2bCompanies,
                setProjects: setB2bProjects,
                setQuotations: setB2bQuotations,
                isB2B: true,
            };
        }
        return { ...b2cData, isB2B: false };
    }, [
        isB2B, b2cData,
        b2bCompanies, b2bProjects, b2bQuotations,
        b2bLoading, b2bError,
        setB2bCompanies, setB2bProjects, setB2bQuotations
    ]);
};
