'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const MeetingDashboard = dynamic(() => import('@/components/dashboards/crm/MeetingDashboard'), {
    loading: () => <ContentSkeleton />,
});

function MeetingsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Meeting_Logs'); }, [fetchModule]);

    return <MeetingDashboard initialFilter={filter} />;
}

export default function MeetingsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <MeetingsContent />
        </Suspense>
    );
}
