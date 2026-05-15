'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const PurchaseOrderDashboard = dynamic(() => import('@/components/dashboards/sales/PurchaseOrderDashboard'));

function Content() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Purchase Orders'); }, [fetchModule]);
    return <PurchaseOrderDashboard />;
}

export default function Page() {
    return (
        <MiniAppShell title="Purchase Orders" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
