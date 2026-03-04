'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const PurchaseOrderDashboard = dynamic(() => import('@/components/dashboards/sales/PurchaseOrderDashboard'), {
    loading: () => <ContentSkeleton />,
});

function PurchaseOrdersContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
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
