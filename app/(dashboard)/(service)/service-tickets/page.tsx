'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const ServiceTicketDashboard = dynamic(
  () => import('@/components/dashboards/service/ServiceTicketDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function ServiceTicketsContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? undefined;
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('Service Tickets'); }, [fetchModule]);

  return <ServiceTicketDashboard initialFilter={filter} />;
}

export default function ServiceTicketsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ServiceTicketsContent />
    </Suspense>
  );
}
