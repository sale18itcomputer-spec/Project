'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';

const ContactDashboard = dynamic(() => import('@/components/dashboards/crm/ContactDashboard'), {
    loading: () => <ContentSkeleton />,
});

function ContactsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    return <ContactDashboard initialFilter={filter} />;
}

export default function ContactsPage() {
    return (
        <Suspense fallback={<ContentSkeleton />}>
            <ContactsContent />
        </Suspense>
    );
}
