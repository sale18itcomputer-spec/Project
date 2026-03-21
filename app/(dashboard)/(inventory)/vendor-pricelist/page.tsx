'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const VendorPricelistDashboard = dynamic(() => import('@/components/dashboards/inventory/VendorPricelistDashboard'), {
    loading: () => <ContentSkeleton />,
});

function VendorPricelistContent() {
    const { fetchModule } = useData();
    // Vendor pricelist needs vendor names for display
    useEffect(() => { fetchModule('Vendors', 'Vendor Pricelist'); }, [fetchModule]);
    return <VendorPricelistDashboard />;
}

export default function VendorPricelistPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <VendorPricelistContent />
        </Suspense>
    );
}
