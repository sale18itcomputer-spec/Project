'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const InvoiceDashboard = dynamic(
    () => import('@/components/dashboards/sales/InvoiceDashboard'),
    { loading: () => <ContentSkeleton /> }
);

function InvoiceContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Invoices'); }, [fetchModule]);

    let payload: any;
    if (payloadRaw) {
        try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
    }
    return <InvoiceDashboard initialPayload={payload} />;
}

export default function InvoicePage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <InvoiceContent />
        </Suspense>
    );
}
