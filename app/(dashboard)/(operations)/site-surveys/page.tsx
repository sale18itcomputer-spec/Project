'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import SiteSurveyDashboard from '@/components/dashboards/operations/SiteSurveyDashboard';

function SiteSurveysContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Site_Survey_Logs'); }, [fetchModule]);

    return <SiteSurveyDashboard initialFilter={filter} />;
}

export default function SiteSurveysPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <SiteSurveysContent />
        </Suspense>
    );
}
