'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const PipelineDashboard = dynamic(() => import('@/components/dashboards/operations/PipelineDashboard'), {
    loading: () => <ContentSkeleton />,
});

function ProjectsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <PipelineDashboard initialFilter={filter} />;
}

export default function ProjectsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ProjectsContent />
        </Suspense>
    );
}
