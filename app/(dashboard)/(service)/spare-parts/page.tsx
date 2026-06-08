'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const SparePartDashboard = dynamic(
  () => import('@/components/dashboards/service/SparePartDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function SparePartsContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? undefined;
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('Spare Parts'); }, [fetchModule]);

  return <SparePartDashboard initialFilter={filter} />;
}

export default function SparePartsPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <SparePartsContent />
    </Suspense>
  );
}
