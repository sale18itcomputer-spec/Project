'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import ReceiptDashboard from '@/components/dashboards/sales/ReceiptDashboard';

const NAV_PAYLOAD_KEY = 'limperial_nav_payload';

function ReceiptsContent() {
    const searchParams = useSearchParams();
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Receipts', 'Invoices', 'Delivery Orders'); }, [fetchModule]);

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

    return <ReceiptDashboard initialPayload={payload} />;
}

export default function ReceiptsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ReceiptsContent />
        </Suspense>
    );
}
