'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const ContactDashboard = dynamic(
    () => import('@/components/dashboards/crm/ContactDashboard'),
    { loading: () => <ContentSkeleton /> }
);

function ContactsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    useEffect(() => { fetchModule('Contact_List'); }, [fetchModule]);

    return <ContactDashboard initialFilter={filter} />;
}

export default function ContactsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ContactsContent />
        </Suspense>
    );
}
