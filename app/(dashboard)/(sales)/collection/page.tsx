'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const CollectionDashboard = dynamic(
    () => import('@/components/dashboards/sales/CollectionDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function CollectionPage() {
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Invoices', 'Receipts'); }, [fetchModule]);

    return <CollectionDashboard />;
}
