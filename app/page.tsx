'use client';

import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const Dashboard = dynamic(() => import('@/components/dashboards/Dashboard'), {
    loading: () => <ContentSkeleton />,
});

export default function DashboardPage() {
    return <Dashboard />;
}
