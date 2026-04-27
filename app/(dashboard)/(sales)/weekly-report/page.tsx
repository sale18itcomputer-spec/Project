'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';

const WeeklyReportDashboard = dynamic(
    () => import('@/components/dashboards/sales/WeeklyReportDashboard'),
    { loading: () => <ContentSkeleton /> }
);

export default function WeeklyReportPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <WeeklyReportDashboard />
        </Suspense>
    );
}
