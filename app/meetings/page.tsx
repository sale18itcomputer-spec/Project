'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const MeetingDashboard = dynamic(() => import('@/components/dashboards/MeetingDashboard'), {
    loading: () => <ContentSkeleton />,
});

function MeetingsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <MeetingDashboard initialFilter={filter} />;
}

export default function MeetingsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <MeetingsContent />
        </Suspense>
    );
}
