'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/contexts/DataContext';

const InquiryDashboard = dynamic(
  () => import('@/components/dashboards/procurement/InquiryDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function InquiriesContent() {
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') ?? undefined;
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('Product Inquiries'); }, [fetchModule]);

  return <InquiryDashboard initialFilter={filter} />;
}

export default function InquiriesPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <InquiriesContent />
    </Suspense>
  );
}
