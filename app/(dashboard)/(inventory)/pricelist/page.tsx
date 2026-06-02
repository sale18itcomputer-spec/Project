'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const PricelistDashboard = dynamic(
    () => import('@/components/dashboards/inventory/PricelistDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function PricelistPage() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Raw'); }, [fetchModule]);
    return <PricelistDashboard />;
}
