'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const DeliveryOrderDashboard = dynamic(() => import('@/components/dashboards/sales/DeliveryOrderDashboard'));

function Content() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Delivery Orders'); }, [fetchModule]);
    return <DeliveryOrderDashboard />;
}

export default function Page() {
    return (
        <MiniAppShell title="Delivery Orders" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
