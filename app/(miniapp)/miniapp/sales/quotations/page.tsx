'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const QuotationDashboard = dynamic(() => import('@/components/dashboards/sales/QuotationDashboard'));

function Content() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Quotations'); }, [fetchModule]);
    let payload: any;
    try { const r = searchParams.get('payload'); if (r) payload = JSON.parse(r); } catch {}
    return <QuotationDashboard initialPayload={payload} />;
}

export default function Page() {
    return (
        <MiniAppShell title="Quotations" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
