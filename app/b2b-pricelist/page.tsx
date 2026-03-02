'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const B2BPricelistDashboard = dynamic(() => import('@/components/dashboards/B2BPricelistDashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function B2BPricelistPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <B2BPricelistDashboard />
        </Suspense>
    );
}
