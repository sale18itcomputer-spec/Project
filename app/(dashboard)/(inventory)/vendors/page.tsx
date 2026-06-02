'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const VendorDashboard = dynamic(
    () => import('@/components/dashboards/inventory/VendorDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function VendorsPage() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Vendors'); }, [fetchModule]);
    return <VendorDashboard />;
}
