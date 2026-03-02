'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const InvoiceDODashboard = dynamic(() => import('@/components/dashboards/InvoiceDODashboard'), {
    loading: () => <ContentSkeleton />,
});

function InvoiceDOContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    let payload: any;
    if (payloadRaw) {
        try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
    }
    return <InvoiceDODashboard initialPayload={payload} />;
}

export default function InvoiceDOPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <InvoiceDOContent />
        </Suspense>
    );
}
