'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import PipelineDashboard from '@/components/dashboards/operations/PipelineDashboard';

function ProjectsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Pipelines'); }, [fetchModule]);

    return <PipelineDashboard initialFilter={filter} />;
}

export default function ProjectsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ProjectsContent />
        </Suspense>
    );
}
