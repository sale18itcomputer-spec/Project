'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const ContactLogsDashboard = dynamic(() => import('@/components/dashboards/crm/ContactLogsDashboard'), {
    loading: () => <ContentSkeleton />,
});

function ContactLogsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Contact_Logs'); }, [fetchModule]);

    return <ContactLogsDashboard initialFilter={filter} />;
}

export default function ContactLogsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ContactLogsContent />
        </Suspense>
    );
}
