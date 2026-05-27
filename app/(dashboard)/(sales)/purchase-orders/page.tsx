'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import PurchaseOrderDashboard from '@/components/dashboards/sales/PurchaseOrderDashboard';

function PurchaseOrdersContent() {
    const searchParams = useSearchParams();
    const payloadRaw = searchParams.get('payload');
    const { fetchModule } = useData();

    // Purchase orders need vendor data, vendor_pricelist for the item combobox,
    // and the main pricelist so the Convert-to-Inventory enrichment cascade works.
    useEffect(() => {
        fetchModule('Vendors', 'Vendor Pricelist', 'Purchase Orders', 'Raw');
    }, [fetchModule]);

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
