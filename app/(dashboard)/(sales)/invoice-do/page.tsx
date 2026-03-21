'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const InvoiceDODashboard = dynamic(() => import('@/components/dashboards/sales/InvoiceDODashboard'), {
    loading: () => <ContentSkeleton />,
});

function InvoiceDOContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Invoices'); }, [fetchModule]);

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
