'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const ContactLogsDashboard = dynamic(() => import('@/components/dashboards/ContactLogsDashboard'), {
    loading: () => <ContentSkeleton />,
});

function ContactLogsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <ContactLogsDashboard initialFilter={filter} />;
}

export default function ContactLogsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ContactLogsContent />
        </Suspense>
    );
}
