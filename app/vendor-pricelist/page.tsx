'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const VendorPricelistDashboard = dynamic(() => import('@/components/dashboards/VendorPricelistDashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function VendorPricelistPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <VendorPricelistDashboard />
        </Suspense>
    );
}
