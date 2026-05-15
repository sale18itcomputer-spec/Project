'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const SaleOrderDashboard = dynamic(() => import('@/components/dashboards/sales/SaleOrderDashboard'));
const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

function Content() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Sale Orders'); }, [fetchModule]);
    let payload: any;
    if (searchParams.get('has_payload') === '1') {
        try { const r = sessionStorage.getItem(NAV_PAYLOAD_KEY); if (r) payload = JSON.parse(r); } catch {}
    }
    return <SaleOrderDashboard initialPayload={payload} />;
}

export default function Page() {
    return (
        <MiniAppShell title="Sale Orders" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
