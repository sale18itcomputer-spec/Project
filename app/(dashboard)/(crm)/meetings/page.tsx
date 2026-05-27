'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import MeetingDashboard from '@/components/dashboards/crm/MeetingDashboard';

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
