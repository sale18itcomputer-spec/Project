'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import ContentSkeleton from '@/components/common/ContentSkeleton';
import { useData } from '@/contexts/DataContext';

const ServiceInvoiceDashboard = dynamic(
  () => import('@/components/dashboards/service/ServiceInvoiceDashboard'),
  { loading: () => <ContentSkeleton /> }
);

function ServiceInvoicesContent() {
  const { fetchModule } = useData();

  useEffect(() => { fetchModule('Invoices', 'Receipts'); }, [fetchModule]);

  return <ServiceInvoiceDashboard />;
}

export default function ServiceInvoicesPage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <ServiceInvoicesContent />
    </Suspense>
  );
}
