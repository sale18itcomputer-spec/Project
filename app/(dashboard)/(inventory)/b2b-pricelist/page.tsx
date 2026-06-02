'use client';

import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const B2BPricelistDashboard = dynamic(
    () => import('@/components/dashboards/inventory/B2BPricelistDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function B2BPricelistPage() {
    return <B2BPricelistDashboard />;
}
