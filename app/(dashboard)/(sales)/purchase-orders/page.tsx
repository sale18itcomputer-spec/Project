'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const PurchaseOrderDashboard = dynamic(
    () => import('@/components/dashboards/sales/PurchaseOrderDashboard'),
    { loading: () => <ContentSkeleton /> }
);

function PurchaseOrdersContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    useEffect(() => {
        fetchModule('Vendors', 'Vendor Pricelist', 'Purchase Orders', 'Raw');
    }, [fetchModule]);

    let payload: any;
    if (payloadRaw) {
        try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
    }
    return <PurchaseOrderDashboard initialPayload={payload} />;
}

export default function PurchaseOrdersPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <PurchaseOrdersContent />
        </Suspense>
    );
}
