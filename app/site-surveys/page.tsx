'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const SiteSurveyDashboard = dynamic(() => import('@/components/dashboards/SiteSurveyDashboard'), {
    loading: () => <ContentSkeleton />,
});

function SiteSurveysContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <SiteSurveyDashboard initialFilter={filter} />;
}

export default function SiteSurveysPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <SiteSurveysContent />
        </Suspense>
    );
}
