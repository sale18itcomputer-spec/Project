'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const PricelistDashboard = dynamic(() => import('@/components/dashboards/inventory/PricelistDashboard'), {
    loading: () => <ContentSkeleton />,
});

function PricelistContent() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Raw'); }, [fetchModule]);
    return <PricelistDashboard />;
}

export default function PricelistPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <PricelistContent />
        </Suspense>
    );
}
