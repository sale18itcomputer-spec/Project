'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const VendorDashboard = dynamic(() => import('@/components/dashboards/inventory/VendorDashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function VendorsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <VendorDashboard />
        </Suspense>
    );
}
