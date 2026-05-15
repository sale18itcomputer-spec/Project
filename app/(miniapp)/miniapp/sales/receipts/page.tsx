'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const ReceiptDashboard = dynamic(() => import('@/components/dashboards/sales/ReceiptDashboard'));

function Content() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Receipts'); }, [fetchModule]);
    return <ReceiptDashboard />;
}

export default function Page() {
    return (
        <MiniAppShell title="Receipts" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
