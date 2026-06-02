'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const CompanyDashboard = dynamic(
    () => import('@/components/dashboards/crm/CompanyDashboard'),
    { loading: () => <ContentSkeleton /> }
);

function CompaniesContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Company List'); }, [fetchModule]);

    return <CompanyDashboard initialFilter={filter} />;
}

export default function CompaniesPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <CompaniesContent />
        </Suspense>
    );
}
