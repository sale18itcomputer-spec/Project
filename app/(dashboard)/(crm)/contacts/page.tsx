'use client';

import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import ContactDashboard from '@/components/dashboards/crm/ContactDashboard';

function ContactsContent() {
    const searchParams = useSearchParams();
    const filter = searchParams.get('filter') ?? undefined;
    const { fetchModule } = useData();

    // Revalidate on mount so newly-added contacts from other tabs/users appear
    // without requiring a full page reload.
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
