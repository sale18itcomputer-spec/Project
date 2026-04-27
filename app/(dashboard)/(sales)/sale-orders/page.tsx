'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const SaleOrderDashboard = dynamic(() => import('@/components/dashboards/sales/SaleOrderDashboard'), {
    loading: () => <ContentSkeleton />,
});

// Must match the key used in NavigationContext.tsx
const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

function SaleOrdersContent() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Sale Orders'); }, [fetchModule]);

    // NavigationContext stores large payloads in sessionStorage (not the URL)
    // and signals their presence with has_payload=1 in the URL.
    let payload: any;
    if (searchParams.get('has_payload') === '1') {
        try {
            const raw = sessionStorage.getItem(NAV_PAYLOAD_KEY);
            if (raw) payload = JSON.parse(raw);
        } catch { /* ignore */ }
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
