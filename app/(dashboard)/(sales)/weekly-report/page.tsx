'use client';

import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const WeeklyReportDashboard = dynamic(
    () => import('@/components/dashboards/sales/WeeklyReportDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function WeeklyReportPage() {
    return <WeeklyReportDashboard />;
}
