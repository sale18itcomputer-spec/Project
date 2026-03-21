'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const PurchaseOrderDashboard = dynamic(() => import('@/components/dashboards/sales/PurchaseOrderDashboard'), {
    loading: () => <ContentSkeleton />,
});

function PurchaseOrdersContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    // Purchase orders need vendor data for name resolution
    useEffect(() => { fetchModule('Vendors', 'Vendor Pricelist', 'Purchase Orders'); }, [fetchModule]);

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
