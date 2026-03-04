'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const PricelistDashboard = dynamic(() => import('@/components/dashboards/inventory/PricelistDashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function PricelistPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <PricelistDashboard />
        </Suspense>
    );
}
