'use client';
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useData } from '@/contexts/MiniAppDataContext';
import MiniAppShell from '@/components/miniapp/MiniAppShell';

const WeeklyReportDashboard = dynamic(() => import('@/components/dashboards/sales/WeeklyReportDashboard'));

function Content() {
    const { fetchModule } = useData();
    useEffect(() => { fetchModule('Weekly Report'); }, [fetchModule]);
    return <WeeklyReportDashboard />;
}

export default function Page() {
    return (
        <MiniAppShell title="Weekly Report" backHref="/miniapp">
            <Suspense><Content /></Suspense>
        </MiniAppShell>
    );
}
