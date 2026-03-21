'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const VendorDashboard = dynamic(() => import('@/components/dashboards/inventory/VendorDashboard'), {
    loading: () => <ContentSkeleton />,
});

function VendorsContent() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Vendors'); }, [fetchModule]);
    return <VendorDashboard />;
}

export default function VendorsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <VendorsContent />
        </Suspense>
    );
}
