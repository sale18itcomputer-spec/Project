'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const InvoiceDashboard = dynamic(() => import('@/components/dashboards/sales/InvoiceDashboard'));

function Content() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Invoices'); }, [fetchModule]);
    let payload: any;
    try { const r = searchParams.get('payload'); if (r) payload = JSON.parse(r); } catch {}
    return <InvoiceDashboard initialPayload={payload} />;
}

export default function Page() {
    return (
        <MiniAppShell title="Invoices" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
