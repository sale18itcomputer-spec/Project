'use client';

import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const ConsignmentDashboard = dynamic(
    () => import('@/components/dashboards/inventory/ConsignmentDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function ConsignmentPage() {
    return <ConsignmentDashboard />;
}
