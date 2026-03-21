'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const QuotationDashboard = dynamic(() => import('@/components/dashboards/sales/QuotationDashboard'), {
    loading: () => <ContentSkeleton />,
});

function QuotationsContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Quotations'); }, [fetchModule]);

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
