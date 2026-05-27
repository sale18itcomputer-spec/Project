import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useB2B } from '../contexts/B2BContext';

/**
 * Returns the active data set + the current mode flag.
 *
 * Historically this hook overlaid B2B data (owned by B2BContext) on top of B2C
 * data (owned by DataContext). Now DataContext is itself mode-aware — it
 * resolves every table read/write to the correct B2C or B2B physical table
 * based on the current B2B mode. So this hook is just a thin convenience that
 * exposes `isB2B` alongside the data; the underlying state is identical to
 * useData() at all times.
 *
 * Kept as a stable re-export so the dashboards that already import it
 * (CompanyDashboard, PipelineDashboard, QuotationDashboard, NewCompanyModal,
 * etc.) don't need to change.
 */
export const useB2BData = () => {
    const data = useData();
    const { isB2B } = useB2B();
    return useMemo(() => ({ ...data, isB2B }), [data, isB2B]);
};
