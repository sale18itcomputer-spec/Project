'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const SerialNumberDashboard = dynamic(
  () => import('@/components/dashboards/service/SerialNumberDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function SerialNumbersContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? undefined;
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('Serial Numbers'); }, [fetchModule]);

  return <SerialNumberDashboard initialFilter={filter} />;
}

export default function SerialNumbersPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <SerialNumbersContent />
    </Suspense>
  );
}
