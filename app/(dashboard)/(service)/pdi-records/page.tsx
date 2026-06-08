'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const PdiDashboard = dynamic(
  () => import('@/components/dashboards/service/PdiDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function PdiRecordsContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? undefined;
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('PDI Records'); }, [fetchModule]);

  return <PdiDashboard initialFilter={filter} />;
}

export default function PdiRecordsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <PdiRecordsContent />
    </Suspense>
  );
}
