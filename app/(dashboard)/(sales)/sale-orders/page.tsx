'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const SaleOrderDashboard = dynamic(
    () => import('@/components/dashboards/sales/SaleOrderDashboard'),
    { loading: () => <ContentSkeleton /> }
);

const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

function SaleOrdersContent() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Sale Orders', 'Inventory', 'Raw'); }, [fetchModule]);

    let payload: any;
    if (searchParams.get('has_payload') === '1') {
        try {
            const raw = sessionStorage.getItem(NAV_PAYLOAD_KEY);
            if (raw) payload = JSON.parse(raw);
        } catch { /* ignore */ }
    }

    return <SaleOrderDashboard initialPayload={payload} />;
}

export default function SaleOrdersPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <SaleOrdersContent />
        </Suspense>
    );
}
