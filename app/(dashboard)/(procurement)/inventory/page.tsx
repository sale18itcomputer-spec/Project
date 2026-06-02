'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const InventoryDashboard = dynamic(
    () => import('@/components/dashboards/inventory/InventoryDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function InventoryPage() {
    const { fetchModule } = useData();

    useEffect(() => {
        fetchModule('Inventory', 'Purchase Orders', 'Vendors');
    }, [fetchModule]);

    return <InventoryDashboard />;
}
