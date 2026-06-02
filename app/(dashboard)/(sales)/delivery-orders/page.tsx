'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const DeliveryOrderDashboard = dynamic(
    () => import('@/components/dashboards/sales/DeliveryOrderDashboard'),
    { loading: () => <ContentSkeleton /> }
);

const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

function DeliveryOrdersContent() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Delivery Orders', 'Invoices'); }, [fetchModule]);

    let payload: any;
    if (searchParams.get('has_payload') === '1') {
        try {
            const raw = sessionStorage.getItem(NAV_PAYLOAD_KEY);
            if (raw) payload = JSON.parse(raw);
        } catch { /* ignore */ }
    } else {
        const payloadRaw = searchParams.get('payload');
        if (payloadRaw) {
            try { payload = JSON.parse(payloadRaw); } catch { /* ignore */ }
        }
    }

    return <DeliveryOrderDashboard initialPayload={payload} />;
}

export default function DeliveryOrdersPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <DeliveryOrdersContent />
        </Suspense>
    );
}
