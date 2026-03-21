'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const SaleOrderDashboard = dynamic(() => import('@/components/dashboards/sales/SaleOrderDashboard'), {
    loading: () => <ContentSkeleton />,
});

function SaleOrdersContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Sale Orders'); }, [fetchModule]);

    let payload: any;
    if (payloadRaw) {
        try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
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
