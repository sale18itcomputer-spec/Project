'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const QuotationDashboard = dynamic(() => import('@/components/dashboards/QuotationDashboard'), {
    loading: () => <ContentSkeleton />,
});

function QuotationsContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    let payload: any;
    if (payloadRaw) {
        try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
    }
    return <QuotationDashboard initialPayload={payload} />;
}

export default function QuotationsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <QuotationsContent />
        </Suspense>
    );
}
