'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import CompanyDashboard from '@/components/dashboards/crm/CompanyDashboard';

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
