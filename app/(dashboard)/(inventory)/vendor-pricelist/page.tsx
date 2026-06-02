'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const VendorPricelistDashboard = dynamic(
    () => import('@/components/dashboards/inventory/VendorPricelistDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function VendorPricelistPage() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Vendors', 'Vendor Pricelist'); }, [fetchModule]);
    return <VendorPricelistDashboard />;
}
