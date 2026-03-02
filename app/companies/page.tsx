'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const CompanyDashboard = dynamic(() => import('@/components/dashboards/CompanyDashboard'), {
    loading: () => <ContentSkeleton />,
});

function CompaniesContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <CompanyDashboard initialFilter={filter} />;
}

export default function CompaniesPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <CompaniesContent />
        </Suspense>
    );
}
